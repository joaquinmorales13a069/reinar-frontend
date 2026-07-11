'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { EstadoDteBadge } from '@/components/facturas/EstadoDteBadge';
import { FseDtePanel } from '@/components/fse/FseDtePanel';
import {
  useFse,
  useEmitirDteFse,
  useAnularDteFse,
  useSincronizarDteFse,
  useEliminarFse,
  descargarFsePdf,
  descargarFseJson,
  descargarConstanciaRetencion,
} from '@/hooks/use-fse';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, formatDate } from '@/lib/utils';
import { LABEL_TIPO_DOCUMENTO } from '@/lib/format-documentos';

const TIPO_ITEM_LABEL: Record<'BIENES' | 'SERVICIOS', string> = {
  BIENES: 'Bienes',
  SERVICIOS: 'Servicios',
};

export default function FseDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: fse, isLoading, error } = useFse(id);

  const emitirDte = useEmitirDteFse(id);
  const anularDte = useAnularDteFse(id);
  const sincronizarDte = useSincronizarDteFse(id);
  const eliminar = useEliminarFse();

  const [emitirError, setEmitirError] = useState<string | null>(null);
  const [anularError, setAnularError] = useState<string | null>(null);
  const [descargandoPdf, setDescargandoPdf] = useState(false);
  const [descargandoJson, setDescargandoJson] = useState(false);
  const [descargandoConstancia, setDescargandoConstancia] = useState(false);
  const [confirmEliminar, setConfirmEliminar] = useState(false);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error) {
    return (
      <EmptyState
        icon="fileText"
        title="No se pudo cargar"
        message="Hubo un problema al cargar la FSE. Refrescá la página para reintentar."
      />
    );
  }
  if (!fse) {
    return <EmptyState icon="fileText" title="No encontrada" message="La FSE no existe." />;
  }

  // ADMIN|GERENTE|OPERADOR — mismo set que el backend exige para editar,
  // eliminar, emitir/re-emitir y sincronizar (fse.routes.ts). Solo anular es
  // exclusivo de ADMIN.
  const isAdmin = user?.rol === 'ADMIN';
  const isOperador = user?.rol === 'ADMIN' || user?.rol === 'GERENTE' || user?.rol === 'OPERADOR';

  const puedeEditar = isOperador && (fse.estadoDTE === 'PENDIENTE' || fse.estadoDTE === 'RECHAZADO');
  const puedeEliminar = isOperador && fse.estadoDTE === 'PENDIENTE' && !fse.dteId;

  async function emitir() {
    setEmitirError(null);
    try {
      await emitirDte.mutateAsync();
    } catch (err) {
      const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
      setEmitirError(anyErr?.response?.data?.error?.message ?? null);
    }
  }

  async function anular(motivo: string) {
    setAnularError(null);
    try {
      await anularDte.mutateAsync(motivo);
    } catch (err) {
      const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
      setAnularError(anyErr?.response?.data?.error?.message ?? 'No se pudo anular el DTE.');
    }
  }

  async function descargarPdf() {
    setDescargandoPdf(true);
    try {
      await descargarFsePdf(id, fse!.numeroFse);
    } finally {
      setDescargandoPdf(false);
    }
  }

  async function descargarJson() {
    setDescargandoJson(true);
    try {
      await descargarFseJson(id, fse!.numeroFse);
    } finally {
      setDescargandoJson(false);
    }
  }

  async function descargarConstancia() {
    setDescargandoConstancia(true);
    try {
      await descargarConstanciaRetencion(id, fse!.numeroFse);
    } finally {
      setDescargandoConstancia(false);
    }
  }

  async function eliminarFse() {
    try {
      await eliminar.mutateAsync(id);
      router.push('/fse');
    } catch {
      // useEliminarFse ya muestra toast.error internamente
    }
  }

  const filaTotal = 'flex items-center justify-between py-1.5 text-sm';

  return (
    <div>
      <PageHeader
        title={fse.numeroFse}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span>{fse.proveedor.nombre}</span>
            <span className="text-tx-3">·</span>
            <EstadoDteBadge estado={fse.estadoDTE} />
          </span>
        }
        back
        backLabel="FSE"
        onBack={() => router.push('/fse')}
        actions={
          <>
            {puedeEditar && (
              <Link
                href={`/fse/${id}/editar`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-bd text-tx-2 hover:bg-bg-sunken"
              >
                <Icon name="edit" size={14} /> Editar
              </Link>
            )}
            {puedeEliminar && !confirmEliminar && (
              <button
                type="button"
                onClick={() => setConfirmEliminar(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-danger text-danger hover:bg-danger-soft"
              >
                <Icon name="trash" size={14} /> Eliminar
              </button>
            )}
          </>
        }
      />

      {puedeEliminar && confirmEliminar && (
        <ConfirmRow
          message={`¿Eliminar el FSE ${fse.numeroFse}? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          onCancel={() => setConfirmEliminar(false)}
          onConfirm={() => { void eliminarFse(); }}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <h3 className="text-sm font-semibold mb-3">Proveedor</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-tx-3">Nombre</dt>
              <dd className="text-tx-2">
                <Link href={`/proveedores/${fse.proveedor.id}`} className="text-accent-dim hover:underline">
                  {fse.proveedor.nombre}
                </Link>
              </dd>
              <dt className="text-tx-3">Documento</dt>
              <dd className="font-mono text-tx-2">
                {fse.proveedor.tipoDocumento
                  ? `${LABEL_TIPO_DOCUMENTO[fse.proveedor.tipoDocumento]} — ${fse.proveedor.numeroDocumento ?? '—'}`
                  : '—'}
              </dd>
              <dt className="text-tx-3">Fecha de emisión</dt>
              <dd className="font-mono text-tx-2">{formatDate(fse.fechaEmision)}</dd>
              <dt className="text-tx-3">Condición de pago</dt>
              <dd className="text-tx-2">{fse.condicionPago === 'CONTADO' ? 'Contado' : 'Crédito'}</dd>
            </dl>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold mb-3">Ítems</h3>
            <div className="overflow-x-auto rounded-md border border-bd">
              <table className="w-full text-sm">
                <thead className="bg-bg-sunken text-2xs uppercase tracking-wider text-tx-3">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Tipo</th>
                    <th className="text-left font-medium px-3 py-2">Descripción</th>
                    <th className="text-right font-medium px-3 py-2">Cantidad</th>
                    <th className="text-right font-medium px-3 py-2">Precio unitario</th>
                    <th className="text-right font-medium px-3 py-2">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {fse.items.map((it) => (
                    <tr key={it.id} className="border-t border-bd">
                      <td className="px-3 py-2 text-tx-2">{TIPO_ITEM_LABEL[it.tipoItem]}</td>
                      <td className="px-3 py-2 text-tx">{it.descripcion}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{it.cantidad}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-mono">{formatCurrency(it.precioUnitario)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-mono font-medium">{formatCurrency(it.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {fse.exonerarReteRenta && (
            <div className="flex items-start gap-2 bg-info-soft text-info rounded-md px-4 py-3 text-sm">
              <Icon name="info" size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Retención de renta exonerada</p>
                <p className="text-tx-2">{fse.motivoExoneracion ?? 'Sin motivo especificado.'}</p>
              </div>
            </div>
          )}

          {fse.notas && (
            <Card>
              <h3 className="text-sm font-semibold mb-2">Notas</h3>
              <p className="text-sm text-tx-2 leading-relaxed whitespace-pre-wrap">{fse.notas}</p>
            </Card>
          )}

          <FseDtePanel
            fse={fse}
            isAdmin={isAdmin}
            isOperador={isOperador}
            emitirError={emitirError}
            isEmitiendo={emitirDte.isPending}
            isSincronizando={sincronizarDte.isPending}
            isDescargandoPdf={descargandoPdf}
            isDescargandoJson={descargandoJson}
            isDescargandoConstancia={descargandoConstancia}
            anularError={anularError}
            isAnulando={anularDte.isPending}
            onEmitir={() => { void emitir(); }}
            onReemitir={() => { void emitir(); }}
            onSincronizar={() => { void sincronizarDte.mutateAsync(); }}
            onAnular={(motivo) => { void anular(motivo); }}
            onDescargarPdf={() => { void descargarPdf(); }}
            onDescargarJson={() => { void descargarJson(); }}
            onDescargarConstancia={() => { void descargarConstancia(); }}
          />
        </div>

        <div className="space-y-4">
          {/* Totales persistidos por el backend — no se recalculan en el
              frontend para que siempre reflejen exactamente lo que se envió
              (o se enviará) al Ministerio de Hacienda. */}
          <div className="rounded-lg border border-bd bg-surface p-4">
            <h3 className="text-sm font-semibold text-tx mb-2">Totales</h3>
            <div className="divide-y divide-bd">
              <div className={filaTotal}>
                <span className="text-tx-2">Subtotal bienes</span>
                <span className="font-mono tabular-nums">{formatCurrency(fse.subtotalBienes)}</span>
              </div>
              <div className={filaTotal}>
                <span className="text-tx-2">Subtotal servicios</span>
                <span className="font-mono tabular-nums">{formatCurrency(fse.subtotalServicios)}</span>
              </div>
              <div className={filaTotal}>
                <span className="text-tx-2">Total compra</span>
                <span className="font-mono tabular-nums font-medium">{formatCurrency(fse.totalCompra)}</span>
              </div>
              <div className={`${filaTotal} text-danger`}>
                <span>Retención renta{fse.exonerarReteRenta ? ' — exonerada' : ''}</span>
                <span className="font-mono tabular-nums">−{formatCurrency(fse.reteRenta)}</span>
              </div>
              <div className={`${filaTotal} pt-2`}>
                <span className="text-tx font-semibold">Total a pagar</span>
                <span className="font-mono tabular-nums text-lg font-bold text-accent-dim">
                  {formatCurrency(fse.totalPagar)}
                </span>
              </div>
            </div>
          </div>

          <Card>
            <h3 className="text-sm font-semibold mb-3">Registro</h3>
            <dl className="grid grid-cols-1 gap-y-2 text-sm">
              <dt className="text-tx-3">Creado por</dt>
              <dd className="text-tx-2">{fse.creadoPor.nombre} {fse.creadoPor.apellido}</dd>
              <dt className="text-tx-3">Creado</dt>
              <dd className="font-mono text-tx-2 text-xs">{formatDate(fse.createdAt)}</dd>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
