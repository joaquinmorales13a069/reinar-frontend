# RAMA 6 — `feat/herramientas` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el módulo "Herramientas & Consumibles" (RAMA 6) — catálogo de tipos de herramienta con sus unidades físicas y catálogo de consumibles con ajuste de stock auditado.

**Architecture:** Una sola ruta `/herramientas` con dos tabs (Tipos / Consumibles) gobernados por `?tab=`. Tipos y consumibles son recursos CRUD independientes; las unidades son sub-recurso del tipo (creación inline + selector de estado). El módulo sigue los patrones ya establecidos por la RAMA 5 (Equipos): hooks de React Query por entidad, componentes en `components/herramientas/`, helpers y labels en `lib/herramientas.ts`, formularios RHF + Zod con mapeo de errores Zod del backend.

**Tech Stack:** Next.js 19 (App Router), React 19, React Query v5, Zustand, React Hook Form + Zod, Axios (cliente `lib/api.ts` con auth/refresh ya configurado), sonner para toasts, decimal.js para montos, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-05-21-feat-herramientas-design.md`

**Verificación:** El proyecto no tiene tests. Cada tarea termina con `pnpm tsc --noEmit && pnpm lint` y un commit en `feat/herramientas`.

---

## File Structure

**Crear:**
- `lib/herramientas.ts` — labels de categorías/estados, helper de permisos por rol.
- `hooks/use-herramientas.ts` — queries y mutations de tipos + unidades + mantenimientos de unidad.
- `hooks/use-consumibles.ts` — queries y mutations de consumibles + ajuste de stock.
- `components/herramientas/TabsHerramientas.tsx` — switch tab vía `?tab=`.
- `components/herramientas/HerramientasTiposList.tsx` — `<FilterBar>` + tabla de tipos.
- `components/herramientas/HerramientaTipoForm.tsx` — RHF + Zod (crear y editar).
- `components/herramientas/UnidadCreatePanel.tsx` — panel inline en detalle del tipo.
- `components/herramientas/UnidadEstadoSelector.tsx` — selector con los 4 estados editables.
- `components/herramientas/UnidadMantenimientosCard.tsx` — últimos 5 mantenimientos.
- `components/herramientas/ConsumiblesList.tsx` — `<FilterBar>` + tabla de consumibles.
- `components/herramientas/ConsumibleForm.tsx` — RHF + Zod (crear y editar).
- `components/herramientas/StockBar.tsx` — barra de progreso reusable.
- `components/herramientas/AjusteStockPanel.tsx` — entrada/salida + delta + motivo.
- `app/(dashboard)/herramientas/page.tsx`
- `app/(dashboard)/herramientas/tipos/nuevo/page.tsx`
- `app/(dashboard)/herramientas/tipos/[id]/page.tsx`
- `app/(dashboard)/herramientas/tipos/[id]/editar/page.tsx`
- `app/(dashboard)/herramientas/unidades/[id]/page.tsx`
- `app/(dashboard)/herramientas/consumibles/nuevo/page.tsx`
- `app/(dashboard)/herramientas/consumibles/[id]/page.tsx`
- `app/(dashboard)/herramientas/consumibles/[id]/editar/page.tsx`

**Modificar:**
- `types/api.ts` — agregar tipos del módulo.

---

## Task 1: Tipos TypeScript y labels

**Files:**
- Modify: `types/api.ts` (append al final del archivo)
- Create: `lib/herramientas.ts`

- [ ] **Step 1: Agregar tipos al final de `types/api.ts`**

```ts
// ============================================================
// Herramientas & Consumibles (Rama 6)
// ============================================================

export type CategoriaHerramienta =
  | 'MANGUERA'
  | 'BOQUILLA'
  | 'EPP'
  | 'HERRAMIENTA_MANUAL'
  | 'OTRO';

export type CategoriaConsumible =
  | 'ABRASIVO'
  | 'PINTURA'
  | 'LUBRICANTE'
  | 'QUIMICO'
  | 'OTRO';

export type EstadoHerramienta =
  | 'DISPONIBLE'
  | 'RESERVADA'     // gestionado por reservas/cotizaciones
  | 'RENTADA'       // gestionado por actas
  | 'MANTENIMIENTO' // gestionado por el módulo de mantenimientos
  | 'USO_INTERNO'
  | 'INACTIVO';

// Subconjunto de estados que el backend acepta vía PATCH /unidades/:id/estado.
// Los otros (RESERVADA, RENTADA) los maneja el sistema y el UI no debe ofrecerlos.
export type EstadoUnidadEditable =
  | 'DISPONIBLE'
  | 'MANTENIMIENTO'
  | 'USO_INTERNO'
  | 'INACTIVO';

export type HerramientaTipo = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoria: CategoriaHerramienta;
  // Decimal serializado como string — usar decimal.js para operar, formatCurrency para mostrar.
  tarifaDia: string;
  tarifaSemana: string;
  tarifaMes: string;
  activo: boolean;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
  // El backend del detalle (`GET /herramientas/:id`) incluye `unidades` y/o `_count`.
  unidades?: HerramientaUnidad[];
  _count?: { unidades?: number };
};

export type HerramientaUnidad = {
  id: string;
  codigoInterno: string;
  herramientaTipoId: string;
  estado: EstadoHerramienta;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CrearHerramientaTipoDto = {
  codigo: string;
  nombre: string;
  descripcion?: string;
  categoria: CategoriaHerramienta;
  tarifaDia: number;
  tarifaSemana: number;
  tarifaMes: number;
  notas?: string;
};

export type ActualizarHerramientaTipoDto = Partial<
  Omit<CrearHerramientaTipoDto, 'codigo'>
>;

export type FiltrosHerramientas = {
  page?: number;
  limit?: number;
  search?: string;
  categoria?: CategoriaHerramienta;
  activo?: boolean;
};

export type CrearUnidadDto = { notas?: string };

export type FiltrosUnidades = { estado?: EstadoHerramienta };

// Tipo mínimo del mantenimiento devuelto por GET /unidades/:id/mantenimientos.
// El módulo completo de mantenimientos (Rama 15) lo extenderá.
export type UnidadMantenimientoResumen = {
  id: string;
  tipo: string;
  descripcion: string | null;
  fechaIngreso: string;
  fechaSalida: string | null;
  proveedor: string | null;
  estado: string;
};

export type Consumible = {
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
};

export type CrearConsumibleDto = {
  codigo: string;
  nombre: string;
  descripcion?: string;
  categoria: CategoriaConsumible;
  precioUnitario: number;
  stockActual: number;
  stockMinimo: number;
  unidad: string;
  notas?: string;
};

// stockActual no es editable vía PUT — el backend lo rechaza, se ajusta solo
// vía PATCH /:id/stock (ver AjusteStockDto).
export type ActualizarConsumibleDto = Partial<
  Omit<CrearConsumibleDto, 'codigo' | 'stockActual'>
>;

export type FiltrosConsumibles = {
  page?: number;
  limit?: number;
  search?: string;
  categoria?: CategoriaConsumible;
  activo?: boolean;
  stockBajo?: boolean;
};

export type AjusteStockDto = {
  // El backend valida que sea entero != 0; positivo = entrada, negativo = salida.
  delta: number;
  motivo: string;
};
```

- [ ] **Step 2: Crear `lib/herramientas.ts`**

```ts
import type {
  CategoriaHerramienta,
  CategoriaConsumible,
  EstadoHerramienta,
} from '@/types/api';

export const CATEGORIAS_HERRAMIENTA_LABEL: Record<CategoriaHerramienta, string> = {
  MANGUERA: 'Manguera',
  BOQUILLA: 'Boquilla',
  EPP: 'EPP',
  HERRAMIENTA_MANUAL: 'Herramienta manual',
  OTRO: 'Otro',
};

export const CATEGORIAS_CONSUMIBLE_LABEL: Record<CategoriaConsumible, string> = {
  ABRASIVO: 'Abrasivo',
  PINTURA: 'Pintura',
  LUBRICANTE: 'Lubricante',
  QUIMICO: 'Químico',
  OTRO: 'Otro',
};

export const ESTADO_HERRAMIENTA_LABEL: Record<EstadoHerramienta, string> = {
  DISPONIBLE: 'Disponible',
  RESERVADA: 'Reservada',
  RENTADA: 'Rentada',
  MANTENIMIENTO: 'Mantenimiento',
  USO_INTERNO: 'Uso interno',
  INACTIVO: 'Inactiva',
};

export const ESTADO_HERRAMIENTA_KIND: Record<
  EstadoHerramienta,
  'ok' | 'warn' | 'danger' | 'info' | 'neutral'
> = {
  DISPONIBLE: 'ok',
  RESERVADA: 'warn',
  RENTADA: 'info',
  MANTENIMIENTO: 'warn',
  USO_INTERNO: 'neutral',
  INACTIVO: 'danger',
};

// Permisos por acción. La regla viene del backend (herramientas.routes.ts y
// consumibles.routes.ts): admins = ADMIN/GERENTE; inventario = ADMIN/GERENTE/LOGISTICA.
// VISUALIZADOR solo lee.
const PERMISOS_HERRAMIENTAS = {
  crearTipo: ['ADMIN', 'GERENTE'] as const,
  editarTipo: ['ADMIN', 'GERENTE'] as const,
  desactivarTipo: ['ADMIN', 'GERENTE'] as const,
  crearUnidad: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  cambiarEstadoUnidad: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  crearConsumible: ['ADMIN', 'GERENTE'] as const,
  editarConsumible: ['ADMIN', 'GERENTE'] as const,
  desactivarConsumible: ['ADMIN', 'GERENTE'] as const,
  ajustarStock: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
} as const;

export function puedeEjecutar(
  accion: keyof typeof PERMISOS_HERRAMIENTAS,
  rol: string | undefined,
): boolean {
  if (!rol) return false;
  return (PERMISOS_HERRAMIENTAS[accion] as readonly string[]).includes(rol);
}
```

- [ ] **Step 3: Verificar tipos**

Run: `pnpm tsc --noEmit`
Expected: PASS (sin errores).

- [ ] **Step 4: Commit**

```bash
git add types/api.ts lib/herramientas.ts
git commit -m "feat(herramientas): tipos TypeScript y catálogo de labels/permisos"
```

---

## Task 2: Hook `useHerramientas` (tipos + unidades)

**Files:**
- Create: `hooks/use-herramientas.ts`

- [ ] **Step 1: Crear el archivo con todas las queries y mutations**

```ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  PaginatedResponse,
  HerramientaTipo,
  HerramientaUnidad,
  CrearHerramientaTipoDto,
  ActualizarHerramientaTipoDto,
  FiltrosHerramientas,
  FiltrosUnidades,
  CrearUnidadDto,
  EstadoUnidadEditable,
  UnidadMantenimientoResumen,
} from '@/types/api';

// Helper duplicado intencionalmente en cada archivo de hooks: evita una
// dependencia transitiva ("shared/api-error") y mantiene cada hook autocontenido,
// igual que en use-equipos.ts.
function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

