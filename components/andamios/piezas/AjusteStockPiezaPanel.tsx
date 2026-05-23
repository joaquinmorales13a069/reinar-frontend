'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '@/components/ui/Icon';
import { ajusteStockSchema, type AjusteStockInput } from '@/lib/schemas/andamios';
import { useAjustarStockPieza } from '@/hooks/use-andamios';

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk  = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-1';
const segCls = (active: boolean) =>
  `flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
    active ? 'bg-accent text-navy' : 'bg-surface text-tx-2 hover:bg-bg-sunken'
  }`;
const btnSec =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';
const btnPri =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

type Props = {
  piezaId: string;
  stockActual: number;
  onClose: () => void;
};

export function AjusteStockPiezaPanel({ piezaId, stockActual, onClose }: Props) {
  const ajustar = useAjustarStockPieza();
  const [signo, setSigno] = useState<'entrada' | 'salida'>('entrada');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AjusteStockInput>({
    resolver: zodResolver(ajusteStockSchema) as never,
    defaultValues: { signo: 'entrada', cantidad: undefined as unknown as number, motivo: '' },
  });

  const cantidadActual = watch('cantidad');
  const stockEstimado =
    typeof cantidadActual === 'number' && !Number.isNaN(cantidadActual)
      ? signo === 'entrada'
        ? stockActual + cantidadActual
        : stockActual - cantidadActual
      : stockActual;

  async function onSubmit(values: AjusteStockInput) {
    const delta = signo === 'entrada' ? values.cantidad : -values.cantidad;
    try {
      await ajustar.mutateAsync({
        id: piezaId,
        data: { delta, motivo: values.motivo.trim() },
      });
      onClose();
    } catch {
      // toast lo dispara el hook
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-lg border border-bd bg-surface p-4 flex flex-col gap-3 border-l-2 border-l-accent"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-tx">Ajustar stock</h3>
        <button
          type="button"
          className="text-tx-3 hover:text-tx"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <Icon name="x" size={14} />
        </button>
      </div>

      <div>
        <label className={labelCls}>Tipo de movimiento</label>
        <div className="flex rounded-md border border-bd overflow-hidden">
          <button type="button" className={segCls(signo === 'entrada')} onClick={() => setSigno('entrada')}>
            Entrada (+)
          </button>
          <button
            type="button"
            className={`${segCls(signo === 'salida')} border-l border-bd`}
            onClick={() => setSigno('salida')}
          >
            Salida (−)
          </button>
        </div>
        <input type="hidden" value={signo} {...register('signo')} />
      </div>

      <div>
        <label className={labelCls}>Cantidad *</label>
        <input
          className={errors.cantidad ? inputErr : `${inputOk} font-mono`}
          type="number"
          min="1"
          step="1"
          placeholder="0"
          {...register('cantidad')}
        />
        {errors.cantidad && <p className={errorCls}>{errors.cantidad.message}</p>}
        <p className="text-xs text-tx-3 mt-1">
          Stock actual: <span className="font-mono">{stockActual}</span> · Quedaría:{' '}
          <span className={`font-mono ${stockEstimado < 0 ? 'text-danger font-semibold' : stockEstimado === 0 ? 'text-warn font-semibold' : ''}`}>
            {stockEstimado}
          </span>
        </p>
      </div>

      <div>
        <label className={labelCls}>Motivo *</label>
        <input
          className={errors.motivo ? inputErr : inputOk}
          placeholder="Ej. Compra a proveedor / Pérdida en obra"
          {...register('motivo')}
        />
        {errors.motivo && <p className={errorCls}>{errors.motivo.message}</p>}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className={btnSec} onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className={btnPri} disabled={ajustar.isPending}>
          <Icon name="check" size={12} /> Confirmar ajuste
        </button>
      </div>
    </form>
  );
}
