# Dashboard (RAMA 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the ERP home page with role-filtered KPI cards, a fleet utilization chart, an activity feed, and a top-clients table, all wired to `GET /api/v1/dashboard/kpis`.

**Architecture:** `page.tsx` is a single `'use client'` component that calls `useDashboardKpis()` and reads `user.rol` from the Zustand auth store. It passes data and role as props to presentational child components in `components/dashboard/`. Role-based visibility is resolved declaratively in each component with explicit comparisons; no role logic leaks into child components.

**Tech Stack:** Next.js 15 App Router, React Query v5, Recharts v3, date-fns v4, decimal.js v10, Tailwind CSS v4

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `types/dashboard.ts` | TypeScript type for the `/dashboard/kpis` response |
| Create | `hooks/use-dashboard.ts` | React Query hook, query key, staleTime |
| Create | `components/dashboard/KpiCard.tsx` | Single KPI card with value, subvalue, icon, delta dir |
| Create | `components/dashboard/KpiGrid.tsx` | Grid of KPI cards with role-based filtering |
| Create | `components/dashboard/RevenueWidget.tsx` | "Ingresos del mes" — prominent number, no chart |
| Create | `components/dashboard/FleetWidget.tsx` | Fleet utilization horizontal bar chart (Recharts) |
| Create | `components/dashboard/ActivityFeed.tsx` | Last 10 audit log events with relative timestamps |
| Create | `components/dashboard/TopClientes.tsx` | Top 5 clients table by billed amount |
| Modify | `app/(dashboard)/dashboard/page.tsx` | Orchestrates all widgets, handles loading/error states |

---

## Tasks

### Task 1: DashboardKpis type

**Files:**
- Create: `types/dashboard.ts`

- [ ] **Step 1: Create the type file**

```typescript
// types/dashboard.ts
export type DashboardKpis = {
  rentasActivas: number;
  maquinariaEnMantenimiento: {
    equipos: number;
    herramientas: number;
    total: number;
  };
  totalClientes: number;
  cotizacionesPendientes: number;
  facturasPorCobrar: {
    count: number;
    total: string; // Decimal serializado — usar formatCurrency(), nunca parseFloat()
  };
  facturasVencidas: number;
  ingresosMes: string; // Decimal serializado
  utilizacionEquipos: {
    disponibles: number;
    rentados: number;
    mantenimiento: number;
    inactivos: number;
    total: number;
  };
  serviciosEstaSemana: number;
  topClientesPorIngresos: {
    clienteId: string;
    nombre: string;
    total: string; // Decimal serializado
  }[];
  actividadReciente: {
    entidad: string;
    entidadId: string;
    accion: string;
    usuario: string | null;
    createdAt: string; // ISO-8601
  }[];
  actasPendientesEntrega: number;
  dtesPendientes: number;
};
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add types/dashboard.ts
git commit -m "feat(dashboard): add DashboardKpis type"
```

---

### Task 2: React Query hook

**Files:**
- Create: `hooks/use-dashboard.ts`

- [ ] **Step 1: Crear el hook**

```typescript
// hooks/use-dashboard.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiResponse } from '@/types/api';
import type { DashboardKpis } from '@/types/dashboard';

export const DASHBOARD_KEY = ['dashboard', 'kpis'] as const;

export function useDashboardKpis() {
  return useQuery<DashboardKpis>({
    queryKey: DASHBOARD_KEY,
    queryFn: () =>
      api
        .get<ApiResponse<DashboardKpis>>('/dashboard/kpis')
        .then((r) => {
          const res = r.data;
          if (!res.success) throw new Error(res.error.message);
          return res.data;
        }),
    // El dashboard no necesita frescura alta; 2 minutos reduce carga al servidor
    staleTime: 2 * 60 * 1000,
  });
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-dashboard.ts
git commit -m "feat(dashboard): add useDashboardKpis hook"
```

---

### Task 3: KpiCard component

