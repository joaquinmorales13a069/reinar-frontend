# Actas y Recepciones (Rama 12) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el módulo de Actas de Entrega y Recepciones del ERP de Reinar conectado al backend Express. Incluye dos PRs coordinados: (1) endpoints globales nuevos en el server (`GET /api/v1/actas`, `GET /api/v1/recepciones`), y (2) 8 páginas en el frontend (listado/crear/detalle/despacho/entrega para actas; listado/wizard/detalle para recepciones) con realtime vía Socket.IO.

**Architecture:** Backend Express + Prisma (sin migración). Frontend Next.js 19 App Router con React Query + RHF/Zod. Hooks centralizados por dominio (`use-actas.ts`, `use-recepciones.ts`, `use-actas-realtime.ts`). Componentes compartidos en `components/actas-recepciones/`. Schemas Zod duplicados en cliente (tradeoff aceptado en spec). Server PR se mergea **antes** del frontend PR.

**Tech Stack:** Express 4 + Prisma + Zod (server). Next.js 19, React Query v5, RHF + Zod, Axios, decimal.js, sonner, Tailwind CSS v4, socket.io-client (frontend).

**Spec de referencia:** `docs/superpowers/specs/2026-05-26-actas-recepciones-design.md` — leerlo antes de empezar.

**Branches:**
- Backend: `feat/actas-recepciones-listado-global` (a crear en `/Users/joaquinmorales13a06/Desktop/Reinar/server`)
- Frontend: `feat/actas` (ya creada desde `main`; spec ya commiteado)

**El proyecto NO tiene suite de tests.** Verificación por tarea: `pnpm tsc --noEmit` en el repo correspondiente. Verificaciones manuales al final con `pnpm dev` (frontend en :3001; backend en :3000).

---

## Decisiones operativas

- **Commits frecuentes:** uno por tarea. Mensajes en español con prefijos `feat`, `fix`, `chore`, `docs`, `refactor`.
- **Idioma:** todo el contenido visible (labels, mensajes, comentarios) en español.
- **Tailwind:** solo clases predefinidas; sin valores arbitrarios (`h-[20px]` ❌); sin CSS vanilla.
- **Comentarios:** solo "why" en español, donde la decisión no sea obvia desde el nombre.
- **Backend antes que frontend:** Fases A0–A6 tocan el server; Fases B–F tocan el frontend.
- **Type-check entre tareas:** `pnpm tsc --noEmit` debe pasar antes de cada commit.

## Style constants compartidos (frontend)

Las siguientes constantes de Tailwind se repiten a lo largo del módulo. Copiar al tope del archivo correspondiente cuando se necesiten:

```typescript
const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk  = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-1';
const btnPri =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
const btnSec =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd bg-surface text-tx text-xs font-semibold hover:bg-bg-sunken transition-colors disabled:opacity-60';
const cardCls = 'rounded-lg border border-bd bg-surface p-4';
```

---

## Fase A — Backend (`server` repo)

**Cwd para esta fase:** `/Users/joaquinmorales13a06/Desktop/Reinar/server`

### Task A0: Crear rama backend

- [ ] **Step 1: Confirmar working tree limpio**

Run: `git -C /Users/joaquinmorales13a06/Desktop/Reinar/server status`
Expected: `nothing to commit, working tree clean` y rama `main`.

- [ ] **Step 2: Crear rama**

Run: `git -C /Users/joaquinmorales13a06/Desktop/Reinar/server checkout -b feat/actas-recepciones-listado-global`
Expected: `Switched to a new branch 'feat/actas-recepciones-listado-global'`.

---

### Task A1: Agregar schemas Zod globales

**Files:**
- Modify: `src/modules/actas/actas.schemas.ts` (append al final)

- [ ] **Step 1: Agregar los nuevos schemas**

Al final de `src/modules/actas/actas.schemas.ts`, agregar:

```ts
// ── Listado global ────────────────────────────────────────────────────────────

export const listarActasGlobalQuery = z.object({
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(20),
  estado:     z.enum(['PENDIENTE', 'DESPACHADO', 'ENTREGADO', 'DEVUELTA_PARCIAL', 'DEVUELTO']).optional(),
  busqueda:   z.string().trim().min(1).optional(),
  fechaDesde: z.string().datetime().optional(),
  fechaHasta: z.string().datetime().optional(),
  clienteId:  z.string().cuid().optional(),
})

export type FiltrosActasGlobal = z.infer<typeof listarActasGlobalQuery>

export const listarRecepcionesGlobalQuery = z.object({
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(20),
  busqueda:   z.string().trim().min(1).optional(),
  fechaDesde: z.string().datetime().optional(),
  fechaHasta: z.string().datetime().optional(),
  clienteId:  z.string().cuid().optional(),
})

export type FiltrosRecepcionesGlobal = z.infer<typeof listarRecepcionesGlobalQuery>
```

- [ ] **Step 2: Verificar TypeScript**

Run: `pnpm -C /Users/joaquinmorales13a06/Desktop/Reinar/server tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server add src/modules/actas/actas.schemas.ts
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server commit -m "feat(actas): schemas Zod para listado global de actas y recepciones"
```

---

### Task A2: Agregar service functions globales

**Files:**
- Modify: `src/modules/actas/actas.service.ts` (append al final)

- [ ] **Step 1: Agregar imports si faltan**

Verificar que el archivo ya importe `FiltrosActasGlobal` y `FiltrosRecepcionesGlobal` del schema. Si no, ampliar el `import` existente desde `./actas.schemas`:

```ts
import {
  CrearActaInput,
  EditarActaInput,
  FiltrosActas,
  CambiarEstadoActaInput,
  CrearRecepcionInput,
  FiltrosRecepciones,
  FiltrosActasGlobal,
  FiltrosRecepcionesGlobal,
} from './actas.schemas'
```

- [ ] **Step 2: Agregar las dos funciones al final del archivo**

```ts
// ── Listado global de actas (todas las facturas) ──────────────────────────────
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
        factura: {
          select: {
            id: true, numeroFactura: true, clienteId: true,
            cliente: { select: { id: true, razonSocial: true } },
          },
        },
        _count: { select: { items: true } },
      },
    }),
    prisma.actaEntrega.count({ where }),
  ])

  return { data, meta: { page, limit, total } }
}

// ── Listado global de recepciones (todas las facturas) ────────────────────────
export async function listarRecepcionesGlobal(filtros: FiltrosRecepcionesGlobal) {
  const { page, limit, busqueda, fechaDesde, fechaHasta, clienteId } = filtros
  const skip = (page - 1) * limit

  const where: Prisma.ActaRecepcionWhereInput = {
    ...(fechaDesde && { fechaRecepcion: { gte: new Date(fechaDesde) } }),
    ...(fechaHasta && { fechaRecepcion: { lte: new Date(fechaHasta) } }),
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
    prisma.actaRecepcion.findMany({
      where, skip, take: limit, orderBy: { fechaRecepcion: 'desc' },
      select: {
        id: true, numeroActa: true, numeroActaFisico: true,
        fechaRecepcion: true, horaRecepcion: true, observaciones: true,
        usuarioRecepcion: { select: { id: true, nombre: true, apellido: true } },
        factura: {
          select: {
            id: true, numeroFactura: true, clienteId: true,
            cliente: { select: { id: true, razonSocial: true } },
          },
        },
        _count: { select: { items: true } },
      },
    }),
    prisma.actaRecepcion.count({ where }),
  ])

  return { data, meta: { page, limit, total } }
}
```

- [ ] **Step 3: Verificar TypeScript**

Run: `pnpm -C /Users/joaquinmorales13a06/Desktop/Reinar/server tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 4: Commit**

```bash
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server add src/modules/actas/actas.service.ts
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server commit -m "feat(actas): service functions listarActasGlobal y listarRecepcionesGlobal"
```

---

### Task A3: Agregar controller handlers globales

**Files:**
- Modify: `src/modules/actas/actas.controller.ts` (append al final)

- [ ] **Step 1: Agregar el import del nuevo tipo**

Ampliar el import del schema:

```ts
import { FiltrosActas, FiltrosActasGlobal, FiltrosRecepcionesGlobal } from './actas.schemas'
```

- [ ] **Step 2: Agregar los dos handlers al final del archivo**

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

- [ ] **Step 3: Verificar TypeScript**

Run: `pnpm -C /Users/joaquinmorales13a06/Desktop/Reinar/server tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 4: Commit**

```bash
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server add src/modules/actas/actas.controller.ts
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server commit -m "feat(actas): controller handlers para listado global"
```

---

### Task A4: Cablear las rutas globales

**Files:**
- Modify: `src/modules/actas/actas.routes.ts`

- [ ] **Step 1: Ampliar el import del schema**

Cambiar la línea `import { crearActaSchema, ... } from './actas.schemas'` para incluir los nuevos:

```ts
import {
  crearActaSchema, editarActaSchema, cambiarEstadoActaSchema, listarActasQuery,
  crearRecepcionSchema, listarRecepcionesQuery,
  listarActasGlobalQuery, listarRecepcionesGlobalQuery,
} from './actas.schemas'
```

- [ ] **Step 2: Agregar `GET /` al `actasRouter` independiente**

Justo después de `const actasRouter = Router()` y **antes** de `actasRouter.get('/:id', ...)`, agregar:

```ts
actasRouter.get(
  '/',
  authenticate, requireRol(...todos), validateQuery(listarActasGlobalQuery),
  ctrl.listarGlobal,
)
```

- [ ] **Step 3: Agregar `GET /` al `recepcionesRouter` independiente**

Justo después de `export const recepcionesRouter = Router()` y **antes** de `recepcionesRouter.get('/:id', ...)`, agregar:

```ts
recepcionesRouter.get(
  '/',
  authenticate, requireRol(...todos), validateQuery(listarRecepcionesGlobalQuery),
  ctrl.listarRecepcionesGlobal,
)
```

- [ ] **Step 4: Verificar TypeScript**

Run: `pnpm -C /Users/joaquinmorales13a06/Desktop/Reinar/server tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 5: Commit**

```bash
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server add src/modules/actas/actas.routes.ts
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server commit -m "feat(actas): rutas GET /actas y GET /recepciones (listado global)"
```

---

### Task A5: Smoke test manual del backend

- [ ] **Step 1: Iniciar el server en :3000**

Run (en otra terminal, o background): `pnpm -C /Users/joaquinmorales13a06/Desktop/Reinar/server dev`
Expected: server escuchando en :3000.

- [ ] **Step 2: Obtener un access token**

Usar curl con un usuario válido del seed o de la BD local:

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/iniciar-sesion \
  -H "Content-Type: application/json" \
  -c /tmp/cookies.txt \
  -d '{"email":"admin@reinar.local","password":"<password>"}'
```

Guardar el `accessToken` devuelto en variable: `TOKEN=<token>`.

- [ ] **Step 3: Probar listado global de actas**

```bash
curl -s "http://localhost:3000/api/v1/actas?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" -b /tmp/cookies.txt | jq .
```

Expected: `{ success: true, data: [...], meta: { page: 1, limit: 5, total: N } }` con cada acta incluyendo `factura.cliente.razonSocial`.

- [ ] **Step 4: Probar filtros**

```bash
curl -s "http://localhost:3000/api/v1/actas?estado=PENDIENTE&busqueda=AE-2026" \
  -H "Authorization: Bearer $TOKEN" -b /tmp/cookies.txt | jq '.data | length'
```

Expected: número (puede ser 0). Sin error 4xx/5xx.

- [ ] **Step 5: Probar listado global de recepciones**

```bash
curl -s "http://localhost:3000/api/v1/recepciones?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" -b /tmp/cookies.txt | jq .
```

Expected: `{ success: true, data: [...], meta: {...} }`.

- [ ] **Step 6: Detener el server**

Ctrl+C en la terminal del dev server (o `kill` el background process).

---

### Task A6: Push y PR del backend

- [ ] **Step 1: Push de la rama**

Run: `git -C /Users/joaquinmorales13a06/Desktop/Reinar/server push -u origin feat/actas-recepciones-listado-global`
Expected: rama publicada.

- [ ] **Step 2: Crear PR**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
gh pr create --title "feat(actas): endpoints globales GET /actas y GET /recepciones" --body "$(cat <<'EOF'
## Summary
- Agrega endpoints globales `GET /api/v1/actas` y `GET /api/v1/recepciones` con filtros (estado, búsqueda, rango de fechas, cliente, paginación).
- Habilita el listado global del módulo de Actas en el frontend (RAMA 12).
- No requiere migración Prisma.

## Test plan
- [x] curl con filtros aplicados devuelve 200 con shape esperado.
- [x] Sin filtros devuelve listado paginado.
- [x] VISUALIZADOR puede leer (verificable en cualquier rol del enum `todos`).

## Linked PR
- Frontend que lo consume: feat/actas (a abrir tras mergear este).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: URL del PR. **Coordinar mergeo de este PR antes de continuar con la Fase B.**

---

## Fase B — Frontend: tipos, schemas, hooks, helpers

**Cwd para esta fase y posteriores:** `/Users/joaquinmorales13a06/Desktop/Reinar/frontend`

**Pre-condición:** el PR de backend (Fase A) está mergeado y el server local ya sirve los nuevos endpoints.

### Task B1: Agregar tipos al `types/api.ts`

**Files:**
- Modify: `types/api.ts` (append al final)

- [ ] **Step 1: Agregar todos los tipos del dominio**

