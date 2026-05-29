'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useFacturas } from '@/hooks/use-facturas';
import { FacturasFilters } from '@/components/facturas/FacturasFilters';
import { FacturasTabla } from '@/components/facturas/FacturasTabla';
import type { EstadoFactura, EstadoDTE } from '@/types/api';

export default function FacturasPage() {
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState<EstadoFactura | null>(null);
  const [estadoDTE, setEstadoDTE] = useState<EstadoDTE | null>(null);
  const [esQuedan, setEsQuedan] = useState(false);
  const [entregaPendiente, setEntregaPendiente] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useFacturas({
    page,
    limit: 20,
    estado: estado ?? undefined,
    estadoDTE: estadoDTE ?? undefined,
    esQuedan: esQuedan ? true : undefined,
    entregaPendiente: entregaPendiente ? true : undefined,
  });

  // El backend de facturas (segun lo revisado) no expone parametro `busqueda`.
  // Filtramos client-side sobre la pagina actual: alcanza para el MVP y se
  // sustituye cuando el backend agregue search. La busqueda mira los 3
  // campos de nombre del cliente (razonSocial, nombre, apellido) porque
  // EMPRESA y PARTICULAR usan distintos.
  const filtered = (data?.data ?? []).filter((f) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const nombre = [f.cliente.razonSocial, f.cliente.nombre, f.cliente.apellido]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return f.numeroFactura.toLowerCase().includes(q) || nombre.includes(q);
  });

  const total = data?.meta.total ?? 0;
  const subtitle = `${total} ${total === 1 ? 'factura' : 'facturas'} · generadas automáticamente al aprobar cotizaciones`;

  return (
    <div>
      <PageHeader title="Facturas" subtitle={subtitle} />
      <FacturasFilters
        search={search}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        estado={estado}
        onEstado={(e) => { setEstado(e); setPage(1); }}
        estadoDTE={estadoDTE}
        onEstadoDTE={(e) => { setEstadoDTE(e); setPage(1); }}
        esQuedan={esQuedan}
        onEsQuedan={(v) => { setEsQuedan(v); setPage(1); }}
        entregaPendiente={entregaPendiente}
        onEntregaPendiente={(v) => { setEntregaPendiente(v); setPage(1); }}
        onClear={() => {
          setSearch('');
          setEstado(null);
          setEstadoDTE(null);
          setEsQuedan(false);
          setEntregaPendiente(false);
          setPage(1);
        }}
      />
      <FacturasTabla
        data={filtered}
        loading={isLoading}
        page={page}
        pageSize={20}
        total={total}
        onPage={setPage}
        mostrarColumnaEntrega={esQuedan}
      />
    </div>
  );
}
