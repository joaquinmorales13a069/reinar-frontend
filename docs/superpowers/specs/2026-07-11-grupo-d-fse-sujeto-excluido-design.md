# Grupo D — Reestructuración FSE: sujeto excluido como proveedor + retención de renta

**Fecha:** 2026-07-11
**Estado:** Diseño aprobado
**Repos afectados:** frontend (`Reinar/frontend`) y backend (`Reinar/server`)
**Referencia de negocio:** documento "Retroalimentación: DTE Factura de Sujeto Excluido (FSE) — Sistema REINAR" (julio 2026).

## Contexto y corrección de base

La FSE (DTE tipo 14) documenta una **compra**: REINAR es el adquirente y el sujeto excluido es el **vendedor/proveedor** no inscrito en IVA (sin NRC; puede ser persona natural o jurídica — soportar DUI y NIT). Hoy el sistema la tiene modelada al revés: se emite al *cliente* como receptor dentro del flujo de ventas, y no existe cálculo de retención de renta (el campo `retentionRenta` del payload de FacturaLlama está tipado pero nunca se usa).

Estado actual verificado en el código:
- `emitirSujetoExcluido` (`facturallama.service.ts`) construye `RecipientFSE` desde `factura.cliente`. `PayloadFSE.retentionRenta` existe y no se setea.
- El modelo `Proveedor` existe (compras de inventario/repuestos: `nombre`, `nrc`, `nit`, contacto) pero sin campos DTE.
- `ComprobanteRetencion` existente es retención de **IVA** (1 %/13 %) que clientes practican a REINAR — concepto distinto, no se toca.
- Tras anular un DTE, hoy se puede elegir FSE para cualquier cliente.

## Decisiones aprobadas

| Decisión | Elección |
|---|---|
| FSE del lado de ventas | **Se remueve** de las opciones de generar/emitir/re-emitir factura. El valor de enum y las facturas FSE históricas se conservan (solo lectura). Resuelve el punto "empresas no acceden a FSE" |
| Datos del sujeto excluido | **Extender `Proveedor`** con campos DTE opcionales (un solo catálogo de proveedores) |
| Retención de renta | **Automática** — bienes 0 %, servicios 10 % (Art. 156 CT) — con **override manual** "exonerar retención" + motivo obligatorio |
| Alcance v1 | Constancia de retención PDF + alerta de umbral $5,714.29 + plantillas de ítems recurrentes. **Diferido:** exportación F07/F930 (validar formatos con el contador) |
| Navegación | **Nuevo grupo "Compras"** (entre Ventas e Inventario): FSE, Proveedores e Ingresos de inventario (los dos últimos se mueven desde Inventario; rutas sin cambio) |
| Modelo de documento | **Modelo nuevo `FacturaSujetoExcluido`** con ítems propios (descartado: flag sobre `Factura` — contamina ventas; extender `IngresoInventario` — los FSE típicos son servicios) |

## 1. Modelo de datos (Prisma — todo aditivo)

### Proveedor (campos nuevos, todos opcionales)

| Campo | Tipo | Nota |
|---|---|---|
| `tipoDocumento` | `TipoDocumentoCliente?` (enum existente) | DUI/NIT/Pasaporte/Carné/Otro |
| `numeroDocumento` | `String?` | Formatos validados como en Cliente; `@@unique([tipoDocumento, numeroDocumento])` |
| `tipoPersona` | `TipoPersonaProveedor?` (enum nuevo `NATURAL \| JURIDICA`) | → `contributorType` del DTE |
| `actividadEconomica` | `String?` | Código CAT-019, validado contra `CAT019_CODIGOS` |
| `departamento`, `municipio`, `distrito?`, `complemento` | `String?` | Catálogos MH, como Cliente |
| `giroPredominante` | `TipoItemFse?` (mismo enum que los ítems FSE) | Precarga el `tipoItem` de ítems nuevos |

**Elegibilidad FSE derivada (no almacenada):** elegible ⇔ `nrc == null` (tener NRC = contribuyente IVA = bloqueado) Y documento + actividad + dirección completos.

### FacturaSujetoExcluido

- `numeroFse String @unique` — `FSEAAMMNNNNN` vía `generarNumero('fse')` (secuencia nueva en `SecuenciaDocumento`).
- `proveedorId`, `fechaEmision`, `condicionPago` (`CONTADO | CREDITO`, default CONTADO).
- Totales Decimal calculados server-side: `subtotalBienes`, `subtotalServicios`, `totalCompra`, `reteRenta`, `totalPagar`.
- `exonerarReteRenta Boolean @default(false)`, `motivoExoneracion String?`.
- DTE: `estadoDTE EstadoDTE @default(PENDIENTE)` (enum existente), `dteId String? @unique`, `dteControlNumber String?`, `dteRespuestaMH Json?`.
- `notas String?`, `creadoPorId`.
- **Una sola máquina de estados** (la del DTE). Editable/eliminable derivado: editar en PENDIENTE o RECHAZADO; eliminar solo PENDIENTE sin `dteId`.

### FseItem

