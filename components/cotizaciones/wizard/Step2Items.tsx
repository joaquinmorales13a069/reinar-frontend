'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { useEditarItemCotizacion, useEliminarItemCotizacion } from '@/hooks/use-cotizaciones';
import { formatCurrency } from '@/lib/utils';
import { AgregarItemModal } from './AgregarItemModal';
import type { Cotizacion, CotizacionItem, EditarItemDto, PeriodoItem, TipoItemCotizacion } from '@/types/api';

const PERIODO_LABEL: Record<PeriodoItem, string> = {
  DIA: 'Día',
  SEMANA: 'Semana',
  QUINCENA: 'Quincena',
  MES: 'Mes',
  CUSTOM: 'Custom',
};

const TIPO_LABEL: Record<TipoItemCotizacion, string> = {
  EQUIPO: 'Equipo',
  HERRAMIENTA: 'Herramienta',
  SERVICIO: 'Servicio',
  CONSUMIBLE: 'Consumible',
  PIEZA_ANDAMIO: 'Andamio',
  CUSTOM: 'Custom',
};

type Props = { cotizacion: Cotizacion; onBack: () => void; onNext: () => void };

export function Step2Items({ cotizacion, onBack, onNext }: Props) {
  const [modal, setModal] = useState(false);
  const editar = useEditarItemCotizacion();
  const eliminar = useEliminarItemCotizacion();

  const items = cotizacion.items;

  function patch(item: CotizacionItem, data: EditarItemDto) {
    editar.mutate({ cotizacionId: cotizacion.id, itemId: item.id, data });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium text-tx">Ítems de la cotización</h3>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors"
          onClick={() => setModal(true)}
        >
          <Icon name="plus" size={14} /> Agregar ítem
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon="list"
          title="Sin ítems"
          message='Hacé clic en "Agregar ítem" para empezar.'
        />
      ) : (
        <div className="border border-bd rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-sunken text-2xs uppercase tracking-wider text-tx-3">
              <tr>
                <th className="text-left px-3 py-2 font-medium w-32">Tipo</th>
                <th className="text-left px-3 py-2 font-medium">Descripción</th>
                <th className="text-left px-3 py-2 font-medium w-32">Período</th>
                <th className="text-right px-3 py-2 font-medium w-24">Cant.</th>
                <th className="text-right px-3 py-2 font-medium w-32">Tarifa</th>
                <th className="text-right px-3 py-2 font-medium w-32">Subtotal</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-bd">
                  <td className="px-3 py-2">
                    <Badge status={TIPO_LABEL[it.tipo]} kind="neutral" />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full bg-transparent border-b border-transparent hover:border-bd focus:border-accent focus:outline-none text-sm"
                      defaultValue={it.descripcion}
                      onBlur={(e) => {
                        if (e.target.value !== it.descripcion) {
                          patch(it, { descripcion: e.target.value });
                        }
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="text-sm bg-transparent border-b border-transparent hover:border-bd focus:border-accent focus:outline-none"
                      defaultValue={it.periodo}
                      onChange={(e) => patch(it, { periodo: e.target.value as PeriodoItem })}
                    >
                      {(Object.keys(PERIODO_LABEL) as PeriodoItem[]).map((p) => (
                        <option key={p} value={p}>
                          {PERIODO_LABEL[p]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={1}
                      className="w-16 text-right font-mono bg-transparent border-b border-transparent hover:border-bd focus:border-accent focus:outline-none"
                      defaultValue={it.cantidad}
                      onBlur={(e) => {
                        const n = parseInt(e.target.value, 10) || 1;
                        if (n !== it.cantidad) patch(it, { cantidad: n });
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {/* Edit inline de la tarifa: si tipea algo distinto se guarda como tarifaCustom */}
                    <input
                      type="number"
                      step="0.01"
                      className="w-24 text-right font-mono bg-transparent border-b border-transparent hover:border-bd focus:border-accent focus:outline-none"
                      defaultValue={it.tarifaAplicada}
                      onBlur={(e) => {
                        const v = e.target.value;
                        if (v === '' || v === it.tarifaAplicada) return;
                        patch(it, { tarifaCustom: v });
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-medium">{formatCurrency(it.subtotal)}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center w-7 h-7 rounded text-tx-3 hover:text-danger hover:bg-danger-soft transition-colors"
                      onClick={() => eliminar.mutate({ cotizacionId: cotizacion.id, itemId: it.id })}
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-bg-sunken">
              <tr className="border-t border-bd">
                <td colSpan={5} className="text-right px-3 py-2 text-tx-2">Subtotal</td>
                <td className="text-right px-3 py-2 font-mono">{formatCurrency(cotizacion.subtotal)}</td>
                <td />
              </tr>
              <tr>
                <td colSpan={5} className="text-right px-3 py-2 text-tx-2">
                  IVA ({cotizacion.porcentajeIva}%)
                </td>
                <td className="text-right px-3 py-2 font-mono">{formatCurrency(cotizacion.montoIva)}</td>
                <td />
              </tr>
              <tr>
                <td colSpan={5} className="text-right px-3 py-2 font-semibold">Total</td>
                <td className="text-right px-3 py-2 font-mono font-bold text-base">{formatCurrency(cotizacion.total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="flex justify-between gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-tx-2 border border-bd hover:bg-bg-sunken transition-colors"
          onClick={onBack}
        >
          <Icon name="arrowLeft" size={14} /> Anterior
        </button>
        <button
          type="button"
          disabled={items.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors disabled:opacity-50"
          onClick={onNext}
        >
          Siguiente <Icon name="arrowRight" size={14} />
        </button>
      </div>

      {modal && (
        <AgregarItemModal
          cotizacionId={cotizacion.id}
          onClose={() => setModal(false)}
        />
      )}
    </div>
  );
}
