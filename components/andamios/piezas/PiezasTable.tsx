'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Decimal from 'decimal.js';
import { FilterBar } from '@/components/ui/FilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { usePiezas } from '@/hooks/use-andamios';
import { formatCurrency } from '@/lib/utils';

export function PiezasTable() {
  const [search, setSearch] = useState('');
  const [stockBajo, setStockBajo] = useState(false);
  const [incluirInactivos, setIncluirInactivos] = useState(false);

  const { data: piezas, isLoading, isError } = usePiezas({ stockBajo, incluirInactivos });

  // Búsqueda client-side sobre nombre o ID — el endpoint GET /andamios/piezas
  // no soporta ?busqueda, por eso filtramos localmente sobre los datos ya cargados.
  const filtradas = useMemo(() => {
    if (!piezas) return [];
    const q = search.trim().toLowerCase();
    if (!q) return piezas;
    return piezas.filter(
      (p) => p.nombre.toLowerCase().includes(q) || p.id.toLowerCase().includes(q),
    );
  }, [piezas, search]);

  // Conteo de piezas bajo mínimo calculado sobre la lista completa (sin filtro de texto)
  // para que el chip muestre el número real aunque haya una búsqueda activa.
  const bajoCount = piezas?.filter((p) => p.stockActual <= p.stockMinimo).length ?? 0;

  return (
    <div className="rounded-lg border border-bd bg-surface overflow-hidden">
      <FilterBar
        search={search}
        onSearch={setSearch}
        placeholder="Buscar pieza por nombre o ID…"
        chips={[
          {
            label: `Stock bajo${bajoCount ? ` (${bajoCount})` : ''}`,
            active: stockBajo,
            onToggle: () => setStockBajo((v) => !v),
          },
          {
            label: 'Incluir inactivos',
            active: incluirInactivos,
            onToggle: () => setIncluirInactivos((v) => !v),
          },
        ]}
        onClear={() => {
          setSearch('');
          setStockBajo(false);
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
          title="Error al cargar piezas"
          message="Intentá refrescar la página."
        />
      )}

      {!isLoading && !isError && filtradas.length === 0 && (
        <EmptyState
          icon="package"
          title="Sin piezas"
          message="No se encontraron piezas con los filtros aplicados."
        />
      )}

      {!isLoading && !isError && filtradas.length > 0 && (
        // overflow-x-auto: en pantallas pequeñas la tabla excede el contenedor
        // y aparece scroll horizontal en lugar de aplastar las celdas.
        <div className="overflow-x-auto">
          <table className="w-full min-w-3xl text-sm">
            <thead className="bg-bg-sunken text-2xs uppercase tracking-wider text-tx-3">
              <tr>
                <th className="text-left px-4 py-2 font-medium w-32">ID</th>
                <th className="text-left px-4 py-2 font-medium">Pieza</th>
                <th className="text-right px-4 py-2 font-medium w-32">Stock actual</th>
                <th className="text-right px-4 py-2 font-medium w-32">Stock mínimo</th>
                <th className="text-right px-4 py-2 font-medium w-32">Tarifa/día</th>
                <th className="text-left px-4 py-2 font-medium w-28">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((p) => {
                const bajo = p.stockActual <= p.stockMinimo;
                return (
                  <tr
                    key={p.id}
                    className="border-t border-bd hover:bg-bg-sunken transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-medium text-xs">
                      <Link href={`/andamios/piezas/${p.id}`} className="hover:underline">
                        {p.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/andamios/piezas/${p.id}`} className="hover:underline">
                        <div className="font-medium">{p.nombre}</div>
                        {p.descripcion && (
                          <div className="text-xs text-tx-3 mt-0.5">{p.descripcion}</div>
                        )}
                      </Link>
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono ${bajo ? 'text-warn font-semibold' : ''}`}
                    >
                      {p.stockActual}
                      {/* Icono de alerta visual junto al número cuando el stock está bajo */}
                      {bajo && (
                        <span className="inline-block ml-1 align-middle">
                          <Icon name="alertTriangle" size={11} />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-tx-2">{p.stockMinimo}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatCurrency(new Decimal(p.tarifaDia).toNumber())}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        status={p.activo ? 'ACTIVO' : 'INACTIVO'}
                        kind={p.activo ? 'ok' : 'neutral'}
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
