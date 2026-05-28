'use client';

import Link from 'next/link';
import { useEquipoMantenimientos } from '@/hooks/use-equipos';
import { Spinner } from '@/components/ui/Spinner';
import { MantenimientoEstadoBadge } from '@/components/mantenimientos/MantenimientoEstadoBadge';
import { formatDate } from '@/lib/utils';

export function EquipoMantenimientosResumen({ equipoId }: { equipoId: string }) {
  const { data, isLoading } = useEquipoMantenimientos(equipoId);

  return (
    <div className="rounded-lg border border-bd bg-surface overflow-hidden">
      <div className="px-4 py-3 border-b border-bd flex items-center justify-between">
        <h3 className="font-semibold text-tx">Mantenimientos recientes</h3>
        <Link
          href={`/mantenimientos?equipoId=${equipoId}`}
          className="text-xs text-accent hover:underline"
        >
          Ver todos
        </Link>
      </div>
      <div className="p-4">
        {isLoading ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : data && data.data.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {data.data.slice(0, 5).map((m, i, arr) => (
              <li
                key={m.id}
                className={`flex items-start justify-between gap-3 ${
                  i < arr.length - 1 ? 'pb-3 border-b border-bd' : ''
                }`}
              >
                <Link href={`/mantenimientos/${m.id}`} className="min-w-0 flex-1 group">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate group-hover:text-accent">
                      {m.tipo}
                    </span>
                    <MantenimientoEstadoBadge estado={m.estado} />
                  </div>
                  <div className="text-xs text-tx-3 truncate">{m.motivo}</div>
                  <div className="text-xs text-tx-3">Técnico: {m.tecnico}</div>
                </Link>
                <div className="text-xs text-tx-3 font-mono shrink-0">
                  {formatDate(m.fechaEntrada)}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-tx-3">Sin mantenimientos registrados.</p>
        )}
      </div>
    </div>
  );
}
