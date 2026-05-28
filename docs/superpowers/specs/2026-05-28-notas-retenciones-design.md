# RAMA 14 — Notas de crédito y retenciones

**Branch:** `feat/notas-retenciones`
**Fecha:** 2026-05-28
**Plan de origen:** `docs/plan-trabajo-frontend.md` → RAMA 14

> **Nota:** el plan original está desactualizado respecto al backend. Este spec parte del backend real (`/Users/joaquinmorales13a06/Desktop/Reinar/server`, commits hasta `25faffb`), no de las firmas que aparecen en el plan.

---

## 1. Objetivo

Portar los módulos de **Notas de Crédito** (acreditaciones totales o parciales sobre facturas ya emitidas, con DTE legal propio) y **Retenciones** (comprobantes que el cliente emite al retener IVA al pagar) desde los prototipos JSX en `Frontend-REINAR-design/`, consumiendo los endpoints reales del backend Express y respetando las reglas de negocio que el servicio impone.

## 2. Alcance

Una sola rama (`feat/notas-retenciones`) con los dos módulos.

### 2.1 Páginas

**Notas de Crédito**
- `app/(dashboard)/notas-credito/page.tsx` — listado con FilterBar (tipo TOTAL/PARCIAL + estadoDTE), totales agregados.
- `app/(dashboard)/notas-credito/nueva/page.tsx` — formulario que **solo crea** (NC queda en estadoDTE PENDIENTE).
- `app/(dashboard)/notas-credito/[id]/page.tsx` — detalle con `DteSection kind="nota"` (emitir / re-emitir / sincronizar / anular DTE), descarga PDF branded y PDF oficial DTE.
- `app/(dashboard)/notas-credito/[id]/anular-dte/page.tsx` — página dedicada (solo ADMIN) para enviar anulación de DTE al Ministerio de Hacienda.

**Retenciones**
- `app/(dashboard)/retenciones/page.tsx` — listado con FilterBar (chips 1% / 13%), totales agregados, descargar PDF y eliminar (ADMIN) inline.
- `app/(dashboard)/retenciones/nueva/page.tsx` — formulario crear.
- `app/(dashboard)/retenciones/[id]/page.tsx` — detalle + factura vinculada + descarga PDF + eliminar (ADMIN) inline con ConfirmRow.

### 2.2 Entradas adicionales

En `app/(dashboard)/facturas/[id]/page.tsx` se agregan dos acciones:
- **Crear nota de crédito** — visible si rol puede escribir, `estadoDTE === 'APROBADO'` y `estado ∈ {PAGADA, PARCIAL}`. Navega a `/notas-credito/nueva?facturaId=<id>`.
- **Registrar retención** — visible si rol puede escribir y `estado !== 'ANULADA'`. Navega a `/retenciones/nueva?facturaId=<id>`.

### 2.3 Fuera de alcance

- Endpoint backend nuevo para sincronizar DTE de NC (cron de 5 min cubre el caso).
- Filtro de búsqueda libre (`q`) en backend de notas-credito y retenciones (búsqueda client-side basta para MVP).
- Filtro `estado` como array en `GET /facturas` (si hace falta, filtro client-side sobre las primeras N facturas).
- Reportes y KPIs agregados (módulo Analítica es otra rama).

## 3. Backend — endpoints reales

Tomados de `server/src/modules/notas-credito/` y `server/src/modules/retenciones/`.

### 3.1 Notas de Crédito

```
GET    /api/v1/notas-credito                ?page&limit&facturaId&estadoDTE
POST   /api/v1/notas-credito                { facturaId, motivo, tipo, subtotal?, montoIva?, total? }
GET    /api/v1/notas-credito/:id
PATCH  /api/v1/notas-credito/:id/dte        { tipoDTE: 'NC' }
GET    /api/v1/notas-credito/:id/dte/pdf    → PDF oficial DTE (solo si APROBADO)
DELETE /api/v1/notas-credito/:id/dte        → anula el DTE en Hacienda (solo ADMIN)
GET    /api/v1/notas-credito/:id/pdf        → PDF branded
```

