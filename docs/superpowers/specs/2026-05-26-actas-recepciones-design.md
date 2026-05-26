# Spec — Actas de Entrega y Recepciones (RAMA 12)

**Fecha:** 2026-05-26
**Rama frontend:** `feat/actas` (desde `main`)
**Rama backend:** `feat/actas-recepciones-listado-global` (desde `main` en repo `/Users/joaquinmorales13a06/Desktop/Reinar/server`)
**Plan de referencia:** `docs/plan-trabajo-frontend.md` → RAMA 12

---

## 1. Objetivo

Implementar el módulo de **Actas de Entrega** (despacho → entrega de equipos al cliente) y **Recepciones** (devolución), conectado al backend Express existente. El módulo es operativo y lo usan principalmente roles OPERADOR/LOGISTICA para gestionar el ciclo completo de renta de equipos.

**Máquina de estados del acta:**
`PENDIENTE → DESPACHADO → ENTREGADO → DEVUELTA_PARCIAL → DEVUELTO`

- `PENDIENTE`: acta creada, equipos aún en bodega.
- `DESPACHADO`: equipos en camino al cliente. Se registra `fechaDespacho` y `usuarioDespachoId`.
- `ENTREGADO`: cliente recibió los equipos. Se registra `fechaEntrega` y datos del receptor.
- `DEVUELTA_PARCIAL`: una o más recepciones se registraron pero quedan ítems en campo.
- `DEVUELTO`: todos los ítems del acta fueron devueltos (`fechaDevolucion` se setea automáticamente).

Una **recepción** documenta la devolución física y estado de los equipos. Una recepción puede cerrar ítems de **varias actas** de una misma factura (el operador marca qué devolver por ítem, no por acta entera). Cuando se registra recepción, los equipos vuelven a `DISPONIBLE` y se emite evento WebSocket.

---

## 2. Decisiones tomadas (resumen)

| Tema | Decisión | Justificación |
|---|---|---|
| Listado global | Agregar `GET /api/v1/actas` y `GET /api/v1/recepciones` al backend | Backend solo expone sub-recursos de factura; logística necesita vista global con filtros |
| Tipos de ítem | Los 4 (equipo, herramienta-unidad, consumible, pieza) | El backend ya los soporta; el prototipo solo modela equipos pero las cotizaciones reales tienen los 4 |
| Orden de PRs | Server primero → frontend después, misma sesión | Plan de trabajo manda mergear server primero cuando hay cambio de backend |
| Despachado por | Auto-asignar al usuario autenticado | Operativamente natural; evita endpoint nuevo para listar usuarios accesible a OPERADOR/LOGISTICA |
| Flujo despacho/entrega | Páginas dedicadas con URL propia (`/actas/[id]/despacho`, `/actas/[id]/entrega`) | URL compartible, historial del navegador, alineado con el plan |
| Recepciones | Una recepción puede cerrar ítems de varias actas | El backend ya lo permite; refleja la realidad operativa (un viaje cubre varios despachos) |
| Filtros listado | Estado, búsqueda libre, rango de fechas, cliente | Cobertura completa para reportes y operación diaria |
| Período renta | Opcional, pre-llenado desde cotización si existe | Habilita reportes de mora futuros sin frenar al operador |

---

## 3. PR 1 — Backend (`server`)

### 3.1 Rama y alcance

- **Repo:** `/Users/joaquinmorales13a06/Desktop/Reinar/server`
- **Rama:** `feat/actas-recepciones-listado-global`
- **Sin migración Prisma** — todas las tablas y relaciones requeridas ya existen.

### 3.2 Archivos a modificar

#### `src/modules/actas/actas.schemas.ts`

Agregar:

```ts
export const listarActasGlobalQuery = z.object({
  page:        z.coerce.number().int().min(1).default(1),
  limit:       z.coerce.number().int().min(1).max(100).default(20),
  estado:      z.enum(['PENDIENTE', 'DESPACHADO', 'ENTREGADO', 'DEVUELTA_PARCIAL', 'DEVUELTO']).optional(),
  busqueda:    z.string().trim().min(1).optional(),
  fechaDesde:  z.string().datetime().optional(),
  fechaHasta:  z.string().datetime().optional(),
  clienteId:   z.string().cuid().optional(),
})

export const listarRecepcionesGlobalQuery = z.object({
  page:        z.coerce.number().int().min(1).default(1),
  limit:       z.coerce.number().int().min(1).max(100).default(20),
  busqueda:    z.string().trim().min(1).optional(),
  fechaDesde:  z.string().datetime().optional(),
  fechaHasta:  z.string().datetime().optional(),
  clienteId:   z.string().cuid().optional(),
})

export type FiltrosActasGlobal       = z.infer<typeof listarActasGlobalQuery>
export type FiltrosRecepcionesGlobal = z.infer<typeof listarRecepcionesGlobalQuery>
```

