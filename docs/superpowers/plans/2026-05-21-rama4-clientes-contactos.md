# RAMA 4 — Clientes y Contactos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar CRUD completo de Clientes y Contactos con 7 componentes UI compartidos reutilizables en ramas futuras.

**Architecture:** Opción B — primero los 7 componentes UI base (`PageHeader`, `FilterBar`, `DataTable`, `Pagination`, `EmptyState`, `ConfirmRow`, `FormSection`), luego los módulos Clientes y Contactos los consumen. Páginas con params dinámicos son Server Components que pasan `id` a Client Components. Páginas sin params son Client Components directamente. Ambos hooks se crean antes que cualquier componente que los consuma.

**Tech Stack:** Next.js 19 App Router, React Query v5, React Hook Form + Zod, sonner (ya en providers.tsx), Tailwind v4, TypeScript

---

## File Map

**New / modified files:**
- `types/api.ts` — agregar `Cliente` y `Contacto`
- `lib/sv-geo.ts` — departamentos, municipios y sectores de El Salvador
- `components/ui/PageHeader.tsx`
- `components/ui/FilterBar.tsx`
- `components/ui/DataTable.tsx`
- `components/ui/Pagination.tsx`
- `components/ui/EmptyState.tsx`
- `components/ui/ConfirmRow.tsx`
- `components/ui/FormSection.tsx`
- `hooks/use-clientes.ts`
- `hooks/use-contactos.ts`
- `components/clientes/ClientesList.tsx`
- `components/clientes/ClienteDetalle.tsx`
- `components/clientes/ClienteForm.tsx`
- `components/clientes/ContactosDeCliente.tsx`
- `app/(dashboard)/clientes/page.tsx`
- `app/(dashboard)/clientes/nuevo/page.tsx`
- `app/(dashboard)/clientes/[id]/page.tsx`
- `app/(dashboard)/clientes/[id]/editar/page.tsx`
- `components/contactos/ContactosList.tsx`
- `components/contactos/ContactoDetalle.tsx`
- `components/contactos/ContactoForm.tsx`
- `app/(dashboard)/contactos/page.tsx`
- `app/(dashboard)/contactos/nuevo/page.tsx`
- `app/(dashboard)/contactos/[id]/page.tsx`
- `app/(dashboard)/contactos/[id]/editar/page.tsx`

---

## Task 1: Crear rama git, tipos y constantes geográficas

**Files:**
- Modify: `types/api.ts`
- Create: `lib/sv-geo.ts`

- [ ] **Paso 1.1: Crear la rama git desde main**

```bash
git checkout main
git checkout -b feat/clientes
```

- [ ] **Paso 1.2: Agregar `Cliente` y `Contacto` a `types/api.ts`**

Agregar al final del archivo existente:

```typescript
export type Cliente = {
  id: string;
  tipo: 'EMPRESA' | 'PARTICULAR';
  razonSocial?: string;
  nombreComercial?: string;
  nombre?: string;
  apellido?: string;
  nit?: string;
  ncr?: string;
  dui?: string;
  ocupacion?: string;
  sector?: string;
  actividadEconomica?: string;
  departamento: string;
  municipio: string;
  complemento?: string;
  telefono?: string;
  email?: string;
  notas?: string;
  estado: 'ACTIVO' | 'INACTIVO' | 'PROSPECTO';
  facturado?: string;
  proyectos?: number;
};

export type Contacto = {
  id: string;
  clienteId: string;
  nombre: string;
  apellido?: string;
  cargo?: string;
  tipoContacto: 'PRINCIPAL' | 'SECUNDARIO' | 'SOLICITANTE' | 'FACTURACION' | 'OPERATIVO';
  telefono?: string;
  email?: string;
  notas?: string;
  activo: boolean;
};
```

- [ ] **Paso 1.3: Crear `lib/sv-geo.ts`**

```typescript
export const DEPARTAMENTOS_SV = [
  'Ahuachapán', 'Santa Ana', 'Sonsonate', 'Chalatenango',
  'La Libertad', 'San Salvador', 'Cuscatlán', 'La Paz',
  'Cabañas', 'San Vicente', 'Usulután', 'San Miguel',
  'Morazán', 'La Unión',
] as const;

export const MUNICIPIOS_SV: Record<string, string[]> = {
  'San Salvador': ['San Salvador', 'Soyapango', 'Mejicanos', 'Apopa', 'Ciudad Delgado', 'San Marcos', 'Cuscatancingo', 'Ilopango'],
  'La Libertad': ['Santa Tecla', 'Antiguo Cuscatlán', 'Colón', 'Quezaltepeque', 'San Juan Opico', 'Zaragoza', 'La Libertad'],
  'Santa Ana': ['Santa Ana', 'Chalchuapa', 'Texistepeque', 'Metapán', 'Santiago de la Frontera'],
  'Ahuachapán': ['Ahuachapán', 'Atiquizaya', 'San Francisco Menéndez', 'Tacuba'],
  'Sonsonate': ['Sonsonate', 'Nahuizalco', 'Izalco', 'San Antonio del Monte', 'Acajutla'],
  'Chalatenango': ['Chalatenango', 'La Palma', 'San Ignacio', 'Nueva Concepción', 'Tejutla'],
  'Cuscatlán': ['Suchitoto', 'Cojutepeque', 'San Pedro Perulapán', 'Oratorio de Concepción'],
  'La Paz': ['Zacatecoluca', 'San Luis Talpa', 'Olocuilta', 'San Pedro Masahuat', 'Rosario de Mora'],
  'Cabañas': ['Sensuntepeque', 'Ilobasco', 'San Isidro', 'Victoria'],
  'San Vicente': ['San Vicente', 'Apastepeque', 'Tepetitán', 'San Cayetano Istepeque'],
  'Usulután': ['Usulután', 'Jiquilisco', 'Santiago de María', 'El Triunfo', 'Berlín'],
  'San Miguel': ['San Miguel', 'Moncagua', 'Chinameca', 'El Tránsito', 'San Rafael Oriente'],
  'Morazán': ['San Francisco Gotera', 'Jocoaitique', 'Osicala', 'Perquín'],
  'La Unión': ['La Unión', 'Conchagua', 'El Carmen', 'Santa Rosa de Lima'],
};

export const SECTORES = [
  'Construcción', 'Minería', 'Manufactura', 'Electricidad y gas',
  'Agua y saneamiento', 'Comercio', 'Transporte',
  'Alojamiento y restaurantes', 'Información y comunicación',
  'Servicios financieros', 'Bienes raíces', 'Servicios profesionales',
  'Administración pública', 'Educación', 'Salud',
  'Cultura y entretenimiento', 'Otros servicios',
];
```

- [ ] **Paso 1.4: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Esperado: sin errores.

- [ ] **Paso 1.5: Commit**

```bash
git add types/api.ts lib/sv-geo.ts
git commit -m "feat(clientes): agregar tipos Cliente/Contacto y constantes geográficas SV"
```

---

## Task 2: Componentes UI base — PageHeader y FilterBar

**Files:**
- Create: `components/ui/PageHeader.tsx`
- Create: `components/ui/FilterBar.tsx`

- [ ] **Paso 2.1: Crear `components/ui/PageHeader.tsx`**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';

type PageHeaderProps = {
  title: string;
  subtitle?: React.ReactNode;
  back?: boolean;
  onBack?: () => void;
  actions?: React.ReactNode;
};

