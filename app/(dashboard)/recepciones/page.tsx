'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { Icon } from '@/components/ui/Icon';
import { RecepcionTablaListado } from '@/components/recepciones/RecepcionTablaListado';
import { useRecepciones } from '@/hooks/use-recepciones';
import { useActasRealtime } from '@/hooks/use-actas-realtime';
import { useAuthStore } from '@/stores/auth.store';

export default function RecepcionesPage() {
  useActasRealtime();
  const user = useAuthStore((s) => s.user);
  const puedeEscribir = user && user.rol !== 'VISUALIZADOR';

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useRecepciones({
    busqueda: search || undefined,
    page,
    limit,
  });
  const total = data?.meta?.total ?? 0;

  return (
    <div>
      <PageHeader
        title="Recepciones"
        subtitle={isLoading ? 'Cargando…' : `${total} recepciones registradas`}
        actions={puedeEscribir ? (
          <Link href="/recepciones/nueva" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors">
            <Icon name="plus" size={14} /> Nueva recepción
          </Link>
        ) : null}
      />
      <FilterBar
        search={search}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        placeholder="Buscar por número, factura, cliente…"
        chips={[]}
        onClear={() => { setSearch(''); setPage(1); }}
      />
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <>
          <RecepcionTablaListado recepciones={data?.data ?? []} />
          {total > limit && (
            <div className="mt-4">
              <Pagination page={page} total={total} pageSize={limit} onPage={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
