# Spec — Factura a nombre de tercero + consecutivo del acta en el PDF de factura

**Fecha:** 2026-07-05
**Origen:** Retroalimentación de ventas de Reinar El Salvador — dos puntos independientes, combinados en un spec a pedido del usuario.
**Repos afectados:** `/server` (backend Express + Prisma) y `/frontend` (Next.js). Rama espejo en ambos: `feat/factura-tercero-y-acta-pdf`.

Este spec cubre **dos features independientes**, en secciones separadas. El plan las tratará como grupos de tareas distintos.

---

## Sección A — Consecutivo del acta de entrega en el PDF de factura

### Problema
El PDF de factura muestra la "Cotización origen" pero no el/los número(s) de acta de entrega (folio interno de Reinar). El feedback pide agregarlo debajo de Cotización Origen.

### Estado actual (verificado)
- `ActaEntrega.numeroActa String @unique` existe (`schema.prisma:754`) — es el consecutivo.
- La factura ya tiene sus actas vinculadas (`Factura.actasEntrega`, auto-vinculadas al facturar). Una factura puede tener **varias** actas.
- `generarFacturaPDF` (`pdf.service.ts:372-397`) **NO** incluye `actasEntrega` en el `include`.
- `factura.hbs` renderiza "Cotización origen" (`templates/factura.hbs:450-454`) dentro del `conditions-grid`; no hay bloque de actas.

### Diseño
- `generarFacturaPDF`: agregar `actasEntrega: { select: { numeroActa: true }, orderBy: { numeroActa: 'asc' } }` al `include`, y mapear al contexto `factura` un campo `numerosActa: string` (los `numeroActa` unidos con ", "; string vacío si no hay).
- `factura.hbs`: nuevo `cond-item` "Acta(s) de entrega" junto a "Cotización origen"; muestra `factura.numerosActa` cuando hay al menos una, y "—" cuando no hay.
- Sin migración, sin tocar el DTE. Solo el PDF.

---

## Sección B — Factura a nombre de un tercero

### Problema
Hoy el receptor fiscal de la factura (y por ende del DTE) es **siempre** el cliente de la cotización: `factura.clienteId` se copia rígido de `cotizacion.clienteId` (`facturas.service.ts:494`), y los 4 builders de FacturaLlama + la validación de emisión + el PDF leen exclusivamente `factura.cliente`. Ventas necesita poder emitir la factura a nombre de un **tercero** (empresa externa o particular externo).

### Estado actual (verificado)
- El receptor del DTE está **100% acoplado a `factura.cliente`**: `emitirFC`/`emitirCCF`/`emitirSujetoExcluido`/`emitirNC` (`facturallama.service.ts`) leen solo `factura.cliente.*`. `contactoFacturacion` no se usa en emisión (solo tracking).
- `emitirDTE` (`facturas.service.ts:277-297`) valida los datos fiscales de `factura.cliente` según el tipo (CCF: NCR+actividad+DUI/NIT; FSE: documento+actividad+dirección).
- El PDF de factura ("Facturar a", `factura.hbs:436-443`) lee `factura.cliente`.
- Cuentas por cobrar, el listado de facturas y el detalle del cliente filtran por `factura.clienteId`.
- El `Cliente` (EMPRESA o PARTICULAR) ya tiene todos los campos fiscales que cada DTE exige. Un `Contacto` **no** tiene datos fiscales, así que no puede ser receptor de un DTE.

### Decisiones (confirmadas con el usuario)
1. **El tercero es un Cliente registrado** (empresa externa o particular externo, ambos modelables como `Cliente`). No se amplía `Contacto` ni se capturan datos fiscales sueltos.
2. **El receptor pasa a ser el dueño de la factura** — para cuentas por cobrar, listado y detalle del cliente, además del DTE y el PDF.

### Diseño

**Idea central (sin migración):** `factura.clienteId` **es el receptor** de la factura. Se cambia su origen: en vez de copiarse rígido de `cotizacion.clienteId`, se toma de un `receptorClienteId` elegido, con **default = el cliente de la cotización**. Como todo el sistema ya lee `factura.cliente`, el DTE, la validación, el PDF y la titularidad de AR/listado apuntan correctamente al tercero sin más cambios. El cliente solicitante original queda siempre accesible vía `factura.cotizacion.cliente`.

