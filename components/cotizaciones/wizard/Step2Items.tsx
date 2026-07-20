'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { useEditarItemCotizacion, useEliminarItemCotizacion } from '@/hooks/use-cotizaciones';
import { formatCurrency } from '@/lib/utils';
import { AgregarItemModal } from './AgregarItemModal';
import type { Cotizacion, CotizacionItem, EditarItemDto, PeriodoItem, TipoItemCotizacion } from '@/types/api';

// Mismo criterio que el backend: tarifa DIA/CUSTOM multiplica por dias;
// SEMANA/QUINCENA/MES son bloques planos. Necesario para el preview local
// mientras el operador tipea — el subtotal "real" lo confirma el backend
// al hacer blur.
function previewSubtotal(tarifa: number, unidades: number, dias: number, periodo: PeriodoItem): number {
  const base = tarifa * unidades;
  return periodo === 'DIA' || periodo === 'CUSTOM' ? base * dias : base;
}

const PERIODO_LABEL: Record<PeriodoItem, string> = {
  DIA: 'Día',
  SEMANA: 'Semana',
  QUINCENA: 'Quincena',
  MES: 'Mes',
  CUSTOM: 'Custom',
};

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

// Duplicado intencionalmente (mismo patrón que los hooks use-*.ts): extrae
// el mensaje de error del backend para mostrarlo inline bajo el input de
// cantidad cuando el código es CANTIDAD_EXCEDE_ORIGEN.
function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

function extractErrorCode(err: unknown): string | undefined {
  const anyErr = err as { response?: { data?: { error?: { code?: string } } } };
  return anyErr?.response?.data?.error?.code;
}

