'use client';

import { useState } from 'react';
import Decimal from 'decimal.js';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '@/components/ui/Icon';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { FormSection } from '@/components/ui/FormSection';
import { useContactos } from '@/hooks/use-contactos';
import { useActualizarCotizacion } from '@/hooks/use-cotizaciones';
import { step3Schema } from '@/lib/schemas/cotizacion';
import { formatCurrency } from '@/lib/utils';
import type { z } from 'zod';
import type { Cotizacion, CondicionesPago, TipoDocumentoFiscal } from '@/types/api';

// Usar el tipo de INPUT del schema (antes de defaults) para que useForm
// no colisione con los campos que tienen .default() en el schema de salida.
type Step3Form = z.input<typeof step3Schema>;

type Props = { cotizacion: Cotizacion; onBack: () => void; onNext: () => void };

const TIPOS_DOC: { value: TipoDocumentoFiscal; label: string }[] = [
  { value: 'CF',              label: 'Consumidor Final (CF)' },
  { value: 'CCF',             label: 'Crédito Fiscal (CCF)' },
  { value: 'SUJETO_EXCLUIDO', label: 'Sujeto Excluido' },
];

const CONDICIONES: { value: CondicionesPago; label: string }[] = [
  { value: 'CONTADO', label: 'Contado' },
  { value: 'CREDITO', label: 'Crédito' },
  { value: 'OTRO',    label: 'Otro' },
];