Al final de `types/api.ts`, agregar el bloque completo:

```ts
// ── Actas y Recepciones (RAMA 12) ─────────────────────────────────────────────

export type ActaItemTipo = 'EQUIPO' | 'HERRAMIENTA' | 'CONSUMIBLE' | 'PIEZA';
export type CondicionItem = 'BUENO' | 'REGULAR' | 'MALO';
export type EstadoActa = 'PENDIENTE' | 'DESPACHADO' | 'ENTREGADO' | 'DEVUELTA_PARCIAL' | 'DEVUELTO';
export type EstadoActaItem = 'PENDIENTE_DEVOLUCION' | 'DEVUELTO';

export type ActaItem = {
  id: string;
  cotizacionItemId: string;
  equipo?: { id: string; nombre: string; codigoInterno: string } | null;
  herramientaUnidad?: {
    id: string;
    codigoInterno: string;
    herramientaTipo: { nombre: string };
  } | null;
  consumible?: { id: string; nombre: string } | null;
  piezaTipo?:  { id: string; nombre: string } | null;
  cantidadConsumible?: number | null;
  cantidadRecibida?:   number | null;
  condicionSalida?:    CondicionItem | null;
  observacionesSalida?: string | null;
  horometroSalida?:    string | null;
  combustibleSalida?:  string | null;
  estadoOperacional?:  boolean | null;
  accesoriosCompletos?: boolean | null;
  limpieza?:           boolean | null;
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
  factura: {
    id: string;
    numeroFactura: string;
    clienteId: string;
    cliente: { id: string; razonSocial: string };
  };
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
  condicionRetorno?: CondicionItem | null;
  observacionesRetorno?: string | null;
  horometroRetorno?: string | null;
  combustibleRetorno?: string | null;
  actaEntregaItem: ActaItem & {
    actaEntrega: { id: string; numeroActa: string };
  };
};

export type RecepcionListItem = {
  id: string;
  numeroActa: string;
  numeroActaFisico: string | null;
  fechaRecepcion: string;
  horaRecepcion: string | null;
  observaciones: string | null;
  usuarioRecepcion: { id: string; nombre: string; apellido: string };
  factura: {
    id: string;
    numeroFactura: string;
    clienteId: string;
    cliente: { id: string; razonSocial: string };
  };
  _count: { items: number };
};

export type Recepcion = RecepcionListItem & { items: RecepcionItem[] };

export type FiltrosRecepciones = Omit<FiltrosActas, 'estado'>;

// Items pendientes de devolución agrupados por acta (GET /facturas/:id/actas/items-pendientes-devolucion)
export type GrupoPendienteDevolucion = {
  actaEntregaId: string;
  numeroActa: string;
  fechaEntrega: string | null;
  items: ActaItem[];
};

// DTOs de mutaciones
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

export type EditarActaDto = {
  bodegaOrigenId?: string;
  direccionEntrega?: string;
  notas?: string;
  observacionesSalida?: string;
  numeroActaFisico?: string;
  horaDespacho?: string;
  periodoRentaInicio?: string;
  periodoRentaFin?: string;
};

export type DespacharActaDto = {
  estado: 'DESPACHADO';
  usuarioDespachoId: string;
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

- [ ] **Step 2: Verificar TypeScript**

Run: `pnpm tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add types/api.ts
git commit -m "feat(actas): tipos del dominio Acta/Recepción en types/api.ts"
```

---

### Task B2: Schemas Zod del cliente

**Files:**
- Create: `lib/schemas/acta.ts`
- Create: `lib/schemas/recepcion.ts`

- [ ] **Step 1: Crear `lib/schemas/acta.ts`**

```ts
// Schemas Zod del frontend. Replican actas.schemas.ts del backend para feedback
// inmediato en el form. El backend siempre revalida; no estamos saltándonos
// validación. Si se introduce un paquete shared en el futuro, este archivo se
// elimina.
import { z } from 'zod';

export const condicionSchema = z.enum(['BUENO', 'REGULAR', 'MALO']);

const itemActaSchema = z.object({
  cotizacionItemId: z.string().min(1),
  equipoId: z.string().optional(),
  herramientaUnidadId: z.string().optional(),
  consumibleId: z.string().optional(),
  piezaTipoId: z.string().optional(),
  cantidadConsumible: z.coerce.number().int().positive().optional(),
  cantidadRecibida: z.coerce.number().int().positive().optional(),
  condicionSalida: condicionSchema.optional(),
  observacionesSalida: z.string().optional(),
  horometroSalida: z.coerce.number().nonnegative().optional(),
  combustibleSalida: z.string().optional(),
  estadoOperacional: z.boolean().optional(),
  accesoriosCompletos: z.boolean().optional(),
  limpieza: z.boolean().optional(),
}).refine(
  (d) => [d.equipoId, d.herramientaUnidadId, d.consumibleId, d.piezaTipoId].filter(Boolean).length === 1,
  { message: 'Exactamente uno de equipo, herramienta, consumible o pieza es requerido' },
);

export const crearActaFormSchema = z.object({
  facturaId: z.string().min(1, 'Seleccioná una factura'),
  bodegaOrigenId: z.string().min(1, 'Seleccioná bodega de origen'),
  direccionEntrega: z.string().optional(),
  notas: z.string().optional(),
  observacionesSalida: z.string().optional(),
  numeroActaFisico: z.string().optional(),
  horaDespacho: z.string().optional(),
  horaEntrega: z.string().optional(),
  periodoRentaInicio: z.string().optional(),
  periodoRentaFin: z.string().optional(),
  items: z.array(itemActaSchema).min(1, 'El acta debe tener al menos un ítem'),
}).refine(
  (d) => !d.periodoRentaFin || !d.periodoRentaInicio || d.periodoRentaFin >= d.periodoRentaInicio,
  { message: 'La fecha fin no puede ser anterior al inicio', path: ['periodoRentaFin'] },
);

export type CrearActaForm = z.infer<typeof crearActaFormSchema>;

export const editarActaFormSchema = z.object({
  bodegaOrigenId: z.string().optional(),
  direccionEntrega: z.string().optional(),
  notas: z.string().optional(),
  observacionesSalida: z.string().optional(),
  numeroActaFisico: z.string().optional(),
  horaDespacho: z.string().optional(),
  periodoRentaInicio: z.string().optional(),
  periodoRentaFin: z.string().optional(),
}).refine(
  (d) => Object.values(d).some((v) => v !== undefined && v !== ''),
  { message: 'Debe proporcionar al menos un campo' },
);

export type EditarActaForm = z.infer<typeof editarActaFormSchema>;

export const despachoFormSchema = z.object({
  observacionesSalida: z.string().optional(),
});
export type DespachoForm = z.infer<typeof despachoFormSchema>;

export const entregaFormSchema = z.object({
  contactoReceptorId: z.string().optional(),
  receptorNombre: z.string().optional(),
  receptorDocumento: z.string().optional(),
  horaEntrega: z.string().optional(),
}).refine(
  (d) => !!d.contactoReceptorId || !!(d.receptorNombre && d.receptorNombre.trim()),
  { message: 'Indicá un contacto o un nombre del receptor', path: ['receptorNombre'] },
);
export type EntregaForm = z.infer<typeof entregaFormSchema>;
```

- [ ] **Step 2: Crear `lib/schemas/recepcion.ts`**

```ts
import { z } from 'zod';
import { condicionSchema } from './acta';

const itemRecepcionSchema = z.object({
  actaEntregaItemId: z.string().min(1),
  incluido: z.boolean(),
  condicionRetorno: condicionSchema.optional(),
  observacionesRetorno: z.string().optional(),
  horometroRetorno: z.coerce.number().nonnegative().optional(),
  combustibleRetorno: z.string().optional(),
});

export const crearRecepcionFormSchema = z.object({
  facturaId: z.string().min(1, 'Seleccioná una factura'),
  numeroActaFisico: z.string().optional(),
  horaRecepcion: z.string().optional(),
  observaciones: z.string().optional(),
  items: z.array(itemRecepcionSchema),
}).refine(
  (d) => d.items.some((i) => i.incluido),
  { message: 'Marcá al menos un ítem para devolver', path: ['items'] },
).refine(
  // Cada item incluido debe tener una condición — sin esto el server rechaza
  (d) => d.items.filter((i) => i.incluido).every((i) => !!i.condicionRetorno),
  { message: 'Indicá la condición de retorno de cada ítem marcado', path: ['items'] },
);

export type CrearRecepcionForm = z.infer<typeof crearRecepcionFormSchema>;
```

- [ ] **Step 3: Verificar TypeScript**

Run: `pnpm tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 4: Commit**

```bash
git add lib/schemas/acta.ts lib/schemas/recepcion.ts
git commit -m "feat(actas): schemas Zod del cliente para actas y recepciones"
```

---

### Task B3: Helper `lib/download-pdf.ts`

**Files:**
- Create: `lib/download-pdf.ts`

- [ ] **Step 1: Crear el helper**

```ts
'use client';

// Centraliza el patrón fetch-blob → createObjectURL → click → revoke
// que se repite en facturas, cotizaciones, actas y recepciones. Usar este
// helper en cualquier descarga de PDF nueva para evitar drift de estilo.
import { toast } from 'sonner';
import api from '@/lib/api';

function extractMsg(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: { message?: string } } } };
  return e?.response?.data?.error?.message ?? fallback;
}

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
    toast.error(extractMsg(err, 'No se pudo descargar el PDF.'));
  } finally {
    opts.onEnd?.();
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `pnpm tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add lib/download-pdf.ts
git commit -m "feat(actas): helper descargarPdf para descargas con loading toast"
```

---

### Task B4: Hook `use-actas.ts`

**Files:**
- Create: `hooks/use-actas.ts`

- [ ] **Step 1: Crear el hook**

```ts
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { descargarPdf } from '@/lib/download-pdf';
import type {
  ApiResponse,
  PaginatedResponse,
  Acta,
  ActaListItem,
  ActaItem,
  FiltrosActas,
  CrearActaDto,
  EditarActaDto,
  DespacharActaDto,
  EntregarActaDto,
} from '@/types/api';

// Mismo helper que use-facturas.ts — duplicado intencional para evitar acoplamiento.
function extractErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: { message?: string } } } };
  return e?.response?.data?.error?.message ?? fallback;
}

// ─── Queries ─────────────────────────────────────────────────────────

export function useActas(params: FiltrosActas = {}) {
  return useQuery({
    queryKey: ['actas', params],
    queryFn: () =>
      api.get<PaginatedResponse<ActaListItem>>('/actas', { params }).then((r) => r.data),
  });
}

export function useActasDeFactura(facturaId: string | null | undefined, params: { page?: number; limit?: number; estado?: string } = {}) {
  return useQuery({
    queryKey: ['actas-de-factura', facturaId, params],
    queryFn: () =>
      api.get<PaginatedResponse<ActaListItem>>(`/facturas/${facturaId}/actas`, { params }).then((r) => r.data),
    enabled: !!facturaId,
  });
}

export function useActa(id: string | null | undefined) {
  return useQuery({
    queryKey: ['acta', id],
    queryFn: () =>
      api.get<ApiResponse<Acta>>(`/actas/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

export function useItemsDisponiblesDespacho(facturaId: string | null | undefined) {
  return useQuery({
    queryKey: ['items-disponibles-despacho', facturaId],
    queryFn: () =>
      api.get<ApiResponse<ActaItem[]>>(`/facturas/${facturaId}/actas/items-disponibles-despacho`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!facturaId,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────

export function useCrearActa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ facturaId, data }: { facturaId: string; data: CrearActaDto }) =>
      api.post<ApiResponse<Acta>>(`/facturas/${facturaId}/actas`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (acta, { facturaId }) => {
      qc.invalidateQueries({ queryKey: ['actas'] });
      qc.invalidateQueries({ queryKey: ['actas-de-factura', facturaId] });
      qc.invalidateQueries({ queryKey: ['items-disponibles-despacho', facturaId] });
      qc.invalidateQueries({ queryKey: ['factura', facturaId] });
      toast.success(`Acta ${acta.numeroActa} creada.`);
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear el acta.'));
    },
  });
}

export function useEditarActa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditarActaDto }) =>
      api.patch<ApiResponse<Acta>>(`/actas/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (acta) => {
      qc.setQueryData(['acta', acta.id], acta);
      qc.invalidateQueries({ queryKey: ['actas'] });
      toast.success('Cambios guardados.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo actualizar el acta.'));
    },
  });
}

export function useCambiarEstadoActa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DespacharActaDto | EntregarActaDto }) =>
      api.patch<ApiResponse<null>>(`/actas/${id}/estado`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_data, { id, data }) => {
      qc.invalidateQueries({ queryKey: ['acta', id] });
      qc.invalidateQueries({ queryKey: ['actas'] });
      qc.invalidateQueries({ queryKey: ['actas-de-factura'] });
      if (data.estado === 'ENTREGADO') {
        qc.invalidateQueries({ queryKey: ['items-pendientes-devolucion'] });
      }
      toast.success(data.estado === 'DESPACHADO' ? 'Despacho registrado.' : 'Entrega confirmada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo cambiar el estado del acta.'));
    },
  });
}

// ─── PDFs ────────────────────────────────────────────────────────────

