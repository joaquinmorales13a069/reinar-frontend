'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { FilterBar } from '@/components/ui/FilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { useCuerpos } from '@/hooks/use-andamios';

export function CuerposTable() {
  const [search, setSearch] = useState('');
  const [incluirInactivos, setIncluirInactivos] = useState(false);

  const { data: cuerpos, isLoading, isError } = useCuerpos({ incluirInactivos });

  // Búsqueda client-side sobre nombre — el endpoint GET /andamios/cuerpos
  // no soporta ?busqueda, por eso filtramos localmente sobre los datos ya cargados.
  const filtrados = useMemo(() => {
    if (!cuerpos) return [];
    const q = search.trim().toLowerCase();
    if (!q) return cuerpos;
    return cuerpos.filter((c) => c.nombre.toLowerCase().includes(q));
  }, [cuerpos, search]);

  return (
    <div className="rounded-lg border border-bd bg-surface overflow-hidden">
      <FilterBar
        search={search}
        onSearch={setSearch}
        placeholder="Buscar configuración por nombre…"
        chips={[
          {
            label: 'Incluir inactivos',
            active: incluirInactivos,
            onToggle: () => setIncluirInactivos((v) => !v),
          },
        ]}
        onClear={() => {
          setSearch('');
          setIncluirInactivos(false);
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
          title="Error al cargar configuraciones"
          message="Intentá refrescar la página."
        />
      )}

      {!isLoading && !isError && filtrados.length === 0 && (
        <EmptyState
          icon="layers"
          title="Sin configuraciones"
          message="No hay configuraciones de cuerpo registradas."
        />
      )}

      {!isLoading && !isError && filtrados.length > 0 && (
        // overflow-x-auto: en pantallas pequeñas la tabla excede el contenedor
        // y aparece scroll horizontal en lugar de aplastar las celdas.
        <div className="overflow-x-auto">
          <table className="w-full min-w-3xl text-sm">
            <thead className="bg-bg-sunken text-2xs uppercase tracking-wider text-tx-3">
              <tr>
                <th className="text-left px-4 py-2 font-medium w-12">#</th>
                <th className="text-left px-4 py-2 font-medium">Configuración</th>
                <th className="text-right px-4 py-2 font-medium w-36">Piezas distintas</th>
                <th className="text-right px-4 py-2 font-medium w-36">Disponibles</th>
                <th className="text-left px-4 py-2 font-medium w-28">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c, i) => {
                const sinStock = c.stockCuerposDisponibles === 0;
                return (
                  <tr
                    key={c.id}
                    className="border-t border-bd hover:bg-bg-sunken transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-tx-3">{i + 1}</td>
                    <td className="px-4 py-3">
                      <Link href={`/andamios/cuerpos/${c.id}`} className="hover:underline">
                        <div className="font-medium">{c.nombre}</div>
                        {c.descripcion && (
                          <div className="text-xs text-tx-3 mt-0.5">{c.descripcion}</div>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{c.componentes.length}</td>
                    <td
                      className={`px-4 py-3 text-right font-mono ${sinStock ? 'text-warn font-semibold' : ''}`}
                    >
                      {c.stockCuerposDisponibles}
                      {/* Icono de alerta visual junto al número cuando no hay cuerpos armables */}
                      {sinStock && (
                        <span className="inline-block ml-1 align-middle">
                          <Icon name="alertTriangle" size={11} />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        status={c.activo ? 'ACTIVO' : 'INACTIVO'}
                        kind={c.activo ? 'ok' : 'neutral'}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
