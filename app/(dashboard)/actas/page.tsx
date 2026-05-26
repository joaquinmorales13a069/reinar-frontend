'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { Icon } from '@/components/ui/Icon';
import { ActaTablaListado } from '@/components/actas/ActaTablaListado';
import { useActas } from '@/hooks/use-actas';
import { useActasRealtime } from '@/hooks/use-actas-realtime';
import { useAuthStore } from '@/stores/auth.store';
import type { EstadoActa } from '@/types/api';

const ESTADOS: EstadoActa[] = ['PENDIENTE', 'DESPACHADO', 'ENTREGADO', 'DEVUELTA_PARCIAL', 'DEVUELTO'];

export default function ActasPage() {
  useActasRealtime();
  const user = useAuthStore((s) => s.user);
  const puedeEscribir = user && user.rol !== 'VISUALIZADOR';

  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState<EstadoActa | null>(null);
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useActas({
    busqueda: search || undefined,
    estado: estado ?? undefined,
    page,
    limit,
  });

  const total = data?.meta?.total ?? 0;
  const enCurso = (data?.data ?? []).filter(a => a.estado === 'PENDIENTE' || a.estado === 'DESPACHADO').length;

  return (
    <div>
      <PageHeader
        title="Actas de Entrega"
        subtitle={isLoading ? 'Cargando…' : `${total} actas · ${enCurso} en curso`}
        actions={puedeEscribir ? (
          <Link href="/actas/nueva" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors">
            <Icon name="plus" size={14} /> Nueva acta
          </Link>
        ) : null}
      />
      <FilterBar
        search={search}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        placeholder="Buscar por número, factura, cliente…"
        chips={ESTADOS.map(e => ({
          label: e,
          active: estado === e,
          onToggle: () => { setEstado(estado === e ? null : e); setPage(1); },
        }))}
        onClear={() => { setSearch(''); setEstado(null); setPage(1); }}
      />
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <>
          <ActaTablaListado actas={data?.data ?? []} />
          {total > limit && (
            <div className="mt-4">
              <Pagination page={page} pageSize={limit} total={total} onPage={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
