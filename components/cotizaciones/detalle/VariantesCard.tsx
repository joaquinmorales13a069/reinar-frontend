'use client';

import Link from 'next/link';
import { CotizacionStatusBadge } from '@/components/cotizaciones/CotizacionStatusBadge';
import { formatCurrency } from '@/lib/utils';
import type { Cotizacion } from '@/types/api';

// Hermanas de esta cotización: mismo consecutivo, sufijo interno distinto.
// Solo se renderiza cuando existen — la mayoría de cotizaciones no tiene.
export function VariantesCard({ cotizacion }: { cotizacion: Cotizacion }) {
  if (!cotizacion.variantes || cotizacion.variantes.length === 0) return null;

  return (
    <div className="bg-bg border border-bd rounded-md p-4">
      <h3 className="text-sm font-medium text-tx mb-2">Variantes de este número</h3>
      <p className="text-xs text-tx-3 mb-3">
        Comparten el consecutivo; al aprobar una, las demás se descartan. El cliente ve el número sin sufijo.
      </p>
      <div className="divide-y divide-bd">
        {cotizacion.variantes.map((v) => (
          <Link
            key={v.id}
            href={`/cotizaciones/${v.id}`}
            className="flex items-center justify-between gap-3 py-2 px-1 rounded hover:bg-bg-sunken transition-colors"
          >
            <span className="text-sm font-mono font-medium text-tx">{v.numeroCotizacion}</span>
            <span className="flex items-center gap-3">
              <CotizacionStatusBadge estado={v.estado} />
              <span className="text-sm font-mono text-tx-2">{formatCurrency(v.total)}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
