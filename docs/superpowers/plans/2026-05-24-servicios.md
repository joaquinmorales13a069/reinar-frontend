# Servicios (Rama 8) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el CRUD del catálogo de Servicios cotizables siguiendo el spec `docs/superpowers/specs/2026-05-24-servicios-design.md`.

**Architecture:** Módulo CRUD estándar sobre Next.js App Router (React 19) + React Query + RHF/Zod, espejo del patrón ya consolidado en `andamios` y `herramientas`. Sin componentes nuevos en `components/ui/`. El módulo es solo lectura para `OPERADOR`, `LOGISTICA` y `VISUALIZADOR`; `ADMIN` y `GERENTE` tienen escritura. El `codigo` (formato `SV-001`) lo asigna el backend al crear.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TanStack React Query v5 · Zustand · React Hook Form + Zod · Axios · TailwindCSS v4 · `decimal.js` · `sonner`.

**Verificación:** No hay suite de tests. Cada tarea verifica con `pnpm tsc --noEmit` y `pnpm lint`. Verificación funcional end-to-end al final del plan.

---

## Mapa de archivos

| Acción   | Ruta                                                    | Responsabilidad                                         |
|----------|---------------------------------------------------------|---------------------------------------------------------|
| Modify   | `types/api.ts`                                          | Tipos `Servicio`, DTOs y `FiltrosServicios`.            |
| Create   | `lib/schemas/servicios.ts`                              | Schemas Zod del formulario (crear/editar).              |
| Create   | `lib/servicios.ts`                                      | Helper `puedeEscribirServicio(rol)`.                    |
| Create   | `hooks/use-servicios.ts`                                | Hooks de React Query (list/get/create/update/toggle).   |
| Create   | `components/servicios/ServiciosTable.tsx`               | Tabla con búsqueda y filtro de activo/inactivo.         |
| Create   | `components/servicios/ServicioForm.tsx`                 | Formulario compartido crear/editar.                     |
| Create   | `app/(dashboard)/servicios/page.tsx`                    | Página de lista.                                        |
| Create   | `app/(dashboard)/servicios/nuevo/page.tsx`              | Página crear.                                           |
| Create   | `app/(dashboard)/servicios/[id]/page.tsx`               | Página detalle.                                         |
| Create   | `app/(dashboard)/servicios/[id]/editar/page.tsx`        | Página editar.                                          |

`lib/nav.ts` ya contiene el ítem `servicios → /servicios` con ícono `tool`; no se modifica.

---

## Task 1 — Tipos del módulo

**Files:**
- Modify: `types/api.ts` (agregar al final, antes de cualquier export indirecto)

- [ ] **Step 1: Agregar la sección de tipos**

Al final de `types/api.ts` agrega:

```ts
// ============================================================
// Servicios (Rama 8)
// ============================================================

export type Servicio = {
  id: string;
  codigo: string;          // SV-001, autogenerado por el backend
  nombre: string;
  descripcion: string | null;
  // Decimal serializado como string — usar decimal.js para operar, formatCurrency para mostrar.
  tarifaBase: string;
  unidad: string;          // texto libre (hora, día, m², proyecto…)
  activo: boolean;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CrearServicioDto = {
  nombre: string;
  descripcion?: string;
  tarifaBase: number;
  unidad: string;
  notas?: string;
};

// El backend rechaza cambios de `codigo`; lo dejamos fuera del DTO de edición.
export type ActualizarServicioDto = Partial<CrearServicioDto>;

export type FiltrosServicios = {
  page?: number;
  limit?: number;
  search?: string;
  activo?: boolean;
};
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add types/api.ts
git commit -m "feat(servicios): tipos del módulo (Servicio, DTOs, filtros)"
```

---

## Task 2 — Schema Zod del formulario

**Files:**
- Create: `lib/schemas/servicios.ts`

- [ ] **Step 1: Crear schema**