**Backend:**
- `generarFacturaSchema` (`facturas.schemas.ts`): nuevo campo `receptorClienteId: z.string().cuid().optional()`.
- `generarFacturaDesdeCotizacion` (`facturas.service.ts`): `const clienteId = input.receptorClienteId ?? cotizacion.clienteId`. Si `receptorClienteId` viene, validar que ese `Cliente` exista y esté `ACTIVO` (404/422 si no). Usar `clienteId` en el `factura.create`.
- Registrar en el `auditLog` de creación cuando el receptor difiere del cliente de la cotización (para trazabilidad de "facturado a tercero").
- **Sin migración** (se reutiliza `clienteId`; las facturas existentes no cambian). El DTE (`facturallama.service.ts`), la validación de emisión (`emitirDTE`) y el PDF **no requieren cambios** — ya leen `factura.cliente`, que ahora es el receptor.
- La validación fiscal del DTE aplica automáticamente al receptor (ej. un CCF a un tercero exige el NCR/actividad del tercero) — comportamiento correcto y ya existente.
- La entrega del acta sigue validando el receptor físico contra `cotizacion.clienteId` (la mercadería va a quien la solicitó) — sin cambios; ya quedó así del flujo anterior.

**Frontend:**
- `GenerarFacturaModal`: selector opcional **"Facturar a un tercero"** (default: el cliente de la cotización). Lista Clientes `ACTIVO` (reutiliza el selector/typeahead de clientes existente). Al elegir un tercero distinto al de la cotización, mostrar un aviso claro ("El DTE y las cuentas por cobrar se emitirán a nombre de <tercero>"). El submit incluye `receptorClienteId` solo cuando difiere del cliente de la cotización.
- `hooks/use-facturas.ts` (`GenerarFacturaInput`): agregar `receptorClienteId?: string`.
- Detalle de factura: cuando `factura.clienteId !== factura.cotizacion.cliente.id`, mostrar ambos — "Facturada a: <receptor>" (el actual "Cliente") y una línea "Cotización solicitada por: <cliente de la cotización>". Cuando coinciden, se ve como hoy.
- `contactoFacturacion` (atención a un contacto) se mantiene sin cambios.

### Edge cases
- `receptorClienteId` inexistente o INACTIVO → 404/422 con mensaje claro.
- Receptor sin los datos fiscales del tipo de DTE elegido (ej. CCF sin NCR): el error de emisión existente lo indica, ahora apuntando al receptor.
- Receptor = cliente de la cotización (o `receptorClienteId` omitido): comportamiento idéntico al actual.
- Notas de crédito / retenciones sobre la factura: usan `factura.cliente` (el receptor) — coherente.

### Verificación
- Backend: `npx tsc --noEmit` + `pnpm test`. Tests: `generarFacturaDesdeCotizacion` con `receptorClienteId` (usa el tercero como `clienteId`); sin él (usa el cliente de la cotización); receptor inexistente/INACTIVO → error. Un test de que el DTE/validación resultante operan sobre el receptor (ya cubierto porque leen `factura.cliente`).
- Sección A: test/inspección de que el contexto del PDF incluye `numerosActa`.
- Frontend: `pnpm tsc --noEmit` + `pnpm lint`.
- Manual e2e: generar una factura eligiendo otro cliente como receptor → verificar que el DTE, el PDF ("Facturar a") y el listado/AR van al tercero, y que el detalle muestra el solicitante; verificar el/los número(s) de acta en el PDF de factura.

## Fuera de alcance
- Ampliar `Contacto` con datos fiscales / emitir DTE a nombre de un contacto sin identidad fiscal propia.
- Capturar datos de receptor no registrados como `Cliente`.
- DTE de Factura de Exportación (FEX) — ítem separado del feedback.
- Cambiar el receptor de una factura ya creada (se elige al generar; para corregir, anular y regenerar).
