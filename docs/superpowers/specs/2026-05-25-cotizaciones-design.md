# Rama 10 — `feat/cotizaciones`

**Fecha:** 2026-05-25
**Branch:** `feat/cotizaciones`
**Alcance:** Módulo de Cotizaciones — la pieza más compleja del ERP. Conecta el catálogo de inventario, los clientes/contactos/proyectos y dispara la generación automática de facturas al aprobarse.

---

## 1. Objetivo

Implementar el módulo completo de cotizaciones del ERP:

1. Lista con dos vistas (tabular y pipeline tipo kanban).
2. Wizard de 4 pasos para crear borradores, con persistencia incremental.
3. Página de edición de borradores (reutiliza el wizard pre-cargado).
4. Página de detalle con totales, timeline, acciones según estado y descarga de PDF.
5. Cambios de estado: `BORRADOR → ENVIADA → APROBADA / RECHAZADA`.
6. WebSocket en vivo para reflejar disponibilidad de equipos mientras se eligen ítems.

Fuera de alcance:
- Endpoint backend para "duplicar cotización" (no existe — el botón se oculta).
- Estado `CANCELADA` (no existe en backend; el plan-trabajo está desactualizado).
- Selección manual de unidad de herramienta (backend asigna automáticamente).
- Cualquier vista de Factura (es rama 11).

---

## 2. Endpoints del backend (verificados en `server/src/modules/cotizaciones/`)

| Método | Ruta | Cuerpo / Query | Notas |
|---|---|---|---|
| GET | `/cotizaciones` | `page, limit, clienteId, proyectoId, estado, search` | Lista paginada con cliente, creadoPor, _count.items |
| POST | `/cotizaciones` | `clienteId` + opcionales (ver §3) | Crea borrador vacío. Devuelve cotización con totales en 0 |
| GET | `/cotizaciones/:id` | — | Detalle completo: cliente, items ordenados, factura asociada |
| PUT | `/cotizaciones/:id` | mismo payload que POST (partial) | Solo BORRADOR. 422 si otro estado |
| PATCH | `/cotizaciones/:id/estado` | `{ estado: 'ENVIADA'\|'APROBADA'\|'RECHAZADA' }` | Transiciones validadas; APROBADA genera factura |
| DELETE | `/cotizaciones/:id` | — | Solo BORRADOR. Libera reservas |
| POST | `/cotizaciones/:id/items` | Discriminated union por `tipo` (ver §4) | Backend crea reservas internamente |
| PATCH | `/cotizaciones/:id/items/:itemId` | parcial: `cantidad, periodo, tarifaCustom, descripcion, ...` | Solo BORRADOR. Renueva reservas |
| DELETE | `/cotizaciones/:id/items/:itemId` | — | Solo BORRADOR. Libera reservas |
| GET | `/cotizaciones/:id/pdf` | — | Devuelve blob PDF |

**Roles:** lectura = todos los roles. Escritura (POST/PUT/PATCH/DELETE) = `ADMIN, GERENTE, OPERADOR`. `LOGISTICA` y `VISUALIZADOR` solo leen.

**Estados válidos (`EstadoCotizacion`):** `BORRADOR, ENVIADA, APROBADA, RECHAZADA`.
**Transiciones:** `BORRADOR → ENVIADA`, `ENVIADA → APROBADA | RECHAZADA`. Cualquier otra devuelve 422.

**Validaciones de transición a ENVIADA:**
- Debe tener al menos 1 ítem (`COTIZACION_SIN_ITEMS`).
- Debe tener `tipoDocumentoFiscal` definido (`DATOS_FISCALES_INCOMPLETOS`).
- `CCF` y `SUJETO_EXCLUIDO` requieren `contactoFacturacionId`.