export function useDescargarActaPdf() {
  const [isLoading, setIsLoading] = useState(false);
  return {
    isLoading,
    descargar: (id: string, numeroActa: string) =>
      descargarPdf({
        url: `/actas/${id}/pdf`,
        filename: `${numeroActa}.pdf`,
        onStart: () => setIsLoading(true),
        onEnd: () => setIsLoading(false),
      }),
  };
}

export function useDescargarPickingPdf() {
  const [isLoading, setIsLoading] = useState(false);
  return {
    isLoading,
    descargar: (id: string, numeroActa: string) =>
      descargarPdf({
        url: `/actas/${id}/pdf/picking`,
        filename: `${numeroActa}-picking.pdf`,
        onStart: () => setIsLoading(true),
        onEnd: () => setIsLoading(false),
      }),
  };
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `pnpm tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-actas.ts
git commit -m "feat(actas): hook use-actas con queries, mutations y PDFs"
```

---

### Task B5: Hook `use-recepciones.ts`

**Files:**
- Create: `hooks/use-recepciones.ts`

- [ ] **Step 1: Crear el hook**

```ts
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { descargarPdf } from '@/lib/download-pdf';
import type {
  ApiResponse,
  PaginatedResponse,
  Recepcion,
  RecepcionListItem,
  GrupoPendienteDevolucion,
  FiltrosRecepciones,
  CrearRecepcionDto,
} from '@/types/api';

function extractErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: { message?: string } } } };
  return e?.response?.data?.error?.message ?? fallback;
}

export function useRecepciones(params: FiltrosRecepciones = {}) {
  return useQuery({
    queryKey: ['recepciones', params],
    queryFn: () =>
      api.get<PaginatedResponse<RecepcionListItem>>('/recepciones', { params }).then((r) => r.data),
  });
}

export function useRecepcionesDeFactura(facturaId: string | null | undefined, params: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['recepciones-de-factura', facturaId, params],
    queryFn: () =>
      api.get<PaginatedResponse<RecepcionListItem>>(`/facturas/${facturaId}/recepciones`, { params }).then((r) => r.data),
    enabled: !!facturaId,
  });
}

export function useRecepcion(id: string | null | undefined) {
  return useQuery({
    queryKey: ['recepcion', id],
    queryFn: () =>
      api.get<ApiResponse<Recepcion>>(`/recepciones/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

export function useItemsPendientesDevolucion(facturaId: string | null | undefined) {
  return useQuery({
    queryKey: ['items-pendientes-devolucion', facturaId],
    queryFn: () =>
      api.get<ApiResponse<GrupoPendienteDevolucion[]>>(`/facturas/${facturaId}/actas/items-pendientes-devolucion`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!facturaId,
  });
}

export function useCrearRecepcion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ facturaId, data }: { facturaId: string; data: CrearRecepcionDto }) =>
      api.post<ApiResponse<Recepcion>>(`/facturas/${facturaId}/recepciones`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (recepcion, { facturaId }) => {
      qc.invalidateQueries({ queryKey: ['recepciones'] });
      qc.invalidateQueries({ queryKey: ['recepciones-de-factura', facturaId] });
      qc.invalidateQueries({ queryKey: ['items-pendientes-devolucion', facturaId] });
      // 'acta' sin id invalida todas las queries con prefix ['acta', ...] — necesario
      // porque la recepción puede haber cerrado ítems de varias actas distintas.
      qc.invalidateQueries({ queryKey: ['acta'] });
      qc.invalidateQueries({ queryKey: ['actas'] });
      qc.invalidateQueries({ queryKey: ['equipos'] });
      toast.success(`Recepción ${recepcion.numeroActa} registrada.`);
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo registrar la recepción.'));
    },
  });
}

