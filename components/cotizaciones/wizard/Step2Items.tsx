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

// Periodos seleccionables en el dropdown. QUINCENA se omite porque en la base
// de datos solo hay tarifaDia/tarifaSemana/tarifaMes — el backend calcularia
// quincena como semana*2, que rara vez es la tarifa real que el cliente quiere.
// QUINCENA se conserva en PERIODO_LABEL para items historicos que ya la tengan.
const PERIODOS_SELECCIONABLES: PeriodoItem[] = ['DIA', 'SEMANA', 'MES', 'CUSTOM'];

// Color por tipo para que la tabla sea escaneable de un vistazo. Cada tipo
// tiene un kind distinto del Badge para que el vendedor distinga sin leer
// la etiqueta.
const TIPO_KIND: Record<TipoItemCotizacion, 'ok' | 'warn' | 'danger' | 'info' | 'neutral' | 'accent'> = {
  EQUIPO:        'info',
  HERRAMIENTA:   'ok',
  SERVICIO:      'accent',
  CONSUMIBLE:    'neutral',
  PIEZA_ANDAMIO: 'warn',
  CUSTOM:        'danger',
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
  // itemId -> label tentativo cuando el usuario acaba de cambiar el dropdown
  // a CUSTOM pero todavia no escribio el label. Mientras esta en el map, NO
  // hacemos PATCH (el backend rechaza con "Datos invalidos" si periodo=CUSTOM
  // viene sin periodoCustomLabel). El item se commitea recien al primer blur
  // del input de label con valor no vacio.
  const [customPendiente, setCustomPendiente] = useState<Record<string, true>>({});
  const editar = useEditarItemCotizacion();
  const eliminar = useEliminarItemCotizacion();

  // Fallback a [] porque el backend POST /cotizaciones devuelve los escalares
  // sin la relacion items; el seed inicial puede llegar sin el campo si en
  // algun edge case se hidrata con la respuesta cruda del create.
  const items = cotizacion.items ?? [];

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
                <th className="text-right px-3 py-2 font-medium w-20">Cant.</th>
                <th className="text-right px-3 py-2 font-medium w-20">Días</th>
                <th className="text-right px-3 py-2 font-medium w-32">Tarifa</th>
                <th className="text-right px-3 py-2 font-medium w-32">Subtotal</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-bd">
                  <td className="px-3 py-2">
                    <Badge status={TIPO_LABEL[it.tipo]} kind={TIPO_KIND[it.tipo]} />
                  </td>
                  <td className="px-3 py-2">
                    {/* key incluye el valor del cache para que cuando el backend
                        actualice el item (ej. recalculo de tarifa al cambiar
                        periodo), el input uncontrolled se remonte con el nuevo
                        defaultValue. Sin esto el input quedaba stale mostrando
                        el valor que el usuario tipeo o el inicial. */}
                    <input
                      key={`desc-${it.id}-${it.descripcion}`}
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
                    {/* Consumibles se venden por unidad, no por período de renta;
                        el campo periodo en BD se conserva con su default DIA pero
                        no se ofrece como editable porque el concepto no aplica. */}
                    {it.tipo === 'CONSUMIBLE' ? (
                      <span className="text-xs text-tx-3">—</span>
                    ) : (
                    <div className="flex flex-col gap-1">
                      <select
                        key={`per-${it.id}-${it.periodo}`}
                        className="text-sm bg-transparent border-b border-transparent hover:border-bd focus:border-accent focus:outline-none"
                        defaultValue={it.periodo}
                        onChange={(e) => {
                          const nuevo = e.target.value as PeriodoItem;
                          if (nuevo === 'CUSTOM') {
                            // El backend exige periodoCustomLabel + tarifaCustom
                            // cuando periodo=CUSTOM. No hacemos PATCH todavia;
                            // marcamos como pendiente para que aparezca el input
                            // de label y se commiteen los 3 campos juntos al blur.
                            setCustomPendiente((m) => ({ ...m, [it.id]: true }));
                          } else {
                            setCustomPendiente((m) => {
                              const { [it.id]: _omit, ...rest } = m;
                              return rest;
                            });
                            patch(it, { periodo: nuevo });
                          }
                        }}
                      >
                        {PERIODOS_SELECCIONABLES.map((p) => (
                          <option key={p} value={p}>
                            {PERIODO_LABEL[p]}
                          </option>
                        ))}
                        {/* Si el item ya tiene QUINCENA persistida (historico), la incluimos
                            como opcion para no perderla al editar otro campo. */}
                        {it.periodo === 'QUINCENA' && (
                          <option value="QUINCENA">{PERIODO_LABEL.QUINCENA}</option>
                        )}
                      </select>

                      {(it.periodo === 'CUSTOM' || customPendiente[it.id]) && (
                        <input
                          key={`per-label-${it.id}-${it.periodoCustomLabel ?? ''}`}
                          type="text"
                          placeholder="Etiqueta (ej. 2 semanas)"
                          autoFocus={!!customPendiente[it.id]}
                          defaultValue={it.periodoCustomLabel ?? ''}
                          className="w-32 text-xs bg-transparent border-b border-bd hover:border-accent focus:border-accent focus:outline-none"
                          onBlur={(e) => {
                            const label = e.target.value.trim();
                            // Sin label no podemos commitear: dejamos el estado
                            // pendiente para que el usuario lo complete o cambie
                            // el periodo a otro valor.
                            if (!label) return;
                            // Idempotente: si ya estaba en CUSTOM con el mismo label,
                            // no hace falta volver a llamar al backend.
                            if (it.periodo === 'CUSTOM' && label === it.periodoCustomLabel) return;
                            setCustomPendiente((m) => {
                              const { [it.id]: _omit, ...rest } = m;
                              return rest;
                            });
                            patch(it, {
                              periodo: 'CUSTOM',
                              periodoCustomLabel: label,
                              // Backend exige tarifaCustom no nula cuando periodo=CUSTOM.
                              // Usamos la tarifa visible actual como punto de partida; el
                              // usuario puede ajustarla despues en el input de tarifa.
                              tarifaCustom: it.tarifaAplicada,
                            });
                          }}
                        />
                      )}
                    </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {it.tipo === 'EQUIPO' ? (
                      // EQUIPO siempre es cantidadUnidades 1 (unidad fisica unica). El
                      // backend rechaza cualquier otro valor; el input se muestra
                      // como texto fijo para que sea evidente.
                      <span
                        className="font-mono text-tx-3 cursor-not-allowed"
                        title="Cada equipo es una unidad. Agregue otro equipo como linea separada."
                      >
                        {it.cantidadUnidades}
                      </span>
                    ) : (
                      <input
                        key={`cant-${it.id}-${it.cantidadUnidades}`}
                        type="number"
                        min={1}
                        className="w-16 text-right font-mono bg-transparent border-b border-transparent hover:border-bd focus:border-accent focus:outline-none"
                        defaultValue={it.cantidadUnidades}
                        onBlur={(e) => {
                          const n = parseInt(e.target.value, 10) || 1;
                          if (n !== it.cantidadUnidades) patch(it, { cantidadUnidades: n });
                        }}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {/* SERVICIO/CONSUMIBLE no se rentan por dias — el backend rechaza
                        cualquier valor distinto de 1, asi que mostramos solo el guion. */}
                    {it.tipo === 'SERVICIO' || it.tipo === 'CONSUMIBLE' ? (
                      <span className="text-xs text-tx-3">—</span>
                    ) : (
                      <input
                        key={`dias-${it.id}-${it.cantidadDias}`}
                        type="number"
                        min={1}
                        className="w-16 text-right font-mono bg-transparent border-b border-transparent hover:border-bd focus:border-accent focus:outline-none"
                        defaultValue={it.cantidadDias}
                        onBlur={(e) => {
                          const n = parseInt(e.target.value, 10) || 1;
                          if (n !== it.cantidadDias) patch(it, { cantidadDias: n });
                        }}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {/* Edit inline de la tarifa: si tipea algo distinto se guarda como tarifaCustom.
                        Usamos type="text" + inputMode="decimal" porque type="number" en algunos
                        navegadores acepta letras y deja .value vacío; validamos onBlur con regex
                        y revertimos si el valor no es un decimal válido. */}
                    <input
                      key={`tar-${it.id}-${it.tarifaAplicada}`}
                      type="text"
                      inputMode="decimal"
                      className="w-24 text-right font-mono bg-transparent border-b border-transparent hover:border-bd focus:border-accent focus:outline-none"
                      defaultValue={it.tarifaAplicada}
                      onKeyDown={(e) => {
                        // Permitimos teclas de control (Backspace, flechas, Tab, etc.); rechazamos
                        // cualquier caracter que no sea digito o el punto decimal.
                        if (e.key.length === 1 && !/[0-9.]/.test(e.key)) e.preventDefault();
                      }}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v === it.tarifaAplicada) return;
                        if (!/^\d+(\.\d{1,2})?$/.test(v)) {
                          // Valor invalido: revertimos visualmente y no enviamos PATCH.
                          e.target.value = it.tarifaAplicada;
                          return;
                        }
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
                <td colSpan={6} className="text-right px-3 py-2 text-tx-2">Subtotal</td>
                <td className="text-right px-3 py-2 font-mono">{formatCurrency(cotizacion.subtotal)}</td>
                <td />
              </tr>
              <tr>
                <td colSpan={6} className="text-right px-3 py-2 text-tx-2">
                  IVA ({cotizacion.porcentajeIva}%)
                </td>
                <td className="text-right px-3 py-2 font-mono">{formatCurrency(cotizacion.montoIva)}</td>
                <td />
              </tr>
              <tr>
                <td colSpan={6} className="text-right px-3 py-2 font-semibold">Total</td>
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
