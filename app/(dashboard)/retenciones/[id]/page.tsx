'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { FacturaEstadoBadge } from '@/components/facturas/FacturaEstadoBadge';
import {
  useRetencion,
  useEliminarRetencion,
  descargarRetencionPdf,
} from '@/hooks/use-retenciones';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function RetencionDetallePage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const esAdmin = user?.rol === 'ADMIN';

  const { data: ret, isLoading, error } = useRetencion(id);
  const eliminar = useEliminarRetencion();
  const [descargando, setDescargando] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error || !ret) {
    return <EmptyState icon="alertTriangle" title="Retención no encontrada" message="Revisá el enlace o volvé al listado." />;
  }

  const nombre = ret.cliente.razonSocial || `${ret.cliente.nombre ?? ''} ${ret.cliente.apellido ?? ''}`.trim();

  async function onDescargar() {
    setDescargando(true);
    // Non-null assertion necesaria: TS no estrecha el narrowing dentro de async closures.
    await descargarRetencionPdf(ret!.id, ret!.numeroCR);
    setDescargando(false);
  }

  async function onEliminar() {
    try {
      // Non-null assertion necesaria: TS no estrecha el narrowing dentro de async closures.
      await eliminar.mutateAsync({ id: ret!.id, facturaId: ret!.facturaId });
      router.push('/retenciones');
    } catch {
      // Toast manejado por el hook.
    }
  }

  return (
    <div>
      <PageHeader
        title={ret.numeroCR}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span>{nombre}</span>
            <span className="text-tx-3">·</span>
            <span className="px-2 py-0.5 rounded text-xs bg-warn-soft text-warn">
              {Number(ret.porcentaje).toFixed(2)}%
            </span>
          </span>
        }
        back
        onBack={() => router.push('/retenciones')}
        actions={
          <>
            <button
              type="button"
              disabled={descargando}
              onClick={onDescargar}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-bd text-tx-2 hover:bg-bg-sunken disabled:opacity-50"
            >
              <Icon name="download" size={14} /> Descargar PDF
            </button>
            {esAdmin && (
              <button
                type="button"
                onClick={() => setConfirmDel(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-bd text-danger hover:bg-danger-soft"
              >
                <Icon name="trash" size={14} /> Eliminar
              </button>
            )}
          </>
        }
      />

      {confirmDel && (
        <ConfirmRow
          message={
            <>¿Eliminar comprobante <b className="font-mono">{ret.numeroCR}</b>? Esta acción es permanente.</>
          }
          confirmLabel={eliminar.isPending ? 'Eliminando…' : 'Sí, eliminar'}
          onCancel={() => setConfirmDel(false)}
          onConfirm={onEliminar}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-md border border-bd p-4">
            <h3 className="text-sm font-semibold mb-3">Comprobante</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-tx-3">Número CR</dt><dd className="font-mono">{ret.numeroCR}</dd></div>
              <div className="flex justify-between"><dt className="text-tx-3">Porcentaje</dt><dd className="font-mono">{Number(ret.porcentaje).toFixed(2)}%</dd></div>
              <div className="flex justify-between"><dt className="text-tx-3">Monto retenido</dt><dd className="font-mono font-semibold text-warn">{formatCurrency(ret.monto)}</dd></div>
              <div className="flex justify-between"><dt className="text-tx-3">Fecha</dt><dd className="font-mono">{formatDate(ret.fecha)}</dd></div>
              <div className="flex justify-between"><dt className="text-tx-3">Cliente</dt><dd>{nombre}</dd></div>
            </dl>
          </div>

          {ret.notas && (
            <div className="rounded-md border border-bd p-4">
              <h3 className="text-sm font-semibold mb-2">Notas</h3>
              <p className="text-sm text-tx-2 leading-relaxed">{ret.notas}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-md border border-bd p-4">
            <h3 className="text-sm font-semibold mb-3">Factura vinculada</h3>
            <Link
              href={`/facturas/${ret.factura.id}`}
              className="font-mono font-semibold text-accent hover:underline"
            >
              {ret.factura.numeroFactura}
            </Link>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-tx-3">Total factura</dt><dd className="font-mono">{formatCurrency(ret.factura.total)}</dd></div>
              <div className="flex justify-between"><dt className="text-tx-3">Emisión</dt><dd className="font-mono">{formatDate(ret.factura.fechaEmision)}</dd></div>
              <div className="flex justify-between"><dt className="text-tx-3">Estado</dt><dd><FacturaEstadoBadge estado={ret.factura.estado} /></dd></div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