export function useHerramientaTipos(params: FiltrosHerramientas = {}) {
  return useQuery({
    queryKey: ['herramientas', params],
    queryFn: () =>
      api
        .get<PaginatedResponse<HerramientaTipo>>('/herramientas', { params })
        .then((r) => r.data),
  });
}

export function useHerramientaTipo(id: string) {
  return useQuery({
    queryKey: ['herramientas', id],
    queryFn: () =>
      api.get<ApiResponse<HerramientaTipo>>(`/herramientas/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

export function useCrearHerramientaTipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CrearHerramientaTipoDto) =>
      api.post<ApiResponse<HerramientaTipo>>('/herramientas', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['herramientas'] });
      toast.success('Tipo de herramienta creado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear el tipo.'));
    },
  });
}

export function useEditarHerramientaTipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ActualizarHerramientaTipoDto }) =>
      api.put<ApiResponse<HerramientaTipo>>(`/herramientas/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['herramientas'] });
      qc.invalidateQueries({ queryKey: ['herramientas', id] });
      toast.success('Cambios guardados.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudieron guardar los cambios.'));
    },
  });
}

export function useDesactivarHerramientaTipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch<ApiResponse<HerramientaTipo>>(`/herramientas/${id}/activo`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (tipo, id) => {
      qc.invalidateQueries({ queryKey: ['herramientas'] });
      qc.invalidateQueries({ queryKey: ['herramientas', id] });
      toast.success(tipo.activo ? 'Tipo activado.' : 'Tipo desactivado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo cambiar el estado.'));
    },
  });
}

export function useUnidadesPorTipo(tipoId: string, filtros: FiltrosUnidades = {}) {
  return useQuery({
    queryKey: ['herramientas', tipoId, 'unidades', filtros],
    queryFn: () =>
      api
        .get<ApiResponse<HerramientaUnidad[]>>(`/herramientas/${tipoId}/unidades`, {
          params: filtros,
        })
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    enabled: !!tipoId,
  });
}

export function useCrearUnidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tipoId, data }: { tipoId: string; data: CrearUnidadDto }) =>
      api
        .post<ApiResponse<HerramientaUnidad>>(`/herramientas/${tipoId}/unidades`, data)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (_data, { tipoId }) => {
      qc.invalidateQueries({ queryKey: ['herramientas', tipoId] });
      qc.invalidateQueries({ queryKey: ['herramientas', tipoId, 'unidades'] });
      // Invalidamos la lista global también porque muestra contadores agregados
      // de unidades disponibles por tipo.
      qc.invalidateQueries({ queryKey: ['herramientas'] });
      toast.success('Unidad creada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear la unidad.'));
    },
  });
}

export function useCambiarEstadoUnidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      unidadId,
      estado,
    }: {
      unidadId: string;
      estado: EstadoUnidadEditable;
      // tipoId se acepta como parte del input para que el onSuccess pueda invalidar
      // la lista nested correspondiente sin tener que leerla del response.
      tipoId: string;
    }) =>
      api
        .patch<ApiResponse<HerramientaUnidad>>(
          `/herramientas/unidades/${unidadId}/estado`,
          { estado },
        )
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (_data, { tipoId }) => {
      qc.invalidateQueries({ queryKey: ['herramientas'] });
      qc.invalidateQueries({ queryKey: ['herramientas', tipoId] });
      qc.invalidateQueries({ queryKey: ['herramientas', tipoId, 'unidades'] });
      toast.success('Estado de la unidad actualizado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo cambiar el estado de la unidad.'));
    },
  });
}

export function useMantenimientosUnidad(unidadId: string) {
  return useQuery({
    queryKey: ['herramientas', 'unidades', unidadId, 'mantenimientos'],
    queryFn: () =>
      api
        .get<PaginatedResponse<UnidadMantenimientoResumen>>(
          `/herramientas/unidades/${unidadId}/mantenimientos`,
        )
        .then((r) => r.data),
    enabled: !!unidadId,
  });
}
```

- [ ] **Step 2: Verificar tipos**

Run: `pnpm tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-herramientas.ts
git commit -m "feat(herramientas): hooks de React Query para tipos y unidades"
```

---

## Task 3: Hook `useConsumibles`

**Files:**
- Create: `hooks/use-consumibles.ts`

- [ ] **Step 1: Crear el archivo**

```ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  PaginatedResponse,
  Consumible,
  CrearConsumibleDto,
  ActualizarConsumibleDto,
  FiltrosConsumibles,
  AjusteStockDto,
} from '@/types/api';

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

export function useConsumibles(params: FiltrosConsumibles = {}) {
  return useQuery({
    queryKey: ['consumibles', params],
    queryFn: () =>
      api
        .get<PaginatedResponse<Consumible>>('/consumibles', { params })
        .then((r) => r.data),
  });
}

export function useConsumible(id: string) {
  return useQuery({
    queryKey: ['consumibles', id],
    queryFn: () =>
      api.get<ApiResponse<Consumible>>(`/consumibles/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

export function useCrearConsumible() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CrearConsumibleDto) =>
      api.post<ApiResponse<Consumible>>('/consumibles', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consumibles'] });
      toast.success('Consumible creado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear el consumible.'));
    },
  });
}

export function useEditarConsumible() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ActualizarConsumibleDto }) =>
      api.put<ApiResponse<Consumible>>(`/consumibles/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['consumibles'] });
      qc.invalidateQueries({ queryKey: ['consumibles', id] });
      toast.success('Cambios guardados.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudieron guardar los cambios.'));
    },
  });
}

export function useAjustarStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AjusteStockDto }) =>
      api
        .patch<ApiResponse<Consumible>>(`/consumibles/${id}/stock`, data)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['consumibles'] });
      qc.invalidateQueries({ queryKey: ['consumibles', id] });
      toast.success('Stock ajustado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo ajustar el stock.'));
    },
  });
}

export function useDesactivarConsumible() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch<ApiResponse<Consumible>>(`/consumibles/${id}/activo`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (consumible, id) => {
      qc.invalidateQueries({ queryKey: ['consumibles'] });
      qc.invalidateQueries({ queryKey: ['consumibles', id] });
      toast.success(consumible.activo ? 'Consumible activado.' : 'Consumible desactivado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo cambiar el estado.'));
    },
  });
}
```

- [ ] **Step 2: Verificar tipos**

Run: `pnpm tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-consumibles.ts
git commit -m "feat(herramientas): hooks de React Query para consumibles"
```

---

## Task 4: Página raíz `/herramientas` con tabs

**Files:**
- Create: `app/(dashboard)/herramientas/page.tsx`
- Create: `components/herramientas/TabsHerramientas.tsx`

- [ ] **Step 1: Crear `app/(dashboard)/herramientas/page.tsx` (Server Component)**

```tsx
import { TabsHerramientas } from '@/components/herramientas/TabsHerramientas';

type Props = { searchParams: Promise<{ tab?: string }> };

export default async function HerramientasPage({ searchParams }: Props) {
  // En Next 19 searchParams es async; lo desempaquetamos antes de usarlo
  // para evitar warnings de "sync access to async params".
  const sp = await searchParams;
  const tab = sp.tab === 'consumibles' ? 'consumibles' : 'tipos';
  return <TabsHerramientas activeTab={tab} />;
}
```

- [ ] **Step 2: Crear `components/herramientas/TabsHerramientas.tsx`**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { HerramientasTiposList } from '@/components/herramientas/HerramientasTiposList';
import { ConsumiblesList } from '@/components/herramientas/ConsumiblesList';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutar } from '@/lib/herramientas';
import Link from 'next/link';

type Tab = 'tipos' | 'consumibles';

const btnPri =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors';

const tabCls = (active: boolean) =>
  `inline-flex items-center gap-2 px-3 py-2 text-sm border-b-2 transition-colors ${
    active
      ? 'border-accent text-tx font-semibold'
      : 'border-transparent text-tx-2 hover:text-tx'
  }`;

export function TabsHerramientas({ activeTab }: { activeTab: Tab }) {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');

  const puedeCrearTipo = puedeEjecutar('crearTipo', rol);
  const puedeCrearConsumible = puedeEjecutar('crearConsumible', rol);

  // replace, no push: queremos que cambiar de tab no apile la historia.
  function setTab(next: Tab) {
    router.replace(`/herramientas?tab=${next}`);
  }

  const action =
    activeTab === 'tipos'
      ? puedeCrearTipo && (
          <Link href="/herramientas/tipos/nuevo" className={btnPri}>
            <Icon name="plus" size={14} /> Nuevo tipo
          </Link>
        )
      : puedeCrearConsumible && (
          <Link href="/herramientas/consumibles/nuevo" className={btnPri}>
            <Icon name="plus" size={14} /> Nuevo consumible
          </Link>
        );

  return (
    <div>
      <PageHeader
        title="Herramientas & Consumibles"
        subtitle="Catálogo de tipos, unidades físicas y materiales de obra."
        actions={action}
      />

      <div className="flex border-b border-bd mb-4">
        <button
          type="button"
          className={tabCls(activeTab === 'tipos')}
          onClick={() => setTab('tipos')}
        >
          <Icon name="hammer" size={13} /> Tipos de herramienta
        </button>
        <button
          type="button"
          className={tabCls(activeTab === 'consumibles')}
          onClick={() => setTab('consumibles')}
        >
          <Icon name="box" size={13} /> Consumibles
        </button>
      </div>

      {activeTab === 'tipos' ? <HerramientasTiposList /> : <ConsumiblesList />}
    </div>
  );
}
```

- [ ] **Step 3: Crear stubs de `HerramientasTiposList` y `ConsumiblesList`** (necesarios para que tsc pase; se reemplazan en Task 5 y Task 12)

Crear `components/herramientas/HerramientasTiposList.tsx`:

```tsx
'use client';

export function HerramientasTiposList() {
  return <div className="text-sm text-tx-3 p-4">Lista de tipos — pendiente.</div>;
}
```

Crear `components/herramientas/ConsumiblesList.tsx`:

```tsx
'use client';

export function ConsumiblesList() {
  return <div className="text-sm text-tx-3 p-4">Lista de consumibles — pendiente.</div>;
}
```