**Reglas de negocio (service):**
- La factura debe estar en estado `PAGADA` o `PARCIAL`.
- La suma de NCs activas (no ANULADAs) no puede exceder `factura.total`.
- Tipo `TOTAL`: el backend toma subtotal/IVA/total de la factura; la factura pasa a `ANULADA`.
- Tipo `PARCIAL`: cliente provee subtotal/montoIva/total; el backend resta `total` de `saldoPendiente` y recalcula estado (`PAGADA` si saldo ≤ 0).
- Emitir DTE requiere: factura origen con `estadoDTE = APROBADO` y `tipoDTE ∈ {FC, CCF, SUJETO_EXCLUIDO}`.
- NC contra CCF requiere que el cliente tenga `DUI`/`NIT` + `NCR` registrados (commit `bdd4809`).
- NC contra FC/FSE requiere `identificationDocument` del cliente.
- Re-emisión desde `RECHAZADO` está permitida (commit `45181ac`).
- Anular DTE solo procede si está `APROBADO`.

### 3.2 Retenciones

```
GET    /api/v1/retenciones                  ?page&limit&facturaId&clienteId
POST   /api/v1/retenciones                  { facturaId, numeroCR, porcentaje, monto, fecha, notas? }
GET    /api/v1/retenciones/:id
DELETE /api/v1/retenciones/:id              (solo ADMIN)
GET    /api/v1/retenciones/:id/pdf
```

**Reglas de negocio (service):**
- Factura no puede estar `ANULADA`.
- `monto` ≤ `factura.saldoPendiente`.
- `porcentaje` ∈ {1, 13}.
- `(clienteId, numeroCR)` es único (constraint Prisma).
- Crear retención resta `monto` de `saldoPendiente`; estado pasa a `PAGADA` si saldo ≤ 0.
- Eliminar restaura `saldoPendiente` y re-evalúa estado (`PARCIAL` si `montoPagado > 0`, `PENDIENTE` si no).

### 3.3 Notas sobre cambios recientes en DTE/FacturaLlama

- NC ahora soporta FC, CCF y FSE como factura origen (no solo CCF como decía el plan).
- Cliente tiene `tipoDocumento` multi-tipo (`DUI | NIT | PASAPORTE | CARNET_RESIDENTE | OTRO`) — el backend valida según el tipoDTE de la factura origen.
- Cron job `sincronizarEstadosDTEs` corre cada 5 min y actualiza estados PROCESANDO → APROBADO/RECHAZADO automáticamente.
- DTE payloads ya no incluyen `generatedAt`; NRC/NIT se envían sin caracteres no numéricos.
- Mensajería: usar **"Ministerio de Hacienda"** (no "SAT"), consistente con commit `64acf46`.

## 4. Arquitectura frontend

### 4.1 Tipos (en `types/api.ts`)

```ts
export type TipoNotaCredito = 'TOTAL' | 'PARCIAL';

export type NotaCredito = {
  id: string;
  numero: string;
  facturaId: string;
  factura: { id: string; numeroFactura: string; total: string; cliente: Cliente };
  motivo: string;
  tipo: TipoNotaCredito;
  subtotal: string;
  montoIva: string;
  total: string;
  estadoDTE: EstadoDTE;
  dteId: string | null;
  dteControlNumber: string | null;
  dteRespuestaMH: unknown;
  createdAt: string;
  updatedAt: string;
};

export type NotaCreditoListItem = Pick<
  NotaCredito,
  'id' | 'numero' | 'tipo' | 'motivo' | 'total' | 'estadoDTE' | 'createdAt'
> & { factura: { id: string; numeroFactura: string } };

export type FiltrosNotasCredito = {
  page?: number; limit?: number;
  facturaId?: string; estadoDTE?: EstadoDTE;
};

export type CrearNotaCreditoDto = {
  facturaId: string;
  motivo: string;
  tipo: TipoNotaCredito;
  subtotal?: string; montoIva?: string; total?: string;
};

export type ComprobanteRetencion = {
  id: string;
  numeroCR: string;
  facturaId: string;
  factura: { id: string; numeroFactura: string; total: string; estado: EstadoFactura };
  clienteId: string;
  cliente: Cliente;
  porcentaje: string;
  monto: string;
  fecha: string;
  notas: string | null;
  createdAt: string;
};

export type ComprobanteRetencionListItem = Pick<
  ComprobanteRetencion,
  'id' | 'numeroCR' | 'porcentaje' | 'monto' | 'fecha' | 'createdAt'
> & {
  factura: { id: string; numeroFactura: string };
  cliente: { id: string; nombre: string | null; razonSocial: string | null };
};

export type FiltrosRetenciones = {
  page?: number; limit?: number;
  facturaId?: string; clienteId?: string;
};

export type RegistrarRetencionDto = {
  facturaId: string;
  numeroCR: string;
  porcentaje: 1 | 13;
  monto: string;
  fecha: string;            // ISO datetime
  notas?: string;
};
```

