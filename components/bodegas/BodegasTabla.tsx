'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FilterBar } from '@/components/ui/FilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { useBodegas } from '@/hooks/use-bodegas';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarBodega } from '@/lib/bodegas';

type FiltroEstado = 'TODAS' | 'ACTIVAS' | 'INACTIVAS';

export function BodegasTabla() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState<FiltroEstado>('TODAS');
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeEditar = puedeEjecutarBodega('editar', rol);

  const { data, isLoading, isError } = useBodegas();

  // Filtrado client-side porque GET /bodegas no acepta query params.
  // Asumimos volúmenes bajos (decenas de bodegas) — ver decisión D6 del spec.
  // El filtro aplica solo al nivel principal: si una principal pasa, todas
  // sus zonas se muestran (sean activas o inactivas).
  const filtradas = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.filter((b) => {
      if (q && !b.nombre.toLowerCase().includes(q)) return false;
      if (estado === 'ACTIVAS' && !b.activa) return false;
      if (estado === 'INACTIVAS' && b.activa) return false;
      return true;
    });
  }, [data, search, estado]);

  return (
    <div className="rounded-lg border border-bd bg-surface overflow-hidden">
      <FilterBar
        search={search}
        onSearch={setSearch}
        placeholder="Buscar por nombre…"
        chips={[
          {
            label: 'Activas',
            active: estado === 'ACTIVAS',
            onToggle: () => setEstado(estado === 'ACTIVAS' ? 'TODAS' : 'ACTIVAS'),
          },
          {
            label: 'Inactivas',
            active: estado === 'INACTIVAS',
            onToggle: () => setEstado(estado === 'INACTIVAS' ? 'TODAS' : 'INACTIVAS'),
          },
        ]}
        onClear={() => {
          setSearch('');
          setEstado('TODAS');
        }}
      />

      {isLoading && (
        <div className="flex justify-center py-12"><Spinner /></div>
      )}

      {isError && (
        <EmptyState
          icon="alertTriangle"
          title="Error al cargar bodegas"
          message="Intenta refrescar la página."
        />
      )}

      {!isLoading && !isError && data && filtradas.length === 0 && (
        <EmptyState
          icon="warehouse"
          title="Sin bodegas"
          message="No se encontraron bodegas con los filtros aplicados."
        />
      )}

      {!isLoading && !isError && data && filtradas.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-3xl text-sm">
            <thead className="bg-bg-sunken text-2xs uppercase tracking-wider text-tx-3">
              <tr>
                <th className="text-left px-4 py-2 font-medium w-12">#</th>
                <th className="text-left px-4 py-2 font-medium">Bodega</th>
                <th className="text-left px-4 py-2 font-medium w-28">Tipo</th>
                <th className="text-left px-4 py-2 font-medium">Descripción</th>
                <th className="text-left px-4 py-2 font-medium w-36">Ciudad</th>
                <th className="text-right px-4 py-2 font-medium w-20">Zonas</th>
                <th className="text-left px-4 py-2 font-medium w-28">Estado</th>
                <th className="text-right px-4 py-2 font-medium w-24">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((b, i) => {
                const numero = i + 1;
                const zonas = b.zonas ?? [];
                return (
                  <Fragment key={b.id}>
                    <tr
                      className="border-t border-bd hover:bg-bg-sunken transition-colors cursor-pointer"
                      onClick={() => router.push(`/bodegas/${b.id}`)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-tx-3">{numero}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Icon name="warehouse" size={14} className="text-tx-3 shrink-0" />
                          <div className="font-medium">{b.nombre}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {b.tipo === 'PROYECTO' ? (
                          <Badge status="PROYECTO" kind="accent" />
                        ) : b.tipo === 'ZONA' ? (
                          <Badge status="ZONA" kind="neutral" />
                        ) : (
                          // Fallback: si tipo no viene (datos sin migrar), inferir
                          // por parentId igual que antes.
                          <Badge status="PRINCIPAL" kind="info" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-tx-2">
                        {b.descripcion ? (
                          <span className="line-clamp-2">{b.descripcion}</span>
                        ) : (
                          <span className="text-tx-3">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-tx-2">{b.ciudad || '—'}</td>
                      <td className="px-4 py-3 text-right font-mono">{b._count?.zonas ?? zonas.length}</td>
                      <td className="px-4 py-3">
                        <Badge
                          status={b.activa ? 'ACTIVA' : 'INACTIVA'}
                          kind={b.activa ? 'ok' : 'neutral'}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div
                          className="inline-flex gap-1"
                          // stopPropagation evita que el click en los íconos también
                          // dispare el row click que navega al detalle.
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link
                            href={`/bodegas/${b.id}`}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-tx-3 hover:bg-bg hover:text-tx transition-colors"
                            aria-label="Ver"
                          >
                            <Icon name="eye" size={14} />
                          </Link>
                          {puedeEditar && (
                            <Link
                              href={`/bodegas/${b.id}/editar`}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-tx-3 hover:bg-bg hover:text-tx transition-colors"
                              aria-label="Editar"
                            >
                              <Icon name="edit" size={14} />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>

                    {zonas.map((z) => (
                      <tr
                        key={z.id}
                        // Fondo más hundido para reforzar visualmente la jerarquía:
                        // las zonas se leen como "hijas" de la fila principal previa.
                        className="border-t border-bd bg-bg-sunken/40 hover:bg-bg-sunken transition-colors cursor-pointer"
                        onClick={() =>
                          puedeEditar
                            ? router.push(`/bodegas/${b.id}/zonas/${z.id}/editar`)
                            : router.push(`/bodegas/${b.id}`)
                        }
                      >
                        <td className="px-4 py-2.5"></td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2 pl-6">
                            <Icon name="chevronRight" size={12} className="text-tx-3 shrink-0" />
                            <div className="font-medium text-tx-2 text-sm">{z.nombre}</div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge status="ZONA" kind="neutral" />
                        </td>
                        <td className="px-4 py-2.5 text-tx-3 text-sm">
                          {z.descripcion ? (
                            <span className="line-clamp-2">{z.descripcion}</span>
                          ) : (
                            <span className="text-tx-3">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-tx-3 text-sm">{b.ciudad || '—'}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-tx-3">—</td>
                        <td className="px-4 py-2.5">
                          <Badge
                            status={z.activa ? 'ACTIVA' : 'INACTIVA'}
                            kind={z.activa ? 'ok' : 'neutral'}
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div
                            className="inline-flex gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {puedeEditar && (
                              <Link
                                href={`/bodegas/${b.id}/zonas/${z.id}/editar`}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-tx-3 hover:bg-bg hover:text-tx transition-colors"
                                aria-label="Editar zona"
                              >
                                <Icon name="edit" size={14} />
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
