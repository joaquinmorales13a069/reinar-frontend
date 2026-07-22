'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { FacturaEstadoBadge } from '@/components/facturas/FacturaEstadoBadge';
import { formatCurrency, nombreCliente } from '@/lib/utils';
import type { FacturaListItem } from '@/types/api';

type Props = {
  factura: FacturaListItem;
  onClear: () => void;
};

export function FacturaSeleccionadaCard({ factura, onClear }: Props) {
  return (
    <div className="bg-bg-sunken border border-bd rounded-md p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/facturas/${factura.id}`}
            className="font-mono font-semibold text-tx hover:underline"
          >
            {factura.numeroFactura}
          </Link>
          <div className="text-sm text-tx-2 mt-1">{nombreCliente(factura.cliente)}</div>
          <div className="mt-2"><FacturaEstadoBadge estado={factura.estado} /></div>
        </div>
        <div className="text-right">
          <div className="text-2xs uppercase tracking-wider text-tx-3 font-semibold">Saldo pendiente</div>
          <div className="font-mono text-2xl font-semibold text-danger tabular-nums">
            {formatCurrency(factura.saldoPendiente)}
          </div>
          <div className="font-mono text-xs text-tx-3">
            de {formatCurrency(factura.total)}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="mt-3 inline-flex items-center gap-1.5 text-xs text-tx-3 hover:text-tx"
      >
        <Icon name="x" size={12} /> Cambiar factura
      </button>
    </div>
  );
}
