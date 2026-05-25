'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { usePiezas, useCuerpos } from '@/hooks/use-andamios';
import { useAgregarItemCotizacion } from '@/hooks/use-cotizaciones';
import { formatCurrency } from '@/lib/utils';
import type { PiezaTipo, CuerpoTipo, PeriodoItem } from '@/types/api';
import type { TabChildProps } from './index';

const PERIODOS: { value: Exclude<PeriodoItem, 'CUSTOM'>; label: string }[] = [
  { value: 'DIA',      label: 'Día' },
  { value: 'SEMANA',   label: 'Semana' },
  { value: 'QUINCENA', label: 'Quincena' },
  { value: 'MES',      label: 'Mes' },
];

type Modo = 'pieza' | 'cuerpo';

export function TabAndamio({ cotizacionId, onAdded }: TabChildProps) {
  const [modo, setModo] = useState<Modo>('pieza');
  const [periodo, setPeriodo] = useState<Exclude<PeriodoItem, 'CUSTOM'>>('DIA');
  const [cantidad, setCantidad] = useState(1);
  const [piezaSel, setPiezaSel] = useState<PiezaTipo | null>(null);
  const [cuerpoSel, setCuerpoSel] = useState<CuerpoTipo | null>(null);

  const piezasQ = usePiezas({});
  const cuerposQ = useCuerpos({});
  const agregar = useAgregarItemCotizacion();

  function tarifaPieza(p: PiezaTipo, per: Exclude<PeriodoItem, 'CUSTOM'>): string {
    if (per === 'DIA') return p.tarifaDia;
    if (per === 'SEMANA') return p.tarifaSemana;
    if (per === 'MES') return p.tarifaMes;
    return p.tarifaSemana; // QUINCENA — backend recalcula = 2 * semana
  }

  async function confirmarPieza() {
    if (!piezaSel) return;
    await agregar.mutateAsync({
      id: cotizacionId,
      data: { tipo: 'PIEZA_ANDAMIO', piezaTipoId: piezaSel.id, cantidad, periodo },
    });
    onAdded();
  }

  // Cuerpo: agregamos secuencialmente cada pieza con su cantidad expandida.
  // Si una falla a mitad, abortamos y notificamos — los items previos quedan
  // en el borrador y el usuario decide si limpiarlos.
  async function confirmarCuerpo() {
    if (!cuerpoSel) return;
    let ok = 0;
    const total = cuerpoSel.componentes.length;
    for (const comp of cuerpoSel.componentes) {
      try {
        await agregar.mutateAsync({
          id: cotizacionId,
          data: {
            tipo: 'PIEZA_ANDAMIO',
            piezaTipoId: comp.piezaTipo.id,
            cantidad: comp.cantidad * cantidad,
            periodo,
            descripcion: `[Cuerpo: ${cuerpoSel.nombre}] ${comp.piezaTipo.nombre}`,
          },
        });
        ok++;
      } catch {
        toast.error(`Se agregaron ${ok} de ${total} piezas. Revisar antes de continuar.`);
        onAdded();
        return;
      }
    }
    onAdded();
  }

  return (
    <div className="space-y-3">
      <div className="inline-flex gap-1 p-1 bg-bg-sunken rounded-md">
        {(['pieza', 'cuerpo'] as Modo[]).map((m) => (
          <button
            key={m}
            type="button"
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              modo === m ? 'bg-bg text-tx font-medium shadow-sm' : 'text-tx-2 hover:text-tx'
            }`}
            onClick={() => {
              setModo(m);
              setPiezaSel(null);
              setCuerpoSel(null);
            }}
          >
            {m === 'pieza' ? 'Por pieza' : 'Por cuerpo'}
          </button>
        ))}
      </div>

      {modo === 'pieza' && (
        <>
          {piezasQ.isLoading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : (
            <div className="border border-bd rounded-md max-h-64 overflow-y-auto">
              {(piezasQ.data ?? []).map((p) => {
                const isActive = piezaSel?.id === p.id;
                const bajo = p.stockActual <= p.stockMinimo;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`w-full text-left px-3 py-2 border-b border-bd last:border-b-0 transition-colors ${
                      isActive ? 'bg-accent-soft' : 'hover:bg-bg-sunken'
                    }`}
                    onClick={() => setPiezaSel(p)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-tx">{p.nombre}</div>
                        <div className="font-mono text-xs text-tx-3">{formatCurrency(p.tarifaDia)}/día</div>
                      </div>
                      <Badge status={`Stock ${p.stockActual}`} kind={bajo ? 'warn' : 'ok'} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {piezaSel && (
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-bd">
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
                <label className="block text-xs font-medium text-tx-2 mb-1">Tarifa</label>
                <div className="px-3 py-2 text-sm rounded-md border border-bd bg-bg-sunken text-tx font-mono">
                  {formatCurrency(tarifaPieza(piezaSel, periodo))}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-bd">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors disabled:opacity-50"
              disabled={!piezaSel || agregar.isPending}
              onClick={confirmarPieza}
            >
              <Icon name="plus" size={14} /> Agregar
            </button>
          </div>
        </>
      )}

      {modo === 'cuerpo' && (
        <>
          {cuerposQ.isLoading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : (
            <div className="border border-bd rounded-md max-h-64 overflow-y-auto">
              {(cuerposQ.data ?? []).map((c) => {
                const isActive = cuerpoSel?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`w-full text-left px-3 py-2 border-b border-bd last:border-b-0 transition-colors ${
                      isActive ? 'bg-accent-soft' : 'hover:bg-bg-sunken'
                    }`}
                    onClick={() => setCuerpoSel(c)}
                  >
                    <div className="text-sm font-medium text-tx">{c.nombre}</div>
                    <div className="text-xs text-tx-3">
                      {c.componentes.length} tipos · stock: {c.stockCuerposDisponibles}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {cuerpoSel && (
            <div className="space-y-3 pt-3 border-t border-bd">
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
                  <label className="block text-xs font-medium text-tx-2 mb-1">Cantidad de cuerpos</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx font-mono"
                    value={cantidad}
                    onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  />
                </div>
              </div>

              <div className="border border-bd rounded-md">
                <div className="px-3 py-2 bg-bg-sunken text-xs text-tx-3 uppercase tracking-wider border-b border-bd">
                  Piezas que se agregarán ({cuerpoSel.componentes.length})
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {cuerpoSel.componentes.map((c) => (
                      <tr key={c.id} className="border-t border-bd first:border-t-0">
                        <td className="px-3 py-1.5">{c.piezaTipo.nombre}</td>
                        <td className="px-3 py-1.5 text-right font-mono">×{c.cantidad}</td>
                        <td className="px-3 py-1.5 text-right font-mono font-medium">
                          {c.cantidad * cantidad} u.
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-bd">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors disabled:opacity-50"
              disabled={!cuerpoSel || agregar.isPending}
              onClick={confirmarCuerpo}
            >
              <Icon name="plus" size={14} /> Agregar cuerpo
            </button>
          </div>
        </>
      )}
    </div>
  );
}