#### `src/modules/actas/actas.routes.ts`

Agregar al `actasRouter` independiente (al inicio, antes de `/:id`):

```ts
actasRouter.get('/', authenticate, requireRol(...todos), validateQuery(listarActasGlobalQuery), ctrl.listarGlobal)
```

Agregar al `recepcionesRouter` independiente (al inicio, antes de `/:id`):

```ts
recepcionesRouter.get('/', authenticate, requireRol(...todos), validateQuery(listarRecepcionesGlobalQuery), ctrl.listarRecepcionesGlobal)
```

#### `src/modules/actas/actas.controller.ts`

Agregar:

```ts
export async function listarGlobal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await service.listarActasGlobal(req.query as unknown as FiltrosActasGlobal)
    res.json({ success: true, data: result.data, meta: result.meta })
  } catch (err) { next(err) }
}

export async function listarRecepcionesGlobal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await service.listarRecepcionesGlobal(req.query as unknown as FiltrosRecepcionesGlobal)
    res.json({ success: true, data: result.data, meta: result.meta })
  } catch (err) { next(err) }
}
```

#### `src/modules/actas/actas.service.ts`

Agregar:

```ts
export async function listarActasGlobal(filtros: FiltrosActasGlobal) {
  const { page, limit, estado, busqueda, fechaDesde, fechaHasta, clienteId } = filtros
  const skip = (page - 1) * limit

  const where: Prisma.ActaEntregaWhereInput = {
    ...(estado && { estado }),
    ...(fechaDesde && { createdAt: { gte: new Date(fechaDesde) } }),
    ...(fechaHasta && { createdAt: { lte: new Date(fechaHasta) } }),
    ...(clienteId && { factura: { clienteId } }),
    ...(busqueda && {
      OR: [
        { numeroActa: { contains: busqueda, mode: 'insensitive' } },
        { factura: { numeroFactura: { contains: busqueda, mode: 'insensitive' } } },
        { factura: { cliente: { razonSocial: { contains: busqueda, mode: 'insensitive' } } } },
      ],
    }),
  }

  const [data, total] = await Promise.all([
    prisma.actaEntrega.findMany({
      where, skip, take: limit, orderBy: { createdAt: 'desc' },
      select: {
        id: true, numeroActa: true, estado: true,
        fechaDespacho: true, fechaEntrega: true, fechaDevolucion: true,
        direccionEntrega: true, notas: true, createdAt: true,
        bodegaOrigen:    { select: { id: true, nombre: true } },
        usuarioDespacho: { select: { id: true, nombre: true, apellido: true } },
        factura:         { select: { id: true, numeroFactura: true, clienteId: true, cliente: { select: { id: true, razonSocial: true } } } },
        _count:          { select: { items: true } },
      },
    }),
    prisma.actaEntrega.count({ where }),
  ])

  return { data, meta: { page, limit, total } }
}

export async function listarRecepcionesGlobal(filtros: FiltrosRecepcionesGlobal) {
  // Análogo a listarActasGlobal, sobre actaRecepcion. Filtros sobre fechaRecepcion en vez de createdAt.
  // OR de búsqueda: numeroActa de recepción, numeroFactura, cliente.razonSocial.
}
```

### 3.3 Forma de las responses

**`GET /api/v1/actas?estado=&busqueda=&fechaDesde=&fechaHasta=&clienteId=&page=&limit=`**