export function Step3Terminos({ cotizacion, onBack, onNext }: Props) {
  const actualizar = useActualizarCotizacion();
  const contactosQ = useContactos({ clienteId: cotizacion.clienteId });

  // Reconstruir depositoModo del estado persistido.
  const depositoModoInicial: Step3Form['depositoModo'] =
    cotizacion.depositoPorcentaje ? 'PORCENTAJE' :
    cotizacion.depositoMonto ? 'MONTO' : 'NINGUNO';

  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } = useForm<Step3Form>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      // Auto-selección por tipo de cliente: EMPRESA usa CCF (Crédito Fiscal,
      // estándar para B2B), PARTICULAR usa CF (Consumidor Final). Solo aplica
      // si la cotización aún no tiene tipo persistido — al editar respetamos
      // lo que ya está guardado.
      tipoDocumentoFiscal:
        cotizacion.tipoDocumentoFiscal ??
        (cotizacion.cliente.tipo === 'EMPRESA' ? 'CCF' : 'CF'),
      condicionesPago: cotizacion.condicionesPago ?? null,
      contactoFacturacionId: cotizacion.contactoFacturacionId ?? null,
      porcentajeIva: cotizacion.porcentajeIva,
      depositoModo: depositoModoInicial,
      depositoPorcentaje: cotizacion.depositoPorcentaje ? Number(cotizacion.depositoPorcentaje) : null,
      depositoMonto: cotizacion.depositoMonto ? Number(cotizacion.depositoMonto) : null,
      notas: cotizacion.notas,
      notasInternas: cotizacion.notasInternas,
    },
  });

  // Confirmación inline antes de avanzar al paso 4 — el tipo de documento
  // fiscal define cómo se emite el DTE al SAT y no se puede cambiar después
  // de aprobar la cotización, así que pedimos confirmación explícita.
  const [confirmandoTipo, setConfirmandoTipo] = useState(false);
  const tipoDocSeleccionado = watch('tipoDocumentoFiscal');

  const TIPO_DOC_LABELS: Record<string, string> = {
    CF: 'Consumidor Final (CF)',
    CCF: 'Crédito Fiscal (CCF)',
    SUJETO_EXCLUIDO: 'Sujeto Excluido',
  };

  const modo = watch('depositoModo');
  const depPorcentaje = watch('depositoPorcentaje');
  const depMonto = watch('depositoMonto');
  const iva = watch('porcentajeIva');

  // Calculos en vivo para que el vendedor vea el contexto del deposito.
  // El total guardado (cotizacion.total) refleja el IVA persistido en la BD.
  // Recalculamos en vivo a partir del subtotal + el IVA del form (que el
  // usuario puede haber cambiado sin guardar aun) para que el total y los
  // calculos del deposito se mantengan coherentes con lo que ve en pantalla.
  const subtotalDecimal = new Decimal(cotizacion.subtotal);
  const ivaPct = new Decimal(typeof iva === 'number' && !isNaN(iva) ? iva : cotizacion.porcentajeIva);
  const totalDecimal = subtotalDecimal
    .mul(new Decimal(100).plus(ivaPct))
    .div(100)
    .toDecimalPlaces(2);

  const depositoCalculado =
    modo === 'PORCENTAJE' && depPorcentaje
      ? totalDecimal.mul(depPorcentaje).div(100).toDecimalPlaces(2)
      : modo === 'MONTO' && depMonto
        ? new Decimal(depMonto)
        : null;
  const porcentajeEquivalente =
    modo === 'MONTO' && depMonto && totalDecimal.greaterThan(0)
      ? new Decimal(depMonto).div(totalDecimal).mul(100).toDecimalPlaces(2)
      : null;

  async function onSubmit(values: Step3Form) {
    await actualizar.mutateAsync({
      id: cotizacion.id,
      data: {
        tipoDocumentoFiscal: values.tipoDocumentoFiscal,
        // || en vez de ?? para convertir "" del <select> a undefined; el backend
        // valida cuid()/enum y rechaza string vacio como invalido.
        condicionesPago: values.condicionesPago || undefined,
        contactoFacturacionId: values.contactoFacturacionId || undefined,
        porcentajeIva: values.porcentajeIva,
        notas: values.notas || undefined,
        notasInternas: values.notasInternas || undefined,
        // Mutuamente excluyentes: solo enviamos el que corresponde al modo.
        depositoPorcentaje: values.depositoModo === 'PORCENTAJE' ? (values.depositoPorcentaje ?? undefined) : undefined,
        depositoMonto: values.depositoModo === 'MONTO' ? (values.depositoMonto ?? undefined) : undefined,
      },
    });
    onNext();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <FormSection title="Datos fiscales">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-tx mb-1.5">
              Tipo de documento fiscal <span className="text-danger">*</span>
            </label>
            <select
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx"
              {...register('tipoDocumentoFiscal')}
            >
              {TIPOS_DOC.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {errors.tipoDocumentoFiscal && (
              <p className="text-xs text-danger mt-1">{errors.tipoDocumentoFiscal.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-tx mb-1.5">
              Contacto de facturación
            </label>
            <select
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx"
              {...register('contactoFacturacionId')}
            >
              <option value="">— Sin contacto —</option>
              {contactosQ.data?.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.apellido ?? ''} {c.cargo ? `· ${c.cargo}` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-tx-3 mt-1">
              Solo para coordinación interna. El DTE se emite con los datos de la empresa cliente.
            </p>
            {errors.contactoFacturacionId && (
              <p className="text-xs text-danger mt-1">{errors.contactoFacturacionId.message}</p>
            )}
          </div>

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
              {(['NINGUNO', 'PORCENTAJE', 'MONTO'] as const).map((m) => (
                <label key={m} className="inline-flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={field.value === m}
                    onChange={() => field.onChange(m)}
                    className="accent-accent"
                  />
                  {m === 'NINGUNO' ? 'Sin depósito' : m === 'PORCENTAJE' ? 'Por porcentaje' : 'Monto fijo'}
                </label>
              ))}
            </div>
          )}
        />

        {modo === 'PORCENTAJE' && (
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-tx mb-1.5">% del total</label>
            <input
              type="number"
              step="0.01"
              min={0.01}
              max={100}
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx font-mono"
              {...register('depositoPorcentaje', { valueAsNumber: true })}
            />
            {errors.depositoPorcentaje && (
              <p className="text-xs text-danger mt-1">{errors.depositoPorcentaje.message}</p>
            )}
            {depositoCalculado && (
              <p className="text-xs text-tx-2 mt-2">
                Equivale a <span className="font-mono font-semibold text-tx">{formatCurrency(depositoCalculado.toFixed(2))}</span>
              </p>
            )}
          </div>
        )}

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

      {confirmandoTipo && (
        <ConfirmRow
          message={`Vas a continuar con tipo de documento fiscal: ${TIPO_DOC_LABELS[tipoDocSeleccionado] ?? tipoDocSeleccionado}. Esto define cómo se emite el DTE al SAT. ¿Es correcto?`}
          confirmLabel={isSubmitting ? 'Guardando…' : 'Sí, continuar'}
          variant="primary"
          onCancel={() => setConfirmandoTipo(false)}
          onConfirm={handleSubmit(onSubmit)}
        />
      )}
      <div className="flex justify-between gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-tx-2 border border-bd hover:bg-bg-sunken transition-colors"
          onClick={onBack}
        >
          <Icon name="arrowLeft" size={14} /> Anterior
        </button>
        <button
          type="button"
          disabled={isSubmitting || confirmandoTipo}
          onClick={async () => {
            // Validar el form antes de pedir confirmación: si hay errores
            // (ej. depositoPorcentaje fuera de rango), no abrimos la confirmación.
            const ok = await new Promise<boolean>((resolve) => {
              handleSubmit(() => resolve(true), () => resolve(false))();
            });
            if (ok) setConfirmandoTipo(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors disabled:opacity-50"
        >
          Siguiente <Icon name="arrowRight" size={14} />
        </button>
      </div>
    </form>
  );
}
