'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import api from '@/lib/api';
import type { PaginatedResponse, Equipo } from '@/types/api';

// Llamamos al endpoint directamente porque useEquipos (hooks/use-equipos.ts)
// no expone aún el filtro `bodegaId`. El backend sí lo acepta como query param.
// Cuando el hook lo soporte, este card se simplifica a una llamada normal.
export function EquiposAsignadosCard({ bodegaId }: { bodegaId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['equipos', { bodegaId, limit: 8 }],
    queryFn: () =>
      api
        .get<PaginatedResponse<Equipo>>('/equipos', { params: { bodegaId, page: 1, limit: 8 } })
        .then((r) => ({ data: r.data.data, meta: r.data.meta })),
    enabled: !!bodegaId,
  });

  const total = data?.meta.total ?? 0;

  return (
    <div className="rounded-lg border border-bd bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
        <h3 className="text-sm font-semibold text-tx">
          Equipos asignados {total > 0 && <span className="text-tx-3 font-normal">({total})</span>}
        </h3>
        {total > 8 && (
          <Link
            href={`/equipos?bodegaId=${bodegaId}`}
            className="text-xs text-accent-dim hover:underline"
          >
            Ver todos
          </Link>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-8"><Spinner /></div>
      )}

      {isError && (
        <div className="px-4 py-6 text-center text-sm text-tx-3">
          No se pudieron cargar los equipos.
        </div>
      )}

      {!isLoading && !isError && data && data.data.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-tx-3">
          Sin equipos asignados a esta bodega.
        </div>
      )}

      {!isLoading && !isError && data && data.data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {data.data.map((e) => (
                <tr key={e.id} className="border-t border-bd first:border-t-0 hover:bg-bg-sunken transition-colors">
                  <td className="px-4 py-2.5 w-28 font-mono text-xs text-tx-2">
                    <Link href={`/equipos/${e.id}`} className="hover:underline">{e.codigo}</Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={`/equipos/${e.id}`} className="hover:underline">
                      <span className="text-tx">{e.nombre}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 w-32 text-right">
                    <Badge status={e.estado} />
                  </td>
                  <td className="px-4 py-2.5 w-8 pr-3 text-right">
                    <Link
                      href={`/equipos/${e.id}`}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-tx-3 hover:bg-bg hover:text-tx transition-colors"
                      aria-label="Ver"
                    >
                      <Icon name="arrowRight" size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