```json
{
  "success": true,
  "data": [
    {
      "id": "ckxxx",
      "numeroActa": "AE-2026-001",
      "estado": "DESPACHADO",
      "fechaDespacho": "2026-05-20T15:30:00.000Z",
      "fechaEntrega": null,
      "fechaDevolucion": null,
      "createdAt": "2026-05-20T10:00:00.000Z",
      "bodegaOrigen": { "id": "...", "nombre": "Bodega Central" },
      "usuarioDespacho": { "id": "...", "nombre": "Mario", "apellido": "Saravia" },
      "factura": { "id": "...", "numeroFactura": "FAC-2026-001", "clienteId": "...", "cliente": { "id": "...", "razonSocial": "Constructora X S.A." } },
      "_count": { "items": 3 }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 42 }
}
```

**`GET /api/v1/recepciones?...`** análogo, con `fechaRecepcion` en lugar de `fechaDespacho/Entrega/Devolucion`.

### 3.4 Tests

No hay suite formal de tests en el proyecto. Verificación manual:

- Listar sin filtros (paginado).
- Filtrar por estado, búsqueda, rango de fechas, cliente.
- Combinar 2+ filtros.
- Probar respuesta vacía (sin resultados).
- VISUALIZADOR puede leer; verificar 401/403 sin token.

---

## 4. PR 2 — Frontend (`frontend`)

### 4.1 Rama

- **Repo:** `/Users/joaquinmorales13a06/Desktop/Reinar/frontend`
- **Rama:** `feat/actas` (ya creada desde `main` antes de escribir este spec)

### 4.2 Estructura de rutas

```
app/(dashboard)/
├── actas/
│   ├── page.tsx                    # Lista global con filtros
│   ├── nueva/
│   │   └── page.tsx                # Crear acta — selector factura + ítems
│   └── [id]/
│       ├── page.tsx                # Detalle con timeline + acciones contextuales
│       ├── despacho/page.tsx       # Registrar despacho (guard: estado=PENDIENTE)
│       └── entrega/page.tsx        # Registrar entrega (guard: estado=DESPACHADO)
└── recepciones/
    ├── page.tsx                    # Lista global con filtros
    ├── nueva/page.tsx              # Wizard 2 pasos
    └── [id]/page.tsx               # Detalle con tabla de condiciones
```

**Server vs Client:** todas las `page.tsx` son `'use client'` (igual que `facturas/`, `cotizaciones/`, `pagos/`).

**Guards de estado por ruta:** si el estado no aplica, se muestra `<EmptyState>` con mensaje contextual + botón volver. Sin redirección automática (preserva URL para debugging).

**Query string para wizard de recepción:**
- `/recepciones/nueva` → arranca en paso 0 (selección de factura).
- `/recepciones/nueva?actaId=X` → pre-selecciona la factura y acta correspondiente y salta a paso 1.

### 4.3 Entry points cruzados

- **Detalle de factura** (`/facturas/[id]/page.tsx`): agregar card "Actas de esta factura" con botón "Nueva acta" → linkea a `/actas/nueva?facturaId=X`. Ajuste menor al módulo facturas existente, no refactor.
- **Detalle de acta**: link al detalle de la factura y a la recepción vinculada (si existe).
- **Navegación global** (`lib/nav.ts`): los items `actas` y `recepciones` ya están definidos. No requiere cambios.

### 4.4 Tipos (`types/api.ts`)

