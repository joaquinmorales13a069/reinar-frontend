// components/dashboard/FleetWidget.tsx
'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from 'recharts';
import type { DashboardKpis } from '@/types/dashboard';

type FleetWidgetProps = {
  utilizacionEquipos: DashboardKpis['utilizacionEquipos'];
};

// Colores en hex directo porque Recharts no interpreta CSS vars en atributos SVG fill
const ESTADOS = [
  { key: 'disponibles',  label: 'Disponibles',   color: '#2E8C5A' },
  { key: 'rentados',     label: 'Rentados',       color: '#F2C037' },
  { key: 'mantenimiento', label: 'Mantenimiento', color: '#E08A1A' },
  { key: 'inactivos',    label: 'Inactivos',      color: '#6B7B8E' },
] as const;

export function FleetWidget({ utilizacionEquipos }: FleetWidgetProps) {
  const chartData = ESTADOS.map((e) => ({
    estado: e.label,
    cantidad: utilizacionEquipos[e.key],
    color: e.color,
  }));

  return (
    <div className="rounded-lg bg-surface border border-bd p-5 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-medium text-tx">Utilización de flota</h3>
        <p className="text-xs text-tx-3 mt-0.5">
          Estado actual · {utilizacionEquipos.total} equipos en total
        </p>
      </div>
      <ResponsiveContainer width="100%" height={148}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
        >
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#6B7B8E' }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="estado"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#44546A' }}
            width={96}
          />
          <Tooltip
            cursor={{ fill: 'rgba(10,26,42,0.04)' }}
            contentStyle={{
              background: '#FFFFFF',
              border: '1px solid rgba(10,26,42,0.10)',
              borderRadius: 6,
              fontSize: 12,
            }}
            formatter={(value) => [`${value ?? 0} equipos`, 'Cantidad']}
          />
          <Bar dataKey="cantidad" radius={[0, 4, 4, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.estado} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