export function PageHeader({ title, subtitle, back, onBack, actions }: PageHeaderProps) {
  const router = useRouter();

  function handleBack() {
    if (onBack) onBack();
    else router.back();
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
      <div className="flex items-start gap-3 min-w-0">
        {back && (
          <button type="button" onClick={handleBack} className="icon-btn mt-0.5 shrink-0">
            <Icon name="arrowLeft" size={16} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-title font-semibold tracking-tight text-tx truncate">{title}</h1>
          {subtitle && <div className="text-sm text-tx-2 mt-1">{subtitle}</div>}
        </div>
      </div>
      {actions && (
        <div className="flex flex-col sm:flex-row gap-2 sm:shrink-0 w-full sm:w-auto">
          {actions}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Paso 2.2: Crear `components/ui/FilterBar.tsx`**

```tsx
'use client';

import { Icon } from '@/components/ui/Icon';

type Chip = { label: string; active: boolean; onToggle: () => void };

type FilterBarProps = {
  search: string;
  onSearch: (v: string) => void;
  placeholder?: string;
  chips?: Chip[];
  onClear: () => void;
};

export function FilterBar({ search, onSearch, placeholder, chips = [], onClear }: FilterBarProps) {
  const hasFilters = !!search || chips.some((c) => c.active);

  return (
    <div className="filter-bar">
      <div className="filter-bar__search">
        <Icon name="search" size={14} className="filter-bar__icon" />
        <input
          className="filter-bar__input"
          placeholder={placeholder ?? 'Buscar…'}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <div className="filter-bar__chips flex-wrap">
        {chips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            className={`chip ${chip.active ? 'chip--active' : ''}`}
            onClick={chip.onToggle}
          >
            {chip.label}
          </button>
        ))}
        {hasFilters && (
          <button type="button" className="chip chip--clear" onClick={onClear}>
            <Icon name="x" size={11} /> Limpiar
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Paso 2.3: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Esperado: sin errores.

- [ ] **Paso 2.4: Commit**

```bash
git add components/ui/PageHeader.tsx components/ui/FilterBar.tsx
git commit -m "feat(ui): agregar PageHeader y FilterBar"
```

---

## Task 3: Componentes UI base — DataTable, Pagination, EmptyState, ConfirmRow, FormSection

**Files:**
- Create: `components/ui/DataTable.tsx`
- Create: `components/ui/Pagination.tsx`
- Create: `components/ui/EmptyState.tsx`
- Create: `components/ui/ConfirmRow.tsx`
- Create: `components/ui/FormSection.tsx`

- [ ] **Paso 3.1: Crear `components/ui/DataTable.tsx`**

```tsx
type DataTableProps = {
  children: React.ReactNode;
  className?: string;
};

export function DataTable({ children, className = '' }: DataTableProps) {
  return (
    <div className={`table-wrap ${className}`} style={{ borderTop: 0, borderRadius: '0 0 4px 4px' }}>
      <div className="overflow-x-auto">
        <table className="table">{children}</table>
      </div>
    </div>
  );
}
```

- [ ] **Paso 3.2: Crear `components/ui/Pagination.tsx`**

```tsx
'use client';

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
};

export function Pagination({ page, pageSize, total, onPage }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const pages: (number | '…')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) pages.push(i);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-bd text-sm text-tx-2">
      <span className="hidden sm:block">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
      </span>
      <div className="flex items-center gap-1">
        <button className="btn btn--ghost btn--sm" onClick={() => onPage(page - 1)} disabled={page === 1}>
          Anterior
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e-${i}`} className="px-2 hidden sm:block">…</span>
          ) : (
            <button
              key={p}
              className={`hidden sm:flex icon-btn ${p === page ? 'is-active' : ''}`}
              onClick={() => onPage(p as number)}
            >
              {p}
            </button>
          )
        )}
        <button className="btn btn--ghost btn--sm" onClick={() => onPage(page + 1)} disabled={page === totalPages}>
          Siguiente
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Paso 3.3: Crear `components/ui/EmptyState.tsx`**

```tsx
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';

type EmptyStateProps = { icon: IconName; title: string; message: string };

export function EmptyState({ icon, title, message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-bg-sunken flex items-center justify-center mb-4 text-tx-3">
        <Icon name={icon} size={22} />
      </div>
      <p className="font-medium text-tx mb-1">{title}</p>
      <p className="text-sm text-tx-2">{message}</p>
    </div>
  );
}
```

- [ ] **Paso 3.4: Crear `components/ui/ConfirmRow.tsx`**

```tsx
'use client';

import { Icon } from '@/components/ui/Icon';

type ConfirmRowProps = {
  message: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
};

export function ConfirmRow({ message, onCancel, onConfirm, confirmLabel = 'Confirmar', variant = 'danger' }: ConfirmRowProps) {
  return (
    <div className="confirm-row flex-col sm:flex-row mb-4">
      <span className="confirm-row__icon">
        <Icon name="alertTriangle" size={18} />
      </span>
      <span className="confirm-row__msg flex-1">{message}</span>
      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <button type="button" className="btn btn--ghost btn--sm w-full sm:w-auto" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className={`btn btn--${variant} btn--sm w-full sm:w-auto`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Paso 3.5: Crear `components/ui/FormSection.tsx`**

```tsx
type FormSectionProps = { title: string; children: React.ReactNode; className?: string };

export function FormSection({ title, children, className = '' }: FormSectionProps) {
  return (
    <div className={`card mb-4 ${className}`}>
      <h3 className="card__title mb-3">{title}</h3>
      {children}
    </div>
  );
}
```

- [ ] **Paso 3.6: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Esperado: sin errores.

- [ ] **Paso 3.7: Commit**

```bash
git add components/ui/DataTable.tsx components/ui/Pagination.tsx components/ui/EmptyState.tsx components/ui/ConfirmRow.tsx components/ui/FormSection.tsx
git commit -m "feat(ui): agregar DataTable, Pagination, EmptyState, ConfirmRow, FormSection"
```

---

## Task 4: Hooks — use-clientes.ts y use-contactos.ts

> Ambos hooks se crean juntos porque `ContactosDeCliente` (Task 6) necesita `useContactos` antes de que el módulo de contactos esté completo.

**Files:**
- Create: `hooks/use-clientes.ts`
- Create: `hooks/use-contactos.ts`

- [ ] **Paso 4.1: Crear `hooks/use-clientes.ts`**

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiResponse, PaginatedResponse, Cliente } from '@/types/api';

type ClientesParams = {
  page?: number;
  limit?: number;
  busqueda?: string;
  tipo?: 'EMPRESA' | 'PARTICULAR' | null;
  estado?: 'ACTIVO' | 'INACTIVO' | 'PROSPECTO' | null;
  activo?: boolean;
};

export function useClientes(params: ClientesParams = {}) {
  return useQuery({
    queryKey: ['clientes', params],
    queryFn: () =>
      api.get<PaginatedResponse<Cliente>>('/clientes', { params }).then((r) => r.data),
  });
}

export function useCliente(id: string) {
  return useQuery({
    queryKey: ['clientes', id],
    queryFn: () =>
      api.get<ApiResponse<Cliente>>(`/clientes/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

export function useCrearCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Cliente, 'id'>) =>
      api.post<ApiResponse<Cliente>>('/clientes', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
    },
  });
}

export function useEditarCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Cliente> }) =>
      api.put<ApiResponse<Cliente>>(`/clientes/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      qc.invalidateQueries({ queryKey: ['clientes', id] });
    },
  });
}

export function useCambiarEstadoCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: 'ACTIVO' | 'INACTIVO' | 'PROSPECTO' }) =>
      api.patch<ApiResponse<Cliente>>(`/clientes/${id}/estado`, { estado }).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      qc.invalidateQueries({ queryKey: ['clientes', id] });
    },
  });
}
```

- [ ] **Paso 4.2: Crear `hooks/use-contactos.ts`**

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiResponse, PaginatedResponse, Contacto } from '@/types/api';

type ContactosParams = {
  clienteId?: string;
  page?: number;
  limit?: number;
  busqueda?: string;
  tipoContacto?: string | null;
  activo?: boolean | null;
};

export function useContactos(params: ContactosParams = {}) {
  return useQuery({
    queryKey: ['contactos', params],
    queryFn: () =>
      api.get<PaginatedResponse<Contacto>>('/contactos', { params }).then((r) => r.data),
  });
}

export function useContacto(id: string) {
  return useQuery({
    queryKey: ['contactos', id],
    queryFn: () =>
      api.get<ApiResponse<Contacto>>(`/contactos/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

export function useCrearContacto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Contacto, 'id'>) =>
      api.post<ApiResponse<Contacto>>('/contactos', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contactos'] });
    },
  });
}

export function useEditarContacto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Contacto> }) =>
      api.put<ApiResponse<Contacto>>(`/contactos/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['contactos'] });
      qc.invalidateQueries({ queryKey: ['contactos', id] });
    },
  });
}

export function useToggleActivoContacto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      api.patch<ApiResponse<Contacto>>(`/contactos/${id}/activo`, { activo }).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['contactos'] });
      qc.invalidateQueries({ queryKey: ['contactos', id] });
    },
  });
}
```

- [ ] **Paso 4.3: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Esperado: sin errores.

- [ ] **Paso 4.4: Commit**

```bash
git add hooks/use-clientes.ts hooks/use-contactos.ts
git commit -m "feat(clientes,contactos): agregar hooks de React Query para ambos módulos"
```

---

## Task 5: ClientesList + página de lista

**Files:**
- Create: `components/clientes/ClientesList.tsx`
- Create: `app/(dashboard)/clientes/page.tsx`

- [ ] **Paso 5.1: Crear `components/clientes/ClientesList.tsx`**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Icon } from '@/components/ui/Icon';
import { useClientes } from '@/hooks/use-clientes';
import { useAuthStore } from '@/stores/auth.store';

