# Spec — Flujo Cotización→Acta→Factura (además del actual)

**Fecha:** 2026-07-05
**Origen:** Retroalimentación de ventas de Reinar El Salvador: "El sistema debe permitir realizar cualquiera de estos 2 procesos: Cotización - Acta de entrega - Factura. Cotización - Factura - Acta de entrega."
**Repos afectados:** `/server` (backend Express + Prisma) y `/frontend` (Next.js). Rama espejo en ambos: `feat/flujo-cotizacion-acta-factura`.

## Problema

Hoy solo existe **Cotización → Factura → Acta**: el acta de entrega requiere una factura previa (`ActaEntrega.facturaId` es obligatorio; la creación cuelga de `POST /facturas/:facturaId/actas`). Ventas necesita también **Cotización → Acta → Factura** (entregar la mercadería y facturar después).

## Estado actual (verificado en código)

- **`ActaEntrega`** (`schema.prisma:750-792`): `facturaId String` **NOT NULL** + relación requerida. No hay vínculo directo a `Cotizacion` para la creación (solo `renovaciones`, la inversa de las renovaciones de renta).
- **`ActaEntregaItem.cotizacionItemId`** (`schema.prisma:810`) es un `String` plano; el ítem referencia la **cotización**, no la factura. No hay `FacturaItem` (la factura no tiene líneas propias).
- **`crearActa(facturaId, …)`** (`actas.service.ts:249-514`): usa la factura solo como puente — carga `factura.{estado, cotizacionId}`, gate `estado !== 'ANULADA'` (`:255`), y trae los `CotizacionItem` por `factura.cotizacionId` (`:277`). El anti-doble-despacho scope por `facturaId` (`:300`). La lógica de inventario (equipos, herramientas, consumibles, piezas) **no usa la factura**.
- **Inventario:** los equipos se marcan `RENTADO` al **aprobar la cotización** (`cotizaciones.service.ts:774`); consumibles/piezas se descuentan al **crear el acta**. La factura no compromete inventario.
- **`Factura.cotizacionId @unique`** (`schema.prisma:582`) → factura y cotización son **1-a-1**.
- **`_entregar`** (`actas.service.ts:701-764`): valida receptor contra `acta.factura.clienteId` (`:713`) y, si la factura es QUEDAN, sella `factura.fechaEntregaReal = fechaEntrega` (`:736-753`) — **pero NO calcula `fechaVencimiento`** (a diferencia de `marcarFacturaEntregada` de Grupo B, que hace `fechaVencimiento = fechaEntregaReal + plazoCredito`). Inconsistencia pre-existente.
- **`registrarRecepcion(facturaId, …)`** (`actas.service.ts:818`): scope de ítems por `actaEntrega: { facturaId }` (`:834`). `ActaRecepcion.facturaId` es **NOT NULL** (`schema.prisma:830`), `actaEntregaId` opcional.
- **Rutas:** creación solo bajo `/facturas/:facturaId/actas` (subrouter). Standalone `/actas` para el resto (`GET`, `PATCH`, estado, renovar, pdf). Recepciones análogas.
- **Frontend:** `actas/nueva` exige seleccionar una factura (`SelectorFactura`, `lib/schemas/acta.ts:18`); `useCrearActa` hace `POST /facturas/:facturaId/actas`. Se dispara desde el detalle de factura (`ActasVinculadasCard`).

**Veredicto:** el acoplamiento acta↔factura es **estructural (FK NOT NULL), no lógico**. La factura funciona como puente a la cotización + un gate de estado. Las únicas dependencias factura-específicas (QUEDAN, receptor por `clienteId`) ocurren al **entregar**, no al crear, y son condicionables.

## Decisiones (confirmadas con el usuario)

1. **Anclar el acta a la cotización** (obligatorio) y hacer la factura **opcional**. Cuando luego se genera la factura de esa cotización, **auto-vincular** las actas existentes (rellenar `facturaId`). Ambos órdenes convergen al mismo estado.
2. **Flujo completo sin factura:** se puede crear, despachar, **entregar** y registrar devoluciones sin factura. El receptor se valida contra el cliente de la **cotización**. Al crear la factura, si es QUEDAN y ya hay un acta entregada, su fecha de entrega real (y el vencimiento) se toman de la entrega del acta.
3. **Gate de creación:** cotización `APROBADA` (reemplaza el gate "factura ≠ ANULADA"; garantiza inventario comprometido).

