'use client';

import Decimal from 'decimal.js';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '@/components/ui/Icon';
import { FormSection } from '@/components/ui/FormSection';
import { useActualizarCotizacion } from '@/hooks/use-cotizaciones';
import { step3Schema } from '@/lib/schemas/cotizacion';
import { formatCurrency } from '@/lib/utils';
import type { z } from 'zod';
import type { Cotizacion, CondicionesPago } from '@/types/api';

// Usar el tipo de INPUT del schema (antes de defaults) para que useForm
// no colisione con los campos que tienen .default() en el schema de salida.
type Step3Form = z.input<typeof step3Schema>;

type Props = { cotizacion: Cotizacion; onBack: () => void; onNext: () => void };

const CONDICIONES: { value: CondicionesPago; label: string }[] = [
  { value: 'CONTADO', label: 'Contado' },
  { value: 'CREDITO', label: 'Crédito' },
  { value: 'OTRO',    label: 'Otro' },
];

export function Step3Terminos({ cotizacion, onBack, onNext }: Props) {
  const actualizar = useActualizarCotizacion();

  // Solo soportamos modo MONTO porque el porcentaje se calculo en backend al
  // momento de generar la factura. Si la cotizacion ya trae depositoMonto
  // persistido lo respetamos; en cualquier otro caso arrancamos en NINGUNO.
  const depositoModoInicial: Step3Form['depositoModo'] =
    cotizacion.depositoMonto ? 'MONTO' : 'NINGUNO';

  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } = useForm<Step3Form>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      condicionesPago: cotizacion.condicionesPago ?? null,
      porcentajeIva: cotizacion.porcentajeIva,
      depositoModo: depositoModoInicial,
      depositoMonto: cotizacion.depositoMonto ? Number(cotizacion.depositoMonto) : null,
      notas: cotizacion.notas,
      notasInternas: cotizacion.notasInternas,
    },
  });

  const modo = watch('depositoModo');
  const depMonto = watch('depositoMonto');
  const iva = watch('porcentajeIva');

  // Calculos en vivo para que el vendedor vea el contexto del deposito.
  // Recalculamos a partir del subtotal + el IVA del form (no del persistido)
  // para que el total y el porcentaje equivalente reflejen lo que se ve.
  const subtotalDecimal = new Decimal(cotizacion.subtotal);
  const ivaPct = new Decimal(typeof iva === 'number' && !isNaN(iva) ? iva : cotizacion.porcentajeIva);
  const totalDecimal = subtotalDecimal
    .mul(new Decimal(100).plus(ivaPct))
    .div(100)
    .toDecimalPlaces(2);

  const porcentajeEquivalente =
    modo === 'MONTO' && depMonto && totalDecimal.greaterThan(0)
      ? new Decimal(depMonto).div(totalDecimal).mul(100).toDecimalPlaces(2)
      : null;

  async function onSubmit(values: Step3Form) {
    await actualizar.mutateAsync({
      id: cotizacion.id,
      data: {
        // || en vez de ?? para convertir "" del <select> a undefined; el backend
        // valida cuid()/enum y rechaza string vacio como invalido.
        condicionesPago: values.condicionesPago || undefined,
        porcentajeIva: values.porcentajeIva,
        notas: values.notas || undefined,
        notasInternas: values.notasInternas || undefined,
        depositoMonto: values.depositoModo === 'MONTO' ? (values.depositoMonto ?? undefined) : undefined,
      },
    });
    onNext();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <FormSection title="Términos comerciales">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-tx mb-1.5">Condiciones de pago</label>
            <select
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx"
              {...register('condicionesPago')}
            >
              <option value="">— No especificar —</option>
              {CONDICIONES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-tx mb-1.5">% IVA</label>
            <input
              type="number"
              step="0.01"
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx font-mono"
              {...register('porcentajeIva', { valueAsNumber: true })}
            />
            {errors.porcentajeIva && (
              <p className="text-xs text-danger mt-1">{errors.porcentajeIva.message}</p>
            )}
          </div>
        </div>
        <p className="text-xs text-tx-3 mt-3">
          El tipo de documento fiscal y el contacto de facturación se eligen al generar la factura.
        </p>
      </FormSection>

      <FormSection title="Depósito (opcional)">
        {/* Total de referencia: ayuda al vendedor a dimensionar el deposito. */}
        <div className="flex items-baseline justify-between mb-3 p-3 bg-bg-sunken rounded-md">
          <span className="text-sm text-tx-2">
            Total de la cotización
            {ivaPct.toString() !== String(cotizacion.porcentajeIva) && (
              <span className="ml-2 text-xs text-tx-3">(con IVA {ivaPct.toString()}% sin guardar)</span>
            )}
          </span>
          <span className="font-mono text-base font-semibold text-tx">
            {formatCurrency(totalDecimal.toFixed(2))}
          </span>
        </div>

        <Controller
          control={control}
          name="depositoModo"
          render={({ field }) => (
            <div className="flex gap-3 mb-3">
              {(['NINGUNO', 'MONTO'] as const).map((m) => (
                <label key={m} className="inline-flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={field.value === m}
                    onChange={() => field.onChange(m)}
                    className="accent-accent"
                  />
                  {m === 'NINGUNO' ? 'Sin depósito' : 'Monto fijo'}
                </label>
              ))}
            </div>
          )}
        />

        {modo === 'MONTO' && (
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-tx mb-1.5">Monto fijo ($)</label>
            <input
              type="number"
              step="0.01"
              min={0.01}
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx font-mono"
              {...register('depositoMonto', { valueAsNumber: true })}
            />
            {errors.depositoMonto && (
              <p className="text-xs text-danger mt-1">{errors.depositoMonto.message}</p>
            )}
            {porcentajeEquivalente && (
              <p className="text-xs text-tx-2 mt-2">
                Equivale al <span className="font-mono font-semibold text-tx">{porcentajeEquivalente.toString()}%</span> del total
              </p>
            )}
          </div>
        )}
      </FormSection>

      <FormSection title="Notas">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-tx mb-1.5">Notas para el cliente</label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
              placeholder="Aclaraciones, exclusiones, etc."
              {...register('notas')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-tx mb-1.5">
              <Icon name="shield" size={12} className="inline mr-1" />
              Notas internas <span className="text-xs text-tx-3 font-normal">(no visibles al cliente)</span>
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
              {...register('notasInternas')}
            />
          </div>
        </div>
      </FormSection>

      <div className="flex justify-between gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-tx-2 border border-bd hover:bg-bg-sunken transition-colors"
          onClick={onBack}
        >
          <Icon name="arrowLeft" size={14} /> Anterior
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors disabled:opacity-50"
        >
          Siguiente <Icon name="arrowRight" size={14} />
        </button>
      </div>
    </form>
  );
}
