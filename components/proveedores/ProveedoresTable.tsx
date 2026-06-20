'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FilterBar } from '@/components/ui/FilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { Icon } from '@/components/ui/Icon';
import { useProveedores } from '@/hooks/use-proveedores';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarProveedor } from '@/lib/proveedores';

type FiltroEstado = 'TODOS' | 'ACTIVO' | 'INACTIVO';

export function ProveedoresTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState<FiltroEstado>('TODOS');

  const rol = useAuthStore((s) => s.user?.rol);
  const puedeEditar = puedeEjecutarProveedor('editar', rol);

  const activo = estado === 'ACTIVO' ? true : estado === 'INACTIVO' ? false : undefined;

  const { data, isLoading, isError } = useProveedores({
    page,
    limit: 20,
    search: search.trim() || undefined,
    activo,
  });

  function onChangeEstado(next: FiltroEstado) {
    setEstado(next);
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
        placeholder="Buscar por nombre, NRC o NIT…"
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
          title="Error al cargar proveedores"
          message="Intenta refrescar la página."
        />
      )}

      {!isLoading && !isError && data && data.data.length === 0 && (
        <EmptyState
          icon="building"
          title="Sin proveedores"
          message="No se encontraron proveedores con los filtros aplicados."
        />
      )}

      {!isLoading && !isError && data && data.data.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl text-sm">
              <thead className="bg-bg-sunken text-2xs uppercase tracking-wider text-tx-3">
                <tr>
                  <th className="text-left px-4 py-2 font-medium w-12">#</th>
                  <th className="text-left px-4 py-2 font-medium">Nombre</th>
                  <th className="text-left px-4 py-2 font-medium w-28">NRC</th>
                  <th className="text-left px-4 py-2 font-medium w-28">NIT</th>
                  <th className="text-left px-4 py-2 font-medium">Contacto</th>
                  <th className="text-left px-4 py-2 font-medium w-36">Teléfono</th>
                  <th className="text-left px-4 py-2 font-medium w-28">Estado</th>
                  <th className="text-right px-4 py-2 font-medium w-24">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((p, i) => {
                  const numero = (data.meta.page - 1) * data.meta.limit + i + 1;
                  return (
                    <tr
                      key={p.id}
                      className="border-t border-bd hover:bg-bg-sunken transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-tx-3">{numero}</td>
                      <td className="px-4 py-3">
                        <Link href={`/proveedores/${p.id}`} className="hover:underline font-medium">
                          {p.nombre}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-tx-2">{p.nrc ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-tx-2">{p.nit ?? '—'}</td>
                      <td className="px-4 py-3 text-tx-2">{p.contacto ?? '—'}</td>
                      <td className="px-4 py-3 text-tx-2 text-xs">{p.telefono ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge
                          status={p.activo ? 'ACTIVO' : 'INACTIVO'}
                          kind={p.activo ? 'ok' : 'neutral'}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <Link
                            href={`/proveedores/${p.id}`}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-tx-3 hover:bg-bg hover:text-tx transition-colors"
                            aria-label="Ver"
                          >
                            <Icon name="eye" size={14} />
                          </Link>
                          {puedeEditar && (
                            <Link
                              href={`/proveedores/${p.id}/editar`}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-tx-3 hover:bg-bg hover:text-tx transition-colors"
                              aria-label="Editar"
                            >
                              <Icon name="edit" size={14} />
                            </Link>
                          )}
                        </div>
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
