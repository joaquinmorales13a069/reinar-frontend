'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { useActa, useCambiarEstadoActa } from '@/hooks/use-actas';
import { useAuthStore } from '@/stores/auth.store';
import { despachoFormSchema, type DespachoForm } from '@/lib/schemas/acta';

const inputBase = 'w-full px-3 py-2 text-sm rounded-md border border-bd bg-surface text-tx focus:outline-none focus:border-accent transition-colors';
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';

export default function DespachoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: acta, isLoading } = useActa(id);
  const cambiar = useCambiarEstadoActa();
  const form = useForm<DespachoForm>({
    resolver: zodResolver(despachoFormSchema),
    defaultValues: { numeroActaFisico: '', observacionesSalida: '' },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (!acta) return <EmptyState icon="clipboard" title="Acta no encontrada" message="El acta solicitada no existe o fue eliminada." />;
  if (acta.estado !== 'PENDIENTE') {
    return (
      <div>
        <PageHeader title={`Despacho — ${acta.numeroActa}`} back />
        <EmptyState
          icon="clipboard"
          title="No aplica"
          message={`Esta acta está en estado ${acta.estado}. Solo se puede despachar un acta PENDIENTE.`}
        />
      </div>
    );
  }
  if (!user) return null;

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await cambiar.mutateAsync({
        id,
        data: {
          estado: 'DESPACHADO',
          // Auto-asigna al usuario actual: quien registra el despacho es quien lo hace.
          usuarioDespachoId: user.id,
          numeroActaFisico: data.numeroActaFisico.trim(),
          observacionesSalida: data.observacionesSalida || undefined,
        },
      });
      router.push(`/actas/${id}`);
    } catch {
      // hook ya toasteó el error (incluye INSPECCION_INCOMPLETA del backend)
    }
  });

  return (
    <form onSubmit={onSubmit}>
      <PageHeader
        title="Registrar despacho"
        subtitle={<><span className="font-mono">{acta.numeroActa}</span> · <Badge status={acta.estado} /></>}
        back
      />

      <div className="rounded-md border border-info-soft bg-info-soft/40 border-l-4 border-l-info p-4 mb-4 text-sm text-tx">
        Al confirmar, el acta pasará a estado <b>DESPACHADO</b> y se registrará la fecha actual de despacho.
      </div>

      <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
        <div className="mb-3">
          <span className={labelCls}>Despachado por</span>
          <div className="text-sm text-tx font-medium">{user.nombre} {user.apellido}</div>
          <div className="text-xs text-tx-3 mt-0.5">Se asigna automáticamente al usuario actual.</div>
        </div>
        <div className="mb-3">
          <label className={labelCls}>
            Folio físico (correlativo Reinar) <span className="text-danger">*</span>
          </label>
          <input
            {...form.register('numeroActaFisico')}
            className={`${inputBase} font-mono`}
            placeholder="Ej. A-0001234"
          />
          {form.formState.errors.numeroActaFisico && (
            <div className="text-xs text-danger mt-1">{form.formState.errors.numeroActaFisico.message}</div>
          )}
          <div className="text-xs text-tx-3 mt-1">Número del talonario físico solicitado al control de acta.</div>
        </div>
        <div>
          <label className={labelCls}>Observaciones de salida</label>
          <textarea
            {...form.register('observacionesSalida')}
            rows={3}
            className={inputBase}
            placeholder="Condiciones del despacho, transporte, etc."
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => router.push(`/actas/${id}`)} className="px-3 py-1.5 text-sm rounded-md border border-bd text-tx hover:bg-bg-sunken transition-colors">Cancelar</button>
        <button type="submit" disabled={cambiar.isPending} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60">
          <Icon name="send" size={14} /> {cambiar.isPending ? 'Registrando…' : 'Confirmar despacho'}
        </button>
      </div>
    </form>
  );
}
