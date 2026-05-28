'use client';

import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/utils';

type Props = {
  factura: {
    id: string;
    numeroFactura: string;
    total: string | number;
    fechaEmision?: string;
    cliente?: { razonSocial: string | null; nombre: string | null; apellido: string | null } | null;
  };
};

export function FacturaOrigenCard({ factura }: Props) {
  const nombre =
    factura.cliente?.razonSocial ||
    `${factura.cliente?.nombre ?? ''} ${factura.cliente?.apellido ?? ''}`.trim() ||
    '—';

  return (
    <div className="rounded-md bg-bg-sunken p-4">
      <div className="flex justify-between items-start gap-4">
        <div>
          <Link
            href={`/facturas/${factura.id}`}
            className="font-mono font-semibold text-accent hover:underline"
          >
            {factura.numeroFactura}
          </Link>
          <div className="text-sm text-tx-2 mt-1">{nombre}</div>
          {factura.fechaEmision && (
            <div className="text-xs text-tx-3 font-mono mt-1">
              {/* text-xs en lugar de text-[10px]: el proyecto prohíbe valores arbitrarios; text-xs (12px) es el token más cercano */}
              Emitida: {formatDate(factura.fechaEmision)}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-tx-3 font-semibold">
            {/* ídem: text-xs reemplaza text-[10px] para cumplir restricción de valores arbitrarios */}
            Total factura
          </div>
          <div className="font-mono text-lg font-semibold">{formatCurrency(factura.total)}</div>
        </div>
      </div>
    </div>
  );
}
