'use client';

import { FilterBar } from '@/components/ui/FilterBar';
import { Icon } from '@/components/ui/Icon';
import type { EstadoFactura, EstadoDTE } from '@/types/api';

type Props = {
  search: string;
  onSearch: (v: string) => void;
  estado: EstadoFactura | null;
  onEstado: (e: EstadoFactura | null) => void;
  estadoDTE: EstadoDTE | null;
  onEstadoDTE: (e: EstadoDTE | null) => void;
  esQuedan: boolean;
  onEsQuedan: (v: boolean) => void;
  entregaPendiente: boolean;
  onEntregaPendiente: (v: boolean) => void;
  onClear: () => void;
};

const ESTADOS: EstadoFactura[] = ['PENDIENTE', 'PARCIAL', 'PAGADA', 'VENCIDA', 'ANULADA'];
const ESTADOS_DTE: { value: EstadoDTE; label: string }[] = [
  { value: 'PENDIENTE',  label: 'Sin emitir' },
  { value: 'PROCESANDO', label: 'Procesando' },
  { value: 'APROBADO',   label: 'Aprobado' },
  { value: 'RECHAZADO',  label: 'Rechazado' },
  { value: 'ANULADO',    label: 'Anulado' },
];

export function FacturasFilters({
  search, onSearch, estado, onEstado, estadoDTE, onEstadoDTE,
  esQuedan, onEsQuedan, entregaPendiente, onEntregaPendiente, onClear,
}: Props) {
  const chips = ESTADOS.map((e) => ({
    label: e[0] + e.slice(1).toLowerCase(),
    active: estado === e,
    onToggle: () => onEstado(estado === e ? null : e),
  }));

  // Toggle de "Solo QUEDAN": al apagarse, tambien apaga "Pendientes de entrega"
  // porque ese filtro solo tiene sentido cuando QUEDAN esta activo.
  const toggleQuedan = () => {
    const next = !esQuedan;
    onEsQuedan(next);
    if (!next && entregaPendiente) onEntregaPendiente(false);
  };

  return (
    <div className="space-y-2">
      <FilterBar
        search={search}
        onSearch={onSearch}
        placeholder="Buscar por número o cliente…"
        chips={chips}
        onClear={onClear}
      />
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 border border-bd border-t-0 bg-bg-sunken text-sm">
        <div className="flex items-center gap-2">
          <Icon name="filter" size={12} />
          <label className="text-tx-3 text-xs">Estado DTE:</label>
          <select
            value={estadoDTE ?? ''}
            onChange={(e) => onEstadoDTE((e.target.value || null) as EstadoDTE | null)}
            className="text-xs px-2 py-1 rounded border border-bd bg-bg text-tx"
          >
            <option value="">Todos</option>
            {ESTADOS_DTE.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleQuedan}
            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
              esQuedan
                ? 'bg-accent text-navy border-accent font-medium'
                : 'text-tx-2 border-bd hover:bg-bg-sunken'
            }`}
          >
            Solo QUEDAN
          </button>
          <button
            type="button"
            onClick={() => onEntregaPendiente(!entregaPendiente)}
            disabled={!esQuedan}
            title={!esQuedan ? 'Activá "Solo QUEDAN" primero' : undefined}
            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
              entregaPendiente
                ? 'bg-accent text-navy border-accent font-medium'
                : 'text-tx-2 border-bd hover:bg-bg-sunken'
            } ${!esQuedan ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Pendientes de entrega
          </button>
        </div>
      </div>
    </div>
  );
}
