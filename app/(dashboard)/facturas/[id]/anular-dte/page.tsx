'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { FacturaEstadoBadge } from '@/components/facturas/FacturaEstadoBadge';
import { TipoDteBadge } from '@/components/facturas/TipoDteBadge';
import { EstadoDteBadge } from '@/components/facturas/EstadoDteBadge';
import { useFactura, useCambiarEstadoFactura } from '@/hooks/use-facturas';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency } from '@/lib/utils';
import { anularFacturaSchema, type AnularFacturaForm } from '@/lib/schemas/factura';
import type { Cliente } from '@/types/api';

// Para clientes EMPRESA mostramos razonSocial; para PARTICULAR concatenamos
// nombre+apellido. razonSocial puede venir vacio aun en EMPRESA por datos
// historicos, por eso hay fallback al nombre comercial / nombre.
function nombreCliente(cliente: Cliente): string {
  if (cliente.tipo === 'EMPRESA') {
    return cliente.razonSocial?.trim() || cliente.nombreComercial?.trim() || cliente.nombre?.trim() || '—';
  }
  const partes = [cliente.nombre, cliente.apellido].filter(Boolean).join(' ').trim();
  return partes || '—';
}

export default function AnularDtePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: factura, isLoading, error } = useFactura(id);
  const cambiar = useCambiarEstadoFactura();
  const [confirmando, setConfirmando] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AnularFacturaForm>({
    resolver: zodResolver(anularFacturaSchema),
    defaultValues: { motivo: '' },
  });
  const motivo = watch('motivo') ?? '';
  const motivoLen = motivo.trim().length;
  const motivoValido = motivoLen >= 10;

  // Guard client-side: el middleware no puede leer el rol (accessToken vive en
  // memoria, no en cookie). Renderizamos un EmptyState con CTA.
  if (user && user.rol !== 'ADMIN') {
    return (
      <div>
        <PageHeader
          title="Anular DTE"
          back
          backLabel="Detalle"
          onBack={() => router.push(`/facturas/${id}`)}
        />
        <EmptyState
          icon="shield"
          title="Solo administradores"
          message="Solo los administradores pueden anular un DTE."
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }
  if (error || !factura) {
    return (
      <EmptyState
        icon="fileText"
        title="No se pudo cargar"
        message="Refrescá para reintentar."
      />
    );
  }

  // Precondicion del backend: solo se puede anular un DTE APROBADO.
  if (factura.estadoDTE !== 'APROBADO') {
    toast.info('El DTE no está aprobado, no se puede anular.');
    router.replace(`/facturas/${id}`);
    return null;
  }

  async function onSubmit(values: AnularFacturaForm) {
    try {
      await cambiar.mutateAsync({
        id,
        data: { estado: 'ANULADA', motivo: values.motivo },
      });
      router.push(`/facturas/${id}`);
    } catch {
      // toast manejado por el hook
    }
  }

  return (
    <div>
      <PageHeader
        title={`Anular DTE — ${factura.numeroFactura}`}
        subtitle="Acción restringida a usuarios con rol ADMIN."
        back
        backLabel="Detalle"
        onBack={() => router.push(`/facturas/${id}`)}
        actions={<FacturaEstadoBadge estado={factura.estado} />}
      />

      <div className="flex items-start gap-2 bg-danger-soft text-danger rounded-md px-4 py-3 mb-4 text-sm">
        <Icon name="alertTriangle" size={18} />
        <div className="space-y-1">
          <p><b>Esta acción es irreversible y tiene efecto cascada:</b></p>
          <ul className="list-disc list-inside ml-2 space-y-0.5">
            <li>El DTE se anulará ante el Ministerio de Hacienda y no podrá emitirse nuevamente bajo el mismo número de control.</li>
            <li>La factura quedará en estado <b>ANULADA</b>.</li>
            <li>La cotización origen pasará a <b>CANCELADA</b> (no se puede re-aprobar; hay que crear una nueva si se quiere rehacer).</li>
            <li>Los equipos incluidos vuelven a estado disponible; herramientas y consumibles se liberan a través del flujo de acta/recepción.</li>
          </ul>
        </div>
      </div>

      <div className="bg-bg border border-bd rounded-md p-4 mb-4">
        <h3 className="text-sm font-medium text-tx mb-3">Datos de la factura</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 text-sm">
          <dt className="text-tx-3">N° factura</dt>
          <dd className="font-mono font-semibold">{factura.numeroFactura}</dd>
          <dt className="text-tx-3">Cliente</dt>
          <dd>{nombreCliente(factura.cliente)}</dd>
          <dt className="text-tx-3">Total</dt>
          <dd className="font-mono font-semibold">
            {formatCurrency(factura.total)}
          </dd>
          <dt className="text-tx-3">Tipo DTE</dt>
          <dd>{factura.tipoDTE && <TipoDteBadge tipo={factura.tipoDTE} />}</dd>
          <dt className="text-tx-3">N° de control DTE</dt>
          <dd className="font-mono text-xs">
            {factura.dteControlNumber ?? '—'}
          </dd>
          <dt className="text-tx-3">Estado actual</dt>
          <dd>
            <EstadoDteBadge estado={factura.estadoDTE} />
          </dd>
        </dl>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-bg border border-bd rounded-md p-4 mb-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-tx">Motivo de anulación</h3>
          <span
            className={`font-mono text-xs ${
              motivoValido
                ? 'text-ok'
                : motivoLen > 0
                  ? 'text-danger'
                  : 'text-tx-3'
            }`}
          >
            {motivoLen} / 10 mín.
          </span>
        </div>
        <textarea
          rows={5}
          {...register('motivo')}
          placeholder="Describir el motivo de la anulación según normativa tributaria…"
          className="w-full px-2 py-1.5 rounded border border-bd bg-bg text-sm"
        />
        {motivoLen > 0 && !motivoValido && (
          <p className="text-xs text-danger">
            El motivo debe tener al menos 10 caracteres.
          </p>
        )}
        {errors.motivo && motivoLen === 0 && (
          <p className="text-xs text-danger">{errors.motivo.message}</p>
        )}

        {confirmando && motivoValido && (
          <ConfirmRow
            message={`Esta acción enviará la anulación de ${factura.numeroFactura} al Ministerio de Hacienda y dejará la factura en estado ANULADA. ¿Estás seguro?`}
            confirmLabel={cambiar.isPending ? 'Anulando…' : 'Sí, anular DTE'}
            onCancel={() => setConfirmando(false)}
            onConfirm={handleSubmit(onSubmit)}
          />
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-bd">
          <button
            type="button"
            className="inline-flex items-center px-3 py-1.5 rounded-md text-sm border border-bd text-tx-2 hover:bg-bg-sunken"
            onClick={() => router.push(`/facturas/${id}`)}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!motivoValido}
            onClick={() => setConfirmando(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border border-danger text-danger hover:bg-danger-soft disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name="trash" size={14} /> Confirmar anulación
          </button>
        </div>
      </form>
    </div>
  );
}
