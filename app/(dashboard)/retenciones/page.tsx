'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Decimal } from 'decimal.js';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import {
  useRetenciones,
  useEliminarRetencion,
  descargarRetencionPdf,
} from '@/hooks/use-retenciones';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function RetencionesPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const esAdmin = user?.rol === 'ADMIN';
  const puedeEscribir = ['ADMIN', 'GERENTE', 'OPERADOR'].includes(user?.rol ?? '');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filtroPct, setFiltroPct] = useState<1 | 13 | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ id: string; numeroCR: string; facturaId: string } | null>(null);
  const [descargando, setDescargando] = useState<string | null>(null);

  const { data, isLoading } = useRetenciones({ page, limit: 20 });
  const eliminar = useEliminarRetencion();

  const filas = (data?.data ?? []).filter((r) => {
    if (filtroPct && Number(r.porcentaje) !== filtroPct) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    const nombre = (r.cliente.razonSocial || r.cliente.nombre || '').toLowerCase();
    return (
      r.numeroCR.toLowerCase().includes(q) ||
      r.factura.numeroFactura.toLowerCase().includes(q) ||
      nombre.includes(q)
    );
  });

  const totalRetenido = filas.reduce(
    (acc, r) => acc.add(new Decimal(r.monto)),
    new Decimal(0),
  );
  const total = data?.meta.total ?? 0;
  const subtitle =
    `${total} ${total === 1 ? 'comprobante' : 'comprobantes'} · ` +
    `total visible: ${formatCurrency(totalRetenido.toString())}`;

  async function onDescargar(id: string, numeroCR: string) {
    setDescargando(id);
    await descargarRetencionPdf(id, numeroCR);
    setDescargando(null);
  }

  async function onEliminar() {
    if (!confirmDel) return;
    try {
      await eliminar.mutateAsync({ id: confirmDel.id, facturaId: confirmDel.facturaId });
      setConfirmDel(null);
    } catch {
      // Toast manejado por el hook.
    }
  }

  return (
    <div>
      <PageHeader
        title="Retenciones"
        subtitle={subtitle}
        actions={
          puedeEscribir && (
            <Link
              href="/retenciones/nueva"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-accent text-navy hover:opacity-90"
            >
              <Icon name="plus" size={14} /> Registrar retención
            </Link>
          )
        }
      />

      <FilterBar
        search={search}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        placeholder="Buscar por número CR, factura o cliente…"
        chips={[
          { label: '1% IVA',  active: filtroPct === 1,  onToggle: () => { setFiltroPct(filtroPct === 1 ? null : 1); setPage(1); } },
          { label: '13% IVA', active: filtroPct === 13, onToggle: () => { setFiltroPct(filtroPct === 13 ? null : 13); setPage(1); } },
        ]}
        onClear={() => { setSearch(''); setFiltroPct(null); setPage(1); }}
      />

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : filas.length === 0 ? (
        <EmptyState icon="fileText" title="Sin retenciones" message="No se encontraron retenciones con los filtros aplicados." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-bd">
            <table className="w-full text-sm">
              <thead className="bg-bg-sunken text-xs uppercase tracking-wider text-tx-3">
                <tr>
                  <th className="text-left px-3 py-2">Número CR</th>
                  <th className="text-left px-3 py-2">Factura</th>
                  <th className="text-left px-3 py-2">Cliente</th>
                  <th className="text-right px-3 py-2">%</th>
                  <th className="text-right px-3 py-2">Monto</th>
                  <th className="text-left px-3 py-2">Fecha</th>
                  <th className="text-right px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((r) => (
                  <Fragment key={r.id}>
                    <tr
                      className="border-t border-bd hover:bg-bg-sunken cursor-pointer"
                      onClick={() => router.push(`/retenciones/${r.id}`)}
                    >
                      <td className="px-3 py-2 font-mono font-medium">{r.numeroCR}</td>
                      <td className="px-3 py-2 font-mono text-tx-2">
                        <Link
                          href={`/facturas/${r.factura.id}`}
                          className="hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.factura.numeroFactura}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{r.cliente.razonSocial || r.cliente.nombre || '—'}</td>
                      <td className="px-3 py-2 text-right font-mono">{Number(r.porcentaje).toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right font-mono font-medium text-warn">
                        −{formatCurrency(r.monto)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-tx-2">{formatDate(r.fecha)}</td>
                      <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            disabled={descargando === r.id}
                            onClick={() => onDescargar(r.id, r.numeroCR)}
                            className="px-2 py-1 rounded text-xs border border-bd hover:bg-bg-sunken disabled:opacity-50"
                          >
                            <Icon name="download" size={12} /> PDF
                          </button>
                          {esAdmin && (
                            <button
                              type="button"
                              onClick={() => setConfirmDel({ id: r.id, numeroCR: r.numeroCR, facturaId: r.factura.id })}
                              className="px-2 py-1 rounded text-xs text-danger hover:bg-danger-soft"
                              title="Eliminar (ADMIN)"
                            >
                              <Icon name="trash" size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {confirmDel?.id === r.id && (
                      <tr>
                        <td colSpan={7} className="p-2 bg-danger-soft">
                          <ConfirmRow
                            message={
                              <>¿Eliminar comprobante <b className="font-mono">{r.numeroCR}</b>? Esta acción es permanente.</>
                            }
                            confirmLabel={eliminar.isPending ? 'Eliminando…' : 'Sí, eliminar'}
                            onCancel={() => setConfirmDel(null)}
                            onConfirm={onEliminar}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
