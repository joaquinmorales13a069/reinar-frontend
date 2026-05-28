'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Decimal } from 'decimal.js';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { EstadoDteBadge } from '@/components/facturas/EstadoDteBadge';
import { CuandoUsarCard } from '@/components/ui/CuandoUsarCard';
import { useNotasCredito } from '@/hooks/use-notas-credito';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { EstadoDTE, TipoNotaCredito } from '@/types/api';

export default function NotasCreditoPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const puedeEscribir = ['ADMIN', 'GERENTE', 'OPERADOR'].includes(user?.rol ?? '');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<TipoNotaCredito | null>(null);
  const [filtroDTE, setFiltroDTE] = useState<EstadoDTE | null>(null);

  const { data, isLoading } = useNotasCredito({
    page,
    limit: 20,
    estadoDTE: filtroDTE ?? undefined,
  });

  // El backend no acepta search libre ni filtro por tipo → filtramos client-side sobre la página.
  const filas = (data?.data ?? []).filter((n) => {
    if (filtroTipo && n.tipo !== filtroTipo) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      n.numero.toLowerCase().includes(q) ||
      n.factura.numeroFactura.toLowerCase().includes(q) ||
      n.motivo.toLowerCase().includes(q)
    );
  });

  const totalEmitido = filas.reduce(
    (acc, n) => acc.add(new Decimal(n.total)),
    new Decimal(0),
  );
  const total = data?.meta.total ?? 0;
  const subtitle =
    `${total} ${total === 1 ? 'nota' : 'notas'} · ` +
    `total visible: ${formatCurrency(totalEmitido.toString())}`;

  return (
    <div>
      <PageHeader
        title="Notas de Crédito"
        subtitle={subtitle}
        actions={
          puedeEscribir && (
            <Link
              href="/notas-credito/nueva"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-accent text-navy hover:opacity-90"
            >
              <Icon name="plus" size={14} /> Nueva nota de crédito
            </Link>
          )
        }
      />

      <CuandoUsarCard
        title="¿Cuándo emitir una nota de crédito?"
        resumen="Solo contra facturas con DTE APROBADO y en estado PAGADA o PARCIAL. Si la factura está PENDIENTE, anulala directamente — no uses NC."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-tx-3 mb-2">
              NC Parcial — ajuste sin anular
            </h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Devolución temprana del equipo (días no usados).</li>
              <li>Entrega incompleta (faltaron piezas, andamios, herramientas).</li>
              <li>Descuento post-factura negociado con el cliente.</li>
              <li>Equipo defectuoso devuelto (días no operativos).</li>
              <li>Servicios no prestados (ej. se cobró montaje + desmontaje y solo se hizo uno).</li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-tx-3 mb-2">
              NC Total — equivale a anular
            </h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Factura emitida con error grave ya cobrada (cliente equivocado, items totalmente erróneos).</li>
              <li>Cancelación de contrato post-cobro (incumplimiento, devolución completa).</li>
            </ul>
            <p className="text-xs text-tx-3 mt-2">
              Tras una NC TOTAL la factura pasa a ANULADA y no se le puede tocar más. Emití una factura nueva si corresponde.
            </p>
          </div>
        </div>
        <p className="text-xs text-tx-3 mt-3 pt-3 border-t border-info-soft">
          La NC tiene su propio DTE legal y se envía al Ministerio de Hacienda. La suma de NCs activas no puede superar el total de la factura.
        </p>
      </CuandoUsarCard>

      <FilterBar
        search={search}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        placeholder="Buscar por número, factura o motivo…"
        chips={[
          { label: 'Total',      active: filtroTipo === 'TOTAL',      onToggle: () => { setFiltroTipo(filtroTipo === 'TOTAL' ? null : 'TOTAL'); setPage(1); } },
          { label: 'Parcial',    active: filtroTipo === 'PARCIAL',    onToggle: () => { setFiltroTipo(filtroTipo === 'PARCIAL' ? null : 'PARCIAL'); setPage(1); } },
          { label: 'Aprobada',   active: filtroDTE === 'APROBADO',    onToggle: () => { setFiltroDTE(filtroDTE === 'APROBADO' ? null : 'APROBADO'); setPage(1); } },
          { label: 'Procesando', active: filtroDTE === 'PROCESANDO',  onToggle: () => { setFiltroDTE(filtroDTE === 'PROCESANDO' ? null : 'PROCESANDO'); setPage(1); } },
          { label: 'Rechazada',  active: filtroDTE === 'RECHAZADO',   onToggle: () => { setFiltroDTE(filtroDTE === 'RECHAZADO' ? null : 'RECHAZADO'); setPage(1); } },
        ]}
        onClear={() => { setSearch(''); setFiltroTipo(null); setFiltroDTE(null); setPage(1); }}
      />

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : filas.length === 0 ? (
        <EmptyState icon="fileText" title="Sin notas de crédito" message="No se encontraron notas con los filtros aplicados." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-bd">
            <table className="w-full text-sm">
              <thead className="bg-bg-sunken text-xs uppercase tracking-wider text-tx-3">
                <tr>
                  <th className="text-left px-3 py-2">Número</th>
                  <th className="text-left px-3 py-2">Factura</th>
                  <th className="text-left px-3 py-2">Motivo</th>
                  <th className="text-left px-3 py-2">Tipo</th>
                  <th className="text-right px-3 py-2">Total</th>
                  <th className="text-left px-3 py-2">Estado DTE</th>
                  <th className="text-left px-3 py-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((n) => (
                  <tr
                    key={n.id}
                    className="border-t border-bd hover:bg-bg-sunken cursor-pointer"
                    onClick={() => router.push(`/notas-credito/${n.id}`)}
                  >
                    <td className="px-3 py-2 font-mono font-medium">{n.numero}</td>
                    <td className="px-3 py-2 font-mono text-tx-2">
                      <Link
                        href={`/facturas/${n.factura.id}`}
                        className="hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {n.factura.numeroFactura}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-tx-2 max-w-xs truncate">{n.motivo}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                        n.tipo === 'TOTAL' ? 'bg-danger-soft text-danger' : 'bg-warn-soft text-warn'
                      }`}>
                        {n.tipo}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-danger">
                      −{formatCurrency(n.total)}
                    </td>
                    <td className="px-3 py-2">
                      <EstadoDteBadge estado={n.estadoDTE} />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-tx-2">
                      {formatDate(n.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            pageSize={20}
            total={total}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}
