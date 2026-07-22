'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { FacturaEstadoBadge } from '@/components/facturas/FacturaEstadoBadge';
import { PagoDetallePanel } from './PagoDetallePanel';
import { EditarPagoForm } from './EditarPagoForm';
import { useEliminarPago } from '@/hooks/use-pagos';
import { formatCurrency, formatDate, nombreCliente } from '@/lib/utils';
import type { PagoListItem } from '@/types/api';

type Props = {
  pagos: PagoListItem[];
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  canEdit: boolean;
  canDelete: boolean;
  hasFilters: boolean;
};

export function PagosTabla({ pagos, loading, page, pageSize, total, onPage, canEdit, canDelete, hasFilters }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const eliminar = useEliminarPago();

  if (loading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }
  if (pagos.length === 0) {
    return hasFilters ? (
      <EmptyState icon="filter" title="Sin resultados" message="No hay pagos con esos filtros." />
    ) : (
      <EmptyState icon="dollar" title="Sin pagos" message="Aún no se han registrado pagos." />
    );
  }

  return (
    <div className="border border-bd rounded-b-md overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-bg-sunken text-2xs uppercase tracking-wider text-tx-3">
          <tr>
            <th className="text-left font-medium px-4 py-2.5 w-12">#</th>
            <th className="text-left font-medium px-4 py-2.5 w-40">Factura</th>
            <th className="text-left font-medium px-4 py-2.5">Cliente</th>
            <th className="text-left font-medium px-4 py-2.5 w-36">Método</th>
            <th className="text-left font-medium px-4 py-2.5">Referencia</th>
            <th className="text-left font-medium px-4 py-2.5 w-28">Fecha</th>
            <th className="text-right font-medium px-4 py-2.5 w-32">Monto</th>
            <th className="px-4 py-2.5 w-16"></th>
          </tr>
        </thead>
        <tbody>
          {pagos.map((p, index) => {
            const isExpanded = expanded === p.id;
            // El backend rechaza eliminar pagos de facturas ANULADAS con 422.
            // Lo prevenimos en UI deshabilitando el botón.
            const facturaAnulada = p.factura.estado === 'ANULADA';
            return (
              <Fragment key={p.id}>
                <tr
                  className={`border-t border-bd hover:bg-bg-sunken cursor-pointer transition-colors ${isExpanded ? 'bg-bg-sunken' : ''}`}
                  onClick={() => {
                    // Expandir/colapsar cierra cualquier acción en curso para
                    // evitar que la fila muestre detalle + edit + confirm al mismo tiempo.
                    setEditingId(null);
                    setConfirmDelete(null);
                    setExpanded(isExpanded ? null : p.id);
                  }}
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-tx-2 tabular-nums">{(page - 1) * pageSize + index + 1}</td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/facturas/${p.factura.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-mono text-xs text-tx hover:underline"
                    >
                      {p.factura.numeroFactura}
                    </Link>
                    <div className="mt-0.5"><FacturaEstadoBadge estado={p.factura.estado} /></div>
                  </td>
                  <td className="px-4 py-2.5 text-tx">{nombreCliente(p.factura.cliente)}</td>
                  <td className="px-4 py-2.5"><Badge status={p.metodoPago} /></td>
                  <td className="px-4 py-2.5 font-mono text-xs text-tx-3">{p.referencia ?? '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-tx-2">{formatDate(p.fecha)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium text-ok">{formatCurrency(p.monto)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {canEdit && (
                      <button
                        type="button"
                        disabled={facturaAnulada}
                        title={facturaAnulada ? 'Factura anulada — pago inmutable' : 'Editar referencia y notas'}
                        className="text-tx-2 hover:bg-bg rounded p-1 mr-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Editar y borrar son mutuamente excluyentes — cerramos
                          // cualquier acción abierta en otra fila al cambiar.
                          setConfirmDelete(null);
                          setExpanded(null);
                          setEditingId(p.id);
                        }}
                      >
                        <Icon name="edit" size={13} />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        disabled={facturaAnulada}
                        title={facturaAnulada ? 'Factura anulada — pago inmutable' : 'Eliminar pago'}
                        className="text-danger hover:bg-danger-soft rounded p-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(null);
                          setExpanded(null);
                          setConfirmDelete(p.id);
                        }}
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={8} className="p-0">
                      <PagoDetallePanel pago={p} />
                    </td>
                  </tr>
                )}
                {editingId === p.id && (
                  <tr>
                    <td colSpan={8} className="px-4 py-3 border-t border-bd">
                      <EditarPagoForm
                        facturaId={p.factura.id}
                        pagoId={p.id}
                        referenciaActual={p.referencia}
                        notasActuales={p.notas}
                        onCancel={() => setEditingId(null)}
                        onSuccess={() => setEditingId(null)}
                      />
                    </td>
                  </tr>
                )}
                {confirmDelete === p.id && (
                  <tr>
                    <td colSpan={8} className="px-4 py-3 border-t border-bd">
                      <ConfirmRow
                        message={`¿Eliminar este pago? El saldo de ${p.factura.numeroFactura} se recalculará.`}
                        confirmLabel={eliminar.isPending ? 'Eliminando…' : 'Eliminar pago'}
                        onCancel={() => setConfirmDelete(null)}
                        onConfirm={async () => {
                          try {
                            await eliminar.mutateAsync({ facturaId: p.factura.id, pagoId: p.id });
                            setConfirmDelete(null);
                          } catch {
                            // Toast manejado por el hook.
                          }
                        }}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {total > pageSize && <Pagination page={page} pageSize={pageSize} total={total} onPage={onPage} />}
    </div>
  );
}