### 4.2 Hooks (`hooks/`)

Patrón idéntico a `use-facturas.ts`. Helper `extractErrorMessage` duplicado intencionalmente (no abstraer prematuro).

**`hooks/use-notas-credito.ts`**
- `useNotasCredito(filtros)` — query lista.
- `useNotaCredito(id)` — query detalle.
- `useCrearNotaCredito()` — POST; invalida `['notas-credito']`, `['factura', facturaId]`, `['facturas']`.
- `useEmitirDTENotaCredito()` — PATCH `/:id/dte` con `{ tipoDTE: 'NC' }`; invalida detalle y lista.
- `useAnularDTENotaCredito()` — DELETE `/:id/dte`; invalida detalle y lista.
- `sincronizarNotaCredito(qc, id)` — utility que solo invalida `['nota-credito', id]` y emite `toast.success('Estado actualizado.')`. No hay endpoint backend.
- `descargarNotaCreditoPdfBranded(id, numero)` — GET `/:id/pdf` blob.
- `descargarNotaCreditoPdfOficialDTE(id, numero)` — GET `/:id/dte/pdf` blob.

**`hooks/use-retenciones.ts`**
- `useRetenciones(filtros)`, `useRetencion(id)`.
- `useRegistrarRetencion()` — POST; invalida `['retenciones']`, `['factura', facturaId]`, `['facturas']`.
- `useEliminarRetencion()` — DELETE; invalida `['retenciones']`, `['factura', facturaId]`, `['facturas']`.
- `descargarRetencionPdf(id, numeroCR)` — GET `/:id/pdf` blob.

### 4.3 Componentes nuevos (`components/`)

**`components/notas-credito/`**
- `FacturaTypeahead.tsx` — buscador cliente-side reutilizable. Recibe `facturas: FacturaListItem[]`, predicado opcional y callback `onSelect`. Sirve también para retenciones.
- `NotaCreditoForm.tsx` — formulario completo: selector factura → segmented Tipo → campos PARCIAL (subtotal/IVA/total con auto-cálculo y override manual) o vista TOTAL read-only → motivo con contador → preview → ConfirmRow.
- `MontosCard.tsx` — tabla subtotal/IVA/total reutilizable (preview en formulario, montos acreditados en detalle).
- `FacturaOrigenCard.tsx` — card con número, cliente, total y link al detalle de factura.

**`components/retenciones/`**
- `RetencionForm.tsx` — selector factura → numeroCR → TipoRetencionPicker → monto editable con pre-carga `total × %` → fecha → notas.
- `TipoRetencionPicker.tsx` — radio cards 1% / 13%.

### 4.4 Reutilizables existentes

- `<DteSection kind="nota">` (ya preparado en `components/dte/`).
- `<PageHeader>`, `<FilterBar>`, `<FormSection>`, `<ConfirmRow>`, `<EmptyState>`, `<Spinner>`, `<Pagination>`, `<EstadoDteBadge>`, `<TipoDteBadge>`, `<Badge>`.
- `formatCurrency`, `formatDate` (`lib/utils.ts`); `decimal.js` para aritmética.
- `useAuth()` para roles.

### 4.5 Sin cambios al backend

Todo el alcance se cubre con endpoints existentes.

## 5. Validaciones y reglas

### 5.1 Política de mensajes

- Errores de **validación de formulario** → inline con `setError(path, { message })`. **Sin toast**.
- Errores de **mutation** del backend → `toast.error(extractErrorMessage(err, fallback))` en `onError`.
- Success → `toast.success(mensaje corto en español)` en `onSuccess`.
- Descarga PDF → `toast.loading('Generando PDF…')` → dismiss en finally; `toast.error` si falla.
- Errores 401 → silenciados por el interceptor de `lib/api.ts`.