**Comportamiento al aprobar:**
- Verifica que equipos sigan DISPONIBLES y reservados. Si no → 409 `CONFLICTO_APROBACION` con array de equiposIds.
- Verifica stock de consumibles → 409 `CONSUMIBLE_SIN_STOCK`.
- Verifica stock de piezas de andamio agrupadas → 409 `ANDAMIO_SIN_STOCK`.
- Crea factura, marca equipos `RENTADO`, herramientas `RENTADA`, descuenta stock.
- Si hay `depositoMonto > 0`: crea pago tipo `ANTICIPO` y ajusta saldoPendiente.

---

## 3. Modelo `Cotizacion` (campos relevantes para frontend)

```ts
{
  id: string;
  numeroCotizacion: string;         // ej. "COT-2026-001"
  clienteId: string;
  proyectoId?: string;
  contactoSolicitanteId?: string;
  contactoFacturacionId?: string;
  estado: 'BORRADOR' | 'ENVIADA' | 'APROBADA' | 'RECHAZADA';
  condicionesPago?: 'CONTADO' | 'CREDITO' | 'OTRO';
  tipoDocumentoFiscal?: 'CF' | 'CCF' | 'SUJETO_EXCLUIDO';
  porcentajeIva: number;             // default 13
  depositoPorcentaje?: string;       // mutuamente excluyente con depositoMonto
  depositoMonto?: string;            // Decimal serializado
  subtotal: string;
  montoIva: string;
  total: string;
  notas?: string;
  notasInternas?: string;
  fechaCreacion: string;
  fechaEnvio?: string;
  fechaVencimiento: string;
  fechaAprobacion?: string;
  creadoPor: { id, nombre, apellido };
  cliente: { id, nombre, ... };
  proyecto?: { id, nombre };
  items: CotizacionItem[];
  factura?: { id, numeroFactura, estado };
}
```

### Ítems (`CotizacionItem`)

```ts
{
  id: string;
  tipo: 'EQUIPO' | 'HERRAMIENTA' | 'SERVICIO' | 'CONSUMIBLE' | 'PIEZA_ANDAMIO' | 'CUSTOM';
  descripcion: string;
  cantidad: number;
  periodo: 'DIA' | 'SEMANA' | 'QUINCENA' | 'MES' | 'CUSTOM';
  periodoCustomLabel?: string;        // requerido si periodo='CUSTOM'
  tarifaCatalogo: string;             // Decimal
  tarifaCustom?: string | null;       // Decimal — null = sin override
  tarifaAplicada: string;
  esTarifaCustom: boolean;
  subtotal: string;
  orden: number;
  // referencias opcionales según tipo:
  equipoId?: string;
  herramientaTipoId?: string;
  servicioId?: string;
  consumibleId?: string;
  piezaTipoId?: string;
  fechaServicio?: string;
  tecnicoAsignado?: string;
}
```

---

## 4. Payload `POST /cotizaciones/:id/items` por tipo

Discriminated union; el backend usa Zod para validar. Los campos requeridos por tipo:

- **EQUIPO**: `{ tipo: 'EQUIPO', equipoId, cantidad, periodo='DIA', periodoCustomLabel?, tarifaCustom?, descripcion? }`.
  Backend crea automáticamente la `ReservaEquipo` ACTIVA, marca el equipo como reservado y emite `equipo:disponibilidad`.
- **HERRAMIENTA**: `{ tipo: 'HERRAMIENTA', herramientaTipoId, cantidad, periodo='DIA', ... }`.
  Backend toma N unidades DISPONIBLES del tipo y crea N `ReservaHerramientaUnidad`. **Frontend NO selecciona unidades.**
- **SERVICIO**: `{ tipo: 'SERVICIO', servicioId, cantidad=1, tarifaCustom?, descripcion?, fechaServicio?, tecnicoAsignado? }`.
- **CONSUMIBLE**: `{ tipo: 'CONSUMIBLE', consumibleId, cantidad, tarifaCustom?, descripcion? }`.
- **PIEZA_ANDAMIO**: `{ tipo: 'PIEZA_ANDAMIO', piezaTipoId, cantidad, periodo='DIA', ... }`.
- **CUSTOM**: `{ tipo: 'CUSTOM', descripcion (required), cantidad, tarifaCustom (required), periodo?, periodoCustomLabel? }`.

