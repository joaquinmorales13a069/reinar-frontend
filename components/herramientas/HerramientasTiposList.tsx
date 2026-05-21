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
    // El backend filtra de forma mutuamente exclusiva: `activo: true` muestra
    // activos, `activo: false` muestra solo inactivos. No hay modo "ambos",
    // así que el checkbox conmuta entre las dos vistas.
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
            Mostrar solo inactivos
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
              const totalUnidades = t.totalUnidades ?? 0;
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
