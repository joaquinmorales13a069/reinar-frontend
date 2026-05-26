'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useFacturas } from '@/hooks/use-facturas';
import type { FacturaListItem } from '@/types/api';

// Typeahead minimalista sin dropdown library: FiltrosFacturas no incluye campo
// de texto libre, así que cargamos un lote amplio y filtramos en cliente contra
// numeroFactura y nombre del cliente. El caller decide si filtra adicionalmente
// por estado DTE u otros campos.
type Props = {
  // Filtro post-fetch sobre las facturas devueltas por la API.
  filter?: (f: FacturaListItem) => boolean;
  emptyMessage?: string;
  placeholder?: string;
  onSelect: (f: FacturaListItem) => void;
};

const inputBase =
  'w-full pl-10 pr-3 py-2 text-sm rounded-md border border-bd bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';

// razonSocial es null para clientes PARTICULARES — mostramos nombre completo como fallback.
function nombreCliente(f: FacturaListItem): string {
  if (f.cliente.razonSocial) return f.cliente.razonSocial;
  const partes = [f.cliente.nombre, f.cliente.apellido].filter(Boolean);
  return partes.join(' ') || '—';
}

export function SelectorFactura({ filter, emptyMessage, placeholder, onSelect }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [open, setOpen] = useState(false);
  // Cargamos un lote amplio; el filtro de texto se aplica en cliente porque
  // FiltrosFacturas no expone búsqueda de texto libre.
  const { data } = useFacturas({ limit: 100 });
  const todas = data?.data ?? [];
  const q = busqueda.trim().toLowerCase();
  const coinciden = q
    ? todas.filter(
        (f) =>
          f.numeroFactura.toLowerCase().includes(q) ||
          nombreCliente(f).toLowerCase().includes(q),
      )
    : todas;
  const filtradas = (filter ? coinciden.filter(filter) : coinciden).slice(0, 8);

  return (
    <div className="relative">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-3 pointer-events-none">
          <Icon name="search" size={14} />
        </span>
        <input
          type="text"
          className={inputBase}
          value={busqueda}
          placeholder={placeholder ?? 'Buscar por número o cliente…'}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setBusqueda(e.target.value); setOpen(true); }}
        />
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-10 rounded-md border border-bd bg-surface shadow-lg max-h-72 overflow-auto">
          {filtradas.length === 0 ? (
            <div className="px-3 py-3 text-xs text-tx-3">{emptyMessage ?? 'Sin resultados.'}</div>
          ) : (
            filtradas.map((f) => (
              <button
                key={f.id}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-bg-sunken transition-colors border-b border-bd last:border-b-0"
                onClick={() => { onSelect(f); setBusqueda(''); setOpen(false); }}
              >
                <div className="flex justify-between gap-3">
                  <span className="text-sm font-medium font-mono">{f.numeroFactura}</span>
                  <span className="text-xs text-tx-3 truncate">{nombreCliente(f)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
