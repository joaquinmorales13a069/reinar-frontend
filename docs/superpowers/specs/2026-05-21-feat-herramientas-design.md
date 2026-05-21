# RAMA 6 — `feat/herramientas` — Design

**Fecha:** 2026-05-21
**Rama git:** `feat/herramientas`
**Plan padre:** `docs/plan-trabajo-frontend.md` § RAMA 6

## 1. Objetivo

Implementar el módulo de **Herramientas & Consumibles** del ERP: catálogo de **tipos** de herramienta con sus **unidades físicas** y catálogo de **consumibles** con ajuste de stock auditado.

## 2. Divergencias respecto al plan original

El plan en `plan-trabajo-frontend.md` describe un alcance más amplio que el backend real soporta. Esta sección documenta las decisiones tomadas en brainstorming:

| Tema | Plan original | Backend real | Decisión |
|---|---|---|---|
| Endpoint base de tipos | `/herramientas/tipos` | `/herramientas` (el "tipo" es el recurso principal) | Usar `/herramientas` |
| Editar unidad | Página `/unidades/[id]/editar` con `codigoInterno`, `estado`, `bodegaId` | Solo `PATCH /unidades/:id/estado` con 4 estados editables; no se permite cambiar código ni tipo | Eliminar página `/editar`; en el detalle de unidad, solo selector de estado |
| Crear unidad | Form con `codigoInterno` | `POST /:tipoId/unidades` solo recibe `{ notas? }`; el `codigoInterno` lo genera el backend | Panel inline en el detalle del tipo, solo textarea de notas |
| Lista global de unidades | Plan mostraba `GET /unidades` con filtros | No existe endpoint global; solo nested bajo tipo | Quitar tab "Unidades" global; las unidades viven dentro del detalle del tipo |
| Bodega en unidades | Plan mencionaba `bodegaId` | Modelo Prisma no lo tiene | Omitir |
| Stock de consumibles | Plan no lo detallaba | `PATCH /:id/stock` con `{ delta, motivo }` separado del CRUD; `PUT /:id` rechaza `stockActual` | Botón "Ajustar stock" con panel inline (delta + motivo) en el detalle; el form de editar oculta `stockActual` |
| Soft delete | Plan mencionaba `PATCH /:id/estado` | Es `PATCH /:id/activo` | Usar el endpoint real |

## 3. Endpoints del backend (verificados)

Todos protegidos con `authenticate` + `requireRol`.

### Herramientas (tipos)
```
GET    /api/v1/herramientas              ?page&limit&search&categoria&activo   (todos)
POST   /api/v1/herramientas              { codigo, nombre, descripcion?, categoria, tarifaDia, tarifaSemana, tarifaMes, notas? }   (admin/gerente)
GET    /api/v1/herramientas/:id          (todos)
PUT    /api/v1/herramientas/:id          { nombre?, descripcion?, categoria?, tarifaDia?, tarifaSemana?, tarifaMes?, notas? }   (admin/gerente)
PATCH  /api/v1/herramientas/:id/activo   (admin/gerente, soft delete)
```

### Herramientas (unidades — nested)
```
POST   /api/v1/herramientas/:id/unidades                       { notas? }   (admin/gerente/logistica)
GET    /api/v1/herramientas/:id/unidades                       ?estado=     (todos)
PATCH  /api/v1/herramientas/unidades/:unidadId/estado          { estado: 'DISPONIBLE' | 'MANTENIMIENTO' | 'USO_INTERNO' | 'INACTIVO' }   (admin/gerente/logistica)
GET    /api/v1/herramientas/unidades/:unidadId/mantenimientos  (todos)
```

> El backend **no** expone `GET /unidades/:id` aislado ni `PUT /unidades/:id`. La página de detalle de unidad obtiene los datos desde la cache del `useUnidadesPorTipo(tipoId)` derivando por `tipoId` en query string.

### Consumibles
```
GET    /api/v1/consumibles              ?page&limit&search&categoria&activo&stockBajo   (todos)
POST   /api/v1/consumibles              { codigo, nombre, descripcion?, categoria, precioUnitario, stockActual, stockMinimo, unidad, notas? }   (admin/gerente)
GET    /api/v1/consumibles/:id          (todos)
PUT    /api/v1/consumibles/:id          { nombre?, descripcion?, categoria?, precioUnitario?, stockMinimo?, unidad?, notas? }  — sin stockActual   (admin/gerente)
PATCH  /api/v1/consumibles/:id/stock    { delta: integer != 0, motivo: string 1..255 }   (admin/gerente/logistica)
PATCH  /api/v1/consumibles/:id/activo   (admin/gerente, soft delete)
```

