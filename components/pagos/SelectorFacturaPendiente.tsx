'use client';

import { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { FacturaEstadoBadge } from '@/components/facturas/FacturaEstadoBadge';
import { formatCurrency } from '@/lib/utils';
import type { FacturaListItem } from '@/types/api';

function nombreCliente(c: FacturaListItem['cliente']): string {
  if (c.tipo === 'EMPRESA') return c.razonSocial ?? '—';
  return [c.nombre, c.apellido].filter(Boolean).join(' ') || '—';
}

type Props = {
  facturas: FacturaListItem[];
  loading: boolean;
  onSelect: (f: FacturaListItem) => void;
};

// Typeahead client-side. Filtramos sobre la lista ya cargada
// (useFacturasPendientes carga 100). El backend no soporta búsqueda por
// numeroFactura ni filtro por múltiples estados; pedirlo aquí abriría un
// PR extra al server por un caso de uso acotado.
export function SelectorFacturaPendiente({ facturas, loading, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const resultados = useMemo(() => {
    const base = facturas;
    if (!query) return base.slice(0, 6);
    const q = query.toLowerCase();
    return base
      .filter((f) => {
        const nombre = nombreCliente(f.cliente).toLowerCase();
        return f.numeroFactura.toLowerCase().includes(q) || nombre.includes(q);
      })
      .slice(0, 6);
  }, [facturas, query]);

  return (
    <div className="relative">
      <label className="block text-xs text-tx-3 mb-1">
        Buscar factura pendiente <span className="text-danger">*</span>
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-3 pointer-events-none">
          <Icon name="search" size={14} />
        </span>
        <input
          type="text"
          value={query}
          placeholder="Buscar por número o cliente…"
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          className="w-full pl-9 pr-3 py-2 rounded-md border border-bd bg-bg text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent"
        />
      </div>
      {open && (
        <div className="absolute z-10 left-0 right-0 mt-1 border border-bd rounded-md bg-bg shadow-lg max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-4"><Spinner /></div>
          ) : resultados.length === 0 ? (
            <div className="px-3 py-4 text-sm text-tx-3 text-center">
              {query
                ? 'No hay facturas con saldo pendiente que coincidan.'
                : 'No hay facturas con saldo pendiente.'}
            </div>
          ) : (
            resultados.map((f) => (
              <button
                key={f.id}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-bg-sunken border-b border-bd last:border-b-0"
                // onMouseDown en vez de onClick para que dispare antes del
                // onBlur del input (que cierra el dropdown con un setTimeout).
                onMouseDown={() => onSelect(f)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium text-tx">{f.numeroFactura}</span>
                  <span className="font-mono text-xs font-semibold text-danger">
                    Saldo: {formatCurrency(f.saldoPendiente)}
                  </span>
                </div>
                <div className="text-xs text-tx-3 mt-0.5 flex items-center gap-2">
                  <span>{nombreCliente(f.cliente)}</span>
                  <FacturaEstadoBadge estado={f.estado} />
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
