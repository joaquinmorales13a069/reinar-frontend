'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '@/components/ui/Icon';
import { useAgregarItemCotizacion } from '@/hooks/use-cotizaciones';
import { customItemSchema, type CustomItemForm } from '@/lib/schemas/cotizacion';
import type { TabChildProps } from './index';

export function TabCustom({ cotizacionId, onAdded }: TabChildProps) {
  const agregar = useAgregarItemCotizacion();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomItemForm>({
    resolver: zodResolver(customItemSchema),
    defaultValues: { descripcion: '', monto: 0 },
  });

  async function onSubmit(values: CustomItemForm) {
    await agregar.mutateAsync({
      id: cotizacionId,
      data: {
        tipo: 'CUSTOM',
        descripcion: values.descripcion,
        cantidad: 1,
        // El backend espera string Decimal; convertimos con 2 decimales.
        tarifaCustom: values.monto.toFixed(2),
      },
    });
    onAdded();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-tx mb-1">
          Descripción <span className="text-danger">*</span>
        </label>
        <input
          className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
          placeholder="Ej. Servicio especial fuera de catálogo"
          {...register('descripcion')}
        />
        {errors.descripcion && <p className="text-xs text-danger mt-1">{errors.descripcion.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-tx mb-1">
          Monto total ($) <span className="text-danger">*</span>
        </label>
        <input
          type="number"
          step="0.01"
          className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx font-mono"
          {...register('monto', { valueAsNumber: true })}
        />
        {errors.monto && <p className="text-xs text-danger mt-1">{errors.monto.message}</p>}
      </div>

      <div className="flex justify-end pt-3 border-t border-bd">
        <button
          type="submit"
          disabled={agregar.isPending}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors disabled:opacity-50"
        >
          <Icon name="plus" size={14} /> Agregar
        </button>
      </div>
    </form>
  );
}
