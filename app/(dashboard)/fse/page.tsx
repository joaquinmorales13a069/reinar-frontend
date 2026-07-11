'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { FilterBar } from '@/components/ui/FilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { EstadoDteBadge } from '@/components/facturas/EstadoDteBadge';
import { useFses } from '@/hooks/use-fse';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { EstadoDTE } from '@/types/api';

export default function FsePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const puedeCrear = user && user.rol !== 'VISUALIZADOR';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [estadoDTE, setEstadoDTE] = useState<EstadoDTE | null>(null);

  const { data, isLoading } = useFses({
    page,
    limit: 20,
    estadoDTE: estadoDTE ?? undefined,
  });

  // El backend (filtrosFseSchema) no acepta busqueda libre — filtramos
  // client-side sobre la pagina actual, mismo patron que facturas/notas-credito.
  const filas = (data?.data ?? []).filter((f) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return f.numeroFse.toLowerCase().includes(q) || f.proveedor.nombre.toLowerCase().includes(q);
  });

  const total = data?.meta.total ?? 0;
  const subtitle = `${total} FSE · compras a sujetos excluidos (Art. 28 LIVA)`;

  return (
    <div>
      <PageHeader
        title="FSE — Sujeto Excluido"
        subtitle={subtitle}
        actions={
          puedeCrear && (
            <Link
              href="/fse/nuevo"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-accent text-navy hover:opacity-90"
            >
              <Icon name="plus" size={14} /> Nuevo FSE
            </Link>
          )
        }
      />

      <FilterBar
        search={search}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        placeholder="Buscar por número o proveedor…"
        chips={[
          { label: 'Sin emitir', active: estadoDTE === 'PENDIENTE', onToggle: () => { setEstadoDTE(estadoDTE === 'PENDIENTE' ? null : 'PENDIENTE'); setPage(1); } },
          { label: 'Procesando', active: estadoDTE === 'PROCESANDO', onToggle: () => { setEstadoDTE(estadoDTE === 'PROCESANDO' ? null : 'PROCESANDO'); setPage(1); } },
          { label: 'Aprobado', active: estadoDTE === 'APROBADO', onToggle: () => { setEstadoDTE(estadoDTE === 'APROBADO' ? null : 'APROBADO'); setPage(1); } },
          { label: 'Rechazado', active: estadoDTE === 'RECHAZADO', onToggle: () => { setEstadoDTE(estadoDTE === 'RECHAZADO' ? null : 'RECHAZADO'); setPage(1); } },
          { label: 'Anulado', active: estadoDTE === 'ANULADO', onToggle: () => { setEstadoDTE(estadoDTE === 'ANULADO' ? null : 'ANULADO'); setPage(1); } },
        ]}
        onClear={() => { setSearch(''); setEstadoDTE(null); setPage(1); }}
      />

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : filas.length === 0 ? (
        <EmptyState
          icon="receipt"
          title="Sin FSE"
          message="No se encontraron formularios de sujeto excluido con los filtros aplicados."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-bd">
            <table className="w-full text-sm">
              <thead className="bg-bg-sunken text-2xs uppercase tracking-wider text-tx-3">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Número</th>
                  <th className="text-left font-medium px-4 py-2.5">Proveedor</th>
                  <th className="text-left font-medium px-4 py-2.5">Fecha</th>
                  <th className="text-right font-medium px-4 py-2.5">Total compra</th>
                  <th className="text-right font-medium px-4 py-2.5">Rete renta</th>
                  <th className="text-right font-medium px-4 py-2.5">Total a pagar</th>
                  <th className="text-left font-medium px-4 py-2.5">Estado DTE</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr
                    key={f.id}
                    className="border-t border-bd hover:bg-bg-sunken cursor-pointer transition-colors"
                    onClick={() => router.push(`/fse/${f.id}`)}
                  >
                    <td className="px-4 py-2.5 font-mono font-medium text-tx">{f.numeroFse}</td>
                    <td className="px-4 py-2.5 text-tx">{f.proveedor.nombre}</td>
                    <td className="px-4 py-2.5 font-mono text-tx-2 text-xs">{formatDate(f.fechaEmision)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatCurrency(f.totalCompra)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-danger">−{formatCurrency(f.reteRenta)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{formatCurrency(f.totalPagar)}</td>
                    <td className="px-4 py-2.5"><EstadoDteBadge estado={f.estadoDTE} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} pageSize={20} total={total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
