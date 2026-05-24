# Diseño — Bodegas y Proyectos (Rama 9)

**Fecha:** 2026-05-24
**Rama:** `feat/bodegas-proyectos`
**Plan origen:** `docs/plan-trabajo-frontend.md` → Rama 9
**Backend de referencia:** `/Users/joaquinmorales13a06/Desktop/Reinar/server`

## Objetivo

Implementar el frontend para los módulos de **Bodegas** y **Proyectos** del ERP, conectados al backend existente. Las decisiones de scope difieren del prototipo y del plan original porque el backend impone una estructura específica (jerarquía de 2 niveles para bodegas, proyectos como sub-recurso de cliente).

## Hallazgos clave del backend (fuente de verdad)

### Bodegas

- Modelo `Bodega` (Prisma): `id, nombre, descripcion?, direccion?, ciudad, activa, parentId?, createdAt, updatedAt`.
- Jerarquía estricta de **2 niveles**: bodega principal (`parentId === null`) ↔ zona (`parentId === bodegaPrincipalId`). El backend rechaza zona-dentro-de-zona.
- `ciudad` es **requerido** en `crearBodegaSchema`.
- Endpoints reales:
  - `GET    /api/v1/bodegas` — devuelve solo principales con `_count.zonas`. Sin paginación, sin búsqueda. Cualquier rol.
  - `POST   /api/v1/bodegas` — `{ nombre, descripcion?, direccion?, ciudad }`. ADMIN/GERENTE.
  - `GET    /api/v1/bodegas/:id` — devuelve principal con `zonas` embebidas. 404 si el id corresponde a una zona.
  - `PUT    /api/v1/bodegas/:id` — actualiza principal. ADMIN/GERENTE.
  - `PATCH  /api/v1/bodegas/:id/estado` — `{ activa: boolean }`. ADMIN/GERENTE. Guards:
    - 409 si `activa: false` y hay zonas activas.
    - 409 si `activa: false` y hay actas en estado `DESPACHADO` o `ENTREGADO`.
  - `POST   /api/v1/bodegas/:id/zonas` — `{ nombre, descripcion? }`. ADMIN/GERENTE. Guards:
    - 400 si el id padre es a su vez una zona (no anidamiento profundo).
    - 409 si la bodega padre está inactiva.
  - `PUT    /api/v1/bodegas/zonas/:zonaId` — `{ nombre?, descripcion? }`. ADMIN/GERENTE.
  - `PATCH  /api/v1/bodegas/zonas/:zonaId/estado` — `{ activa: boolean }`. ADMIN/GERENTE.

### Proyectos

- Modelo `Proyecto`: `id, clienteId, nombre, descripcion?, ubicacion, estado, createdAt, updatedAt`. **No tiene** `fechaInicio` ni `fechaFin` (a pesar de lo que dice el plan original).
- `ubicacion` es texto plano requerido.
- Estados: `ACTIVO | PAUSADO | COMPLETADO | CANCELADO` (el plan original omite `PAUSADO`).
- Máquina de estados:
  ```
  ACTIVO     → PAUSADO | COMPLETADO | CANCELADO
  PAUSADO    → ACTIVO  | CANCELADO
  COMPLETADO → (terminal)
  CANCELADO  → (terminal)
  ```
- Endpoints reales:
  - `GET    /api/v1/clientes/:clienteId/proyectos` — opcional `?estado=`. Sin paginación. Cualquier rol.
  - `POST   /api/v1/clientes/:clienteId/proyectos` — `{ nombre, descripcion?, ubicacion }`. ADMIN/GERENTE/OPERADOR. Guard: 409 si el cliente no está ACTIVO.
  - `GET    /api/v1/proyectos/:id` — devuelve proyecto con `cliente` embebido y `kpis: { totalCotizado, totalFacturado, equiposEnObra }` computados. Cualquier rol.
  - `PUT    /api/v1/proyectos/:id` — `{ nombre?, descripcion?, ubicacion? }`. ADMIN/GERENTE/OPERADOR.
  - `PATCH  /api/v1/proyectos/:id/estado` — `{ estado }`. ADMIN/GERENTE/OPERADOR. 422 si la transición es inválida.
