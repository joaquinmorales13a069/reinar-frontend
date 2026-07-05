'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { EstadoDteBadge } from '@/components/facturas/EstadoDteBadge';
import {
  useNotaCredito,
  useAnularDTENotaCredito,
} from '@/hooks/use-notas-credito';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency } from '@/lib/utils';

export default function AnularDteNotaCreditoPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: nc, isLoading } = useNotaCredito(id);
  const anular = useAnularDTENotaCredito();

  const [motivo, setMotivo] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const motivoLen = motivo.trim().length;
  const motivoValido = motivoLen >= 10 && motivoLen <= 500;

  // Defensa en profundidad: el menu no muestra esta accion a no-ADMIN,
  // pero si entran por URL directa les mostramos EmptyState (como en facturas).
  if (user && user.rol !== 'ADMIN') {
    return (
      <div>
        <PageHeader
          title="Anular nota de crédito"
          back
          backLabel="Detalle"
          onBack={() => router.push(`/notas-credito/${id}`)}
        />
        <EmptyState
          icon="shield"
          title="Solo administradores"
          message="Solo los administradores pueden anular un DTE."
        />
      </div>
    );
  }

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (!nc) return <EmptyState icon="alertTriangle" title="Nota no encontrada" message="" />;

  const cliente = nc.factura.cliente;
  const nombreCliente = cliente.razonSocial || `${cliente.nombre ?? ''} ${cliente.apellido ?? ''}`.trim();

  async function onConfirmar() {
    setConfirmando(false);
    try {
      await anular.mutateAsync(id);
      router.push(`/notas-credito/${id}`);
    } catch {
      // Toast manejado por el hook.
    }
  }

  return (
    <div>
      <PageHeader
        title={`Anular nota de crédito — ${nc.numero}`}
        subtitle="Acción restringida a usuarios ADMIN."
        back
        onBack={() => router.push(`/notas-credito/${id}`)}
      />

      <div className="rounded-md border border-danger bg-danger-soft p-4 mb-4 flex items-start gap-3">
        <Icon name="alertTriangle" size={20} />
        <div className="text-sm">
          <b>Esta acción es irreversible.</b> Se enviará la anulación al{' '}
          <b>Ministerio de Hacienda</b>. La nota quedará en estado <b>ANULADO</b>.
        </div>
      </div>

      <div className="rounded-md border border-bd p-4 mb-4">
        <h3 className="text-sm font-semibold mb-3">Datos de la nota de crédito</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-tx-3">N° NC</dt>
            <dd className="font-mono font-semibold">{nc.numero}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-tx-3">Factura origen</dt>
            <dd className="font-mono">{nc.factura.numeroFactura}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-tx-3">Cliente</dt>
            <dd>{nombreCliente}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-tx-3">Total acreditado</dt>
            <dd className="font-mono font-semibold text-danger">
              −{formatCurrency(nc.total)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-tx-3">N° control DTE</dt>
            <dd className="font-mono text-xs">{nc.dteControlNumber ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-tx-3">Estado actual</dt>
            <dd><EstadoDteBadge estado={nc.estadoDTE} /></dd>
          </div>
        </dl>
      </div>

      <div className="rounded-md border border-bd p-4 mb-4">
        <h3 className="text-sm font-semibold mb-3">Motivo de anulación</h3>
        <label className="block text-xs font-medium text-tx-2 mb-1">
          <div className="flex justify-between">
            <span>Motivo (registro interno) <span className="text-danger">*</span></span>
            <span
              className={`font-mono text-xs ${
                motivoValido ? 'text-ok' : motivoLen > 0 ? 'text-danger' : 'text-tx-3'
              }`}
            >
              {motivoLen} / 10 mín.
            </span>
          </div>
        </label>
        <textarea
          rows={5}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Describí el motivo de la anulación…"
          className="w-full px-2 py-1.5 rounded border border-bd bg-bg text-sm"
        />
        <div className="text-xs text-tx-3 mt-1">
          Este motivo se conserva en la bitácora interna. El motivo enviado al Ministerio de Hacienda es fijo según normativa.
        </div>
        {motivoLen > 0 && !motivoValido && (
          <div className="text-xs text-danger mt-1">
            El motivo debe tener al menos 10 caracteres.
          </div>
        )}
      </div>

      {confirmando && motivoValido && (
        <ConfirmRow
          message={
            <>
              Esta acción enviará la anulación de <b>{nc.numero}</b> al{' '}
              <b>Ministerio de Hacienda</b>. ¿Confirmar?
            </>
          }
          confirmLabel={anular.isPending ? 'Anulando…' : 'Sí, anular DTE'}
          onCancel={() => setConfirmando(false)}
          onConfirm={onConfirmar}
        />
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="px-3 py-1.5 text-sm rounded-md border border-bd text-tx-2 hover:bg-bg-sunken"
          onClick={() => router.push(`/notas-credito/${id}`)}
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!motivoValido || anular.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-danger text-danger hover:bg-danger-soft disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => setConfirmando(true)}
        >
          <Icon name="trash" size={14} /> Confirmar anulación
        </button>
      </div>
    </div>
  );
}
