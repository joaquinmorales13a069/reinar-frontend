# RAMA 11 — `feat/facturas`: spec de diseño

**Fecha:** 2026-05-25
**Rama:** `feat/facturas`
**Plan de trabajo:** RAMA 11 del `docs/plan-trabajo-frontend.md`
**Backend:** `/Users/joaquinmorales13a06/Desktop/Reinar/server` (módulos `facturas`, `facturallama`, `pdf`, `pagos`)
**Referencia visual:** `Frontend-REINAR-design/facturas.jsx`, `dte-section.jsx`, `facturas-anular-dte.jsx`

---

## 1. Objetivo

Visualización y gestión de facturas generadas automáticamente desde cotizaciones aprobadas. Incluye:

- Lista filtrable de facturas
- Detalle con cliente/fechas, items facturados, sección DTE, pagos contextuales, actas vinculadas (read-only) y progreso de cobro
- Flujo de emisión y sincronización de DTE contra Ministerio de Hacienda (FacturaLlama)
- Flujo dedicado de anulación de factura/DTE (solo ADMIN)
- Gestión contextual de pagos (listar, registrar, eliminar) — la vista global de pagos queda para RAMA 13

## 2. Alcance

### Dentro de RAMA 11
- Páginas: lista, detalle, anulación DTE
- Componente compartido `DteSection` (reutilizable por RAMA Notas de Crédito futura)
- Hooks `use-facturas.ts` y `use-pagos.ts` (este último reusable por RAMA 13)
- Descarga de PDF branded (en lista y detalle) y PDF oficial DTE (solo desde `DteSection` cuando estadoDTE = APROBADO)
- Ajuste manual de estado de factura (ADMIN/GERENTE)
- Validación preventiva del cliente antes de emitir DTE
- Tipos y schemas Zod del módulo

### Fuera de alcance (otras ramas)
- Vista global `/pagos` y página `/pagos/nuevo` con buscador de facturas → **RAMA 13**
- Detalle/creación de actas → **RAMA 12** (en RAMA 11 las actas vinculadas son read-only con link)
- Notas de crédito y retenciones → **RAMA 14**
- Realtime de DTE (Socket.IO) — el backend no emite eventos por ahora; se usa polling manual

## 3. Decisiones de diseño confirmadas

1. **"Ver XML"** del DTE aprobado: **omitido del MVP**. El backend no expone XML.
2. **`DteSection`** vive en `components/dte/DteSection.tsx` con prop `kind: 'factura' | 'nota'` desde el inicio para evitar refactor cuando entre la rama de Notas de Crédito.
3. **Validación DTE**: preventiva en UI (deshabilitar opciones de tipo si el cliente no cumple) + error inline del backend si pese a eso se intenta emitir.
4. **Pagos**: contextuales dentro del detalle de factura (listar + registrar + eliminar inline). Vista global queda para RAMA 13. Se crea `hooks/use-pagos.ts` reusable.
5. **PDFs**: branded en lista y detalle; oficial DTE solo dentro de `DteSection` cuando `estadoDTE === 'APROBADO'`.
6. **Ajustar estado manual**: select filtrado a `[PENDIENTE, PARCIAL, VENCIDA, ANULADA]` (PAGADA se asigna automáticamente vía pagos en backend).
7. **Realtime DTE**: polling manual con botón "Sincronizar". Sin Socket.IO.
8. **Anulación**: anular factura completa vía `PATCH /:id/estado` con `ANULADA` + motivo. El backend, internamente, anula el DTE en FacturaLlama si estaba APROBADO. La acción "Anular solo DTE" (`DELETE /:id/dte`) queda definida en el hook pero no expuesta en UI.

## 4. Hallazgos del backend que difieren del plan original

