// components/dashboard/TopClientes.tsx
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import type { DashboardKpis } from '@/types/dashboard';

type TopClientesProps = {
  clientes: DashboardKpis['topClientesPorIngresos'];
};

export function TopClientes({ clientes }: TopClientesProps) {
  return (
    <div className="rounded-lg bg-surface border border-bd flex flex-col">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-bd">
        <div>
          <h3 className="text-sm font-medium text-tx">Top clientes</h3>
          <p className="text-xs text-tx-3 mt-0.5">Por monto facturado · últimos 12 meses</p>
        </div>
        <Link
          href="/clientes"
          className="text-xs text-accent hover:text-accent-dim transition-colors"
        >
          Ver todos →
        </Link>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-bd">
            <th className="text-left text-xs text-tx-3 font-medium py-2.5 pl-5 w-8">#</th>
            <th className="text-left text-xs text-tx-3 font-medium py-2.5">Cliente</th>
            <th className="text-right text-xs text-tx-3 font-medium py-2.5 pr-5">Facturado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-bd">
          {clientes.length === 0 && (
            <tr>
              <td colSpan={3} className="text-center text-tx-3 py-8 text-sm">
                Sin datos disponibles.
              </td>
            </tr>
          )}
          {clientes.map((c, i) => (
            <tr key={c.clienteId} className="hover:bg-row-hover transition-colors">
              <td className="pl-5 py-3">
                <span className="font-mono text-xs text-tx-3">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </td>
              <td className="py-3 pr-4">
                <Link
                  href={`/clientes/${c.clienteId}`}
                  className="font-medium text-tx hover:text-accent transition-colors truncate block max-w-[120px] lg:max-w-[180px] ml-2"
                >
                  {c.nombre}
                </Link>
              </td>
              <td className="text-right pr-5 py-3 font-mono text-xs text-tx">
                {formatCurrency(c.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
