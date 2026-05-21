'use client';

import { useState } from 'react';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { useCambiarEstadoUnidad } from '@/hooks/use-herramientas';
import { ESTADO_HERRAMIENTA_LABEL } from '@/lib/herramientas';
import type { EstadoHerramienta, EstadoUnidadEditable } from '@/types/api';

const ESTADOS_EDITABLES: EstadoUnidadEditable[] = [
  'DISPONIBLE',
  'MANTENIMIENTO',
  'USO_INTERNO',
  'INACTIVO',
];

type Props = {
  unidadId: string;
  tipoId: string;
  estadoActual: EstadoHerramienta;
};

export function UnidadEstadoSelector({ unidadId, tipoId, estadoActual }: Props) {
  const cambiar = useCambiarEstadoUnidad();
  const [confirmEstado, setConfirmEstado] = useState<EstadoUnidadEditable | null>(null);

  // RESERVADA y RENTADA no se ofrecen como opción — los gestiona el sistema
  // (reservas/cotizaciones/actas). Mostramos un aviso en lugar del selector.
  if (estadoActual === 'RESERVADA' || estadoActual === 'RENTADA') {
    return (
      <p className="text-sm text-tx-2">
        Este estado lo gestionan automáticamente cotizaciones y actas. No se puede modificar manualmente.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs text-tx-3 mr-1">Cambiar estado:</span>
        {ESTADOS_EDITABLES.map((e) => (
          <button
            key={e}
            type="button"
            disabled={estadoActual === e}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors ${
              estadoActual === e
                ? 'border-bd bg-bg-sunken text-tx-3 cursor-not-allowed'
                : 'border-bd text-tx-2 hover:bg-bg-sunken'
            }`}
            onClick={() => setConfirmEstado(e)}
          >
            {ESTADO_HERRAMIENTA_LABEL[e]}
          </button>
        ))}
      </div>

      {confirmEstado && (
        <div className="mt-3">
          <ConfirmRow
            message={
              <>
                ¿Cambiar el estado de esta unidad a <b>{ESTADO_HERRAMIENTA_LABEL[confirmEstado]}</b>?
              </>
            }
            onCancel={() => setConfirmEstado(null)}
            onConfirm={() => {
              cambiar.mutate({ unidadId, tipoId, estado: confirmEstado });
              setConfirmEstado(null);
            }}
            confirmLabel="Sí, cambiar"
            variant="primary"
          />
        </div>
      )}
    </>
  );
}
