'use client';

import { useEquipoMantenimientos } from '@/hooks/use-equipos';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';

export function EquipoMantenimientosResumen({ equipoId }: { equipoId: string }) {
  const { data, isLoading } = useEquipoMantenimientos(equipoId);

  return (
    <div className="rounded-lg border border-bd bg-surface overflow-hidden">
      <div className="px-4 py-3 border-b border-bd">
        <h3 className="font-semibold text-tx">Mantenimientos recientes</h3>
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
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{m.tipo}</div>
                  {m.descripcion && (
                    <div className="text-xs text-tx-3 truncate">{m.descripcion}</div>
                  )}
                  {m.proveedor && (
                    <div className="text-xs text-tx-3">{m.proveedor}</div>
                  )}
                </div>
                <div className="text-xs text-tx-3 font-mono shrink-0">{formatDate(m.fechaIngreso)}</div>
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