**Cuerpos de andamio:** el backend no soporta tipo `CUERPO_ANDAMIO`. El frontend, cuando el usuario elige "agregar cuerpo", expande la BOM a múltiples llamadas POST `PIEZA_ANDAMIO` secuenciales. Para mantener UX agrupada en la tabla, agrupamos visualmente por orden contiguo + nota interna (`grupoNombre`) almacenada en el campo `descripcion` con prefijo o en `notasInternas` (decisión: usar prefijo en `descripcion` `"[Cuerpo: <nombre>] <pieza>"`).

**Si `periodo='CUSTOM'`:** `periodoCustomLabel` y `tarifaCustom` son obligatorios (validado backend).

---

## 5. Rutas Next.js a crear

```
app/(dashboard)/cotizaciones/
├── page.tsx                    # Lista (tabla + pipeline)
├── nueva/page.tsx              # Wizard (modo crear)
└── [id]/
    ├── page.tsx                # Detalle
    └── editar/page.tsx         # Wizard (modo editar)
```

> Aclaración: la ruta es `nueva` (no `nuevo`) para concordar con el género de "cotización", igual que ya hicieron las ramas anteriores (`/proyectos/nuevo`, `/bodegas/nuevo` usan masculino; aquí usamos femenino).

---

## 6. Arquitectura

### 6.1 Hook layer (`hooks/use-cotizaciones.ts`)

Exporta hooks de React Query siguiendo el patrón ya establecido en `use-clientes.ts`:

```ts
useCotizaciones(params)                           // lista paginada
useCotizacion(id)                                 // detalle
useCrearCotizacion()                              // POST /cotizaciones
useActualizarCotizacion()                         // PUT /cotizaciones/:id
useCambiarEstadoCotizacion()                      // PATCH /:id/estado
useEliminarCotizacion()                           // DELETE /:id (BORRADOR)
useAgregarItemCotizacion()                        // POST /:id/items
useEditarItemCotizacion()                         // PATCH /:id/items/:itemId
useEliminarItemCotizacion()                       // DELETE /:id/items/:itemId
useDescargarCotizacionPdf()                       // GET /:id/pdf blob
```

**Query keys:**
- `['cotizaciones', params]` para listas
- `['cotizaciones', id]` para detalle

**Invalidaciones:**
- Cualquier mutation de ítem → invalida `['cotizaciones', id]` (totales cambian).
- Cambio de estado → invalida `['cotizaciones', id]` y `['cotizaciones']` (lista).
- Aprobar → además invalida `['equipos']` (ya estaban RENTADO), `['facturas']` y `['consumibles']`, `['andamios']`.

**Toasts:** según convención CLAUDE.md, cada mutation lleva `onSuccess: toast.success(...)` y `onError: toast.error(...)`. Errores de validación de campo (códigos `VALIDATION_ERROR` con `details`) se devuelven crudos al caller para que el formulario los muestre inline con `setError`.

### 6.2 Types layer (`types/api.ts`)

Agregar:
- `EstadoCotizacion`
- `TipoItemCotizacion`
- `PeriodoItem`
- `TipoDocumentoFiscal`
- `CondicionesPago`
- `CotizacionListItem` (forma reducida que devuelve `/cotizaciones`)
- `Cotizacion` (forma completa de detalle)
- `CotizacionItem`
- `AgregarItemInput` (discriminated union por `tipo`)

### 6.3 Schemas Zod (`lib/schemas/cotizacion.ts`)

Replicar las validaciones del backend con Zod para usar con React Hook Form:
- `cotizacionGeneralSchema` — paso 1 (clienteId required, fechas, proyecto)
- `cotizacionTerminosSchema` — paso 3 (tipoDocFiscal, condicionesPago, contactoFacturacion condicional, depósito XOR)
- `agregarItemSchema` — uno por tipo de ítem en el modal

### 6.4 Componentes (`components/cotizaciones/`)

