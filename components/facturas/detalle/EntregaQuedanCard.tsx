'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { useMarcarFacturaEntregada } from '@/hooks/use-facturas';
import { formatDate, hoySV } from '@/lib/utils';
import type { Factura } from '@/types/api';

interface Props {
  factura: Factura;
  // VISUALIZADOR no marca entregas — se oculta el formulario inline.
  puedeEscribir: boolean;
}

const inputBase =
  'px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors border-bd';

export function EntregaQuedanCard({ factura, puedeEscribir }: Props) {
  const marcar = useMarcarFacturaEntregada(factura.id);
  const [fechaReal, setFechaReal] = useState(hoySV());

  const yaEntregada = !!factura.fechaEntregaReal;
  const mostrarFormulario = puedeEscribir && !yaEntregada;

  return (
    <div className="bg-warn-soft border border-warn-soft rounded-md p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="receipt" size={14} className="text-warn" />
        <h3 className="text-sm font-medium text-warn">
          Entrega de factura QUEDAN
        </h3>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 text-sm mb-3">
        {factura.fechaEntregaFactura && (
          <>
            <dt className="text-tx-3">Programada</dt>
            <dd className="font-mono text-xs text-tx">
              {formatDate(factura.fechaEntregaFactura)}
            </dd>
          </>
        )}
        {factura.plazoCredito != null && (
          <>
            <dt className="text-tx-3">Plazo de crédito</dt>
            <dd className="font-mono text-xs text-tx">{factura.plazoCredito} días</dd>
          </>
        )}
        <dt className="text-tx-3">Vencimiento</dt>
        <dd className="font-mono text-xs text-tx">
          {factura.fechaVencimiento
            ? formatDate(factura.fechaVencimiento)
            : 'Se define al entregar'}
        </dd>
        {yaEntregada && (
          <>
            <dt className="text-tx-3">Entregada</dt>
            <dd className="font-mono text-xs text-tx">
              {formatDate(factura.fechaEntregaReal!)}
            </dd>
          </>
        )}
      </dl>

      {!yaEntregada && !puedeEscribir && (
        <p className="text-xs text-tx-3">
          Aún sin entregar. Solicitá a un operador que registre la entrega.
        </p>
      )}

      {mostrarFormulario && (
        <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-warn-soft">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-tx-2">
              Fecha de entrega real
            </label>
            <input
              type="date"
              value={fechaReal}
              onChange={(e) => setFechaReal(e.target.value)}
              className={inputBase}
            />
          </div>
          <button
            type="button"
            onClick={() => marcar.mutate(fechaReal)}
            disabled={marcar.isPending || !fechaReal}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50"
          >
            {marcar.isPending ? (
              <><Spinner /> Guardando…</>
            ) : (
              <><Icon name="check" size={14} /> Marcar como entregada</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
