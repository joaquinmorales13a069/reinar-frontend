'use client';

import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import type { Factura } from '@/types/api';

const PERIODO_LABEL: Record<string, string> = {
  DIA: 'Día',
  SEMANA: 'Semana',
  QUINCENA: 'Quincena',
  MES: 'Mes',
  CUSTOM: 'Custom',
};
// Sufijo de tarifa para hacer explicito al cliente si es por dia/semana/mes.
const PERIODO_SUFIJO: Record<string, string> = {
  DIA: '/día',
  SEMANA: '/sem',
  QUINCENA: '/quinc',
  MES: '/mes',
  CUSTOM: '',
};

export function ItemsFacturadosCard({ factura }: { factura: Factura }) {
  const items = factura.cotizacion.items ?? [];
  return (
    <div className="bg-bg border border-bd rounded-md">
      <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
        <h3 className="text-sm font-medium text-tx">Ítems facturados</h3>
        <span className="text-xs text-tx-3">
          Origen:{' '}
          <Link
            href={`/cotizaciones/${factura.cotizacionId}`}
            className="font-mono hover:underline"
          >
            {factura.cotizacion.numeroCotizacion}
          </Link>
        </span>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-bg-sunken text-2xs uppercase tracking-wider text-tx-3">
          <tr>
            <th className="text-left font-medium px-4 py-2">Descripción</th>
            <th className="text-left font-medium px-4 py-2 w-28">Tarifa</th>
            <th className="text-right font-medium px-4 py-2 w-28">Cant.</th>
            <th className="text-right font-medium px-4 py-2 w-28">Tarifa</th>
            <th className="text-right font-medium px-4 py-2 w-28">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const aplicaDias = it.tipo !== 'SERVICIO' && it.tipo !== 'CONSUMIBLE';
            const sufijo = PERIODO_SUFIJO[it.periodo] ?? '';
            return (
            <tr key={it.id} className="border-t border-bd">
              <td className="px-4 py-2 text-sm">{it.descripcion}</td>
              <td className="px-4 py-2 text-xs text-tx-3">
                {PERIODO_LABEL[it.periodo] ?? it.periodo}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {it.cantidadUnidades}
                {aplicaDias && it.cantidadDias > 1 && (
                  <span className="text-tx-3"> × {it.cantidadDias} días</span>
                )}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {formatCurrency(it.tarifaAplicada)}
                {aplicaDias && sufijo && (
                  <span className="text-tx-3">{sufijo}</span>
                )}
              </td>
              <td className="px-4 py-2 text-right tabular-nums font-medium">
                {formatCurrency(it.subtotal)}
              </td>
            </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-bg-sunken text-sm">
          <tr>
            <td colSpan={4} className="text-right text-tx-2 px-4 py-1.5">
              Subtotal
            </td>
            <td className="text-right tabular-nums px-4 py-1.5">
              {formatCurrency(factura.subtotal)}
            </td>
          </tr>
          <tr>
            <td colSpan={4} className="text-right text-tx-2 px-4 py-1.5">
              {factura.exentoIva ? 'Exento de IVA' : `IVA (${factura.porcentajeIva}%)`}
            </td>
            <td className="text-right tabular-nums px-4 py-1.5">
              {formatCurrency(factura.montoIva)}
            </td>
          </tr>
          <tr>
            <td colSpan={4} className="text-right font-bold px-4 py-2 border-t border-bd">
              Total
            </td>
            <td className="text-right tabular-nums font-bold text-base px-4 py-2 border-t border-bd">
              {formatCurrency(factura.total)}
            </td>
          </tr>
        </tfoot>
      </table>
      </div>
    </div>
  );
}