### 5.2 NC — crear

| Regla | Origen | Mensaje |
|---|---|---|
| Motivo ≥ 10, ≤ 500 chars | Zod | Contador en vivo |
| Tipo PARCIAL → subtotal, montoIva, total requeridos | Zod | Inline por campo |
| Tipo PARCIAL → total ≤ factura.total | Zod client | "El total excede el total de la factura ($X.XX)." |
| Tipo TOTAL → backend toma valores de la factura | Service | Mostramos tabla read-only con valores reales |
| Factura PAGADA o PARCIAL | Backend 422 ESTADO_INVALIDO | Mensaje del backend |
| Suma de NCs activas ≤ total factura | Backend 422 | Mensaje del backend |

### 5.3 NC — emitir DTE

Reusa `<DteSection kind="nota">`. Backend rechaza si cliente no tiene los campos necesarios según `tipoDTE` original. El componente ya muestra los motivos de bloqueo via `motivoBloqueo()`. Re-emisión desde RECHAZADO soportada.

### 5.4 NC — anular DTE (página dedicada, solo ADMIN)

- Motivo ≥ 10 chars (validado client-side).
- ConfirmRow en danger.
- Mensaje: "Esta acción es irreversible. Se enviará la anulación al **Ministerio de Hacienda**."
- Toast success: "DTE anulado." Toast error: mensaje del backend.

### 5.5 Retenciones — crear

| Regla | Origen | Mensaje |
|---|---|---|
| Factura no ANULADA | Filtro typeahead + backend | Hint: "Solo facturas activas." |
| `numeroCR` único por cliente | Backend P2002 | "Ya existe un comprobante con ese número para este cliente." |
| Porcentaje ∈ {1, 13} | Radio cards | n/a |
| Monto ≤ saldoPendiente | Client + backend 422 | "El monto retenido excede el saldo pendiente ($X.XX)." |
| Monto pre-cargado = total × % | Calculado client | Hint: "Calculado: total × 1% = $X.XX. Editable." |
| Fecha requerida | Zod | Inline |
| Notas ≤ 500 | Zod | Contador |

### 5.6 Retenciones — eliminar (solo ADMIN)

ConfirmRow inline en lista y en detalle. Backend restaura saldo y recalcula estado; invalidaciones cruzadas garantizan UI consistente.

### 5.7 Roles

- **VISUALIZADOR**: solo lectura. No ve botones de escritura.
- **OPERADOR / GERENTE**: crear NC, registrar retención, emitir DTE.
- **ADMIN**: además anular DTE y eliminar retenciones.
- **LOGISTICA**: lectura + descarga PDFs.

```ts
const puedeEscribir = ['ADMIN','GERENTE','OPERADOR'].includes(user?.rol ?? '');
const esAdmin = user?.rol === 'ADMIN';
```

## 6. Flujos de datos

### 6.1 Query keys

```
['notas-credito', filtros]
['nota-credito', id]
['retenciones', filtros]
['retencion', id]
```

### 6.2 Invalidaciones cruzadas (críticas)

Cualquier mutation que toca saldo de factura debe invalidar `['facturas']` y `['factura', facturaId]`.

| Mutation | Invalidaciones |
|---|---|
| Crear NC | `['notas-credito']`, `['factura', facturaId]`, `['facturas']` |
| Emitir DTE NC | `['nota-credito', id]`, `['notas-credito']` |
| Anular DTE NC | `['nota-credito', id]`, `['notas-credito']` |
| Registrar retención | `['retenciones']`, `['factura', facturaId]`, `['facturas']` |
| Eliminar retención | `['retenciones']`, `['factura', facturaId]`, `['facturas']` |

### 6.3 Typeahead client-side

Carga única al montar el formulario:

```ts
// NC: factura PAGADA o PARCIAL con DTE APROBADO
useFacturas({ estado: 'PAGADA', estadoDTE: 'APROBADO', limit: 50 })
// (si el backend no acepta lista, traemos PAGADA y PARCIAL en queries separadas o filtramos sobre limit 100)

// Retención: factura no ANULADA
useFacturas({ limit: 100 })   // filtramos client-side
```

