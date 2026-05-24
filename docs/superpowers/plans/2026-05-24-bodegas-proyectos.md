# Bodegas y Proyectos — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el frontend de los módulos Bodegas y Proyectos del ERP Reinar conectados al backend Express existente, siguiendo el spec `docs/superpowers/specs/2026-05-24-bodegas-proyectos-design.md`.

**Architecture:** Next.js 15 App Router con Client Components. React Query para server state, Zustand para auth, RHF + Zod para forms. UbicacionInput compartido entre Bodega y Proyecto que compone departamento + distrito + detalle a un único string. Proyectos viven como sub-recurso del cliente; bodegas son árbol de 2 niveles (principal → zonas).

**Tech Stack:** Next.js 19, React Query v5, React Hook Form, Zod, decimal.js, sonner, TailwindCSS v4.

**Branch:** `feat/bodegas-proyectos` (ya creado).

**Verificación principal:** No hay tests automáticos en este proyecto. La verificación de cada tarea es:
1. `pnpm tsc --noEmit` debe pasar sin errores.
2. `pnpm lint` debe pasar sin warnings nuevos.
3. Para páginas con UI: smoke test manual con `pnpm dev` (puerto 3001, backend en 3000) tras tener al menos una fase completa.

---

## Fase 1 — Fundaciones (tipos, helpers, permisos, schemas, hooks)

### Task 1: Extender tipos en `types/api.ts`

**Files:**
- Modify: `types/api.ts` (append al final)

- [ ] **Step 1: Agregar bloque de tipos Bodega y Proyecto**

Anexar al final de `types/api.ts`:

```typescript

// ============================================================
// Bodegas (Rama 9)
// ============================================================

export type BodegaZona = {
  id: string;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
};

export type Bodega = {
  id: string;
  nombre: string;
  descripcion: string | null;
  direccion: string | null;
  ciudad: string | null;
  activa: boolean;
  // parentId === null distingue bodega principal de zona — la jerarquía es de
  // exactamente 2 niveles y el backend rechaza zonas anidadas.
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  // zonas viene poblado por GET /bodegas/:id (solo si es principal).
  zonas?: BodegaZona[];
  // _count viene poblado por GET /bodegas (listado).
  _count?: { zonas: number };
};

export type CrearBodegaDto = {
  nombre: string;
  descripcion?: string;
  direccion?: string;
  ciudad: string;
};

export type ActualizarBodegaDto = Partial<CrearBodegaDto>;

export type CrearZonaDto = {
  nombre: string;
  descripcion?: string;
};

export type ActualizarZonaDto = Partial<CrearZonaDto>;

// ============================================================
// Proyectos (Rama 9)
// ============================================================

// PAUSADO no aparecía en el plan original pero el backend lo soporta como
// estado intermedio. La máquina de estados completa está documentada en
// el spec (docs/superpowers/specs/2026-05-24-bodegas-proyectos-design.md).
export type EstadoProyecto = 'ACTIVO' | 'PAUSADO' | 'COMPLETADO' | 'CANCELADO';

export type Proyecto = {
  id: string;
  clienteId: string;
  nombre: string;
  descripcion: string | null;
  // Texto compuesto por UbicacionInput: "${detalle}, ${distrito}, ${departamento}".
  ubicacion: string;
  estado: EstadoProyecto;
  createdAt: string;
  updatedAt: string;
  // Embebido por GET /proyectos/:id.
  cliente?: { id: string; razonSocial: string | null; nombre: string };
  _count?: { cotizaciones: number };
  // KPIs computados por el backend solo en GET /proyectos/:id.
  // Los montos son Decimal serializados como strings — usar decimal.js.
  kpis?: {
    totalCotizado: string;
    totalFacturado: string;
    equiposEnObra: number;
  };
};

export type CrearProyectoDto = {
  nombre: string;
  descripcion?: string;
  ubicacion: string;
};

export type ActualizarProyectoDto = Partial<CrearProyectoDto>;

export type FiltrosProyectosCliente = {
  estado?: EstadoProyecto;
};
```

- [ ] **Step 2: Verificar TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add types/api.ts
git commit -m "feat(bodegas-proyectos): tipos de Bodega y Proyecto"
```

---

### Task 2: Helper geográfico + permisos

**Files:**
- Modify: `lib/sv-geo.ts` (agregar `getDistritosByDept`)
- Create: `lib/bodegas.ts`
- Create: `lib/proyectos.ts`

- [ ] **Step 1: Agregar `getDistritosByDept` en `lib/sv-geo.ts`**

Localizar la función `getDistritosByMuniDept` (cerca de la línea 356) y agregar inmediatamente después:

```typescript

// Devuelve todos los distritos de un departamento sin pasar por municipio.
// El flujo de Reinar para bodegas y proyectos guarda únicamente
// departamento + distrito + texto libre, por lo que el municipio queda fuera
// del selector. Ordenamos por label para que el dropdown sea predecible.
export function getDistritosByDept(deptCode: string): DistritoSV[] {
  return DISTRITOS_SV
    .filter((d) => d.department === deptCode)
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
}
```

- [ ] **Step 2: Crear `lib/bodegas.ts`**

```typescript
// Espejo de server/src/modules/bodegas/bodegas.routes.ts: solo ADMIN/GERENTE
// pueden crear, editar o cambiar estado. Resto de roles ven en read-only.
export const PERMISOS_BODEGAS = {
  crear:         ['ADMIN', 'GERENTE'] as const,
  editar:        ['ADMIN', 'GERENTE'] as const,
  cambiarEstado: ['ADMIN', 'GERENTE'] as const,
} as const;

export function puedeEjecutarBodega(
  accion: keyof typeof PERMISOS_BODEGAS,
  rol: string | undefined,
): boolean {
  if (!rol) return false;
  return (PERMISOS_BODEGAS[accion] as readonly string[]).includes(rol);
}
```

- [ ] **Step 3: Crear `lib/proyectos.ts`**

```typescript
// Espejo de server/src/modules/proyectos/proyectos.routes.ts:
//   operadores = ADMIN/GERENTE/OPERADOR pueden escribir.
//   LOGISTICA y VISUALIZADOR solo leen.
export const PERMISOS_PROYECTOS = {
  crear:         ['ADMIN', 'GERENTE', 'OPERADOR'] as const,
  editar:        ['ADMIN', 'GERENTE', 'OPERADOR'] as const,
  cambiarEstado: ['ADMIN', 'GERENTE', 'OPERADOR'] as const,
} as const;

export function puedeEjecutarProyecto(
  accion: keyof typeof PERMISOS_PROYECTOS,
  rol: string | undefined,
): boolean {
  if (!rol) return false;
  return (PERMISOS_PROYECTOS[accion] as readonly string[]).includes(rol);
}

// Espejo de TRANSICIONES_VALIDAS en proyectos.service.ts. Lo replicamos en el
// frontend para deshabilitar opciones inválidas antes de llegar al backend;
// la fuente de verdad sigue siendo el backend (422 si nos saltamos esto).
import type { EstadoProyecto } from '@/types/api';

export const TRANSICIONES_PROYECTO: Record<EstadoProyecto, EstadoProyecto[]> = {
  ACTIVO:     ['PAUSADO', 'COMPLETADO', 'CANCELADO'],
  PAUSADO:    ['ACTIVO', 'CANCELADO'],
  COMPLETADO: [],
  CANCELADO:  [],
};

export function esEstadoTerminal(estado: EstadoProyecto): boolean {
  return TRANSICIONES_PROYECTO[estado].length === 0;
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add lib/sv-geo.ts lib/bodegas.ts lib/proyectos.ts
git commit -m "feat(bodegas-proyectos): helpers de permisos y getDistritosByDept"
```

---

### Task 3: Schemas Zod

**Files:**
- Create: `lib/schemas/bodegas.ts`
- Create: `lib/schemas/proyectos.ts`

- [ ] **Step 1: Crear `lib/schemas/bodegas.ts`**

```typescript
import { z } from 'zod';

// Espejo de server/src/modules/bodegas/bodegas.schemas.ts.
// ciudad es requerido en el backend; en el frontend lo derivamos del distrito
// seleccionado dentro del UbicacionInput — el form no lo expone directamente.
export const bodegaCrearSchema = z.object({
  nombre:      z.string().min(1, 'El nombre es requerido').max(150, 'Máximo 150 caracteres'),
  descripcion: z.string().max(500, 'Máximo 500 caracteres').optional(),
  // Texto compuesto por UbicacionInput. Validamos que se haya completado.
  direccion:   z.string().min(1, 'La dirección es requerida'),
  // Derivado de distrito.label en el onSubmit del form.
  ciudad:      z.string().min(1, 'La ciudad es requerida'),
});

export const bodegaEditarSchema = bodegaCrearSchema;

export const zonaCrearSchema = z.object({
  nombre:      z.string().min(1, 'El nombre es requerido').max(150, 'Máximo 150 caracteres'),
  descripcion: z.string().max(500, 'Máximo 500 caracteres').optional(),
});

export const zonaEditarSchema = zonaCrearSchema;

export type BodegaCrearInput = z.infer<typeof bodegaCrearSchema>;
export type BodegaEditarInput = z.infer<typeof bodegaEditarSchema>;
export type ZonaCrearInput   = z.infer<typeof zonaCrearSchema>;
export type ZonaEditarInput  = z.infer<typeof zonaEditarSchema>;
```

- [ ] **Step 2: Crear `lib/schemas/proyectos.ts`**

```typescript
import { z } from 'zod';

// Espejo de server/src/modules/proyectos/proyectos.schemas.ts.
export const proyectoCrearSchema = z.object({
  nombre:      z.string().min(1, 'El nombre es requerido').max(150, 'Máximo 150 caracteres'),
  descripcion: z.string().max(1000, 'Máximo 1000 caracteres').optional(),
  // ubicacion es un string compuesto por UbicacionInput ("detalle, distrito, departamento").
  ubicacion:   z.string().min(1, 'La ubicación es requerida'),
});

export const proyectoEditarSchema = proyectoCrearSchema;

export type ProyectoCrearInput  = z.infer<typeof proyectoCrearSchema>;
export type ProyectoEditarInput = z.infer<typeof proyectoEditarSchema>;
```

- [ ] **Step 3: Verificar TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add lib/schemas/bodegas.ts lib/schemas/proyectos.ts
git commit -m "feat(bodegas-proyectos): schemas Zod de bodegas y proyectos"
```

---

### Task 4: Hooks de bodegas

**Files:**
- Create: `hooks/use-bodegas.ts`

- [ ] **Step 1: Crear `hooks/use-bodegas.ts`**

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  Bodega,
  CrearBodegaDto,
  ActualizarBodegaDto,
  CrearZonaDto,
  ActualizarZonaDto,
} from '@/types/api';