```ts
export type ActaItemTipo = 'EQUIPO' | 'HERRAMIENTA' | 'CONSUMIBLE' | 'PIEZA';
export type CondicionItem = 'BUENO' | 'REGULAR' | 'MALO';
export type EstadoActa = 'PENDIENTE' | 'DESPACHADO' | 'ENTREGADO' | 'DEVUELTA_PARCIAL' | 'DEVUELTO';
export type EstadoActaItem = 'PENDIENTE_DEVOLUCION' | 'DEVUELTO';

export type ActaItem = {
  id: string;
  cotizacionItemId: string;
  equipo?:            { id: string; nombre: string; codigoInterno: string };
  herramientaUnidad?: { id: string; codigoInterno: string; herramientaTipo: { nombre: string } };
  consumible?:        { id: string; nombre: string };
  piezaTipo?:         { id: string; nombre: string };
  cantidadConsumible?: number;
  cantidadRecibida?:   number;
  condicionSalida?:    CondicionItem;
  observacionesSalida?: string;
  horometroSalida?:    string;       // Decimal serializado
  combustibleSalida?:  string;
  estadoOperacional?:  boolean;
  accesoriosCompletos?: boolean;
  limpieza?:           boolean;
  estado: EstadoActaItem;
};

export type ActaListItem = {
  id: string;
  numeroActa: string;
  estado: EstadoActa;
  fechaDespacho: string | null;
  fechaEntrega: string | null;
  fechaDevolucion: string | null;
  createdAt: string;
  bodegaOrigen: { id: string; nombre: string };
  usuarioDespacho: { id: string; nombre: string; apellido: string } | null;
  factura: { id: string; numeroFactura: string; clienteId: string; cliente: { id: string; razonSocial: string } };
  _count: { items: number };
};

export type Acta = {
  id: string;
  numeroActa: string;
  estado: EstadoActa;
  facturaId: string;
  bodegaOrigenId: string;
  bodegaOrigen: { id: string; nombre: string };
  direccionEntrega: string | null;
  notas: string | null;
  observacionesSalida: string | null;
  numeroActaFisico: string | null;
  horaDespacho: string | null;
  horaEntrega: string | null;
  fechaDespacho: string | null;
  fechaEntrega: string | null;
  fechaDevolucion: string | null;
  periodoRentaInicio: string | null;
  periodoRentaFin: string | null;
  usuarioDespacho: { id: string; nombre: string; apellido: string } | null;
  contactoReceptor: { id: string; nombre: string } | null;
  receptorNombre: string | null;
  receptorDocumento: string | null;
  factura: { id: string; numeroFactura: string; clienteId: string };
  items: ActaItem[];
  createdAt: string;
};

export type FiltrosActas = {
  page?: number;
  limit?: number;
  estado?: EstadoActa;
  busqueda?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  clienteId?: string;
};

export type RecepcionItem = {
  id: string;
  actaEntregaItemId: string;
  condicionRetorno?: CondicionItem;
  observacionesRetorno?: string;
  horometroRetorno?: string;
  combustibleRetorno?: string;
  actaEntregaItem: ActaItem & { actaEntrega: { id: string; numeroActa: string } };
};

export type RecepcionListItem = {
  id: string;
  numeroActa: string;
  numeroActaFisico: string | null;
  fechaRecepcion: string;
  horaRecepcion: string | null;
  observaciones: string | null;
  usuarioRecepcion: { id: string; nombre: string; apellido: string };
  factura: { id: string; numeroFactura: string; clienteId: string; cliente: { id: string; razonSocial: string } };
  _count: { items: number };
};

export type Recepcion = RecepcionListItem & { items: RecepcionItem[] };

export type FiltrosRecepciones = Omit<FiltrosActas, 'estado'>;

// DTOs (mismo shape que los schemas Zod del backend)
export type CrearActaDto = {
  bodegaOrigenId: string;
  direccionEntrega?: string;
  notas?: string;
  observacionesSalida?: string;
  numeroActaFisico?: string;
  horaDespacho?: string;
  horaEntrega?: string;
  periodoRentaInicio?: string;
  periodoRentaFin?: string;
  items: Array<{
    cotizacionItemId: string;
    equipoId?: string;
    herramientaUnidadId?: string;
    consumibleId?: string;
    piezaTipoId?: string;
    cantidadConsumible?: number;
    cantidadRecibida?: number;
    condicionSalida?: CondicionItem;
    observacionesSalida?: string;
    horometroSalida?: number;
    combustibleSalida?: string;
    estadoOperacional?: boolean;
    accesoriosCompletos?: boolean;
    limpieza?: boolean;
  }>;
};

export type EditarActaDto = Partial<Pick<CrearActaDto,
  'bodegaOrigenId' | 'direccionEntrega' | 'notas' | 'observacionesSalida' |
  'numeroActaFisico' | 'horaDespacho' | 'periodoRentaInicio' | 'periodoRentaFin'>>;

export type DespacharActaDto = {
  estado: 'DESPACHADO';
  usuarioDespachoId: string;  // inyectado desde useAuthStore en el momento del submit
  observacionesSalida?: string;
};

export type EntregarActaDto = {
  estado: 'ENTREGADO';
  contactoReceptorId?: string;
  receptorNombre?: string;
  receptorDocumento?: string;
  horaEntrega?: string;
};

export type CrearRecepcionDto = {
  numeroActaFisico?: string;
  horaRecepcion?: string;
  observaciones?: string;
  items: Array<{
    actaEntregaItemId: string;
    condicionRetorno?: CondicionItem;
    observacionesRetorno?: string;
    horometroRetorno?: number;
    combustibleRetorno?: string;
  }>;
};
```