- **No existe** un listado global de proyectos en el backend.

## Decisiones de diseño

### D1. Sin listado global de proyectos

La gestión de proyectos vive bajo el cliente. No se crea ruta `/proyectos`. La página existente `/clientes/[id]` recibe una nueva card "Proyectos del cliente". El detalle individual sí está en una ruta global `/proyectos/[id]` porque otros módulos (cotizaciones) van a linkear ahí.

**Por qué:** el backend solo expone listar por cliente. Un listado global requeriría N+1 o un endpoint nuevo en el server (fuera del alcance del frontend).

### D2. Zonas se crean desde el detalle de la bodega padre

`/bodegas/nuevo` crea exclusivamente bodegas principales. Las zonas se crean desde `/bodegas/[id]/zonas/nueva` (botón "Nueva zona" en el detalle de la bodega padre).

**Por qué:** el backend separa `POST /bodegas` y `POST /bodegas/:id/zonas`. El selector "Bodega padre" del prototipo escondería la dualidad y complicaría la validación. La navegación contextual deja explícita la jerarquía.

### D3. UbicacionInput compartido entre Bodega y Proyecto

Tanto `Proyecto.ubicacion` como `Bodega.direccion` se capturan con un componente compuesto de 3 sub-controles: departamento (cat14), distrito (filtrado por departamento, ignorando municipio) y calle/detalle libre. Se guarda como un único string `${detalle}, ${distrito.label}, ${departamento.label}`.

**Por qué:** unifica la captura geográfica con catálogos oficiales SV y reduce errores de tipeo. Se guardan los nombres (no códigos) porque el backend acepta texto libre y otros módulos (PDFs) ya esperan strings legibles.

### D4. Bodega.ciudad se deriva del distrito

El campo `ciudad` (requerido por backend) no se edita directamente: en el `onSubmit` se calcula como `distrito.label` del UbicacionInput.

**Por qué:** evita pedir el dato dos veces al usuario. `distrito` representa la unidad geográfica de menor granularidad oficial y es el equivalente más cercano a "ciudad" en el catálogo MH.

### D5. EstadoProyectoSelector restringe transiciones en UI

El segmented control solo habilita las transiciones válidas según el estado actual. Los estados terminales (`COMPLETADO`, `CANCELADO`) lo dejan read-only.

**Por qué:** previene errores 422 antes de llegar al backend. La fuente de verdad sigue siendo el backend (idéntica máquina replicada).

### D6. Filtros de bodegas son client-side

La lista se filtra en memoria (búsqueda por nombre + chip activa/inactiva) porque el endpoint `GET /bodegas` no acepta query params y devuelve la lista completa.

**Por qué:** el backend asume volúmenes bajos (decenas de bodegas, no miles). Re-implementar paginación en el frontend sería sobre-ingeniería.

## Mapa de rutas

```
app/(dashboard)/
├── bodegas/
│   ├── page.tsx                                   # Lista jerárquica
│   ├── nuevo/page.tsx                             # Crear bodega principal
│   ├── [id]/
│   │   ├── page.tsx                               # Detalle (info + zonas + equipos)
│   │   ├── editar/page.tsx                        # Editar principal + desactivar
│   │   └── zonas/
│   │       ├── nueva/page.tsx                     # Crear zona bajo esta bodega
│   │       └── [zonaId]/editar/page.tsx           # Editar/desactivar zona
├── clientes/[id]/
│   ├── page.tsx                                   # EXISTE — agregar <ProyectosClienteCard />
│   └── proyectos/nuevo/page.tsx                   # Crear proyecto (clienteId prefijado)
└── proyectos/
    ├── [id]/page.tsx                              # Detalle con KPIs + cotizaciones
    └── [id]/editar/page.tsx                       # Editar + transición de estado
```