| Plan original | Realidad backend |
|---|---|
| `PATCH /:id/dte` recibe `{ emitir: true }` | Recibe `{ tipoDTE: 'FC' \| 'CCF' \| 'SUJETO_EXCLUIDO' }` |
| `estadoDTE = EMITIDO` | `estadoDTE = APROBADO` (junto con `PENDIENTE \| PROCESANDO \| RECHAZADO \| ANULADO`) |
| Estados de factura: `PENDIENTE \| PARCIAL \| PAGADA \| VENCIDA \| ANULADA` | Igual, pero **`cambiarEstado` no acepta PAGADA** (se calcula desde pagos) |
| Pagos como módulo aparte | Pagos son sub-recurso anidado: `/facturas/:facturaId/pagos` |
| Actas como módulo aparte | Actas también son sub-recurso anidado bajo factura |

Validaciones del backend al emitir DTE:
- **CCF**: cliente debe tener `ncr` y `actividadEconomica`
- **SUJETO_EXCLUIDO**: cliente debe tener `dui` o `nit`, `actividadEconomica`, `departamento`, `municipio`, `complemento`
- **FC**: sin requisitos (se puede emitir a consumidor final)

## 5. Endpoints consumidos

```
GET    /api/v1/facturas                          ?page&limit&clienteId&estado&estadoDTE&fechaDesde&fechaHasta
GET    /api/v1/facturas/:id                      → incluye cotizacion+items, cliente, contactoFacturacion, pagos, actasEntrega
PATCH  /api/v1/facturas/:id                      { notas?, fechaVencimiento? }                                (OPERADOR+)
PATCH  /api/v1/facturas/:id/estado               { estado, motivo? }                                          (ADMIN/GERENTE)
PATCH  /api/v1/facturas/:id/dte                  { tipoDTE }                                                  (OPERADOR+)
POST   /api/v1/facturas/:id/dte/sincronizar      →                                                            (ADMIN)
GET    /api/v1/facturas/:id/dte/pdf              → blob                                                        (todos)
GET    /api/v1/facturas/:id/pdf                  → blob                                                        (no VISUALIZADOR)
DELETE /api/v1/facturas/:id/dte                  →                                                            (ADMIN) — hook definido, no expuesto en UI

POST   /api/v1/facturas/:facturaId/pagos         { monto, fecha, metodoPago, referencia?, notas? }            (OPERADOR+)
GET    /api/v1/facturas/:facturaId/pagos         →                                                            (todos)
DELETE /api/v1/facturas/:facturaId/pagos/:pagoId →                                                            (ADMIN)
```

## 6. Arquitectura

### 6.1 Rutas

```
app/(dashboard)/facturas/
  ├── page.tsx                      # Lista con filtros
  ├── [id]/
  │   ├── page.tsx                  # Detalle (Server Component que pasa id a Client)
  │   └── anular-dte/
  │       └── page.tsx              # Flujo de anulación DTE (solo ADMIN)
```

No hay ruta `nueva/` — facturas se generan al aprobar cotización (cubierto en RAMA 10).

### 6.2 Componentes nuevos

```
components/
  facturas/
    ├── FacturasTabla.tsx
    ├── FacturasFilters.tsx
    └── detalle/
        ├── HeaderAcciones.tsx
        ├── ClienteFechasCard.tsx
        ├── ItemsFacturadosCard.tsx
        ├── PagosCard.tsx
        ├── RegistrarPagoForm.tsx
        ├── ActasVinculadasCard.tsx
        ├── ProgresoCobroCard.tsx
        └── AjustarEstadoCard.tsx
  dte/
    └── DteSection.tsx              # Compartido kind: 'factura' | 'nota'
```

### 6.3 Hooks

```
hooks/
  ├── use-facturas.ts               # Lista, get, mutations, descarga PDFs
  └── use-pagos.ts                  # listar/crear/eliminar — reusable por RAMA 13
```

### 6.4 Schemas y tipos

```
lib/schemas/factura.ts
  ├── ajustarEstadoSchema           // { estado: enum sin PAGADA, motivo: min(10) }
  ├── anularFacturaSchema           // { motivo: min(10) }
  ├── registrarPagoSchema           // { monto, fecha, metodoPago, referencia?, notas? }
  └── emitirDTESchema               // { tipoDTE: 'FC' | 'CCF' | 'SUJETO_EXCLUIDO' }

types/api.ts (extensión)
  EstadoFactura = 'PENDIENTE' | 'PARCIAL' | 'PAGADA' | 'VENCIDA' | 'ANULADA'
  EstadoDTE     = 'PENDIENTE' | 'PROCESANDO' | 'APROBADO' | 'RECHAZADO' | 'ANULADO'
  TipoDTE       = 'FC' | 'CCF' | 'SUJETO_EXCLUIDO'
  MetodoPago    = 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE' | 'TARJETA' | 'OTRO' | 'ANTICIPO'
  DteRespuestaMH = { codigo?: string; descripcionMsg?: string; observaciones?: string[] }
  Factura, Pago
```