### 4.5 Hooks (`hooks/use-actas.ts`, `hooks/use-recepciones.ts`, `hooks/use-actas-realtime.ts`)

#### Query keys jerárquicos

```ts
['actas']                              // todos los listados globales (invalidación por prefijo)
['actas', filtros]
['actas-de-factura', facturaId, filtros]
['acta', id]
['items-disponibles-despacho', facturaId]
['items-pendientes-devolucion', facturaId]
['recepciones']
['recepciones-de-factura', facturaId]
['recepcion', id]
```

#### Mutaciones e invalidaciones

| Mutación | Invalida |
|---|---|
| `useCrearActa()` | `['actas']`, `['actas-de-factura', facturaId]`, `['items-disponibles-despacho', facturaId]`, `['factura', facturaId]` |
| `useEditarActa()` | `['acta', id]`, `['actas']` |
| `useCambiarEstadoActa()` DESPACHADO | `['acta', id]`, `['actas']`, `['actas-de-factura']` |
| `useCambiarEstadoActa()` ENTREGADO | igual + `['items-pendientes-devolucion', facturaId]` |
| `useCrearRecepcion()` | `['recepciones']`, `['recepciones-de-factura', facturaId]`, `['acta']` (todos), `['items-pendientes-devolucion', facturaId]`, `['equipos']` |

#### Manejo de errores

```ts
function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}
```

Mismo patrón que `use-facturas.ts`. Toast en `onError` con `extractErrorMessage(err, 'No se pudo …')`. Toast en `onSuccess` con mensaje corto en español.

### 4.6 WebSocket (`hooks/use-actas-realtime.ts`)

Patrón idéntico a `use-cotizaciones-realtime.ts`. Se suscribe a la sala `actas` cuando hay sesión, invalida queries según evento:

| Evento (backend) | Invalida en frontend |
|---|---|
| `acta:despachada` | `['acta', actaId]`, `['actas']`, `['actas-de-factura', facturaId]` |
| `acta:entregada` | igual + `['items-pendientes-devolucion', facturaId]` |
| `recepcion:registrada` | `['recepciones']`, `['recepciones-de-factura', facturaId]`, `['items-pendientes-devolucion', facturaId]`, `['acta']` |

Sin toasts por evento: si vos disparaste la mutación ya viste el toast de éxito; si fue otro usuario, la lista se refresca silenciosa.

Se invoca desde: `app/(dashboard)/actas/page.tsx`, `app/(dashboard)/recepciones/page.tsx`, `app/(dashboard)/actas/[id]/page.tsx`.

### 4.7 Componentes

#### Compartidos (`components/actas-recepciones/`)

| Componente | Responsabilidad |
|---|---|
| `<ItemRow item mode callbacks />` | Renderer polimórfico de línea de ítem (4 tipos). Modes: `view`, `edit-salida`, `edit-retorno`. Resuelve campos visibles según tipo (horómetro/combustible solo equipos; cantidad solo consumibles/piezas; código solo equipos/herramientas). |
| `<EstadoActaTimeline estado fechas />` | Barra horizontal de 4 pasos (PENDIENTE → DESPACHADO → ENTREGADO → DEVUELTO). Maneja `DEVUELTA_PARCIAL` como variante "en progreso" del paso devuelto. |
| `<SelectorFactura filter onSelect />` | Typeahead async sobre facturas. Filtros: `'elegibles-para-acta'` (DTE aprobado, con items pendientes) o `'con-actas-pendientes-devolucion'`. |
| `<CondicionSelect value onChange disabled />` | Select BUENO/REGULAR/MALO. |
| `<CondicionBadge condicion />` | Wrapper de `<Badge>` con mapeo BUENO→ok, REGULAR→warn, MALO→danger. |

#### Específicos de actas (`components/actas/`)

| Componente | Responsabilidad |
|---|---|
| `<ActaTablaListado actas onRowClick />` | Tabla del listado con columnas: número, factura, cliente, bodega, estado, fechas. |
| `<ActaPanelAccionContextual acta />` | Bloque de acción contextual en el detalle según estado. Botones que navegan a las páginas de despacho/entrega/recepción. |
| `<ActaItemsTablaEdicion items onChange />` | Tabla checkable de items en crear-acta. Renderiza `<ItemRow mode="edit-salida" />`. |

