'use client';
// components/dashboard/RevenueWidget.tsx

import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, LabelList } from 'recharts';
import Decimal from 'decimal.js';
import type { IngresoMensual } from '@/types/dashboard';

type RevenueWidgetProps = {
  ingresosUltimos6Meses: IngresoMensual[];
};

const MES_ABREV: Record<string, string> = {
  '01': 'ENE', '02': 'FEB', '03': 'MAR', '04': 'ABR', '05': 'MAY', '06': 'JUN',
  '07': 'JUL', '08': 'AGO', '09': 'SEP', '10': 'OCT', '11': 'NOV', '12': 'DIC',
};

function abreviar(mes: string): string {
  // mes viene como 'YYYY-MM'; tomamos el MM para mapear a abreviatura.
  return MES_ABREV[mes.split('-')[1] ?? ''] ?? mes;
}

function formatMiles(n: number): string {
  // Formato corto "$XX.XK" para que las etiquetas quepan sobre cada barra.
  return `$${(n / 1000).toFixed(1)}K`;
}

export function RevenueWidget({ ingresosUltimos6Meses }: RevenueWidgetProps) {
  const data = ingresosUltimos6Meses.map((m) => {
    const valor = new Decimal(m.total).toNumber();
    return { mes: abreviar(m.mes), valor, label: formatMiles(valor) };
  });

  // MOM% calculado en cliente sobre los dos últimos meses del array.
  // Si el mes anterior fue 0, no mostramos pill (división por cero o porcentaje engañoso).
  const ultimo = data[data.length - 1]?.valor ?? 0;
  const anterior = data[data.length - 2]?.valor ?? 0;
  const mom = anterior > 0 ? ((ultimo - anterior) / anterior) * 100 : null;
  const momPositive = mom !== null && mom >= 0;

  return (
    <div className="rounded-lg bg-surface border border-bd p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-tx">Ingresos · últimos 6 meses</h3>
          <p className="text-xs text-tx-3 mt-0.5">Total facturado por mes en miles USD</p>
        </div>
        {mom !== null && (
          <span
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
              momPositive
                ? 'bg-ok-soft border-ok-soft text-ok'
                : 'bg-danger-soft border-danger-soft text-danger'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {momPositive ? '+' : ''}
            {mom.toFixed(1)}% MOM
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 22, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="mes"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#6B7B8E' }}
          />
          <Tooltip
            cursor={{ fill: 'rgba(10,26,42,0.04)' }}
            contentStyle={{
              background: '#FFFFFF',
              border: '1px solid rgba(10,26,42,0.10)',
              borderRadius: 6,
              fontSize: 12,
            }}
            formatter={(v) => [
              typeof v === 'number'
                ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : String(v),
              'Ingresos',
            ]}
          />
          <Bar dataKey="valor" fill="#F2C037" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="label" position="top" style={{ fontSize: 11, fill: '#44546A' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