// Sub-componente por fila para mantener estado local de los inputs editables.
// El subtotal mostrado se calcula localmente con previewSubtotal mientras el
// usuario tipea, y se reemplaza con el valor del backend cuando el cache se
// actualiza tras el blur/PATCH. Sin esto el subtotal solo cambiaba al perder
// foco — UX confusa para el operador.
function ItemRow({
  it,
  cotizacionId,
  onDelete,
}: {
  it: CotizacionItem;
  cotizacionId: string;
  onDelete: (itemId: string) => void;
}) {
  const [unidades, setUnidades] = useState(String(it.cantidadUnidades));
  const [dias, setDias]         = useState(String(it.cantidadDias));
  const [tarifa, setTarifa]     = useState(String(it.tarifaAplicada));
  // Error de negocio (CANTIDAD_EXCEDE_ORIGEN) del último intento de subir la
  // cantidad de un ítem renovado. Se limpia apenas el operador vuelve a
  // tipear (onChange) — un error pegado tras corregir el valor confundiría
  // más que no mostrarlo.
  const [errorCantidad, setErrorCantidad] = useState<string | null>(null);

  // Cuando el backend confirma un cambio, los valores en `it` cambian; resync
  // los inputs locales si difieren (evita que el operador vea su valor stale
  // tras una mutacion exitosa).
  useEffect(() => { setUnidades(String(it.cantidadUnidades)); }, [it.cantidadUnidades]);
  useEffect(() => { setDias(String(it.cantidadDias)); },         [it.cantidadDias]);
  useEffect(() => { setTarifa(String(it.tarifaAplicada)); },     [it.tarifaAplicada]);

  // Dos observers de mutación por fila, no uno solo ni uno compartido entre
  // filas. MutationObserver guarda un único #mutateOptions por instancia y
  // desconecta la mutación anterior en vuelo al volver a llamar mutate(),
  // así que el callback por-llamada de la mutación vieja nunca corre. La
  // cantidad es el único campo cuyo error se muestra inline (depende de ese
  // callback), así que va en su propio observer: editar días o tarifa
  // mientras el PATCH de cantidad sigue en vuelo ya no se lo lleva puesto.
  const editar = useEditarItemCotizacion();
  const editarCantidad = useEditarItemCotizacion();

  function patch(data: EditarItemDto) {
    editar.mutate({ cotizacionId, itemId: it.id, data });
  }

  function patchCantidad(n: number, opts: { onError: (msg: string) => void; onSuccess: () => void }) {
    editarCantidad.mutate(
      { cotizacionId, itemId: it.id, data: { cantidadUnidades: n } },
      {
        onSuccess: opts.onSuccess,
        // El hook ya toastea el resto de errores; acá solo capturamos
        // CANTIDAD_EXCEDE_ORIGEN para mostrarlo inline en la fila.
        onError: (err) => {
          if (extractErrorCode(err) === 'CANTIDAD_EXCEDE_ORIGEN') {
            opts.onError(extractErrorMessage(err, 'No se pudo actualizar la cantidad.'));
          }
        },
      },
    );
  }

  const unidadesN = parseInt(unidades, 10);
  const diasN     = parseInt(dias, 10);
  const tarifaN   = parseFloat(tarifa);
  const subtotalPreview =
    Number.isFinite(unidadesN) && Number.isFinite(diasN) && Number.isFinite(tarifaN)
      ? previewSubtotal(tarifaN, Math.max(1, unidadesN), Math.max(1, diasN), it.periodo)
      : Number(it.subtotal);

  return (
    <tr className="border-t border-bd">
      <td className="px-3 py-2">
        <Badge status={TIPO_LABEL[it.tipo]} kind={TIPO_KIND[it.tipo]} />
      </td>
      <td className="px-3 py-2">
        <input
          key={`desc-${it.id}-${it.descripcion}`}
          className="w-full bg-transparent border-b border-transparent hover:border-bd focus:border-accent focus:outline-none text-sm"
          defaultValue={it.descripcion}
          onBlur={(e) => {
            if (e.target.value !== it.descripcion) patch({ descripcion: e.target.value });
          }}
        />
        {it.cotizacionItemOrigenId && (
          <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-bg-sunken text-tx-3">
            <Icon name="refresh" size={10} /> Renovado
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        {it.tipo === 'CONSUMIBLE' ? (
          <span className="text-xs text-tx-3">—</span>
        ) : (
          <span className="text-sm text-tx">
            {PERIODO_LABEL[it.periodo] ?? it.periodo}
            {it.periodo === 'CUSTOM' && it.periodoCustomLabel && (
              <span className="text-tx-3"> · {it.periodoCustomLabel}</span>
            )}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {it.tipo === 'EQUIPO' ? (
          <span
            className="font-mono text-tx-3 cursor-not-allowed"
            title="Cada equipo es una unidad. Agregue otro equipo como linea separada."
          >
            {it.cantidadUnidades}
          </span>
        ) : (
          <input
            type="number"
            min={1}
            className="w-16 text-right font-mono bg-transparent border-b border-transparent hover:border-bd focus:border-accent focus:outline-none"
            value={unidades}
            onChange={(e) => {
              setUnidades(e.target.value);
              setErrorCantidad(null);
            }}
            onBlur={() => {
              const n = parseInt(unidades, 10) || 1;
              if (n !== it.cantidadUnidades) {
                patchCantidad(n, {
                  onSuccess: () => setErrorCantidad(null),
                  onError: setErrorCantidad,
                });
              } else {
                setUnidades(String(it.cantidadUnidades));
              }
            }}
          />
        )}
        {errorCantidad && <p className="text-xs text-danger mt-1">{errorCantidad}</p>}
      </td>
      <td className="px-3 py-2 text-right">
        {it.tipo === 'SERVICIO' || it.tipo === 'CONSUMIBLE' ? (
          <span className="text-xs text-tx-3">—</span>
        ) : (
          <input
            type="number"
            min={1}
            className="w-16 text-right font-mono bg-transparent border-b border-transparent hover:border-bd focus:border-accent focus:outline-none"
            value={dias}
            onChange={(e) => setDias(e.target.value)}
            onBlur={() => {
              const n = parseInt(dias, 10) || 1;
              if (n !== it.cantidadDias) patch({ cantidadDias: n });
              else setDias(String(it.cantidadDias));
            }}
          />
        )}
      </td>
      <td className="px-3 py-2 text-right font-mono">
        <input
          type="text"
          inputMode="decimal"
          className="w-24 text-right font-mono bg-transparent border-b border-transparent hover:border-bd focus:border-accent focus:outline-none"
          value={tarifa}
          onChange={(e) => setTarifa(e.target.value)}
          onKeyDown={(e) => {
            if (e.key.length === 1 && !/[0-9.]/.test(e.key)) e.preventDefault();
          }}
          onBlur={() => {
            const v = tarifa.trim();
            if (v === String(it.tarifaAplicada)) return;
            if (!/^\d+(\.\d{1,2})?$/.test(v)) {
              setTarifa(String(it.tarifaAplicada));
              return;
            }
            patch({ tarifaCustom: v });
          }}
        />
      </td>
      <td className="px-3 py-2 text-right font-mono font-medium">{formatCurrency(subtotalPreview)}</td>
      <td className="px-3 py-2">
        <button
          type="button"
          className="inline-flex items-center justify-center w-7 h-7 rounded text-tx-3 hover:text-danger hover:bg-danger-soft transition-colors"
          onClick={() => onDelete(it.id)}
        >
          <Icon name="trash" size={13} />
        </button>
      </td>
    </tr>
  );
}

type Props = { cotizacion: Cotizacion; onBack: () => void; onNext: () => void };

export function Step2Items({ cotizacion, onBack, onNext }: Props) {
  const [modal, setModal] = useState(false);
  const eliminar = useEliminarItemCotizacion();

  // Fallback a [] porque el backend POST /cotizaciones devuelve los escalares
  // sin la relacion items; el seed inicial puede llegar sin el campo si en
  // algun edge case se hidrata con la respuesta cruda del create.
  const items = cotizacion.items ?? [];

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
                <th className="text-left px-3 py-2 font-medium w-32">Tarifa</th>
                <th className="text-right px-3 py-2 font-medium w-20">Cant.</th>
                <th className="text-right px-3 py-2 font-medium w-20">Días</th>
                <th className="text-right px-3 py-2 font-medium w-32">Tarifa</th>
                <th className="text-right px-3 py-2 font-medium w-32">Subtotal</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <ItemRow
                  key={it.id}
                  it={it}
                  cotizacionId={cotizacion.id}
                  onDelete={(id) => eliminar.mutate({ cotizacionId: cotizacion.id, itemId: id })}
                />
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