#### Específicos de recepciones (`components/recepciones/`)

| Componente | Responsabilidad |
|---|---|
| `<RecepcionTablaListado recepciones onRowClick />` | Listado global. |
| `<RecepcionWizardStep1 form onItemsLoaded />` | Selección de factura → grupos de items-pendientes-devolucion agrupados por acta → checkboxes por ítem. |
| `<RecepcionWizardStep2 form />` | Inspección: condición retorno + horómetro + combustible + observaciones por ítem marcado. Resalta amarillo cuando `condicionRetorno > condicionSalida` (ranking BUENO=1, REGULAR=2, MALO=3). |
| `<RecepcionDetalleTabla recepcion />` | Tabla del detalle de recepción con columnas salida/retorno. |

### 4.8 Formularios (RHF + Zod)

#### Schemas (`lib/schemas/actas.ts`, `lib/schemas/recepciones.ts`)

Replican `actas.schemas.ts` del backend. Decisión consciente: **sí se duplican** (no hay paquete shared; la validación inmediata en cliente mejora UX; backend siempre revalida).

#### Política de errores

| Caso | Acción |
|---|---|
| Validación Zod local | Inline con RHF (no toast) |
| Error 422 con `details[]` | Inline con `setError` por campo |
| Error 422 sin details / 4xx genérico | `toast.error(message)` |
| Error 409 (conflicto, ítem ya en otra acta) | `toast.error` + `<ConfirmRow>` opcional |
| Éxito creación | `toast.success` + navegar al detalle |
| Éxito cambio estado | `toast.success` + invalidación silenciosa |
| 401 | Manejado por el interceptor de `lib/api.ts` |

#### Particularidades por formulario

| Formulario | Notas |
|---|---|
| **Crear acta** | `useItemsDisponiblesDespacho(facturaId)` al cambiar factura. Pre-llena período renta desde cotización si existe. `useFieldArray` para items. |
| **Editar acta** | Solo si `estado === 'PENDIENTE'`. No edita items. |
| **Despacho** | Solo `observacionesSalida`. `usuarioDespachoId` se inyecta desde `useAuthStore().user.id` al submit. |
| **Entrega** | Select de contactos del cliente (`useContactos(clienteId)`). Al elegir contacto autocompleta nombre y DUI. Validación: al menos uno de `contactoReceptorId` o `receptorNombre`. |
| **Recepción paso 1** | Typeahead factura → checkboxes por ítem (no por acta, devolución parcial permitida). Botón "Siguiente" deshabilitado hasta 1+ ítem marcado. |
| **Recepción paso 2** | `condicionRetorno` (default BUENO), `observacionesRetorno`, `horometroRetorno` y `combustibleRetorno` (solo equipos). Resalta amarillo cuando empeoró. Estado del wizard en `useState` local del componente, no en URL. |

### 4.9 PDFs

Helper compartido en `lib/download-pdf.ts`:

```ts
export async function descargarPdf(opts: {
  url: string;
  filename: string;
  onStart?: () => void;
  onEnd?: () => void;
}): Promise<void> {
  const toastId = toast.loading('Generando PDF…');
  opts.onStart?.();
  try {
    const res = await api.get(opts.url, { responseType: 'blob' });
    const objectUrl = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = opts.filename;
    a.click();
    URL.revokeObjectURL(objectUrl);
    toast.dismiss(toastId);
  } catch (err) {
    toast.dismiss(toastId);
    toast.error(extractErrorMessage(err, 'No se pudo descargar el PDF.'));
  } finally {
    opts.onEnd?.();
  }
}
```

**Hooks finos** (`useDescargarActaPdf`, `useDescargarPickingPdf`, `useDescargarRecepcionPdf`) envuelven el helper con loading state.

**Naming de archivos descargados** (usa `numeroActa` que devuelve el backend):
- Acta: `AE-2026-001.pdf`
- Picking: `AE-2026-001-picking.pdf`
- Recepción: `AR-2026-001.pdf`

**Ubicación de botones:**
- `/actas/[id]`: "Descargar PDF" en `PageHeader.actions`. "Lista de picking" en panel contextual solo cuando estado es `PENDIENTE` o `DESPACHADO`.
- `/recepciones/[id]`: "Descargar PDF" en `PageHeader.actions`.
- Listados: sin botones inline de descarga (consistencia con cotizaciones/facturas).