export function useDescargarRecepcionPdf() {
  const [isLoading, setIsLoading] = useState(false);
  return {
    isLoading,
    descargar: (id: string, numeroActa: string) =>
      descargarPdf({
        url: `/recepciones/${id}/pdf`,
        filename: `${numeroActa}.pdf`,
        onStart: () => setIsLoading(true),
        onEnd: () => setIsLoading(false),
      }),
  };
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `pnpm tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-recepciones.ts
git commit -m "feat(actas): hook use-recepciones con queries, mutation crear y PDF"
```

---

### Task B6: Hook realtime `use-actas-realtime.ts`

**Files:**
- Create: `hooks/use-actas-realtime.ts`

- [ ] **Step 1: Crear el hook**

```ts
'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socket } from '@/lib/socket';

// Suscribe al usuario autenticado a la sala 'actas' e invalida queries cuando
// el backend emite cambios. Sin toasts: si vos disparaste la acción ya viste el
// toast de éxito; si fue otro usuario, el refresh silencioso es lo correcto en
// un equipo operativo (5-10 personas) para no fatigarlos con notificaciones.
export function useActasRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    if (!socket.connected) socket.connect();
    socket.emit('join', 'actas');

    const onDespachada = ({ actaId, facturaId }: { actaId: string; facturaId: string }) => {
      qc.invalidateQueries({ queryKey: ['acta', actaId] });
      qc.invalidateQueries({ queryKey: ['actas'] });
      qc.invalidateQueries({ queryKey: ['actas-de-factura', facturaId] });
    };
    const onEntregada = ({ actaId, facturaId }: { actaId: string; facturaId: string }) => {
      qc.invalidateQueries({ queryKey: ['acta', actaId] });
      qc.invalidateQueries({ queryKey: ['actas'] });
      qc.invalidateQueries({ queryKey: ['actas-de-factura', facturaId] });
      qc.invalidateQueries({ queryKey: ['items-pendientes-devolucion', facturaId] });
    };
    const onRecepcion = ({ facturaId }: { recepcionId: string; facturaId: string }) => {
      qc.invalidateQueries({ queryKey: ['recepciones'] });
      qc.invalidateQueries({ queryKey: ['recepciones-de-factura', facturaId] });
      qc.invalidateQueries({ queryKey: ['items-pendientes-devolucion', facturaId] });
      qc.invalidateQueries({ queryKey: ['acta'] });
      qc.invalidateQueries({ queryKey: ['actas'] });
    };

    socket.on('acta:despachada', onDespachada);
    socket.on('acta:entregada', onEntregada);
    socket.on('recepcion:registrada', onRecepcion);

    return () => {
      socket.off('acta:despachada', onDespachada);
      socket.off('acta:entregada', onEntregada);
      socket.off('recepcion:registrada', onRecepcion);
      socket.emit('leave', 'actas');
    };
  }, [qc]);
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `pnpm tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-actas-realtime.ts
git commit -m "feat(actas): hook useActasRealtime para invalidar queries vía Socket.IO"
```

---

## Fase C — Componentes compartidos

### Task C1: `<CondicionBadge />` y `<CondicionSelect />`

**Files:**
- Create: `components/actas-recepciones/CondicionBadge.tsx`
- Create: `components/actas-recepciones/CondicionSelect.tsx`

- [ ] **Step 1: Crear `CondicionBadge.tsx`**

```tsx
import { Badge } from '@/components/ui/Badge';
import type { CondicionItem } from '@/types/api';

const KIND: Record<CondicionItem, 'ok' | 'warn' | 'danger'> = {
  BUENO: 'ok',
  REGULAR: 'warn',
  MALO: 'danger',
};

export function CondicionBadge({ condicion }: { condicion: CondicionItem | null | undefined }) {
  if (!condicion) return <span className="text-tx-3 text-xs">—</span>;
  return <Badge status={condicion} kind={KIND[condicion]} />;
}
```

- [ ] **Step 2: Crear `CondicionSelect.tsx`**

```tsx
'use client';

import type { CondicionItem } from '@/types/api';

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border border-bd bg-surface text-tx focus:outline-none focus:border-accent transition-colors disabled:opacity-60';

type Props = {
  value: CondicionItem | undefined;
  onChange: (v: CondicionItem) => void;
  disabled?: boolean;
  id?: string;
};

export function CondicionSelect({ value, onChange, disabled, id }: Props) {
  return (
    <select
      id={id}
      className={inputBase}
      value={value ?? 'BUENO'}
      onChange={(e) => onChange(e.target.value as CondicionItem)}
      disabled={disabled}
    >
      <option value="BUENO">Bueno</option>
      <option value="REGULAR">Regular</option>
      <option value="MALO">Malo</option>
    </select>
  );
}
```

- [ ] **Step 3: Verificar TypeScript**

Run: `pnpm tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 4: Commit**

```bash
git add components/actas-recepciones/CondicionBadge.tsx components/actas-recepciones/CondicionSelect.tsx
git commit -m "feat(actas): componentes CondicionBadge y CondicionSelect"
```

---

### Task C2: `<EstadoActaTimeline />`

**Files:**
- Create: `components/actas-recepciones/EstadoActaTimeline.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
import { Icon } from '@/components/ui/Icon';
import { formatDate } from '@/lib/utils';
import type { EstadoActa } from '@/types/api';

type Props = {
  estado: EstadoActa;
  fechas: {
    fechaDespacho: string | null;
    fechaEntrega: string | null;
    fechaDevolucion: string | null;
  };
};

const PASOS = [
  { id: 'PENDIENTE',  label: 'Pendiente' },
  { id: 'DESPACHADO', label: 'Despachado' },
  { id: 'ENTREGADO',  label: 'Entregado' },
  { id: 'DEVUELTO',   label: 'Devuelto' },
] as const;

// DEVUELTA_PARCIAL se trata como variante "en progreso" del paso DEVUELTO:
// el círculo del paso 4 se ve activo pero sin check final.
function indexCurrent(estado: EstadoActa): number {
  if (estado === 'PENDIENTE') return 0;
  if (estado === 'DESPACHADO') return 1;
  if (estado === 'ENTREGADO') return 2;
  return 3; // DEVUELTA_PARCIAL o DEVUELTO
}

export function EstadoActaTimeline({ estado, fechas }: Props) {
  const idx = indexCurrent(estado);
  const fechaPorPaso = (i: number): string | null => {
    if (i === 1) return fechas.fechaDespacho;
    if (i === 2) return fechas.fechaEntrega;
    if (i === 3) return fechas.fechaDevolucion;
    return null;
  };

  return (
    <div className="flex items-center gap-2 mb-6 overflow-x-auto">
      {PASOS.map((paso, i) => {
        const done = i < idx;
        const active = i === idx;
        const fecha = fechaPorPaso(i);
        return (
          <div key={paso.id} className="flex items-center gap-2 min-w-fit">
            <div className={`flex items-center gap-2 ${done ? 'opacity-100' : active ? 'opacity-100' : 'opacity-50'}`}>
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${done ? 'bg-ok text-white' : active ? 'bg-accent text-navy' : 'bg-bg-sunken text-tx-3 border border-bd'}`}>
                {done ? <Icon name="check" size={12} /> : i + 1}
              </div>
              <div className="text-xs">
                <div className="font-medium text-tx">{paso.label}</div>
                {fecha && <div className="text-tx-3 font-mono">{formatDate(fecha)}</div>}
              </div>
            </div>
            {i < PASOS.length - 1 && (
              <div className={`w-8 h-px ${i < idx ? 'bg-ok' : 'bg-bd'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `pnpm tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add components/actas-recepciones/EstadoActaTimeline.tsx
git commit -m "feat(actas): timeline horizontal de estado del acta"
```

---

### Task C3: `<ItemRow />` polimórfico

**Files:**
- Create: `components/actas-recepciones/ItemRow.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
import { CondicionBadge } from './CondicionBadge';
import type { ActaItem } from '@/types/api';

// Resuelve label + código de identificación según el tipo polimórfico del item.
// El backend garantiza que exactamente uno de equipo/herramientaUnidad/consumible/piezaTipo
// está poblado por línea.
function describirItem(item: ActaItem): { titulo: string; codigo: string | null; tipo: 'EQUIPO' | 'HERRAMIENTA' | 'CONSUMIBLE' | 'PIEZA' } {
  if (item.equipo) return { titulo: item.equipo.nombre, codigo: item.equipo.codigoInterno, tipo: 'EQUIPO' };
  if (item.herramientaUnidad) {
    return { titulo: item.herramientaUnidad.herramientaTipo.nombre, codigo: item.herramientaUnidad.codigoInterno, tipo: 'HERRAMIENTA' };
  }
  if (item.consumible) return { titulo: item.consumible.nombre, codigo: null, tipo: 'CONSUMIBLE' };
  if (item.piezaTipo)  return { titulo: item.piezaTipo.nombre,  codigo: null, tipo: 'PIEZA' };
  return { titulo: '—', codigo: null, tipo: 'EQUIPO' };
}

type Props = {
  item: ActaItem;
  // Modo view = lectura; mostramos solo condición salida y retorno si las hay.
  mode?: 'view' | 'compact';
  // Si se pasa rightSlot, se renderiza en el lado derecho (badges, controles).
  rightSlot?: React.ReactNode;
};

export function ItemRow({ item, mode = 'view', rightSlot }: Props) {
  const info = describirItem(item);
  const cantidad = item.cantidadConsumible ?? item.cantidadRecibida ?? null;

  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-tx truncate">{info.titulo}</div>
        <div className="text-xs text-tx-3 flex items-center gap-2 mt-0.5">
          <span className="uppercase tracking-wide font-medium">{info.tipo}</span>
          {info.codigo && <span className="font-mono">· {info.codigo}</span>}
          {cantidad !== null && <span>· cant. {cantidad}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {mode === 'view' && (
          <>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-2xs text-tx-3 uppercase tracking-wide">Salida</span>
              <CondicionBadge condicion={item.condicionSalida} />
            </div>
          </>
        )}
        {rightSlot}
      </div>
    </div>
  );
}

export { describirItem };
```

- [ ] **Step 2: Verificar TypeScript**

Run: `pnpm tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add components/actas-recepciones/ItemRow.tsx
git commit -m "feat(actas): ItemRow polimórfico para los 4 tipos de ítem"
```

---

### Task C4: `<SelectorFactura />`

**Files:**
- Create: `components/actas-recepciones/SelectorFactura.tsx`

- [ ] **Step 1: Inspeccionar el hook de facturas existente**

Run: `grep -n "useFacturas\|FacturaListItem" /Users/joaquinmorales13a06/Desktop/Reinar/frontend/hooks/use-facturas.ts | head -10`
Expected: confirmar que `useFacturas(params)` existe y devuelve `PaginatedResponse<FacturaListItem>`.

- [ ] **Step 2: Crear el componente**

```tsx
'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useFacturas } from '@/hooks/use-facturas';
import type { FacturaListItem } from '@/types/api';

// Typeahead minimalista sin dropdown library: usamos useFacturas con `busqueda`
// y mostramos los primeros 8 resultados debajo del input. Los filtros backend
// ya excluyen anuladas; el caller decide si filtra adicionalmente por estado DTE.
type Props = {
  // Filtro post-fetch sobre las facturas devueltas por la API.
  filter?: (f: FacturaListItem) => boolean;
  emptyMessage?: string;
  placeholder?: string;
  onSelect: (f: FacturaListItem) => void;
};

const inputBase =
  'w-full pl-10 pr-3 py-2 text-sm rounded-md border border-bd bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';

export function SelectorFactura({ filter, emptyMessage, placeholder, onSelect }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [open, setOpen] = useState(false);
  const { data } = useFacturas({ busqueda: busqueda || undefined, limit: 20 });
  const todas = data?.data ?? [];
  const filtradas = (filter ? todas.filter(filter) : todas).slice(0, 8);

  return (
    <div className="relative">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-3 pointer-events-none">
          <Icon name="search" size={14} />
        </span>
        <input
          type="text"
          className={inputBase}
          value={busqueda}
          placeholder={placeholder ?? 'Buscar por número o cliente…'}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setBusqueda(e.target.value); setOpen(true); }}
        />
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-10 rounded-md border border-bd bg-surface shadow-lg max-h-72 overflow-auto">
          {filtradas.length === 0 ? (
            <div className="px-3 py-3 text-xs text-tx-3">{emptyMessage ?? 'Sin resultados.'}</div>
          ) : (
            filtradas.map((f) => (
              <button
                key={f.id}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-bg-sunken transition-colors border-b border-bd last:border-b-0"
                onClick={() => { onSelect(f); setBusqueda(''); setOpen(false); }}
              >
                <div className="flex justify-between gap-3">
                  <span className="text-sm font-medium font-mono">{f.numeroFactura}</span>
                  <span className="text-xs text-tx-3 truncate">{f.cliente?.razonSocial}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar TypeScript**

Run: `pnpm tsc --noEmit`
Expected: 0 errores. Si hay error sobre `f.cliente?.razonSocial`, ajustar al shape real de `FacturaListItem` (revisar `types/api.ts`).

- [ ] **Step 4: Commit**

```bash
git add components/actas-recepciones/SelectorFactura.tsx
git commit -m "feat(actas): SelectorFactura típeahead reusable"
```

---

## Fase D — Páginas de Actas

### Task D1: Listado `/actas`

**Files:**
- Create: `app/(dashboard)/actas/page.tsx`
- Create: `components/actas/ActaTablaListado.tsx`

- [ ] **Step 1: Crear `ActaTablaListado.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/utils';
import type { ActaListItem } from '@/types/api';

export function ActaTablaListado({ actas }: { actas: ActaListItem[] }) {
  if (actas.length === 0) {
    return <EmptyState icon="clipboard" title="Sin actas" message="No se encontraron actas con los filtros aplicados." />;
  }
  return (
    <div className="overflow-x-auto rounded-md border border-bd">
      <table className="w-full text-sm">
        <thead className="bg-bg-sunken text-tx-2 text-xs">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Número</th>
            <th className="text-left px-3 py-2 font-medium">Factura</th>
            <th className="text-left px-3 py-2 font-medium">Cliente</th>
            <th className="text-left px-3 py-2 font-medium">Bodega</th>
            <th className="text-left px-3 py-2 font-medium">Estado</th>
            <th className="text-left px-3 py-2 font-medium">Despacho</th>
            <th className="text-left px-3 py-2 font-medium">Entrega</th>
          </tr>
        </thead>
        <tbody>
          {actas.map((a) => (
            <tr key={a.id} className="border-t border-bd hover:bg-bg-sunken transition-colors">
              <td className="px-3 py-2">
                <Link href={`/actas/${a.id}`} className="font-mono font-medium text-tx hover:text-accent">
                  {a.numeroActa}
                </Link>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-tx-2">{a.factura.numeroFactura}</td>
              <td className="px-3 py-2 truncate max-w-xs">{a.factura.cliente.razonSocial}</td>
              <td className="px-3 py-2 text-xs text-tx-2">{a.bodegaOrigen.nombre}</td>
              <td className="px-3 py-2"><Badge status={a.estado} /></td>
              <td className="px-3 py-2 font-mono text-xs text-tx-2">{a.fechaDespacho ? formatDate(a.fechaDespacho) : '—'}</td>
              <td className="px-3 py-2 font-mono text-xs text-tx-2">{a.fechaEntrega ? formatDate(a.fechaEntrega) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Crear `app/(dashboard)/actas/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { Icon } from '@/components/ui/Icon';
import { ActaTablaListado } from '@/components/actas/ActaTablaListado';
import { useActas } from '@/hooks/use-actas';
import { useActasRealtime } from '@/hooks/use-actas-realtime';
import { useAuthStore } from '@/stores/auth.store';
import type { EstadoActa } from '@/types/api';

const ESTADOS: EstadoActa[] = ['PENDIENTE', 'DESPACHADO', 'ENTREGADO', 'DEVUELTA_PARCIAL', 'DEVUELTO'];

export default function ActasPage() {
  useActasRealtime();
  const user = useAuthStore((s) => s.user);
  const puedeEscribir = user && user.rol !== 'VISUALIZADOR';

  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState<EstadoActa | null>(null);
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useActas({
    busqueda: search || undefined,
    estado: estado ?? undefined,
    page,
    limit,
  });

  const total = data?.meta?.total ?? 0;
  const enCurso = (data?.data ?? []).filter(a => a.estado === 'PENDIENTE' || a.estado === 'DESPACHADO').length;

  return (
    <div>
      <PageHeader
        title="Actas de Entrega"
        subtitle={isLoading ? 'Cargando…' : `${total} actas · ${enCurso} en curso`}
        actions={puedeEscribir ? (
          <Link href="/actas/nueva" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors">
            <Icon name="plus" size={14} /> Nueva acta
          </Link>
        ) : null}
      />
      <FilterBar
        search={search}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        placeholder="Buscar por número, factura, cliente…"
        chips={ESTADOS.map(e => ({
          label: e,
          active: estado === e,
          onToggle: () => { setEstado(estado === e ? null : e); setPage(1); },
        }))}
        onClear={() => { setSearch(''); setEstado(null); setPage(1); }}
      />
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <>
          <ActaTablaListado actas={data?.data ?? []} />
          {total > limit && (
            <div className="mt-4">
              <Pagination page={page} total={total} limit={limit} onPageChange={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar TypeScript y dev server**

Run: `pnpm tsc --noEmit`
Expected: 0 errores.

Run: `pnpm dev` (en background) y abrir `http://localhost:3001/actas`.
Expected: listado carga con datos. Filtros aplican. Click en una fila navega a `/actas/[id]` (404 esperado en este punto — la página aún no existe).

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/actas/page.tsx components/actas/ActaTablaListado.tsx
git commit -m "feat(actas): página listado /actas con filtros y paginación"
```

---

### Task D2: Detalle `/actas/[id]`

**Files:**
- Create: `app/(dashboard)/actas/[id]/page.tsx`
- Create: `components/actas/ActaPanelAccionContextual.tsx`

- [ ] **Step 1: Crear `ActaPanelAccionContextual.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useDescargarPickingPdf } from '@/hooks/use-actas';
import { useAuthStore } from '@/stores/auth.store';
import type { Acta } from '@/types/api';

// Panel de acción contextual que cambia según el estado del acta. Replica el
// diseño del prototipo (actas.jsx) usando tokens de Tailwind del proyecto.
export function ActaPanelAccionContextual({ acta, onIrRecepcion }: { acta: Acta; onIrRecepcion?: () => void }) {
  const user = useAuthStore((s) => s.user);
  const puedeEscribir = user && user.rol !== 'VISUALIZADOR';
  const picking = useDescargarPickingPdf();

  if (acta.estado === 'PENDIENTE') {
    return (
      <div className="rounded-md border border-info-soft bg-info-soft/40 border-l-4 border-l-info p-4 mb-4">
        <div className="flex items-start gap-3">
          <Icon name="truck" size={20} />
          <div className="flex-1">
            <div className="text-sm text-tx">El acta está creada y pendiente de ser despachada desde bodega.</div>
            {puedeEscribir && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/actas/${acta.id}/despacho`} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors">
                  <Icon name="truck" size={14} /> Registrar despacho
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (acta.estado === 'DESPACHADO') {
    return (
      <div className="rounded-md border border-accent-soft bg-accent-soft/40 border-l-4 border-l-accent p-4 mb-4">
        <div className="flex items-start gap-3">
          <Icon name="package" size={20} />
          <div className="flex-1">
            <div className="text-sm text-tx">El equipo salió de bodega. Pendiente confirmar entrega en sitio.</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {puedeEscribir && (
                <Link href={`/actas/${acta.id}/entrega`} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors">
                  <Icon name="check" size={14} /> Confirmar entrega al cliente
                </Link>
              )}
              <button
                type="button"
                disabled={picking.isLoading}
                onClick={() => picking.descargar(acta.id, acta.numeroActa)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd bg-surface text-tx text-xs font-semibold hover:bg-bg-sunken transition-colors disabled:opacity-60"
              >
                <Icon name="clipboard" size={14} /> {picking.isLoading ? 'Generando…' : 'Lista de picking'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (acta.estado === 'ENTREGADO' || acta.estado === 'DEVUELTA_PARCIAL') {
    return (
      <div className="rounded-md border border-ok-soft bg-ok-soft/40 border-l-4 border-l-ok p-4 mb-4">
        <div className="flex items-start gap-3">
          <Icon name="check" size={20} />
          <div className="flex-1">
            <div className="text-sm text-tx">
              {acta.estado === 'ENTREGADO'
                ? 'El equipo fue entregado. Pendiente de devolución por parte del cliente.'
                : 'Devolución parcial. Quedan ítems pendientes de retorno.'}
            </div>
            {puedeEscribir && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/recepciones/nueva?facturaId=${acta.facturaId}&actaId=${acta.id}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors"
                  onClick={onIrRecepcion}
                >
                  <Icon name="package" size={14} /> Registrar devolución
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // DEVUELTO
  return (
    <div className="rounded-md border border-bd bg-bg-sunken border-l-4 border-l-tx-3 p-4 mb-4">
      <div className="flex items-start gap-3">
        <Icon name="check" size={20} />
        <div className="text-sm text-tx-2">Ciclo completado. El equipo fue devuelto y recibido.</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crear `app/(dashboard)/actas/[id]/page.tsx`**

```tsx
'use client';

import { use } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { EstadoActaTimeline } from '@/components/actas-recepciones/EstadoActaTimeline';
import { ItemRow } from '@/components/actas-recepciones/ItemRow';
import { CondicionBadge } from '@/components/actas-recepciones/CondicionBadge';
import { ActaPanelAccionContextual } from '@/components/actas/ActaPanelAccionContextual';
import { useActa, useDescargarActaPdf } from '@/hooks/use-actas';
import { useActasRealtime } from '@/hooks/use-actas-realtime';
import { formatDate } from '@/lib/utils';

export default function ActaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  useActasRealtime();
  const { data: acta, isLoading } = useActa(id);
  const pdf = useDescargarActaPdf();

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }
  if (!acta) {
    return <EmptyState icon="clipboard" title="Acta no encontrada" message="La acta no existe o fue eliminada." />;
  }

  return (
    <div>
      <PageHeader
        title={acta.numeroActa}
        subtitle={<><Badge status={acta.estado} /></>}
        back
        actions={
          <button
            type="button"
            disabled={pdf.isLoading}
            onClick={() => pdf.descargar(acta.id, acta.numeroActa)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd bg-surface text-tx text-xs font-semibold hover:bg-bg-sunken transition-colors disabled:opacity-60"
          >
            <Icon name="download" size={14} /> {pdf.isLoading ? 'Generando…' : 'Descargar PDF'}
          </button>
        }
      />

      <EstadoActaTimeline estado={acta.estado} fechas={{ fechaDespacho: acta.fechaDespacho, fechaEntrega: acta.fechaEntrega, fechaDevolucion: acta.fechaDevolucion }} />

      <ActaPanelAccionContextual acta={acta} />

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-bd bg-surface p-4">
          <h3 className="text-sm font-semibold text-tx mb-3">Ítems del acta ({acta.items.length})</h3>
          <div className="divide-y divide-bd">
            {acta.items.map((it) => (
              <ItemRow
                key={it.id}
                item={it}
                rightSlot={
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-2xs text-tx-3 uppercase tracking-wide">Salida</span>
                    <CondicionBadge condicion={it.condicionSalida} />
                  </div>
                }
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-bd bg-surface p-4">
            <h3 className="text-sm font-semibold text-tx mb-3">Datos generales</h3>
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between gap-2"><dt className="text-tx-3">Factura</dt><dd><Link href={`/facturas/${acta.factura.id}`} className="font-mono text-accent hover:underline">{acta.factura.numeroFactura}</Link></dd></div>
              <div className="flex justify-between gap-2"><dt className="text-tx-3">Bodega origen</dt><dd>{acta.bodegaOrigen.nombre}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-tx-3">Dirección entrega</dt><dd className="truncate max-w-xs text-right">{acta.direccionEntrega || '—'}</dd></div>
              {(acta.periodoRentaInicio || acta.periodoRentaFin) && (
                <div className="flex justify-between gap-2"><dt className="text-tx-3">Período renta</dt><dd className="font-mono text-xs">{acta.periodoRentaInicio ? formatDate(acta.periodoRentaInicio) : '—'} — {acta.periodoRentaFin ? formatDate(acta.periodoRentaFin) : '—'}</dd></div>
              )}
            </dl>
          </div>
          <div className="rounded-lg border border-bd bg-surface p-4">
            <h3 className="text-sm font-semibold text-tx mb-3">Receptor</h3>
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between gap-2"><dt className="text-tx-3">Nombre</dt><dd>{acta.receptorNombre || '—'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-tx-3">Documento</dt><dd className="font-mono">{acta.receptorDocumento || '—'}</dd></div>
            </dl>
          </div>
          <div className="rounded-lg border border-bd bg-surface p-4">
            <h3 className="text-sm font-semibold text-tx mb-3">Fechas</h3>
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between gap-2"><dt className="text-tx-3">Despacho</dt><dd className="font-mono text-xs">{acta.fechaDespacho ? formatDate(acta.fechaDespacho) : '—'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-tx-3">Entrega</dt><dd className="font-mono text-xs">{acta.fechaEntrega ? formatDate(acta.fechaEntrega) : '—'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-tx-3">Devolución</dt><dd className="font-mono text-xs">{acta.fechaDevolucion ? formatDate(acta.fechaDevolucion) : '—'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-tx-3">Despachado por</dt><dd>{acta.usuarioDespacho ? `${acta.usuarioDespacho.nombre} ${acta.usuarioDespacho.apellido}` : '—'}</dd></div>
            </dl>
          </div>
          {acta.notas && (
            <div className="rounded-lg border border-bd bg-surface p-4">
              <h3 className="text-sm font-semibold text-tx mb-2">Notas</h3>
              <p className="text-sm text-tx-2 whitespace-pre-line">{acta.notas}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar TypeScript y vista**

Run: `pnpm tsc --noEmit`
Expected: 0 errores.

Manual: abrir `/actas/[id]` con un id real. Debe mostrar timeline, panel contextual según estado, ítems y datos.

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/actas/[id]/page.tsx components/actas/ActaPanelAccionContextual.tsx
git commit -m "feat(actas): página detalle /actas/[id] con timeline y panel contextual"
```

---

### Task D3: Crear acta `/actas/nueva`

**Files:**
- Create: `app/(dashboard)/actas/nueva/page.tsx`

- [ ] **Step 1: Inspeccionar bodegas hook y cotizacion para período**

Run: `grep -n "useBodegas\|useCotizacion\b" /Users/joaquinmorales13a06/Desktop/Reinar/frontend/hooks/use-bodegas.ts /Users/joaquinmorales13a06/Desktop/Reinar/frontend/hooks/use-cotizaciones.ts | head -10`
Expected: confirmar nombres exactos de los hooks y campos `periodoInicio/Fin` o equivalentes en la cotización.

Si la cotización no expone período, omitir el pre-llenado (el campo del form queda en blanco — el usuario lo llena manualmente). Documentar en comentario "why".

- [ ] **Step 2: Crear la página**

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { SelectorFactura } from '@/components/actas-recepciones/SelectorFactura';
import { CondicionSelect } from '@/components/actas-recepciones/CondicionSelect';
import { ItemRow } from '@/components/actas-recepciones/ItemRow';
import { useBodegas } from '@/hooks/use-bodegas';
import { useFactura } from '@/hooks/use-facturas';
import { useItemsDisponiblesDespacho, useCrearActa } from '@/hooks/use-actas';
import { crearActaFormSchema, type CrearActaForm } from '@/lib/schemas/acta';
import type { ActaItem, CrearActaDto, CondicionItem, FacturaListItem } from '@/types/api';

const inputBase = 'w-full px-3 py-2 text-sm rounded-md border border-bd bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';

type RowState = ActaItem & { incluido: boolean; condicionSalidaEdit: CondicionItem; observacionesSalidaEdit: string };

export default function NuevaActaPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const facturaIdInicial = sp.get('facturaId') ?? '';

  const { data: bodegasData } = useBodegas();
  // Solo bodegas principales pueden despachar (sin parentId).
  const bodegasPrincipales = (bodegasData?.data ?? []).filter((b: { id: string; nombre: string; parentId: string | null; activa: boolean }) => b.activa && b.parentId === null);

  const [facturaSeleccionada, setFacturaSeleccionada] = useState<{ id: string; numeroFactura: string; cliente: { razonSocial: string } } | null>(null);
  const { data: facturaCompleta } = useFactura(facturaSeleccionada?.id ?? null);
  const { data: itemsDisp, isLoading: itemsLoading } = useItemsDisponiblesDespacho(facturaSeleccionada?.id ?? null);
  const [rows, setRows] = useState<RowState[]>([]);

  const form = useForm<CrearActaForm>({
    resolver: zodResolver(crearActaFormSchema),
    defaultValues: {
      facturaId: facturaIdInicial,
      bodegaOrigenId: '',
      direccionEntrega: '',
      notas: '',
      observacionesSalida: '',
      periodoRentaInicio: '',
      periodoRentaFin: '',
      items: [],
    },
  });

  // Pre-llenar facturaId desde query string si llegamos con ?facturaId=
  useEffect(() => {
    if (facturaIdInicial && !facturaSeleccionada) {
      // Buscar la factura por id requeriría otra query; en su lugar dejamos que el typeahead la elija.
      // Si querés autoselección, integrar useFactura(facturaIdInicial) y setFacturaSeleccionada cuando llegue.
      form.setValue('facturaId', facturaIdInicial);
    }
  }, [facturaIdInicial, facturaSeleccionada, form]);

  // Cargar items al cambiar de factura
  useEffect(() => {
    if (!itemsDisp) return;
    const initial: RowState[] = itemsDisp.map((it) => ({
      ...it,
      incluido: true,
      condicionSalidaEdit: 'BUENO',
      observacionesSalidaEdit: '',
    }));
    setRows(initial);
  }, [itemsDisp]);

  // Pre-llenar período renta desde cotización si la factura lo expone.
  // El campo exacto depende del shape de Factura — ajustar si difiere.
  useEffect(() => {
    if (!facturaCompleta) return;
    // Defensivo: solo accedemos a campos opcionales si existen.
    const cot = (facturaCompleta as unknown as { cotizacion?: { periodoInicio?: string | null; periodoFin?: string | null } }).cotizacion;
    if (cot?.periodoInicio) form.setValue('periodoRentaInicio', cot.periodoInicio);
    if (cot?.periodoFin) form.setValue('periodoRentaFin', cot.periodoFin);
  }, [facturaCompleta, form]);

  const crear = useCrearActa();

  const onSubmit = form.handleSubmit(async (data) => {
    if (!facturaSeleccionada) return;
    const items: CrearActaDto['items'] = rows.filter(r => r.incluido).map(r => {
      const baseTipo: Partial<CrearActaDto['items'][number]> = {};
      if (r.equipo) baseTipo.equipoId = r.equipo.id;
      else if (r.herramientaUnidad) baseTipo.herramientaUnidadId = r.herramientaUnidad.id;
      else if (r.consumible) {
        baseTipo.consumibleId = r.consumible.id;
        baseTipo.cantidadConsumible = r.cantidadConsumible ?? 1;
      } else if (r.piezaTipo) {
        baseTipo.piezaTipoId = r.piezaTipo.id;
        baseTipo.cantidadRecibida = r.cantidadRecibida ?? 1;
      }
      return {
        cotizacionItemId: r.cotizacionItemId,
        ...baseTipo,
        condicionSalida: r.condicionSalidaEdit,
        observacionesSalida: r.observacionesSalidaEdit || undefined,
      } as CrearActaDto['items'][number];
    });

    const dto: CrearActaDto = {
      bodegaOrigenId: data.bodegaOrigenId,
      direccionEntrega: data.direccionEntrega || undefined,
      notas: data.notas || undefined,
      observacionesSalida: data.observacionesSalida || undefined,
      periodoRentaInicio: data.periodoRentaInicio ? new Date(data.periodoRentaInicio).toISOString() : undefined,
      periodoRentaFin: data.periodoRentaFin ? new Date(data.periodoRentaFin).toISOString() : undefined,
      items,
    };

    try {
      const acta = await crear.mutateAsync({ facturaId: facturaSeleccionada.id, data: dto });
      router.push(`/actas/${acta.id}`);
    } catch {
      // hook ya mostró el toast
    }
  });

  const itemsIncluidos = rows.filter(r => r.incluido).length;

  return (
    <form onSubmit={onSubmit}>
      <PageHeader title="Nueva acta de entrega" subtitle="Generá un acta para despachar equipos a una factura." back />

      <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
        <h3 className="text-sm font-semibold text-tx mb-3">Factura origen</h3>
        {!facturaSeleccionada ? (
          <div>
            <label className={labelCls}>Buscar factura aprobada <span className="text-danger">*</span></label>
            <SelectorFactura
              filter={(f) => (f as FacturaListItem & { estadoDte?: string }).estadoDte !== 'ANULADO'}
              placeholder="Buscar por número o cliente…"
              emptyMessage="Sin facturas elegibles."
              onSelect={(f) => {
                setFacturaSeleccionada({ id: f.id, numeroFactura: f.numeroFactura, cliente: { razonSocial: (f as FacturaListItem & { cliente?: { razonSocial: string } }).cliente?.razonSocial ?? '—' } });
                form.setValue('facturaId', f.id);
              }}
            />
            {form.formState.errors.facturaId && <div className="text-xs text-danger mt-1">{form.formState.errors.facturaId.message}</div>}
          </div>
        ) : (
          <div className="flex justify-between items-start gap-3 p-3 bg-bg-sunken rounded">
            <div>
              <div className="text-sm font-mono font-semibold">{facturaSeleccionada.numeroFactura}</div>
              <div className="text-xs text-tx-2">{facturaSeleccionada.cliente.razonSocial}</div>
            </div>
            <button type="button" onClick={() => { setFacturaSeleccionada(null); setRows([]); form.setValue('facturaId', ''); }} className="text-xs text-tx-3 hover:text-tx">
              <Icon name="x" size={12} /> Cambiar
            </button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
        <h3 className="text-sm font-semibold text-tx mb-3">Logística</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Bodega de origen <span className="text-danger">*</span></label>
            <Controller
              control={form.control}
              name="bodegaOrigenId"
              render={({ field }) => (
                <select {...field} className={inputBase}>
                  <option value="">— Seleccioná —</option>
                  {bodegasPrincipales.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                </select>
              )}
            />
            {form.formState.errors.bodegaOrigenId && <div className="text-xs text-danger mt-1">{form.formState.errors.bodegaOrigenId.message}</div>}
          </div>
          <div>
            <label className={labelCls}>Dirección de entrega</label>
            <input {...form.register('direccionEntrega')} className={inputBase} placeholder="Calle, colonia, número, referencia" />
          </div>
          <div>
            <label className={labelCls}>Período renta — inicio</label>
            <input type="date" {...form.register('periodoRentaInicio')} className={`${inputBase} font-mono`} />
          </div>
          <div>
            <label className={labelCls}>Período renta — fin</label>
            <input type="date" {...form.register('periodoRentaFin')} className={`${inputBase} font-mono`} />
            {form.formState.errors.periodoRentaFin && <div className="text-xs text-danger mt-1">{form.formState.errors.periodoRentaFin.message}</div>}
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Observaciones de salida</label>
            <textarea {...form.register('observacionesSalida')} rows={2} className={inputBase} placeholder="Condiciones del despacho, transporte, etc." />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-tx">Ítems a despachar</h3>
          <span className="text-xs text-tx-3">{itemsIncluidos} de {rows.length} seleccionados</span>
        </div>
        {!facturaSeleccionada ? (
          <EmptyState icon="package" title="Sin ítems" message="Seleccioná una factura para cargar sus ítems." />
        ) : itemsLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : rows.length === 0 ? (
          <EmptyState icon="package" title="Sin ítems disponibles" message="Todos los ítems de esta factura ya están en campo." />
        ) : (
          <div className="divide-y divide-bd">
            {rows.map((r, idx) => (
              <div key={r.id} className={`py-2 ${r.incluido ? '' : 'opacity-50'}`}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1.5"
                    checked={r.incluido}
                    onChange={(e) => setRows(prev => prev.map((row, i) => i === idx ? { ...row, incluido: e.target.checked } : row))}
                  />
                  <div className="flex-1 min-w-0">
                    <ItemRow item={r} mode="compact" />
                    <div className="grid sm:grid-cols-3 gap-2 mt-2">
                      <div>
                        <label className={labelCls}>Cond. salida</label>
                        <CondicionSelect
                          value={r.condicionSalidaEdit}
                          disabled={!r.incluido}
                          onChange={(v) => setRows(prev => prev.map((row, i) => i === idx ? { ...row, condicionSalidaEdit: v } : row))}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelCls}>Observaciones</label>
                        <input
                          className={inputBase}
                          disabled={!r.incluido}
                          value={r.observacionesSalidaEdit}
                          onChange={(e) => setRows(prev => prev.map((row, i) => i === idx ? { ...row, observacionesSalidaEdit: e.target.value } : row))}
                          placeholder="Observaciones para este ítem"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {form.formState.errors.items && <div className="text-xs text-danger mt-2">{form.formState.errors.items.message}</div>}
      </div>

      <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
        <h3 className="text-sm font-semibold text-tx mb-2">Notas generales</h3>
        <textarea {...form.register('notas')} rows={3} className={inputBase} placeholder="Información adicional sobre este despacho." />
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => router.back()} className="px-3 py-1.5 text-sm rounded-md border border-bd text-tx hover:bg-bg-sunken transition-colors">Cancelar</button>
        <button
          type="submit"
          disabled={crear.isPending || itemsIncluidos === 0}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60"
        >
          <Icon name="check" size={14} /> {crear.isPending ? 'Creando…' : 'Crear acta en estado PENDIENTE'}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Verificar TypeScript**

Run: `pnpm tsc --noEmit`
Expected: 0 errores. Si hay desfase de tipos en `FacturaListItem.cliente.razonSocial` o `estadoDte`, ajustar el filtro y los campos al shape real.

- [ ] **Step 4: Smoke test manual**

Abrir `/actas/nueva`. Buscar factura, seleccionar bodega, marcar ítems, submit. Verificar que el acta se cree y navegue al detalle.

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/actas/nueva/page.tsx
git commit -m "feat(actas): página /actas/nueva con typeahead de factura y items polimórficos"
```

---

### Task D4: Despacho `/actas/[id]/despacho`

**Files:**
- Create: `app/(dashboard)/actas/[id]/despacho/page.tsx`

- [ ] **Step 1: Crear la página**

```tsx
'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { useActa, useCambiarEstadoActa } from '@/hooks/use-actas';
import { useAuthStore } from '@/stores/auth.store';
import { despachoFormSchema, type DespachoForm } from '@/lib/schemas/acta';

const inputBase = 'w-full px-3 py-2 text-sm rounded-md border border-bd bg-surface text-tx focus:outline-none focus:border-accent transition-colors';
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';

export default function DespachoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: acta, isLoading } = useActa(id);
  const cambiar = useCambiarEstadoActa();
  const form = useForm<DespachoForm>({ resolver: zodResolver(despachoFormSchema), defaultValues: { observacionesSalida: '' } });

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (!acta) return <EmptyState icon="clipboard" title="Acta no encontrada" />;
  if (acta.estado !== 'PENDIENTE') {
    return (
      <div>
        <PageHeader title={`Despacho — ${acta.numeroActa}`} back />
        <EmptyState
          icon="clipboard"
          title="No aplica"
          message={`Esta acta está en estado ${acta.estado}. Solo se puede despachar un acta PENDIENTE.`}
        />
      </div>
    );
  }
  if (!user) return null;

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await cambiar.mutateAsync({
        id,
        data: {
          estado: 'DESPACHADO',
          // Auto-asigna al usuario actual: quien registra el despacho es quien lo hace.
          // Si en el futuro se requiere registrar a nombre de otro, agregar selector + endpoint server.
          usuarioDespachoId: user.id,
          observacionesSalida: data.observacionesSalida || undefined,
        },
      });
      router.push(`/actas/${id}`);
    } catch {
      // hook ya toasteó el error
    }
  });

  return (
    <form onSubmit={onSubmit}>
      <PageHeader
        title="Registrar despacho"
        subtitle={<><span className="font-mono">{acta.numeroActa}</span> · <Badge status={acta.estado} /></>}
        back
      />

      <div className="rounded-md border border-info-soft bg-info-soft/40 border-l-4 border-l-info p-4 mb-4 text-sm text-tx">
        Al confirmar, el acta pasará a estado <b>DESPACHADO</b> y se registrará la fecha actual de despacho.
      </div>

      <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
        <div className="mb-3">
          <span className={labelCls}>Despachado por</span>
          <div className="text-sm text-tx font-medium">{user.nombre} {user.apellido ?? ''}</div>
          <div className="text-xs text-tx-3 mt-0.5">Se asigna automáticamente al usuario actual.</div>
        </div>
        <div>
          <label className={labelCls}>Observaciones de salida</label>
          <textarea {...form.register('observacionesSalida')} rows={3} className={inputBase} placeholder="Condiciones del despacho, transporte, etc." />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => router.push(`/actas/${id}`)} className="px-3 py-1.5 text-sm rounded-md border border-bd text-tx hover:bg-bg-sunken transition-colors">Cancelar</button>
        <button type="submit" disabled={cambiar.isPending} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60">
          <Icon name="truck" size={14} /> {cambiar.isPending ? 'Registrando…' : 'Confirmar despacho'}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `pnpm tsc --noEmit`
Expected: 0 errores. Si `user.apellido` no existe en el shape, ajustar a `user.nombre` solo.

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/actas/[id]/despacho/page.tsx
git commit -m "feat(actas): página /actas/[id]/despacho con auto-asignación de usuario"
```

---

### Task D5: Entrega `/actas/[id]/entrega`

**Files:**
- Create: `app/(dashboard)/actas/[id]/entrega/page.tsx`

- [ ] **Step 1: Crear la página**

```tsx
'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { useActa, useCambiarEstadoActa } from '@/hooks/use-actas';
import { useContactos } from '@/hooks/use-contactos';
import { entregaFormSchema, type EntregaForm } from '@/lib/schemas/acta';

const inputBase = 'w-full px-3 py-2 text-sm rounded-md border border-bd bg-surface text-tx focus:outline-none focus:border-accent transition-colors';
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';

export default function EntregaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: acta, isLoading } = useActa(id);
  const cambiar = useCambiarEstadoActa();

  const form = useForm<EntregaForm>({
    resolver: zodResolver(entregaFormSchema),
    defaultValues: { contactoReceptorId: '', receptorNombre: '', receptorDocumento: '', horaEntrega: '' },
  });

  const clienteId = acta?.factura.clienteId ?? null;
  const { data: contactosData } = useContactos(clienteId ? { clienteId } : undefined);
  const contactos = contactosData?.data ?? [];

  // Cuando el usuario elige un contacto, autocompletamos nombre/documento.
  const contactoId = form.watch('contactoReceptorId');
  useEffect(() => {
    if (!contactoId) return;
    const c = contactos.find((x) => x.id === contactoId);
    if (c) {
      const nombre = `${c.nombre ?? ''} ${(c as { apellido?: string }).apellido ?? ''}`.trim();
      form.setValue('receptorNombre', nombre);
      form.setValue('receptorDocumento', (c as { dui?: string }).dui ?? '');
    }
  }, [contactoId, contactos, form]);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (!acta) return <EmptyState icon="clipboard" title="Acta no encontrada" />;
  if (acta.estado !== 'DESPACHADO') {
    return (
      <div>
        <PageHeader title={`Entrega — ${acta.numeroActa}`} back />
        <EmptyState icon="clipboard" title="No aplica" message={`Esta acta está en estado ${acta.estado}. Solo se puede confirmar entrega desde estado DESPACHADO.`} />
      </div>
    );
  }

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await cambiar.mutateAsync({
        id,
        data: {
          estado: 'ENTREGADO',
          contactoReceptorId: data.contactoReceptorId || undefined,
          receptorNombre: data.receptorNombre || undefined,
          receptorDocumento: data.receptorDocumento || undefined,
          horaEntrega: data.horaEntrega || undefined,
        },
      });
      router.push(`/actas/${id}`);
    } catch {
      // hook ya toasteó
    }
  });

  return (
    <form onSubmit={onSubmit}>
      <PageHeader
        title="Confirmar entrega al receptor"
        subtitle={<><span className="font-mono">{acta.numeroActa}</span> · <Badge status={acta.estado} /></>}
        back
      />

      <div className="rounded-md border border-ok-soft bg-ok-soft/40 border-l-4 border-l-ok p-4 mb-4 text-sm text-tx">
        Al confirmar, el acta pasará a estado <b>ENTREGADO</b>. Registrá quién recibió físicamente en sitio.
      </div>

      <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className={labelCls}>Contacto del cliente</label>
            <Controller
              control={form.control}
              name="contactoReceptorId"
              render={({ field }) => (
                <select {...field} className={inputBase}>
                  <option value="">— Receptor libre —</option>
                  {contactos.map((c) => <option key={c.id} value={c.id}>{c.nombre} {(c as { apellido?: string }).apellido ?? ''} {(c as { cargo?: string }).cargo ? `· ${(c as { cargo: string }).cargo}` : ''}</option>)}
                </select>
              )}
            />
          </div>
          <div>
            <label className={labelCls}>Nombre del receptor <span className="text-danger">*</span></label>
            <input {...form.register('receptorNombre')} className={inputBase} placeholder="Quien firma la entrega" />
            {form.formState.errors.receptorNombre && <div className="text-xs text-danger mt-1">{form.formState.errors.receptorNombre.message}</div>}
          </div>
          <div>
            <label className={labelCls}>Documento (DUI / otro)</label>
            <input {...form.register('receptorDocumento')} className={`${inputBase} font-mono`} placeholder="01234567-8" />
          </div>
          <div>
            <label className={labelCls}>Hora de entrega</label>
            <input type="time" {...form.register('horaEntrega')} className={`${inputBase} font-mono`} />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => router.push(`/actas/${id}`)} className="px-3 py-1.5 text-sm rounded-md border border-bd text-tx hover:bg-bg-sunken transition-colors">Cancelar</button>
        <button type="submit" disabled={cambiar.isPending} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60">
          <Icon name="check" size={14} /> {cambiar.isPending ? 'Confirmando…' : 'Confirmar entrega'}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `pnpm tsc --noEmit`
Expected: 0 errores. Ajustar los castings de `contacto.apellido`/`cargo`/`dui` si el tipo `Contacto` ya los expone.

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/actas/[id]/entrega/page.tsx
git commit -m "feat(actas): página /actas/[id]/entrega con autocompletar desde contactos"
```

---

## Fase E — Páginas de Recepciones

### Task E1: Listado `/recepciones`

**Files:**
- Create: `app/(dashboard)/recepciones/page.tsx`
- Create: `components/recepciones/RecepcionTablaListado.tsx`

- [ ] **Step 1: Crear `RecepcionTablaListado.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/utils';
import type { RecepcionListItem } from '@/types/api';

export function RecepcionTablaListado({ recepciones }: { recepciones: RecepcionListItem[] }) {
  if (recepciones.length === 0) {
    return <EmptyState icon="package" title="Sin recepciones" message="No se encontraron recepciones con los filtros aplicados." />;
  }
  return (
    <div className="overflow-x-auto rounded-md border border-bd">
      <table className="w-full text-sm">
        <thead className="bg-bg-sunken text-tx-2 text-xs">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Número</th>
            <th className="text-left px-3 py-2 font-medium">Factura</th>
            <th className="text-left px-3 py-2 font-medium">Cliente</th>
            <th className="text-left px-3 py-2 font-medium">Fecha recepción</th>
            <th className="text-left px-3 py-2 font-medium">Ítems</th>
            <th className="text-left px-3 py-2 font-medium">Recibido por</th>
          </tr>
        </thead>
        <tbody>
          {recepciones.map((r) => (
            <tr key={r.id} className="border-t border-bd hover:bg-bg-sunken transition-colors">
              <td className="px-3 py-2">
                <Link href={`/recepciones/${r.id}`} className="font-mono font-medium text-tx hover:text-accent">{r.numeroActa}</Link>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-tx-2">{r.factura.numeroFactura}</td>
              <td className="px-3 py-2 truncate max-w-xs">{r.factura.cliente.razonSocial}</td>
              <td className="px-3 py-2 font-mono text-xs">{formatDate(r.fechaRecepcion)}</td>
              <td className="px-3 py-2 text-xs">{r._count.items}</td>
              <td className="px-3 py-2 text-xs">{r.usuarioRecepcion.nombre} {r.usuarioRecepcion.apellido}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Crear `app/(dashboard)/recepciones/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { Icon } from '@/components/ui/Icon';
import { RecepcionTablaListado } from '@/components/recepciones/RecepcionTablaListado';
import { useRecepciones } from '@/hooks/use-recepciones';
import { useActasRealtime } from '@/hooks/use-actas-realtime';
import { useAuthStore } from '@/stores/auth.store';

export default function RecepcionesPage() {
  useActasRealtime();
  const user = useAuthStore((s) => s.user);
  const puedeEscribir = user && user.rol !== 'VISUALIZADOR';

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useRecepciones({
    busqueda: search || undefined,
    page,
    limit,
  });
  const total = data?.meta?.total ?? 0;

  return (
    <div>
      <PageHeader
        title="Recepciones"
        subtitle={isLoading ? 'Cargando…' : `${total} recepciones registradas`}
        actions={puedeEscribir ? (
          <Link href="/recepciones/nueva" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors">
            <Icon name="plus" size={14} /> Nueva recepción
          </Link>
        ) : null}
      />
      <FilterBar
        search={search}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        placeholder="Buscar por número, factura, cliente…"
        chips={[]}
        onClear={() => { setSearch(''); setPage(1); }}
      />
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <>
          <RecepcionTablaListado recepciones={data?.data ?? []} />
          {total > limit && (
            <div className="mt-4">
              <Pagination page={page} total={total} limit={limit} onPageChange={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar TypeScript**

Run: `pnpm tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/recepciones/page.tsx components/recepciones/RecepcionTablaListado.tsx
git commit -m "feat(actas): página listado /recepciones"
```

---

### Task E2: Wizard de recepción `/recepciones/nueva`

**Files:**
- Create: `app/(dashboard)/recepciones/nueva/page.tsx`

- [ ] **Step 1: Crear la página**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { SelectorFactura } from '@/components/actas-recepciones/SelectorFactura';
import { CondicionSelect } from '@/components/actas-recepciones/CondicionSelect';
import { CondicionBadge } from '@/components/actas-recepciones/CondicionBadge';
import { ItemRow, describirItem } from '@/components/actas-recepciones/ItemRow';
import { useItemsPendientesDevolucion, useCrearRecepcion } from '@/hooks/use-recepciones';
import { crearRecepcionFormSchema, type CrearRecepcionForm } from '@/lib/schemas/recepcion';
import type { ActaItem, CondicionItem, CrearRecepcionDto, FacturaListItem } from '@/types/api';

const COND_RANK: Record<CondicionItem, number> = { BUENO: 1, REGULAR: 2, MALO: 3 };
const inputBase = 'w-full px-3 py-2 text-sm rounded-md border border-bd bg-surface text-tx focus:outline-none focus:border-accent transition-colors';
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';

type RowState = {
  actaEntregaItemId: string;
  actaEntregaId: string;
  numeroActa: string;
  item: ActaItem;
  incluido: boolean;
  condicionRetorno: CondicionItem;
  observacionesRetorno: string;
  horometroRetorno: string;
  combustibleRetorno: string;
};

export default function NuevaRecepcionPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const facturaIdInicial = sp.get('facturaId') ?? '';
  const actaIdInicial = sp.get('actaId') ?? '';

  const [step, setStep] = useState<0 | 1>(actaIdInicial ? 1 : 0);
  const [facturaSeleccionada, setFacturaSeleccionada] = useState<{ id: string; numeroFactura: string; razonSocial: string } | null>(null);
  const [rows, setRows] = useState<RowState[]>([]);

  const { data: grupos, isLoading: gruposLoading } = useItemsPendientesDevolucion(facturaSeleccionada?.id ?? null);

  const form = useForm<CrearRecepcionForm>({
    resolver: zodResolver(crearRecepcionFormSchema),
    defaultValues: {
      facturaId: facturaIdInicial,
      numeroActaFisico: '',
      horaRecepcion: '',
      observaciones: '',
      items: [],
    },
  });

  // Cargar filas al recibir grupos
  useEffect(() => {
    if (!grupos) return;
    const initial: RowState[] = grupos.flatMap((g) =>
      g.items.map((it) => ({
        actaEntregaItemId: it.id,
        actaEntregaId: g.actaEntregaId,
        numeroActa: g.numeroActa,
        item: it,
        // Si llegamos con ?actaId=, solo pre-seleccionamos los items de esa acta.
        incluido: actaIdInicial ? g.actaEntregaId === actaIdInicial : false,
        condicionRetorno: 'BUENO',
        observacionesRetorno: '',
        horometroRetorno: '',
        combustibleRetorno: '',
      })),
    );
    setRows(initial);
  }, [grupos, actaIdInicial]);

  const crear = useCrearRecepcion();

  const onSubmit = form.handleSubmit(async (data) => {
    if (!facturaSeleccionada) return;
    const itemsIncluidos = rows.filter((r) => r.incluido);
    const dto: CrearRecepcionDto = {
      numeroActaFisico: data.numeroActaFisico || undefined,
      horaRecepcion: data.horaRecepcion || undefined,
      observaciones: data.observaciones || undefined,
      items: itemsIncluidos.map((r) => ({
        actaEntregaItemId: r.actaEntregaItemId,
        condicionRetorno: r.condicionRetorno,
        observacionesRetorno: r.observacionesRetorno || undefined,
        horometroRetorno: r.horometroRetorno ? Number(r.horometroRetorno) : undefined,
        combustibleRetorno: r.combustibleRetorno || undefined,
      })),
    };
    // Sincronizar form.items con rows para que Zod valide
    form.setValue('items', rows.map((r) => ({
      actaEntregaItemId: r.actaEntregaItemId,
      incluido: r.incluido,
      condicionRetorno: r.condicionRetorno,
      observacionesRetorno: r.observacionesRetorno || undefined,
      horometroRetorno: r.horometroRetorno ? Number(r.horometroRetorno) : undefined,
      combustibleRetorno: r.combustibleRetorno || undefined,
    })));

    try {
      const recepcion = await crear.mutateAsync({ facturaId: facturaSeleccionada.id, data: dto });
      router.push(`/recepciones/${recepcion.id}`);
    } catch {
      // hook toasteó
    }
  });

  const itemsIncluidos = rows.filter((r) => r.incluido).length;
  const canAdvance = !!facturaSeleccionada && rows.length > 0 && itemsIncluidos > 0;

  return (
    <form onSubmit={onSubmit}>
      <PageHeader title="Nueva recepción" subtitle="Documentá la devolución y cerrá el ciclo de renta." back />

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6">
        {[
          { id: 0, label: 'Selección' },
          { id: 1, label: 'Inspección' },
        ].map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => step > s.id && setStep(s.id as 0 | 1)}
              className={`flex items-center gap-2 text-xs ${step === s.id ? 'opacity-100' : step > s.id ? 'opacity-100' : 'opacity-50'}`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-semibold ${step > s.id ? 'bg-ok text-white' : step === s.id ? 'bg-accent text-navy' : 'bg-bg-sunken border border-bd text-tx-3'}`}>
                {step > s.id ? <Icon name="check" size={12} /> : i + 1}
              </div>
              <span className="font-medium text-tx">{s.label}</span>
            </button>
            {i === 0 && <div className={`w-12 h-px ${step > 0 ? 'bg-ok' : 'bg-bd'}`} />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <>
          <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
            <h3 className="text-sm font-semibold text-tx mb-3">Factura</h3>
            {!facturaSeleccionada ? (
              <div>
                <label className={labelCls}>Buscar factura con actas entregadas <span className="text-danger">*</span></label>
                <SelectorFactura
                  placeholder="Buscar por número o cliente…"
                  emptyMessage="Sin facturas con devoluciones pendientes."
                  onSelect={(f: FacturaListItem) => {
                    setFacturaSeleccionada({
                      id: f.id,
                      numeroFactura: f.numeroFactura,
                      razonSocial: (f as FacturaListItem & { cliente?: { razonSocial: string } }).cliente?.razonSocial ?? '—',
                    });
                    form.setValue('facturaId', f.id);
                  }}
                />
              </div>
            ) : (
              <div className="flex justify-between items-start gap-3 p-3 bg-bg-sunken rounded">
                <div>
                  <div className="text-sm font-mono font-semibold">{facturaSeleccionada.numeroFactura}</div>
                  <div className="text-xs text-tx-2">{facturaSeleccionada.razonSocial}</div>
                </div>
                <button type="button" onClick={() => { setFacturaSeleccionada(null); setRows([]); form.setValue('facturaId', ''); }} className="text-xs text-tx-3 hover:text-tx">
                  <Icon name="x" size={12} /> Cambiar
                </button>
              </div>
            )}
          </div>

          {facturaSeleccionada && (
            <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
              <h3 className="text-sm font-semibold text-tx mb-3">Ítems pendientes de devolución</h3>
              {gruposLoading ? (
                <div className="flex justify-center py-6"><Spinner /></div>
              ) : rows.length === 0 ? (
                <EmptyState icon="package" title="Sin ítems" message="No hay ítems pendientes de devolución para esta factura." />
              ) : (
                <div className="space-y-3">
                  {Object.entries(
                    rows.reduce<Record<string, RowState[]>>((acc, r) => {
                      (acc[r.actaEntregaId] ??= []).push(r);
                      return acc;
                    }, {}),
                  ).map(([actaId, items]) => (
                    <div key={actaId} className="rounded-md border border-bd p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-mono text-tx-2">{items[0].numeroActa} · {items.length} ítems</div>
                        <button
                          type="button"
                          className="text-xs text-accent hover:underline"
                          onClick={() => setRows(prev => {
                            const todosMarcados = items.every(i => i.incluido);
                            return prev.map(r => r.actaEntregaId === actaId ? { ...r, incluido: !todosMarcados } : r);
                          })}
                        >
                          {items.every(i => i.incluido) ? 'Desmarcar todos' : 'Marcar todos'}
                        </button>
                      </div>
                      <div className="divide-y divide-bd">
                        {items.map((r) => (
                          <div key={r.actaEntregaItemId} className="py-2 flex items-start gap-3">
                            <input
                              type="checkbox"
                              className="mt-1.5"
                              checked={r.incluido}
                              onChange={(e) => setRows(prev => prev.map(x => x.actaEntregaItemId === r.actaEntregaItemId ? { ...x, incluido: e.target.checked } : x))}
                            />
                            <div className="flex-1 min-w-0">
                              <ItemRow item={r.item} mode="compact" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {facturaSeleccionada && (
            <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
              <h3 className="text-sm font-semibold text-tx mb-3">Datos de recepción</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>N° de acta físico</label>
                  <input {...form.register('numeroActaFisico')} className={`${inputBase} font-mono`} placeholder="Documento en papel (opcional)" />
                </div>
                <div>
                  <label className={labelCls}>Hora de recepción</label>
                  <input type="time" {...form.register('horaRecepcion')} className={`${inputBase} font-mono`} />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {step === 1 && (
        <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
          <h3 className="text-sm font-semibold text-tx mb-3">Inspección de ítems ({itemsIncluidos})</h3>
          {rows.filter(r => r.incluido).length === 0 ? (
            <EmptyState icon="package" title="Sin ítems marcados" message="Volvé al paso anterior y marcá al menos un ítem." />
          ) : (
            <div className="space-y-3">
              {rows.filter(r => r.incluido).map((r) => {
                const empeoro = r.item.condicionSalida && COND_RANK[r.condicionRetorno] > COND_RANK[r.item.condicionSalida];
                const esEquipo = !!r.item.equipo;
                return (
                  <div key={r.actaEntregaItemId} className={`rounded-md border p-3 ${empeoro ? 'border-warn bg-warn-soft/30' : 'border-bd bg-surface'}`}>
                    <div className="flex justify-between items-start gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{describirItem(r.item).titulo}</div>
                        <div className="text-xs text-tx-3 font-mono">{describirItem(r.item).codigo ?? ''}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xs text-tx-3 uppercase tracking-wide mb-0.5">Salida</div>
                        <CondicionBadge condicion={r.item.condicionSalida} />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-2">
                      <div>
                        <label className={labelCls}>Cond. retorno <span className="text-danger">*</span></label>
                        <CondicionSelect
                          value={r.condicionRetorno}
                          onChange={(v) => setRows(prev => prev.map(x => x.actaEntregaItemId === r.actaEntregaItemId ? { ...x, condicionRetorno: v } : x))}
                        />
                      </div>
                      {esEquipo && (
                        <>
                          <div>
                            <label className={labelCls}>Horómetro</label>
                            <input type="number" step="0.1" className={`${inputBase} font-mono`} value={r.horometroRetorno} onChange={(e) => setRows(prev => prev.map(x => x.actaEntregaItemId === r.actaEntregaItemId ? { ...x, horometroRetorno: e.target.value } : x))} />
                          </div>
                          <div>
                            <label className={labelCls}>Combustible (%)</label>
                            <input type="number" min="0" max="100" className={`${inputBase} font-mono`} value={r.combustibleRetorno} onChange={(e) => setRows(prev => prev.map(x => x.actaEntregaItemId === r.actaEntregaItemId ? { ...x, combustibleRetorno: e.target.value } : x))} />
                          </div>
                        </>
                      )}
                      <div className={esEquipo ? 'sm:col-span-3' : 'sm:col-span-2'}>
                        <label className={labelCls}>Observaciones</label>
                        <input className={inputBase} value={r.observacionesRetorno} onChange={(e) => setRows(prev => prev.map(x => x.actaEntregaItemId === r.actaEntregaItemId ? { ...x, observacionesRetorno: e.target.value } : x))} placeholder="Rayones, daños, faltantes…" />
                      </div>
                    </div>
                    {empeoro && (
                      <div className="mt-2 text-xs text-warn flex items-center gap-1.5">
                        <Icon name="alertTriangle" size={12} /> Condición peor a la salida — documentá el daño en observaciones.
                      </div>
                    )}
                  </div>
                );
              })}
              <div>
                <label className={labelCls}>Observaciones generales</label>
                <textarea {...form.register('observaciones')} rows={3} className={inputBase} placeholder="Comentario global sobre la recepción." />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => router.back()} className="px-3 py-1.5 text-sm rounded-md border border-bd text-tx hover:bg-bg-sunken transition-colors">Cancelar</button>
        {step === 1 && (
          <button type="button" onClick={() => setStep(0)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd bg-surface text-tx text-xs font-semibold hover:bg-bg-sunken transition-colors">
            <Icon name="arrowLeft" size={14} /> Volver
          </button>
        )}
        {step === 0 && (
          <button type="button" disabled={!canAdvance} onClick={() => setStep(1)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60">
            Siguiente <Icon name="arrowRight" size={14} />
          </button>
        )}
        {step === 1 && (
          <button type="submit" disabled={crear.isPending || itemsIncluidos === 0} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60">
            <Icon name="check" size={14} /> {crear.isPending ? 'Registrando…' : 'Registrar recepción'}
          </button>
        )}
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `pnpm tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Smoke test manual**

- Abrir `/recepciones/nueva` sin parámetros: arranca en paso 0, busca factura, lista grupos por acta, marca items, paso 1 captura condiciones, submit.
- Abrir `/recepciones/nueva?facturaId=X&actaId=Y` desde el detalle de un acta ENTREGADO: debe pre-seleccionar items de esa acta y arrancar en paso 1.

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/recepciones/nueva/page.tsx
git commit -m "feat(actas): wizard /recepciones/nueva con soporte multi-acta"
```

---

### Task E3: Detalle `/recepciones/[id]`

**Files:**
- Create: `app/(dashboard)/recepciones/[id]/page.tsx`

- [ ] **Step 1: Crear la página**

```tsx
'use client';

import { use } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { CondicionBadge } from '@/components/actas-recepciones/CondicionBadge';
import { describirItem } from '@/components/actas-recepciones/ItemRow';
import { useRecepcion, useDescargarRecepcionPdf } from '@/hooks/use-recepciones';
import { useActasRealtime } from '@/hooks/use-actas-realtime';
import { formatDate } from '@/lib/utils';

export default function RecepcionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  useActasRealtime();
  const { data: recepcion, isLoading } = useRecepcion(id);
  const pdf = useDescargarRecepcionPdf();

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (!recepcion) return <EmptyState icon="package" title="Recepción no encontrada" />;

  return (
    <div>
      <PageHeader
        title={recepcion.numeroActa}
        subtitle={<>Recepción de <Link href={`/facturas/${recepcion.factura.id}`} className="font-mono text-accent hover:underline">{recepcion.factura.numeroFactura}</Link></>}
        back
        actions={
          <button
            type="button"
            disabled={pdf.isLoading}
            onClick={() => pdf.descargar(recepcion.id, recepcion.numeroActa)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd bg-surface text-tx text-xs font-semibold hover:bg-bg-sunken transition-colors disabled:opacity-60"
          >
            <Icon name="download" size={14} /> {pdf.isLoading ? 'Generando…' : 'Descargar PDF'}
          </button>
        }
      />

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="rounded-lg border border-bd bg-surface p-4">
          <h3 className="text-sm font-semibold text-tx mb-3">Datos generales</h3>
          <dl className="text-sm space-y-1.5">
            <div className="flex justify-between gap-2"><dt className="text-tx-3">Fecha recepción</dt><dd className="font-mono text-xs">{formatDate(recepcion.fechaRecepcion)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-tx-3">Hora</dt><dd className="font-mono text-xs">{recepcion.horaRecepcion ?? '—'}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-tx-3">N° físico</dt><dd className="font-mono text-xs">{recepcion.numeroActaFisico ?? '—'}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-tx-3">Recibido por</dt><dd>{recepcion.usuarioRecepcion.nombre} {recepcion.usuarioRecepcion.apellido}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-tx-3">Cliente</dt><dd className="truncate max-w-xs text-right">{recepcion.factura.cliente.razonSocial}</dd></div>
          </dl>
        </div>
        {recepcion.observaciones && (
          <div className="rounded-lg border border-bd bg-surface p-4">
            <h3 className="text-sm font-semibold text-tx mb-2">Observaciones</h3>
            <p className="text-sm text-tx-2 whitespace-pre-line">{recepcion.observaciones}</p>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-bd bg-surface p-4">
        <h3 className="text-sm font-semibold text-tx mb-3">Ítems devueltos ({recepcion.items.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-sunken text-tx-2 text-xs">
              <tr>
                <th className="text-left px-3 py-2">Ítem</th>
                <th className="text-left px-3 py-2">Acta origen</th>
                <th className="text-left px-3 py-2">Cond. salida</th>
                <th className="text-left px-3 py-2">Cond. retorno</th>
                <th className="text-left px-3 py-2">Horóm.</th>
                <th className="text-left px-3 py-2">Comb.</th>
                <th className="text-left px-3 py-2">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {recepcion.items.map((it) => {
                const info = describirItem(it.actaEntregaItem);
                return (
                  <tr key={it.id} className="border-t border-bd">
                    <td className="px-3 py-2">
                      <div className="text-sm font-medium">{info.titulo}</div>
                      {info.codigo && <div className="text-xs text-tx-3 font-mono">{info.codigo}</div>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{it.actaEntregaItem.actaEntrega.numeroActa}</td>
                    <td className="px-3 py-2"><CondicionBadge condicion={it.actaEntregaItem.condicionSalida} /></td>
                    <td className="px-3 py-2"><CondicionBadge condicion={it.condicionRetorno} /></td>
                    <td className="px-3 py-2 font-mono text-xs">{it.horometroRetorno ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{it.combustibleRetorno ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-tx-2 max-w-xs truncate">{it.observacionesRetorno ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `pnpm tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/recepciones/[id]/page.tsx
git commit -m "feat(actas): página detalle /recepciones/[id] con tabla de condiciones"
```

---

## Fase F — Integración y verificación final

### Task F1: Card "Actas de esta factura" en detalle de factura

**Files:**
- Modify: `app/(dashboard)/facturas/[id]/page.tsx`

- [ ] **Step 1: Inspeccionar la estructura actual del archivo**

Run: `grep -n "rounded-lg\|<h3\|export default" /Users/joaquinmorales13a06/Desktop/Reinar/frontend/app/\(dashboard\)/facturas/\[id\]/page.tsx | head -20`
Expected: ver la estructura de cards existente.

- [ ] **Step 2: Agregar la card al final del JSX del detalle**

Justo antes del cierre de la página de detalle (busca el último `</div>` de la sección principal), agregar:

```tsx
{/* Actas y recepciones de esta factura — link contextual */}
<div className="rounded-lg border border-bd bg-surface p-4 mt-4">
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-sm font-semibold text-tx">Actas y recepciones</h3>
    {puedeEscribir && (
      <Link
        href={`/actas/nueva?facturaId=${factura.id}`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors"
      >
        <Icon name="plus" size={12} /> Nueva acta
      </Link>
    )}
  </div>
  <div className="text-xs text-tx-3">
    Ver{' '}
    <Link href={`/actas?busqueda=${factura.numeroFactura}`} className="text-accent hover:underline">actas de esta factura</Link>
    {' · '}
    <Link href={`/recepciones?busqueda=${factura.numeroFactura}`} className="text-accent hover:underline">recepciones</Link>
  </div>
</div>
```

Si `puedeEscribir` o `Icon` no están en scope en la página actual, agregar los imports/derivaciones equivalentes (revisar el archivo). Si `Link` ya está importado, no duplicarlo.

- [ ] **Step 3: Verificar TypeScript**

Run: `pnpm tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/facturas/[id]/page.tsx
git commit -m "feat(actas): card contextual de actas/recepciones en detalle de factura"
```

---

### Task F2: Verificación de gating por rol (VISUALIZADOR)

- [ ] **Step 1: Identificar botones de escritura agregados**

Lista de botones que deben ocultarse para VISUALIZADOR:
- `/actas` → botón "Nueva acta" (Task D1)
- `/actas/[id]` → panel `ActaPanelAccionContextual` (Task D2, ya gateado internamente)
- `/recepciones` → botón "Nueva recepción" (Task E1)
- `/facturas/[id]` → botón "Nueva acta" en la card nueva (Task F1)

- [ ] **Step 2: Test manual con un usuario VISUALIZADOR**

Iniciar sesión con un usuario de rol VISUALIZADOR (crear uno en BD si no existe, o cambiar el rol de un usuario existente).
Verificar visualmente que:
- En `/actas` no aparece el botón "Nueva acta"
- En `/actas/[id]` el panel contextual no muestra botones de acción
- En `/recepciones` no aparece el botón "Nueva recepción"
- En `/facturas/[id]` no aparece "Nueva acta" en la card nueva

Si alguna falla: agregar el guard `puedeEscribir` faltante y commit.

- [ ] **Step 3: Si fue necesario un fix, commit**

```bash
git add <files-fixed>
git commit -m "fix(actas): ocultar acción para VISUALIZADOR en <página>"
```

Si no hubo fix, no commit.

---

### Task F3: Verificación end-to-end

- [ ] **Step 1: Type check final**

Run: `pnpm tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 2: Lint final**

Run: `pnpm lint`
Expected: 0 errores. Si lint marca warnings nuevos del módulo, evaluar si arreglar inline (típicamente sí).

- [ ] **Step 3: Smoke test del flujo completo**

Con el server local corriendo (`pnpm dev` del backend) y el frontend (`pnpm dev`):

1. Crear acta desde `/actas/nueva` para una factura aprobada con ítems disponibles → verificar que aparece en `/actas` con estado PENDIENTE.
2. Entrar al detalle → click "Registrar despacho" → confirmar → verifica estado DESPACHADO.
3. Click "Confirmar entrega" → llenar receptor → submit → verifica estado ENTREGADO.
4. Descargar PDF del acta → verifica que descarga con filename `<numeroActa>.pdf`.
5. Click "Registrar devolución" → wizard arranca en paso 1 con los items de la acta pre-marcados → marcar condición retorno → submit → verifica que la recepción aparece en `/recepciones`.
6. Vuelve al detalle del acta original → estado debe ser DEVUELTO (o DEVUELTA_PARCIAL si no se devolvieron todos los ítems).
7. Como segundo usuario logueado en otra pestaña: registrar un despacho. La pestaña original debe actualizar el listado de actas sin recargar (WebSocket).

- [ ] **Step 4: Verificación dark mode**

Cambiar a dark mode desde el TweaksPanel. Recorrer:
- Listado de actas → tabla legible, badges con contraste.
- Detalle de acta → panel contextual con borde y fondo correctos.
- Crear acta → inputs y selects legibles.
- Wizard recepción → resaltado amarillo de "condición empeoró" visible en dark.

Si algo se ve mal, fix + commit con prefijo `fix(actas): dark mode <descripción>`.

- [ ] **Step 5: Verificación tablet (768px)**

Redimensionar el navegador a 768px de ancho. Verificar:
- Tablas con `overflow-x-auto` no rompen el layout.
- Grids `sm:grid-cols-2` colapsan a 1 columna donde corresponde.
- Botones de acción no se cortan.

Si algo falla, fix + commit.

- [ ] **Step 6: Pushear la rama**

Run: `git push -u origin feat/actas`
Expected: rama publicada.

- [ ] **Step 7: Abrir PR del frontend**

```bash
gh pr create --title "feat(actas): módulo de actas de entrega y recepciones (RAMA 12)" --body "$(cat <<'EOF'
## Summary
- 8 páginas nuevas: listado/crear/detalle/despacho/entrega para actas; listado/wizard/detalle para recepciones.
- Soporte de los 4 tipos de ítem (equipo, herramienta-unidad, consumible, pieza).
- Wizard de recepción soporta cerrar ítems de varias actas en una sola.
- Realtime vía Socket.IO (sala `actas`): invalidaciones silenciosas sin toast.
- PDFs (acta, picking, recepción) con helper centralizado.
- VISUALIZADOR sin botones de escritura.

## Depende de
- PR de backend: `feat/actas-recepciones-listado-global` (debe estar mergeado).

## Test plan
- [x] Crear → despachar → entregar → recepcionar flujo completo.
- [x] Recepción multi-acta funciona.
- [x] PDFs descargan con filename `AE-…` / `AR-…`.
- [x] Filtros del listado global aplican.
- [x] Realtime invalida queries al cambiar otro usuario el estado.
- [x] VISUALIZADOR no ve botones de escritura.
- [x] Dark mode OK.
- [x] Tablet (768px) OK.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: URL del PR. **No mergear** hasta que el PR de backend esté en `main`.

---

## Notas finales

**Si se pasa por alto algún campo del DTO:** revisar `actas.schemas.ts` del backend — es la fuente de verdad. El backend rechazará con error 422 cualquier desviación.

**Si una invalidación de query no refresca lo esperado:** verificar que el `queryKey` del hook coincide exactamente con el que se invalida. Recordar que `qc.invalidateQueries({ queryKey: ['acta'] })` (sin id) invalida todas las queries con prefix `['acta', ...]` — útil cuando la recepción afecta varias actas.

**Si un PDF descarga vacío o con 404:** verificar que el backend tenga implementado `generarActaPDF`/`generarRecepcionPDF`/`generarPickingPDF` (`pdf.service.ts`). El frontend no necesita cambios — es responsabilidad del server.