## 7. Página de lista

**Layout:** `<PageHeader>` + `<FilterBar>` + tabla.

**Filtros:**
- Búsqueda por número de factura o nombre de cliente (debounce 300 ms; query string `busqueda` si el backend lo soporta, sino filtro client-side de la página actual — verificar al implementar)
- Chips de estado: Pendientes, Parciales, Pagadas, Vencidas, Anuladas
- Dropdown de filtro DTE: Sin emitir / Procesando / Aprobado / Rechazado (no chips para no saturar)
- Botón "Limpiar" resetea ambos

**Columnas:**

| Col | Contenido | Ancho |
|---|---|---|
| Número | mono, `FAC-2026-001` | 150 |
| Cliente | nombre | flex |
| Cotización | mono link → `/cotizaciones/[id]` | 150 |
| Estado pago | `<Badge status={estado} />` | 110 |
| Estado DTE | badge `tipoDTE` + `<Badge status={estadoDTE} />` | 160 |
| Total | `$1,234.56` mono right | 120 |
| Saldo | mono right; rojo si > 0, gris si = 0 | 120 |
| Emisión | `17 may. 2026` mono | 110 |
| Acciones | botón "PDF" inline (descarga branded) | 60 |

- Click en fila → `/facturas/[id]`
- Click en PDF → descarga branded con loading propio por fila (mismo patrón que cotizaciones)
- `<Pagination />` al pie
- `<EmptyState />` si no hay resultados
- VISUALIZADOR puede ver y descargar PDFs

## 8. Página de detalle

**Layout:** `grid-2` (columna principal + lateral con `ProgresoCobroCard`).

### 8.1 Header (`PageHeader`)
- Título: número de factura (mono)
- Subtítulo: cliente · `<Badge status={estado} />`
- Back a `/facturas`
- Acciones contextuales:
  - "Ajustar estado" (ADMIN/GERENTE, no si ANULADA) — toggle de `AjustarEstadoCard`
  - "Anular factura" danger (no si ANULADA) — `ConfirmRow` inline con textarea de motivo; al confirmar → `cambiarEstado` con `{ estado: 'ANULADA', motivo }`

### 8.2 Cards en la columna principal (orden)

1. **AjustarEstadoCard** (visible solo con toggle)
   - Select `nuevoEstado` filtrado a `[PENDIENTE, PARCIAL, VENCIDA, ANULADA]` excluyendo el actual
   - Hint debajo: *"PAGADA se asigna automáticamente al registrar pagos que cubran el total"*
   - Textarea motivo (requerido, min 10 chars)
   - `ConfirmRow` con "Confirmar ajuste" → mutation

2. **ClienteFechasCard**
   - Cliente (link a `/clientes/[id]`), NIT/DUI/NCR si existen, emisión, vencimiento, link a cotización origen

3. **DteSection** (ver Sección 9)

4. **ItemsFacturadosCard**
   - Tabla read-only de `factura.cotizacion.items`
   - Columnas: Descripción, Período (badge), Cantidad, Tarifa, Subtotal
   - Footer: Subtotal, IVA (%), Total

5. **PagosCard** (ver Sección 10)

6. **ActasVinculadasCard** (read-only en RAMA 11)
   - Tabla con número, # ítems, dirección, badge estado
   - Click → `/actas/[id]` (stub hasta RAMA 12)
   - `<EmptyState />` si vacío

### 8.3 Columna lateral

7. **ProgresoCobroCard**
   - `montoPagado` grande + "de Total"
   - Barra de progreso (verde si 100 %, info si parcial)
   - "% cobrado" y "Saldo" (rojo si > 0, verde si 0)
   - `progreso = total > 0 ? min(100, round(montoPagado/total * 100)) : 0`

