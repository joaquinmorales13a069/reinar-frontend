'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '@/components/ui/Icon';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { ajustarEstadoSchema, type AjustarEstadoForm } from '@/lib/schemas/factura';
import { useCambiarEstadoFactura } from '@/hooks/use-facturas';
import type { Factura, EstadoFacturaEditable } from '@/types/api';

const ESTADOS_LABEL: Record<EstadoFacturaEditable, string> = {
  PENDIENTE: 'Pendiente',
  PARCIAL: 'Parcial',
  VENCIDA: 'Vencida',
  ANULADA: 'Anulada',
};

type Props = {
  factura: Factura;
  onClose: () => void;
};

export function AjustarEstadoCard({ factura, onClose }: Props) {
  const cambiar = useCambiarEstadoFactura();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setError,
  } = useForm<AjustarEstadoForm>({
    resolver: zodResolver(ajustarEstadoSchema),
  });
  const nuevoEstado = watch('estado');

  // Filtrar estados disponibles: excluir el actual y excluir PAGADA siempre
  // (el backend la calcula automaticamente desde pagos).
  const disponibles = (Object.keys(ESTADOS_LABEL) as EstadoFacturaEditable[]).filter(
    (e) => e !== (factura.estado as EstadoFacturaEditable),
  );

  async function onSubmit(values: AjustarEstadoForm) {
    try {
      await cambiar.mutateAsync({ id: factura.id, data: values });
      onClose();
    } catch (err) {
      const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = anyErr?.response?.data?.error?.message;
      if (msg) setError('estado', { message: msg });
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-bg border-l-2 border-l-info border border-bd rounded-md p-4 space-y-3"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-tx mb-1">Ajustar estado de la factura</h3>
          <p className="text-xs text-tx-3">
            Override manual del estado de pago. Quedará registrado en la auditoría.
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-tx-3 hover:text-tx" title="Cerrar">
          <Icon name="x" size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-tx-3 mb-1">
            Nuevo estado <span className="text-danger">*</span>
          </label>
          <select
            {...register('estado')}
            className="w-full px-2 py-1.5 rounded border border-bd bg-bg text-sm"
            defaultValue=""
          >
            <option value="">— Seleccionar —</option>
            {disponibles.map((e) => (
              <option key={e} value={e}>
                {ESTADOS_LABEL[e]}
              </option>
            ))}
          </select>
          {errors.estado && <p className="text-xs text-danger mt-1">{errors.estado.message}</p>}
          <p className="text-xs text-tx-3 mt-1">
            PAGADA se asigna automáticamente al registrar pagos que cubran el total.
          </p>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-tx-3 mb-1">
            Motivo del ajuste <span className="text-danger">*</span>
          </label>
          <textarea
            rows={2}
            {...register('motivo')}
            placeholder="Ej: Pago recibido en efectivo no registrado previamente."
            className="w-full px-2 py-1.5 rounded border border-bd bg-bg text-sm"
          />
          {errors.motivo && <p className="text-xs text-danger mt-1">{errors.motivo.message}</p>}
        </div>
      </div>

      <ConfirmRow
        message={
          nuevoEstado
            ? `Cambiarás el estado de ${factura.numeroFactura} de ${factura.estado} a ${nuevoEstado}. Esta acción queda registrada en la auditoría.`
            : 'Seleccioná el nuevo estado y describí el motivo del ajuste.'
        }
        confirmLabel={cambiar.isPending ? 'Guardando…' : 'Confirmar ajuste'}
        variant="primary"
        onCancel={onClose}
        onConfirm={handleSubmit(onSubmit)}
      />
    </form>
  );
}