## 4. Enums (Prisma → frontend)

```ts
type CategoriaHerramienta = 'MANGUERA' | 'BOQUILLA' | 'EPP' | 'HERRAMIENTA_MANUAL' | 'OTRO';
type CategoriaConsumible = 'ABRASIVO' | 'PINTURA' | 'LUBRICANTE' | 'QUIMICO' | 'OTRO';
type EstadoHerramienta = 'DISPONIBLE' | 'RESERVADA' | 'RENTADA' | 'MANTENIMIENTO' | 'USO_INTERNO' | 'INACTIVO';
type EstadoUnidadEditable = Extract<EstadoHerramienta, 'DISPONIBLE' | 'MANTENIMIENTO' | 'USO_INTERNO' | 'INACTIVO'>;
```

Labels en español en `lib/herramientas.ts`:
- `CATEGORIAS_HERRAMIENTA_LABEL`: Manguera, Boquilla, EPP, Herramienta manual, Otro.
- `CATEGORIAS_CONSUMIBLE_LABEL`: Abrasivo, Pintura, Lubricante, Químico, Otro.
- `HERR_ESTADO_KIND`: mapea cada estado a `kind` de `<Badge>` (DISPONIBLE→ok, RESERVADA→warn, RENTADA→info, MANTENIMIENTO→warn, USO_INTERNO→neutral, INACTIVO→neutral).

## 5. Estructura de rutas y archivos

```
app/(dashboard)/herramientas/
├── page.tsx                          # Server: lee ?tab y renderiza TabsHerramientas
├── tipos/
│   ├── nuevo/page.tsx                # Form crear tipo
│   └── [id]/
│       ├── page.tsx                  # Detalle del tipo + lista de unidades + panel crear unidad
│       └── editar/page.tsx           # Form editar tipo
├── unidades/
│   └── [id]/page.tsx                 # Detalle unidad (lee ?tipoId)
└── consumibles/
    ├── nuevo/page.tsx
    └── [id]/
        ├── page.tsx                  # Detalle + Editar + Ajustar stock + Desactivar
        └── editar/page.tsx           # Form editar (sin stockActual)

components/herramientas/
├── TabsHerramientas.tsx              # Switch tipos|consumibles vía ?tab
├── HerramientasTiposList.tsx         # FilterBar + tabla
├── HerramientaTipoForm.tsx           # RHF + Zod (crear y editar)
├── UnidadCreatePanel.tsx             # Panel inline en detalle de tipo
├── UnidadEstadoSelector.tsx          # Selector con los 4 estados editables
├── UnidadMantenimientosCard.tsx      # Lista de últimos 5 mantenimientos
├── ConsumiblesList.tsx               # FilterBar + tabla (con resaltado stock bajo)
├── ConsumibleForm.tsx                # RHF + Zod (crear y editar)
├── AjusteStockPanel.tsx              # Panel inline: entrada/salida + delta + motivo
└── StockBar.tsx                      # Barra de progreso reusable

hooks/
├── use-herramientas.ts
└── use-consumibles.ts

lib/herramientas.ts                   # Labels y helpers

types/api.ts                          # Tipos agregados
```

## 6. Tipos TypeScript a agregar en `types/api.ts`

```ts
export interface HerramientaTipo {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoria: CategoriaHerramienta;
  tarifaDia: string;     // Decimal serializado
  tarifaSemana: string;
  tarifaMes: string;
  activo: boolean;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
  unidades?: HerramientaUnidad[];   // viene incluido en el detalle
  _count?: { unidades?: number };   // si el backend lo expone
}

export interface HerramientaUnidad {
  id: string;
  codigoInterno: string;
  herramientaTipoId: string;
  estado: EstadoHerramienta;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Consumible {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoria: CategoriaConsumible;
  precioUnitario: string;
  stockActual: number;
  stockMinimo: number;
  unidad: string;
  activo: boolean;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CrearHerramientaTipoDto = {
  codigo: string; nombre: string; descripcion?: string;
  categoria: CategoriaHerramienta;
  tarifaDia: number; tarifaSemana: number; tarifaMes: number;
  notas?: string;
};
export type ActualizarHerramientaTipoDto = Partial<Omit<CrearHerramientaTipoDto, 'codigo'>>;
export type FiltrosHerramientas = { page?: number; limit?: number; search?: string; categoria?: CategoriaHerramienta; activo?: boolean };

export type CrearUnidadDto = { notas?: string };
export type EstadoUnidadEditable = 'DISPONIBLE' | 'MANTENIMIENTO' | 'USO_INTERNO' | 'INACTIVO';

export type CrearConsumibleDto = {
  codigo: string; nombre: string; descripcion?: string;
  categoria: CategoriaConsumible;
  precioUnitario: number; stockActual: number; stockMinimo: number;
  unidad: string; notas?: string;
};
export type ActualizarConsumibleDto = Partial<Omit<CrearConsumibleDto, 'codigo' | 'stockActual'>>;
export type AjusteStockDto = { delta: number; motivo: string };
export type FiltrosConsumibles = FiltrosHerramientas extends infer F
  ? Omit<F, 'categoria'> & { categoria?: CategoriaConsumible; stockBajo?: boolean }
  : never;
```

