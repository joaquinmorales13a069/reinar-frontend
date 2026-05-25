'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Decimal from 'decimal.js';
import { Icon } from '@/components/ui/Icon';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { registrarPagoSchema, type RegistrarPagoForm as Form } from '@/lib/schemas/factura';
import { useCrearPago } from '@/hooks/use-pagos';
import { formatCurrency } from '@/lib/utils';

const METODOS: { value: Form['metodoPago']; label: string }[] = [
  { value: 'EFECTIVO',       label: 'Efectivo' },
  { value: 'TRANSFERENCIA',  label: 'Transferencia' },
  { value: 'CHEQUE',         label: 'Cheque' },
  { value: 'TARJETA',        label: 'Tarjeta' },
  { value: 'OTRO',           label: 'Otro' },
];

// Fecha de hoy en TZ El Salvador (UTC-6). Convertimos a YYYY-MM-DD para el input date.
function hoyEnSv(): string {
  const now = new Date();
  const sv = new Date(now.toLocaleString('en-US', { timeZone: 'America/El_Salvador' }));
  const y = sv.getFullYear();
  const m = String(sv.getMonth() + 1).padStart(2, '0');
  const d = String(sv.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

type Props = {
  facturaId: string;
  saldoPendiente: string;
  onClose: () => void;
};

export function RegistrarPagoForm({ facturaId, saldoPendiente, onClose }: Props) {
  const crear = useCrearPago();
  const { register, handleSubmit, watch, formState: { errors }, setError } = useForm<Form>({
    resolver: zodResolver(registrarPagoSchema),
    defaultValues: {
      monto: new Decimal(saldoPendiente).toFixed(2),
      fecha: hoyEnSv(),
      metodoPago: 'TRANSFERENCIA',
    },
  });

  const monto = watch('monto');
  const saldo = new Decimal(saldoPendiente);
  // Sobrepago: el backend permite registrarlo; advertimos al usuario antes
  // de confirmar para evitar accidentes con montos mal tipeados.
  const sobrepago = (() => {
    try { return new Decimal(monto).gt(saldo); } catch { return false; }
  })();

  async function onSubmit(values: Form) {
    try {
      // Convertimos fecha YYYY-MM-DD a ISO datetime: el schema del backend
      // exige z.string().datetime().
      const fechaIso = new Date(values.fecha + 'T12:00:00.000Z').toISOString();
      await crear.mutateAsync({
        facturaId,
        data: { ...values, fecha: fechaIso },
      });
      onClose();
    } catch (err) {
      const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = anyErr?.response?.data?.error?.message;
      if (msg) setError('monto', { message: msg });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-bg-sunken border border-bd rounded-md p-4 space-y-3 mb-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-tx">Registrar pago</h4>
        <button type="button" onClick={onClose} className="text-tx-3 hover:text-tx" title="Cerrar">
          <Icon name="x" size={14} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div>
          <label className="block text-xs text-tx-3 mb-1">Monto</label>
          <input
            type="text"
            inputMode="decimal"
            {...register('monto')}
            className="w-full px-2 py-1.5 rounded border border-bd bg-bg font-mono"
          />
          {errors.monto && <p className="text-xs text-danger mt-1">{errors.monto.message}</p>}
        </div>
        <div>
          <label className="block text-xs text-tx-3 mb-1">Fecha</label>
          <input
            type="date"
            {...register('fecha')}
            className="w-full px-2 py-1.5 rounded border border-bd bg-bg font-mono"
          />
          {errors.fecha && <p className="text-xs text-danger mt-1">{errors.fecha.message}</p>}
        </div>
        <div>
          <label className="block text-xs text-tx-3 mb-1">Método</label>
          <select {...register('metodoPago')} className="w-full px-2 py-1.5 rounded border border-bd bg-bg">
            {METODOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className="sm:col-span-3">
          <label className="block text-xs text-tx-3 mb-1">Referencia</label>
          <input
            type="text"
            placeholder="N° transferencia, cheque…"
            {...register('referencia')}
            className="w-full px-2 py-1.5 rounded border border-bd bg-bg"
          />
        </div>
        <div className="sm:col-span-3">
          <label className="block text-xs text-tx-3 mb-1">Notas</label>
          <textarea
            rows={2}
            {...register('notas')}
            className="w-full px-2 py-1.5 rounded border border-bd bg-bg text-sm"
          />
          {errors.notas && <p className="text-xs text-danger mt-1">{errors.notas.message}</p>}
        </div>
      </div>
      {sobrepago && (
        <div className="flex items-center gap-2 bg-warn-soft text-warn text-xs rounded-md px-3 py-2">
          <Icon name="alertTriangle" size={12} />
          <span>El monto supera el saldo pendiente ({formatCurrency(saldoPendiente)}). Se registrará igual y la factura quedará en sobrepago.</span>
        </div>
      )}
      <ConfirmRow
        message="¿Registrar este pago? El saldo de la factura se recalculará."
        confirmLabel={crear.isPending ? 'Guardando…' : 'Registrar pago'}
        variant="primary"
        onCancel={onClose}
        onConfirm={handleSubmit(onSubmit)}
      />
    </form>
  );
}