```ts
import { z } from 'zod';

// Espejo del schema del backend (server/src/modules/servicios/servicios.schemas.ts).
// `codigo` no aparece: lo autogenera el backend y se rechaza en PUT.
const servicioBaseSchema = z.object({
  nombre: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(150, 'Máximo 150 caracteres'),
  descripcion: z.string().max(500, 'Máximo 500 caracteres').optional(),
  tarifaBase: z.coerce.number().positive('La tarifa debe ser mayor a 0'),
  unidad: z
    .string()
    .min(1, 'La unidad es requerida')
    .max(50, 'Máximo 50 caracteres'),
  notas: z.string().max(1000, 'Máximo 1000 caracteres').optional(),
});

export const servicioCrearSchema = servicioBaseSchema;
export const servicioEditarSchema = servicioBaseSchema;

export type ServicioCrearInput = z.infer<typeof servicioCrearSchema>;
export type ServicioEditarInput = z.infer<typeof servicioEditarSchema>;
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add lib/schemas/servicios.ts
git commit -m "feat(servicios): schema Zod compartido crear/editar"
```

---

## Task 3 — Helper de permisos

**Files:**
- Create: `lib/servicios.ts`

- [ ] **Step 1: Crear helper**

```ts
// Permisos por acción. Espejo de servicios.routes.ts del backend:
//   admins = ADMIN/GERENTE escriben; OPERADOR/LOGISTICA/VISUALIZADOR sólo leen.

export const PERMISOS_SERVICIOS = {
  crear:         ['ADMIN', 'GERENTE'] as const,
  editar:        ['ADMIN', 'GERENTE'] as const,
  cambiarEstado: ['ADMIN', 'GERENTE'] as const,
} as const;

export function puedeEjecutarServicio(
  accion: keyof typeof PERMISOS_SERVICIOS,
  rol: string | undefined,
): boolean {
  if (!rol) return false;
  return (PERMISOS_SERVICIOS[accion] as readonly string[]).includes(rol);
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add lib/servicios.ts
git commit -m "feat(servicios): helper de permisos por acción"
```

---

## Task 4 — Hooks de React Query

**Files:**
- Create: `hooks/use-servicios.ts`

- [ ] **Step 1: Crear hooks**

```ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  PaginatedResponse,
  Servicio,
  CrearServicioDto,
  ActualizarServicioDto,
  FiltrosServicios,
} from '@/types/api';

// Mismo patrón que use-andamios.ts: helper duplicado intencionalmente para
// mantener cada archivo de hooks autocontenido (sin dependencia transitiva).
function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

// ─── Queries ─────────────────────────────────────────────────────────

export function useServicios(filtros: FiltrosServicios = {}) {
  return useQuery({
    queryKey: ['servicios', filtros],
    queryFn: () =>
      api
        .get<PaginatedResponse<Servicio>>('/servicios', { params: filtros })
        .then((r) => {
          if (!r.data.success) {
            // PaginatedResponse no modela el error: tras autenticación los 4xx van por
            // catch de axios. Este check es defensivo por consistencia con otros hooks.
            throw new Error('Respuesta inválida del servidor');
          }
          return { data: r.data.data, meta: r.data.meta };
        }),
  });
}

export function useServicio(id: string) {
  return useQuery({
    queryKey: ['servicio', id],
    queryFn: () =>
      api.get<ApiResponse<Servicio>>(`/servicios/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────

export function useCrearServicio() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (data: CrearServicioDto) =>
      api.post<ApiResponse<Servicio>>('/servicios', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (servicio) => {
      qc.invalidateQueries({ queryKey: ['servicios'] });
      toast.success('Servicio creado.');
      router.push(`/servicios/${servicio.id}`);
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear el servicio.'));
    },
  });
}