## Tipos (en `types/api.ts`)

```typescript
export type EstadoProyecto = 'ACTIVO' | 'PAUSADO' | 'COMPLETADO' | 'CANCELADO';

export interface BodegaZona {
  id: string;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
}

export interface Bodega {
  id: string;
  nombre: string;
  descripcion: string | null;
  direccion: string | null;
  ciudad: string | null;
  activa: boolean;
  parentId: string | null;
  createdAt: string;
  zonas?: BodegaZona[];          // presente en GET /:id de principal
  _count?: { zonas: number };    // presente en GET /
}

export interface Proyecto {
  id: string;
  clienteId: string;
  nombre: string;
  descripcion: string | null;
  ubicacion: string;
  estado: EstadoProyecto;
  createdAt: string;
  updatedAt: string;
  cliente?: { id: string; razonSocial: string | null; nombre: string };
  _count?: { cotizaciones: number };
  kpis?: { totalCotizado: string; totalFacturado: string; equiposEnObra: number };
}
```

## Hooks de React Query

### `hooks/use-bodegas.ts`

| Hook | Tipo | Query key | Invalida en mutate |
|---|---|---|---|
| `useBodegas()` | Query | `['bodegas']` | — |
| `useBodega(id)` | Query | `['bodegas', id]` | — |
| `useCrearBodega()` | Mutation | — | `['bodegas']` |
| `useActualizarBodega(id)` | Mutation | — | `['bodegas']`, `['bodegas', id]` |
| `useCambiarEstadoBodega(id)` | Mutation | — | `['bodegas']`, `['bodegas', id]` |
| `useCrearZona(bodegaId)` | Mutation | — | `['bodegas']`, `['bodegas', bodegaId]` |
| `useActualizarZona(zonaId, bodegaId)` | Mutation | — | `['bodegas', bodegaId]` |
| `useCambiarEstadoZona(zonaId, bodegaId)` | Mutation | — | `['bodegas', bodegaId]` |

### `hooks/use-proyectos.ts`

| Hook | Tipo | Query key | Invalida en mutate |
|---|---|---|---|
| `useProyectosCliente(clienteId, { estado? })` | Query | `['proyectos', { clienteId, estado }]` | — |
| `useProyecto(id)` | Query | `['proyectos', id]` | — |
| `useCrearProyecto(clienteId)` | Mutation | — | `['proyectos', { clienteId }]`, `['clientes', clienteId]` |
| `useActualizarProyecto(id, clienteId)` | Mutation | — | `['proyectos', id]`, `['proyectos', { clienteId }]` |
| `useCambiarEstadoProyecto(id, clienteId)` | Mutation | — | `['proyectos', id]`, `['proyectos', { clienteId }]` |

**Convenciones para todos los hooks:**
- `onSuccess`: `toast.success('Mensaje corto en español.')`.
- `onError` con error de validación de campo (`status 400` + `details[].path`): propagar al form con `setError`, sin toast.
- `onError` con error genérico o de negocio (`409`, `422`): `toast.error(error.message)` (mensaje viene del backend).
- `401` se maneja silenciosamente por el interceptor de `lib/api.ts`.

## Componentes nuevos

### `lib/sv-geo.ts` (extensión)

Agregar helper:
```typescript
export function getDistritosByDept(deptCode: string): DistritoSV[] {
  return DISTRITOS_SV.filter(d => d.department === deptCode);
}
```
Comentario "why" en el helper: explicar que ignora `municipality` porque el flujo de Reinar guarda solo `departamento + distrito + detalle` como texto compuesto.

### `components/ui/UbicacionInput.tsx`

Componente controlado compatible con RHF `Controller`.