## 7. Hooks de React Query

Patrón base: cada mutation devuelve `useMutation` con `onSuccess` (invalida queries + `toast.success`) y `onError` (extrae mensaje del backend con helper `extractErrorMessage` ya existente en `use-equipos.ts` — replicar el mismo helper en estos archivos para no introducir indirección).

### `hooks/use-herramientas.ts`

| Hook | Endpoint | Query keys / invalidaciones |
|---|---|---|
| `useHerramientaTipos(params)` | `GET /herramientas` | key: `['herramientas', params]` |
| `useHerramientaTipo(id)` | `GET /herramientas/:id` | key: `['herramientas', id]` |
| `useCrearHerramientaTipo()` | `POST /herramientas` | invalida `['herramientas']`; toast "Tipo creado." |
| `useEditarHerramientaTipo()` | `PUT /herramientas/:id` | invalida `['herramientas']` y `['herramientas', id]`; toast "Cambios guardados." |
| `useDesactivarHerramientaTipo()` | `PATCH /herramientas/:id/activo` | invalida `['herramientas']`; toast "Tipo desactivado." / "Tipo activado." según `activo` resultante |
| `useUnidadesPorTipo(tipoId, filtros)` | `GET /herramientas/:tipoId/unidades` | key: `['herramientas', tipoId, 'unidades', filtros]` |
| `useCrearUnidad()` | `POST /herramientas/:tipoId/unidades` | invalida `['herramientas', tipoId]` y `['herramientas', tipoId, 'unidades']`; toast "Unidad creada." |
| `useCambiarEstadoUnidad()` | `PATCH /herramientas/unidades/:unidadId/estado` | invalida `['herramientas']` (lista, para contadores) y `['herramientas', tipoId, 'unidades']`; toast "Estado actualizado." |
| `useMantenimientosUnidad(unidadId)` | `GET /herramientas/unidades/:unidadId/mantenimientos` | key: `['herramientas', 'unidades', unidadId, 'mantenimientos']` |

### `hooks/use-consumibles.ts`

| Hook | Endpoint | Notas |
|---|---|---|
| `useConsumibles(params)` | `GET /consumibles` | key: `['consumibles', params]` |
| `useConsumible(id)` | `GET /consumibles/:id` | key: `['consumibles', id]` |
| `useCrearConsumible()` | `POST /consumibles` | toast "Consumible creado." |
| `useEditarConsumible()` | `PUT /consumibles/:id` | sin `stockActual` |
| `useAjustarStock()` | `PATCH /consumibles/:id/stock` | toast "Stock ajustado." Invalida `['consumibles', id]` y `['consumibles']` |
| `useDesactivarConsumible()` | `PATCH /consumibles/:id/activo` | toast según `activo` resultante |

## 8. Páginas — detalle de UI

### `/herramientas/page.tsx` (Server Component)

Lee `searchParams.tab` (default `'tipos'`) y renderiza:
- `<PageHeader>` con título "Herramientas & Consumibles", subtítulo "Catálogo de tipos, unidades físicas y materiales de obra.", acción primaria que depende del tab activo (manejada dentro de `TabsHerramientas` que es client).
- `<TabsHerramientas activeTab={tab}>` (client): dos botones de tabs que usan `router.replace(?tab=...)`. Renderiza `<HerramientasTiposList>` o `<ConsumiblesList>`.

### `/herramientas/tipos/nuevo/page.tsx` + `/herramientas/tipos/[id]/editar/page.tsx`
- `<PageHeader title="Nuevo tipo de herramienta" back backLabel="Regresar" onBack={() => router.push('/herramientas?tab=tipos')} />` (idem para editar, con título "Editar tipo").
- `<HerramientaTipoForm>` con modo `'crear' | 'editar'`. En modo editar, el campo `codigo` se renderiza con `disabled`.