```
components/cotizaciones/
├── CotizacionesTabla.tsx       # vista lista
├── CotizacionesPipeline.tsx    # vista kanban
├── CotizacionStatusBadge.tsx   # mapea estado a Badge (reusa <Badge>)
├── CotizacionTimeline.tsx      # creada→enviada→aprobada/rechazada
├── wizard/
│   ├── CotizacionWizard.tsx          # contenedor con stepper y footer
│   ├── Step1Cliente.tsx               # buscador cliente + proyecto + fechas
│   ├── Step2Items.tsx                 # tabla editable de ítems + botón agregar
│   ├── Step3Terminos.tsx              # fiscal, condiciones, depósito, IVA, notas
│   ├── Step4Resumen.tsx               # vista de revisión + botón guardar/enviar
│   └── AgregarItemModal/
│       ├── index.tsx                  # contenedor con tabs
│       ├── TabEquipo.tsx
│       ├── TabHerramienta.tsx
│       ├── TabServicio.tsx
│       ├── TabConsumible.tsx
│       ├── TabAndamio.tsx             # con sub-modo pieza|cuerpo
│       └── TabCustom.tsx
└── detalle/
    ├── CotizacionDetalleHeader.tsx   # title + acciones por estado
    ├── ItemsTabla.tsx                 # tabla de items con totales
    ├── ResumenLateral.tsx             # cliente + fechas + timeline + factura asoc
    └── ConfirmarAprobacion.tsx        # ConfirmRow inline para aprobar/rechazar
```

### 6.5 Wizard — flujo de persistencia

Estado elegido: **crear borrador al final del Paso 1**, ítems en vivo en Paso 2.

```
Paso 1 (Cliente y fechas):
  - Usuario llena form local (RHF). Validación Zod.
  - Al presionar "Siguiente":
      1. POST /cotizaciones con { clienteId, contactoSolicitanteId?, proyectoId?, fechaVencimiento, porcentajeIva: 13 }
      2. Guarda el id devuelto en el estado del wizard.
      3. router.replace(`/cotizaciones/${id}/editar`) para que el wizard ahora sea idempotente
         (si el usuario refresca, recupera el borrador en lugar de duplicar).
  - Modo editar: el id ya viene de la URL; el form se pre-carga con useCotizacion(id).

Paso 2 (Ítems):
  - Tabla editable que muestra los items actuales (useCotizacion(id)).
  - Botón "Agregar ítem" → modal con tabs.
  - Cada confirmación de ítem hace POST /cotizaciones/:id/items y refetch.
  - Editar inline (cantidad, periodo, tarifa custom, descripción) → PATCH item.
  - Eliminar → DELETE item.
  - Cuerpo de andamio: el TabAndamio expande la BOM en N POSTs secuenciales con
    descripcion = `[Cuerpo: <nombre>] <pieza>`. Si una falla, se aborta la cadena y
    se muestra toast.error. Los items previos quedan; el usuario decide si limpiar.

Paso 3 (Términos):
  - Form RHF con: tipoDocumentoFiscal, condicionesPago (enum + textarea libre),
    contactoFacturacionId (select condicional para CCF/SE), porcentajeIva, depósito.
  - Al presionar "Siguiente": PUT /cotizaciones/:id con los campos del form.

Paso 4 (Resumen):
  - Solo lectura. Muestra todo lo cargado más totales.
  - Dos botones: "Guardar como borrador" (cierra al detalle) y "Marcar como enviada"
    (PATCH /:id/estado { estado: 'ENVIADA' } luego cierra al detalle).
  - Si el backend devuelve 422 DATOS_FISCALES_INCOMPLETOS o COTIZACION_SIN_ITEMS,
    el wizard regresa al paso correspondiente con setError o toast.

Cancelar wizard:
  - Si la cotización ya existe (borrador creado) y no hay items, ofrecer eliminar
    el borrador con DELETE /:id. Si tiene items, dejarla como borrador
    accesible desde la lista.
```

