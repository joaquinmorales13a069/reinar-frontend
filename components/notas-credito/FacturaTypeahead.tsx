'use client';

import { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { formatCurrency } from '@/lib/utils';
import type { FacturaListItem } from '@/types/api';

type Props = {
  facturas: FacturaListItem[];
  // El selector debe respetar reglas distintas para NC vs retenciones.
  // Pasamos el predicado desde el consumidor para no acoplar este componente
  // a las reglas de un modulo especifico.
  filter?: (f: FacturaListItem) => boolean;
  hint?: string;
  totalSinFiltrar?: number;
  onSelect: (f: FacturaListItem) => void;
};

function nombreCliente(c: FacturaListItem['cliente']): string {
  return c.razonSocial || `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim() || '—';
}

export function FacturaTypeahead({ facturas, filter, hint, totalSinFiltrar, onSelect }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const elegibles = useMemo(
    () => (filter ? facturas.filter(filter) : facturas),
    [facturas, filter],
  );

  const resultados = useMemo(() => {
    const base = q
      ? elegibles.filter((f) => {
          const txt = q.toLowerCase();
          const nom = nombreCliente(f.cliente).toLowerCase();
          return f.numeroFactura.toLowerCase().includes(txt) || nom.includes(txt);
        })
      : elegibles;
    return base.slice(0, 8);
  }, [elegibles, q]);

  const truncado =
    typeof totalSinFiltrar === 'number' && totalSinFiltrar > facturas.length;

  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-tx-3">
        <Icon name="search" size={14} />
      </div>
      <input
        className="w-full pl-9 pr-3 py-2 rounded-md border border-bd bg-bg text-sm"
        placeholder="Buscar por número o cliente…"
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-bg border border-bd rounded-md shadow-lg max-h-72 overflow-y-auto">
          {resultados.map((f) => (
            <button
              key={f.id}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-bg-sunken border-b border-bd last:border-b-0"
              onClick={() => {
                onSelect(f);
                setOpen(false);
                setQ('');
              }}
            >
              <div className="flex justify-between items-center">
                <span className="font-mono text-sm font-medium">{f.numeroFactura}</span>
                <span className="font-mono text-xs text-tx-2">{formatCurrency(f.total)}</span>
              </div>
              <div className="text-xs text-tx-3 mt-0.5">{nombreCliente(f.cliente)}</div>
            </button>
          ))}
          {resultados.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-tx-3">Sin coincidencias.</div>
          )}
        </div>
      )}
      {(hint || truncado) && (
        <div className="text-xs text-tx-3 mt-1">
          {hint}
          {truncado && (
            <>
              {hint ? ' · ' : ''}
              Mostrando {facturas.length} de {totalSinFiltrar}. Refiná la búsqueda.
            </>
          )}
        </div>
      )}
    </div>
  );
}