- [ ] **Step 4: Verificar tipos**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/herramientas/page.tsx components/herramientas/TabsHerramientas.tsx components/herramientas/HerramientasTiposList.tsx components/herramientas/ConsumiblesList.tsx
git commit -m "feat(herramientas): página raíz con tabs Tipos/Consumibles"
```

---

## Task 5: Lista de tipos de herramienta

**Files:**
- Modify (reemplazar stub): `components/herramientas/HerramientasTiposList.tsx`

- [ ] **Step 1: Reemplazar el archivo con la lista completa**

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FilterBar } from '@/components/ui/FilterBar';
import { Pagination } from '@/components/ui/Pagination';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useHerramientaTipos } from '@/hooks/use-herramientas';
import { useAuthStore } from '@/stores/auth.store';
import { CATEGORIAS_HERRAMIENTA_LABEL, puedeEjecutar } from '@/lib/herramientas';
import { formatCurrency } from '@/lib/utils';
import type { CategoriaHerramienta } from '@/types/api';

const PAGE_SIZE = 10;

// Mismo patrón que EquiposList — 300ms para no disparar request por cada tecla.
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function HerramientasTiposList() {
  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');
  const puedeVerInactivos = puedeEjecutar('desactivarTipo', rol);

  const [busqueda, setBusqueda] = useState('');
  const search = useDebounced(busqueda.trim(), 300);
  const [filterCat, setFilterCat] = useState<CategoriaHerramienta | null>(null);
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useHerramientaTipos({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    categoria: filterCat ?? undefined,
    // El backend usa `activo: true` por default. Si queremos ver inactivos
    // también, pasamos `activo: false` (lo cual el backend interpreta como
    // "mostrar inactivos"; ver filtrosHerramientasSchema en server).
    activo: incluirInactivos ? false : true,
  });

  function toggleCat(c: CategoriaHerramienta) {
    setFilterCat((prev) => (prev === c ? null : c));
    setPage(1);
  }
  function clearAll() {
    setBusqueda('');
    setFilterCat(null);
    setIncluirInactivos(false);
    setPage(1);
  }

  return (
    <div className="rounded-lg border border-bd bg-surface overflow-hidden">
      <FilterBar
        search={busqueda}
        onSearch={(v) => {
          setBusqueda(v);
          setPage(1);
        }}
        placeholder="Buscar por código o nombre…"
        chips={Object.entries(CATEGORIAS_HERRAMIENTA_LABEL).map(([k, label]) => ({
          label,
          active: filterCat === k,
          onToggle: () => toggleCat(k as CategoriaHerramienta),
        }))}
        onClear={clearAll}
      />

      {puedeVerInactivos && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-bd bg-bg-sunken text-xs">
          <input
            id="tipos-incluir-inactivos"
            type="checkbox"
            className="accent-accent"
            checked={incluirInactivos}
            onChange={(e) => {
              setIncluirInactivos(e.target.checked);
              setPage(1);
            }}
          />
          <label htmlFor="tipos-incluir-inactivos" className="text-tx-2 cursor-pointer">
            Incluir tipos inactivos en la lista
          </label>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Spinner />
        </div>
      ) : (data?.data ?? []).length === 0 ? (
        <EmptyState
          icon="hammer"
          title="Sin tipos"
          message="No se encontraron tipos de herramienta con los filtros aplicados."
        />
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-bg-sunken text-2xs uppercase tracking-wider text-tx-3">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Código</th>
              <th className="text-left px-4 py-2 font-medium">Nombre</th>
              <th className="text-left px-4 py-2 font-medium">Categoría</th>
              <th className="text-right px-4 py-2 font-medium">Tarifa/día</th>
              <th className="text-left px-4 py-2 font-medium">Unidades</th>
              <th className="text-left px-4 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {(data?.data ?? []).map((t) => {
              const totalUnidades = t._count?.unidades ?? t.unidades?.length ?? 0;
              return (
                <tr key={t.id} className="border-t border-bd hover:bg-bg-sunken transition-colors">
                  <td className="px-4 py-3 font-mono font-medium">
                    <Link href={`/herramientas/tipos/${t.id}`} className="hover:underline">
                      {t.codigo}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/herramientas/tipos/${t.id}`} className="hover:underline">
                      <div className="font-medium">{t.nombre}</div>
                      {t.descripcion && (
                        <div className="text-xs text-tx-3 mt-0.5">{t.descripcion}</div>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={CATEGORIAS_HERRAMIENTA_LABEL[t.categoria]} kind="info" />
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(t.tarifaDia)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-tx-2">
                    {totalUnidades > 0 ? `${totalUnidades} unidad${totalUnidades === 1 ? '' : 'es'}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      status={t.activo ? 'ACTIVO' : 'INACTIVO'}
                      kind={t.activo ? 'ok' : 'neutral'}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={data?.meta.total ?? 0}
        onPage={setPage}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos y lint**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/herramientas/HerramientasTiposList.tsx
git commit -m "feat(herramientas): lista de tipos con filtros, búsqueda y paginación"
```

---

## Task 6: Formulario de tipo de herramienta

**Files:**
- Create: `components/herramientas/HerramientaTipoForm.tsx`

- [ ] **Step 1: Crear el formulario reutilizable (crear/editar)**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { Icon } from '@/components/ui/Icon';
import {
  useCrearHerramientaTipo,
  useEditarHerramientaTipo,
} from '@/hooks/use-herramientas';
import { CATEGORIAS_HERRAMIENTA_LABEL } from '@/lib/herramientas';
import type { HerramientaTipo, CategoriaHerramienta } from '@/types/api';

// Replica el schema del backend (herramientas.schemas.ts) — los mensajes en
// español dan feedback inmediato sin esperar al server.
const baseSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio.'),
  descripcion: z.string().optional(),
  categoria: z.enum(['MANGUERA', 'BOQUILLA', 'EPP', 'HERRAMIENTA_MANUAL', 'OTRO']),
  tarifaDia: z.coerce.number().positive('La tarifa por día debe ser positiva.'),
  tarifaSemana: z.coerce.number().positive('La tarifa por semana debe ser positiva.'),
  tarifaMes: z.coerce.number().positive('La tarifa por mes debe ser positiva.'),
  notas: z.string().optional(),
});

const crearSchema = baseSchema.extend({
  codigo: z
    .string()
    .min(1, 'El código es obligatorio.')
    .max(20, 'Máximo 20 caracteres.')
    .regex(/^[A-Z0-9-]+$/, 'Solo letras mayúsculas, números y guiones.'),
});

type CrearFormData = z.infer<typeof crearSchema>;
type EditarFormData = z.infer<typeof baseSchema>;

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-1';
const hintCls = 'text-xs text-tx-3 mt-1';

type Props =
  | { mode: 'crear'; tipo?: undefined }
  | { mode: 'editar'; tipo: HerramientaTipo };

export function HerramientaTipoForm(props: Props) {
  const isNew = props.mode === 'crear';
  const router = useRouter();

  const crear = useCrearHerramientaTipo();
  const editar = useEditarHerramientaTipo();

  type FormData = CrearFormData | EditarFormData;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(isNew ? crearSchema : baseSchema) as never,
    defaultValues: isNew
      ? {
          codigo: '',
          nombre: '',
          categoria: 'HERRAMIENTA_MANUAL' as CategoriaHerramienta,
          tarifaDia: undefined as unknown as number,
          tarifaSemana: undefined as unknown as number,
          tarifaMes: undefined as unknown as number,
        }
      : {
          nombre: props.tipo.nombre,
          descripcion: props.tipo.descripcion ?? '',
          categoria: props.tipo.categoria,
          tarifaDia: Number(props.tipo.tarifaDia),
          tarifaSemana: Number(props.tipo.tarifaSemana),
          tarifaMes: Number(props.tipo.tarifaMes),
          notas: props.tipo.notas ?? '',
        },
  });

  function aplicarErroresApi(err: unknown) {
    const anyErr = err as {
      response?: { data?: { error?: { details?: { path: string; message: string }[] } } };
    };
    const details = anyErr?.response?.data?.error?.details;
    if (!details?.length) return;
    for (const d of details) {
      setError(d.path as keyof FormData, { type: 'server', message: d.message });
    }
  }

  async function onSubmit(values: FormData) {
    try {
      if (isNew) {
        const v = values as CrearFormData;
        const tipo = await crear.mutateAsync({
          codigo: v.codigo,
          nombre: v.nombre,
          descripcion: v.descripcion || undefined,
          categoria: v.categoria,
          tarifaDia: v.tarifaDia,
          tarifaSemana: v.tarifaSemana,
          tarifaMes: v.tarifaMes,
          notas: v.notas || undefined,
        });
        router.push(`/herramientas/tipos/${tipo.id}`);
      } else {
        const v = values as EditarFormData;
        await editar.mutateAsync({
          id: props.tipo.id,
          data: {
            nombre: v.nombre,
            descripcion: v.descripcion || undefined,
            categoria: v.categoria,
            tarifaDia: v.tarifaDia,
            tarifaSemana: v.tarifaSemana,
            tarifaMes: v.tarifaMes,
            notas: v.notas || undefined,
          },
        });
        router.push(`/herramientas/tipos/${props.tipo.id}`);
      }
    } catch (err) {
      aplicarErroresApi(err);
    }
  }

  return (
    <form className="max-w-3xl" onSubmit={handleSubmit(onSubmit)}>
      <PageHeader
        title={isNew ? 'Nuevo tipo de herramienta' : `Editar — ${props.tipo.nombre}`}
        subtitle={
          isNew
            ? 'Registrá un tipo de herramienta. Luego podrás agregar unidades físicas.'
            : 'Modificá los datos del tipo.'
        }
        back
        backLabel={isNew ? 'Herramientas' : `Tipo ${props.tipo.codigo}`}
        onBack={() =>
          router.push(isNew ? '/herramientas?tab=tipos' : `/herramientas/tipos/${props.tipo.id}`)
        }
      />

      <FormSection title="Información general">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {isNew ? (
            <div>
              <label className={labelCls}>Código *</label>
              <input
                className={`${(errors as Record<string, unknown>).codigo ? inputErr : inputOk} font-mono uppercase`}
                placeholder="HT-007"
                {...register('codigo' as never, {
                  // Mismo patrón que EquipoForm: forzamos uppercase en cliente para
                  // que coincida con el regex /^[A-Z0-9-]+$/ del backend.
                  onChange: (e) => {
                    e.target.value = String(e.target.value).toUpperCase();
                  },
                })}
              />
              {(errors as Record<string, { message?: string }>).codigo && (
                <p className={errorCls}>
                  {(errors as Record<string, { message?: string }>).codigo.message}
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className={labelCls}>Código</label>
              <input
                className={`${inputOk} font-mono`}
                value={props.tipo.codigo}
                readOnly
                disabled
              />
              <p className={hintCls}>El código no se modifica una vez creado.</p>
            </div>
          )}

          <div>
            <label className={labelCls}>Categoría *</label>
            <select className={inputOk} {...register('categoria')}>
              {Object.entries(CATEGORIAS_HERRAMIENTA_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>Nombre *</label>
            <input
              className={errors.nombre ? inputErr : inputOk}
              placeholder="Ej. Manguera de 100 ft"
              {...register('nombre')}
            />
            {errors.nombre && <p className={errorCls}>{errors.nombre.message}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>Descripción</label>
            <textarea
              className={inputOk}
              rows={2}
              placeholder="Descripción opcional del tipo."
              {...register('descripcion')}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Tarifas">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Tarifa por día (USD) *</label>
            <input
              className={errors.tarifaDia ? inputErr : `${inputOk} font-mono`}
              type="number"
              step="0.01"
              placeholder="15.00"
              {...register('tarifaDia')}
            />
            {errors.tarifaDia && <p className={errorCls}>{errors.tarifaDia.message}</p>}
          </div>
          <div>
            <label className={labelCls}>Tarifa por semana (USD) *</label>
            <input
              className={errors.tarifaSemana ? inputErr : `${inputOk} font-mono`}
              type="number"
              step="0.01"
              placeholder="80.00"
              {...register('tarifaSemana')}
            />
            {errors.tarifaSemana && <p className={errorCls}>{errors.tarifaSemana.message}</p>}
          </div>
          <div>
            <label className={labelCls}>Tarifa por mes (USD) *</label>
            <input
              className={errors.tarifaMes ? inputErr : `${inputOk} font-mono`}
              type="number"
              step="0.01"
              placeholder="280.00"
              {...register('tarifaMes')}
            />
            {errors.tarifaMes && <p className={errorCls}>{errors.tarifaMes.message}</p>}
          </div>
        </div>
      </FormSection>

      <FormSection title="Notas internas">
        <textarea
          className={inputOk}
          rows={3}
          placeholder="Observaciones operativas (taller, manejo, etc.)."
          {...register('notas')}
        />
      </FormSection>

      <div className="flex flex-col sm:flex-row gap-2 mt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center justify-center px-3 py-2 rounded-md border border-bd text-sm text-tx-2 hover:bg-bg-sunken transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed sm:ml-auto"
        >
          <Icon name="check" size={14} />
          {isNew ? 'Crear tipo' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verificar tipos y lint**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/herramientas/HerramientaTipoForm.tsx
git commit -m "feat(herramientas): formulario reutilizable crear/editar tipo"
```

---

## Task 7: Páginas crear/editar tipo

**Files:**
- Create: `app/(dashboard)/herramientas/tipos/nuevo/page.tsx`
- Create: `app/(dashboard)/herramientas/tipos/[id]/editar/page.tsx`

- [ ] **Step 1: Página de crear**

`app/(dashboard)/herramientas/tipos/nuevo/page.tsx`:

```tsx
import { HerramientaTipoForm } from '@/components/herramientas/HerramientaTipoForm';

export default function NuevoTipoPage() {
  return <HerramientaTipoForm mode="crear" />;
}
```

- [ ] **Step 2: Página de editar (con guard de carga y error)**

`app/(dashboard)/herramientas/tipos/[id]/editar/page.tsx`:

```tsx
'use client';

import { use } from 'react';
import Link from 'next/link';
import { HerramientaTipoForm } from '@/components/herramientas/HerramientaTipoForm';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { useHerramientaTipo } from '@/hooks/use-herramientas';

const btnSec =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';

export default function EditarTipoPage({ params }: { params: Promise<{ id: string }> }) {
  // Next 19 entrega params como Promise; use() lo desempaqueta.
  const { id } = use(params);
  const { data: tipo, isLoading, isError } = useHerramientaTipo(id);

  if (isLoading) return <div className="flex justify-center p-12"><Spinner /></div>;
  if (isError || !tipo) {
    return (
      <div>
        <EmptyState
          icon="alertTriangle"
          title="Tipo no encontrado"
          message="El tipo que intentás editar no existe o fue eliminado."
        />
        <div className="text-center">
          <Link href="/herramientas?tab=tipos" className={btnSec}>
            <Icon name="arrowLeft" size={14} /> Volver a herramientas
          </Link>
        </div>
      </div>
    );
  }

  return <HerramientaTipoForm mode="editar" tipo={tipo} />;
}
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/herramientas/tipos/
git commit -m "feat(herramientas): páginas crear/editar tipo"
```

---

## Task 8: Panel inline para crear unidad

**Files:**
- Create: `components/herramientas/UnidadCreatePanel.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useCrearUnidad } from '@/hooks/use-herramientas';

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border border-bd bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const btnSec =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';
const btnPri =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

export function UnidadCreatePanel({ tipoId }: { tipoId: string }) {
  const [open, setOpen] = useState(false);
  const [notas, setNotas] = useState('');
  const crear = useCrearUnidad();

  async function handleConfirmar() {
    try {
      await crear.mutateAsync({ tipoId, data: { notas: notas.trim() || undefined } });
      setNotas('');
      setOpen(false);
    } catch {
      // toast lo dispara el hook
    }
  }

  if (!open) {
    return (
      <button type="button" className={btnSec} onClick={() => setOpen(true)}>
        <Icon name="plus" size={12} /> Agregar unidad
      </button>
    );
  }

  return (
    <div className="rounded-md border border-bd bg-bg-sunken p-3 flex flex-col gap-2">
      <label className="text-xs font-medium text-tx-2">
        Notas (opcional)
      </label>
      <textarea
        className={inputBase}
        rows={2}
        placeholder="Notas internas sobre la unidad — opcional"
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
      />
      <p className="text-xs text-tx-3">
        El código interno se genera automáticamente al crear la unidad.
      </p>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          className={btnSec}
          onClick={() => {
            setOpen(false);
            setNotas('');
          }}
        >
          Cancelar
        </button>
        <button
          type="button"
          className={btnPri}
          disabled={crear.isPending}
          onClick={handleConfirmar}
        >
          <Icon name="check" size={12} /> Crear unidad
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos y lint**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/herramientas/UnidadCreatePanel.tsx
git commit -m "feat(herramientas): panel inline para crear unidad de un tipo"
```

---

## Task 9: Página de detalle del tipo

**Files:**
- Create: `app/(dashboard)/herramientas/tipos/[id]/page.tsx`

- [ ] **Step 1: Crear la página**

```tsx
'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { UnidadCreatePanel } from '@/components/herramientas/UnidadCreatePanel';
import {
  useHerramientaTipo,
  useUnidadesPorTipo,
  useDesactivarHerramientaTipo,
} from '@/hooks/use-herramientas';
import { useAuthStore } from '@/stores/auth.store';
import {
  CATEGORIAS_HERRAMIENTA_LABEL,
  ESTADO_HERRAMIENTA_LABEL,
  ESTADO_HERRAMIENTA_KIND,
  puedeEjecutar,
} from '@/lib/herramientas';
import { formatCurrency } from '@/lib/utils';
import type { EstadoHerramienta } from '@/types/api';

const btnSec =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';

export default function TipoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TipoDetalleClient id={id} />;
}

function TipoDetalleClient({ id }: { id: string }) {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');

  const { data: tipo, isLoading, isError } = useHerramientaTipo(id);
  const { data: unidades = [] } = useUnidadesPorTipo(id);
  const desactivar = useDesactivarHerramientaTipo();
  const [confirmToggle, setConfirmToggle] = useState(false);

  const puedeEditar = puedeEjecutar('editarTipo', rol);
  const puedeDesactivar = puedeEjecutar('desactivarTipo', rol);
  const puedeCrearUnidad = puedeEjecutar('crearUnidad', rol);

  if (isLoading) return <div className="flex justify-center p-12"><Spinner /></div>;
  if (isError || !tipo) {
    return (
      <div>
        <EmptyState
          icon="alertTriangle"
          title="Tipo no encontrado"
          message="El tipo que intentás ver no existe o fue eliminado."
        />
        <div className="text-center">
          <Link href="/herramientas?tab=tipos" className={btnSec}>
            <Icon name="arrowLeft" size={14} /> Volver a herramientas
          </Link>
        </div>
      </div>
    );
  }

  // Conteo por estado para el resumen visual de la card de unidades.
  const conteoPorEstado = unidades.reduce<Record<string, number>>((acc, u) => {
    acc[u.estado] = (acc[u.estado] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title={tipo.nombre}
        subtitle={
          <span className="inline-flex items-center gap-2 flex-wrap">
            <span className="font-mono text-tx-3">{tipo.codigo}</span>
            <span className="text-tx-3">·</span>
            <Badge status={CATEGORIAS_HERRAMIENTA_LABEL[tipo.categoria]} kind="info" />
            <Badge
              status={tipo.activo ? 'ACTIVO' : 'INACTIVO'}
              kind={tipo.activo ? 'ok' : 'neutral'}
            />
          </span>
        }
        back
        backLabel="Herramientas"
        onBack={() => router.push('/herramientas?tab=tipos')}
        actions={
          <>
            {puedeEditar && (
              <Link href={`/herramientas/tipos/${tipo.id}/editar`} className={btnSec}>
                <Icon name="edit" size={14} /> Editar
              </Link>
            )}
            {puedeDesactivar && (
              <button type="button" className={btnSec} onClick={() => setConfirmToggle(true)}>
                <Icon name={tipo.activo ? 'x' : 'refresh'} size={14} />
                {tipo.activo ? 'Desactivar' : 'Activar'}
              </button>
            )}
          </>
        }
      />

      {confirmToggle && (
        <ConfirmRow
          message={
            <>
              ¿{tipo.activo ? 'Desactivar' : 'Activar'} el tipo <b>{tipo.nombre}</b>?
              {tipo.activo && ' Quedará fuera de los catálogos de cotización.'}
            </>
          }
          onCancel={() => setConfirmToggle(false)}
          onConfirm={() => {
            desactivar.mutate(tipo.id);
            setConfirmToggle(false);
          }}
          confirmLabel={tipo.activo ? 'Sí, desactivar' : 'Sí, activar'}
          variant="primary"
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-bd bg-surface p-4">
            <h3 className="font-semibold text-tx mb-3">Tarifas vigentes</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                ['Por día', tipo.tarifaDia],
                ['Por semana', tipo.tarifaSemana],
                ['Por mes', tipo.tarifaMes],
              ].map(([label, val]) => (
                <div key={label} className="rounded-md bg-bg-sunken p-3">
                  <div className="text-2xs uppercase tracking-wider text-tx-3 font-semibold">
                    {label}
                  </div>
                  <div className="font-mono font-semibold mt-1">{formatCurrency(val as string)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-bd bg-surface p-4">
            <h3 className="font-semibold text-tx mb-2">Descripción</h3>
            <p className={`text-sm ${tipo.descripcion ? 'text-tx' : 'text-tx-3'}`}>
              {tipo.descripcion ?? 'Sin descripción registrada.'}
            </p>
          </div>

          {tipo.notas && (
            <div className="rounded-lg border border-bd bg-surface p-4">
              <h3 className="font-semibold text-tx mb-2">Notas internas</h3>
              <p className="text-sm whitespace-pre-line">{tipo.notas}</p>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-bd bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-tx">Unidades ({unidades.length})</h3>
          </div>

          {unidades.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(Object.keys(conteoPorEstado) as EstadoHerramienta[]).map((e) => (
                <Badge
                  key={e}
                  status={`${ESTADO_HERRAMIENTA_LABEL[e]}: ${conteoPorEstado[e]}`}
                  kind={ESTADO_HERRAMIENTA_KIND[e]}
                />
              ))}
            </div>
          )}

          {unidades.length > 0 ? (
            <ul className="flex flex-col">
              {unidades.map((u) => (
                <li key={u.id} className="border-t border-bd first:border-t-0">
                  <Link
                    href={`/herramientas/unidades/${u.id}?tipoId=${tipo.id}`}
                    className="flex items-center justify-between py-2 hover:bg-bg-sunken transition-colors px-1 rounded"
                  >
                    <span className="font-mono text-sm font-medium">{u.codigoInterno}</span>
                    <Badge
                      status={ESTADO_HERRAMIENTA_LABEL[u.estado]}
                      kind={ESTADO_HERRAMIENTA_KIND[u.estado]}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-tx-3">No hay unidades registradas para este tipo.</p>
          )}

          {puedeCrearUnidad && (
            <div className="mt-3">
              <UnidadCreatePanel tipoId={tipo.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos y lint**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/herramientas/tipos/\[id\]/page.tsx
git commit -m "feat(herramientas): página de detalle del tipo con lista de unidades"
```

---

## Task 10: Selector de estado y card de mantenimientos de unidad

**Files:**
- Create: `components/herramientas/UnidadEstadoSelector.tsx`
- Create: `components/herramientas/UnidadMantenimientosCard.tsx`

- [ ] **Step 1: Crear `UnidadEstadoSelector.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { useCambiarEstadoUnidad } from '@/hooks/use-herramientas';
import { ESTADO_HERRAMIENTA_LABEL } from '@/lib/herramientas';
import type { EstadoHerramienta, EstadoUnidadEditable } from '@/types/api';

const ESTADOS_EDITABLES: EstadoUnidadEditable[] = [
  'DISPONIBLE',
  'MANTENIMIENTO',
  'USO_INTERNO',
  'INACTIVO',
];

type Props = {
  unidadId: string;
  tipoId: string;
  estadoActual: EstadoHerramienta;
};

export function UnidadEstadoSelector({ unidadId, tipoId, estadoActual }: Props) {
  const cambiar = useCambiarEstadoUnidad();
  const [confirmEstado, setConfirmEstado] = useState<EstadoUnidadEditable | null>(null);

  // RESERVADA y RENTADA no se ofrecen como opción — los gestiona el sistema
  // (reservas/cotizaciones/actas). Mostramos un aviso en lugar del selector.
  if (estadoActual === 'RESERVADA' || estadoActual === 'RENTADA') {
    return (
      <p className="text-sm text-tx-2">
        Este estado lo gestionan automáticamente cotizaciones y actas. No se puede modificar manualmente.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs text-tx-3 mr-1">Cambiar estado:</span>
        {ESTADOS_EDITABLES.map((e) => (
          <button
            key={e}
            type="button"
            disabled={estadoActual === e}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors ${
              estadoActual === e
                ? 'border-bd bg-bg-sunken text-tx-3 cursor-not-allowed'
                : 'border-bd text-tx-2 hover:bg-bg-sunken'
            }`}
            onClick={() => setConfirmEstado(e)}
          >
            {ESTADO_HERRAMIENTA_LABEL[e]}
          </button>
        ))}
      </div>

      {confirmEstado && (
        <div className="mt-3">
          <ConfirmRow
            message={
              <>
                ¿Cambiar el estado de esta unidad a <b>{ESTADO_HERRAMIENTA_LABEL[confirmEstado]}</b>?
              </>
            }
            onCancel={() => setConfirmEstado(null)}
            onConfirm={() => {
              cambiar.mutate({ unidadId, tipoId, estado: confirmEstado });
              setConfirmEstado(null);
            }}
            confirmLabel="Sí, cambiar"
            variant="primary"
          />
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Crear `UnidadMantenimientosCard.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { useMantenimientosUnidad } from '@/hooks/use-herramientas';
import { formatDate } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';

export function UnidadMantenimientosCard({ unidadId }: { unidadId: string }) {
  const { data, isLoading } = useMantenimientosUnidad(unidadId);

  const items = (data?.data ?? []).slice(0, 5);

  return (
    <div className="rounded-lg border border-bd bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-tx">Mantenimientos recientes</h3>
        {items.length > 0 && (
          <Link
            href={`/mantenimientos?unidadId=${unidadId}`}
            className="text-xs text-tx-2 hover:text-tx hover:underline"
          >
            Ver todos
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center p-4">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-tx-3">Sin mantenimientos registrados.</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((m) => (
            <li
              key={m.id}
              className="border-t border-bd first:border-t-0 py-2 flex items-center justify-between gap-3"
            >
              <div>
                <div className="text-sm font-medium">{m.tipo}</div>
                <div className="text-xs text-tx-3 font-mono">{formatDate(m.fechaIngreso)}</div>
              </div>
              <Badge status={m.estado} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/herramientas/UnidadEstadoSelector.tsx components/herramientas/UnidadMantenimientosCard.tsx
git commit -m "feat(herramientas): selector de estado y card de mantenimientos para unidades"
```

---

## Task 11: Página de detalle de unidad

**Files:**
- Create: `app/(dashboard)/herramientas/unidades/[id]/page.tsx`

- [ ] **Step 1: Crear la página**

```tsx
'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { UnidadEstadoSelector } from '@/components/herramientas/UnidadEstadoSelector';
import { UnidadMantenimientosCard } from '@/components/herramientas/UnidadMantenimientosCard';
import {
  useHerramientaTipo,
  useUnidadesPorTipo,
} from '@/hooks/use-herramientas';
import { useAuthStore } from '@/stores/auth.store';
import {
  CATEGORIAS_HERRAMIENTA_LABEL,
  ESTADO_HERRAMIENTA_LABEL,
  ESTADO_HERRAMIENTA_KIND,
  puedeEjecutar,
} from '@/lib/herramientas';

const btnSec =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';

export default function UnidadDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <UnidadDetalleClient unidadId={id} />;
}

function UnidadDetalleClient({ unidadId }: { unidadId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tipoId = searchParams.get('tipoId') ?? '';
  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');

  // Esta página depende del tipoId en query string para localizar la unidad
  // desde la cache nested (`useUnidadesPorTipo`). El backend no expone
  // GET /unidades/:id aislado — siempre llegamos acá desde el detalle del tipo.
  useEffect(() => {
    if (!tipoId) {
      toast.error('Falta el contexto del tipo. Volvé a abrir desde el detalle del tipo.');
      router.replace('/herramientas?tab=tipos');
    }
  }, [tipoId, router]);

  const { data: tipo, isLoading: loadingTipo } = useHerramientaTipo(tipoId);
  const { data: unidades, isLoading: loadingUnidades } = useUnidadesPorTipo(tipoId);

  const puedeCambiar = puedeEjecutar('cambiarEstadoUnidad', rol);

  if (!tipoId || loadingTipo || loadingUnidades) {
    return <div className="flex justify-center p-12"><Spinner /></div>;
  }

  const unidad = (unidades ?? []).find((u) => u.id === unidadId);

  if (!tipo || !unidad) {
    return (
      <div>
        <EmptyState
          icon="alertTriangle"
          title="Unidad no encontrada"
          message="La unidad no existe o fue eliminada."
        />
        <div className="text-center">
          <Link href="/herramientas?tab=tipos" className={btnSec}>
            <Icon name="arrowLeft" size={14} /> Volver a herramientas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={unidad.codigoInterno}
        subtitle={
          <span className="inline-flex items-center gap-2 flex-wrap">
            <span className="text-tx-2">{tipo.nombre}</span>
            <span className="text-tx-3">·</span>
            <Badge
              status={ESTADO_HERRAMIENTA_LABEL[unidad.estado]}
              kind={ESTADO_HERRAMIENTA_KIND[unidad.estado]}
            />
          </span>
        }
        back
        backLabel={`Tipo ${tipo.codigo}`}
        onBack={() => router.push(`/herramientas/tipos/${tipo.id}`)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-bd bg-surface p-4">
            <h3 className="font-semibold text-tx mb-3">Datos</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-sm">
              <div>
                <dt className="text-xs text-tx-3">Tipo</dt>
                <dd>
                  <Link
                    href={`/herramientas/tipos/${tipo.id}`}
                    className="text-tx-2 hover:underline"
                  >
                    {tipo.nombre}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-tx-3">Categoría</dt>
                <dd>
                  <Badge status={CATEGORIAS_HERRAMIENTA_LABEL[tipo.categoria]} kind="info" />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-tx-3">Código interno</dt>
                <dd className="font-mono">{unidad.codigoInterno}</dd>
              </div>
              <div>
                <dt className="text-xs text-tx-3">Estado actual</dt>
                <dd>
                  <Badge
                    status={ESTADO_HERRAMIENTA_LABEL[unidad.estado]}
                    kind={ESTADO_HERRAMIENTA_KIND[unidad.estado]}
                  />
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-tx-3">Notas</dt>
                <dd className={unidad.notas ? '' : 'text-tx-3'}>
                  {unidad.notas ?? 'Sin notas registradas.'}
                </dd>
              </div>
            </dl>
          </div>

          {puedeCambiar && (
            <div className="rounded-lg border border-bd bg-surface p-4">
              <h3 className="font-semibold text-tx mb-3">Cambiar estado</h3>
              <UnidadEstadoSelector
                unidadId={unidad.id}
                tipoId={tipo.id}
                estadoActual={unidad.estado}
              />
            </div>
          )}
        </div>

        <UnidadMantenimientosCard unidadId={unidad.id} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos y lint**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/herramientas/unidades/
git commit -m "feat(herramientas): página de detalle de unidad con cambio de estado y mantenimientos"
```

---

## Task 12: Lista de consumibles

**Files:**
- Modify (reemplazar stub): `components/herramientas/ConsumiblesList.tsx`

- [ ] **Step 1: Reemplazar el archivo**

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FilterBar } from '@/components/ui/FilterBar';
import { Pagination } from '@/components/ui/Pagination';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { useConsumibles } from '@/hooks/use-consumibles';
import { useAuthStore } from '@/stores/auth.store';
import { CATEGORIAS_CONSUMIBLE_LABEL, puedeEjecutar } from '@/lib/herramientas';
import { formatCurrency } from '@/lib/utils';
import type { CategoriaConsumible } from '@/types/api';

const PAGE_SIZE = 10;

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function ConsumiblesList() {
  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');
  const puedeVerInactivos = puedeEjecutar('desactivarConsumible', rol);

  const [busqueda, setBusqueda] = useState('');
  const search = useDebounced(busqueda.trim(), 300);
  const [filterCat, setFilterCat] = useState<CategoriaConsumible | null>(null);
  const [stockBajo, setStockBajo] = useState(false);
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useConsumibles({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    categoria: filterCat ?? undefined,
    activo: incluirInactivos ? false : true,
    stockBajo: stockBajo || undefined,
  });

  function toggleCat(c: CategoriaConsumible) {
    setFilterCat((prev) => (prev === c ? null : c));
    setPage(1);
  }
  function clearAll() {
    setBusqueda('');
    setFilterCat(null);
    setStockBajo(false);
    setIncluirInactivos(false);
    setPage(1);
  }

  return (
    <div className="rounded-lg border border-bd bg-surface overflow-hidden">
      <FilterBar
        search={busqueda}
        onSearch={(v) => {
          setBusqueda(v);
          setPage(1);
        }}
        placeholder="Buscar por código o nombre…"
        chips={[
          ...Object.entries(CATEGORIAS_CONSUMIBLE_LABEL).map(([k, label]) => ({
            label,
            active: filterCat === k,
            onToggle: () => toggleCat(k as CategoriaConsumible),
          })),
          {
            label: 'Stock bajo',
            active: stockBajo,
            onToggle: () => {
              setStockBajo((v) => !v);
              setPage(1);
            },
          },
        ]}
        onClear={clearAll}
      />

      {puedeVerInactivos && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-bd bg-bg-sunken text-xs">
          <input
            id="consumibles-incluir-inactivos"
            type="checkbox"
            className="accent-accent"
            checked={incluirInactivos}
            onChange={(e) => {
              setIncluirInactivos(e.target.checked);
              setPage(1);
            }}
          />
          <label htmlFor="consumibles-incluir-inactivos" className="text-tx-2 cursor-pointer">
            Incluir consumibles inactivos en la lista
          </label>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Spinner />
        </div>
      ) : (data?.data ?? []).length === 0 ? (
        <EmptyState
          icon="box"
          title="Sin consumibles"
          message="No se encontraron consumibles con los filtros aplicados."
        />
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-bg-sunken text-2xs uppercase tracking-wider text-tx-3">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Código</th>
              <th className="text-left px-4 py-2 font-medium">Nombre</th>
              <th className="text-left px-4 py-2 font-medium">Categoría</th>
              <th className="text-left px-4 py-2 font-medium">Unidad</th>
              <th className="text-right px-4 py-2 font-medium">Stock</th>
              <th className="text-right px-4 py-2 font-medium">Mínimo</th>
              <th className="text-right px-4 py-2 font-medium">Precio</th>
            </tr>
          </thead>
          <tbody>
            {(data?.data ?? []).map((c) => {
              const bajo = c.stockActual <= c.stockMinimo;
              return (
                <tr
                  key={c.id}
                  className={`border-t border-bd transition-colors ${
                    bajo ? 'bg-warn-soft' : 'hover:bg-bg-sunken'
                  }`}
                >
                  <td className="px-4 py-3 font-mono font-medium">
                    <Link href={`/herramientas/consumibles/${c.id}`} className="hover:underline">
                      {c.codigo}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/herramientas/consumibles/${c.id}`} className="hover:underline">
                      <div className="font-medium">{c.nombre}</div>
                      {c.descripcion && (
                        <div className="text-xs text-tx-3 mt-0.5">{c.descripcion}</div>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={CATEGORIAS_CONSUMIBLE_LABEL[c.categoria]} kind="info" />
                  </td>
                  <td className="px-4 py-3 text-xs text-tx-2">{c.unidad}</td>
                  <td className={`px-4 py-3 text-right font-mono ${bajo ? 'text-warn font-semibold' : ''}`}>
                    {c.stockActual}
                    {bajo && (
                      <span className="ml-1 inline-block align-middle">
                        <Icon name="alertTriangle" size={11} />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-tx-2">{c.stockMinimo}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(c.precioUnitario)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={data?.meta.total ?? 0}
        onPage={setPage}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos y lint**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/herramientas/ConsumiblesList.tsx
git commit -m "feat(herramientas): lista de consumibles con filtros y resaltado de stock bajo"
```

---

## Task 13: Formulario de consumible

**Files:**
- Create: `components/herramientas/ConsumibleForm.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { Icon } from '@/components/ui/Icon';
import { useCrearConsumible, useEditarConsumible } from '@/hooks/use-consumibles';
import { CATEGORIAS_CONSUMIBLE_LABEL } from '@/lib/herramientas';
import type { Consumible, CategoriaConsumible } from '@/types/api';

const baseSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio.'),
  descripcion: z.string().optional(),
  categoria: z.enum(['ABRASIVO', 'PINTURA', 'LUBRICANTE', 'QUIMICO', 'OTRO']),
  precioUnitario: z.coerce.number().positive('El precio debe ser positivo.'),
  unidad: z.string().min(1, 'La unidad es obligatoria.').max(50),
  stockMinimo: z.coerce.number().int().min(0, 'No puede ser negativo.'),
  notas: z.string().optional(),
});

const crearSchema = baseSchema.extend({
  codigo: z
    .string()
    .min(1, 'El código es obligatorio.')
    .max(20, 'Máximo 20 caracteres.')
    .regex(/^[A-Z0-9-]+$/, 'Solo letras mayúsculas, números y guiones.'),
  stockActual: z.coerce.number().int().min(0, 'No puede ser negativo.'),
});

type CrearFormData = z.infer<typeof crearSchema>;
type EditarFormData = z.infer<typeof baseSchema>;

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-1';
const hintCls = 'text-xs text-tx-3 mt-1';

type Props =
  | { mode: 'crear'; consumible?: undefined }
  | { mode: 'editar'; consumible: Consumible };

export function ConsumibleForm(props: Props) {
  const isNew = props.mode === 'crear';
  const router = useRouter();

  const crear = useCrearConsumible();
  const editar = useEditarConsumible();

  type FormData = CrearFormData | EditarFormData;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(isNew ? crearSchema : baseSchema) as never,
    defaultValues: isNew
      ? {
          codigo: '',
          nombre: '',
          categoria: 'ABRASIVO' as CategoriaConsumible,
          precioUnitario: undefined as unknown as number,
          unidad: '',
          stockActual: 0,
          stockMinimo: 0,
        }
      : {
          nombre: props.consumible.nombre,
          descripcion: props.consumible.descripcion ?? '',
          categoria: props.consumible.categoria,
          precioUnitario: Number(props.consumible.precioUnitario),
          unidad: props.consumible.unidad,
          stockMinimo: props.consumible.stockMinimo,
          notas: props.consumible.notas ?? '',
        },
  });

  function aplicarErroresApi(err: unknown) {
    const anyErr = err as {
      response?: { data?: { error?: { details?: { path: string; message: string }[] } } };
    };
    const details = anyErr?.response?.data?.error?.details;
    if (!details?.length) return;
    for (const d of details) {
      setError(d.path as keyof FormData, { type: 'server', message: d.message });
    }
  }

  async function onSubmit(values: FormData) {
    try {
      if (isNew) {
        const v = values as CrearFormData;
        const consumible = await crear.mutateAsync({
          codigo: v.codigo,
          nombre: v.nombre,
          descripcion: v.descripcion || undefined,
          categoria: v.categoria,
          precioUnitario: v.precioUnitario,
          stockActual: v.stockActual,
          stockMinimo: v.stockMinimo,
          unidad: v.unidad,
          notas: v.notas || undefined,
        });
        router.push(`/herramientas/consumibles/${consumible.id}`);
      } else {
        const v = values as EditarFormData;
        await editar.mutateAsync({
          id: props.consumible.id,
          data: {
            nombre: v.nombre,
            descripcion: v.descripcion || undefined,
            categoria: v.categoria,
            precioUnitario: v.precioUnitario,
            unidad: v.unidad,
            stockMinimo: v.stockMinimo,
            notas: v.notas || undefined,
            // stockActual NO se envía — el backend rechaza el campo en PUT.
            // Para mover stock se usa PATCH /:id/stock (ver AjusteStockPanel).
          },
        });
        router.push(`/herramientas/consumibles/${props.consumible.id}`);
      }
    } catch (err) {
      aplicarErroresApi(err);
    }
  }

  return (
    <form className="max-w-3xl" onSubmit={handleSubmit(onSubmit)}>
      <PageHeader
        title={isNew ? 'Nuevo consumible' : `Editar — ${props.consumible.nombre}`}
        subtitle={
          isNew
            ? 'Registrá un consumible (abrasivo, pintura, lubricante, etc.).'
            : 'Modificá los datos del consumible.'
        }
        back
        backLabel={isNew ? 'Consumibles' : `Consumible ${props.consumible.codigo}`}
        onBack={() =>
          router.push(
            isNew ? '/herramientas?tab=consumibles' : `/herramientas/consumibles/${props.consumible.id}`,
          )
        }
      />

      <FormSection title="Información general">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {isNew ? (
            <div>
              <label className={labelCls}>Código *</label>
              <input
                className={`${(errors as Record<string, unknown>).codigo ? inputErr : inputOk} font-mono uppercase`}
                placeholder="CON-007"
                {...register('codigo' as never, {
                  onChange: (e) => {
                    e.target.value = String(e.target.value).toUpperCase();
                  },
                })}
              />
              {(errors as Record<string, { message?: string }>).codigo && (
                <p className={errorCls}>
                  {(errors as Record<string, { message?: string }>).codigo.message}
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className={labelCls}>Código</label>
              <input
                className={`${inputOk} font-mono`}
                value={props.consumible.codigo}
                readOnly
                disabled
              />
              <p className={hintCls}>El código no se modifica una vez creado.</p>
            </div>
          )}

          <div>
            <label className={labelCls}>Categoría *</label>
            <select className={inputOk} {...register('categoria')}>
              {Object.entries(CATEGORIAS_CONSUMIBLE_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>Nombre *</label>
            <input
              className={errors.nombre ? inputErr : inputOk}
              placeholder="Ej. Arena sílica grado 30/60"
              {...register('nombre')}
            />
            {errors.nombre && <p className={errorCls}>{errors.nombre.message}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>Descripción</label>
            <textarea className={inputOk} rows={2} {...register('descripcion')} />
          </div>
        </div>
      </FormSection>

      <FormSection title="Precio y unidad">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Precio unitario (USD) *</label>
            <input
              className={errors.precioUnitario ? inputErr : `${inputOk} font-mono`}
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register('precioUnitario')}
            />
            {errors.precioUnitario && (
              <p className={errorCls}>{errors.precioUnitario.message}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Unidad de medida *</label>
            <input
              className={errors.unidad ? inputErr : inputOk}
              placeholder="kg, litros, rollos, etc."
              {...register('unidad')}
            />
            {errors.unidad && <p className={errorCls}>{errors.unidad.message}</p>}
          </div>
        </div>
      </FormSection>

      <FormSection title="Stock">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {isNew ? (
            <div>
              <label className={labelCls}>Stock inicial</label>
              <input
                className={(errors as Record<string, unknown>).stockActual ? inputErr : `${inputOk} font-mono`}
                type="number"
                min="0"
                {...register('stockActual' as never)}
              />
              {(errors as Record<string, { message?: string }>).stockActual && (
                <p className={errorCls}>
                  {(errors as Record<string, { message?: string }>).stockActual.message}
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className={labelCls}>Stock actual</label>
              <input
                className={`${inputOk} font-mono`}
                value={props.consumible.stockActual}
                readOnly
                disabled
              />
              <p className={hintCls}>
                Para mover el stock, usá el botón <b>Ajustar stock</b> en el detalle.
              </p>
            </div>
          )}

          <div>
            <label className={labelCls}>Stock mínimo</label>
            <input
              className={errors.stockMinimo ? inputErr : `${inputOk} font-mono`}
              type="number"
              min="0"
              {...register('stockMinimo')}
            />
            {errors.stockMinimo && <p className={errorCls}>{errors.stockMinimo.message}</p>}
            <p className={hintCls}>Si el stock cae a este valor o menos, se marca en alerta.</p>
          </div>
        </div>
      </FormSection>

      <FormSection title="Notas internas">
        <textarea className={inputOk} rows={3} {...register('notas')} />
      </FormSection>

      <div className="flex flex-col sm:flex-row gap-2 mt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center justify-center px-3 py-2 rounded-md border border-bd text-sm text-tx-2 hover:bg-bg-sunken transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed sm:ml-auto"
        >
          <Icon name="check" size={14} />
          {isNew ? 'Crear consumible' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verificar tipos y lint**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/herramientas/ConsumibleForm.tsx
git commit -m "feat(herramientas): formulario crear/editar consumible (sin stockActual en editar)"
```

---

## Task 14: Páginas crear/editar consumible

**Files:**
- Create: `app/(dashboard)/herramientas/consumibles/nuevo/page.tsx`
- Create: `app/(dashboard)/herramientas/consumibles/[id]/editar/page.tsx`

- [ ] **Step 1: Página crear**

`app/(dashboard)/herramientas/consumibles/nuevo/page.tsx`:

```tsx
import { ConsumibleForm } from '@/components/herramientas/ConsumibleForm';

export default function NuevoConsumiblePage() {
  return <ConsumibleForm mode="crear" />;
}
```

- [ ] **Step 2: Página editar (con guard)**

`app/(dashboard)/herramientas/consumibles/[id]/editar/page.tsx`:

```tsx
'use client';

import { use } from 'react';
import Link from 'next/link';
import { ConsumibleForm } from '@/components/herramientas/ConsumibleForm';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { useConsumible } from '@/hooks/use-consumibles';

const btnSec =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';

export default function EditarConsumiblePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: consumible, isLoading, isError } = useConsumible(id);

  if (isLoading) return <div className="flex justify-center p-12"><Spinner /></div>;
  if (isError || !consumible) {
    return (
      <div>
        <EmptyState
          icon="alertTriangle"
          title="Consumible no encontrado"
          message="El consumible no existe o fue eliminado."
        />
        <div className="text-center">
          <Link href="/herramientas?tab=consumibles" className={btnSec}>
            <Icon name="arrowLeft" size={14} /> Volver a consumibles
          </Link>
        </div>
      </div>
    );
  }

  return <ConsumibleForm mode="editar" consumible={consumible} />;
}
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/herramientas/consumibles/nuevo/ app/\(dashboard\)/herramientas/consumibles/\[id\]/editar/
git commit -m "feat(herramientas): páginas crear/editar consumible"
```

---

## Task 15: `StockBar` y `AjusteStockPanel`

**Files:**
- Create: `components/herramientas/StockBar.tsx`
- Create: `components/herramientas/AjusteStockPanel.tsx`

- [ ] **Step 1: Crear `StockBar.tsx`**

```tsx
'use client';

// Barra de progreso visual que toma stockActual sobre 2x stockMinimo como rango;
// si el stock supera el doble del mínimo, se llena al 100%. Si está por debajo,
// se colorea en warn. Patrón equivalente al `.progress` del prototipo.
type Props = { stockActual: number; stockMinimo: number };

export function StockBar({ stockActual, stockMinimo }: Props) {
  const bajo = stockActual <= stockMinimo;
  const techo = Math.max(1, stockMinimo * 2);
  const pct = Math.min(100, Math.round((stockActual / techo) * 100));
  return (
    <div className="h-2 w-full rounded-full bg-bg-sunken overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${bajo ? 'bg-warn' : 'bg-ok'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Crear `AjusteStockPanel.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Icon } from '@/components/ui/Icon';
import { useAjustarStock } from '@/hooks/use-consumibles';

const schema = z.object({
  signo: z.enum(['entrada', 'salida']),
  // El backend espera delta != 0; en UI separamos el signo del valor absoluto
  // para que el usuario no tenga que pensar en números negativos.
  cantidad: z.coerce.number().int().positive('Debe ser un entero mayor a 0.'),
  motivo: z.string().min(1, 'Indicá el motivo.').max(255, 'Máximo 255 caracteres.'),
});

type FormData = z.infer<typeof schema>;

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-1';
const segCls = (active: boolean) =>
  `flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
    active ? 'bg-accent text-navy' : 'bg-surface text-tx-2 hover:bg-bg-sunken'
  }`;
const btnSec =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';
const btnPri =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

type Props = {
  consumibleId: string;
  stockActual: number;
  unidad: string;
  onClose: () => void;
};

export function AjusteStockPanel({ consumibleId, stockActual, unidad, onClose }: Props) {
  const ajustar = useAjustarStock();
  const [signo, setSigno] = useState<'entrada' | 'salida'>('entrada');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { signo: 'entrada', cantidad: undefined as unknown as number, motivo: '' },
  });

  const cantidadActual = watch('cantidad');
  // Stock estimado tras aplicar el ajuste; útil para que el usuario vea el efecto
  // antes de confirmar (especialmente para salidas que podrían dejarlo en negativo,
  // lo cual el backend rechazará).
  const stockEstimado =
    typeof cantidadActual === 'number' && !Number.isNaN(cantidadActual)
      ? signo === 'entrada'
        ? stockActual + cantidadActual
        : stockActual - cantidadActual
      : stockActual;

  async function onSubmit(values: FormData) {
    const delta = values.signo === 'entrada' ? values.cantidad : -values.cantidad;
    try {
      await ajustar.mutateAsync({
        id: consumibleId,
        data: { delta, motivo: values.motivo.trim() },
      });
      onClose();
    } catch {
      // toast lo dispara el hook
    }
  }

  return (
    <form
      className="rounded-lg border border-bd bg-surface p-4 flex flex-col gap-3"
      onSubmit={handleSubmit(onSubmit)}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-tx">Ajustar stock</h3>
        <button
          type="button"
          className="text-tx-3 hover:text-tx"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <Icon name="x" size={14} />
        </button>
      </div>

      <div>
        <label className={labelCls}>Tipo de movimiento</label>
        <div className="flex rounded-md border border-bd overflow-hidden">
          <button
            type="button"
            className={segCls(signo === 'entrada')}
            onClick={() => setSigno('entrada')}
          >
            Entrada (+)
          </button>
          <button
            type="button"
            className={`${segCls(signo === 'salida')} border-l border-bd`}
            onClick={() => setSigno('salida')}
          >
            Salida (−)
          </button>
        </div>
        <input type="hidden" value={signo} {...register('signo')} />
      </div>

      <div>
        <label className={labelCls}>Cantidad *</label>
        <input
          className={errors.cantidad ? inputErr : `${inputOk} font-mono`}
          type="number"
          min="1"
          step="1"
          placeholder="0"
          {...register('cantidad')}
        />
        {errors.cantidad && <p className={errorCls}>{errors.cantidad.message}</p>}
        <p className="text-xs text-tx-3 mt-1">
          Stock actual: <span className="font-mono">{stockActual} {unidad}</span> · Quedaría:{' '}
          <span className={`font-mono ${stockEstimado < 0 ? 'text-danger font-semibold' : ''}`}>
            {stockEstimado} {unidad}
          </span>
        </p>
      </div>

      <div>
        <label className={labelCls}>Motivo *</label>
        <input
          className={errors.motivo ? inputErr : inputOk}
          placeholder="Ej. Compra a proveedor / Uso en obra Las Flores"
          {...register('motivo')}
        />
        {errors.motivo && <p className={errorCls}>{errors.motivo.message}</p>}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className={btnSec} onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className={btnPri} disabled={ajustar.isPending}>
          <Icon name="check" size={12} /> Confirmar ajuste
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/herramientas/StockBar.tsx components/herramientas/AjusteStockPanel.tsx
git commit -m "feat(herramientas): StockBar y panel de ajuste de stock con motivo auditado"
```

---

## Task 16: Página de detalle del consumible

**Files:**
- Create: `app/(dashboard)/herramientas/consumibles/[id]/page.tsx`

- [ ] **Step 1: Crear la página**

```tsx
'use client';

import Decimal from 'decimal.js';
import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { StockBar } from '@/components/herramientas/StockBar';
import { AjusteStockPanel } from '@/components/herramientas/AjusteStockPanel';
import {
  useConsumible,
  useDesactivarConsumible,
} from '@/hooks/use-consumibles';
import { useAuthStore } from '@/stores/auth.store';
import { CATEGORIAS_CONSUMIBLE_LABEL, puedeEjecutar } from '@/lib/herramientas';
import { formatCurrency } from '@/lib/utils';

const btnSec =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';

export default function ConsumibleDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ConsumibleDetalleClient id={id} />;
}

function ConsumibleDetalleClient({ id }: { id: string }) {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');

  const { data: c, isLoading, isError } = useConsumible(id);
  const desactivar = useDesactivarConsumible();

  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);

  const puedeEditar = puedeEjecutar('editarConsumible', rol);
  const puedeDesactivar = puedeEjecutar('desactivarConsumible', rol);
  const puedeAjustar = puedeEjecutar('ajustarStock', rol);

  if (isLoading) return <div className="flex justify-center p-12"><Spinner /></div>;
  if (isError || !c) {
    return (
      <div>
        <EmptyState
          icon="alertTriangle"
          title="Consumible no encontrado"
          message="El consumible no existe o fue eliminado."
        />
        <div className="text-center">
          <Link href="/herramientas?tab=consumibles" className={btnSec}>
            <Icon name="arrowLeft" size={14} /> Volver a consumibles
          </Link>
        </div>
      </div>
    );
  }

  const bajo = c.stockActual <= c.stockMinimo;
  // Valor de inventario: precioUnitario es string Decimal, stockActual es int.
  // Usamos decimal.js para preservar precisión y formatCurrency para mostrar.
  const valorInventario = new Decimal(c.precioUnitario).mul(c.stockActual).toFixed(2);

  return (
    <div>
      <PageHeader
        title={c.nombre}
        subtitle={
          <span className="inline-flex items-center gap-2 flex-wrap">
            <span className="font-mono text-tx-3">{c.codigo}</span>
            <span className="text-tx-3">·</span>
            <Badge status={CATEGORIAS_CONSUMIBLE_LABEL[c.categoria]} kind="info" />
            <Badge
              status={c.activo ? 'ACTIVO' : 'INACTIVO'}
              kind={c.activo ? 'ok' : 'neutral'}
            />
          </span>
        }
        back
        backLabel="Consumibles"
        onBack={() => router.push('/herramientas?tab=consumibles')}
        actions={
          <>
            {puedeEditar && (
              <Link href={`/herramientas/consumibles/${c.id}/editar`} className={btnSec}>
                <Icon name="edit" size={14} /> Editar
              </Link>
            )}
            {puedeAjustar && (
              <button type="button" className={btnSec} onClick={() => setAjusteOpen((v) => !v)}>
                <Icon name="refresh" size={14} /> Ajustar stock
              </button>
            )}
            {puedeDesactivar && (
              <button type="button" className={btnSec} onClick={() => setConfirmToggle(true)}>
                <Icon name={c.activo ? 'x' : 'refresh'} size={14} />
                {c.activo ? 'Desactivar' : 'Activar'}
              </button>
            )}
          </>
        }
      />

      {confirmToggle && (
        <ConfirmRow
          message={
            <>
              ¿{c.activo ? 'Desactivar' : 'Activar'} el consumible <b>{c.nombre}</b>?
            </>
          }
          onCancel={() => setConfirmToggle(false)}
          onConfirm={() => {
            desactivar.mutate(c.id);
            setConfirmToggle(false);
          }}
          confirmLabel={c.activo ? 'Sí, desactivar' : 'Sí, activar'}
          variant="primary"
        />
      )}

      {ajusteOpen && (
        <div className="mb-4 max-w-2xl">
          <AjusteStockPanel
            consumibleId={c.id}
            stockActual={c.stockActual}
            unidad={c.unidad}
            onClose={() => setAjusteOpen(false)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="rounded-lg border border-bd bg-surface p-4">
          <h3 className="font-semibold text-tx mb-3">Stock</h3>
          <div className="flex items-baseline gap-2 mb-2">
            <div className={`font-mono text-3xl font-bold ${bajo ? 'text-warn' : 'text-tx'}`}>
              {c.stockActual}
            </div>
            <div className="text-sm text-tx-3">{c.unidad}</div>
          </div>
          <StockBar stockActual={c.stockActual} stockMinimo={c.stockMinimo} />
          <div className="flex justify-between text-xs mt-2">
            <span className="text-tx-3">
              Mínimo: <span className="font-mono">{c.stockMinimo} {c.unidad}</span>
            </span>
            {bajo && (
              <span className="text-warn font-semibold inline-flex items-center gap-1">
                <Icon name="alertTriangle" size={11} /> Reposición urgente
              </span>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-bd bg-surface p-4">
          <h3 className="font-semibold text-tx mb-3">Datos generales</h3>
          <dl className="grid grid-cols-1 gap-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-tx-3">Precio unitario</dt>
              <dd className="font-mono font-semibold">
                {formatCurrency(c.precioUnitario)} / {c.unidad}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-tx-3">Unidad de medida</dt>
              <dd>{c.unidad}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-tx-3">Valor de inventario</dt>
              <dd className="font-mono">{formatCurrency(valorInventario)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-tx-3">Estado</dt>
              <dd>
                <Badge
                  status={c.activo ? 'ACTIVO' : 'INACTIVO'}
                  kind={c.activo ? 'ok' : 'neutral'}
                />
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-bd bg-surface p-4 lg:col-span-2">
          <h3 className="font-semibold text-tx mb-2">Historial de uso</h3>
          <p className="text-sm text-tx-3">
            Los movimientos de stock y consumos por cotización aparecerán acá cuando el módulo de cotizaciones esté disponible.
          </p>
        </div>

        {(c.descripcion || c.notas) && (
          <div className="rounded-lg border border-bd bg-surface p-4 lg:col-span-2">
            {c.descripcion && (
              <>
                <h3 className="font-semibold text-tx mb-2">Descripción</h3>
                <p className="text-sm mb-3">{c.descripcion}</p>
              </>
            )}
            {c.notas && (
              <>
                <h3 className="font-semibold text-tx mb-2">Notas internas</h3>
                <p className="text-sm whitespace-pre-line">{c.notas}</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos y lint**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/herramientas/consumibles/\[id\]/page.tsx
git commit -m "feat(herramientas): página de detalle del consumible con ajuste de stock"
```

---

## Task 17: QA manual e integración

Esta tarea no produce código nuevo; verifica que todo el módulo funciona end-to-end con el backend real. Si el backend no está disponible, los pasos quedan documentados para correrlos cuando lo esté.

- [ ] **Step 1: Arrancar backend y frontend**

En terminales separadas:

```bash
# Terminal 1: backend
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm dev

# Terminal 2: frontend
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm dev
```

Abrir `http://localhost:3001/herramientas` autenticado como ADMIN.

- [ ] **Step 2: Smoke test — Tab Tipos**

Verificar:
1. La lista carga datos reales del backend (no hay error en consola).
2. El buscador filtra (probar con un código o nombre conocido).
3. Las chips de categoría filtran y se pueden combinar/limpiar.
4. El checkbox "Incluir tipos inactivos" aparece (rol ADMIN) y filtra.
5. La paginación funciona si `total > 10`.
6. Click en una fila navega a `/herramientas/tipos/[id]`.
7. El botón "Nuevo tipo" abre el form.
8. Crear un tipo nuevo guarda y redirige al detalle.
9. Validación inline funciona: código inválido (ej. `ab cd`) muestra error sin pegarle al backend; el server devuelve detalles que se mapean a campos.

- [ ] **Step 3: Smoke test — Detalle del tipo y unidades**

1. El detalle muestra las 3 tarifas formateadas como moneda.
2. La card "Unidades" muestra el conteo por estado.
3. El botón "Agregar unidad" abre el panel inline.
4. Crear una unidad funciona y aparece inmediatamente en la lista (sin recargar).
5. Click en una unidad navega a `/herramientas/unidades/[id]?tipoId=...`.
6. En el detalle de unidad, cambiar el estado a MANTENIMIENTO funciona y se refleja en la lista del tipo.
7. Quitar `?tipoId` de la URL y refrescar: muestra el toast de error y redirige a `/herramientas?tab=tipos`.
8. La card de mantenimientos muestra "Sin mantenimientos registrados" (o los mantenimientos reales si la unidad tiene).

- [ ] **Step 4: Smoke test — Tab Consumibles**

1. Cambiar a la tab Consumibles desde la página principal — la URL pasa a `?tab=consumibles`.
2. Recargar la página: la tab Consumibles sigue activa.
3. Crear un consumible (con stock inicial) funciona.
4. En el detalle: `formatCurrency` formatea el valor de inventario correctamente; `StockBar` se ve.
5. Si stock <= mínimo, la fila en la lista se ve en `bg-warn-soft` y el icono `alertTriangle` aparece.
6. El chip "Stock bajo" filtra solo los que están bajo.
7. Ajustar stock — Entrada: el stock sube por el delta y se refleja inmediatamente.
8. Ajustar stock — Salida: el stock baja; intentar dejarlo en negativo: el backend devuelve error y se muestra como toast.
9. Editar consumible: el campo `stockActual` aparece deshabilitado con la nota explicativa; el resto guarda OK.

- [ ] **Step 5: Smoke test — Permisos**

1. Cambiar al rol `OPERADOR` (vía login con otro usuario o desde la BD): los botones de crear/editar/desactivar no aparecen.
2. Cambiar al rol `LOGISTICA`: aparecen "Agregar unidad", "Cambiar estado de unidad" y "Ajustar stock", pero NO "Editar/Desactivar tipo" ni "Editar/Desactivar consumible".
3. Cambiar al rol `VISUALIZADOR`: ningún botón de escritura visible.

- [ ] **Step 6: Smoke test — Dark mode y responsive**

1. Activar dark mode desde el panel de Tweaks; verificar que la fila de stock bajo (`bg-warn-soft`) y los badges siguen siendo legibles.
2. Reducir el viewport a 768px (tablet): los tabs, tablas y forms se ven sin overflow.
3. A 375px (móvil): el header y la tabla se adaptan o muestran scroll horizontal sin romper el layout.

- [ ] **Step 7: Verificación final**

```bash
pnpm tsc --noEmit && pnpm lint
```

Expected: PASS limpio.

- [ ] **Step 8: Marcar el checklist del spec**

Editar `docs/superpowers/specs/2026-05-21-feat-herramientas-design.md` sección 12 (Checklist de aceptación) y marcar los items completados. Commit:

```bash
git add docs/superpowers/specs/2026-05-21-feat-herramientas-design.md
git commit -m "docs(herramientas): marcar checklist tras QA"
```

- [ ] **Step 9: Abrir PR a `main`**

```bash
git push -u origin feat/herramientas
gh pr create --title "feat(herramientas): catálogo de tipos, unidades y consumibles (RAMA 6)" --body "$(cat <<'EOF'
## Summary
- Nueva ruta `/herramientas` con tabs Tipos / Consumibles (estado en `?tab=`).
- CRUD de tipos de herramienta + creación/listado de unidades nested + cambio de estado.
- CRUD de consumibles + ajuste de stock auditado (delta + motivo).
- Permisos por rol siguiendo backend: admin/gerente para CRUD, +logística para unidades y stock.

## Spec
`docs/superpowers/specs/2026-05-21-feat-herramientas-design.md`

## Test plan
- [ ] Tipos: lista, filtros (categoría, buscar, inactivos), paginación, crear, editar, desactivar/activar
- [ ] Unidades: crear inline desde detalle de tipo, ver detalle (con `?tipoId=`), cambiar estado, ver mantenimientos
- [ ] Consumibles: lista, filtros (categoría, stock bajo, inactivos), paginación, crear, editar (sin stockActual), desactivar/activar
- [ ] Ajuste de stock: entrada y salida, validación motivo, error inline cuando deja negativo
- [ ] Permisos: VISUALIZADOR sin botones de escritura; OPERADOR sin acciones de inventario; LOGISTICA con unidades y stock pero sin CRUD de tipos/consumibles
- [ ] Dark mode + responsive tablet/móvil

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage:** Cada sección del spec tiene tareas asignadas:
- §3 Endpoints → Tasks 2 y 3 (hooks)
- §4 Enums → Task 1 (lib/herramientas.ts)
- §5 Rutas → Tasks 4, 7, 9, 11, 14, 16 (páginas)
- §6 Tipos TS → Task 1
- §7 Hooks → Tasks 2 y 3
- §8 Páginas/UI → Tasks 4–16
- §9 Schemas Zod → Tasks 6 (tipo), 13 (consumible), 15 (ajuste stock)
- §10 Permisos → Task 1 (helper `puedeEjecutar`) + aplicado en cada componente
- §11 Convenciones → respetadas en cada task (Tailwind sin valores arbitrarios, decimal.js, comentarios "why")
- §12 Checklist → Task 17

**Sin placeholders:** Cada step tiene el código exacto. No hay "implementar X después".

**Type consistency verificada:**
- `useCambiarEstadoUnidad({ unidadId, estado, tipoId })` — mismo shape en Task 2 (hook) y Task 10 (selector que lo invoca).
- `UnidadCreatePanel({ tipoId })` — definido Task 8, consumido Task 9.
- `AjusteStockPanel({ consumibleId, stockActual, unidad, onClose })` — definido Task 15, consumido Task 16.
- `useHerramientaTipo(id)` retorna `HerramientaTipo` que incluye `unidades?` y `_count?` opcionales — el detalle del tipo (Task 9) usa `useUnidadesPorTipo(id)` por separado para no depender de la presencia de `unidades` en el response.
- `formatCurrency` acepta `string | number`; en Task 16 le pasamos `valorInventario` (string de Decimal.toFixed) — compatible con la firma existente en `lib/utils.ts`.

---

## Execution Handoff

Plan completo y guardado en `docs/superpowers/plans/2026-05-21-feat-herramientas.md`. Dos opciones de ejecución:

1. **Subagent-Driven (recomendado)** — Despacho un subagente fresco por tarea, revisamos entre tareas, iteración rápida.
2. **Inline Execution** — Ejecuto las tareas en esta misma sesión usando executing-plans, con checkpoints para revisión.

¿Cuál preferís?