**API:**
```typescript
interface UbicacionInputProps {
  value: string;                           // texto plano (composite)
  onChange: (texto: string) => void;
  error?: { departamento?: string; distrito?: string; detalle?: string };
  required?: boolean;
}
```

**Comportamiento:**
- Sub-estados internos: `departamento`, `distrito`, `detalle`.
- Al cambiar cualquier sub-estado, dispara `onChange(compose())` donde `compose()` retorna `${detalle.trim()}, ${distrito.label}, ${departamento.label}` (vacío si falta algún sub-estado).
- Al recibir `value` inicial (modo edición):
  - `split(', ')`. Si hay ≥ 3 partes, los últimos dos tokens se matchean contra labels de `DEPARTAMENTOS_SV` y `DISTRITOS_SV`.
  - Match exitoso → prellenar dropdowns, el resto va al input detalle.
  - Match fallido (datos legacy) → todo el texto al input detalle, dropdowns vacíos. Mostrar hint visual: "Los selectores quedaron vacíos por formato anterior; al guardar se actualizará el formato".

### `components/bodegas/`

- `BodegaForm.tsx` — RHF + Zod. Campos `nombre*`, `descripcion`, `<UbicacionInput>` (requerido). `ciudad` se deriva del distrito en `onSubmit`. En modo edición incluye botón "Desactivar bodega" → abre `<ConfirmRow>` inline → dispara `useCambiarEstadoBodega`. Errores 409 del backend van a un `toast.error` con el mensaje del backend.
- `ZonaForm.tsx` — RHF + Zod. Campos `nombre*`, `descripcion`. Recibe `bodegaPadre: { id, nombre }` como prop y muestra una barra contextual ("Zona de **Bodega Central**"). En modo edición incluye toggle activa/inactiva (con `ConfirmRow` para desactivar).
- `BodegasTabla.tsx` — Client. Renderiza la tabla con principales y zonas indentadas. Acepta `filtros: { search, estado }` y filtra client-side. Click en principal → `/bodegas/[id]`; click en zona → `/bodegas/[id]/zonas/[zonaId]/editar`.
- `EquiposAsignadosCard.tsx` — Llama `useEquipos({ bodegaId })` (hook existente). Muestra hasta 8 equipos con link a `/equipos/[id]`. Si hay más, link "Ver todos" → `/equipos?bodegaId=X`.

### `components/proyectos/`

- `ProyectoForm.tsx` — RHF + Zod. Campos `nombre*`, `descripcion`, `<UbicacionInput>` (requerido). Recibe `cliente: { id, nombre }` (no editable post-creación). En modo edición incluye `<EstadoProyectoSelector>`.
- `EstadoProyectoSelector.tsx` — Segmented control. Replica `TRANSICIONES_VALIDAS` del backend para habilitar/deshabilitar opciones. Estados terminales → read-only con label "Estado final".
- `ProyectosClienteCard.tsx` — Card para inyectar en `/clientes/[id]/page.tsx`. Lista proyectos del cliente con badge de estado y conteo de cotizaciones. Botón "Nuevo proyecto" oculto si `cliente.estado !== 'ACTIVO'`. Filas linkean a `/proyectos/[id]`.
- `ProyectoKpisCard.tsx` — Card en detalle del proyecto. Muestra `kpis.totalCotizado`, `kpis.totalFacturado` formateados con `decimal.js` + `formatCurrency`, y `kpis.equiposEnObra` como número.

## Roles y permisos en UI

| Acción | Roles permitidos | Implementación |
|---|---|---|
| Ver listas/detalles (bodegas, proyectos) | Todos | Sin guard |
| Crear/editar bodega o zona, cambiar estado | ADMIN, GERENTE | Botones ocultos para otros roles |
| Crear/editar proyecto, cambiar estado | ADMIN, GERENTE, OPERADOR | Botones ocultos para LOGISTICA, VISUALIZADOR |

Se lee el rol del store `useAuth()` (hook existente).

