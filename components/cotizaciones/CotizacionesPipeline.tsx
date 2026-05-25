'use client';

import { useRouter } from 'next/navigation';
import Decimal from 'decimal.js';
import { Spinner } from '@/components/ui/Spinner';
import { CotizacionStatusBadge } from '@/components/cotizaciones/CotizacionStatusBadge';
import { useCotizaciones } from '@/hooks/use-cotizaciones';
import { formatCurrency } from '@/lib/utils';
import type { CotizacionListItem, EstadoCotizacion } from '@/types/api';

const COLUMNAS: { estado: EstadoCotizacion; hint: string }[] = [
  { estado: 'BORRADOR',  hint: 'En preparación' },
  { estado: 'ENVIADA',   hint: 'Pendiente respuesta' },
  { estado: 'APROBADA',  hint: 'Lista para facturar' },
  { estado: 'RECHAZADA', hint: 'No procedió' },
];

export function CotizacionesPipeline() {
  const router = useRouter();
  // El pipeline ignora paginación porque se muestra como kanban; pedimos un límite
  // grande pero acotado para evitar payloads gigantes en proyectos con histórico
  // largo. Si esto se vuelve un problema, paginar por columna en una segunda iteración.
  const { data, isLoading } = useCotizaciones({ limit: 100 });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const todas = data?.data ?? [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {COLUMNAS.map((col) => {
        const items = todas.filter((c) => c.estado === col.estado);
        const suma = items.reduce(
          (acc, c) => acc.add(new Decimal(c.total)),
          new Decimal(0),
        );
        return (
          <div key={col.estado} className="bg-bg-sunken border border-bd rounded-md flex flex-col">
            <div className="px-3 py-2.5 border-b border-bd">
              <div className="flex items-center justify-between">
                <CotizacionStatusBadge estado={col.estado} />
                <span className="text-xs text-tx-3">{items.length}</span>
              </div>
              <div className="text-xs text-tx-3 mt-1">{col.hint}</div>
              <div className="font-mono text-sm font-medium text-tx mt-1">
                {formatCurrency(suma.toFixed(2))}
              </div>
            </div>
            <div className="p-2 flex flex-col gap-2 max-h-96 overflow-y-auto">
              {items.map((c) => (
                <PipelineCard key={c.id} cot={c} onClick={() => router.push(`/cotizaciones/${c.id}`)} />
              ))}
              {items.length === 0 && (
                <div className="text-xs text-tx-3 text-center py-4">Sin cotizaciones</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PipelineCard({ cot, onClick }: { cot: CotizacionListItem; onClick: () => void }) {
  return (
    <button
      type="button"
      className="text-left bg-bg border border-bd rounded p-2.5 hover:border-accent transition-colors"
      onClick={onClick}
    >
      <div className="font-mono text-xs font-medium text-tx">{cot.numeroCotizacion}</div>
      <div className="text-sm text-tx mt-0.5 truncate">
        {cot.cliente.tipo === 'EMPRESA'
          ? cot.cliente.razonSocial ?? '—'
          : [cot.cliente.nombre, cot.cliente.apellido].filter(Boolean).join(' ') || '—'}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="font-mono text-sm font-semibold text-tx">{formatCurrency(cot.total)}</span>
        <span className="text-2xs text-tx-3">{cot._count.items} ítems</span>
      </div>
    </button>
  );
}
