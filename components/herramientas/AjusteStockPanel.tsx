'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Icon } from '@/components/ui/Icon';
import { BodegaSelect } from '@/components/ui/BodegaSelect';
import { useAjustarStock } from '@/hooks/use-consumibles';

const schema = z.object({
  bodegaId: z.string().min(1, 'La bodega es obligatoria.'),
  signo: z.enum(['entrada', 'salida']),
  // El backend espera delta != 0; en UI separamos el signo del valor absoluto
  // para que el usuario no tenga que pensar en números negativos.
  cantidad: z.coerce.number().int().positive('Debe ser un entero mayor a 0.'),
  motivo: z.string().min(1, 'Indicá el motivo.').max(255, 'Máximo 255 caracteres.'),
});

type FormData = z.infer<typeof schema>;

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
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
  consumibleId: string;
  stockActual: number;
  unidad: string;
  onClose: () => void;
};

export function AjusteStockPanel({ consumibleId, stockActual, unidad, onClose }: Props) {
  const ajustar = useAjustarStock();
  const [signo, setSigno] = useState<'entrada' | 'salida'>('entrada');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    // zodResolver con z.coerce necesita el cast para evitar el conflicto de tipos
    // entre el input type (unknown) y el output type (number) del resolver.
    resolver: zodResolver(schema) as never,
    defaultValues: { bodegaId: '', signo: 'entrada', cantidad: undefined as unknown as number, motivo: '' },
  });

  const cantidadActual = watch('cantidad');
  // Stock estimado tras aplicar el ajuste; útil para que el usuario vea el efecto
  // antes de confirmar (especialmente para salidas que podrían dejarlo en negativo,
  // lo cual el backend rechazará).
  const stockEstimado =
    typeof cantidadActual === 'number' && !Number.isNaN(cantidadActual)
      ? signo === 'entrada'
        ? stockActual + cantidadActual
        : stockActual - cantidadActual
      : stockActual;

  async function onSubmit(values: FormData) {
    const delta = values.signo === 'entrada' ? values.cantidad : -values.cantidad;
    try {
      await ajustar.mutateAsync({
        id: consumibleId,
        data: { bodegaId: values.bodegaId, delta, motivo: values.motivo.trim() },
      });
      onClose();
    } catch {
      // toast lo dispara el hook
    }
  }

  return (
    <form
      className="rounded-lg border border-bd bg-surface p-4 flex flex-col gap-3"
      onSubmit={handleSubmit(onSubmit)}
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
        <label className={labelCls}>Bodega *</label>
        <BodegaSelect
          value={watch('bodegaId') ?? ''}
          onChange={(id) => setValue('bodegaId', id, { shouldValidate: true })}
          error={!!errors.bodegaId}
        />
        {errors.bodegaId && <p className={errorCls}>{errors.bodegaId.message}</p>}
        <input type="hidden" {...register('bodegaId')} />
      </div>

      <div>
        <label className={labelCls}>Tipo de movimiento</label>
        <div className="flex rounded-md border border-bd overflow-hidden">
          <button
            type="button"
            className={segCls(signo === 'entrada')}
            onClick={() => setSigno('entrada')}
          >
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
          Stock actual: <span className="font-mono">{stockActual} {unidad}</span> · Quedaría:{' '}
          <span className={`font-mono ${stockEstimado < 0 ? 'text-danger font-semibold' : ''}`}>
            {stockEstimado} {unidad}
          </span>
        </p>
      </div>

      <div>
        <label className={labelCls}>Motivo *</label>
        <input
          className={errors.motivo ? inputErr : inputOk}
          placeholder="Ej. Compra a proveedor / Uso en obra Las Flores"
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