### 4.10 Roles y permisos

| Acción | Visible para |
|---|---|
| Lectura (lista, detalle, PDFs) | todos |
| Crear acta / nueva recepción | escritores |
| Editar acta (solo estado PENDIENTE) | escritores |
| Registrar despacho / entrega | escritores |

`VISUALIZADOR` tiene los botones de escritura **ocultos** (no `disabled`), patrón consistente con `facturas/[id]/page.tsx`. La seguridad real está en el backend (`requireRol`).

### 4.11 Convenciones del proyecto aplicadas

- Idioma: 100% español (etiquetas, placeholders, mensajes).
- Sin modales para acciones principales (páginas dedicadas + `<ConfirmRow>` inline).
- Números de documento con `font-mono`.
- Montos con `decimal.js` + `formatCurrency()`.
- Fechas con `formatDate()` (formato `17 may. 2026`).
- Tailwind v4: solo clases predefinidas o tokens de `@theme`/`@layer utilities`; sin valores arbitrarios.
- Comentarios "why" en español en decisiones no obvias.
- `'use client'` solo donde hace falta (todas las pages de este módulo lo usan por React Query).

---

## 5. Checklist de aceptación

### Server PR (`feat/actas-recepciones-listado-global`)

- [ ] `GET /api/v1/actas` con filtros estado/búsqueda/fechaDesde/fechaHasta/clienteId/page/limit
- [ ] `GET /api/v1/recepciones` con filtros búsqueda/fechaDesde/fechaHasta/clienteId/page/limit
- [ ] Schemas Zod nuevos
- [ ] Handlers y service functions
- [ ] Probado manualmente: lista vacía, con filtros, paginada
- [ ] `pnpm tsc --noEmit` sin errores
- [ ] PR mergeado a `main` **antes** de mergear el PR de frontend

### Frontend PR (`feat/actas`)

- [ ] 8 páginas creadas (lista actas, nueva, detalle, despacho, entrega, lista recepciones, nueva recepción, detalle recepción)
- [ ] Tipos en `types/api.ts`
- [ ] `hooks/use-actas.ts`, `hooks/use-recepciones.ts`, `hooks/use-actas-realtime.ts`
- [ ] Componentes en `components/actas-recepciones/`, `components/actas/`, `components/recepciones/`
- [ ] Helper `lib/download-pdf.ts`
- [ ] Schemas Zod en `lib/schemas/actas.ts` y `lib/schemas/recepciones.ts`
- [ ] Card "Actas de esta factura" en detalle de factura
- [ ] Toasts según política
- [ ] VISUALIZADOR sin botones de escritura
- [ ] WebSocket suscrito a sala `actas` desde las páginas relevantes
- [ ] PDFs descargan con nombre correcto
- [ ] `pnpm tsc --noEmit` sin errores
- [ ] `pnpm lint` sin errores
- [ ] Dark mode no rompe paneles de acción contextual
- [ ] Tablet (768px) usable
- [ ] Comentarios "why" en español en decisiones no obvias

---

## 6. Tradeoffs reconocidos

- **Duplicación de schemas Zod backend/frontend**: aceptado por UX (validación inmediata) y porque no existe paquete shared todavía. Si se introduce uno, esta duplicación se elimina.
- **Auto-asignar `usuarioDespachoId`** en lugar de selector: pierde el caso "administrativo registra despacho que hizo el bodeguero". Si surge la necesidad, se agrega un endpoint `GET /usuarios/despachadores` y un selector en otra rama.
- **Wizard de recepción con estado en `useState`** (no URL): recargar pierde progreso. Aceptado porque coincide con el resto del proyecto y simplifica el modelo.
- **Sin tests automatizados**: el proyecto no tiene suite. Verificación manual + `pnpm tsc --noEmit`.

---

## 7. Referencias

- Plan: `docs/plan-trabajo-frontend.md` → RAMA 12
- Prototipo: `/Users/joaquinmorales13a06/Downloads/Frontend-REINAR-design/actas*.jsx`, `recepciones*.jsx`
- Backend: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/actas/`
- Convenciones: `CLAUDE.md` (raíz del frontend)
