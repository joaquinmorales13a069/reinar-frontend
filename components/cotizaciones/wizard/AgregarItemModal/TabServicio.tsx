'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { useServicios } from '@/hooks/use-servicios';
import { useAgregarItemCotizacion } from '@/hooks/use-cotizaciones';
import { formatCurrency } from '@/lib/utils';
import type { Servicio } from '@/types/api';
import type { TabChildProps } from './index';

export function TabServicio({ cotizacionId, onAdded }: TabChildProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Servicio | null>(null);
  const [cantidad, setCantidad] = useState(1);

  const serviciosQ = useServicios({ search: search || undefined, activo: true });
  const agregar = useAgregarItemCotizacion();

  async function confirmar() {
    if (!selected) return;
    await agregar.mutateAsync({
      id: cotizacionId,
      data: { tipo: 'SERVICIO', servicioId: selected.id, cantidad },
    });
    onAdded();
  }

  return (
    <div className="space-y-3">
      <input
        className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
        placeholder="Buscar servicio…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {serviciosQ.isLoading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : (
        <div className="border border-bd rounded-md max-h-64 overflow-y-auto">
          {(serviciosQ.data?.data ?? []).map((s) => {
            const isActive = selected?.id === s.id;
            return (
              <button
                key={s.id}
                type="button"
                className={`w-full text-left px-3 py-2 border-b border-bd last:border-b-0 transition-colors ${
                  isActive ? 'bg-accent-soft' : 'hover:bg-bg-sunken'
                }`}
                onClick={() => setSelected(s)}
              >
                <div className="text-sm font-medium text-tx">{s.nombre}</div>
                <div className="font-mono text-xs text-tx-3">
                  {s.codigo} · {formatCurrency(s.tarifaBase)}/{s.unidad}
                </div>
              </button>
            );
          })}
          {serviciosQ.data?.data.length === 0 && (
            <div className="px-3 py-4 text-sm text-tx-3 text-center">Sin servicios.</div>
          )}
        </div>
      )}

      {selected && (
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-bd">
          <div>
            <label className="block text-xs font-medium text-tx-2 mb-1">Cantidad</label>
            <input
              type="number"
              min={1}
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx font-mono"
              value={cantidad}
              onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-tx-2 mb-1">Subtotal</label>
            <div className="px-3 py-2 text-sm rounded-md border border-bd bg-bg-sunken text-tx font-mono font-semibold">
              {formatCurrency((Number(selected.tarifaBase) * cantidad).toFixed(2))}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-3 border-t border-bd">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors disabled:opacity-50"
          disabled={!selected || agregar.isPending}
          onClick={confirmar}
        >
          <Icon name="plus" size={14} /> Agregar
        </button>
      </div>
    </div>
  );
}