### 8.4 Estados y permisos
- Skeleton durante `isLoading`
- `notFound()` en 404
- VISUALIZADOR no ve: Ajustar estado, Anular factura, registrar/eliminar pagos, anular DTE

## 9. Componente `DteSection`

**Ubicación:** `components/dte/DteSection.tsx`

**Props:**
```ts
type DteSectionProps = {
  doc: Factura | NotaCredito;
  kind: 'factura' | 'nota';
  cliente?: Cliente;                          // necesario para validación preventiva
  onAsignarTipo?: (tipo: TipoDTE) => void;
  onEmitir?: () => void;
  onSincronizar?: () => void;
  onReemitir?: () => void;
  onAnular?: () => void;
  onDescargarPdf?: () => void;
  emitirError?: string | null;                // error 400 del backend mostrado inline
  isEmitiendo?: boolean;
  isSincronizando?: boolean;
  isDescargandoPdf?: boolean;
}
```

El componente **no llama hooks de mutación** — recibe callbacks. Esto lo hace 100% reusable por la rama de Notas de Crédito.

### 9.1 Estados de render

#### A) Sin tipo asignado (solo `kind === 'factura'` y `tipoDTE == null`)
- Card con borde gris izquierdo
- Texto explicativo
- Grid de 3 tarjetas: FC, CCF, SUJETO_EXCLUIDO
- **Validación preventiva por tipo:**
  - CCF deshabilitada si falta `ncr` o `actividadEconomica` → tooltip *"Requiere NCR y actividad económica en el cliente"*
  - SUJETO_EXCLUIDO deshabilitada si falta DUI/NIT, actividad o dirección completa → tooltip explicativo
  - FC siempre habilitada
- Tarjeta habilitada → click → `ConfirmRow` con "Asignar tipo" → `onAsignarTipo(tipo)`
- Tarjeta deshabilitada → tooltip + botón "Editar cliente" linkea a `/clientes/[id]`

#### B) Header (cuando hay tipo o `kind === 'nota'`)
- Badge tipo (FC info, CCF neutral, SUJETO_EXCLUIDO neutral, NC accent)
- `<Badge status={estadoDTE} />`
- N° de control (mono, sunken bg) o "—"

#### C) `PENDIENTE`
- Alert warn explicativo
- Botón "Emitir DTE" → `ConfirmRow` → `onEmitir()`
- Si `emitirError` está presente → alert danger inline con el mensaje del backend

#### D) `PROCESANDO`
- Alert info con spinner
- Botón "Sincronizar estado" → `onSincronizar()`
- Texto: *"Esto puede tardar entre 1 y 10 minutos."*

#### E) `APROBADO`
- Alert ok
- Bloque con N° de control destacado
- Botones:
  - "Descargar PDF oficial" → `onDescargarPdf()`
  - "Anular DTE" (outline-danger, solo ADMIN) → `onAnular()` (navega a `/facturas/[id]/anular-dte`)
- **Sin "Ver XML"**

#### F) `RECHAZADO`
- Alert danger
- Bloque con `dteRespuestaMH.codigo`, `descripcionMsg` y `observaciones[]`
- Botón "Corregir y re-emitir" → `onReemitir()` (vuelve a llamar `emitirDTE` con el mismo `tipoDTE`)

#### G) `ANULADO`
- Alert neutral, sin más acciones

## 10. `PagosCard`

**Ubicación:** `components/facturas/detalle/PagosCard.tsx`

**Datos:** `useListarPagos(facturaId)` de `hooks/use-pagos.ts`.

### 10.1 Layout
- Header: *"Pagos registrados (N)"* + botón "Registrar pago" (toggle; oculto si `estado === 'ANULADA'` o VISUALIZADOR)
- Si vacío y sin form abierto → `<EmptyState icon="dollar" title="Sin pagos" />`
- Si hay pagos → tabla con columnas: ID, Fecha, Método (badge), Referencia, Monto, Acciones (trash solo ADMIN/GERENTE)

### 10.2 Registrar pago (form inline, no modal)

