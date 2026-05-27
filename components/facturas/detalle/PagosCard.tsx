'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { RegistrarPagoForm } from '@/components/pagos/RegistrarPagoForm';
import { EditarPagoForm } from '@/components/pagos/EditarPagoForm';
import { useListarPagos, useEliminarPago } from '@/hooks/use-pagos';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Factura } from '@/types/api';

type Props = {
  factura: Factura;
  isOperador: boolean;
  isAdminOGerente: boolean;
};

export function PagosCard({ factura, isOperador, isAdminOGerente }: Props) {
  const [registrarOpen, setRegistrarOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingPagoId, setEditingPagoId] = useState<string | null>(null);
  const { data: pagos = [], isLoading } = useListarPagos(factura.id);
  const eliminar = useEliminarPago();

  // ANULADA no acepta nuevos pagos ni eliminaciones — el backend lo rechaza.
  const facturaActiva = factura.estado !== 'ANULADA';
  const puedeRegistrar = isOperador && facturaActiva;

  return (
    <div className="bg-bg border border-bd rounded-md">
      <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
        <h3 className="text-sm font-medium text-tx">Pagos registrados ({pagos.length})</h3>
        {puedeRegistrar && !registrarOpen && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-bd text-tx-2 hover:bg-bg-sunken"
            onClick={() => setRegistrarOpen(true)}
          >
            <Icon name="plus" size={12} /> Registrar pago
          </button>
        )}
      </div>

      {registrarOpen && (
        <div className="p-4">
          <RegistrarPagoForm
            facturaId={factura.id}
            saldoPendiente={factura.saldoPendiente}
            onClose={() => setRegistrarOpen(false)}
          />
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : pagos.length === 0 ? (
        <div className="py-6">
          <EmptyState icon="dollar" title="Sin pagos" message="Aún no se han registrado pagos para esta factura." />
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-bg-sunken text-2xs uppercase tracking-wider text-tx-3">
            <tr>
              <th className="text-left font-medium px-4 py-2 w-12">#</th>
              <th className="text-left font-medium px-4 py-2 w-28">Fecha</th>
              <th className="text-left font-medium px-4 py-2 w-32">Método</th>
              <th className="text-left font-medium px-4 py-2">Referencia</th>
              <th className="text-right font-medium px-4 py-2 w-32">Monto</th>
              <th className="px-4 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {pagos.map((p, index) => (
              <tr key={p.id} className="border-t border-bd">
                <td className="px-4 py-2 font-mono text-xs text-tx-2 tabular-nums">{index + 1}</td>
                <td className="px-4 py-2 font-mono text-xs">{formatDate(p.fecha)}</td>
                <td className="px-4 py-2"><Badge status={p.metodoPago} /></td>
                <td className="px-4 py-2 text-xs text-tx-3 font-mono">{p.referencia ?? '—'}</td>
                <td className="px-4 py-2 text-right tabular-nums font-medium">{formatCurrency(p.monto)}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  {puedeRegistrar && (
                    <button
                      type="button"
                      className="text-tx-2 hover:bg-bg rounded p-1 mr-1"
                      title="Editar referencia y notas"
                      onClick={() => {
                        setConfirmDelete(null);
                        setEditingPagoId(p.id);
                      }}
                    >
                      <Icon name="edit" size={13} />
                    </button>
                  )}
                  {isAdminOGerente && facturaActiva && (
                    <button
                      type="button"
                      className="text-danger hover:bg-danger-soft rounded p-1"
                      title="Eliminar pago"
                      onClick={() => setConfirmDelete(p.id)}
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editingPagoId && (() => {
        const p = pagos.find((x) => x.id === editingPagoId);
        if (!p) return null;
        return (
          <div className="p-4 border-t border-bd">
            <EditarPagoForm
              facturaId={factura.id}
              pagoId={p.id}
              referenciaActual={p.referencia}
              notasActuales={p.notas}
              onCancel={() => setEditingPagoId(null)}
              onSuccess={() => setEditingPagoId(null)}
            />
          </div>
        );
      })()}

      {confirmDelete && (
        <div className="p-4 border-t border-bd">
          <ConfirmRow
            message="¿Eliminar el pago? El saldo pendiente de la factura se recalculará."
            confirmLabel={eliminar.isPending ? 'Eliminando…' : 'Eliminar pago'}
            onCancel={() => setConfirmDelete(null)}
            onConfirm={async () => {
              try {
                await eliminar.mutateAsync({ facturaId: factura.id, pagoId: confirmDelete });
                setConfirmDelete(null);
              } catch {
                // toast manejado por el hook
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
