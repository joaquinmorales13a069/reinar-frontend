'use client';

import Decimal from 'decimal.js';
import { formatCurrency } from '@/lib/utils';
import type { Factura } from '@/types/api';

export function ProgresoCobroCard({ factura }: { factura: Factura }) {
  // Decimales serializados como string — usar decimal.js para evitar perdida
  // de precision en porcentajes.
  const total = new Decimal(factura.total);
  const pagado = new Decimal(factura.montoPagado);
  const saldo = new Decimal(factura.saldoPendiente);
  const progreso = total.gt(0)
    ? Decimal.min(100, pagado.div(total).mul(100).toDecimalPlaces(0).toNumber()).toNumber()
    : 0;
  const completo = progreso === 100;

  return (
    <div className="bg-bg border border-bd rounded-md p-4">
      <h3 className="text-sm font-medium text-tx mb-3">Progreso de cobro</h3>
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-mono text-2xl font-medium">{formatCurrency(factura.montoPagado)}</span>
        <span className="font-mono text-xs text-tx-3">de {formatCurrency(factura.total)}</span>
      </div>
      <div className="h-2 rounded-full bg-bg-sunken overflow-hidden">
        {/* width dinamico — unica excepcion justificada a "sin valores arbitrarios" */}
        <div
          className={`h-full rounded-full ${completo ? 'bg-ok' : 'bg-info'}`}
          style={{ width: `${progreso}%` }}
        />
      </div>
      <div className="flex justify-between mt-2.5 text-sm">
        <span className="text-tx-3">{progreso}% cobrado</span>
        <span className={`font-medium ${saldo.gt(0) ? 'text-danger' : 'text-ok'}`}>
          Saldo: {formatCurrency(factura.saldoPendiente)}
        </span>
      </div>
    </div>
  );
}
