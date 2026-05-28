'use client';

import { useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';

type Props = {
  title: string;
  resumen: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

/**
 * Card educativa colapsable para listar casos de uso de un módulo de negocio
 * — sirve para entrenar al equipo de Reinar sobre cuándo aplicar acciones
 * fiscales (NC, retenciones) sin tener que consultar documentación externa.
 */
export function CuandoUsarCard({ title, resumen, children, defaultOpen = false }: Props) {
  const [abierto, setAbierto] = useState(defaultOpen);

  return (
    <div className="rounded-md border border-info-soft bg-info-soft mb-4">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-start gap-3 p-3 text-left"
        aria-expanded={abierto}
      >
        <span className="shrink-0 mt-0.5 text-info">
          <Icon name="info" size={18} />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold text-tx">{title}</span>
          <span className="block text-xs text-tx-2 mt-0.5">{resumen}</span>
        </span>
        <span
          className={`shrink-0 mt-0.5 text-tx-3 transition-transform ${abierto ? 'rotate-180' : ''}`}
        >
          <Icon name="chevronDown" size={16} />
        </span>
      </button>
      {abierto && (
        <div className="px-4 pb-4 pt-0 text-sm text-tx-2 leading-relaxed border-t border-info-soft">
          {children}
        </div>
      )}
    </div>
  );
}