**Files:**
- Create: `components/dashboard/KpiCard.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// components/dashboard/KpiCard.tsx
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';

export type KpiDir = 'up' | 'down' | 'flat';

export type KpiCardProps = {
  label: string;
  value: string;
  subvalue?: string;
  icon: IconName;
  dir?: KpiDir;
};

const DIR_STYLES: Record<KpiDir, { color: string; icon: IconName; rotate?: string }> = {
  up:   { color: 'text-ok',     icon: 'arrowUpRight' },
  // arrowUpRight rotado 90° CW da la diagonal ↘ para valores negativos
  down: { color: 'text-danger', icon: 'arrowUpRight', rotate: 'rotate-90' },
  flat: { color: 'text-tx-3',   icon: 'arrowRight' },
};

export function KpiCard({ label, value, subvalue, icon, dir = 'flat' }: KpiCardProps) {
  const style = DIR_STYLES[dir];
  return (
    <div className="rounded-lg bg-surface border border-bd p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-tx-2 font-medium uppercase tracking-wide">{label}</span>
        <span className="text-tx-3">
          <Icon name={icon} size={14} />
        </span>
      </div>
      <div className="text-2xl font-semibold text-tx leading-none">{value}</div>
      {subvalue && (
        <div className={`flex items-center gap-1 text-xs ${style.color}`}>
          <Icon name={style.icon} size={11} className={style.rotate ?? ''} />
          <span>{subvalue}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/KpiCard.tsx
git commit -m "feat(dashboard): add KpiCard component"
```

---

### Task 4: KpiGrid component

**Files:**
- Create: `components/dashboard/KpiGrid.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// components/dashboard/KpiGrid.tsx
import { KpiCard } from './KpiCard';
import type { KpiCardProps, KpiDir } from './KpiCard';
import { formatCurrency } from '@/lib/utils';
import type { DashboardKpis } from '@/types/dashboard';
import type { User } from '@/types/api';

type KpiId =
  | 'rentas' | 'cotPend' | 'ingresos' | 'porCobrar'
  | 'vencidas' | 'mantto' | 'actas' | 'servicios';

type Rol = User['rol'];

// Mapa declarativo de visibilidad por rol.
// LOGISTICA ve solo inventario/operaciones físicas; OPERADOR no ve métricas de inventario.
const KPI_POR_ROL: Record<Rol, KpiId[]> = {
  ADMIN:        ['rentas', 'cotPend', 'ingresos', 'porCobrar', 'vencidas', 'mantto', 'actas', 'servicios'],
  GERENTE:      ['rentas', 'cotPend', 'ingresos', 'porCobrar', 'vencidas', 'mantto', 'actas', 'servicios'],
  OPERADOR:     ['rentas', 'cotPend', 'ingresos', 'porCobrar', 'vencidas', 'actas', 'servicios'],
  LOGISTICA:    ['mantto', 'actas'],
  VISUALIZADOR: ['rentas', 'cotPend', 'ingresos', 'porCobrar', 'vencidas', 'mantto', 'actas', 'servicios'],
};

function buildAllKpis(data: DashboardKpis): Array<KpiCardProps & { id: KpiId }> {
  return [
    {
      id: 'rentas',
      label: 'Rentas activas',
      value: String(data.rentasActivas),
      icon: 'package',
      dir: 'flat',
    },
    {
      id: 'cotPend',
      label: 'Cotizaciones pend.',
      value: String(data.cotizacionesPendientes),
      icon: 'fileText',
      dir: (data.cotizacionesPendientes > 0 ? 'up' : 'flat') as KpiDir,
    },
    {
      id: 'ingresos',
      label: 'Ingresos del mes',
      value: formatCurrency(data.ingresosMes),
      icon: 'chartBar',
      dir: 'up',
    },
    {
      id: 'porCobrar',
      label: 'Por cobrar',
      value: formatCurrency(data.facturasPorCobrar.total),
      subvalue: `${data.facturasPorCobrar.count} facturas`,
      icon: 'dollar',
      dir: (data.facturasPorCobrar.count > 0 ? 'up' : 'flat') as KpiDir,
    },
    {
      id: 'vencidas',
      label: 'Facturas vencidas',
      value: String(data.facturasVencidas),
      icon: 'alertTriangle',
      dir: (data.facturasVencidas > 0 ? 'down' : 'flat') as KpiDir,
    },
    {
      id: 'mantto',
      label: 'En mantenimiento',
      value: String(data.maquinariaEnMantenimiento.total),
      subvalue: `${data.maquinariaEnMantenimiento.equipos} eq. · ${data.maquinariaEnMantenimiento.herramientas} herr.`,
      icon: 'wrench',
      dir: 'flat',
    },
    {
      id: 'actas',
      label: 'Actas pendientes',
      value: String(data.actasPendientesEntrega),
      icon: 'clipboard',
      dir: (data.actasPendientesEntrega > 0 ? 'down' : 'flat') as KpiDir,
    },
    {
      id: 'servicios',
      label: 'Servicios esta sem.',
      value: String(data.serviciosEstaSemana),
      icon: 'tool',
      dir: 'flat',
    },
  ];
}

type KpiGridProps = {
  data: DashboardKpis;
  rol: Rol;
};

export function KpiGrid({ data, rol }: KpiGridProps) {
  const visibles = KPI_POR_ROL[rol] ?? KPI_POR_ROL.VISUALIZADOR;
  const kpis = buildAllKpis(data).filter((k) => visibles.includes(k.id));

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {kpis.map(({ id, ...props }) => (
        <KpiCard key={id} {...props} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/KpiGrid.tsx
git commit -m "feat(dashboard): add KpiGrid with role-based filtering"
```