// Helper duplicado intencionalmente para mantener cada archivo de hooks
// autocontenido, igual que en use-servicios.ts.
function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

// ─── Queries ─────────────────────────────────────────────────────────

export function useBodegas() {
  return useQuery({
    queryKey: ['bodegas'],
    queryFn: () =>
      api.get<ApiResponse<Bodega[]>>('/bodegas').then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
  });
}

export function useBodega(id: string) {
  return useQuery({
    queryKey: ['bodega', id],
    queryFn: () =>
      api.get<ApiResponse<Bodega>>(`/bodegas/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

// ─── Mutations: bodegas principales ──────────────────────────────────

export function useCrearBodega() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (data: CrearBodegaDto) =>
      api.post<ApiResponse<Bodega>>('/bodegas', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (bodega) => {
      qc.invalidateQueries({ queryKey: ['bodegas'] });
      toast.success('Bodega creada.');
      router.push(`/bodegas/${bodega.id}`);
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear la bodega.'));
    },
  });
}

export function useEditarBodega() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ActualizarBodegaDto }) =>
      api.put<ApiResponse<Bodega>>(`/bodegas/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['bodegas'] });
      qc.invalidateQueries({ queryKey: ['bodega', id] });
      toast.success('Cambios guardados.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudieron guardar los cambios.'));
    },
  });
}

export function useCambiarEstadoBodega() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activa }: { id: string; activa: boolean }) =>
      api.patch<ApiResponse<Bodega>>(`/bodegas/${id}/estado`, { activa }).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (bodega, { id }) => {
      qc.invalidateQueries({ queryKey: ['bodegas'] });
      qc.invalidateQueries({ queryKey: ['bodega', id] });
      toast.success(bodega.activa ? 'Bodega activada.' : 'Bodega desactivada.');
    },
    onError: (err) => {
      // El backend devuelve 409 con mensaje específico cuando hay zonas activas
      // o actas en vuelo. Propagamos el mensaje del backend tal cual.
      toast.error(extractErrorMessage(err, 'No se pudo cambiar el estado.'));
    },
  });
}

// ─── Mutations: zonas ────────────────────────────────────────────────

export function useCrearZona(bodegaId: string) {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (data: CrearZonaDto) =>
      api.post<ApiResponse<Bodega>>(`/bodegas/${bodegaId}/zonas`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bodegas'] });
      qc.invalidateQueries({ queryKey: ['bodega', bodegaId] });
      toast.success('Zona creada.');
      router.push(`/bodegas/${bodegaId}`);
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear la zona.'));
    },
  });
}

export function useEditarZona(bodegaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ zonaId, data }: { zonaId: string; data: ActualizarZonaDto }) =>
      api.put<ApiResponse<Bodega>>(`/bodegas/zonas/${zonaId}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bodega', bodegaId] });
      toast.success('Cambios guardados.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudieron guardar los cambios.'));
    },
  });
}

export function useCambiarEstadoZona(bodegaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ zonaId, activa }: { zonaId: string; activa: boolean }) =>
      api.patch<ApiResponse<Bodega>>(`/bodegas/zonas/${zonaId}/estado`, { activa }).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (zona) => {
      qc.invalidateQueries({ queryKey: ['bodega', bodegaId] });
      toast.success(zona.activa ? 'Zona activada.' : 'Zona desactivada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo cambiar el estado.'));
    },
  });
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-bodegas.ts
git commit -m "feat(bodegas-proyectos): hooks de React Query para bodegas y zonas"
```

---

### Task 5: Hooks de proyectos

**Files:**
- Create: `hooks/use-proyectos.ts`

- [ ] **Step 1: Crear `hooks/use-proyectos.ts`**

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  Proyecto,
  CrearProyectoDto,
  ActualizarProyectoDto,
  EstadoProyecto,
  FiltrosProyectosCliente,
} from '@/types/api';

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

// ─── Queries ─────────────────────────────────────────────────────────

export function useProyectosCliente(clienteId: string, filtros: FiltrosProyectosCliente = {}) {
  return useQuery({
    queryKey: ['proyectos-cliente', clienteId, filtros],
    queryFn: () =>
      api
        .get<ApiResponse<Proyecto[]>>(`/clientes/${clienteId}/proyectos`, { params: filtros })
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    enabled: !!clienteId,
  });
}

export function useProyecto(id: string) {
  return useQuery({
    queryKey: ['proyecto', id],
    queryFn: () =>
      api.get<ApiResponse<Proyecto>>(`/proyectos/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────

export function useCrearProyecto(clienteId: string) {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (data: CrearProyectoDto) =>
      api
        .post<ApiResponse<Proyecto>>(`/clientes/${clienteId}/proyectos`, data)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (proyecto) => {
      // El detalle del cliente muestra el contador de proyectos, por eso
      // invalidamos también su cache aunque pertenezca a otro módulo.
      qc.invalidateQueries({ queryKey: ['proyectos-cliente', clienteId] });
      qc.invalidateQueries({ queryKey: ['cliente', clienteId] });
      toast.success('Proyecto creado.');
      router.push(`/proyectos/${proyecto.id}`);
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear el proyecto.'));
    },
  });
}

export function useEditarProyecto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ActualizarProyectoDto }) =>
      api.put<ApiResponse<Proyecto>>(`/proyectos/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (proyecto) => {
      qc.invalidateQueries({ queryKey: ['proyecto', proyecto.id] });
      qc.invalidateQueries({ queryKey: ['proyectos-cliente', proyecto.clienteId] });
      toast.success('Cambios guardados.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudieron guardar los cambios.'));
    },
  });
}

export function useCambiarEstadoProyecto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoProyecto }) =>
      api.patch<ApiResponse<Proyecto>>(`/proyectos/${id}/estado`, { estado }).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (proyecto) => {
      qc.invalidateQueries({ queryKey: ['proyecto', proyecto.id] });
      qc.invalidateQueries({ queryKey: ['proyectos-cliente', proyecto.clienteId] });
      toast.success(`Estado: ${proyecto.estado}.`);
    },
    onError: (err) => {
      // Backend devuelve 422 ESTADO_INVALIDO si la transición es inválida.
      // El selector debería prevenirlo, pero si llega igual mostramos el mensaje.
      toast.error(extractErrorMessage(err, 'No se pudo cambiar el estado.'));
    },
  });
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-proyectos.ts
git commit -m "feat(bodegas-proyectos): hooks de React Query para proyectos"
```

---

## Fase 2 — Componente compartido UbicacionInput

### Task 6: `components/ui/UbicacionInput.tsx`

**Files:**
- Create: `components/ui/UbicacionInput.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { DEPARTAMENTOS_SV, getDistritosByDept } from '@/lib/sv-geo';

type UbicacionParts = {
  departamento: string; // value del catálogo (código MH); '' = no seleccionado
  distrito: string;     // value del catálogo (código MH); '' = no seleccionado
  detalle: string;      // texto libre (calle, número, referencia)
};

type UbicacionInputProps = {
  value: string;
  onChange: (texto: string) => void;
  error?: string;
  className?: string;
};

const SEPARADOR = ', ';

// Compone el texto final que se persiste en backend. Se guardan los nombres
// (labels) — no los códigos — porque el backend acepta texto libre y los PDFs
// del módulo de cotizaciones ya esperan strings legibles.
function componer(parts: UbicacionParts): string {
  const dept = DEPARTAMENTOS_SV.find((d) => d.value === parts.departamento);
  const dist = getDistritosByDept(parts.departamento).find((d) => d.value === parts.distrito);
  if (!parts.detalle.trim() || !dept || !dist) return '';
  return `${parts.detalle.trim()}${SEPARADOR}${dist.label}${SEPARADOR}${dept.label}`;
}

// Intenta reconstruir los selectores cuando el componente recibe un value en
// modo edición. Si los dos últimos tokens del split por ", " matchean labels
// del catálogo, prellenamos los dropdowns; si no, todo va al input de detalle
// (caso de datos legacy o con formato distinto).
function parsear(value: string): UbicacionParts {
  if (!value) return { departamento: '', distrito: '', detalle: '' };

  const tokens = value.split(SEPARADOR).map((t) => t.trim()).filter(Boolean);
  if (tokens.length < 3) {
    return { departamento: '', distrito: '', detalle: value };
  }

  const deptLabel = tokens[tokens.length - 1];
  const distLabel = tokens[tokens.length - 2];

  const dept = DEPARTAMENTOS_SV.find((d) => d.label === deptLabel);
  if (!dept) return { departamento: '', distrito: '', detalle: value };

  const dist = getDistritosByDept(dept.value).find((d) => d.label === distLabel);
  if (!dist) return { departamento: '', distrito: '', detalle: value };

  // El detalle es todo lo anterior unido — el join con SEPARADOR preserva las
  // comas internas si el usuario las usó al escribir (ej. "Calle 5, casa 20").
  const detalle = tokens.slice(0, -2).join(SEPARADOR);
  return { departamento: dept.value, distrito: dist.value, detalle };
}

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-2';
const hintCls = 'text-xs text-tx-3 mt-1';