**Comentario "why" en `CotizacionWizard.tsx`:**
> El POST se hace al final del paso 1 porque el backend crea las reservas al agregar
> cada ítem dentro de su propia transacción; intentar acumular ítems en memoria
> rompería la disponibilidad en tiempo real y obligaría a manejar rollback parcial
> si una reserva fallara a mitad de camino.

### 6.6 Lista — vista tabular + pipeline

`page.tsx`:
- Componente cliente con `useCotizaciones(params)`.
- Toggle entre vista 'lista' y 'pipeline' usando `<Segmented>` (o segmented buttons inline si no existe el componente — verificar `components/ui/`).
- `<FilterBar>` con búsqueda + chips para estados.
- Paginación reutiliza `<Pagination>` existente.
- Click en fila/card → router.push a detalle.

`CotizacionesPipeline`:
- 4 columnas (BORRADOR, ENVIADA, APROBADA, RECHAZADA).
- Cada columna muestra count, suma de totales (decimal.js), y cards.
- Sin drag-and-drop (no requerido por el prototipo; el cambio de estado vive en el detalle).

### 6.7 Detalle

`[id]/page.tsx` carga la cotización y renderiza:
- `<PageHeader>` con número, cliente, fecha, badge de estado, y acciones según estado:
  | Estado | Acciones |
  |---|---|
  | `BORRADOR` | Descargar PDF, Editar (→ wizard), Eliminar (ConfirmRow), Marcar como enviada |
  | `ENVIADA` | Descargar PDF, Rechazar (ConfirmRow), Aprobar (ConfirmRow) |
  | `APROBADA` | Descargar PDF, Ver factura generada (link a `/facturas/:id` — placeholder hasta rama 11) |
  | `RECHAZADA` | Descargar PDF |
  Todos los botones de escritura se ocultan si `user.rol === 'VISUALIZADOR'`.
- Grid 2 columnas:
  - Izquierda: tabla de ítems con totales en footer; cards de condiciones, notas, notas internas (solo ADMIN/GERENTE/OPERADOR ven notas internas).
  - Derecha: card de cliente, card de fechas, card de timeline (creada/enviada/aprobada/rechazada).

**Manejo de errores 409 al aprobar:**
- `CONFLICTO_APROBACION`: toast.error("Algunos equipos ya no están disponibles") + invalida `['cotizaciones', id]` para refrescar reservas. El usuario puede cambiar items en el detalle solo si vuelve a BORRADOR (no permitido — debe rechazar y crear nueva).
- `CONSUMIBLE_SIN_STOCK` / `ANDAMIO_SIN_STOCK`: toast.error con el mensaje del backend.

**Comentario "why":**
> Una vez la cotización está APROBADA o RECHAZADA, el backend bloquea cualquier
> edición de ítems o transición. La UI lo refleja ocultando los controles, no
> deshabilitándolos, para no insinuar acciones imposibles.

### 6.8 Realtime equipos (`hooks/use-cotizaciones-realtime.ts`)

Reusa el patrón de `use-equipos-realtime.ts`. Se suscribe a `equipos` y escucha:
- `equipo:disponibilidad` → invalida `['equipos']` (el picker se refresca solo)
- `equipo:rentado` → invalida `['equipos']` y `['cotizaciones']`

El hook se monta en `Step2Items` del wizard y en la página de lista de equipos del picker (`TabEquipo.tsx`).

**Comentario "why":**
> El equipo puede ser tomado por otro usuario en otro tab. Invalidar los queries
> en respuesta al socket hace que el botón "Agregar" del equipo aparezca como
> reservado sin que el usuario tenga que recargar.

### 6.9 PDF

```ts
const blob = await api.get(`/cotizaciones/${id}/pdf`, { responseType: 'blob' });
const url = URL.createObjectURL(blob.data);
const a = document.createElement('a');
a.href = url;
a.download = `${cotizacion.numeroCotizacion}.pdf`;
a.click();
URL.revokeObjectURL(url);
```