export function useEditarServicio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ActualizarServicioDto }) =>
      api.put<ApiResponse<Servicio>>(`/servicios/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['servicios'] });
      qc.invalidateQueries({ queryKey: ['servicio', id] });
      toast.success('Cambios guardados.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudieron guardar los cambios.'));
    },
  });
}

export function useCambiarEstadoServicio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      api
        .patch<ApiResponse<Servicio>>(`/servicios/${id}/estado`, { activo })
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (servicio, { id }) => {
      qc.invalidateQueries({ queryKey: ['servicios'] });
      qc.invalidateQueries({ queryKey: ['servicio', id] });
      toast.success(servicio.activo ? 'Servicio activado.' : 'Servicio desactivado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo cambiar el estado.'));
    },
  });
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-servicios.ts
git commit -m "feat(servicios): hooks de React Query (list/get/crear/editar/estado)"
```

---

## Task 5 — Tabla de servicios

**Files:**
- Create: `components/servicios/ServiciosTable.tsx`

- [ ] **Step 1: Crear componente**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Decimal from 'decimal.js';
import { FilterBar } from '@/components/ui/FilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { useServicios } from '@/hooks/use-servicios';
import { formatCurrency } from '@/lib/utils';

type FiltroEstado = 'TODOS' | 'ACTIVO' | 'INACTIVO';

export function ServiciosTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState<FiltroEstado>('TODOS');

  // El backend filtra por `activo` boolean (o lo omite para traer todos).
  const activo = estado === 'ACTIVO' ? true : estado === 'INACTIVO' ? false : undefined;

  const { data, isLoading, isError } = useServicios({
    page,
    limit: 20,
    search: search.trim() || undefined,
    activo,
  });

  function onChangeEstado(next: FiltroEstado) {
    setEstado(next);
    // Resetear paginación al cambiar filtros, para no quedar en una página
    // vacía cuando el total cambia.
    setPage(1);
  }

  function onChangeSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  return (
    <div className="rounded-lg border border-bd bg-surface overflow-hidden">
      <FilterBar
        search={search}
        onSearch={onChangeSearch}
        placeholder="Buscar por nombre o código…"
        chips={[
          {
            label: 'Activos',
            active: estado === 'ACTIVO',
            onToggle: () => onChangeEstado(estado === 'ACTIVO' ? 'TODOS' : 'ACTIVO'),
          },
          {
            label: 'Inactivos',
            active: estado === 'INACTIVO',
            onToggle: () => onChangeEstado(estado === 'INACTIVO' ? 'TODOS' : 'INACTIVO'),
          },
        ]}
        onClear={() => {
          setSearch('');
          setEstado('TODOS');
          setPage(1);
        }}
      />

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {isError && (
        <EmptyState
          icon="alertTriangle"
          title="Error al cargar servicios"
          message="Intenta refrescar la página."
        />
      )}

      {!isLoading && !isError && data && data.data.length === 0 && (
        <EmptyState
          icon="tool"
          title="Sin servicios"
          message="No se encontraron servicios con los filtros aplicados."
        />
      )}

      {!isLoading && !isError && data && data.data.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl text-sm">
              <thead className="bg-bg-sunken text-2xs uppercase tracking-wider text-tx-3">
                <tr>
                  <th className="text-left px-4 py-2 font-medium w-12">#</th>
                  <th className="text-left px-4 py-2 font-medium w-28">Código</th>
                  <th className="text-left px-4 py-2 font-medium">Servicio</th>
                  <th className="text-left px-4 py-2 font-medium w-32">Unidad</th>
                  <th className="text-right px-4 py-2 font-medium w-36">Tarifa base</th>
                  <th className="text-left px-4 py-2 font-medium w-28">Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((s, i) => {
                  // Numeración secuencial coherente con la página actual,
                  // siguiendo el patrón ya usado en andamios.
                  const numero = (data.meta.page - 1) * data.meta.limit + i + 1;
                  return (
                    <tr
                      key={s.id}
                      className="border-t border-bd hover:bg-bg-sunken transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-tx-3">{numero}</td>
                      <td className="px-4 py-3 font-mono text-xs text-tx-2">{s.codigo}</td>
                      <td className="px-4 py-3">
                        <Link href={`/servicios/${s.id}`} className="hover:underline">
                          <div className="font-medium">{s.nombre}</div>
                          {s.descripcion && (
                            <div className="text-xs text-tx-3 mt-0.5 truncate max-w-md">
                              {s.descripcion}
                            </div>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-tx-2">{s.unidad}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatCurrency(new Decimal(s.tarifaBase).toNumber())}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          status={s.activo ? 'ACTIVO' : 'INACTIVO'}
                          kind={s.activo ? 'ok' : 'neutral'}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.meta.page}
            limit={data.meta.limit}
            total={data.meta.total}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Verificar lint**

```bash
pnpm lint
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/servicios/ServiciosTable.tsx
git commit -m "feat(servicios): tabla de listado con filtros activo/inactivo"
```

---

## Task 6 — Página de listado

**Files:**
- Create: `app/(dashboard)/servicios/page.tsx`

- [ ] **Step 1: Crear página**

```tsx
'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { ServiciosTable } from '@/components/servicios/ServiciosTable';
import { useServicios } from '@/hooks/use-servicios';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarServicio } from '@/lib/servicios';

export default function ServiciosPage() {
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeCrear = puedeEjecutarServicio('crear', rol);

  // Llamada ligera para mostrar el total en el subtítulo independientemente
  // de los filtros activos en la tabla. `limit: 1` minimiza la transferencia;
  // el total real viene en meta.
  const { data } = useServicios({ page: 1, limit: 1 });
  const total = data?.meta.total ?? 0;

  return (
    <div>
      <PageHeader
        title="Servicios"
        subtitle={`${total} ${total === 1 ? 'servicio cotizable' : 'servicios cotizables'}`}
        actions={
          puedeCrear ? (
            <Link
              href="/servicios/nuevo"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors"
            >
              <Icon name="plus" size={14} /> Nuevo servicio
            </Link>
          ) : undefined
        }
      />
      <ServiciosTable />
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Verificar lint**

```bash
pnpm lint
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/servicios/page.tsx
git commit -m "feat(servicios): página de listado con header y total"
```

---

## Task 7 — Formulario compartido crear/editar

**Files:**
- Create: `components/servicios/ServicioForm.tsx`

- [ ] **Step 1: Crear componente**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { Icon } from '@/components/ui/Icon';
import {
  servicioCrearSchema,
  servicioEditarSchema,
  type ServicioCrearInput,
  type ServicioEditarInput,
} from '@/lib/schemas/servicios';
import { useCrearServicio, useEditarServicio } from '@/hooks/use-servicios';
import { trySetFieldErrorFromApi } from '@/lib/api-errors';
import type { Servicio } from '@/types/api';

type Props =
  | { modo: 'crear'; servicio?: undefined }
  | { modo: 'editar'; servicio: Servicio };

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const inputDisabled = `${inputBase} border-bd opacity-70 cursor-not-allowed`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-1';
const hintCls = 'text-xs text-tx-3 mt-1';

export function ServicioForm(props: Props) {
  const router = useRouter();
  const crear = useCrearServicio();
  const editar = useEditarServicio();

  if (props.modo === 'crear') {
    return <ServicioFormCrear router={router} crear={crear} />;
  }
  return <ServicioFormEditar servicio={props.servicio} router={router} editar={editar} />;
}

function ServicioFormCrear({
  router,
  crear,
}: {
  router: ReturnType<typeof useRouter>;
  crear: ReturnType<typeof useCrearServicio>;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ServicioCrearInput>({
    resolver: zodResolver(servicioCrearSchema) as never,
    defaultValues: {
      nombre: '',
      descripcion: '',
      tarifaBase: undefined as unknown as number,
      unidad: '',
      notas: '',
    },
  });

  async function onSubmit(values: ServicioCrearInput) {
    try {
      await crear.mutateAsync({
        nombre: values.nombre.trim(),
        descripcion: values.descripcion?.trim() || undefined,
        tarifaBase: values.tarifaBase,
        unidad: values.unidad.trim(),
        notas: values.notas?.trim() || undefined,
      });
    } catch (err) {
      // Si el backend reporta conflicto por nombre, lo mostramos inline.
      trySetFieldErrorFromApi(err, setError, 'nombre');
    }
  }

  return (
    <Layout
      title="Nuevo servicio"
      subtitle="Registra un servicio cotizable."
      onBack={() => router.push('/servicios')}
      submitLabel="Crear servicio"
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting || crear.isPending}
    >
      <CamposPrincipales register={register} errors={errors} codigo={null} />
      <CamposNotas register={register} errors={errors} />
    </Layout>
  );
}

function ServicioFormEditar({
  servicio,
  router,
  editar,
}: {
  servicio: Servicio;
  router: ReturnType<typeof useRouter>;
  editar: ReturnType<typeof useEditarServicio>;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ServicioEditarInput>({
    resolver: zodResolver(servicioEditarSchema) as never,
    defaultValues: {
      nombre: servicio.nombre,
      descripcion: servicio.descripcion ?? '',
      tarifaBase: Number(servicio.tarifaBase),
      unidad: servicio.unidad,
      notas: servicio.notas ?? '',
    },
  });

  async function onSubmit(values: ServicioEditarInput) {
    try {
      await editar.mutateAsync({
        id: servicio.id,
        data: {
          nombre: values.nombre.trim(),
          descripcion: values.descripcion?.trim() || undefined,
          tarifaBase: values.tarifaBase,
          unidad: values.unidad.trim(),
          notas: values.notas?.trim() || undefined,
        },
      });
      router.push(`/servicios/${servicio.id}`);
    } catch (err) {
      trySetFieldErrorFromApi(err, setError, 'nombre');
    }
  }

  return (
    <Layout
      title={`Editar — ${servicio.nombre}`}
      subtitle="Modifica los datos del servicio."
      onBack={() => router.push(`/servicios/${servicio.id}`)}
      submitLabel="Guardar cambios"
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting || editar.isPending}
    >
      <CamposPrincipales register={register} errors={errors} codigo={servicio.codigo} />
      <CamposNotas register={register} errors={errors} />
    </Layout>
  );
}

function Layout({
  title,
  subtitle,
  onBack,
  submitLabel,
  onSubmit,
  isSubmitting,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  submitLabel: string;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  children: React.ReactNode;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 pb-24">
      <PageHeader title={title} subtitle={subtitle} back onBack={onBack} />
      {children}
      <div className="sticky bottom-0 left-0 right-0 -mx-4 px-4 py-3 bg-bg border-t border-bd flex justify-end gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-sm hover:bg-bg-sunken transition-colors"
          onClick={onBack}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Icon name="check" size={14} /> {submitLabel}
        </button>
      </div>
    </form>
  );
}

function CamposPrincipales({
  register,
  errors,
  codigo,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: any;
  // null = modo crear; el backend asigna el código y por eso no se muestra el campo.
  codigo: string | null;
}) {
  return (
    <FormSection title="Información">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {codigo !== null && (
          <div>
            <label className={labelCls}>Código</label>
            <input
              type="text"
              readOnly
              disabled
              value={codigo}
              className={`${inputDisabled} font-mono`}
            />
            <p className={hintCls}>El código se asigna automáticamente y no es editable.</p>
          </div>
        )}

        <div>
          <label className={labelCls}>Unidad *</label>
          <input
            className={errors.unidad ? inputErr : inputOk}
            placeholder="hora, día, m², proyecto…"
            {...register('unidad')}
          />
          {errors.unidad && <p className={errorCls}>{errors.unidad.message}</p>}
        </div>

        <div className="md:col-span-2">
          <label className={labelCls}>Nombre *</label>
          <input
            className={errors.nombre ? inputErr : inputOk}
            placeholder="Sandblasting de superficies metálicas"
            {...register('nombre')}
          />
          {errors.nombre && <p className={errorCls}>{errors.nombre.message}</p>}
        </div>

        <div>
          <label className={labelCls}>Tarifa base (USD) *</label>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            className={`${errors.tarifaBase ? inputErr : inputOk} font-mono`}
            {...register('tarifaBase')}
          />
          {errors.tarifaBase && <p className={errorCls}>{errors.tarifaBase.message}</p>}
          <p className={hintCls}>Precio unitario por unidad seleccionada.</p>
        </div>

        <div className="md:col-span-2">
          <label className={labelCls}>Descripción</label>
          <textarea
            rows={3}
            className={errors.descripcion ? inputErr : inputOk}
            placeholder="Detalle del servicio, alcance, exclusiones…"
            {...register('descripcion')}
          />
          {errors.descripcion && <p className={errorCls}>{errors.descripcion.message}</p>}
        </div>
      </div>
    </FormSection>
  );
}

function CamposNotas({
  register,
  errors,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: any;
}) {
  return (
    <FormSection title="Notas internas">
      <textarea
        rows={3}
        className={errors.notas ? inputErr : inputOk}
        placeholder="Información operativa para el equipo (opcional)."
        {...register('notas')}
      />
      {errors.notas && <p className={errorCls}>{errors.notas.message}</p>}
    </FormSection>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Verificar lint**

```bash
pnpm lint
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/servicios/ServicioForm.tsx
git commit -m "feat(servicios): formulario compartido crear/editar"
```

---

## Task 8 — Página crear

**Files:**
- Create: `app/(dashboard)/servicios/nuevo/page.tsx`

- [ ] **Step 1: Crear página**

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ServicioForm } from '@/components/servicios/ServicioForm';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarServicio } from '@/lib/servicios';

export default function ServicioNuevoPage() {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeCrear = puedeEjecutarServicio('crear', rol);

  // Defensa en profundidad: el backend también valida el rol, pero redirigir
  // evita exponer el formulario a un rol sin permisos. El hidratado del rol es
  // síncrono después del primer render del AuthHydrator, por lo que esperamos
  // a tener un rol definido antes de decidir.
  useEffect(() => {
    if (rol && !puedeCrear) router.replace('/servicios');
  }, [rol, puedeCrear, router]);

  if (!puedeCrear) return null;

  return <ServicioForm modo="crear" />;
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Verificar lint**

```bash
pnpm lint
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/servicios/nuevo/page.tsx
git commit -m "feat(servicios): página crear con guard de rol"
```

---

## Task 9 — Página detalle

**Files:**
- Create: `app/(dashboard)/servicios/[id]/page.tsx`

- [ ] **Step 1: Crear página**

```tsx
'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Decimal from 'decimal.js';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { useServicio, useCambiarEstadoServicio } from '@/hooks/use-servicios';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarServicio } from '@/lib/servicios';
import { formatCurrency } from '@/lib/utils';

const btnSec =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';

export default function ServicioDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const { data: servicio, isLoading, isError } = useServicio(id);
  const cambiarEstado = useCambiarEstadoServicio();
  const [confirmEstado, setConfirmEstado] = useState(false);

  const puedeEditar = puedeEjecutarServicio('editar', rol);
  const puedeEstado = puedeEjecutarServicio('cambiarEstado', rol);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (isError || !servicio) {
    return (
      <EmptyState
        icon="alertTriangle"
        title="No se encontró el servicio"
        message="Puede haber sido eliminado o el ID es incorrecto."
      />
    );
  }

  return (
    <div>
      <PageHeader
        title={servicio.nombre}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span className="font-mono text-xs text-tx-2">{servicio.codigo}</span>
            <span className="text-tx-3">·</span>
            <Badge
              status={servicio.activo ? 'ACTIVO' : 'INACTIVO'}
              kind={servicio.activo ? 'ok' : 'neutral'}
            />
          </span>
        }
        back
        backLabel="Servicios"
        onBack={() => router.push('/servicios')}
        actions={
          <div className="flex gap-2">
            {puedeEditar && (
              <Link href={`/servicios/${servicio.id}/editar`} className={btnSec}>
                <Icon name="edit" size={14} /> Editar
              </Link>
            )}
            {puedeEstado && (
              <button
                type="button"
                className={btnSec}
                onClick={() => setConfirmEstado(true)}
              >
                <Icon name={servicio.activo ? 'x' : 'check'} size={14} />{' '}
                {servicio.activo ? 'Desactivar' : 'Activar'}
              </button>
            )}
          </div>
        }
      />

      {confirmEstado && (
        <ConfirmRow
          message={
            servicio.activo
              ? `¿Desactivar el servicio "${servicio.nombre}"? No podrá agregarse a nuevas cotizaciones.`
              : `¿Activar el servicio "${servicio.nombre}"?`
          }
          confirmLabel={servicio.activo ? 'Desactivar' : 'Activar'}
          variant={servicio.activo ? 'danger' : 'primary'}
          onCancel={() => setConfirmEstado(false)}
          onConfirm={async () => {
            await cambiarEstado.mutateAsync({ id: servicio.id, activo: !servicio.activo });
            setConfirmEstado(false);
          }}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-4">
          <Card>
            <h3 className="text-sm font-semibold mb-2">Descripción</h3>
            <p className="text-sm text-tx-2 m-0 leading-relaxed">
              {servicio.descripcion || <span className="text-tx-3">Sin descripción.</span>}
            </p>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold mb-2">Notas internas</h3>
            <p className="text-sm m-0 leading-relaxed">
              {servicio.notas ? (
                <span className="text-tx-2">{servicio.notas}</span>
              ) : (
                <span className="text-tx-3">Sin notas registradas.</span>
              )}
            </p>
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <h3 className="text-sm font-semibold mb-2">Tarifa</h3>
            <div className="rounded-md bg-bg-sunken p-4">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-3xl font-medium">
                  {formatCurrency(new Decimal(servicio.tarifaBase).toNumber())}
                </span>
                <span className="text-tx-3 text-sm">/ {servicio.unidad}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Verificar lint**

```bash
pnpm lint
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/servicios/\[id\]/page.tsx
git commit -m "feat(servicios): página de detalle con toggle activo inline"
```

---

## Task 10 — Página editar

**Files:**
- Create: `app/(dashboard)/servicios/[id]/editar/page.tsx`

- [ ] **Step 1: Crear página**

```tsx
'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ServicioForm } from '@/components/servicios/ServicioForm';
import { useServicio } from '@/hooks/use-servicios';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarServicio } from '@/lib/servicios';

export default function ServicioEditarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeEditar = puedeEjecutarServicio('editar', rol);
  const { data: servicio, isLoading, isError } = useServicio(id);

  useEffect(() => {
    if (rol && !puedeEditar) router.replace(`/servicios/${id}`);
  }, [rol, puedeEditar, router, id]);

  if (!puedeEditar) return null;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (isError || !servicio) {
    return (
      <EmptyState
        icon="alertTriangle"
        title="No se encontró el servicio"
        message="Puede haber sido eliminado o el ID es incorrecto."
      />
    );
  }

  return <ServicioForm modo="editar" servicio={servicio} />;
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Verificar lint**

```bash
pnpm lint
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/servicios/\[id\]/editar/page.tsx
git commit -m "feat(servicios): página de edición con guard de rol"
```

---

## Task 11 — Verificación funcional end-to-end

**Files:** ninguno (verificación manual en el navegador).

- [ ] **Step 1: Compilar producción**

```bash
pnpm build
```

Expected: build exitoso sin errores.

- [ ] **Step 2: Levantar dev server**

```bash
pnpm dev
```

El backend Express debe estar corriendo en `http://localhost:3000`.

- [ ] **Step 3: Probar como ADMIN/GERENTE**

Loguearse con un usuario `ADMIN` o `GERENTE` y verificar:

1. Ir a `/servicios` → la lista carga, muestra el total real, paginación si aplica.
2. Filtros: probar `Activos` y `Inactivos` (mutuamente excluyentes), búsqueda por texto.
3. Click en una fila → navega al detalle, muestra código mono, badge, descripción, notas y tarjeta Tarifa con `formatCurrency`.
4. "Nuevo servicio" → completar nombre, unidad, tarifa, descripción, notas → "Crear servicio" → redirige al detalle del nuevo y toast `Servicio creado.`.
5. Detalle del nuevo → "Editar" → cambiar nombre y tarifa → "Guardar cambios" → toast `Cambios guardados.` y redirige al detalle.
6. Detalle → "Desactivar" → `ConfirmRow` aparece → confirmar → toast `Servicio desactivado.`, badge cambia a `INACTIVO`.
7. Detalle (inactivo) → "Activar" → confirmar → toast `Servicio activado.`.
8. Provocar error de validación: enviar formulario sin nombre → mensaje inline bajo el campo (sin toast).

- [ ] **Step 4: Probar como rol de solo lectura**

Loguearse con un usuario `OPERADOR`, `LOGISTICA` o `VISUALIZADOR` y verificar:

1. `/servicios` → la lista carga; **no aparece** el botón "Nuevo servicio".
2. Detalle de un servicio → **no aparecen** los botones "Editar" ni "Desactivar/Activar".
3. Navegar manualmente a `/servicios/nuevo` → redirige a `/servicios`.
4. Navegar manualmente a `/servicios/<id>/editar` → redirige a `/servicios/<id>`.

- [ ] **Step 5: Dark mode y responsive**

1. Activar dark mode desde TweaksPanel → la UI de servicios se ve consistente (sin colores rotos).
2. Reducir el ancho del navegador a ~768px → la tabla muestra scroll horizontal y el detalle apila las dos columnas.

- [ ] **Step 6: Commit (si hubo ajustes menores)**

Si las pruebas detectaron pequeños ajustes (espaciados, textos, etc.), commitéalos en un solo paso:

```bash
git add -A
git commit -m "fix(servicios): ajustes detectados en verificación funcional"
```

Si no hubo ajustes, saltar este paso.

---

## Checklist final antes de PR

- [ ] `pnpm tsc --noEmit` pasa sin errores.
- [ ] `pnpm lint` pasa sin errores.
- [ ] `pnpm build` pasa sin errores.
- [ ] Listado, detalle, crear y editar consumen datos reales del backend (sin mocks).
- [ ] Errores de validación se muestran inline (no toast).
- [ ] `toast.success` en `onSuccess` y `toast.error` en `onError` de cada mutation.
- [ ] Botones de escritura ocultos para OPERADOR/LOGISTICA/VISUALIZADOR.
- [ ] Rutas de escritura redirigen para roles sin permiso.
- [ ] Paginación funciona cuando hay > 20 servicios.
- [ ] Dark mode no rompe la UI.
- [ ] Usable en tablet (768px).
- [ ] Sin clases CSS vanilla en `globals.css` — todo con Tailwind o `@layer utilities`.
- [ ] Comentarios "why" en español en decisiones no obvias.
- [ ] Crear PR a `main` con descripción referenciando este plan y el spec.
