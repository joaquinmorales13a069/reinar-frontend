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
            pageSize={data.meta.limit}
            total={data.meta.total}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}