Hook envoltorio que muestra `toast.loading('Generando PDF…')` y lo descarta al terminar.

---

## 7. Convenciones aplicadas (recordatorio del CLAUDE.md)

- **100% Tailwind.** Nada de CSS vanilla en `globals.css`. Si falta un token, agregar al `@theme` o `@layer utilities` existentes.
- **Sin valores arbitrarios** (`h-[20px]`). Usar tokens existentes.
- **Comentarios "why" en español** únicamente. Solo donde la decisión no sea obvia.
- **Toasts**: success en cada mutation, error en fallo de red/backend. Validación de campo va inline con `setError`. Nunca toastear errores 401.
- **Server Components por defecto** en `page.tsx`; `'use client'` solo donde se necesite.
- **Decimal.js para todos los montos.** Nunca `parseFloat`.
- **Números de documento (`COT-2026-001`) en `font-mono`.**
- **Fechas locales** con `formatDate()`.
- **VISUALIZADOR** no ve botones de escritura.
- **Mantener consistencia** con los hooks existentes: shape de `useXxx`, manejo de `ApiResponse`, invalidaciones.

---

## 8. Checklist de aceptación

- [ ] Lista paginada con filtros (estado, búsqueda) y dos vistas (tabla/pipeline).
- [ ] Wizard de 4 pasos crea borrador al final del paso 1 y permite reanudar via URL.
- [ ] Agregar ítem cubre los 6 tipos (EQUIPO, HERRAMIENTA, SERVICIO, CONSUMIBLE, PIEZA_ANDAMIO, CUSTOM).
- [ ] Cuerpo de andamio expande a múltiples ítems PIEZA_ANDAMIO con grupo visual.
- [ ] Edición inline de ítems funciona (cantidad, periodo, tarifa custom, descripción).
- [ ] Paso 3 expone tipoDocumentoFiscal, condicionesPago, contactoFacturacion (condicional), porcentajeIva, depósito (% o $ XOR).
- [ ] Detalle muestra acciones correctas por estado; los botones de escritura se ocultan para VISUALIZADOR.
- [ ] Transición a ENVIADA / APROBADA / RECHAZADA dispara toasts y refresca vistas.
- [ ] Error 409 al aprobar muestra mensaje útil en toast.
- [ ] Descarga de PDF funciona con blob.
- [ ] Socket.IO actualiza disponibilidad de equipos en el picker en vivo.
- [ ] Sin CSS vanilla. Sin valores arbitrarios.
- [ ] Comentarios "why" en español en wizard, hook de realtime, expansión BOM andamio, persistencia incremental.
- [ ] `pnpm tsc --noEmit` y `pnpm lint` pasan limpios.

---

## 9. Riesgos conocidos

1. **Cuerpo de andamio + falla parcial:** si la 4ta pieza de un cuerpo falla, las 3 anteriores ya están persistidas. Mitigación: toast.error claro indicando "Se agregaron X de Y piezas. Revisar antes de continuar". Una versión 2 podría agregar un endpoint backend que reciba el cuerpo completo en una transacción.
2. **Backend valida `periodoCustomLabel` y `tarifaCustom` cuando `periodo='CUSTOM'`.** El wizard debe forzarlos en el formulario antes del POST.
3. **`depositoPorcentaje` y `depositoMonto` son mutuamente excluyentes.** El form usa un radio que controla cuál campo está activo, y limpia el otro al cambiar.
4. **El wizard en modo editar carga `useCotizacion(id)` que devuelve `condicionesPago` como enum, pero el prototipo usa textarea libre.** Mapeamos: el enum va en un select; el textarea de "condiciones detalladas" se mapea a `notas` (que sí es libre y se muestra al cliente). Decisión: en Paso 3 quedan dos campos separados — "Condiciones de pago" (select enum) y "Notas para el cliente" (textarea, ya existía).
5. **El backend no expone endpoint global `GET /reservas`.** Si una vista futura necesita reservas activas, requerirá un endpoint nuevo. Para esta rama no aplica.
