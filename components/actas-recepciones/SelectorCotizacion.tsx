'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useCotizaciones } from '@/hooks/use-cotizaciones';
import type { CotizacionListItem } from '@/types/api';

// Typeahead minimalista sin dropdown library, espejando SelectorFactura:
// FiltrosCotizaciones no incluye campo de texto libre por numeroCotizacion,
// así que cargamos un lote amplio de cotizaciones APROBADAS (origen válido
// para actas) y filtramos en cliente contra numeroCotizacion y nombre del
// cliente. Controlado (value/onChange) en vez de onSelect porque el caller
// (actas/nueva) necesita el cotizacionId como fuente de verdad del form.
type Props = {
  value: string | null;
  onChange: (cotizacionId: string) => void;
  // Filtro post-fetch sobre las cotizaciones devueltas por la API.
  filter?: (c: CotizacionListItem) => boolean;
  emptyMessage?: string;
  placeholder?: string;
};

const inputBase =
  'w-full pl-10 pr-3 py-2 text-sm rounded-md border border-bd bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';

// razonSocial es null para clientes PARTICULARES — mostramos nombre completo como fallback.
function nombreCliente(c: CotizacionListItem): string {
  if (c.cliente.razonSocial) return c.cliente.razonSocial;
  const partes = [c.cliente.nombre, c.cliente.apellido].filter(Boolean);
  return partes.join(' ') || '—';
}

export function SelectorCotizacion({ value, onChange, filter, emptyMessage, placeholder }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [open, setOpen] = useState(false);
  // Cargamos un lote amplio de cotizaciones aprobadas; el filtro de texto se
  // aplica en cliente porque FiltrosCotizaciones no expone búsqueda por número.
  const { data } = useCotizaciones({ estado: 'APROBADA', limit: 100 });
  const todas = data?.data ?? [];
  const seleccionada = todas.find((c) => c.id === value) ?? null;
  const q = busqueda.trim().toLowerCase();
  const coinciden = q
    ? todas.filter(
        (c) =>
          c.numeroCotizacion.toLowerCase().includes(q) ||
          nombreCliente(c).toLowerCase().includes(q),
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
          value={open || busqueda ? busqueda : (seleccionada ? seleccionada.numeroCotizacion : '')}
          placeholder={placeholder ?? 'Buscar por número o cliente…'}
          onFocus={() => setOpen(true)}
          // El blur usa setTimeout para que el click en una opción (onMouseDown)
          // dispare antes de que el dropdown se cierre.
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => { setBusqueda(e.target.value); setOpen(true); }}
        />
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-10 rounded-md border border-bd bg-surface shadow-lg max-h-72 overflow-auto">
          {filtradas.length === 0 ? (
            <div className="px-3 py-3 text-xs text-tx-3">{emptyMessage ?? 'Sin resultados.'}</div>
          ) : (
            filtradas.map((c) => (
              <button
                key={c.id}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-bg-sunken transition-colors border-b border-bd last:border-b-0"
                onMouseDown={() => { onChange(c.id); setBusqueda(''); setOpen(false); }}
              >
                <div className="flex justify-between gap-3">
                  <span className="text-sm font-medium font-mono">{c.numeroCotizacion}</span>
                  <span className="text-xs text-tx-3 truncate">{nombreCliente(c)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