---

### Task 5: RevenueWidget component

**Files:**
- Create: `components/dashboard/RevenueWidget.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// components/dashboard/RevenueWidget.tsx
import { formatCurrency } from '@/lib/utils';

type RevenueWidgetProps = {
  ingresosMes: string;
};

export function RevenueWidget({ ingresosMes }: RevenueWidgetProps) {
  return (
    <div className="rounded-lg bg-surface border border-bd p-5 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-medium text-tx">Ingresos del mes en curso</h3>
        <p className="text-xs text-tx-3 mt-0.5">Total cobrado en pagos del mes actual</p>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-display font-bold text-tx leading-none">
          {formatCurrency(ingresosMes)}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/RevenueWidget.tsx
git commit -m "feat(dashboard): add RevenueWidget"
```

---

### Task 6: FleetWidget component

**Files:**
- Create: `components/dashboard/FleetWidget.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// components/dashboard/FleetWidget.tsx
'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from 'recharts';
import type { DashboardKpis } from '@/types/dashboard';

type FleetWidgetProps = {
  utilizacionEquipos: DashboardKpis['utilizacionEquipos'];
};

// Colores en hex directo porque Recharts no interpreta CSS vars en atributos SVG fill
const ESTADOS = [
  { key: 'disponibles',  label: 'Disponibles',   color: '#2E8C5A' },
  { key: 'rentados',     label: 'Rentados',       color: '#F2C037' },
  { key: 'mantenimiento', label: 'Mantenimiento', color: '#E08A1A' },
  { key: 'inactivos',    label: 'Inactivos',      color: '#6B7B8E' },
] as const;

export function FleetWidget({ utilizacionEquipos }: FleetWidgetProps) {
  const chartData = ESTADOS.map((e) => ({
    estado: e.label,
    cantidad: utilizacionEquipos[e.key],
    color: e.color,
  }));

  return (
    <div className="rounded-lg bg-surface border border-bd p-5 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-medium text-tx">Utilización de flota</h3>
        <p className="text-xs text-tx-3 mt-0.5">
          Estado actual · {utilizacionEquipos.total} equipos en total
        </p>
      </div>
      <ResponsiveContainer width="100%" height={148}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
        >
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#6B7B8E' }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="estado"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#44546A' }}
            width={96}
          />
          <Tooltip
            cursor={{ fill: 'rgba(10,26,42,0.04)' }}
            contentStyle={{
              background: '#FFFFFF',
              border: '1px solid rgba(10,26,42,0.10)',
              borderRadius: 6,
              fontSize: 12,
            }}
            formatter={(value: number) => [`${value} equipos`, 'Cantidad']}
          />
          <Bar dataKey="cantidad" radius={4}>
            {chartData.map((entry) => (
              <Cell key={entry.estado} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Resultado esperado: sin errores. Si TypeScript se queja del prop `radius` de `<Bar>`, cámbialo a `radius={[0, 4, 4, 0]}` (array de 4 números para los 4 radios de las esquinas).

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/FleetWidget.tsx
git commit -m "feat(dashboard): add FleetWidget with Recharts horizontal bar chart"
```

---

### Task 7: ActivityFeed component

