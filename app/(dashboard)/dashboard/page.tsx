// app/(dashboard)/dashboard/page.tsx
'use client';

import { useState } from 'react';
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

  // Inicialización lazy con función para evitar el anti-patrón setState-en-effect.
  // useState(() => ...) se ejecuta solo en cliente, evitando mismatch de hidratación.
  const [greeting] = useState(getGreeting);
  const [fechaStr] = useState(() => {
    const f = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
    return f.charAt(0).toUpperCase() + f.slice(1);
  });

  // Visibilidad de secciones por rol (ver spec 2026-05-21-dashboard-design.md)
  const showIngresos = rol !== 'LOGISTICA';
  const showFlota    = rol !== 'OPERADOR';
  const showClientes = rol !== 'LOGISTICA';
  const showCta      = rol !== 'LOGISTICA' && rol !== 'VISUALIZADOR';

  return (
    <div className="max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-title font-semibold tracking-tight text-tx">
            {greeting}, {user?.nombre ?? '—'}
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

      {/* Mostrar banner de error incluso cuando hay datos cacheados — el dashboard puede
          mostrar info desactualizada junto a la advertencia, que es mejor que ocultar todo. */}
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
            type="button"
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