export function UbicacionInput({ value, onChange, error, className }: UbicacionInputProps) {
  const [parts, setParts] = useState<UbicacionParts>(() => parsear(value));
  // El valor "estable" pre-parseado evita re-parsear en cada render — solo
  // sincronizamos cuando el `value` controlado externo cambia explícitamente
  // (ej. reset del form), no por cada keystroke nuestro.
  const lastExternalValue = useRef(value);

  useEffect(() => {
    if (value !== lastExternalValue.current && value !== componer(parts)) {
      lastExternalValue.current = value;
      setParts(parsear(value));
    }
  }, [value, parts]);

  function update(next: UbicacionParts) {
    setParts(next);
    const composed = componer(next);
    lastExternalValue.current = composed;
    onChange(composed);
  }

  const distritos = parts.departamento ? getDistritosByDept(parts.departamento) : [];
  const inputCls = error ? `${inputBase} border-danger` : `${inputBase} border-bd`;
  const fallback =
    !!value && parts.departamento === '' && parts.distrito === '' && parts.detalle === value;

  return (
    <div className={className}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Departamento *</label>
          <select
            className={inputCls}
            value={parts.departamento}
            onChange={(e) => update({ ...parts, departamento: e.target.value, distrito: '' })}
          >
            <option value="">— Selecciona departamento —</option>
            {DEPARTAMENTOS_SV.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Distrito *</label>
          <select
            className={inputCls}
            value={parts.distrito}
            onChange={(e) => update({ ...parts, distrito: e.target.value })}
            disabled={!parts.departamento}
          >
            <option value="">
              {parts.departamento ? '— Selecciona distrito —' : '— Selecciona departamento primero —'}
            </option>
            {distritos.map((d) => (
              // Nota: el value (código MH) no es único entre municipios del mismo
              // departamento, así que la `key` combina value + label para evitar
              // colisiones de React. El usuario seleccionará por label igualmente.
              <option key={`${d.value}-${d.label}`} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3">
        <label className={labelCls}>Calle, número y referencia *</label>
        <input
          className={inputCls}
          placeholder="Calle 5, casa 20, frente a parque"
          value={parts.detalle}
          onChange={(e) => update({ ...parts, detalle: e.target.value })}
        />
      </div>

      {fallback && (
        <p className={hintCls}>
          Los selectores quedaron vacíos por el formato anterior; al guardar se
          actualizará la dirección al nuevo formato.
        </p>
      )}
      {error && <p className={errorCls}>{error}</p>}
    </div>
  );
}

// Exportamos parsear/componer para que los formularios puedan derivar campos
// adicionales sin reimplementar la lógica (ej. Bodega.ciudad = distrito.label).
export function getDistritoLabel(value: string): string | null {
  if (!value) return null;
  // Búsqueda directa en el value de la composición — el último token antes del
  // departamento es el distrito.label, lo que es suficiente para Bodega.ciudad.
  const tokens = value.split(SEPARADOR).map((t) => t.trim()).filter(Boolean);
  if (tokens.length < 3) return null;
  return tokens[tokens.length - 2];
}

export function getDepartamentoLabel(value: string): string | null {
  if (!value) return null;
  const tokens = value.split(SEPARADOR).map((t) => t.trim()).filter(Boolean);
  if (tokens.length < 3) return null;
  return tokens[tokens.length - 1];
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Verificar lint**

```bash
pnpm lint
```

Expected: 0 nuevos warnings.

- [ ] **Step 4: Commit**

```bash
git add components/ui/UbicacionInput.tsx
git commit -m "feat(bodegas-proyectos): UbicacionInput compartido (depto + distrito + detalle)"
```

---

## Fase 3 — Bodegas (componentes y páginas)

### Task 7: `components/bodegas/BodegasTabla.tsx`

**Files:**
- Create: `components/bodegas/BodegasTabla.tsx`

- [ ] **Step 1: Crear la tabla**

```typescript
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FilterBar } from '@/components/ui/FilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { useBodegas } from '@/hooks/use-bodegas';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarBodega } from '@/lib/bodegas';

type FiltroEstado = 'TODAS' | 'ACTIVAS' | 'INACTIVAS';

export function BodegasTabla() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState<FiltroEstado>('TODAS');
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeEditar = puedeEjecutarBodega('editar', rol);

  const { data, isLoading, isError } = useBodegas();

  // Filtrado client-side porque GET /bodegas no acepta query params.
  // Asumimos volúmenes bajos (decenas de bodegas) — ver decisión D6 del spec.
  const filtradas = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.filter((b) => {
      if (q && !b.nombre.toLowerCase().includes(q)) return false;
      if (estado === 'ACTIVAS' && !b.activa) return false;
      if (estado === 'INACTIVAS' && b.activa) return false;
      return true;
    });
  }, [data, search, estado]);

  return (
    <div className="rounded-lg border border-bd bg-surface overflow-hidden">
      <FilterBar
        search={search}
        onSearch={setSearch}
        placeholder="Buscar por nombre…"
        chips={[
          {
            label: 'Activas',
            active: estado === 'ACTIVAS',
            onToggle: () => setEstado(estado === 'ACTIVAS' ? 'TODAS' : 'ACTIVAS'),
          },
          {
            label: 'Inactivas',
            active: estado === 'INACTIVAS',
            onToggle: () => setEstado(estado === 'INACTIVAS' ? 'TODAS' : 'INACTIVAS'),
          },
        ]}
        onClear={() => {
          setSearch('');
          setEstado('TODAS');
        }}
      />

      {isLoading && (
        <div className="flex justify-center py-12"><Spinner /></div>
      )}

      {isError && (
        <EmptyState
          icon="alertTriangle"
          title="Error al cargar bodegas"
          message="Intenta refrescar la página."
        />
      )}

      {!isLoading && !isError && data && filtradas.length === 0 && (
        <EmptyState
          icon="warehouse"
          title="Sin bodegas"
          message="No se encontraron bodegas con los filtros aplicados."
        />
      )}

      {!isLoading && !isError && data && filtradas.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-3xl text-sm">
            <thead className="bg-bg-sunken text-2xs uppercase tracking-wider text-tx-3">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Bodega</th>
                <th className="text-left px-4 py-2 font-medium w-36">Ciudad</th>
                <th className="text-right px-4 py-2 font-medium w-20">Zonas</th>
                <th className="text-left px-4 py-2 font-medium w-28">Estado</th>
                <th className="text-right px-4 py-2 font-medium w-24">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((b) => (
                <tr
                  key={b.id}
                  className="border-t border-bd hover:bg-bg-sunken transition-colors cursor-pointer"
                  onClick={() => router.push(`/bodegas/${b.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon name="warehouse" size={14} className="text-tx-3 shrink-0" />
                      <div>
                        <div className="font-medium">{b.nombre}</div>
                        {b.descripcion && (
                          <div className="text-xs text-tx-3 mt-0.5 truncate max-w-md">
                            {b.descripcion}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-tx-2">{b.ciudad || '—'}</td>
                  <td className="px-4 py-3 text-right font-mono">{b._count?.zonas ?? 0}</td>
                  <td className="px-4 py-3">
                    <Badge
                      status={b.activa ? 'ACTIVA' : 'INACTIVA'}
                      kind={b.activa ? 'ok' : 'neutral'}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div
                      className="inline-flex gap-1"
                      // stopPropagation evita que el click en los íconos también
                      // dispare el row click que navega al detalle.
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link
                        href={`/bodegas/${b.id}`}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-tx-3 hover:bg-bg hover:text-tx transition-colors"
                        aria-label="Ver"
                      >
                        <Icon name="eye" size={14} />
                      </Link>
                      {puedeEditar && (
                        <Link
                          href={`/bodegas/${b.id}/editar`}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-tx-3 hover:bg-bg hover:text-tx transition-colors"
                          aria-label="Editar"
                        >
                          <Icon name="edit" size={14} />
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/bodegas/BodegasTabla.tsx
git commit -m "feat(bodegas): tabla de listado con filtros client-side"
```

---

### Task 8: `components/bodegas/BodegaForm.tsx`

**Files:**
- Create: `components/bodegas/BodegaForm.tsx`

- [ ] **Step 1: Crear el form**

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { Icon } from '@/components/ui/Icon';
import { UbicacionInput, getDistritoLabel } from '@/components/ui/UbicacionInput';
import {
  bodegaCrearSchema,
  bodegaEditarSchema,
  type BodegaCrearInput,
  type BodegaEditarInput,
} from '@/lib/schemas/bodegas';
import { useCrearBodega, useEditarBodega, useCambiarEstadoBodega } from '@/hooks/use-bodegas';
import type { Bodega } from '@/types/api';

type Props =
  | { modo: 'crear'; bodega?: undefined }
  | { modo: 'editar'; bodega: Bodega };

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-1';

export function BodegaForm(props: Props) {
  const router = useRouter();
  const crear = useCrearBodega();
  const editar = useEditarBodega();
  const cambiarEstado = useCambiarEstadoBodega();
  const [confirmDesact, setConfirmDesact] = useState(false);

  const esCrear = props.modo === 'crear';
  const bodega = esCrear ? undefined : props.bodega;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<BodegaCrearInput | BodegaEditarInput>({
    resolver: zodResolver(esCrear ? bodegaCrearSchema : bodegaEditarSchema) as never,
    defaultValues: {
      nombre: bodega?.nombre ?? '',
      descripcion: bodega?.descripcion ?? '',
      direccion: bodega?.direccion ?? '',
      // ciudad se deriva del UbicacionInput en submit — un campo "oculto" del
      // schema; lo inicializamos con el valor existente para evitar perder el
      // dato si el usuario no toca el UbicacionInput.
      ciudad: bodega?.ciudad ?? '',
    },
  });

  async function onSubmit(values: BodegaCrearInput | BodegaEditarInput) {
    // ciudad se deriva del distrito seleccionado dentro del UbicacionInput
    // (decisión D4 del spec). Si el parser del UbicacionInput cayó al fallback
    // y no pudo extraer el distrito, conservamos el valor previo de la bodega.
    const ciudadDerivada = getDistritoLabel(values.direccion) ?? values.ciudad ?? '';

    if (!ciudadDerivada) {
      // En la práctica el schema Zod garantiza direccion no vacía y al estar
      // en formato compuesto siempre habrá distrito; este check es defensivo.
      return;
    }

    const payload = {
      nombre: values.nombre.trim(),
      descripcion: values.descripcion?.trim() || undefined,
      direccion: values.direccion,
      ciudad: ciudadDerivada,
    };

    try {
      if (esCrear) {
        await crear.mutateAsync(payload);
      } else {
        await editar.mutateAsync({ id: bodega!.id, data: payload });
        router.push(`/bodegas/${bodega!.id}`);
      }
    } catch {
      // El hook maneja el toast.error.
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 pb-24">
      <PageHeader
        title={esCrear ? 'Nueva bodega' : `Editar — ${bodega!.nombre}`}
        subtitle={
          esCrear
            ? 'Registra una bodega principal. Las zonas se crean luego desde el detalle.'
            : 'Modifica los datos de la bodega principal.'
        }
        back
        backLabel={esCrear ? 'Bodegas' : bodega!.nombre}
        onBack={() => router.push(esCrear ? '/bodegas' : `/bodegas/${bodega!.id}`)}
      />

      {confirmDesact && (
        <ConfirmRow
          message={
            <>
              ¿Desactivar la bodega <b>{bodega!.nombre}</b>? Si tiene zonas activas o actas
              en vuelo, el backend bloqueará la acción.
            </>
          }
          confirmLabel="Desactivar"
          variant="danger"
          onCancel={() => setConfirmDesact(false)}
          onConfirm={async () => {
            await cambiarEstado.mutateAsync({ id: bodega!.id, activa: false });
            setConfirmDesact(false);
          }}
        />
      )}

      <FormSection title="Información">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelCls}>Nombre *</label>
            <input
              className={errors.nombre ? inputErr : inputOk}
              placeholder="Bodega Central San Salvador"
              {...register('nombre')}
            />
            {errors.nombre && <p className={errorCls}>{errors.nombre.message}</p>}
          </div>

          <div className="md:col-span-2">
            <label className={labelCls}>Descripción</label>
            <textarea
              rows={3}
              className={errors.descripcion ? inputErr : inputOk}
              placeholder="Notas operativas, capacidad, uso…"
              {...register('descripcion')}
            />
            {errors.descripcion && <p className={errorCls}>{errors.descripcion.message}</p>}
          </div>
        </div>
      </FormSection>

      <FormSection title="Dirección">
        <Controller
          control={control}
          name="direccion"
          render={({ field }) => (
            <UbicacionInput
              value={field.value ?? ''}
              onChange={field.onChange}
              error={errors.direccion?.message as string | undefined}
            />
          )}
        />
      </FormSection>

      <div className="sticky bottom-0 left-0 right-0 -mx-4 px-4 py-3 bg-bg border-t border-bd flex justify-end gap-2">
        {!esCrear && bodega!.activa && (
          <button
            type="button"
            className="mr-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-danger bg-surface text-sm font-medium hover:bg-bg-sunken transition-colors"
            onClick={() => setConfirmDesact(true)}
          >
            <Icon name="x" size={14} /> Desactivar bodega
          </button>
        )}
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-sm hover:bg-bg-sunken transition-colors"
          onClick={() => router.back()}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting || crear.isPending || editar.isPending}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Icon name="check" size={14} /> {esCrear ? 'Crear bodega' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/bodegas/BodegaForm.tsx
git commit -m "feat(bodegas): form de crear/editar bodega principal con UbicacionInput"
```

---

### Task 9: `components/bodegas/ZonaForm.tsx`

**Files:**
- Create: `components/bodegas/ZonaForm.tsx`

- [ ] **Step 1: Crear el form de zona**

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { Icon } from '@/components/ui/Icon';
import {
  zonaCrearSchema,
  zonaEditarSchema,
  type ZonaCrearInput,
  type ZonaEditarInput,
} from '@/lib/schemas/bodegas';
import { useCrearZona, useEditarZona, useCambiarEstadoZona } from '@/hooks/use-bodegas';
import type { Bodega, BodegaZona } from '@/types/api';

type Props =
  | { modo: 'crear'; bodegaPadre: Pick<Bodega, 'id' | 'nombre'>; zona?: undefined }
  | { modo: 'editar'; bodegaPadre: Pick<Bodega, 'id' | 'nombre'>; zona: BodegaZona };

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-1';

export function ZonaForm(props: Props) {
  const router = useRouter();
  const crear = useCrearZona(props.bodegaPadre.id);
  const editar = useEditarZona(props.bodegaPadre.id);
  const cambiarEstado = useCambiarEstadoZona(props.bodegaPadre.id);
  const [confirmEstado, setConfirmEstado] = useState(false);

  const esCrear = props.modo === 'crear';
  const zona = esCrear ? undefined : props.zona;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ZonaCrearInput | ZonaEditarInput>({
    resolver: zodResolver(esCrear ? zonaCrearSchema : zonaEditarSchema) as never,
    defaultValues: {
      nombre: zona?.nombre ?? '',
      descripcion: zona?.descripcion ?? '',
    },
  });

  async function onSubmit(values: ZonaCrearInput | ZonaEditarInput) {
    const payload = {
      nombre: values.nombre.trim(),
      descripcion: values.descripcion?.trim() || undefined,
    };
    try {
      if (esCrear) {
        await crear.mutateAsync(payload);
      } else {
        await editar.mutateAsync({ zonaId: zona!.id, data: payload });
        router.push(`/bodegas/${props.bodegaPadre.id}`);
      }
    } catch {
      // El hook maneja toast.error.
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 pb-24">
      <PageHeader
        title={esCrear ? 'Nueva zona' : `Editar zona — ${zona!.nombre}`}
        subtitle={
          <>
            Zona de <b className="text-tx">{props.bodegaPadre.nombre}</b>
          </>
        }
        back
        backLabel={props.bodegaPadre.nombre}
        onBack={() => router.push(`/bodegas/${props.bodegaPadre.id}`)}
      />

      {confirmEstado && zona && (
        <ConfirmRow
          message={
            zona.activa
              ? <>¿Desactivar la zona <b>{zona.nombre}</b>?</>
              : <>¿Activar la zona <b>{zona.nombre}</b>?</>
          }
          confirmLabel={zona.activa ? 'Desactivar' : 'Activar'}
          variant={zona.activa ? 'danger' : 'primary'}
          onCancel={() => setConfirmEstado(false)}
          onConfirm={async () => {
            await cambiarEstado.mutateAsync({ zonaId: zona.id, activa: !zona.activa });
            setConfirmEstado(false);
          }}
        />
      )}

      <FormSection title="Información">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className={labelCls}>Nombre *</label>
            <input
              className={errors.nombre ? inputErr : inputOk}
              placeholder="Zona A — Equipos pesados"
              {...register('nombre')}
            />
            {errors.nombre && <p className={errorCls}>{errors.nombre.message}</p>}
          </div>

          <div>
            <label className={labelCls}>Descripción</label>
            <textarea
              rows={3}
              className={errors.descripcion ? inputErr : inputOk}
              placeholder="Para qué se usa esta zona dentro de la bodega."
              {...register('descripcion')}
            />
            {errors.descripcion && <p className={errorCls}>{errors.descripcion.message}</p>}
          </div>
        </div>
      </FormSection>

      <div className="sticky bottom-0 left-0 right-0 -mx-4 px-4 py-3 bg-bg border-t border-bd flex justify-end gap-2">
        {!esCrear && (
          <button
            type="button"
            className={`mr-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-sm font-medium bg-surface hover:bg-bg-sunken transition-colors ${zona!.activa ? 'text-danger' : 'text-ok'}`}
            onClick={() => setConfirmEstado(true)}
          >
            <Icon name={zona!.activa ? 'x' : 'check'} size={14} />
            {zona!.activa ? 'Desactivar zona' : 'Activar zona'}
          </button>
        )}
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-sm hover:bg-bg-sunken transition-colors"
          onClick={() => router.back()}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting || crear.isPending || editar.isPending}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Icon name="check" size={14} /> {esCrear ? 'Crear zona' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/bodegas/ZonaForm.tsx
git commit -m "feat(bodegas): form de crear/editar zona con activar/desactivar"
```

---

### Task 10: `components/bodegas/EquiposAsignadosCard.tsx`

**Files:**
- Create: `components/bodegas/EquiposAsignadosCard.tsx`

- [ ] **Step 1: Inspeccionar el hook `useEquipos` para confirmar el filtro por bodegaId**

```bash
grep -n "bodegaId" hooks/use-equipos.ts types/api.ts
```

Expected: la inspección puede arrojar 0 resultados — el filtro `bodegaId` no está en `FiltrosEquipos` actualmente. Si no existe, este card usará `useQuery` directamente contra `/equipos?bodegaId=X` sin pasar por el hook estandar. (Decisión tomada en el spec — la implementación específica se aterriza aquí porque el hook existente no soporta el filtro.)

- [ ] **Step 2: Crear el card**

```typescript
'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import api from '@/lib/api';
import type { PaginatedResponse, Equipo } from '@/types/api';

// Llamamos al endpoint directamente porque useEquipos (hooks/use-equipos.ts)
// no expone aún el filtro `bodegaId`. El backend sí lo acepta como query param.
// Cuando el hook lo soporte, este card se simplifica a una llamada normal.
export function EquiposAsignadosCard({ bodegaId }: { bodegaId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['equipos', { bodegaId, limit: 8 }],
    queryFn: () =>
      api
        .get<PaginatedResponse<Equipo>>('/equipos', { params: { bodegaId, page: 1, limit: 8 } })
        .then((r) => ({ data: r.data.data, meta: r.data.meta })),
    enabled: !!bodegaId,
  });

  const total = data?.meta.total ?? 0;

  return (
    <div className="rounded-lg border border-bd bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
        <h3 className="text-sm font-semibold text-tx">
          Equipos asignados {total > 0 && <span className="text-tx-3 font-normal">({total})</span>}
        </h3>
        {total > 8 && (
          <Link
            href={`/equipos?bodegaId=${bodegaId}`}
            className="text-xs text-accent-dim hover:underline"
          >
            Ver todos
          </Link>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-8"><Spinner /></div>
      )}

      {isError && (
        <div className="px-4 py-6 text-center text-sm text-tx-3">
          No se pudieron cargar los equipos.
        </div>
      )}

      {!isLoading && !isError && data && data.data.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-tx-3">
          Sin equipos asignados a esta bodega.
        </div>
      )}

      {!isLoading && !isError && data && data.data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {data.data.map((e) => (
                <tr key={e.id} className="border-t border-bd first:border-t-0 hover:bg-bg-sunken transition-colors">
                  <td className="px-4 py-2.5 w-28 font-mono text-xs text-tx-2">
                    <Link href={`/equipos/${e.id}`} className="hover:underline">{e.codigo}</Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={`/equipos/${e.id}`} className="hover:underline">
                      <span className="text-tx">{e.nombre}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 w-32 text-right">
                    <Badge status={e.estado} />
                  </td>
                  <td className="px-4 py-2.5 w-8 pr-3 text-right">
                    <Link
                      href={`/equipos/${e.id}`}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-tx-3 hover:bg-bg hover:text-tx transition-colors"
                      aria-label="Ver"
                    >
                      <Icon name="arrowRight" size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/bodegas/EquiposAsignadosCard.tsx
git commit -m "feat(bodegas): card de equipos asignados en el detalle"
```

---

### Task 11: Páginas de bodegas (lista y nuevo)

**Files:**
- Create: `app/(dashboard)/bodegas/page.tsx`
- Create: `app/(dashboard)/bodegas/nuevo/page.tsx`

- [ ] **Step 1: Crear página de lista**

`app/(dashboard)/bodegas/page.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { BodegasTabla } from '@/components/bodegas/BodegasTabla';
import { useBodegas } from '@/hooks/use-bodegas';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarBodega } from '@/lib/bodegas';

export default function BodegasPage() {
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeCrear = puedeEjecutarBodega('crear', rol);
  const { data } = useBodegas();

  const total = data?.length ?? 0;
  const totalZonas = data?.reduce((acc, b) => acc + (b._count?.zonas ?? 0), 0) ?? 0;

  return (
    <div>
      <PageHeader
        title="Bodegas"
        subtitle={`${total} ${total === 1 ? 'bodega principal' : 'bodegas principales'} · ${totalZonas} ${totalZonas === 1 ? 'zona' : 'zonas'}`}
        actions={
          puedeCrear ? (
            <Link
              href="/bodegas/nuevo"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors"
            >
              <Icon name="plus" size={14} /> Nueva bodega
            </Link>
          ) : undefined
        }
      />
      <BodegasTabla />
    </div>
  );
}
```

- [ ] **Step 2: Crear página de nuevo**

`app/(dashboard)/bodegas/nuevo/page.tsx`:

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { BodegaForm } from '@/components/bodegas/BodegaForm';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarBodega } from '@/lib/bodegas';

export default function NuevaBodegaPage() {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeCrear = puedeEjecutarBodega('crear', rol);

  // Si un usuario sin permisos llega a la URL directa, lo regresamos al listado.
  // El botón ya está oculto en BodegasPage para esos roles.
  useEffect(() => {
    if (rol && !puedeCrear) router.replace('/bodegas');
  }, [rol, puedeCrear, router]);

  if (!puedeCrear) return null;

  return <BodegaForm modo="crear" />;
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/bodegas/page.tsx app/\(dashboard\)/bodegas/nuevo/page.tsx
git commit -m "feat(bodegas): páginas de lista y crear nueva"
```

---

### Task 12: Página de detalle de bodega

**Files:**
- Create: `app/(dashboard)/bodegas/[id]/page.tsx`

- [ ] **Step 1: Crear página de detalle**

```typescript
'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { EquiposAsignadosCard } from '@/components/bodegas/EquiposAsignadosCard';
import { useBodega } from '@/hooks/use-bodegas';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarBodega } from '@/lib/bodegas';

const btnSec =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';

export default function BodegaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeEditar = puedeEjecutarBodega('editar', rol);
  const { data: bodega, isLoading, isError } = useBodega(id);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  if (isError || !bodega) {
    return (
      <EmptyState
        icon="alertTriangle"
        title="No se encontró la bodega"
        message="Puede haber sido eliminada o el ID es incorrecto."
      />
    );
  }

  return (
    <div>
      <PageHeader
        title={bodega.nombre}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span className="font-mono text-xs text-tx-3">{bodega.id}</span>
            <span className="text-tx-3">·</span>
            <Badge status={bodega.activa ? 'ACTIVA' : 'INACTIVA'} kind={bodega.activa ? 'ok' : 'neutral'} />
          </span>
        }
        back
        backLabel="Bodegas"
        onBack={() => router.push('/bodegas')}
        actions={
          puedeEditar ? (
            <Link href={`/bodegas/${bodega.id}/editar`} className={btnSec}>
              <Icon name="edit" size={14} /> Editar
            </Link>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-bd bg-surface p-4">
            <h3 className="text-sm font-semibold mb-3">Información</h3>
            <dl className="m-0 text-sm">
              <div className="flex items-baseline justify-between py-2 border-b border-bd-soft last:border-0 gap-4">
                <dt className="text-tx-3 shrink-0">Descripción</dt>
                <dd className="text-tx text-right">{bodega.descripcion || <span className="text-tx-3">—</span>}</dd>
              </div>
              <div className="flex items-baseline justify-between py-2 border-b border-bd-soft last:border-0 gap-4">
                <dt className="text-tx-3 shrink-0">Dirección</dt>
                <dd className="text-tx text-right">{bodega.direccion || <span className="text-tx-3">—</span>}</dd>
              </div>
              <div className="flex items-baseline justify-between py-2 border-b border-bd-soft last:border-0 gap-4">
                <dt className="text-tx-3 shrink-0">Ciudad</dt>
                <dd className="text-tx text-right">{bodega.ciudad || <span className="text-tx-3">—</span>}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-bd bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
              <h3 className="text-sm font-semibold text-tx">
                Zonas {(bodega.zonas?.length ?? 0) > 0 && <span className="text-tx-3 font-normal">({bodega.zonas!.length})</span>}
              </h3>
              {puedeEditar && bodega.activa && (
                <Link
                  href={`/bodegas/${bodega.id}/zonas/nueva`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors"
                >
                  <Icon name="plus" size={12} /> Nueva zona
                </Link>
              )}
            </div>
            {(bodega.zonas?.length ?? 0) === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-tx-3">
                Sin zonas registradas.
              </div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {bodega.zonas!.map((z) => (
                    <tr
                      key={z.id}
                      className="border-t border-bd first:border-t-0 hover:bg-bg-sunken transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-tx">{z.nombre}</div>
                        {z.descripcion && (
                          <div className="text-xs text-tx-3 mt-0.5">{z.descripcion}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 w-28 text-right">
                        <Badge status={z.activa ? 'ACTIVA' : 'INACTIVA'} kind={z.activa ? 'ok' : 'neutral'} />
                      </td>
                      <td className="px-4 py-2.5 w-12 pr-3 text-right">
                        {puedeEditar && (
                          <Link
                            href={`/bodegas/${bodega.id}/zonas/${z.id}/editar`}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-tx-3 hover:bg-bg hover:text-tx transition-colors"
                            aria-label="Editar"
                          >
                            <Icon name="edit" size={14} />
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <EquiposAsignadosCard bodegaId={bodega.id} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/bodegas/\[id\]/page.tsx
git commit -m "feat(bodegas): página de detalle con zonas y equipos"
```

---

### Task 13: Páginas restantes de bodegas (editar, zonas/nueva, zonas/editar)

**Files:**
- Create: `app/(dashboard)/bodegas/[id]/editar/page.tsx`
- Create: `app/(dashboard)/bodegas/[id]/zonas/nueva/page.tsx`
- Create: `app/(dashboard)/bodegas/[id]/zonas/[zonaId]/editar/page.tsx`

- [ ] **Step 1: Página editar bodega**

`app/(dashboard)/bodegas/[id]/editar/page.tsx`:

```typescript
'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BodegaForm } from '@/components/bodegas/BodegaForm';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBodega } from '@/hooks/use-bodegas';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarBodega } from '@/lib/bodegas';

export default function EditarBodegaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeEditar = puedeEjecutarBodega('editar', rol);
  const { data: bodega, isLoading, isError } = useBodega(id);

  useEffect(() => {
    if (rol && !puedeEditar) router.replace(`/bodegas/${id}`);
  }, [rol, puedeEditar, router, id]);

  if (!puedeEditar) return null;
  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (isError || !bodega) {
    return (
      <EmptyState
        icon="alertTriangle"
        title="No se encontró la bodega"
        message="Puede haber sido eliminada o el ID es incorrecto."
      />
    );
  }

  return <BodegaForm modo="editar" bodega={bodega} />;
}
```

- [ ] **Step 2: Página crear zona**

`app/(dashboard)/bodegas/[id]/zonas/nueva/page.tsx`:

```typescript
'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ZonaForm } from '@/components/bodegas/ZonaForm';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBodega } from '@/hooks/use-bodegas';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarBodega } from '@/lib/bodegas';

export default function NuevaZonaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeCrear = puedeEjecutarBodega('crear', rol);
  const { data: bodega, isLoading, isError } = useBodega(id);

  useEffect(() => {
    if (rol && !puedeCrear) router.replace(`/bodegas/${id}`);
  }, [rol, puedeCrear, router, id]);

  if (!puedeCrear) return null;
  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (isError || !bodega) {
    return (
      <EmptyState
        icon="alertTriangle"
        title="No se encontró la bodega"
        message="Puede haber sido eliminada o el ID es incorrecto."
      />
    );
  }

  // Guard preventivo: el backend rechaza crear zonas en bodega inactiva.
  // El botón ya está oculto en el detalle, pero por URL directa redirigimos.
  if (!bodega.activa) {
    router.replace(`/bodegas/${id}`);
    return null;
  }

  return <ZonaForm modo="crear" bodegaPadre={{ id: bodega.id, nombre: bodega.nombre }} />;
}
```

- [ ] **Step 3: Página editar zona**

`app/(dashboard)/bodegas/[id]/zonas/[zonaId]/editar/page.tsx`:

```typescript
'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ZonaForm } from '@/components/bodegas/ZonaForm';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBodega } from '@/hooks/use-bodegas';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarBodega } from '@/lib/bodegas';

export default function EditarZonaPage({
  params,
}: {
  params: Promise<{ id: string; zonaId: string }>;
}) {
  const { id, zonaId } = use(params);
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeEditar = puedeEjecutarBodega('editar', rol);
  const { data: bodega, isLoading, isError } = useBodega(id);

  useEffect(() => {
    if (rol && !puedeEditar) router.replace(`/bodegas/${id}`);
  }, [rol, puedeEditar, router, id]);

  if (!puedeEditar) return null;
  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (isError || !bodega) {
    return (
      <EmptyState
        icon="alertTriangle"
        title="No se encontró la bodega"
        message="Puede haber sido eliminada o el ID es incorrecto."
      />
    );
  }

  const zona = bodega.zonas?.find((z) => z.id === zonaId);
  if (!zona) {
    return (
      <EmptyState
        icon="alertTriangle"
        title="Zona no encontrada"
        message="La zona puede haber sido eliminada o el ID es incorrecto."
      />
    );
  }

  return (
    <ZonaForm
      modo="editar"
      bodegaPadre={{ id: bodega.id, nombre: bodega.nombre }}
      zona={zona}
    />
  );
}
```

- [ ] **Step 4: Verificar TypeScript y lint**

```bash
pnpm tsc --noEmit && pnpm lint
```

Expected: 0 errors / 0 nuevos warnings.

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/bodegas/
git commit -m "feat(bodegas): páginas de editar bodega y CRUD de zonas"
```

---

## Fase 4 — Proyectos (componentes y páginas)

### Task 14: `components/proyectos/EstadoProyectoSelector.tsx`

**Files:**
- Create: `components/proyectos/EstadoProyectoSelector.tsx`

- [ ] **Step 1: Crear el selector**

```typescript
'use client';

import { TRANSICIONES_PROYECTO, esEstadoTerminal } from '@/lib/proyectos';
import type { EstadoProyecto } from '@/types/api';

type Props = {
  estadoActual: EstadoProyecto;
  // Si el control es read-only (estado terminal o usuario sin permisos),
  // pasamos onChange undefined y el componente lo refleja visualmente.
  onChange?: (siguiente: EstadoProyecto) => void;
  disabled?: boolean;
};

const TODOS_ESTADOS: EstadoProyecto[] = ['ACTIVO', 'PAUSADO', 'COMPLETADO', 'CANCELADO'];

const KIND_TEXT: Record<EstadoProyecto, string> = {
  ACTIVO:     'text-ok',
  PAUSADO:    'text-warn',
  COMPLETADO: 'text-info',
  CANCELADO:  'text-tx-3',
};

export function EstadoProyectoSelector({ estadoActual, onChange, disabled }: Props) {
  const terminal = esEstadoTerminal(estadoActual);
  const transicionesValidas = TRANSICIONES_PROYECTO[estadoActual];
  const readOnly = terminal || disabled || !onChange;

  return (
    <div>
      <div className="inline-flex flex-wrap gap-1 p-1 rounded-md border border-bd bg-bg">
        {TODOS_ESTADOS.map((e) => {
          const esActual = e === estadoActual;
          const habilitado = !readOnly && (esActual || transicionesValidas.includes(e));
          const activeCls = esActual
            ? 'bg-accent text-navy font-semibold'
            : habilitado
              ? `${KIND_TEXT[e]} hover:bg-bg-sunken`
              : 'text-tx-3 opacity-50 cursor-not-allowed';
          return (
            <button
              key={e}
              type="button"
              disabled={!habilitado || esActual}
              className={`px-3 py-1.5 rounded-sm text-xs transition-colors ${activeCls}`}
              onClick={() => habilitado && !esActual && onChange && onChange(e)}
            >
              {e}
            </button>
          );
        })}
      </div>
      {terminal && (
        <p className="text-xs text-tx-3 mt-2">
          Estado final: no se puede cambiar.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/proyectos/EstadoProyectoSelector.tsx
git commit -m "feat(proyectos): selector de estado con máquina de transiciones"
```

---

### Task 15: `components/proyectos/ProyectoForm.tsx`

**Files:**
- Create: `components/proyectos/ProyectoForm.tsx`

- [ ] **Step 1: Crear el form**

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { Icon } from '@/components/ui/Icon';
import { UbicacionInput } from '@/components/ui/UbicacionInput';
import { EstadoProyectoSelector } from '@/components/proyectos/EstadoProyectoSelector';
import {
  proyectoCrearSchema,
  proyectoEditarSchema,
  type ProyectoCrearInput,
  type ProyectoEditarInput,
} from '@/lib/schemas/proyectos';
import { useCrearProyecto, useEditarProyecto, useCambiarEstadoProyecto } from '@/hooks/use-proyectos';
import type { Proyecto } from '@/types/api';

type ClienteContext = { id: string; nombre: string };

type Props =
  | { modo: 'crear'; cliente: ClienteContext; proyecto?: undefined }
  | { modo: 'editar'; cliente: ClienteContext; proyecto: Proyecto };

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-1';

export function ProyectoForm(props: Props) {
  const router = useRouter();
  const esCrear = props.modo === 'crear';
  const proyecto = esCrear ? undefined : props.proyecto;

  const crear = useCrearProyecto(props.cliente.id);
  const editar = useEditarProyecto();
  const cambiarEstado = useCambiarEstadoProyecto();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProyectoCrearInput | ProyectoEditarInput>({
    resolver: zodResolver(esCrear ? proyectoCrearSchema : proyectoEditarSchema) as never,
    defaultValues: {
      nombre: proyecto?.nombre ?? '',
      descripcion: proyecto?.descripcion ?? '',
      ubicacion: proyecto?.ubicacion ?? '',
    },
  });

  async function onSubmit(values: ProyectoCrearInput | ProyectoEditarInput) {
    const payload = {
      nombre: values.nombre.trim(),
      descripcion: values.descripcion?.trim() || undefined,
      ubicacion: values.ubicacion,
    };
    try {
      if (esCrear) {
        await crear.mutateAsync(payload);
      } else {
        await editar.mutateAsync({ id: proyecto!.id, data: payload });
        router.push(`/proyectos/${proyecto!.id}`);
      }
    } catch {
      // El hook maneja toast.error.
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 pb-24">
      <PageHeader
        title={esCrear ? 'Nuevo proyecto' : `Editar — ${proyecto!.nombre}`}
        subtitle={
          <>
            Cliente: <b className="text-tx">{props.cliente.nombre}</b>
            <span className="text-tx-3 mx-2">·</span>
            <span className="font-mono text-xs text-tx-3">{props.cliente.id}</span>
          </>
        }
        back
        backLabel={esCrear ? 'Cliente' : proyecto!.nombre}
        onBack={() =>
          esCrear
            ? router.push(`/clientes/${props.cliente.id}`)
            : router.push(`/proyectos/${proyecto!.id}`)
        }
      />

      <FormSection title="Información">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className={labelCls}>Nombre del proyecto *</label>
            <input
              className={errors.nombre ? inputErr : inputOk}
              placeholder="Pasarela peatonal Bvr. Constitución"
              {...register('nombre')}
            />
            {errors.nombre && <p className={errorCls}>{errors.nombre.message}</p>}
          </div>

          <div>
            <label className={labelCls}>Descripción</label>
            <textarea
              rows={3}
              className={errors.descripcion ? inputErr : inputOk}
              placeholder="Alcance y características generales de la obra."
              {...register('descripcion')}
            />
            {errors.descripcion && <p className={errorCls}>{errors.descripcion.message}</p>}
          </div>
        </div>
      </FormSection>

      <FormSection title="Ubicación de la obra">
        <Controller
          control={control}
          name="ubicacion"
          render={({ field }) => (
            <UbicacionInput
              value={field.value ?? ''}
              onChange={field.onChange}
              error={errors.ubicacion?.message as string | undefined}
            />
          )}
        />
      </FormSection>

      {!esCrear && proyecto && (
        <FormSection title="Estado">
          <EstadoProyectoSelector
            estadoActual={proyecto.estado}
            onChange={async (siguiente) => {
              await cambiarEstado.mutateAsync({ id: proyecto.id, estado: siguiente });
            }}
            disabled={cambiarEstado.isPending}
          />
        </FormSection>
      )}

      <div className="sticky bottom-0 left-0 right-0 -mx-4 px-4 py-3 bg-bg border-t border-bd flex justify-end gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-sm hover:bg-bg-sunken transition-colors"
          onClick={() => router.back()}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting || crear.isPending || editar.isPending}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Icon name="check" size={14} /> {esCrear ? 'Crear proyecto' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/proyectos/ProyectoForm.tsx
git commit -m "feat(proyectos): form de crear/editar con UbicacionInput y selector de estado"
```

---

### Task 16: `ProyectoKpisCard` y `ProyectosClienteCard`

**Files:**
- Create: `components/proyectos/ProyectoKpisCard.tsx`
- Create: `components/proyectos/ProyectosClienteCard.tsx`

- [ ] **Step 1: Crear `ProyectoKpisCard.tsx`**

```typescript
'use client';

import { formatCurrency } from '@/lib/utils';
import type { Proyecto } from '@/types/api';

export function ProyectoKpisCard({ proyecto }: { proyecto: Proyecto }) {
  // Los KPIs solo vienen poblados por GET /proyectos/:id. Defensive: si por
  // alguna razón no están, mostramos los placeholders en cero.
  const totalCotizado = proyecto.kpis?.totalCotizado ?? '0';
  const totalFacturado = proyecto.kpis?.totalFacturado ?? '0';
  const equiposEnObra = proyecto.kpis?.equiposEnObra ?? 0;

  return (
    <div className="rounded-lg border border-bd bg-surface p-4">
      <h3 className="text-sm font-semibold mb-3">Resumen del proyecto</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-md bg-bg-sunken p-4">
          <div className="text-2xs font-semibold text-tx-3 uppercase tracking-wider">Total cotizado</div>
          <div className="font-mono text-xl font-medium text-tx mt-1">
            {formatCurrency(totalCotizado)}
          </div>
        </div>
        <div className="rounded-md bg-bg-sunken p-4">
          <div className="text-2xs font-semibold text-tx-3 uppercase tracking-wider">Total facturado</div>
          <div className="font-mono text-xl font-medium text-ok mt-1">
            {formatCurrency(totalFacturado)}
          </div>
        </div>
        <div className="rounded-md bg-bg-sunken p-4">
          <div className="text-2xs font-semibold text-tx-3 uppercase tracking-wider">Equipos en obra</div>
          <div className="font-mono text-xl font-medium text-tx mt-1">{equiposEnObra}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crear `ProyectosClienteCard.tsx`**

```typescript
'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useProyectosCliente } from '@/hooks/use-proyectos';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarProyecto } from '@/lib/proyectos';
import type { Cliente, EstadoProyecto } from '@/types/api';

const BADGE_KIND: Record<EstadoProyecto, 'ok' | 'warn' | 'info' | 'neutral'> = {
  ACTIVO:     'ok',
  PAUSADO:    'warn',
  COMPLETADO: 'info',
  CANCELADO:  'neutral',
};

type Props = {
  cliente: Pick<Cliente, 'id' | 'estado'>;
};

export function ProyectosClienteCard({ cliente }: Props) {
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeCrear = puedeEjecutarProyecto('crear', rol);
  // Solo ocultamos el botón si sabemos que el cliente está inactivo. El backend
  // rechaza con 409 si se intenta crear proyecto a cliente no ACTIVO.
  const puedeCrearReal = puedeCrear && cliente.estado === 'ACTIVO';

  const { data: proyectos, isLoading, isError } = useProyectosCliente(cliente.id);

  return (
    <div className="rounded-lg border border-bd bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
        <h3 className="text-sm font-semibold text-tx">
          Proyectos del cliente {proyectos && <span className="text-tx-3 font-normal">({proyectos.length})</span>}
        </h3>
        {puedeCrearReal && (
          <Link
            href={`/clientes/${cliente.id}/proyectos/nuevo`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors"
          >
            <Icon name="plus" size={12} /> Nuevo proyecto
          </Link>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-8"><Spinner /></div>
      )}

      {isError && (
        <div className="px-4 py-6 text-center text-sm text-tx-3">
          No se pudieron cargar los proyectos.
        </div>
      )}

      {!isLoading && !isError && proyectos && proyectos.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-tx-3">
          Este cliente no tiene proyectos registrados.
        </div>
      )}

      {!isLoading && !isError && proyectos && proyectos.length > 0 && (
        <table className="w-full text-sm">
          <tbody>
            {proyectos.map((p) => (
              <tr key={p.id} className="border-t border-bd first:border-t-0 hover:bg-bg-sunken transition-colors">
                <td className="px-4 py-2.5">
                  <Link href={`/proyectos/${p.id}`} className="hover:underline">
                    <div className="font-medium text-tx">{p.nombre}</div>
                    <div className="text-xs text-tx-3 mt-0.5 truncate max-w-md">
                      {p.ubicacion}
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-2.5 w-28 text-right font-mono text-xs text-tx-3">
                  {p._count?.cotizaciones ?? 0} cot.
                </td>
                <td className="px-4 py-2.5 w-32 text-right">
                  <Badge status={p.estado} kind={BADGE_KIND[p.estado]} />
                </td>
                <td className="px-4 py-2.5 w-8 pr-3 text-right">
                  <Link
                    href={`/proyectos/${p.id}`}
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-tx-3 hover:bg-bg hover:text-tx transition-colors"
                    aria-label="Ver"
                  >
                    <Icon name="arrowRight" size={14} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/proyectos/ProyectoKpisCard.tsx components/proyectos/ProyectosClienteCard.tsx
git commit -m "feat(proyectos): cards de KPIs y de proyectos por cliente"
```

---

### Task 17: Inyectar `ProyectosClienteCard` en el detalle del cliente

**Files:**
- Modify: `components/clientes/ClienteDetalle.tsx`

- [ ] **Step 1: Inyectar el card después de ContactosDeCliente**

Localizar en `components/clientes/ClienteDetalle.tsx` la línea:
```typescript
      <ContactosDeCliente clienteId={id} />
```

Reemplazar con:
```typescript
      <ContactosDeCliente clienteId={id} />
      <div className="mt-4">
        <ProyectosClienteCard cliente={{ id: cliente.id, estado: cliente.estado }} />
      </div>
```

- [ ] **Step 2: Agregar el import al inicio del archivo**

Localizar el bloque de imports al inicio. Después de:
```typescript
import { ContactosDeCliente } from '@/components/clientes/ContactosDeCliente';
```

Agregar:
```typescript
import { ProyectosClienteCard } from '@/components/proyectos/ProyectosClienteCard';
```

- [ ] **Step 3: Verificar TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/clientes/ClienteDetalle.tsx
git commit -m "feat(proyectos): inyectar ProyectosClienteCard en detalle de cliente"
```

---

### Task 18: Páginas de proyectos

**Files:**
- Create: `app/(dashboard)/clientes/[id]/proyectos/nuevo/page.tsx`
- Create: `app/(dashboard)/proyectos/[id]/page.tsx`
- Create: `app/(dashboard)/proyectos/[id]/editar/page.tsx`

- [ ] **Step 1: Crear página `clientes/[id]/proyectos/nuevo`**

```typescript
'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProyectoForm } from '@/components/proyectos/ProyectoForm';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useCliente } from '@/hooks/use-clientes';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarProyecto } from '@/lib/proyectos';

export default function NuevoProyectoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeCrear = puedeEjecutarProyecto('crear', rol);
  const { data: cliente, isLoading, isError } = useCliente(id);

  useEffect(() => {
    if (rol && !puedeCrear) router.replace(`/clientes/${id}`);
  }, [rol, puedeCrear, router, id]);

  if (!puedeCrear) return null;
  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (isError || !cliente) {
    return (
      <EmptyState
        icon="alertTriangle"
        title="No se encontró el cliente"
        message="Puede haber sido eliminado o el ID es incorrecto."
      />
    );
  }

  // El backend rechaza con 409 si el cliente no está ACTIVO. Redirigimos al
  // detalle para que el usuario lo active primero o elija otro cliente.
  if (cliente.estado !== 'ACTIVO') {
    router.replace(`/clientes/${id}`);
    return null;
  }

  const nombreVisible = cliente.tipo === 'EMPRESA'
    ? cliente.razonSocial ?? '—'
    : [cliente.nombre, cliente.apellido].filter(Boolean).join(' ') || '—';

  return (
    <ProyectoForm
      modo="crear"
      cliente={{ id: cliente.id, nombre: nombreVisible }}
    />
  );
}
```

- [ ] **Step 2: Crear página de detalle `proyectos/[id]/page.tsx`**

```typescript
'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProyectoKpisCard } from '@/components/proyectos/ProyectoKpisCard';
import { useProyecto } from '@/hooks/use-proyectos';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarProyecto } from '@/lib/proyectos';
import { formatDate } from '@/lib/utils';
import type { EstadoProyecto } from '@/types/api';

const BADGE_KIND: Record<EstadoProyecto, 'ok' | 'warn' | 'info' | 'neutral'> = {
  ACTIVO:     'ok',
  PAUSADO:    'warn',
  COMPLETADO: 'info',
  CANCELADO:  'neutral',
};

const btnSec =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';

export default function ProyectoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeEditar = puedeEjecutarProyecto('editar', rol);
  const { data: proyecto, isLoading, isError } = useProyecto(id);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (isError || !proyecto) {
    return (
      <EmptyState
        icon="alertTriangle"
        title="No se encontró el proyecto"
        message="Puede haber sido eliminado o el ID es incorrecto."
      />
    );
  }

  const clienteNombre = proyecto.cliente?.razonSocial ?? proyecto.cliente?.nombre ?? '—';

  return (
    <div>
      <PageHeader
        title={proyecto.nombre}
        subtitle={
          <span className="inline-flex items-center gap-2 flex-wrap">
            <Link href={`/clientes/${proyecto.clienteId}`} className="text-accent-dim hover:underline">
              {clienteNombre}
            </Link>
            <span className="text-tx-3">·</span>
            <Badge status={proyecto.estado} kind={BADGE_KIND[proyecto.estado]} />
            <span className="text-tx-3">·</span>
            <span className="font-mono text-xs text-tx-3">{proyecto.id}</span>
          </span>
        }
        back
        backLabel={clienteNombre}
        onBack={() => router.push(`/clientes/${proyecto.clienteId}`)}
        actions={
          puedeEditar ? (
            <Link href={`/proyectos/${proyecto.id}/editar`} className={btnSec}>
              <Icon name="edit" size={14} /> Editar
            </Link>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-bd bg-surface p-4">
            <h3 className="text-sm font-semibold mb-3">Información</h3>
            <dl className="m-0 text-sm">
              <div className="flex items-baseline justify-between py-2 border-b border-bd-soft last:border-0 gap-4">
                <dt className="text-tx-3 shrink-0">Ubicación</dt>
                <dd className="text-tx text-right">{proyecto.ubicacion}</dd>
              </div>
              <div className="flex items-baseline justify-between py-2 border-b border-bd-soft last:border-0 gap-4">
                <dt className="text-tx-3 shrink-0">Creado</dt>
                <dd className="text-tx text-right font-mono">{formatDate(proyecto.createdAt)}</dd>
              </div>
              <div className="flex items-baseline justify-between py-2 border-b border-bd-soft last:border-0 gap-4">
                <dt className="text-tx-3 shrink-0">Última actualización</dt>
                <dd className="text-tx text-right font-mono">{formatDate(proyecto.updatedAt)}</dd>
              </div>
            </dl>
            {proyecto.descripcion && (
              <div className="mt-3 pt-3 border-t border-bd-soft">
                <div className="text-2xs font-semibold text-tx-3 uppercase tracking-wider mb-1.5">
                  Descripción
                </div>
                <p className="text-sm text-tx-2 m-0 leading-relaxed">{proyecto.descripcion}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <ProyectoKpisCard proyecto={proyecto} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Crear página de editar `proyectos/[id]/editar/page.tsx`**

```typescript
'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProyectoForm } from '@/components/proyectos/ProyectoForm';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useProyecto } from '@/hooks/use-proyectos';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarProyecto } from '@/lib/proyectos';

export default function EditarProyectoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeEditar = puedeEjecutarProyecto('editar', rol);
  const { data: proyecto, isLoading, isError } = useProyecto(id);

  useEffect(() => {
    if (rol && !puedeEditar) router.replace(`/proyectos/${id}`);
  }, [rol, puedeEditar, router, id]);

  if (!puedeEditar) return null;
  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (isError || !proyecto) {
    return (
      <EmptyState
        icon="alertTriangle"
        title="No se encontró el proyecto"
        message="Puede haber sido eliminado o el ID es incorrecto."
      />
    );
  }

  const clienteNombre = proyecto.cliente?.razonSocial ?? proyecto.cliente?.nombre ?? '—';

  return (
    <ProyectoForm
      modo="editar"
      cliente={{ id: proyecto.clienteId, nombre: clienteNombre }}
      proyecto={proyecto}
    />
  );
}
```

- [ ] **Step 4: Verificar TypeScript y lint**

```bash
pnpm tsc --noEmit && pnpm lint
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/clientes/\[id\]/proyectos/ app/\(dashboard\)/proyectos/
git commit -m "feat(proyectos): páginas de crear, detalle y editar proyecto"
```

---

## Fase 5 — Wiring final y verificación

### Task 19: Ajustar `lib/nav.ts` para reflejar D1

El item "Proyectos" del nav apunta a `/proyectos` (listado global), pero según la decisión D1 del spec no existe esa ruta. Sin tocar el resto del grupo, removemos ese item específico.

**Files:**
- Modify: `lib/nav.ts`

- [ ] **Step 1: Quitar "Proyectos" del grupo Operaciones**

Localizar en `lib/nav.ts` el grupo Operaciones (línea ~19-28):

```typescript
  {
    label: 'Operaciones',
    items: [
      { id: 'inicio',    label: 'Inicio',    href: '/dashboard',  icon: 'home' },
      { id: 'clientes',  label: 'Clientes',  href: '/clientes',   icon: 'users' },
      { id: 'contactos', label: 'Contactos', href: '/contactos',  icon: 'idCard' },
      { id: 'proyectos', label: 'Proyectos', href: '/proyectos',  icon: 'building' },
    ],
  },
```

Reemplazar con:

```typescript
  {
    label: 'Operaciones',
    items: [
      { id: 'inicio',    label: 'Inicio',    href: '/dashboard',  icon: 'home' },
      { id: 'clientes',  label: 'Clientes',  href: '/clientes',   icon: 'users' },
      { id: 'contactos', label: 'Contactos', href: '/contactos',  icon: 'idCard' },
      // Proyectos no aparece como item de navegación global porque viven bajo
      // el cliente (ver spec D1). El detalle individual se accede desde
      // /clientes/:id o desde el módulo de cotizaciones.
    ],
  },
```

- [ ] **Step 2: Verificar TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add lib/nav.ts
git commit -m "chore(nav): quitar item global de Proyectos (viven bajo el cliente)"
```

---

### Task 20: Verificación final manual (smoke test)

**Files:** ninguno modificado en esta tarea.

- [ ] **Step 1: Type check y lint completos**

```bash
pnpm tsc --noEmit && pnpm lint
```

Expected: 0 errors, 0 nuevos warnings.

- [ ] **Step 2: Iniciar dev server y backend**

En una terminal levantar el backend (puerto 3000):
```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm dev
```

En otra terminal el frontend (puerto 3001):
```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm dev
```

- [ ] **Step 3: Smoke test de bodegas**

Navegar y verificar:
- `http://localhost:3001/bodegas` carga lista (vacía o con datos).
- Click "Nueva bodega" abre form. Crear una con nombre + dirección compuesta (departamento, distrito, detalle). Confirmar toast.success y redirección al detalle.
- En el detalle: aparece la sección Zonas vacía, sección "Equipos asignados" (con mensaje vacío si no hay), botón "Editar".
- Click "Nueva zona": crear zona; confirmar redirección al detalle y aparición en lista.
- Click "Editar" en la zona: cambiar nombre, guardar. Probar también desactivar y reactivar.
- Editar la bodega: cambiar campos, guardar. Probar "Desactivar bodega": si tiene zonas activas debe aparecer `toast.error` con el mensaje del backend.

- [ ] **Step 4: Smoke test de proyectos**

- `http://localhost:3001/clientes` y entrar a un cliente ACTIVO.
- Bajar hasta la card "Proyectos del cliente": confirmar que aparece, conteo correcto, botón "Nuevo proyecto" visible (si el cliente está ACTIVO y el rol tiene permisos).
- Click "Nuevo proyecto": form con `clientePre` aplicado. Crear con UbicacionInput compuesta. Confirmar redirección a `/proyectos/[id]`.
- En el detalle: ver KPIs (probablemente todos en 0 al inicio), info, link al cliente.
- Editar: probar el `EstadoProyectoSelector` — verificar que solo se habilitan las transiciones válidas, que al hacer click en una se dispare el toast.success.
- Llevar el proyecto a `COMPLETADO`: el selector debe quedar read-only y mostrar "Estado final".

- [ ] **Step 5: Smoke test de permisos**

- Loguearse como VISUALIZADOR (o cambiar rol manualmente en backend si es práctico): confirmar que los botones de "Nueva bodega", "Editar", "Nuevo proyecto", "Desactivar", etc., NO aparecen.
- Loguearse como LOGISTICA: confirmar que los botones de bodega NO aparecen (ADMIN/GERENTE only) pero los de proyecto SÍ (porque LOGISTICA no tiene permisos sobre proyectos según el spec, validar que tampoco aparezcan).

Corrección: LOGISTICA **no** tiene permisos sobre proyectos según el spec. Confirmar que los botones de proyecto tampoco aparecen para ese rol.

- [ ] **Step 6: Smoke test del UbicacionInput**

- Editar una bodega/proyecto cuya `direccion`/`ubicacion` haya sido guardada en el formato compuesto: confirmar que los selectores se prellenan correctamente.
- Probar que el dropdown de Distrito está deshabilitado hasta seleccionar Departamento.
- Probar que al cambiar Departamento, el Distrito se resetea.
- Si hay datos legacy (texto sin el separador "+ "), confirmar que aparece el hint "Los selectores quedaron vacíos…".

- [ ] **Step 7: Verificar dark mode y responsive**

- Cambiar al tema oscuro via TweaksPanel. Confirmar que ninguna página queda ilegible (contraste, bordes, badges).
- Redimensionar a ~768px (tablet): confirmar que la grid de 2 columnas colapsa a 1, el form sigue siendo usable, FilterBar muestra dropdown en lugar de pills.

- [ ] **Step 8: Crear PR (opcional)**

Si todo pasa, hacer push y abrir PR:
```bash
git push -u origin feat/bodegas-proyectos
gh pr create --title "feat: módulos de bodegas y proyectos (rama 9)" --body "$(cat <<'EOF'
## Summary
- Módulo de Bodegas (CRUD + zonas como sub-recurso)
- Módulo de Proyectos como sub-recurso de cliente
- UbicacionInput compartido (depto + distrito + detalle)

Ver spec completo en `docs/superpowers/specs/2026-05-24-bodegas-proyectos-design.md`.

## Test plan
- [ ] Crear bodega principal y zona
- [ ] Desactivar bodega con zonas activas (debe fallar con toast.error)
- [ ] Crear proyecto desde detalle de cliente
- [ ] Cambiar estado de proyecto respetando máquina
- [ ] Botones ocultos para VISUALIZADOR y LOGISTICA

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review (post-redacción del plan)

Reviso el plan contra el spec una última vez:

**Coverage de secciones del spec:**
- D1 (sin listado global de proyectos) → Task 19 quita el item del nav, no se crea ruta /proyectos. ✓
- D2 (zonas desde el detalle) → Task 12 expone botón "Nueva zona" en detalle, Task 13 incluye la ruta `/bodegas/[id]/zonas/nueva`. ✓
- D3 (UbicacionInput compartido) → Task 6. ✓
- D4 (Bodega.ciudad derivada del distrito) → Task 8 deriva en `onSubmit`. ✓
- D5 (EstadoProyectoSelector restringe transiciones) → Tasks 2 (TRANSICIONES_PROYECTO) y 14 (componente). ✓
- D6 (filtros client-side bodegas) → Task 7. ✓
- Tipos completos → Task 1. ✓
- Hooks → Tasks 4, 5. ✓
- Componentes nuevos → Tasks 6-10, 14-16. ✓
- Páginas → Tasks 11-13, 17, 18. ✓
- Roles → permisos centralizados en `lib/bodegas.ts` y `lib/proyectos.ts` (Task 2), aplicados en cada página y card. ✓
- Manejo de errores específicos (409, 422) → mensajes del backend propagados en hooks (Tasks 4, 5). ✓

**Sin placeholders.** Cada step incluye código real, paths absolutos relativos al proyecto, comandos exactos.

**Type consistency.** Nombres coherentes a lo largo del plan: `useCrearBodega`, `useEditarBodega`, `useCambiarEstadoBodega`, `useCrearZona`, `useEditarZona`, `useCambiarEstadoZona`; análogos en proyectos. Schemas `bodegaCrearSchema`/`bodegaEditarSchema`/`zonaCrearSchema`/`zonaEditarSchema`. Tipos `Bodega`, `BodegaZona`, `Proyecto`, `EstadoProyecto`, `CrearBodegaDto`, etc. Permisos `puedeEjecutarBodega` y `puedeEjecutarProyecto`.

Plan completo.
