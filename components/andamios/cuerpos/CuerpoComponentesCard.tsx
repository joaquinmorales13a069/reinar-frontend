'use client';

import Decimal from 'decimal.js';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import type { CuerpoComponente, PiezaTipo } from '@/types/api';

type Props = {
  componentes: CuerpoComponente[];
  piezas: PiezaTipo[] | undefined;  // catálogo completo para conocer tarifas
};

export function CuerpoComponentesCard({ componentes, piezas }: Props) {
  // Las tarifas no vienen en el select anidado de componente.piezaTipo;
  // las resolvemos contra el listado de piezas que ya cachea React Query.
  const filas = componentes.map((c) => {
    const pieza = piezas?.find((p) => p.id === c.piezaTipo.id);
    const subtotalDia = pieza ? new Decimal(pieza.tarifaDia).times(c.cantidad).toNumber() : null;
    return { ...c, pieza, subtotalDia };
  });

  const totalDia = filas.reduce((s, f) => s + (f.subtotalDia ?? 0), 0);

  return (
    <Card>
      <h3 className="text-sm font-semibold mb-3">Componentes</h3>
      <div className="overflow-x-auto rounded-md border border-bd">
        <table className="w-full text-sm">
          <thead className="bg-bg-sunken text-xs text-tx-2 uppercase">
            <tr>
              <th className="text-left px-3 py-2 w-12">#</th>
              <th className="text-left px-3 py-2">Pieza</th>
              <th className="text-right px-3 py-2 w-24">Cantidad</th>
              <th className="text-right px-3 py-2 w-32">Tarifa/día c/u</th>
              <th className="text-right px-3 py-2 w-32">Subtotal/día</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={f.id} className="border-t border-bd">
                <td className="px-3 py-2 font-mono text-xs text-tx-3">{i + 1}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/andamios/piezas/${f.piezaTipo.id}`}
                    className="hover:text-accent"
                  >
                    {f.piezaTipo.nombre}
                  </Link>
                </td>
                <td className="px-3 py-2 text-right font-mono">×{f.cantidad}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {f.pieza ? formatCurrency(new Decimal(f.pieza.tarifaDia).toNumber()) : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold">
                  {f.subtotalDia !== null ? formatCurrency(f.subtotalDia) : '—'}
                </td>
              </tr>
            ))}
            <tr className="bg-bg-sunken">
              <td colSpan={4} className="px-3 py-2 font-semibold">
                Total tarifa diaria
              </td>
              <td className="px-3 py-2 text-right font-mono font-bold text-base">
                {formatCurrency(totalDia)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