## Manejo de errores específicos del backend

| Error | Caso | UI |
|---|---|---|
| 409 — bodega con zonas activas | Desactivar bodega | `toast.error(error.message)`, mantener form abierto |
| 409 — bodega con actas en vuelo | Desactivar bodega | `toast.error(error.message)`, mantener form abierto |
| 409 — bodega padre inactiva | Crear zona | `toast.error(error.message)`. Botón "Nueva zona" debería estar oculto preventivamente |
| 400 — zona sobre zona | Crear zona | Solo posible por race condition; toast.error |
| 409 — cliente inactivo | Crear proyecto | `toast.error(error.message)`. Botón "Nuevo proyecto" oculto preventivamente |
| 422 — transición inválida | Cambiar estado de proyecto | `toast.error(error.message)`. Selector debería filtrar preventivamente |
| 400 — validación de campo | Cualquier form | `setError(path, { message })` inline, sin toast |
| 401 | Cualquier llamada | Maneja el interceptor de `lib/api.ts` silenciosamente |

## Convenciones aplicadas

- **Comentarios "why" en español.** Puntos obligados:
  - `BodegaForm.tsx`: por qué `ciudad` se deriva del distrito.
  - `EstadoProyectoSelector.tsx`: por qué se replica la máquina de estados (UX preventivo, no validación de seguridad).
  - `use-bodegas.ts` / `use-proyectos.ts`: invalidación cross-query (`['clientes', clienteId]`).
  - `UbicacionInput.tsx`: por qué el fallback de parseo deja el texto crudo en el detalle.
  - `lib/sv-geo.ts` → `getDistritosByDept`: por qué se ignora el municipio.
- **Tailwind primero.** Sin valores arbitrarios, sin clases vanilla en `globals.css`. Reutilizar tokens existentes.
- **100% español.** Etiquetas, placeholders, errores, estados vacíos.
- **Toasts cortos** (`sonner`): success/error/info con una línea máximo. Errores de validación de campo van inline.
- **`font-mono`** para IDs y números de documento.
- **`formatCurrency`** + `decimal.js` para todo valor monetario (los KPIs del proyecto).
- **Páginas son Client Components** (consistencia con el resto del proyecto que ya usa React Query).

## Checklist de entrega (antes de PR)

- [ ] Las páginas cargan datos reales del backend (sin mocks).
- [ ] El form de bodega y proyecto valida y muestra errores de API inline.
- [ ] Botones de escritura ocultos para roles no autorizados (VISUALIZADOR siempre; LOGISTICA para proyectos también).
- [ ] La sección `ProyectosClienteCard` aparece en `/clientes/[id]` con conteo y CTA correctos.
- [ ] El detalle de proyecto muestra los KPIs formateados con `decimal.js`.
- [ ] `UbicacionInput` parsea correctamente datos existentes al editar y cae al fallback cuando no matchea.
- [ ] `EstadoProyectoSelector` solo habilita transiciones válidas.
- [ ] Dark mode no rompe la UI en ninguna página nueva.
- [ ] La vista es usable en tablet (768px).
- [ ] Todas las mutations tienen `toast.success`/`toast.error` correctos.
- [ ] Comentarios "why" en español en los puntos listados arriba.
- [ ] Sin clases vanilla en `globals.css`. Sin valores arbitrarios de Tailwind.
- [ ] `pnpm tsc --noEmit` pasa sin errores.
- [ ] `pnpm lint` pasa sin errores.

## Fuera de scope (YAGNI)

- Exportar lista de bodegas (botón del prototipo). El backend no tiene endpoint específico.
- Listado global de proyectos. Resuelto por D1.
- Sub-bodegas anidadas más allá de 2 niveles. Backend no lo soporta.
- Mostrar municipio en el flujo geográfico. Resuelto por D3.
- Búsqueda server-side en bodegas. Resuelto por D6.