## Diseño

### 1. Modelo de datos (migración; BD remota compartida → `migrate diff` offline + `deploy`)

- `ActaEntrega.cotizacionId String` **NUEVO, obligatorio** + FK a `Cotizacion` (relación `actas`). Backfill: `UPDATE "ActaEntrega" a SET "cotizacionId" = f."cotizacionId" FROM "Factura" f WHERE a."facturaId" = f."id";` antes de poner NOT NULL.
- `ActaEntrega.facturaId` → **nullable** (`DROP NOT NULL`).
- `ActaRecepcion.cotizacionId String` **NUEVO, obligatorio** + FK a `Cotizacion`. Backfill: `UPDATE "ActaRecepcion" r SET "cotizacionId" = f."cotizacionId" FROM "Factura" f WHERE r."facturaId" = f."id";`.
- `ActaRecepcion.facturaId` → **nullable** (`DROP NOT NULL`); las devoluciones se anclan en `actaEntregaId`/`cotizacionId`.
- Nuevas relaciones inversas `Cotizacion.actas ActaEntrega[]` y `Cotizacion.recepciones ActaRecepcion[]`.
- Orden de la migración: ADD `cotizacionId` nullable (en ambas tablas) → backfill UPDATE → `SET NOT NULL` + FK → `DROP NOT NULL` en los dos `facturaId`.

### 2. Creación del acta (backend)

- **Refactor `crearActa`** para anclar en cotización: `crearActa(cotizacionId: string, facturaId: string | null, input, usuarioId)`.
  - Carga la cotización (`{ id, estado, clienteId }`); gate `cotizacion.estado === 'APROBADA'` (409 si no). (Se elimina la lectura de `factura.estado`.)
  - Trae `CotizacionItem` por `cotizacionId` (igual que hoy, pero directo).
  - Anti-doble-despacho: scope por `actaEntrega: { cotizacionId }` (equivalente a hoy, funciona sin factura).
  - Persiste `ActaEntrega` con `cotizacionId` (siempre) y `facturaId` (o null). La lógica de inventario/ítems no cambia.
- **Dos rutas de creación:**
  - `POST /facturas/:facturaId/actas` (existente): el controller resuelve `cotizacionId` desde la factura y llama `crearActa(cotizacionId, facturaId, …)`. Flujo actual intacto.
  - `POST /cotizaciones/:cotizacionId/actas` (**nueva**, mismos roles escritores): llama `crearActa(cotizacionId, null, …)`. Se admiten varias actas por cotización (despachos parciales). Flujo inverso.
- Los endpoints de apoyo (`items-disponibles-despacho`, `bodegas-con-items-disponibles`) se exponen también bajo `/cotizaciones/:cotizacionId/actas/...` (resuelven por cotización).

### 3. Auto-vinculación + sellado QUEDAN (backend)

- **Helper compartido `sellarEntregaQuedan(tx, factura, fechaEntrega)`** (en `facturas.service.ts` o `actas.service.ts`): si `factura.esQuedan && !factura.fechaEntregaReal`, setea `fechaEntregaReal = fechaEntrega` y, si hay `plazoCredito`, `fechaVencimiento = fechaEntregaReal + plazoCredito` días. Cierra la inconsistencia pre-existente de `_entregar` (que hoy sella la fecha pero no calcula el vencimiento).
- **En `generarFacturaDesdeCotizacion`** (`facturas.service.ts`): tras crear la factura, dentro de la misma transacción:
  1. **Auto-vincular** actas de la cotización: `tx.actaEntrega.updateMany({ where: { cotizacionId, facturaId: null }, data: { facturaId } })` y lo mismo para sus `ActaRecepcion` (por `actaEntrega.cotizacionId`).
  2. Si la factura es **QUEDAN** y existe un acta **ENTREGADA** para la cotización, tomar su `fechaEntrega` (la más antigua) y llamar `sellarEntregaQuedan(tx, factura, fechaEntregaDelActa)`.

### 4. Entrega / recepción sin factura (backend)

