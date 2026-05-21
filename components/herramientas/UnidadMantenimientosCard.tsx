'use client';

import Link from 'next/link';
import { useMantenimientosUnidad } from '@/hooks/use-herramientas';
import { formatDate } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';

export function UnidadMantenimientosCard({ unidadId }: { unidadId: string }) {
  const { data, isLoading } = useMantenimientosUnidad(unidadId);

  const items = (data?.data ?? []).slice(0, 5);

  return (
    <div className="rounded-lg border border-bd bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-tx">Mantenimientos recientes</h3>
        {items.length > 0 && (
          <Link
            href={`/mantenimientos?unidadId=${unidadId}`}
            className="text-xs text-tx-2 hover:text-tx hover:underline"
          >
            Ver todos
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center p-4">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-tx-3">Sin mantenimientos registrados.</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((m) => (
            <li
              key={m.id}
              className="border-t border-bd first:border-t-0 py-2 flex items-center justify-between gap-3"
            >
              <div>
                <div className="text-sm font-medium">{m.tipo}</div>
                <div className="text-xs text-tx-3 font-mono">{formatDate(m.fechaIngreso)}</div>
              </div>
              <Badge status={m.estado} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