`fseId`, `tipoItem` (`TipoItemFse`: `BIENES | SERVICIOS` — enum nuevo, compartido con `Proveedor.giroPredominante`), `descripcion`, `cantidad Int`, `precioUnitario Decimal`, `subtotal Decimal`, `orden Int`. Lo "mixto" surge de mezclar ítems — no hay tipo mixto por ítem.

### PlantillaFseProveedor

`proveedorId`, `descripcion`, `tipoItem`, `precioUnitario Decimal?`. CRUD simple; el form de FSE las ofrece con un clic.

## 2. Cálculos y reglas de negocio

```
subtotalServicios = Σ subtotal de ítems SERVICIOS
subtotalBienes    = Σ subtotal de ítems BIENES
totalCompra       = subtotalBienes + subtotalServicios
reteRenta         = exonerarReteRenta ? 0 : round(subtotalServicios × 0.10, 2)
totalPagar        = totalCompra − reteRenta
```

- Retención solo sobre la porción de servicios; bienes exonerados automáticamente. Todo con `Prisma.Decimal`; los totales SIEMPRE se recalculan en el backend (nunca se confía en los del cliente).
- Si `exonerarReteRenta`, `motivoExoneracion` es obligatorio (queda en el documento y auditoría).
- **Validaciones al emitir** (422 con mensaje claro): proveedor sin NRC; `tipoDocumento` + `numeroDocumento` presentes; `actividadEconomica` válida CAT-019; dirección completa; `tipoPersona` presente; al menos un ítem.
- **Umbral Art. 28 LIVA ($5,714.29):** acumulado de `totalCompra` de FSE con `estadoDTE = APROBADO` del proveedor en los últimos 365 días. Se muestra en el detalle del proveedor y en el form de FSE; advertencia (no bloqueo) cuando `acumulado + totalCompra actual ≥ 5714.29`.

## 3. Integración FacturaLlama y ciclo DTE

- **`emitirSujetoExcluido` se reescribe** para operar sobre `FacturaSujetoExcluido`: `RecipientFSE` desde el **proveedor** (nombre, `identificationDocument` vía el helper existente `buildIdentificationDocument`, `economicActivity`, `contributorType` desde `tipoPersona`, `address`), `items` desde `FseItem` (con `type` por ítem), `paymentType` desde `condicionPago`, y **`retentionRenta: Number(reteRenta)` cuando `reteRenta > 0`**.
- Mismo patrón de las facturas: `dteId` UUID generado y persistido ANTES del POST (idempotencia); 422 de FacturaLlama → RECHAZADO persistido, no throw.
- **Supuesto a validar en sandbox** en la primera emisión: FacturaLlama espera `retentionRenta` como monto (así está tipado/comentado en `facturallama.types.ts`). Si fuera porcentaje o lo calculara él, ajustar el builder — el resto del diseño no cambia.
- Ciclo espejo de facturas: emitir (PENDIENTE→PROCESANDO→APROBADO/RECHAZADO), re-emitir tras RECHAZADO (corrigiendo datos), anular DTE aprobado (solo ADMIN, motivo, ventana 3 días MH, vía `invalidarDTE` → estadoDTE ANULADO), sincronizar estado, descarga de PDF/JSON oficiales por `dteId`.

## 4. Backend — módulo `fse` + constancia de retención

Nuevo módulo `server/src/modules/fse/` (routes, controller, service, schemas):

| Ruta | Rol escritura | Descripción |
|---|---|---|
| `GET /fse` | todos leen | Lista paginada; filtros: proveedorId, estadoDTE, fechaDesde/Hasta |
| `POST /fse` | ADMIN/GERENTE/OPERADOR | Crear (totales calculados server-side) |
| `GET /fse/:id` | todos | Detalle con proveedor + ítems |
| `PUT /fse/:id` | operadores | Editar cabecera + ítems (solo PENDIENTE/RECHAZADO; recalcula totales) |
| `DELETE /fse/:id` | operadores | Eliminar (solo PENDIENTE sin `dteId`) |
| `PATCH /fse/:id/dte` | operadores | Emitir/re-emitir con validaciones de elegibilidad |
| `DELETE /fse/:id/dte` | ADMIN | Anular DTE (motivo ≥ 10 chars) |
| `GET /fse/:id/pdf` | todos | PDF oficial FacturaLlama |
| `GET /fse/:id/constancia` | todos | Constancia de retención (solo reteRenta > 0 y DTE APROBADO) |
| `GET/POST/DELETE /proveedores/:id/plantillas-fse` | operadores escriben | Plantillas de ítems |

- **Constancia de retención:** template `constancia-retencion.hbs` (mismo pipeline Puppeteer): REINAR como agente de retención (datos de `ConfiguracionEmpresa`), proveedor (nombre, documento), número FSE + `dteControlNumber`, fecha, total de la compra, porción de servicios, monto retenido (10 %), base legal Art. 156 CT.
- `proveedores.service`: cálculo del acumulado 12 meses y elegibilidad FSE derivada (expuestos en `GET /proveedores/:id`); validaciones de los campos fiscales nuevos en sus schemas (formatos de documento como Cliente, CAT-019).
- Auditoría: audit log en crear/editar/emitir/anular FSE (patrón existente).

