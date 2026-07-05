'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useClientes } from '@/hooks/use-clientes';
import { nombreCliente } from '@/lib/utils';
import type { Cliente } from '@/types/api';

// Typeahead minimalista sin dropdown library, espejando SelectorCotizacion:
// cargamos un lote amplio de clientes ACTIVOS (únicos elegibles como receptor
// fiscal de un tercero) y filtramos en cliente contra nombre y documento.
// Controlado (value/onChange) porque el caller necesita el clienteId como
// fuente de verdad del form.
type Props = {
  value: string | null;
  // Se expone también el `tipo` del cliente elegido (EMPRESA/PARTICULAR) para
  // que el caller pueda re-sugerir el tipo de DTE (CCF vs FC) sin tener que
  // volver a buscar el cliente en su propia lista.
  onChange: (clienteId: string, tipo: Cliente['tipo']) => void;
  // Filtro post-fetch sobre los clientes devueltos por la API (ej. excluir
  // al cliente de la cotización de la lista de terceros).
  filter?: (c: Cliente) => boolean;
  emptyMessage?: string;
  placeholder?: string;
};

const inputBase =
  'w-full pl-10 pr-3 py-2 text-sm rounded-md border border-bd bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';

export function SelectorClienteReceptor({ value, onChange, filter, emptyMessage, placeholder }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [open, setOpen] = useState(false);
  // Solo clientes ACTIVOS pueden recibir facturas — mismo criterio que el
  // resto del ERP para cualquier operación de facturación.
  const { data } = useClientes({ estado: 'ACTIVO', limit: 100 });
  const todos = data?.data ?? [];
  const seleccionado = todos.find((c) => c.id === value) ?? null;
  const q = busqueda.trim().toLowerCase();
  const coinciden = q
    ? todos.filter(
        (c) =>
          nombreCliente(c).toLowerCase().includes(q) ||
          (c.numeroDocumento ?? '').toLowerCase().includes(q) ||
          (c.ncr ?? '').toLowerCase().includes(q),
      )
    : todos;
  const filtrados = (filter ? coinciden.filter(filter) : coinciden).slice(0, 8);

  return (
    <div className="relative">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-3 pointer-events-none">
          <Icon name="search" size={14} />
        </span>
        <input
          type="text"
          className={inputBase}
          value={open || busqueda ? busqueda : (seleccionado ? nombreCliente(seleccionado) : '')}
          placeholder={placeholder ?? 'Buscar por nombre o documento…'}
          onFocus={() => setOpen(true)}
          // El blur usa setTimeout para que el click en una opción (onMouseDown)
          // dispare antes de que el dropdown se cierre.
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => { setBusqueda(e.target.value); setOpen(true); }}
        />
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-10 rounded-md border border-bd bg-surface shadow-lg max-h-72 overflow-auto">
          {filtrados.length === 0 ? (
            <div className="px-3 py-3 text-xs text-tx-3">{emptyMessage ?? 'Sin resultados.'}</div>
          ) : (
            filtrados.map((c) => (
              <button
                key={c.id}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-bg-sunken transition-colors border-b border-bd last:border-b-0"
                onMouseDown={() => { onChange(c.id, c.tipo); setBusqueda(''); setOpen(false); }}
              >
                <div className="flex justify-between gap-3">
                  <span className="text-sm font-medium truncate">{nombreCliente(c)}</span>
                  <span className="text-xs text-tx-3 font-mono">{c.numeroDocumento ?? c.ncr ?? ''}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
