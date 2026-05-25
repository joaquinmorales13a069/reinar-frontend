'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useEquipos } from '@/hooks/use-equipos';
import { useAgregarItemCotizacion } from '@/hooks/use-cotizaciones';
import { formatCurrency } from '@/lib/utils';
import type { Equipo, PeriodoItem } from '@/types/api';
import type { TabChildProps } from './index';

// QUINCENA se omite porque la base de datos solo tiene tarifaDia/Semana/Mes;
// el backend la calcularia como semana*2, que rara vez es la tarifa real.
const PERIODOS: { value: Exclude<PeriodoItem, 'CUSTOM' | 'QUINCENA'>; label: string }[] = [
  { value: 'DIA',    label: 'Día' },
  { value: 'SEMANA', label: 'Semana' },
  { value: 'MES',    label: 'Mes' },
];

export function TabEquipo({ cotizacionId, onAdded }: TabChildProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Equipo | null>(null);
  const [periodo, setPeriodo] = useState<Exclude<PeriodoItem, 'CUSTOM' | 'QUINCENA'>>('DIA');

  // Solo equipos DISPONIBLES — el backend rechaza con 409 si se intenta uno rentado.
  const equiposQ = useEquipos({ search: search || undefined, estado: 'DISPONIBLE', limit: 20 });
  const agregar = useAgregarItemCotizacion();

  const isMutating = agregar.isPending;

  // Cada Equipo es una unidad fisica unica (un codigo). Para mas de uno se
  // agregan lineas separadas, por eso aqui no hay input de cantidad.
  async function confirmar() {
    if (!selected) return;
    await agregar.mutateAsync({
      id: cotizacionId,
      data: { tipo: 'EQUIPO', equipoId: selected.id, periodo },
    });
    onAdded();
  }

  return (
    <div className="space-y-3">
      <input
        className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
        placeholder="Buscar equipo…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {equiposQ.isLoading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : (
        <div className="border border-bd rounded-md max-h-64 overflow-y-auto">
          {(equiposQ.data?.data ?? []).map((e) => {
            const isActive = selected?.id === e.id;
            return (
              <button
                key={e.id}
                type="button"
                className={`w-full text-left px-3 py-2 border-b border-bd last:border-b-0 transition-colors ${
                  isActive ? 'bg-accent-soft' : 'hover:bg-bg-sunken'
                }`}
                onClick={() => setSelected(e)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-tx">{e.nombre}</div>
                    <div className="font-mono text-xs text-tx-3">
                      {e.codigo} · {formatCurrency(e.tarifaDia)}/día
                    </div>
                  </div>
                  <Badge status="Disponible" kind="ok" />
                </div>
              </button>
            );
          })}
          {equiposQ.data?.data.length === 0 && (
            <div className="px-3 py-4 text-sm text-tx-3 text-center">Sin equipos disponibles.</div>
          )}
        </div>
      )}

      {selected && (
        <div className="space-y-3 pt-3 border-t border-bd">
          <p className="text-xs text-tx-3">
            Cada equipo se agrega como una unidad. Para mas de uno, agregue otro equipo como linea separada.
          </p>
          <div className="grid grid-cols-2 gap-3">
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
              <label className="block text-xs font-medium text-tx-2 mb-1">Tarifa</label>
              <div className="px-3 py-2 text-sm rounded-md border border-bd bg-bg-sunken text-tx font-mono">
                {formatCurrency(
                  periodo === 'DIA' ? selected.tarifaDia :
                  periodo === 'SEMANA' ? selected.tarifaSemana :
                  selected.tarifaMes,
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
          disabled={!selected || isMutating}
          onClick={confirmar}
        >
          <Icon name="plus" size={14} /> Agregar
        </button>
      </div>
    </div>
  );
}