`RegistrarPagoForm` se renderiza arriba de la tabla cuando se activa el toggle.

- Campos (RHF + Zod):
  - `monto` (regex `/^\d+(\.\d{1,2})?$/`, > 0, default `saldoPendiente.toFixed(2)`)
  - `fecha` (date input, default hoy en TZ El Salvador)
  - `metodoPago` (select: EFECTIVO, TRANSFERENCIA, CHEQUE, TARJETA, OTRO — ANTICIPO excluido porque es server-side)
  - `referencia` (text, opcional, placeholder según método)
  - `notas` (textarea, opcional, max 200 chars)
- Warning client-side si `monto > saldoPendiente`: *"El monto supera el saldo pendiente. Se registrará igual y la factura quedará en sobrepago."*
- `ConfirmRow` "Registrar pago" → mutation
- `onSuccess`: `toast.success('Pago registrado')`, cierra form, invalida `['pagos', facturaId]` y `['factura', id]`
- `onError`: errores 422 inline

### 10.3 Eliminar pago
- Click trash → `ConfirmRow` inline expandido como nueva fila debajo
- Confirmar → `useEliminarPago` con mismas invalidaciones
- `toast.success('Pago eliminado')` / `toast.error(...)` si falla

### 10.4 Coordinación con `ProgresoCobroCard`
Ambos consumen `factura` desde `['factura', id]`. Al invalidar, ambos se refrescan.

## 11. Página de anulación DTE

**Ruta:** `app/(dashboard)/facturas/[id]/anular-dte/page.tsx`

**Acceso:** solo ADMIN. Guard client-side (el middleware no puede leer el rol porque el accessToken vive en memoria). Si no es ADMIN → `<EmptyState>` con botón "Volver al detalle".

**Precondición:** `estadoDTE === 'APROBADO'`. Si no → redirect a `/facturas/[id]` con `toast.info`.

### 11.1 Cards en orden
1. **Alert danger** arriba: *"Esta acción es irreversible…"*
2. **Card "Datos de la factura"** (read-only): N° factura, cliente, total, tipo DTE, N° control DTE, estado actual
3. **Card "Motivo de anulación"**: textarea con contador `{N} / 10 mín.` y error inline si `> 0 && < 10`
4. **ConfirmRow** (aparece tras click en "Confirmar anulación" si motivo válido)

### 11.2 Footer
- Cancelar (ghost) → back
- Confirmar anulación (danger, disabled si motivo inválido) → abre ConfirmRow

### 11.3 Mutation
- `cambiarEstado({ estado: 'ANULADA', motivo })` — el backend, si `estadoDTE` era APROBADO, anula el DTE en FacturaLlama y deja `estadoDTE = ANULADO`.

## 12. Hooks detallados

### 12.1 `hooks/use-facturas.ts`
```ts
useFacturas(filtros)                    // GET /facturas, paginado
useFactura(id)                          // GET /facturas/:id
useActualizarFactura(id)                // PATCH /facturas/:id — definido, sin UI dedicada en RAMA 11
useCambiarEstadoFactura(id)             // PATCH /facturas/:id/estado
useEmitirDTE(id)                        // PATCH /facturas/:id/dte
useSincronizarDTE(id)                   // POST /facturas/:id/dte/sincronizar
useAnularDTESoloDTE(id)                 // DELETE /facturas/:id/dte — definido, no expuesto en UI
useDescargarPdfBranded()                // GET /facturas/:id/pdf
useDescargarPdfOficialDTE()             // GET /facturas/:id/dte/pdf
```

Query keys: `['facturas', filtros]`, `['factura', id]`.
Invalidación: tras mutation de estado/DTE/pagos → invalida `['factura', id]` y la lista.
`setQueryData` se usa cuando el backend devuelve la entidad completa (emitir, sincronizar, cambiarEstado).

### 12.2 `hooks/use-pagos.ts` (reusable por RAMA 13)
```ts
useListarPagos(facturaId)               // GET /facturas/:facturaId/pagos
useCrearPago(facturaId)                 // POST /facturas/:facturaId/pagos
useEliminarPago(facturaId)              // DELETE /facturas/:facturaId/pagos/:pagoId
```

