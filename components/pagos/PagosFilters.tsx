'use client';

import { FilterBar } from '@/components/ui/FilterBar';
import { Icon } from '@/components/ui/Icon';
import { useClientes } from '@/hooks/use-clientes';
import { fechaSVToIso } from '@/lib/utils';
import type { FiltrosPagos, MetodoPago, Cliente } from '@/types/api';

// ANTICIPO aparece como chip filtrable (no creable). Permite auditar los
// depósitos generados internamente al aprobar cotizaciones.
const METODOS: MetodoPago[] = ['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'TARJETA', 'OTRO', 'ANTICIPO'];

function metodoLabel(m: MetodoPago): string {
  return m[0] + m.slice(1).toLowerCase();
}

function nombreCliente(c: Cliente): string {
  if (c.tipo === 'EMPRESA') return c.razonSocial ?? '—';
  return [c.nombre, c.apellido].filter(Boolean).join(' ') || '—';
}

type Props = {
  value: FiltrosPagos;
  onChange: (next: FiltrosPagos) => void;
};

export function PagosFilters({ value, onChange }: Props) {
  // Cargamos hasta 100 clientes para alimentar el selector. React Query
  // cachea la respuesta, así que aunque el componente se re-renderee no
  // hay refetch innecesario.
  const { data: clientesData } = useClientes({ limit: 100 });
  const clientes = clientesData?.data ?? [];

  const chips = METODOS.map((m) => ({
    label: metodoLabel(m),
    active: value.metodoPago === m,
    onToggle: () => onChange({ ...value, metodoPago: value.metodoPago === m ? undefined : m, page: 1 }),
  }));

  function setBusqueda(v: string) {
    onChange({ ...value, busqueda: v || undefined, page: 1 });
  }

  function setFecha(key: 'fechaDesde' | 'fechaHasta', v: string) {
    // Los pagos se filtran contra "fecha" anclada al día calendario de El
    // Salvador — usamos medianoche SV, no UTC, para que el corte no quede
    // desfasado 6 horas respecto al día que ve el usuario.
    const iso = v ? fechaSVToIso(v) : undefined;
    onChange({ ...value, [key]: iso, page: 1 });
  }

  function setCliente(id: string) {
    onChange({ ...value, clienteId: id || undefined, page: 1 });
  }

  function clear() {
    onChange({ page: 1, limit: value.limit });
  }

  // Convertir ISO de vuelta a YYYY-MM-DD para el input. Si está vacío, ''.
  const desdeInput = value.fechaDesde ? value.fechaDesde.slice(0, 10) : '';
  const hastaInput = value.fechaHasta ? value.fechaHasta.slice(0, 10) : '';

  return (
    <div className="space-y-2">
      <FilterBar
        search={value.busqueda ?? ''}
        onSearch={setBusqueda}
        placeholder="Buscar por número de factura o cliente…"
        chips={chips}
        onClear={clear}
      />
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border border-bd border-t-0 bg-bg-sunken text-sm">
        <Icon name="filter" size={12} />
        <label className="text-tx-3 text-xs">Desde:</label>
        <input
          type="date"
          value={desdeInput}
          onChange={(e) => setFecha('fechaDesde', e.target.value)}
          className="text-xs px-2 py-1 rounded border border-bd bg-bg text-tx font-mono"
        />
        <label className="text-tx-3 text-xs">Hasta:</label>
        <input
          type="date"
          value={hastaInput}
          onChange={(e) => setFecha('fechaHasta', e.target.value)}
          className="text-xs px-2 py-1 rounded border border-bd bg-bg text-tx font-mono"
        />
        <label className="text-tx-3 text-xs ml-2">Cliente:</label>
        <select
          value={value.clienteId ?? ''}
          onChange={(e) => setCliente(e.target.value)}
          className="text-xs px-2 py-1 rounded border border-bd bg-bg text-tx min-w-40"
        >
          <option value="">Todos</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>{nombreCliente(c)}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