Si `meta.total > limit`, mostramos hint: "Mostrando primeras N. Refiná la búsqueda."

### 6.4 Sincronizar DTE NC (sin endpoint)

```ts
function sincronizar() {
  qc.invalidateQueries({ queryKey: ['nota-credito', id] });
  toast.success('Estado actualizado.');
}
```

Hint en UI: "El estado se sincroniza automáticamente cada 5 minutos."

### 6.5 Descarga PDFs

Dos PDFs por NC (branded + DTE oficial), uno por retención. Pattern de `toast.loading` → dismiss → error.

## 7. Casos borde

1. **NC contra factura cuyo cliente perdió DUI/NIT después**: backend bloquea al emitir DTE; mostramos error en `<DteSection>` con guía para editar el cliente.
2. **Última NC que completa el total**: factura pasa a ANULADA; invalidaciones reflejan el badge.
3. **Eliminar retención que dejó factura PAGADA**: backend re-evalúa estado; UI consistente por invalidación.
4. **Re-emisión desde RECHAZADO**: soportada por backend; `<DteSection>` ya tiene `onReemitir`.
5. **`numeroCR` duplicado del mismo cliente**: backend devuelve P2002; mostramos inline en campo.
6. **Cron 5 min vs acción del usuario**: PROCESANDO se mantiene visible hasta sincronizar; hint lo explica.

## 8. Estilos y convenciones

- Idioma: **100% español** en toda la UI y comentarios.
- Tailwind v4 only — sin CSS vanilla en `globals.css`, sin valores arbitrarios. Tokens nuevos van en `@layer utilities`.
- `font-mono` para `NC-2026-001`, `CR-...`, `FAC-...`, `dteControlNumber`, IDs, fechas formato `dd MMM. yyyy` via `formatDate`.
- Montos: `decimal.js` para aritmética, `formatCurrency` para mostrar.
- Comentarios "why" en español **solo** donde la decisión no es obvia:
  - Por qué typeahead client-side.
  - Por qué "Sincronizar" es solo invalidate.
  - Por qué `extractErrorMessage` se duplica.
  - Por qué invalidamos `['facturas']` desde NC/retenciones.
  - Por qué la página de anular DTE es dedicada.

## 9. Entregables

- 7 páginas en `app/(dashboard)/notas-credito/` y `app/(dashboard)/retenciones/`.
- 2 hooks: `hooks/use-notas-credito.ts`, `hooks/use-retenciones.ts`.
- ~6 componentes nuevos en `components/notas-credito/` y `components/retenciones/`.
- Tipos agregados a `types/api.ts`.
- 2 botones nuevos en `app/(dashboard)/facturas/[id]/page.tsx` (o el componente cliente correspondiente).
- Este spec, commiteado.

## 10. Verificación

Repo sin suite de tests. Verificación = `pnpm tsc --noEmit` + `pnpm lint` + smoke manual en `localhost:3001`:

- [ ] Listado y filtros de NC + retenciones cargan y paginan.
- [ ] Crear NC TOTAL desde detalle de factura → vuelve al detalle con saldo y estado actualizado.
- [ ] Crear NC PARCIAL con auto-cálculo y con override manual.
- [ ] Emitir DTE NC con factura origen CCF y cliente válido.
- [ ] Reintento de DTE desde RECHAZADO.
- [ ] Anular DTE NC desde página dedicada (rol ADMIN).
- [ ] Descargar PDF branded y PDF oficial DTE.
- [ ] Registrar retención con pre-carga `total × %` y con monto editado.
- [ ] Conflicto P2002 al duplicar `numeroCR` → error inline.
- [ ] Eliminar retención restaura saldo.
- [ ] VISUALIZADOR no ve botones de escritura.
- [ ] Dark mode y vista tablet (768px) sin regresiones.
- [ ] `pnpm tsc --noEmit` y `pnpm lint` limpios.

## 11. Plan de commits

1. `docs(specs): rama 14 — notas de crédito y retenciones` (este archivo)
2. `feat(notas-credito): listado, crear, detalle, DTE y anulación`
3. `feat(retenciones): listado, registrar, detalle, eliminar + entradas desde factura`
