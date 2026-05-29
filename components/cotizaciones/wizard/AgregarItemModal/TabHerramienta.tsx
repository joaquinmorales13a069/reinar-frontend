'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useHerramientaTipos } from '@/hooks/use-herramientas';
import { useAgregarItemCotizacion } from '@/hooks/use-cotizaciones';
import { formatCurrency } from '@/lib/utils';
import type { HerramientaTipo, PeriodoItem } from '@/types/api';
import type { TabChildProps } from './index';

// QUINCENA se omite porque la base de datos solo tiene tarifaDia/Semana/Mes.
const PERIODOS: { value: Exclude<PeriodoItem, 'CUSTOM' | 'QUINCENA'>; label: string }[] = [
  { value: 'DIA',    label: 'Día' },
  { value: 'SEMANA', label: 'Semana' },
  { value: 'MES',    label: 'Mes' },
];

// El backend asigna las unidades automáticamente; el usuario solo elige el tipo
// y cuántas necesita. La cantidad está acotada por unidadesDisponibles del tipo.
export function TabHerramienta({ cotizacionId, onAdded }: TabChildProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<HerramientaTipo | null>(null);
  const [periodo, setPeriodo] = useState<Exclude<PeriodoItem, 'CUSTOM' | 'QUINCENA'>>('DIA');
  const [cantidadUnidades, setCantidadUnidades] = useState(1);
  const [cantidadDias, setCantidadDias] = useState(1);

  const herrQ = useHerramientaTipos({ search: search || undefined, activo: true });
  const agregar = useAgregarItemCotizacion();

  const max = selected?.unidadesDisponibles ?? 0;

  async function confirmar() {
    if (!selected || cantidadUnidades > max) return;
    await agregar.mutateAsync({
      id: cotizacionId,
      data: {
        tipo: 'HERRAMIENTA',
        herramientaTipoId: selected.id,
        cantidadUnidades,
        cantidadDias,
        periodo,
      },
    });
    onAdded();
  }

  return (
    <div className="space-y-3">
      <input
        className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
        placeholder="Buscar tipo de herramienta…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {herrQ.isLoading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : (
        <div className="border border-bd rounded-md max-h-64 overflow-y-auto">
          {(herrQ.data?.data ?? []).map((h) => {
            const disp = h.unidadesDisponibles ?? 0;
            const total = h.totalUnidades ?? 0;
            const isActive = selected?.id === h.id;
            const sinStock = disp === 0;
            return (
              <button
                key={h.id}
                type="button"
                disabled={sinStock}
                className={`w-full text-left px-3 py-2 border-b border-bd last:border-b-0 transition-colors ${
                  sinStock ? 'opacity-50 cursor-not-allowed' : isActive ? 'bg-accent-soft' : 'hover:bg-bg-sunken'
                }`}
                onClick={() => {
                  setSelected(h);
                  setCantidadUnidades(1);
                  setCantidadDias(1);
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-tx truncate">{h.nombre}</div>
                    <div className="font-mono text-xs text-tx-3">
                      {h.codigo} · {formatCurrency(h.tarifaDia)}/día
                    </div>
                  </div>
                  <Badge status={`${disp}/${total} disp.`} kind={sinStock ? 'danger' : 'ok'} />
                </div>
              </button>
            );
          })}
          {herrQ.data?.data.length === 0 && (
            <div className="px-3 py-4 text-sm text-tx-3 text-center">Sin tipos disponibles.</div>
          )}
        </div>
      )}

      {selected && (
        <div className="space-y-3 pt-3 border-t border-bd">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-tx-2 mb-1">Período</label>
              <select
                className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value as typeof periodo)}
              >
                {PERIODOS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-tx-2 mb-1">Cant. (máx {max})</label>
              <input
                type="number"
                min={1}
                max={max}
                className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx font-mono"
                value={cantidadUnidades}
                onChange={(e) => setCantidadUnidades(Math.max(1, Math.min(max, parseInt(e.target.value, 10) || 1)))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-tx-2 mb-1">Días</label>
              <input
                type="number"
                min={1}
                className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx font-mono"
                value={cantidadDias}
                onChange={(e) => setCantidadDias(Math.max(1, parseInt(e.target.value, 10) || 1))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-tx-2 mb-1">Subtotal</label>
              <div className="px-3 py-2 text-sm rounded-md border border-bd bg-bg-sunken text-tx font-mono font-semibold">
                {formatCurrency(
                  (Number(
                    periodo === 'DIA' ? selected.tarifaDia :
                    periodo === 'SEMANA' ? selected.tarifaSemana :
                    selected.tarifaMes,
                  ) * cantidadUnidades * cantidadDias).toFixed(2),
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-3 border-t border-bd">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors disabled:opacity-50"
          disabled={!selected || agregar.isPending || cantidadUnidades > max}
          onClick={confirmar}
        >
          <Icon name="plus" size={14} /> Agregar
        </button>
      </div>
    </div>
  );
}