type TipoFilter = 'EMPRESA' | 'PARTICULAR' | null;
type EstadoFilter = 'ACTIVO' | 'INACTIVO' | 'PROSPECTO' | null;

export function ClientesList() {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');
  const [busqueda, setBusqueda] = useState('');
  const [filterTipo, setFilterTipo] = useState<TipoFilter>(null);
  const [filterEstado, setFilterEstado] = useState<EstadoFilter>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useClientes({
    page, limit: 10,
    busqueda: busqueda || undefined,
    tipo: filterTipo,
    estado: filterEstado,
  });

  function toggleTipo(t: 'EMPRESA' | 'PARTICULAR') {
    setFilterTipo((prev) => (prev === t ? null : t));
    setPage(1);
  }
  function toggleEstado(e: 'ACTIVO' | 'INACTIVO' | 'PROSPECTO') {
    setFilterEstado((prev) => (prev === e ? null : e));
    setPage(1);
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={`${data?.meta.total ?? '—'} empresas y particulares`}
        actions={
          <>
            <button className="btn btn--secondary"><Icon name="upload" size={14} /> Importar</button>
            <button className="btn btn--secondary"><Icon name="download" size={14} /> Exportar</button>
            {rol !== 'VISUALIZADOR' && (
              <Link href="/clientes/nuevo" className="btn btn--primary">
                <Icon name="plus" size={14} /> Nuevo cliente
              </Link>
            )}
          </>
        }
      />

      <FilterBar
        search={busqueda}
        onSearch={(v) => { setBusqueda(v); setPage(1); }}
        placeholder="Buscar por nombre, NIT, DUI, código…"
        chips={[
          { label: 'Empresas',     active: filterTipo === 'EMPRESA',    onToggle: () => toggleTipo('EMPRESA') },
          { label: 'Particulares', active: filterTipo === 'PARTICULAR', onToggle: () => toggleTipo('PARTICULAR') },
          { label: 'Activos',      active: filterEstado === 'ACTIVO',   onToggle: () => toggleEstado('ACTIVO') },
          { label: 'Inactivos',    active: filterEstado === 'INACTIVO', onToggle: () => toggleEstado('INACTIVO') },
          { label: 'Prospectos',   active: filterEstado === 'PROSPECTO',onToggle: () => toggleEstado('PROSPECTO') },
        ]}
        onClear={() => { setBusqueda(''); setFilterTipo(null); setFilterEstado(null); setPage(1); }}
      />

      {isLoading ? (
        <div className="flex justify-center p-12"><Spinner /></div>
      ) : (
        <DataTable>
          <thead>
            <tr>
              <th style={{ width: 110 }}>Código</th>
              <th className="hidden sm:table-cell" style={{ width: 110 }}>Tipo</th>
              <th>Cliente</th>
              <th className="hidden md:table-cell" style={{ width: 140 }}>Departamento</th>
              <th className="hidden md:table-cell" style={{ width: 120 }}>Teléfono</th>
              <th className="hidden md:table-cell" style={{ width: 70, textAlign: 'right' }}>Cot.</th>
              <th style={{ width: 110 }}>Estado</th>
              <th style={{ width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {data?.data.map((c) => (
              <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/clientes/${c.id}`)}>
                <td className="mono text-3">{c.id}</td>
                <td className="hidden sm:table-cell">
                  <span className="badge badge--neutral">{c.tipo === 'EMPRESA' ? 'Empresa' : 'Particular'}</span>
                </td>
                <td>
                  <div style={{ fontWeight: 500 }}>{c.razonSocial ?? c.nombre}</div>
                  <div className="mono text-3" style={{ fontSize: 'var(--t-xs)' }}>{c.nit ?? c.dui ?? '—'}</div>
                </td>
                <td className="hidden md:table-cell text-2">{c.departamento}</td>
                <td className="hidden md:table-cell mono text-2">{c.telefono ?? <span className="text-muted">—</span>}</td>
                <td className="hidden md:table-cell num">—</td>
                <td><Badge status={c.estado} /></td>
                <td>
                  <div className="row-actions">
                    <button className="icon-btn" onClick={(e) => { e.stopPropagation(); router.push(`/clientes/${c.id}`); }}>
                      <Icon name="eye" size={14} />
                    </button>
                    {rol !== 'VISUALIZADOR' && (
                      <button className="icon-btn" onClick={(e) => { e.stopPropagation(); router.push(`/clientes/${c.id}/editar`); }}>
                        <Icon name="edit" size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {data?.data.length === 0 && (
              <tr><td colSpan={8}>
                <EmptyState icon="users" title="Sin resultados" message="Probá con otros filtros o limpiá la búsqueda." />
              </td></tr>
            )}
          </tbody>
        </DataTable>
      )}

      <Pagination page={page} pageSize={10} total={data?.meta.total ?? 0} onPage={setPage} />
    </div>
  );
}
```

- [ ] **Paso 5.2: Crear `app/(dashboard)/clientes/page.tsx`**

```tsx
import { ClientesList } from '@/components/clientes/ClientesList';

export default function ClientesPage() {
  return <ClientesList />;
}
```

- [ ] **Paso 5.3: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Esperado: sin errores.

- [ ] **Paso 5.4: Commit**

```bash
git add components/clientes/ClientesList.tsx app/\(dashboard\)/clientes/page.tsx
git commit -m "feat(clientes): agregar lista de clientes con filtros y paginación"
```

---

## Task 6: ClienteDetalle + ContactosDeCliente + página de detalle

**Files:**
- Create: `components/clientes/ContactosDeCliente.tsx`
- Create: `components/clientes/ClienteDetalle.tsx`
- Create: `app/(dashboard)/clientes/[id]/page.tsx`

- [ ] **Paso 6.1: Crear `components/clientes/ContactosDeCliente.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { useContactos } from '@/hooks/use-contactos';
import { useAuthStore } from '@/stores/auth.store';

const TIPO_BADGE: Record<string, string> = {
  PRINCIPAL: 'badge--info', SECUNDARIO: 'badge--neutral',
  SOLICITANTE: 'badge--warn', FACTURACION: 'badge--ok', OPERATIVO: 'badge--neutral',
};
const TIPO_LABEL: Record<string, string> = {
  PRINCIPAL: 'Principal', SECUNDARIO: 'Secundario',
  SOLICITANTE: 'Solicitante', FACTURACION: 'Facturación', OPERATIVO: 'Operativo',
};

export function ContactosDeCliente({ clienteId }: { clienteId: string }) {
  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');
  const { data, isLoading } = useContactos({ clienteId, limit: 50 });
  const items = data?.data ?? [];

  return (
    <div className="card card--flush mt-4">
      <div className="card__head">
        <div>
          <h3 className="card__title">Contactos</h3>
          <p className="card__sub">
            {items.length} {items.length === 1 ? 'contacto vinculado' : 'contactos vinculados'}
          </p>
        </div>
        {rol !== 'VISUALIZADOR' && (
          <Link href={`/contactos/nuevo?clienteId=${clienteId}`} className="btn btn--secondary btn--sm">
            <Icon name="plus" size={12} /> Nuevo contacto
          </Link>
        )}
      </div>
      {isLoading ? (
        <div className="flex justify-center p-8"><Spinner /></div>
      ) : items.length > 0 ? (
        <table className="table">
          <thead>
            <tr>
              <th style={{ paddingLeft: 14 }}>Nombre</th>
              <th className="hidden sm:table-cell">Cargo</th>
              <th style={{ width: 120 }}>Tipo</th>
              <th className="hidden sm:table-cell" style={{ width: 130 }}>Teléfono</th>
              <th className="hidden md:table-cell">Email</th>
              <th style={{ width: 60 }} />
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td style={{ paddingLeft: 14 }}>
                  <div style={{ fontWeight: 500 }}>{c.nombre}{c.apellido ? ` ${c.apellido}` : ''}</div>
                  <div className="mono text-3" style={{ fontSize: 'var(--t-xs)' }}>{c.id}</div>
                </td>
                <td className="hidden sm:table-cell text-2">{c.cargo ?? <span className="text-muted">—</span>}</td>
                <td>
                  <span className={`badge ${TIPO_BADGE[c.tipoContacto] ?? 'badge--neutral'}`}>
                    <span className="badge__dot" />{TIPO_LABEL[c.tipoContacto] ?? c.tipoContacto}
                  </span>
                </td>
                <td className="hidden sm:table-cell mono text-2">{c.telefono ?? <span className="text-muted">—</span>}</td>
                <td className="hidden md:table-cell text-2 text-sm">{c.email ?? <span className="text-muted">—</span>}</td>
                <td>
                  <div className="row-actions">
                    <Link href={`/contactos/${c.id}`} className="icon-btn"><Icon name="eye" size={14} /></Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="py-8 text-center text-sm text-tx-2">
          Este cliente aún no tiene contactos registrados.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Paso 6.2: Crear `components/clientes/ClienteDetalle.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { ContactosDeCliente } from '@/components/clientes/ContactosDeCliente';
import { useCliente } from '@/hooks/use-clientes';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency } from '@/lib/utils';

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function ClienteDetalle({ id }: { id: string }) {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');
  const { data: cliente, isLoading, isError } = useCliente(id);

  if (isLoading) return <div className="flex justify-center p-12"><Spinner /></div>;
  if (isError || !cliente) return <div className="p-8 text-center text-sm text-tx-2">No se pudo cargar el cliente.</div>;

  const displayName = cliente.razonSocial ?? cliente.nombre ?? '—';

  return (
    <div>
      <PageHeader
        title={displayName}
        subtitle={
          <>
            <span className="badge badge--neutral">{cliente.tipo === 'EMPRESA' ? 'Empresa' : 'Particular'}</span>{' '}
            <Badge status={cliente.estado} />
            <span className="text-3 mono" style={{ marginLeft: 8 }}>· {cliente.id}</span>
          </>
        }
        back
        onBack={() => router.push('/clientes')}
        actions={
          <>
            {rol !== 'VISUALIZADOR' && (
              <Link href={`/clientes/${id}/editar`} className="btn btn--secondary">Editar</Link>
            )}
            {rol !== 'VISUALIZADOR' && rol !== 'LOGISTICA' && (
              <Link href={`/cotizaciones/nueva?clienteId=${id}`} className="btn btn--primary">
                Nueva cotización
              </Link>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-4">
          <div className="card">
            <h3 className="card__title mb-3">Información general</h3>
            <dl style={{ margin: 0 }}>
              {cliente.tipo === 'EMPRESA' ? (
                <>
                  <DetailRow label="Razón social" value={cliente.razonSocial} />
                  <DetailRow label="Nombre comercial" value={cliente.nombreComercial ?? <span className="text-muted">—</span>} />
                  <DetailRow label="NIT" value={<span className="mono">{cliente.nit ?? '—'}</span>} />
                  <DetailRow label="NCR" value={<span className="mono">{cliente.ncr ?? '—'}</span>} />
                  <DetailRow label="Sector" value={cliente.sector ?? <span className="text-muted">—</span>} />
                  <DetailRow label="Actividad económica" value={cliente.actividadEconomica ?? <span className="text-muted">—</span>} />
                </>
              ) : (
                <>
                  <DetailRow label="Nombre" value={cliente.nombre} />
                  <DetailRow label="Apellido" value={cliente.apellido ?? <span className="text-muted">—</span>} />
                  <DetailRow label="DUI" value={<span className="mono">{cliente.dui ?? '—'}</span>} />
                  <DetailRow label="Ocupación" value={cliente.ocupacion ?? <span className="text-muted">—</span>} />
                </>
              )}
            </dl>
          </div>
          <div className="card">
            <h3 className="card__title mb-3">Dirección</h3>
            <dl style={{ margin: 0 }}>
              <DetailRow label="Departamento" value={cliente.departamento} />
              <DetailRow label="Municipio" value={cliente.municipio} />
              <DetailRow label="Complemento" value={cliente.complemento ?? <span className="text-muted">—</span>} />
            </dl>
          </div>
          <div className="card">
            <h3 className="card__title mb-3">Contacto</h3>
            <dl style={{ margin: 0 }}>
              <DetailRow label="Teléfono" value={<span className="mono">{cliente.telefono ?? '—'}</span>} />
              <DetailRow label="Correo" value={cliente.email ?? '—'} />
              <DetailRow label="Notas" value={cliente.notas ?? <span className="text-muted">Sin notas.</span>} />
            </dl>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card">
            <div style={{ display: 'flex', gap: 24 }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600 }}>Total facturado</div>
                <div className="mono" style={{ fontSize: 26, fontWeight: 500, marginTop: 4 }}>
                  {cliente.facturado ? formatCurrency(cliente.facturado) : '$0.00'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600 }}>Proyectos</div>
                <div className="mono" style={{ fontSize: 26, fontWeight: 500, marginTop: 4 }}>{cliente.proyectos ?? 0}</div>
              </div>
            </div>
          </div>
          {/* Tablas de cotizaciones y facturas: se completarán en RAMA 6 y RAMA 7 */}
          <div className="card card--flush">
            <div className="card__head"><h3 className="card__title">Historial de cotizaciones</h3></div>
            <table className="table"><tbody>
              <tr><td colSpan={3} style={{ padding: '18px', color: 'var(--text-muted)', fontSize: 'var(--t-sm)' }}>Sin cotizaciones registradas.</td></tr>
            </tbody></table>
          </div>
          <div className="card card--flush">
            <div className="card__head"><h3 className="card__title">Facturas vinculadas</h3></div>
            <table className="table"><tbody>
              <tr><td colSpan={3} style={{ padding: '18px', color: 'var(--text-muted)', fontSize: 'var(--t-sm)' }}>Sin facturas vinculadas.</td></tr>
            </tbody></table>
          </div>
        </div>
      </div>

      <ContactosDeCliente clienteId={id} />
    </div>
  );
}
```

- [ ] **Paso 6.3: Crear `app/(dashboard)/clientes/[id]/page.tsx`**

```tsx
import { ClienteDetalle } from '@/components/clientes/ClienteDetalle';

type Props = { params: Promise<{ id: string }> };

export default async function ClienteDetallePage({ params }: Props) {
  const { id } = await params;
  return <ClienteDetalle id={id} />;
}
```

- [ ] **Paso 6.4: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Esperado: sin errores.

- [ ] **Paso 6.5: Commit**

```bash
git add components/clientes/ClienteDetalle.tsx components/clientes/ContactosDeCliente.tsx app/\(dashboard\)/clientes/\[id\]/page.tsx
git commit -m "feat(clientes): agregar detalle de cliente y mini-tabla de contactos vinculados"
```

---

## Task 7: ClienteForm + páginas de crear y editar

**Files:**
- Create: `components/clientes/ClienteForm.tsx`
- Create: `app/(dashboard)/clientes/nuevo/page.tsx`
- Create: `app/(dashboard)/clientes/[id]/editar/page.tsx`

- [ ] **Paso 7.1: Crear `components/clientes/ClienteForm.tsx`**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { useCliente, useCrearCliente, useEditarCliente, useCambiarEstadoCliente } from '@/hooks/use-clientes';
import { DEPARTAMENTOS_SV, MUNICIPIOS_SV, SECTORES } from '@/lib/sv-geo';

const schema = z.object({
  tipo: z.enum(['EMPRESA', 'PARTICULAR']),
  razonSocial: z.string().optional(),
  nombreComercial: z.string().optional(),
  nit: z.string().optional(),
  ncr: z.string().optional(),
  sector: z.string().optional(),
  actividadEconomica: z.string().optional(),
  nombre: z.string().optional(),
  apellido: z.string().optional(),
  dui: z.string().optional(),
  ocupacion: z.string().optional(),
  departamento: z.string().min(1, 'El departamento es obligatorio.'),
  municipio: z.string().min(1),
  complemento: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().optional(),
  notas: z.string().optional(),
  estado: z.enum(['ACTIVO', 'INACTIVO', 'PROSPECTO']).default('ACTIVO'),
}).superRefine((d, ctx) => {
  if (d.tipo === 'EMPRESA') {
    if (!d.razonSocial?.trim())
      ctx.addIssue({ code: 'custom', path: ['razonSocial'], message: 'La razón social es obligatoria.' });
    if (d.nit && !/^\d{4}-\d{6}-\d{3}-\d$/.test(d.nit))
      ctx.addIssue({ code: 'custom', path: ['nit'], message: 'Formato: 0614-DDMMAA-NNN-N' });
  } else {
    if (!d.nombre?.trim())
      ctx.addIssue({ code: 'custom', path: ['nombre'], message: 'El nombre es obligatorio.' });
    if (d.dui && !/^\d{8}-\d$/.test(d.dui))
      ctx.addIssue({ code: 'custom', path: ['dui'], message: 'Formato: NNNNNNNN-N' });
    if (d.nit && !/^\d{4}-\d{6}-\d{3}-\d$/.test(d.nit))
      ctx.addIssue({ code: 'custom', path: ['nit'], message: 'Formato: 0614-DDMMAA-NNN-N' });
  }
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))
    ctx.addIssue({ code: 'custom', path: ['email'], message: 'Correo inválido.' });
});

type FormData = z.infer<typeof schema>;

const DEFAULTS: FormData = {
  tipo: 'EMPRESA',
  razonSocial: '', nombreComercial: '', nit: '', ncr: '', sector: '', actividadEconomica: '',
  nombre: '', apellido: '', dui: '', ocupacion: '',
  departamento: 'San Salvador', municipio: 'San Salvador',
  complemento: '', telefono: '', email: '', notas: '',
  estado: 'ACTIVO',
};

export function ClienteForm({ id }: { id?: string }) {
  const isNew = !id;
  const router = useRouter();
  const [confirmDesact, setConfirmDesact] = useState(false);

  const { data: existing, isLoading: loadingExisting } = useCliente(id ?? '');
  const crear = useCrearCliente();
  const editar = useEditarCliente();
  const cambiarEstado = useCambiarEstadoCliente();

  const { register, handleSubmit, watch, setValue, setError, reset, formState: { errors } } =
    useForm<FormData>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });

  const tipo = watch('tipo');
  const departamento = watch('departamento');
  const munis = MUNICIPIOS_SV[departamento] ?? [departamento];

  useEffect(() => {
    if (existing) reset({ ...DEFAULTS, ...existing });
  }, [existing, reset]);

  const isPending = crear.isPending || editar.isPending || cambiarEstado.isPending;

  function handleError(err: unknown) {
    const e = (err as any)?.response?.data?.error;
    const details: { field: string; message: string }[] = e?.details ?? [];
    details.forEach((d) => setError(d.field as keyof FormData, { message: d.message }));
    if (!details.length) toast.error(e?.message ?? 'Ocurrió un error inesperado.');
  }

  function onSubmit(data: FormData) {
    if (isNew) {
      crear.mutate(data, {
        onSuccess: () => { toast.success('Cliente creado correctamente.'); router.push('/clientes'); },
        onError: handleError,
      });
    } else {
      editar.mutate({ id: id!, data }, {
        onSuccess: () => { toast.success('Cambios guardados correctamente.'); router.push(`/clientes/${id}`); },
        onError: handleError,
      });
    }
  }

  function handleDesactivar() {
    cambiarEstado.mutate({ id: id!, estado: 'INACTIVO' }, {
      onSuccess: () => { toast.success('Cliente desactivado.'); router.push(`/clientes/${id}`); },
      onError: handleError,
    });
    setConfirmDesact(false);
  }

  if (!isNew && loadingExisting) return <div className="flex justify-center p-12"><Spinner /></div>;

  return (
    <div className="form-page">
      <PageHeader
        title={isNew ? 'Nuevo cliente' : `Editar — ${existing?.razonSocial ?? existing?.nombre ?? ''}`}
        subtitle={isNew ? 'Registrá un cliente para emitir cotizaciones y facturas.' : 'Modificá los datos del cliente.'}
        back
        onBack={() => router.push(isNew ? '/clientes' : `/clientes/${id}`)}
      />

      {confirmDesact && (
        <ConfirmRow
          message={<>¿Desactivar al cliente <b>{existing?.razonSocial ?? existing?.nombre}</b>? El registro permanecerá pero quedará fuera de los selectores de nuevos documentos.</>}
          onCancel={() => setConfirmDesact(false)}
          onConfirm={handleDesactivar}
          confirmLabel="Sí, desactivar"
        />
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <FormSection title="Tipo de cliente">
          <div className="seg" style={{ maxWidth: 320 }}>
            {(['EMPRESA', 'PARTICULAR'] as const).map((t) => (
              <div key={t} className={`seg__opt ${tipo === t ? 'is-active' : ''}`} onClick={() => setValue('tipo', t)}>
                {t === 'EMPRESA' ? 'Empresa' : 'Particular'}
              </div>
            ))}
          </div>
        </FormSection>

        <FormSection title={tipo === 'EMPRESA' ? 'Datos de la empresa' : 'Datos personales'}>
          <div className="form-grid">
            {tipo === 'EMPRESA' ? (
              <>
                <div className="field span-2">
                  <label className="field__label">Razón social <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input className={`input ${errors.razonSocial ? 'input--error' : ''}`} {...register('razonSocial')} placeholder="Constructora Ejemplo, S.A. de C.V." />
                  {errors.razonSocial && <div className="field__error">{errors.razonSocial.message}</div>}
                </div>
                <div className="field">
                  <label className="field__label">NIT</label>
                  <input className={`input mono ${errors.nit ? 'input--error' : ''}`} {...register('nit')} placeholder="0614-DDMMAA-NNN-N" />
                  {errors.nit && <div className="field__error">{errors.nit.message}</div>}
                </div>
                <div className="field">
                  <label className="field__label">NCR</label>
                  <input className="input mono" {...register('ncr')} placeholder="183456-7" />
                </div>
                <div className="field span-2">
                  <label className="field__label">Nombre comercial</label>
                  <input className="input" {...register('nombreComercial')} placeholder="Nombre con el que se conoce comúnmente" />
                </div>
                <div className="field">
                  <label className="field__label">Sector</label>
                  <select className="select" {...register('sector')}>
                    <option value="">— Seleccionar —</option>
                    {SECTORES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field__label">Actividad económica</label>
                  <input className="input" {...register('actividadEconomica')} placeholder="Ej. Construcción de obra civil" />
                </div>
              </>
            ) : (
              <>
                <div className="field">
                  <label className="field__label">Nombre <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input className={`input ${errors.nombre ? 'input--error' : ''}`} {...register('nombre')} placeholder="Juan Carlos" />
                  {errors.nombre && <div className="field__error">{errors.nombre.message}</div>}
                </div>
                <div className="field">
                  <label className="field__label">Apellido</label>
                  <input className="input" {...register('apellido')} placeholder="Hernández Pérez" />
                </div>
                <div className="field">
                  <label className="field__label">DUI</label>
                  <input className={`input mono ${errors.dui ? 'input--error' : ''}`} {...register('dui')} placeholder="01234567-8" />
                  {errors.dui && <div className="field__error">{errors.dui.message}</div>}
                </div>
                <div className="field">
                  <label className="field__label">Ocupación</label>
                  <input className="input" {...register('ocupacion')} placeholder="Ej. Arquitecto independiente" />
                </div>
                <div className="field">
                  <label className="field__label">NIT (opcional)</label>
                  <input className="input mono" {...register('nit')} placeholder="0614-DDMMAA-NNN-N" />
                  <div className="field__hint">Solo para particulares con obligación tributaria.</div>
                </div>
                <div className="field">
                  <label className="field__label">NCR (opcional)</label>
                  <input className="input mono" {...register('ncr')} placeholder="183456-7" />
                </div>
              </>
            )}
          </div>
        </FormSection>

        <FormSection title="Dirección">
          <div className="form-grid">
            <div className="field">
              <label className="field__label">Departamento <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select
                className="select"
                {...register('departamento')}
                onChange={(e) => {
                  setValue('departamento', e.target.value);
                  const m = MUNICIPIOS_SV[e.target.value];
                  if (m) setValue('municipio', m[0]);
                }}
              >
                {DEPARTAMENTOS_SV.map((d) => <option key={d}>{d}</option>)}
              </select>
              {errors.departamento && <div className="field__error">{errors.departamento.message}</div>}
            </div>
            <div className="field">
              <label className="field__label">Municipio</label>
              <select className="select" {...register('municipio')}>
                {munis.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="field span-2">
              <label className="field__label">Complemento (dirección detallada)</label>
              <textarea className="textarea" {...register('complemento')} placeholder="Colonia, calle, número, referencia…" style={{ minHeight: 60 }} />
            </div>
          </div>
        </FormSection>

        <FormSection title="Contacto">
          <div className="form-grid">
            <div className="field">
              <label className="field__label">Teléfono</label>
              <input className="input mono" {...register('telefono')} placeholder="2222-0000" />
            </div>
            <div className="field">
              <label className="field__label">Correo electrónico</label>
              <input className={`input ${errors.email ? 'input--error' : ''}`} type="email" {...register('email')} placeholder="contacto@empresa.sv" />
              {errors.email && <div className="field__error">{errors.email.message}</div>}
            </div>
            <div className="field span-2">
              <label className="field__label">Notas internas</label>
              <textarea className="textarea" {...register('notas')} placeholder="Información adicional para el equipo de ventas (opcional)." />
            </div>
            {!isNew && (
              <div className="field span-2">
                <label className="field__label">Estado</label>
                <div className="seg" style={{ maxWidth: 400 }}>
                  {(['ACTIVO', 'INACTIVO', 'PROSPECTO'] as const).map((s) => (
                    <div key={s} className={`seg__opt ${watch('estado') === s ? 'is-active' : ''}`} onClick={() => setValue('estado', s)}>
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </FormSection>

        <div className="form-footer flex-col sm:flex-row">
          <button type="button" className="btn btn--ghost w-full sm:w-auto" onClick={() => router.back()}>
            Cancelar
          </button>
          {!isNew && existing?.estado !== 'INACTIVO' && (
            <button type="button" className="btn btn--ghost w-full sm:w-auto sm:mr-auto" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDesact(true)}>
              <Icon name="x" size={14} /> Desactivar cliente
            </button>
          )}
          <button type="submit" className="btn btn--primary w-full sm:w-auto" disabled={isPending}>
            {isPending ? <><Spinner /> Guardando…</> : <><Icon name="check" size={14} /> {isNew ? 'Crear cliente' : 'Guardar cambios'}</>}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Paso 7.2: Crear `app/(dashboard)/clientes/nuevo/page.tsx`**

```tsx
import { ClienteForm } from '@/components/clientes/ClienteForm';

export default function NuevoClientePage() {
  return <ClienteForm />;
}
```

- [ ] **Paso 7.3: Crear `app/(dashboard)/clientes/[id]/editar/page.tsx`**

```tsx
import { ClienteForm } from '@/components/clientes/ClienteForm';

type Props = { params: Promise<{ id: string }> };

export default async function EditarClientePage({ params }: Props) {
  const { id } = await params;
  return <ClienteForm id={id} />;
}
```

- [ ] **Paso 7.4: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Esperado: sin errores.

- [ ] **Paso 7.5: Commit**

```bash
git add components/clientes/ClienteForm.tsx app/\(dashboard\)/clientes/nuevo/page.tsx app/\(dashboard\)/clientes/\[id\]/editar/page.tsx
git commit -m "feat(clientes): agregar formulario de creación y edición de clientes"
```

---

## Task 8: ContactosList + página de lista

**Files:**
- Create: `components/contactos/ContactosList.tsx`
- Create: `app/(dashboard)/contactos/page.tsx`

- [ ] **Paso 8.1: Crear `components/contactos/ContactosList.tsx`**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Icon } from '@/components/ui/Icon';
import { useContactos } from '@/hooks/use-contactos';
import { useAuthStore } from '@/stores/auth.store';

const TIPO_BADGE: Record<string, string> = {
  PRINCIPAL: 'badge--info', SECUNDARIO: 'badge--neutral',
  SOLICITANTE: 'badge--warn', FACTURACION: 'badge--ok', OPERATIVO: 'badge--neutral',
};
const TIPO_LABEL: Record<string, string> = {
  PRINCIPAL: 'Principal', SECUNDARIO: 'Secundario',
  SOLICITANTE: 'Solicitante', FACTURACION: 'Facturación', OPERATIVO: 'Operativo',
};

type EstadoFilter = 'ACTIVO' | 'INACTIVO' | null;

export function ContactosList() {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');
  const [busqueda, setBusqueda] = useState('');
  const [filterTipo, setFilterTipo] = useState<string | null>(null);
  const [filterEstado, setFilterEstado] = useState<EstadoFilter>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useContactos({
    page, limit: 10,
    busqueda: busqueda || undefined,
    tipoContacto: filterTipo,
    activo: filterEstado === 'ACTIVO' ? true : filterEstado === 'INACTIVO' ? false : null,
  });

  function toggleTipo(t: string) {
    setFilterTipo((prev) => (prev === t ? null : t));
    setPage(1);
  }
  function toggleEstado(e: 'ACTIVO' | 'INACTIVO') {
    setFilterEstado((prev) => (prev === e ? null : e));
    setPage(1);
  }

  return (
    <div>
      <PageHeader
        title="Contactos"
        subtitle={`${data?.meta.total ?? '—'} contactos registrados`}
        actions={
          <>
            <button className="btn btn--secondary"><Icon name="download" size={14} /> Exportar</button>
            {rol !== 'VISUALIZADOR' && (
              <Link href="/contactos/nuevo" className="btn btn--primary">
                <Icon name="plus" size={14} /> Nuevo contacto
              </Link>
            )}
          </>
        }
      />

      <FilterBar
        search={busqueda}
        onSearch={(v) => { setBusqueda(v); setPage(1); }}
        placeholder="Buscar por nombre, cargo, código…"
        chips={[
          { label: 'Principales',  active: filterTipo === 'PRINCIPAL',   onToggle: () => toggleTipo('PRINCIPAL') },
          { label: 'Secundarios',  active: filterTipo === 'SECUNDARIO',  onToggle: () => toggleTipo('SECUNDARIO') },
          { label: 'Solicitantes', active: filterTipo === 'SOLICITANTE', onToggle: () => toggleTipo('SOLICITANTE') },
          { label: 'Facturación',  active: filterTipo === 'FACTURACION', onToggle: () => toggleTipo('FACTURACION') },
          { label: 'Operativos',   active: filterTipo === 'OPERATIVO',   onToggle: () => toggleTipo('OPERATIVO') },
          { label: 'Activos',      active: filterEstado === 'ACTIVO',    onToggle: () => toggleEstado('ACTIVO') },
          { label: 'Inactivos',    active: filterEstado === 'INACTIVO',  onToggle: () => toggleEstado('INACTIVO') },
        ]}
        onClear={() => { setBusqueda(''); setFilterTipo(null); setFilterEstado(null); setPage(1); }}
      />

      {isLoading ? (
        <div className="flex justify-center p-12"><Spinner /></div>
      ) : (
        <DataTable>
          <thead>
            <tr>
              <th className="hidden sm:table-cell" style={{ width: 110 }}>Código</th>
              <th>Nombre completo</th>
              <th className="hidden lg:table-cell" style={{ width: 200 }}>Cargo</th>
              <th>Cliente vinculado</th>
              <th style={{ width: 130 }}>Tipo</th>
              <th className="hidden sm:table-cell" style={{ width: 130 }}>Teléfono</th>
              <th style={{ width: 110 }}>Estado</th>
              <th style={{ width: 60 }} />
            </tr>
          </thead>
          <tbody>
            {data?.data.map((c) => (
              <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/contactos/${c.id}`)}>
                <td className="hidden sm:table-cell mono text-3">{c.id}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{c.nombre}{c.apellido ? ` ${c.apellido}` : ''}</div>
                  {c.email && <div style={{ fontSize: 'var(--t-xs)', color: 'var(--text-3)' }}>{c.email}</div>}
                </td>
                <td className="hidden lg:table-cell text-2">{c.cargo ?? <span className="text-muted">—</span>}</td>
                <td>
                  <Link href={`/clientes/${c.clienteId}`} className="text-info hover:underline" onClick={(e) => e.stopPropagation()}>
                    {c.clienteId}
                  </Link>
                </td>
                <td>
                  <span className={`badge ${TIPO_BADGE[c.tipoContacto] ?? 'badge--neutral'}`}>
                    <span className="badge__dot" />{TIPO_LABEL[c.tipoContacto] ?? c.tipoContacto}
                  </span>
                </td>
                <td className="hidden sm:table-cell mono text-2">{c.telefono ?? <span className="text-muted">—</span>}</td>
                <td>
                  <span className={`badge ${c.activo ? 'badge--ok' : 'badge--neutral'}`}>
                    <span className="badge__dot" />{c.activo ? 'ACTIVO' : 'INACTIVO'}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button className="icon-btn" onClick={(e) => { e.stopPropagation(); router.push(`/contactos/${c.id}`); }}>
                      <Icon name="eye" size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {data?.data.length === 0 && (
              <tr><td colSpan={8}>
                <EmptyState icon="idCard" title="Sin contactos" message="No se encontraron contactos con los filtros aplicados." />
              </td></tr>
            )}
          </tbody>
        </DataTable>
      )}

      <Pagination page={page} pageSize={10} total={data?.meta.total ?? 0} onPage={setPage} />
    </div>
  );
}
```

- [ ] **Paso 8.2: Crear `app/(dashboard)/contactos/page.tsx`**

```tsx
import { ContactosList } from '@/components/contactos/ContactosList';

export default function ContactosPage() {
  return <ContactosList />;
}
```

- [ ] **Paso 8.3: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Esperado: sin errores.

- [ ] **Paso 8.4: Commit**

```bash
git add components/contactos/ContactosList.tsx app/\(dashboard\)/contactos/page.tsx
git commit -m "feat(contactos): agregar lista de contactos con filtros y paginación"
```

---

## Task 9: ContactoDetalle + página de detalle

**Files:**
- Create: `components/contactos/ContactoDetalle.tsx`
- Create: `app/(dashboard)/contactos/[id]/page.tsx`

- [ ] **Paso 9.1: Crear `components/contactos/ContactoDetalle.tsx`**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { Icon } from '@/components/ui/Icon';
import { useContacto, useToggleActivoContacto } from '@/hooks/use-contactos';
import { useAuthStore } from '@/stores/auth.store';

const TIPO_BADGE: Record<string, string> = {
  PRINCIPAL: 'badge--info', SECUNDARIO: 'badge--neutral',
  SOLICITANTE: 'badge--warn', FACTURACION: 'badge--ok', OPERATIVO: 'badge--neutral',
};
const TIPO_LABEL: Record<string, string> = {
  PRINCIPAL: 'Principal', SECUNDARIO: 'Secundario',
  SOLICITANTE: 'Solicitante', FACTURACION: 'Facturación', OPERATIVO: 'Operativo',
};

export function ContactoDetalle({ id }: { id: string }) {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');
  const [confirmDesact, setConfirmDesact] = useState(false);

  const { data: contacto, isLoading, isError } = useContacto(id);
  const toggleActivo = useToggleActivoContacto();

  if (isLoading) return <div className="flex justify-center p-12"><Spinner /></div>;
  if (isError || !contacto) return <div className="p-8 text-center text-sm text-tx-2">No se pudo cargar el contacto.</div>;

  const fullName = `${contacto.nombre}${contacto.apellido ? ' ' + contacto.apellido : ''}`;

  function handleDesactivar() {
    toggleActivo.mutate({ id, activo: false }, {
      onSuccess: () => { toast.success('Contacto desactivado.'); setConfirmDesact(false); },
      onError: (err: any) => {
        toast.error(err?.response?.data?.error?.message ?? 'Ocurrió un error inesperado.');
        setConfirmDesact(false);
      },
    });
  }

  return (
    <div>
      <PageHeader
        title={fullName}
        subtitle={
          <>
            {contacto.cargo && <span className="text-2">{contacto.cargo} · </span>}
            <span className={`badge ${TIPO_BADGE[contacto.tipoContacto] ?? 'badge--neutral'}`}>
              <span className="badge__dot" />{TIPO_LABEL[contacto.tipoContacto] ?? contacto.tipoContacto}
            </span>{' '}
            <span className={`badge ${contacto.activo ? 'badge--ok' : 'badge--neutral'}`}>
              <span className="badge__dot" />{contacto.activo ? 'ACTIVO' : 'INACTIVO'}
            </span>
            <span className="text-3 mono" style={{ marginLeft: 8 }}>· {contacto.id}</span>
          </>
        }
        back
        onBack={() => router.push('/contactos')}
        actions={
          <>
            {rol !== 'VISUALIZADOR' && (
              <Link href={`/contactos/${id}/editar`} className="btn btn--secondary">
                <Icon name="edit" size={14} /> Editar
              </Link>
            )}
            {contacto.activo && rol !== 'VISUALIZADOR' && (
              <button type="button" className="btn btn--ghost" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDesact(true)}>
                <Icon name="x" size={14} /> Desactivar
              </button>
            )}
          </>
        }
      />

      {confirmDesact && (
        <ConfirmRow
          message={<>¿Desactivar el contacto <b>{fullName}</b>? Dejará de aparecer en los selectores de nuevos documentos.</>}
          onCancel={() => setConfirmDesact(false)}
          onConfirm={handleDesactivar}
          confirmLabel="Sí, desactivar"
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-4">
          <div className="card">
            <h3 className="card__title mb-3">Información de contacto</h3>
            <dl style={{ margin: 0 }}>
              <div className="detail-row"><dt>Teléfono</dt><dd className="mono">{contacto.telefono ?? <span className="text-muted">—</span>}</dd></div>
              <div className="detail-row"><dt>Correo electrónico</dt><dd>{contacto.email ?? <span className="text-muted">—</span>}</dd></div>
              <div className="detail-row"><dt>Notas</dt><dd>{contacto.notas ?? <span className="text-muted">Sin notas registradas.</span>}</dd></div>
            </dl>
          </div>
          {/* Sección "Aparece en" se completa en RAMA 6 (cotizaciones) y RAMA 7 (facturas) */}
          <div className="card card--flush">
            <div className="card__head">
              <h3 className="card__title">Aparece en</h3>
              <span className="text-3 text-sm">Documentos vinculados</span>
            </div>
            <div style={{ padding: '16px 18px', color: 'var(--text-muted)', fontSize: 'var(--t-sm)' }}>
              Las vinculaciones estarán disponibles cuando se implementen los módulos de cotizaciones y facturas.
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="card__title mb-3">Cliente vinculado</h3>
          <div style={{ padding: 14, background: 'var(--bg-sunken)', borderRadius: 4, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 4, background: 'var(--navy)', color: 'white', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon name="building" size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mono font-semibold">{contacto.clienteId}</div>
              </div>
            </div>
          </div>
          <Link href={`/clientes/${contacto.clienteId}`} className="btn btn--secondary" style={{ width: '100%', justifyContent: 'center' }}>
            Ver detalle del cliente <Icon name="arrowRight" size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Paso 9.2: Crear `app/(dashboard)/contactos/[id]/page.tsx`**

```tsx
import { ContactoDetalle } from '@/components/contactos/ContactoDetalle';

type Props = { params: Promise<{ id: string }> };

export default async function ContactoDetallePage({ params }: Props) {
  const { id } = await params;
  return <ContactoDetalle id={id} />;
}
```

- [ ] **Paso 9.3: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Esperado: sin errores.

- [ ] **Paso 9.4: Commit**

```bash
git add components/contactos/ContactoDetalle.tsx app/\(dashboard\)/contactos/\[id\]/page.tsx
git commit -m "feat(contactos): agregar detalle de contacto"
```

---

## Task 10: ContactoForm + páginas de crear y editar

**Files:**
- Create: `components/contactos/ContactoForm.tsx`
- Create: `app/(dashboard)/contactos/nuevo/page.tsx`
- Create: `app/(dashboard)/contactos/[id]/editar/page.tsx`

- [ ] **Paso 10.1: Crear `components/contactos/ContactoForm.tsx`**

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { useContacto, useCrearContacto, useEditarContacto } from '@/hooks/use-contactos';
import { useClientes } from '@/hooks/use-clientes';

const TIPOS_CONTACTO = [
  { value: 'PRINCIPAL',   label: 'Principal' },
  { value: 'SECUNDARIO',  label: 'Secundario' },
  { value: 'SOLICITANTE', label: 'Solicitante' },
  { value: 'FACTURACION', label: 'Facturación' },
  { value: 'OPERATIVO',   label: 'Operativo' },
] as const;

const schema = z.object({
  clienteId: z.string().min(1, 'El cliente es obligatorio.'),
  nombre: z.string().min(1, 'El nombre es obligatorio.'),
  apellido: z.string().optional(),
  cargo: z.string().optional(),
  tipoContacto: z.enum(['PRINCIPAL', 'SECUNDARIO', 'SOLICITANTE', 'FACTURACION', 'OPERATIVO']),
  telefono: z.string().optional(),
  email: z.string().optional().refine(
    (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    { message: 'Correo inválido.' }
  ),
  notas: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const DEFAULTS: FormData = {
  clienteId: '', nombre: '', apellido: '', cargo: '',
  tipoContacto: 'SECUNDARIO',
  telefono: '', email: '', notas: '',
};

export function ContactoForm({ id }: { id?: string }) {
  const isNew = !id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientePre = searchParams.get('clienteId') ?? '';

  const { data: existing, isLoading: loadingExisting } = useContacto(id ?? '');
  const { data: clientesData } = useClientes({ limit: 200 } as any);
  const crear = useCrearContacto();
  const editar = useEditarContacto();

  const { register, handleSubmit, watch, setValue, setError, reset, formState: { errors } } =
    useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { ...DEFAULTS, clienteId: clientePre } });

  const clienteId = watch('clienteId');
  const clienteReadonly = !isNew || !!clientePre;
  const clienteSeleccionado = clientesData?.data.find((c) => c.id === clienteId);

  useEffect(() => {
    if (existing) reset({ ...DEFAULTS, ...existing });
  }, [existing, reset]);

  const isPending = crear.isPending || editar.isPending;

  function handleError(err: unknown) {
    const e = (err as any)?.response?.data?.error;
    const details: { field: string; message: string }[] = e?.details ?? [];
    details.forEach((d) => setError(d.field as keyof FormData, { message: d.message }));
    if (!details.length) toast.error(e?.message ?? 'Ocurrió un error inesperado.');
  }

  function onSubmit(data: FormData) {
    if (isNew) {
      crear.mutate({ ...data, activo: true }, {
        onSuccess: (c) => {
          toast.success('Contacto creado correctamente.');
          router.push(clientePre ? `/clientes/${clientePre}` : `/contactos/${c.id}`);
        },
        onError: handleError,
      });
    } else {
      editar.mutate({ id: id!, data }, {
        onSuccess: () => { toast.success('Cambios guardados correctamente.'); router.push(`/contactos/${id}`); },
        onError: handleError,
      });
    }
  }

  if (!isNew && loadingExisting) return <div className="flex justify-center p-12"><Spinner /></div>;

  const fullName = [watch('nombre'), watch('apellido')].filter(Boolean).join(' ') || 'Contacto';

  return (
    <div className="form-page">
      <PageHeader
        title={isNew ? 'Nuevo contacto' : `Editar — ${fullName}`}
        subtitle={isNew ? 'Registrá un contacto vinculado a un cliente.' : 'Modificá los datos del contacto.'}
        back
        onBack={() => router.back()}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <FormSection title="Datos del contacto">
          <div className="form-grid">
            <div className="field span-2">
              <label className="field__label">Cliente vinculado <span style={{ color: 'var(--danger)' }}>*</span></label>
              {clienteReadonly ? (
                <div style={{ padding: '10px 12px', background: 'var(--bg-sunken)', border: '1px solid var(--border)', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon name="building" size={16} color="var(--text-2)" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{clienteSeleccionado?.razonSocial ?? clienteSeleccionado?.nombre ?? clienteId}</div>
                    {clienteId && <div className="mono text-3 text-xs">{clienteId}</div>}
                  </div>
                  <span className="badge badge--neutral">Bloqueado</span>
                </div>
              ) : (
                <select className={`select ${errors.clienteId ? 'input--error' : ''}`} {...register('clienteId')}>
                  <option value="">— Seleccionar cliente —</option>
                  {clientesData?.data.map((cl) => (
                    <option key={cl.id} value={cl.id}>{cl.razonSocial ?? cl.nombre} · {cl.id}</option>
                  ))}
                </select>
              )}
              {errors.clienteId && <div className="field__error">{errors.clienteId.message}</div>}
              {!isNew && <div className="field__hint">El cliente vinculado no puede modificarse después de crear el contacto.</div>}
            </div>

            <div className="field">
              <label className="field__label">Nombre <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input className={`input ${errors.nombre ? 'input--error' : ''}`} {...register('nombre')} placeholder="Ej. María José" />
              {errors.nombre && <div className="field__error">{errors.nombre.message}</div>}
            </div>
            <div className="field">
              <label className="field__label">Apellido</label>
              <input className="input" {...register('apellido')} placeholder="Ej. Hernández Pérez" />
            </div>

            <div className="field span-2">
              <label className="field__label">Cargo</label>
              <input className="input" {...register('cargo')} placeholder="Ej. Gerente de Compras, Jefe de Bodega…" />
            </div>

            <div className="field span-2">
              <label className="field__label">Tipo de contacto</label>
              <select className="select" {...register('tipoContacto')} style={{ maxWidth: 320 }}>
                {TIPOS_CONTACTO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div className="field">
              <label className="field__label">Teléfono</label>
              <input className="input mono" {...register('telefono')} placeholder="7777-0000" />
            </div>
            <div className="field">
              <label className="field__label">Correo electrónico</label>
              <input className={`input ${errors.email ? 'input--error' : ''}`} type="email" {...register('email')} placeholder="contacto@empresa.sv" />
              {errors.email && <div className="field__error">{errors.email.message}</div>}
            </div>

            <div className="field span-2">
              <label className="field__label">Notas</label>
              <textarea className="textarea" {...register('notas')} placeholder="Información adicional para el equipo de ventas (opcional)." />
            </div>
          </div>
        </FormSection>

        <div className="form-footer flex-col sm:flex-row">
          <button type="button" className="btn btn--ghost w-full sm:w-auto" onClick={() => router.back()}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary w-full sm:w-auto" disabled={isPending}>
            {isPending ? <><Spinner /> Guardando…</> : <><Icon name="check" size={14} /> {isNew ? 'Crear contacto' : 'Guardar cambios'}</>}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Paso 10.2: Crear `app/(dashboard)/contactos/nuevo/page.tsx`**

```tsx
import { ContactoForm } from '@/components/contactos/ContactoForm';

export default function NuevoContactoPage() {
  return <ContactoForm />;
}
```

- [ ] **Paso 10.3: Crear `app/(dashboard)/contactos/[id]/editar/page.tsx`**

```tsx
import { ContactoForm } from '@/components/contactos/ContactoForm';

type Props = { params: Promise<{ id: string }> };

export default async function EditarContactoPage({ params }: Props) {
  const { id } = await params;
  return <ContactoForm id={id} />;
}
```

- [ ] **Paso 10.4: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Esperado: sin errores.

- [ ] **Paso 10.5: Commit**

```bash
git add components/contactos/ContactoForm.tsx app/\(dashboard\)/contactos/nuevo/page.tsx app/\(dashboard\)/contactos/\[id\]/editar/page.tsx
git commit -m "feat(contactos): agregar formulario de creación y edición de contactos"
```

---

## Task 11: Verificación de breakpoints y cierre de rama

- [ ] **Paso 11.1: Levantar el servidor de desarrollo**

```bash
pnpm dev
```

Abrir `http://localhost:3001`

- [ ] **Paso 11.2: Verificar en Chrome DevTools — Mobile (360px)**

DevTools → Toggle Device Toolbar → 360×800

**`/clientes` (lista):**
- [ ] PageHeader: botones en columna, cada uno `w-full`
- [ ] FilterBar: chips se envuelven (`flex-wrap`)
- [ ] Tabla: Tipo, Departamento, Teléfono, Cot. ocultos; visible Código, Cliente, Estado, Acciones
- [ ] Paginación: solo "Anterior" / "Siguiente"

**`/clientes/[id]` (detalle):**
- [ ] Columna única; columna derecha debajo de la izquierda
- [ ] `ContactosDeCliente`: solo Nombre y Tipo visibles

**`/clientes/nuevo` y `/clientes/[id]/editar`:**
- [ ] Campos en columna única, ancho completo
- [ ] Footer: botones apilados verticalmente

**`/contactos` (lista):**
- [ ] Código oculto; Cargo oculto
- [ ] FilterBar chips se envuelven

**`/contactos/[id]`:**
- [ ] Columna única
- [ ] `ConfirmRow` de desactivar: `flex-col`, botones `w-full`

- [ ] **Paso 11.3: Verificar en Chrome DevTools — Tablet (768px)**

Cambiar a 768×1024

- [ ] Tablas con todas las columnas visibles
- [ ] PageHeader: título y acciones en la misma fila
- [ ] Formularios: 2 columnas activas
- [ ] Detalle: sigue columna única (correcto para tablet)
- [ ] Footer formulario: botones en línea horizontal

- [ ] **Paso 11.4: Verificar en Chrome DevTools — Desktop (1280px)**

Cambiar a 1280×800

- [ ] Detalle: `lg:grid-cols-2` activo — 2 columnas lado a lado
- [ ] Paginación con números completos y elipsis
- [ ] Tablas con padding generoso

- [ ] **Paso 11.5: Verificación final de tipos**

```bash
pnpm tsc --noEmit
```

Esperado: sin errores.

- [ ] **Paso 11.6: Commit de cierre**

```bash
git add -A
git commit -m "feat(clientes): verificación de breakpoints completa — RAMA 4 lista para PR"
```

- [ ] **Paso 11.7: Abrir PR a main**

```bash
gh pr create \
  --title "feat: RAMA 4 — CRUD de Clientes y Contactos" \
  --body "$(cat <<'EOF'
## Summary
- 7 componentes UI compartidos: PageHeader, FilterBar, DataTable, Pagination, EmptyState, ConfirmRow, FormSection
- Módulo Clientes: lista, detalle, crear, editar con validación Zod y toasts
- Módulo Contactos: lista, detalle, crear, editar con validación Zod y toasts
- Breakpoints verificados en 360px, 768px y 1280px

## Test plan
- [ ] `/clientes` carga la lista desde el backend con filtros funcionales
- [ ] Crear cliente Empresa y Particular con validaciones correctas
- [ ] Editar un cliente; verificar toast de éxito y redirección
- [ ] Desactivar un cliente; verificar ConfirmRow y toast
- [ ] `/contactos` carga la lista; filtros por tipo y estado funcionan
- [ ] Crear contacto desde `/clientes/[id]` (clienteId pre-seleccionado y bloqueado)
- [ ] Verificar diseño en mobile (360px), tablet (768px) y desktop (1280px)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