### `/herramientas/tipos/[id]/page.tsx`
- `<PageHeader>`:
  - title: nombre del tipo
  - subtitle: `<span className="font-mono text-xs">{codigo}</span> · <Badge kind="info">{categoria_label}</Badge>`
  - back → `/herramientas?tab=tipos`
  - actions: "Editar" (link), "Desactivar"/"Activar" (button con `<ConfirmRow>` inline al hacer click)
- Grid 2 cols (`lg:grid-cols-2`):
  - **Izquierda:** card "Tarifas" (día/semana/mes con `formatCurrency`) + card "Descripción y notas".
  - **Derecha:** card "Unidades ({total})":
    - Resumen por estado: badges con conteos para cada estado presente.
    - Lista de unidades clickable → `/herramientas/unidades/[id]?tipoId=...`.
    - Al final: `<UnidadCreatePanel tipoId={id} />` colapsable con título "+ Agregar unidad". Solo visible si rol ∈ inventario.

### `/herramientas/unidades/[id]/page.tsx`
- Lee `searchParams.tipoId`. Si falta, redirige a `/herramientas?tab=tipos` con `toast.error('Falta contexto del tipo.')`.
- Usa `useHerramientaTipo(tipoId)` + `useUnidadesPorTipo(tipoId)` y deriva la unidad. Mientras carga, `<Spinner>`. Si no se encuentra, EmptyState.
- `<PageHeader>` con título = `codigoInterno` (mono), subtítulo nombre del tipo + badge estado, back → `/herramientas/tipos/${tipoId}`.
- Card "Datos": Tipo (link), Categoría, Estado, Notas.
- Card "Cambiar estado":
  - Si `estado ∈ {RESERVADA, RENTADA}`: mensaje en lugar del selector — *"Este estado lo gestionan automáticamente cotizaciones y actas."*
  - Si no: `<UnidadEstadoSelector>` con los 4 valores editables. Cambio dispara `useCambiarEstadoUnidad()`.
  - Oculto si rol = VISUALIZADOR.
- Card "Mantenimientos": `<UnidadMantenimientosCard unidadId>` muestra los últimos 5 (tipo, fecha ingreso, estado). Link "Ver todos" a `/mantenimientos?unidadId=...` (placeholder mientras RAMA 15 no exista; el link es válido aunque el módulo destino llegue después).

### `/herramientas/consumibles/nuevo` y `/editar`
- `<ConsumibleForm>` con modo. En modo editar: `codigo` disabled, **sin** campos `stockActual`. Bajo el form: nota informativa "Para ajustar el stock usa el botón Ajustar stock en el detalle".

### `/herramientas/consumibles/[id]/page.tsx`
- `<PageHeader>` con title nombre, subtitle código mono + badge categoría, back → `/herramientas?tab=consumibles`.
- Acciones: "Editar", "Ajustar stock" (toggle `<AjusteStockPanel>`), "Desactivar/Activar".
- Grid 2 cols + `span-2` para la última card:
  - Card "Stock": número grande (color warn si bajo), `<StockBar>`, leyenda con mínimo, alerta "Reposición urgente" si bajo. El ajuste de stock **no** usa optimistic update — se espera la respuesta del backend para evitar inconsistencias bajo concurrencia.
  - Card "Datos generales": precio unitario / unidad, valor inventario calculado con `decimal.js` (`new Decimal(precioUnitario).mul(stockActual)`), estado.
  - Card span-2 "Historial de uso" (placeholder por ahora — el backend no expone movimientos individuales todavía; mostrar `<EmptyState>` o nota "Los movimientos de stock aparecerán aquí").

## 9. Formularios — schemas Zod (frontend)

Replican exactamente lo que el backend valida (`herramientas.schemas.ts` y `consumibles.schemas.ts`).

```ts
// HerramientaTipoForm (crear)
z.object({
  codigo: z.string().min(1).max(20).regex(/^[A-Z0-9-]+$/, 'Solo letras mayúsculas, números y guiones'),
  nombre: z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string().optional(),
  categoria: z.enum(['MANGUERA','BOQUILLA','EPP','HERRAMIENTA_MANUAL','OTRO']),
  tarifaDia: z.coerce.number().positive('La tarifa por día debe ser positiva'),
  tarifaSemana: z.coerce.number().positive('La tarifa por semana debe ser positiva'),
  tarifaMes: z.coerce.number().positive('La tarifa por mes debe ser positiva'),
  notas: z.string().optional(),
});
// En modo editar: codigo se omite del payload (campo disabled en UI).

// ConsumibleForm (crear)
z.object({
  codigo: z.string().min(1).max(20).regex(/^[A-Z0-9-]+$/),
  nombre: z.string().min(1),
  descripcion: z.string().optional(),
  categoria: z.enum(['ABRASIVO','PINTURA','LUBRICANTE','QUIMICO','OTRO']),
  precioUnitario: z.coerce.number().positive(),
  stockActual: z.coerce.number().int().min(0).default(0),
  stockMinimo: z.coerce.number().int().min(0).default(0),
  unidad: z.string().min(1).max(50),
  notas: z.string().optional(),
});
// En modo editar: codigo y stockActual se omiten.

// AjusteStockPanel
z.object({
  signo: z.enum(['entrada','salida']),  // sólo UI; el delta absoluto va aparte
  cantidad: z.coerce.number().int().positive('Debe ser mayor a 0'),
  motivo: z.string().min(1, 'Indica el motivo').max(255),
});
// Al enviar: delta = signo === 'entrada' ? cantidad : -cantidad
```

