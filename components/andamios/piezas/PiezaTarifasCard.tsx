'use client';

import Decimal from 'decimal.js';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';

type Props = {
  tarifaDia: string;
  tarifaSemana: string;
  tarifaMes: string;
};

export function PiezaTarifasCard({ tarifaDia, tarifaSemana, tarifaMes }: Props) {
  const filas: [string, string][] = [
    ['Tarifa por día', tarifaDia],
    ['Tarifa por semana', tarifaSemana],
    ['Tarifa por mes', tarifaMes],
  ];
  return (
    <Card>
      <h3 className="text-sm font-semibold mb-3">Tarifas</h3>
      <dl className="m-0 divide-y divide-bd">
        {filas.map(([label, val]) => (
          <div key={label} className="flex justify-between py-2 text-sm">
            <dt className="text-tx-2">{label}</dt>
            <dd className="font-mono">{formatCurrency(new Decimal(val).toNumber())}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
