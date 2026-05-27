'use client';

import { formatDate } from '@/lib/utils';
import type { PagoListItem } from '@/types/api';

type Props = { pago: PagoListItem };

// Panel embebido como fila acordeón en PagosTabla. Solo muestra datos que
// ya vienen del listado — no hace requests adicionales. Las notas largas
// no caben en la columna de la tabla; aquí se muestran completas.
export function PagoDetallePanel({ pago }: Props) {
  return (
    <div className="bg-bg-sunken px-4 py-3 border-t border-bd text-sm space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        <div>
          <div className="text-2xs uppercase tracking-wider text-tx-3 mb-0.5">ID del pago</div>
          <div className="font-mono text-xs text-tx-2 break-all">{pago.id}</div>
        </div>
        <div>
          <div className="text-2xs uppercase tracking-wider text-tx-3 mb-0.5">Registrado</div>
          <div className="font-mono text-xs text-tx-2">{formatDate(pago.createdAt)}</div>
        </div>
        <div className="sm:col-span-2">
          <div className="text-2xs uppercase tracking-wider text-tx-3 mb-0.5">Referencia</div>
          <div className="font-mono text-xs text-tx-2 break-all">{pago.referencia ?? '—'}</div>
        </div>
        <div className="sm:col-span-2">
          <div className="text-2xs uppercase tracking-wider text-tx-3 mb-0.5">Notas</div>
          <div className="text-xs text-tx-2 whitespace-pre-wrap">{pago.notas ?? '—'}</div>
        </div>
      </div>
    </div>
  );
}
