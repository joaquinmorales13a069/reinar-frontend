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
    // El backend filtra de forma mutuamente exclusiva: `activo: true` muestra
    // activos, `activo: false` muestra solo inactivos. No hay modo "ambos",
    // así que el checkbox conmuta entre las dos vistas.
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
          icon="box"
          title="Sin consumibles"
          message="No se encontraron consumibles con los filtros aplicados."
        />
      ) : (
        // overflow-x-auto + min-w-3xl: en pantallas < 768px (md y abajo) la
        // tabla excede el contenedor y aparece scroll horizontal en lugar de
        // aplastar las celdas y romper el layout.
        <div className="overflow-x-auto">
        <table className="w-full min-w-3xl text-sm">
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
        </div>
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
