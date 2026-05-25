'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { Icon } from '@/components/ui/Icon';
import { useCotizaciones } from '@/hooks/use-cotizaciones';
import { CotizacionesTabla } from '@/components/cotizaciones/CotizacionesTabla';
import { CotizacionesPipeline } from '@/components/cotizaciones/CotizacionesPipeline';
import type { EstadoCotizacion } from '@/types/api';

type Vista = 'lista' | 'pipeline';

export default function CotizacionesPage() {
  const [vista, setVista] = useState<Vista>('lista');
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState<EstadoCotizacion | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useCotizaciones({
    page,
    limit: 20,
    search: search || undefined,
    estado: estado ?? undefined,
  });

  const chips = (['BORRADOR', 'ENVIADA', 'APROBADA', 'RECHAZADA'] as const).map((e) => ({
    label: e[0] + e.slice(1).toLowerCase(),
    active: estado === e,
    onToggle: () => setEstado(estado === e ? null : e),
  }));

  const total = data?.meta.total ?? 0;
  const subtitle = `${total} ${total === 1 ? 'cotización' : 'cotizaciones'}`;

  const toggleCls = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border transition-colors ${
      active
        ? 'bg-accent text-navy border-accent font-medium'
        : 'text-tx-2 border-bd hover:bg-bg-sunken'
    }`;

  return (
    <div>
      <PageHeader
        title="Cotizaciones"
        subtitle={subtitle}
        actions={
          <>
            <div className="flex gap-1">
              <button type="button" className={toggleCls(vista === 'lista')} onClick={() => setVista('lista')}>
                <Icon name="list" size={14} /> Lista
              </button>
              <button type="button" className={toggleCls(vista === 'pipeline')} onClick={() => setVista('pipeline')}>
                <Icon name="layers" size={14} /> Pipeline
              </button>
            </div>
            <Link
              href="/cotizaciones/nueva"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors"
            >
              <Icon name="plus" size={14} /> Nueva cotización
            </Link>
          </>
        }
      />

      {vista === 'lista' ? (
        <>
          <FilterBar
            search={search}
            onSearch={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Buscar por número o cliente…"
            chips={chips}
            onClear={() => {
              setSearch('');
              setEstado(null);
              setPage(1);
            }}
          />
          <CotizacionesTabla
            data={data?.data ?? []}
            loading={isLoading}
            page={page}
            pageSize={20}
            total={total}
            onPage={setPage}
          />
        </>
      ) : (
        <CotizacionesPipeline />
      )}
    </div>
  );
}