## 5. Frontend

- **Nav — nuevo grupo "Compras"** (entre Ventas e Inventario): `FSE — Sujeto Excluido` (`/fse`, nuevo), `Proveedores` y `Ingresos de inventario` (movidos desde Inventario; rutas y páginas sin cambio). Actualizar también `BOTTOM_NAV_ITEMS` si aplica.
- **`/fse`** — listado: número `font-mono`, proveedor, fecha, `totalCompra`/`reteRenta`/`totalPagar`, `EstadoDteBadge` (reusado), filtros con `FilterBar`, paginación.
- **`/fse/nuevo`** — página dedicada (sin modal):
  - Selector de proveedor con indicador de elegibilidad; si no es elegible, mensaje con el motivo (tiene NRC / faltan datos fiscales) y link al form del proveedor.
  - Banner de umbral con el acumulado 12m del proveedor seleccionado (warning si supera con este FSE).
  - Ítems: tipo BIENES/SERVICIOS (precargado desde `giroPredominante`), descripción, cantidad, precio; botón "Agregar desde plantilla" (plantillas del proveedor).
  - Resumen en vivo con `decimal.js`: subtotales por tipo, retención 10 % sobre servicios, total a pagar.
  - Checkbox "Exonerar retención de renta" + textarea de motivo (obligatorio si se marca).
- **`/fse/[id]`** — detalle: ítems y totales (destacando `reteRenta` y `totalPagar`), panel DTE (emitir/re-emitir tras rechazo/anular/sincronizar — mismo patrón visual de `DteSection`), descargas (PDF oficial, JSON, constancia cuando aplica), editar/eliminar según estado. Botones de escritura ocultos para VISUALIZADOR.
- **Proveedores:** el form gana la sección "Datos fiscales (para FSE)" (documento con formatos, tipo de persona, actividad económica CAT-019, dirección con catálogos MH, giro predominante — todo opcional); el detalle muestra badge de elegibilidad ("Elegible FSE" / "Contribuyente IVA — no aplica FSE" / "Faltan datos fiscales"), el acumulado 12 meses, y la gestión de plantillas de ítems.
- Hooks React Query nuevos: `use-fse.ts` (queries + mutations con toasts según convención) y extensiones en `use-proveedores` si existe (o crearlo).

## 6. Remoción del FSE del flujo de ventas

- **Backend:** `generarFacturaSchema` y `emitirDTESchema` (`facturas.schemas.ts`) quitan `'SUJETO_EXCLUIDO'` de sus enums de entrada; el dispatch de `emitirDTE` elimina la rama FSE. El valor `SUJETO_EXCLUIDO` del enum `TipoDTE` en BD **se conserva** (facturas históricas intactas). Las validaciones FSE previas a emitir en `facturas.service.ts` se eliminan.
- **Frontend:** `GenerarFacturaModal` quita la opción FSE del selector; `DteSection` quita la tarjeta FSE del grid de tipos (y su lógica de `motivoBloqueo`); `TipoDteBadge` conserva el caso `SUJETO_EXCLUIDO` para históricos. `types/api.ts`: los DTOs de entrada (`GenerarFacturaInput`, `EmitirDTEDto`) restringen el tipo; el tipo de lectura conserva el valor.
- Notas de crédito contra FSE históricos: el soporte existente en `emitirNC` se conserva (los DTE históricos pueden requerir NC).

## Fuera de alcance

- Exportación / marcado F07 y F930 (validar formatos con el contador — siguiente iteración).
- Migración de facturas FSE históricas al modelo nuevo (se conservan como están).
- Envío del FSE por correo al proveedor.
- Pagos/cuentas por pagar del FSE (el `totalPagar` es informativo; no hay módulo de pagos a proveedores en v1).

## Verificación

- **Backend (vitest, TDD):** cálculos (mixto bienes+servicios, solo bienes → 0, exoneración con motivo, redondeo 2 decimales); validaciones de elegibilidad (NRC presente → bloqueo, datos incompletos → bloqueo); builder FacturaLlama (retentionRenta seteado solo cuando > 0, recipient desde proveedor); umbral 12 meses; constancia (solo APROBADO + reteRenta > 0); remoción de FSE en schemas de facturas. Suite: los 14 fallos pre-existentes no aumentan.
- **Frontend:** `pnpm tsc --noEmit` + `pnpm lint` en baseline (12/24); flujo manual completo contra sandbox FacturaLlama: crear proveedor con datos fiscales → crear FSE mixto → verificar retención → emitir → constancia → anular. Checklist estándar pre-PR.
- **Migraciones** (todas aditivas): columnas nuevas en Proveedor, 3 tablas nuevas (`FacturaSujetoExcluido`, `FseItem`, `PlantillaFseProveedor`), 2 enums nuevos (`TipoPersonaProveedor`, `TipoItemFse`), secuencia `fse` — workflow offline de BD compartida.
