'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { Pagination } from '@/components/ui/Pagination';
import { Spinner } from '@/components/ui/Spinner';
import { Icon } from '@/components/ui/Icon';
import { useEquipos } from '@/hooks/use-equipos';
import { useEquiposRealtime } from '@/hooks/use-equipos-realtime';
import { useAuthStore } from '@/stores/auth.store';
import { useUiStore } from '@/stores/ui.store';
import { CATEGORIA_LABELS, puedeEjecutar } from '@/lib/equipos';
import { EquipoTabla } from '@/components/equipos/EquipoTabla';
import { EquipoGrilla } from '@/components/equipos/EquipoGrilla';
import type { CategoriaEquipo, EstadoEquipo } from '@/types/api';

const btnSec = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';
const btnPri = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors';

const PAGE_SIZE = 10;

// Hook local con debounce para que cada tecleo no dispare una request;
// 300ms es el balance habitual entre responsividad y reducción de carga.
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

const ESTADOS_FILTRABLES: { label: string; value: EstadoEquipo }[] = [
  { label: 'Disponibles', value: 'DISPONIBLE' },
  { label: 'Rentados', value: 'RENTADO' },
  { label: 'Mantenim.', value: 'MANTENIMIENTO' },
  { label: 'Uso interno', value: 'USO_INTERNO' },
];

export function EquiposList() {
  useEquiposRealtime();

  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');
  const view = useUiStore((s) => s.tweaks.equiposView);
  const setTweak = useUiStore((s) => s.setTweak);

  const [busqueda, setBusqueda] = useState('');
  const search = useDebounced(busqueda.trim(), 300);

  const [filterCat, setFilterCat] = useState<CategoriaEquipo | null>(null);
  const [filterEstado, setFilterEstado] = useState<EstadoEquipo | null>(null);
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useEquipos({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    categoria: filterCat ?? undefined,
    estado: filterEstado ?? undefined,
    incluirInactivos: incluirInactivos || undefined,
  });

  const puedeVerInactivos = puedeEjecutar('verInactivos', rol);
  const puedeCrear = puedeEjecutar('crear', rol);

  function toggleCat(c: CategoriaEquipo) {
    setFilterCat((prev) => (prev === c ? null : c));
    setPage(1);
  }
  function toggleEstado(e: EstadoEquipo) {
    setFilterEstado((prev) => (prev === e ? null : e));
    setPage(1);
  }
  function clearAll() {
    setBusqueda('');
    setFilterCat(null);
    setFilterEstado(null);
    setIncluirInactivos(false);
    setPage(1);
  }

  return (
    <div>
      <PageHeader
        title="Equipos"
        subtitle={`${data?.meta.total ?? '—'} unidades · ${Object.keys(CATEGORIA_LABELS).length} categorías`}
        actions={
          <>
            <div className="inline-flex rounded-md border border-bd overflow-hidden">
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs ${
                  view === 'tabla' ? 'bg-accent text-navy font-semibold' : 'bg-surface text-tx-2 hover:bg-bg-sunken'
                }`}
                onClick={() => setTweak('equiposView', 'tabla')}
              >
                <Icon name="list" size={12} /> Tabla
              </button>
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs border-l border-bd ${
                  view === 'grilla' ? 'bg-accent text-navy font-semibold' : 'bg-surface text-tx-2 hover:bg-bg-sunken'
                }`}
                onClick={() => setTweak('equiposView', 'grilla')}
              >
                <Icon name="grid" size={12} /> Grilla
              </button>
            </div>
            <button type="button" className={btnSec}>
              <Icon name="download" size={14} /> Exportar
            </button>
            {puedeCrear && (
              <Link href="/equipos/nuevo" className={btnPri}>
                <Icon name="plus" size={14} /> Nuevo equipo
              </Link>
            )}
          </>
        }
      />

      <div className="rounded-lg border border-bd bg-surface overflow-hidden">
        <FilterBar
          search={busqueda}
          onSearch={(v) => { setBusqueda(v); setPage(1); }}
          placeholder="Buscar por nombre, código, marca, modelo…"
          chips={[
            ...Object.entries(CATEGORIA_LABELS).map(([k, label]) => ({
              label,
              active: filterCat === k,
              onToggle: () => toggleCat(k as CategoriaEquipo),
            })),
            ...ESTADOS_FILTRABLES.map(({ label, value }) => ({
              label,
              active: filterEstado === value,
              onToggle: () => toggleEstado(value),
            })),
          ]}
          onClear={clearAll}
        />

        {puedeVerInactivos && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-bd bg-bg-sunken text-xs">
            <input
              id="incluir-inactivos"
              type="checkbox"
              className="accent-accent"
              checked={incluirInactivos}
              onChange={(e) => { setIncluirInactivos(e.target.checked); setPage(1); }}
            />
            <label htmlFor="incluir-inactivos" className="text-tx-2 cursor-pointer">
              Incluir equipos inactivos en la lista
            </label>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center p-12"><Spinner /></div>
        ) : view === 'tabla' ? (
          <EquipoTabla
            equipos={data?.data ?? []}
            rol={rol}
            pageOffset={(page - 1) * PAGE_SIZE}
          />
        ) : (
          <EquipoGrilla equipos={data?.data ?? []} />
        )}

        <Pagination page={page} pageSize={PAGE_SIZE} total={data?.meta.total ?? 0} onPage={setPage} />
      </div>
    </div>
  );
}