Manejo de errores: usar el helper `extractErrorMessage` ya existente en `hooks/use-equipos.ts`. Cuando el backend devuelve `error.details` (Zod del backend), mapear por nombre de campo a `setError`.

## 10. Permisos UI por rol

| Acción | ADMIN | GERENTE | OPERADOR | LOGISTICA | VISUALIZADOR |
|---|---|---|---|---|---|
| Ver tipos / unidades / consumibles | ✓ | ✓ | ✓ | ✓ | ✓ |
| Crear / editar tipo | ✓ | ✓ | – | – | – |
| Desactivar tipo | ✓ | ✓ | – | – | – |
| Crear unidad | ✓ | ✓ | – | ✓ | – |
| Cambiar estado unidad | ✓ | ✓ | – | ✓ | – |
| Crear / editar consumible | ✓ | ✓ | – | – | – |
| Desactivar consumible | ✓ | ✓ | – | – | – |
| Ajustar stock consumible | ✓ | ✓ | – | ✓ | – |

Implementar con helper que lee el rol del `useAuthStore()` y oculta botones (no usa el approach de "disabled con tooltip" — los esconde directamente).

## 11. Convenciones aplicadas

- **Tailwind v4 puro** (sin valores arbitrarios). Cualquier estado visual (resaltado warn de fila de stock bajo) usa utilities del proyecto (`bg-warn-soft` o similar — verificar que exista en `globals.css`; agregar a `@layer utilities` si falta).
- **Monetario:** `decimal.js` para cálculos, `formatCurrency()` de `lib/utils.ts` para mostrar.
- **Fechas:** `formatDate()` / `formatDateTime()` para mantenimientos.
- **Iconos:** `<Icon name>` con nombres existentes (`hammer`, `box`, `package`, `plus`, `edit`, `check`, `x`, `alertTriangle`). Verificar que `alertTriangle` existe en el dict; si no, agregarlo siguiendo el patrón.
- **Toasts:** `sonner` en cada mutation. Errores de validación de form → `setError` inline, NO toast.
- **Comentarios "why" en español** en decisiones no obvias (ej: porqué `useUnidadesPorTipo` se invoca con `tipoId` desde query string en el detalle de unidad).

## 12. Checklist de aceptación (deriva del checklist global)

- [ ] Las dos tabs (Tipos / Consumibles) cargan datos reales del backend.
- [ ] La paginación funciona en ambas listas.
- [ ] Filtros: search, categoría, activo (tipos); search, categoría, activo, stockBajo (consumibles).
- [ ] Crear/editar tipo y consumible muestran errores Zod del backend inline.
- [ ] Crear unidad funciona desde el detalle del tipo y refresca la lista.
- [ ] Cambiar estado de unidad funciona y refresca contadores agregados.
- [ ] Ajuste de stock (entrada/salida) actualiza el detalle y la lista.
- [ ] Soft delete de tipo y consumible funcionan; pueden reactivarse desde la misma acción.
- [ ] Botones de escritura ocultos para VISUALIZADOR; cambio de estado oculto para OPERADOR.
- [ ] Vista usable en tablet (768px) y móvil.
- [ ] Dark mode no rompe colores (especialmente el resaltado de stock bajo).
- [ ] Sin clases vanilla CSS en `globals.css`; sin valores arbitrarios Tailwind.
- [ ] Comentarios "why" en español donde aplique.

## 13. Fuera de alcance (NO en esta rama)

- Endpoint global de unidades (sería del backend, no del frontend).
- Edición de `codigoInterno` o reasignación de tipo de una unidad.
- Historial detallado de movimientos de stock por consumible (UI placeholder).
- Reportes de inventario (RAMA 16).
- Módulo de mantenimientos completo (RAMA 15) — solo se muestra link desde el detalle de unidad.
