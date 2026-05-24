'use client';

import { TRANSICIONES_PROYECTO, esEstadoTerminal } from '@/lib/proyectos';
import type { EstadoProyecto } from '@/types/api';

type Props = {
  estadoActual: EstadoProyecto;
  // Si el control es read-only (estado terminal o usuario sin permisos),
  // pasamos onChange undefined y el componente lo refleja visualmente.
  onChange?: (siguiente: EstadoProyecto) => void;
  disabled?: boolean;
};

const TODOS_ESTADOS: EstadoProyecto[] = ['ACTIVO', 'PAUSADO', 'COMPLETADO', 'CANCELADO'];

const KIND_TEXT: Record<EstadoProyecto, string> = {
  ACTIVO:     'text-ok',
  PAUSADO:    'text-warn',
  COMPLETADO: 'text-info',
  CANCELADO:  'text-tx-3',
};

export function EstadoProyectoSelector({ estadoActual, onChange, disabled }: Props) {
  const terminal = esEstadoTerminal(estadoActual);
  const transicionesValidas = TRANSICIONES_PROYECTO[estadoActual];
  const readOnly = terminal || disabled || !onChange;

  return (
    <div>
      <div className="inline-flex flex-wrap gap-1 p-1 rounded-md border border-bd bg-bg">
        {TODOS_ESTADOS.map((e) => {
          const esActual = e === estadoActual;
          const habilitado = !readOnly && (esActual || transicionesValidas.includes(e));
          const activeCls = esActual
            ? 'bg-accent text-navy font-semibold'
            : habilitado
              ? `${KIND_TEXT[e]} hover:bg-bg-sunken`
              : 'text-tx-3 opacity-50 cursor-not-allowed';
          return (
            <button
              key={e}
              type="button"
              disabled={!habilitado || esActual}
              className={`px-3 py-1.5 rounded-sm text-xs transition-colors ${activeCls}`}
              onClick={() => habilitado && !esActual && onChange && onChange(e)}
            >
              {e}
            </button>
          );
        })}
      </div>
      {terminal && (
        <p className="text-xs text-tx-3 mt-2">
          Estado final: no se puede cambiar.
        </p>
      )}
    </div>
  );
}
