'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { formatDate, nombreCliente } from '@/lib/utils';
import type { HistorialRentaItem } from '@/types/api';

// Reusable entre detalle de equipo y detalle de unidad de herramienta.
// Recibe el resultado del useQuery del hook correspondiente para no
// acoplarse a un endpoint especifico — asi futuras unidades (pieza de
// andamio individual, por ejemplo) pueden reutilizarlo.
type Props = {
  data: HistorialRentaItem[] | undefined;
  isLoading: boolean;
};

const PERIODO_LABEL: Record<string, string> = {
  DIA: 'Día',
  SEMANA: 'Semana',
  QUINCENA: 'Quincena',
  MES: 'Mes',
  CUSTOM: 'Custom',
};

export function HistorialRentasCard({ data, isLoading }: Props) {
  return (
    <div className="rounded-lg border border-bd bg-surface overflow-hidden">
      <div className="px-4 py-3 border-b border-bd">
        <h3 className="font-semibold text-tx">Historial de rentas</h3>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="p-6 text-center text-sm text-tx-3">
          <Icon name="clock" size={20} className="mx-auto mb-2" />
          <p>Sin rentas registradas todavía.</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-bg-sunken text-2xs uppercase tracking-wider text-tx-3">
            <tr>
              <th className="text-left font-medium px-4 py-2">Cotización</th>
              <th className="text-left font-medium px-4 py-2">Cliente</th>
              <th className="text-left font-medium px-4 py-2 w-28">Aprobada</th>
              <th className="text-left font-medium px-4 py-2 w-28">Servicio</th>
              <th className="text-left font-medium px-4 py-2 w-24">Período</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.cotizacionId} className="border-t border-bd">
                <td className="px-4 py-2">
                  <Link
                    href={`/cotizaciones/${r.cotizacionId}`}
                    className="font-mono text-tx hover:underline"
                  >
                    {r.numeroCotizacion}
                  </Link>
                </td>
                <td className="px-4 py-2 text-tx">{nombreCliente(r.cliente)}</td>
                <td className="px-4 py-2 font-mono text-xs text-tx-2">
                  {r.fechaAprobacion ? formatDate(r.fechaAprobacion) : '—'}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-tx-2">
                  {r.fechaServicio ? formatDate(r.fechaServicio) : '—'}
                </td>
                <td className="px-4 py-2">
                  {r.periodo ? (
                    <Badge
                      status={
                        r.periodo === 'CUSTOM' && r.periodoCustomLabel
                          ? r.periodoCustomLabel
                          : PERIODO_LABEL[r.periodo] ?? r.periodo
                      }
                    />
                  ) : (
                    <span className="text-tx-3 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