- **`_despachar`:** sin cambios (no usa factura).
- **`_entregar`:** validar el receptor contra el **cliente de la cotización** (`acta.cotizacion.clienteId`; hoy usa `acta.factura.clienteId`, idéntico cuando hay factura). El sellado QUEDAN se hace vía `sellarEntregaQuedan` **solo si `acta.facturaId` no es null**; si no hay factura, se difiere (sección 3).
- **`registrarRecepcion`:** re-anclar el scope. Refactor a `registrarRecepcion(cotizacionId, …)` (el controller lo resuelve desde la factura o directo); los ítems se filtran por `actaEntrega: { cotizacionId }`. `ActaRecepcion` se crea con `cotizacionId` derivado y `facturaId` = el de la cotización o null. Nueva ruta `POST /cotizaciones/:cotizacionId/recepciones` además de la existente bajo factura.
  - **Nota de modelo:** para anclar la recepción sin factura se agrega `ActaRecepcion.cotizacionId String` (obligatorio, backfill desde `factura.cotizacionId`) — mismo patrón que el acta. Se incluye en la migración de la sección 1.

### 5. Anulación de factura con actas (edge case)

- En `cambiarEstado` ANULADA (`facturas.service.ts`), **bloquear** la anulación si la cotización tiene un acta en estado `DESPACHADO`, `ENTREGADO` o `DEVUELTA_PARCIAL` → `409 ACTA_EN_CURSO` ("No se puede anular la factura: ya hay mercadería despachada/entregada. Registrá primero la devolución."). Si solo hay actas `PENDIENTE`, se permite (y quedan referenciando la cotización CANCELADA; el auto-vínculo no se revierte pero el acta PENDIENTE puede eliminarse/ignorarse). Evita "cancelar la venta" con mercadería afuera.

### 6. Frontend

- **`actas/nueva`** acepta `?cotizacionId=` además de `?facturaId=`:
  - Con `facturaId` → flujo actual (`SelectorFactura`, `POST /facturas/:id/actas`).
  - Con `cotizacionId` (o elegido en un **`SelectorCotizacion`** de cotizaciones APROBADAS) → `POST /cotizaciones/:id/actas`. Bodegas/ítems disponibles se resuelven por cotización.
  - El schema del form pasa a exigir **`facturaId` XOR `cotizacionId`**.
- **Nuevo botón "Crear acta de entrega"** en el detalle de una cotización **APROBADA**.
- **Detalle del acta y su PDF:** muestran la **cotización origen** siempre; la factura cuando exista (con un guion/estado "Aún sin factura" si es null).
- Hooks: `useCrearActaDesdeCotizacion` (`POST /cotizaciones/:id/actas`), variantes de items/bodegas por cotización; tipos de `Acta` con `cotizacionId` y `facturaId: string | null`.

### 7. Edge cases

- **Crear factura de una cotización con actas** → auto-vincula (sección 3); si es QUEDAN y hay acta entregada, sella la entrega + vencimiento.
- **Varias actas por cotización** (despachos parciales) → soportado; el anti-doble-despacho por cotización evita despachar dos veces el mismo ítem.
- **Anular factura con actas en curso** → bloqueado (sección 5).
- **Entrega sin factura** → receptor validado por cliente de la cotización; QUEDAN diferido.
- **VISUALIZADOR** sin cambios.

### 8. Verificación

- Backend: `npx tsc --noEmit` + `pnpm test`. Tests: `crearActa` desde cotización sin factura (gate APROBADA, inventario, anti-doble-despacho por cotización); auto-vinculación al facturar; `sellarEntregaQuedan` (fechaEntregaReal + vencimiento) tanto en `_entregar` como en el backfill; `_entregar` sin factura (receptor por cotización, QUEDAN diferido); `registrarRecepcion` por cotización sin factura; bloqueo de anulación con acta en curso. Migración offline + backfill verificado.
- Frontend: `pnpm tsc --noEmit` + `pnpm lint`.
- Manual e2e: (a) Cotización→Acta→Factura completo (crear acta desde cotización, despachar, entregar, luego facturar y verificar auto-vínculo + QUEDAN); (b) el flujo actual Cotización→Factura→Acta sigue funcionando.

## Fuera de alcance

- Consecutivo del acta en el PDF de **factura** (ítem separado del feedback; este cambio deja el vínculo listo para hacerlo trivial).
- Factura a nombre de tercero; DTE de exportación (FEX).
- Cambiar cómo/ cuándo se compromete el inventario (sigue siendo al aprobar la cotización).