## 13. Manejo de errores

| Caso | Tratamiento |
|---|---|
| 401 | Interceptor de Axios renueva token silenciosamente (ya implementado) |
| 403 | `toast.error('No tenés permisos para esta acción')` |
| 404 en `useFactura` | `notFound()` de Next |
| 422 (estado inválido, factura anulada) | Inline en el componente que disparó la acción |
| 400 validación DTE (cliente sin NCR, dirección…) | Alert danger inline en `DteSection` con `error.response.data.error.message` |
| Errores de red genéricos | `toast.error('No se pudo conectar con el servidor')` |

## 14. Permisos por rol

| Acción | Roles |
|---|---|
| Ver lista/detalle, descargar PDFs | Todos |
| Registrar pago, asignar tipo DTE, emitir | OPERADOR+ |
| Ajustar estado manual, anular factura, eliminar pago | ADMIN/GERENTE |
| Anular DTE, sincronizar DTE | Solo ADMIN |

VISUALIZADOR: todo lo de escritura se **oculta** (no se renderiza), no se deshabilita.

## 15. Toasts

| Acción | Tipo | Mensaje |
|---|---|---|
| Registrar pago OK | success | "Pago registrado" |
| Eliminar pago OK | success | "Pago eliminado" |
| Cambiar estado OK | success | "Estado actualizado" |
| Anular factura OK | success | "Factura anulada" |
| Emitir DTE OK | success | "DTE enviado al Ministerio de Hacienda" |
| Sincronizar DTE OK | info | "Estado del DTE actualizado" (sin toast si no cambió) |
| Anular DTE OK | success | "DTE anulado" |
| Descargar PDF falla | error | "No se pudo descargar el PDF" |
| 403 | error | "No tenés permisos para esta acción" |
| Red genérica | error | "No se pudo conectar con el servidor" |

Sin toast para errores 400/422 (van inline) ni 401 (silencioso).

## 16. Convenciones (recordatorio de la rama)

- 100 % español en UI
- Comentarios tipo "why" en español en decisiones no obvias
- Tailwind exclusivamente con clases predefinidas (sin valores arbitrarios, sin CSS vanilla)
- Errores de formulario inline con `setError`, no toast
- Montos con `decimal.js` para operar, `formatCurrency()` para mostrar
- Fechas con `formatDate()` (TZ El Salvador)
- Números de documento (`FAC-2026-001`, `COT-2026-001`) en `font-mono`
- VISUALIZADOR: ocultar botones de escritura

## 17. Checklist antes de PR

- [ ] Lista carga facturas reales del backend con paginación
- [ ] Filtros (búsqueda, estado, estadoDTE) funcionan
- [ ] Descarga inline de PDF branded desde la tabla
- [ ] Detalle muestra cliente, items, sección DTE, pagos, actas vinculadas y progreso de cobro
- [ ] `DteSection` renderiza correctamente los 7 estados (sin tipo, PENDIENTE, PROCESANDO, APROBADO, RECHAZADO, ANULADO)
- [ ] Validación preventiva en UI deshabilita tipos DTE inválidos para el cliente
- [ ] Emitir DTE devuelve estado actualizado y refresca la sección
- [ ] Sincronizar DTE actualiza estado en vivo
- [ ] Descarga PDF oficial DTE funciona cuando APROBADO
- [ ] Registrar pago refresca la tabla y el progreso de cobro
- [ ] Eliminar pago recalcula saldo y estado
- [ ] Ajustar estado manual funciona y aparece en auditoría (verificar en backend)
- [ ] Anular factura completa con motivo (`PATCH /:id/estado` con ANULADA)
- [ ] Anular DTE desde la página dedicada (sólo ADMIN, motivo mín. 10 chars)
- [ ] VISUALIZADOR no ve botones de escritura
- [ ] OPERADOR no ve Ajustar estado ni Anular DTE
- [ ] `pnpm tsc --noEmit` y `pnpm lint` limpios
- [ ] Dark mode no rompe la UI
- [ ] Sin clases CSS vanilla; sin valores arbitrarios de Tailwind
- [ ] Comentarios "why" en español
