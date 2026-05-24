'use client';

import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { CotizacionStatusBadge } from '@/components/cotizaciones/CotizacionStatusBadge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { descargarCotizacionPdf } from '@/hooks/use-cotizaciones';
import type { CotizacionListItem } from '@/types/api';

type Props = {
  data: CotizacionListItem[];
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
};

export function CotizacionesTabla({ data, loading, page, pageSize, total, onPage }: Props) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon="fileText"
        title="Sin cotizaciones"
        message="No se encontraron cotizaciones con los filtros aplicados."
      />
    );
  }

  return (
    <div className="border border-bd rounded-b-md overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-bg-sunken text-tx-3 text-xs uppercase tracking-wider">
          <tr>
            <th className="text-left font-medium px-4 py-2.5">Número</th>
            <th className="text-left font-medium px-4 py-2.5">Cliente</th>
            <th className="text-left font-medium px-4 py-2.5">Estado</th>
            <th className="text-right font-medium px-4 py-2.5">Ítems</th>
            <th className="text-right font-medium px-4 py-2.5">Total</th>
            <th className="text-left font-medium px-4 py-2.5">Creación</th>
            <th className="text-left font-medium px-4 py-2.5">Vence</th>
            <th className="w-12 px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {data.map((c) => (
            <tr
              key={c.id}
              className="border-t border-bd hover:bg-bg-sunken cursor-pointer transition-colors"
              onClick={() => router.push(`/cotizaciones/${c.id}`)}
            >
              <td className="px-4 py-2.5 font-mono font-medium text-tx">{c.numeroCotizacion}</td>
              <td className="px-4 py-2.5 text-tx">{c.cliente.nombre}</td>
              <td className="px-4 py-2.5">
                <CotizacionStatusBadge estado={c.estado} />
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">{c._count.items}</td>
              <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatCurrency(c.total)}</td>
              <td className="px-4 py-2.5 font-mono text-tx-2 text-xs">{formatDate(c.fechaCreacion)}</td>
              <td className="px-4 py-2.5 font-mono text-tx-2 text-xs">{formatDate(c.fechaVencimiento)}</td>
              <td className="px-4 py-2.5">
                <button
                  type="button"
                  className="inline-flex items-center justify-center w-8 h-8 rounded text-tx-3 hover:bg-bg hover:text-tx transition-colors"
                  title="Descargar PDF"
                  onClick={(e) => {
                    e.stopPropagation();
                    void descargarCotizacionPdf(c.id, c.numeroCotizacion);
                  }}
                >
                  <Icon name="download" size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {total > pageSize && (
        <Pagination page={page} pageSize={pageSize} total={total} onPage={onPage} />
      )}
    </div>
  );
}