**Files:**
- Create: `components/dashboard/ActivityFeed.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// components/dashboard/ActivityFeed.tsx
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import type { DashboardKpis } from '@/types/dashboard';

type ActivityFeedProps = {
  actividad: DashboardKpis['actividadReciente'];
  onRefresh: () => void;
};

const ENTITY_ICON: Record<string, IconName> = {
  Cotizacion:  'fileText',
  Factura:     'receipt',
  Pago:        'dollar',
  ActaEntrega: 'clipboard',
  Cliente:     'user',
};

const ACCION_LABEL: Record<string, string> = {
  CREATE: 'creó',
  UPDATE: 'actualizó',
  DELETE: 'eliminó',
};

export function ActivityFeed({ actividad, onRefresh }: ActivityFeedProps) {
  return (
    <div className="rounded-lg bg-surface border border-bd flex flex-col">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-bd">
        <div>
          <h3 className="text-sm font-medium text-tx">Actividad reciente</h3>
          <p className="text-xs text-tx-3 mt-0.5">Últimas 24 horas en el sistema</p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 text-xs text-tx-2 hover:text-tx transition-colors px-2 py-1 rounded hover:bg-bg-sunken"
        >
          <Icon name="refresh" size={12} />
          Actualizar
        </button>
      </div>

      <div className="divide-y divide-bd">
        {actividad.length === 0 && (
          <p className="text-sm text-tx-3 text-center py-8">Sin actividad reciente.</p>
        )}
        {actividad.map((item, i) => {
          const iconName: IconName = ENTITY_ICON[item.entidad] ?? 'info';
          const accion = ACCION_LABEL[item.accion] ?? item.accion.toLowerCase();
          const tiempo = formatDistanceToNow(parseISO(item.createdAt), {
            locale: es,
            addSuffix: true,
          });
          return (
            <div key={i} className="flex gap-3 px-5 py-3">
              <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-full bg-bg-sunken flex items-center justify-center text-tx-3">
                <Icon name={iconName} size={13} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-tx leading-snug">
                  <span className="font-medium">{item.usuario ?? 'Sistema'}</span>{' '}
                  {accion}{' '}
                  <span className="font-mono text-xs text-tx-2">
                    {item.entidad.toLowerCase()} {item.entidadId.slice(0, 8)}
                  </span>
                </p>
                <p className="text-xs text-tx-3 mt-0.5">{tiempo}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/ActivityFeed.tsx
git commit -m "feat(dashboard): add ActivityFeed component"
```

---

### Task 8: TopClientes component

**Files:**
- Create: `components/dashboard/TopClientes.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// components/dashboard/TopClientes.tsx
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import type { DashboardKpis } from '@/types/dashboard';

type TopClientesProps = {
  clientes: DashboardKpis['topClientesPorIngresos'];
};

export function TopClientes({ clientes }: TopClientesProps) {
  return (
    <div className="rounded-lg bg-surface border border-bd flex flex-col">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-bd">
        <div>
          <h3 className="text-sm font-medium text-tx">Top clientes</h3>
          <p className="text-xs text-tx-3 mt-0.5">Por monto facturado · últimos 12 meses</p>
        </div>
        <Link
          href="/clientes"
          className="text-xs text-accent hover:text-accent-dim transition-colors"
        >
          Ver todos →
        </Link>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-bd">
            <th className="text-left text-xs text-tx-3 font-medium py-2.5 pl-5 w-8">#</th>
            <th className="text-left text-xs text-tx-3 font-medium py-2.5">Cliente</th>
            <th className="text-right text-xs text-tx-3 font-medium py-2.5 pr-5">Facturado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-bd">
          {clientes.length === 0 && (
            <tr>
              <td colSpan={3} className="text-center text-tx-3 py-8 text-sm">
                Sin datos disponibles.
              </td>
            </tr>
          )}
          {clientes.map((c, i) => (
            <tr key={c.clienteId} className="hover:bg-row-hover transition-colors">
              <td className="pl-5 py-3">
                <span className="font-mono text-xs text-tx-3">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </td>
              <td className="py-3 pr-4">
                <Link
                  href={`/clientes/${c.clienteId}`}
                  className="font-medium text-tx hover:text-accent transition-colors truncate block max-w-[180px]"
                >
                  {c.nombre}
                </Link>
              </td>
              <td className="text-right pr-5 py-3 font-mono text-xs text-tx">
                {formatCurrency(c.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/TopClientes.tsx
git commit -m "feat(dashboard): add TopClientes component"
```

---

