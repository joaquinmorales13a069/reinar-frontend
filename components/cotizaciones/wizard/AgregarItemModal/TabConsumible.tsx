'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useConsumibles } from '@/hooks/use-consumibles';
import { useAgregarItemCotizacion } from '@/hooks/use-cotizaciones';
import { formatCurrency } from '@/lib/utils';
import type { Consumible } from '@/types/api';
import type { TabChildProps } from './index';

export function TabConsumible({ cotizacionId, onAdded }: TabChildProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Consumible | null>(null);
  const [cantidadUnidades, setCantidadUnidades] = useState(1);

  const consQ = useConsumibles({ search: search || undefined, activo: true });
  const agregar = useAgregarItemCotizacion();

  const sinStock = selected ? selected.stockActual === 0 : false;
  const excedeStock = selected ? cantidadUnidades > selected.stockActual : false;

  async function confirmar() {
    if (!selected || excedeStock || sinStock) return;
    await agregar.mutateAsync({
      id: cotizacionId,
      data: { tipo: 'CONSUMIBLE', consumibleId: selected.id, cantidadUnidades },
    });
    onAdded();
  }

  return (
    <div className="space-y-3">
      <input
        className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
        placeholder="Buscar consumible…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {consQ.isLoading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : (
        <div className="border border-bd rounded-md max-h-64 overflow-y-auto">
          {(consQ.data?.data ?? []).map((c) => {
            const isActive = selected?.id === c.id;
            const stockKind: 'ok' | 'warn' | 'danger' =
              c.stockActual === 0 ? 'danger' : c.stockActual <= c.stockMinimo ? 'warn' : 'ok';
            return (
              <button
                key={c.id}
                type="button"
                disabled={c.stockActual === 0}
                className={`w-full text-left px-3 py-2 border-b border-bd last:border-b-0 transition-colors ${
                  c.stockActual === 0 ? 'opacity-50 cursor-not-allowed' : isActive ? 'bg-accent-soft' : 'hover:bg-bg-sunken'
                }`}
                onClick={() => {
                  setSelected(c);
                  setCantidadUnidades(1);
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-tx">{c.nombre}</div>
                    <div className="font-mono text-xs text-tx-3">
                      {c.codigo} · {formatCurrency(c.precioUnitario)}/{c.unidad}
                    </div>
                  </div>
                  <Badge
                    status={c.stockActual === 0 ? 'Sin stock' : `${c.stockActual} ${c.unidad}`}
                    kind={stockKind}
                  />
                </div>
              </button>
            );
          })}
          {consQ.data?.data.length === 0 && (
            <div className="px-3 py-4 text-sm text-tx-3 text-center">Sin consumibles.</div>
          )}
        </div>
      )}

      {selected && (
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-bd">
          <div>
            <label className="block text-xs font-medium text-tx-2 mb-1">
              Cantidad (stock: {selected.stockActual})
            </label>
            <input
              type="number"
              min={1}
              max={selected.stockActual}
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx font-mono"
              value={cantidadUnidades}
              onChange={(e) => setCantidadUnidades(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
            {excedeStock && (
              <p className="text-xs text-warn mt-1">
                Solo hay {selected.stockActual} {selected.unidad} en stock.
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-tx-2 mb-1">Subtotal</label>
            <div className="px-3 py-2 text-sm rounded-md border border-bd bg-bg-sunken text-tx font-mono font-semibold">
              {formatCurrency((Number(selected.precioUnitario) * cantidadUnidades).toFixed(2))}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-3 border-t border-bd">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors disabled:opacity-50"
          disabled={!selected || sinStock || excedeStock || agregar.isPending}
          onClick={confirmar}
        >
          <Icon name="plus" size={14} /> Agregar
        </button>
      </div>
    </div>
  );
}