### Task 9: Dashboard page

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx` (reemplaza el placeholder)

- [ ] **Step 1: Reemplazar el contenido del archivo con la página completa**

```tsx
// app/(dashboard)/dashboard/page.tsx
'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { useDashboardKpis } from '@/hooks/use-dashboard';
import { useAuthStore } from '@/stores/auth.store';
import { Icon } from '@/components/ui/Icon';
import { KpiGrid } from '@/components/dashboard/KpiGrid';
import { RevenueWidget } from '@/components/dashboard/RevenueWidget';
import { FleetWidget } from '@/components/dashboard/FleetWidget';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { TopClientes } from '@/components/dashboard/TopClientes';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboardKpis();
  const user = useAuthStore((s) => s.user);
  const rol = user?.rol ?? 'VISUALIZADOR';

  const fecha = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
  const fechaStr = fecha.charAt(0).toUpperCase() + fecha.slice(1);

  // Visibilidad de secciones por rol (ver spec 2026-05-21-dashboard-design.md)
  const showIngresos = rol !== 'LOGISTICA';
  const showFlota    = rol !== 'OPERADOR';
  const showClientes = rol !== 'LOGISTICA';
  const showCta      = rol !== 'LOGISTICA' && rol !== 'VISUALIZADOR';

  return (
    <div className="p-5 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-title font-semibold tracking-tight text-tx">
            {getGreeting()}, {user?.nombre ?? '—'}
          </h1>
          <p className="text-sm text-tx-2 mt-1">
            Resumen de operaciones · {fechaStr}
          </p>
        </div>
        {showCta && (
          <Link
            href="/cotizaciones/nueva"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors shrink-0"
          >
            <Icon name="plus" size={14} />
            Nueva cotización
          </Link>
        )}
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-bg-sunken" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-44 rounded-lg bg-bg-sunken" />
            <div className="h-44 rounded-lg bg-bg-sunken" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-64 rounded-lg bg-bg-sunken" />
            <div className="h-64 rounded-lg bg-bg-sunken" />
          </div>
        </div>
      )}

      {/* Error banner */}
      {isError && !isLoading && (
        <div
          className="rounded-lg border border-bd p-4 flex items-center justify-between"
          style={{ background: 'rgba(194,59,59,0.07)' }}
        >
          <div className="flex items-center gap-3 text-sm text-danger">
            <Icon name="alertTriangle" size={16} />
            No se pudo cargar el resumen. Intenta de nuevo.
          </div>
          <button
            onClick={() => refetch()}
            className="text-sm font-medium text-danger hover:underline"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Contenido */}
      {data && !isLoading && (
        <>
          <KpiGrid data={data} rol={rol} />

          {(showIngresos || showFlota) && (
            <div
              className={`grid gap-4 mb-4 ${
                showIngresos && showFlota ? 'md:grid-cols-2' : 'grid-cols-1'
              }`}
            >
              {showIngresos && <RevenueWidget ingresosMes={data.ingresosMes} />}
              {showFlota    && <FleetWidget utilizacionEquipos={data.utilizacionEquipos} />}
            </div>
          )}

          <div
            className={`grid gap-4 ${showClientes ? 'md:grid-cols-2' : 'grid-cols-1'}`}
          >
            <ActivityFeed actividad={data.actividadReciente} onRefresh={() => refetch()} />
            {showClientes && <TopClientes clientes={data.topClientesPorIngresos} />}
          </div>
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

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/page.tsx"
git commit -m "feat(dashboard): implement dashboard page with KPIs, charts and activity"
```

---

### Task 10: Verificación visual y commit final

**Files:** ninguno — solo verificación en navegador.

- [ ] **Step 1: Iniciar el servidor de desarrollo**

```bash
pnpm dev
```

Resultado esperado: servidor en http://localhost:3001 sin errores en consola.

- [ ] **Step 2: Verificar golden path (rol ADMIN)**

Abrir http://localhost:3001/dashboard y confirmar:
1. Aparece el skeleton de loading (gris) mientras carga
2. Se renderizan 8 KPI cards en un grid de 2×4
3. Se ven ambos widgets: RevenueWidget (número grande) + FleetWidget (barras horizontales)
4. ActivityFeed muestra los últimos eventos con tiempo relativo en español ("hace X horas")
5. TopClientes muestra la tabla con 5 filas y montos formateados
6. El greeting cambia según la hora del día

- [ ] **Step 3: Verificar filtrado por rol (si es posible con otro usuario)**

Confirmar con un usuario LOGISTICA que solo ve: KPI cards `mantto` y `actas`, el FleetWidget, y el ActivityFeed (sin RevenueWidget ni TopClientes ni botón "Nueva cotización").

- [ ] **Step 4: Verificar estado de error**

Detener el backend (`Ctrl+C`), refrescar el dashboard → debe aparecer el banner de error con botón "Reintentar". Reiniciar el backend → hacer clic en "Reintentar" → los datos se cargan correctamente.

- [ ] **Step 5: Verificar dark mode**

Activar dark mode desde el TweaksPanel del sidebar → los colores deben invertirse correctamente (fondo oscuro, textos claros) sin elementos con colores hardcodeados visibles.

- [ ] **Step 6: Verificar tipos finales**

```bash
pnpm tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 7: Commit final**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(dashboard): complete RAMA 3 — dashboard with KPIs and widgets

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```
