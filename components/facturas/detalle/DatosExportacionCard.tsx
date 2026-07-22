'use client';

import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useGuardarDatosExportacion } from '@/hooks/use-facturas';
import { useConfiguracion } from '@/hooks/use-configuracion';
import { datosExportacionSchema, type DatosExportacionForm } from '@/lib/schemas/factura';
import { CAT027, resolverRecinto } from '@/lib/cat027';
import { CAT028, resolverRegimen } from '@/lib/cat028';
import { INCOTERMS, resolverIncoterm } from '@/lib/incoterms';
import { TRANSPORTE_FEX, resolverTransporte } from '@/lib/transporte-fex';
import { formatCurrency } from '@/lib/utils';
import type { Factura } from '@/types/api';

type Props = { factura: Factura; puedeEscribir: boolean };

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;

type BackendError = { message?: string; details?: { field: string; message: string }[] };

// Campos realmente renderizados por el form — usado para distinguir un
// detail que setError puede aplicar de uno que no (ver handleError).
const CAMPOS_DATOS_EXPORTACION: readonly (keyof DatosExportacionForm)[] = [
  'recintoFiscal',
  'regimenExportacion',
  'incoterms',
  'flete',
  'seguro',
  'transporteConductor',
  'transporteDocConductor',
  'transportePlaca',
  'transporteModalidad',
];

// Tarjeta de datos de exportación (FEX, fase 2) — solo se monta cuando
// factura.tipoDTE === 'FEX' (lo decide la página de detalle).
export function DatosExportacionCard({ factura, puedeEscribir }: Props) {
  const { data: config } = useConfiguracion();
  const guardar = useGuardarDatosExportacion(factura.id);

  const anulada = factura.estado === 'ANULADA';
  // El backend solo acepta el PATCH mientras estadoDTE sea PENDIENTE/RECHAZADO
  // (guardarDatosExportacion en facturas.service.ts) — tras emitir, modo lectura.
  const yaEmitida = factura.estadoDTE !== 'PENDIENTE' && factura.estadoDTE !== 'RECHAZADO';
  const soloLectura = !puedeEscribir || anulada || yaEmitida;

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, dirtyFields, isSubmitting },
  } = useForm<DatosExportacionForm>({
    // z.coerce en flete/seguro hace que el tipo de entrada del resolver
    // difiera del tipo de salida — mismo cast que el resto de formularios
    // con campos numéricos coercidos (ver PiezaForm/TabEmpresa).
    resolver: zodResolver(datosExportacionSchema) as never,
    defaultValues: {
      recintoFiscal: factura.recintoFiscal ?? '',
      // '1000.000' (Exportación Definitiva, Régimen Común) es el fallback final
      // cuando ni la factura ni la configuración de empresa traen un default.
      regimenExportacion: factura.regimenExportacion ?? '1000.000',
      incoterms: factura.incoterms ?? '',
      flete: factura.flete != null ? Number(factura.flete) : undefined,
      seguro: factura.seguro != null ? Number(factura.seguro) : undefined,
      transporteConductor: factura.transporteConductor ?? '',
      transporteDocConductor: factura.transporteDocConductor ?? '',
      transportePlaca: factura.transportePlaca ?? '',
      transporteModalidad: factura.transporteModalidad ?? '',
    },
  });

  // La configuración de empresa (con los defaults de recinto/régimen) llega en
  // un segundo round-trip — la precargamos una sola vez y solo si el usuario
  // no tocó el campo todavía (mismo patrón de hasSeeded que PeriodoFacturaCard).
  const hasSeeded = useRef(false);
  useEffect(() => {
    if (hasSeeded.current || !config) return;
    if (!factura.recintoFiscal && !dirtyFields.recintoFiscal && config.recintoFiscalDefault) {
      setValue('recintoFiscal', config.recintoFiscalDefault);
    }
    if (!factura.regimenExportacion && !dirtyFields.regimenExportacion && config.regimenExportacionDefault) {
      setValue('regimenExportacion', config.regimenExportacionDefault);
    }
    hasSeeded.current = true;
  }, [
    config,
    factura.recintoFiscal,
    factura.regimenExportacion,
    dirtyFields.recintoFiscal,
    dirtyFields.regimenExportacion,
    setValue,
  ]);

  function handleError(err: unknown) {
    const anyErr = err as { response?: { data?: { error?: BackendError } } };
    const e = anyErr.response?.data?.error;
    const details = e?.details ?? [];
    let aplicoAlgunCampo = false;
    details.forEach((d) => {
      if ((CAMPOS_DATOS_EXPORTACION as readonly string[]).includes(d.field)) {
        setError(d.field as keyof DatosExportacionForm, { message: d.message });
        aplicoAlgunCampo = true;
      }
    });
    // Si ningún detail mapeó a un campo del form (ej. el backend manda
    // `field: 'general'` para un issue con path vacío) el usuario no ve nada
    // inline, así que hace falta el toast. También cubrimos err.message plano:
    // cuando el hook lanza `new Error(...)` (HTTP 200 con success:false) no
    // hay `err.response.data.error`, y sin este fallback se perdía el mensaje
    // real detrás de un texto genérico.
    if (!aplicoAlgunCampo) {
      toast.error(e?.message ?? (err as Error)?.message ?? 'No se pudieron guardar los datos de exportación.');
    }
  }

  async function onSubmit(values: DatosExportacionForm) {
    try {
      await guardar.mutateAsync({
        recintoFiscal: values.recintoFiscal,
        regimenExportacion: values.regimenExportacion,
        incoterms: values.incoterms || undefined,
        flete: values.flete,
        seguro: values.seguro,
        transporteConductor: values.transporteConductor || undefined,
        transporteDocConductor: values.transporteDocConductor || undefined,
        transportePlaca: values.transportePlaca || undefined,
        transporteModalidad: values.transporteModalidad || undefined,
      });
      toast.success('Datos de exportación guardados.');
    } catch (err) {
      handleError(err);
    }
  }

  return (
    <div className={`bg-bg border border-bd rounded-md p-4 ${anulada ? 'opacity-60' : ''}`}>
      <h3 className="text-sm font-medium text-tx mb-3">Datos de exportación</h3>

      {soloLectura ? (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 text-sm">
          <dt className="text-tx-3">Recinto fiscal</dt>
          <dd className="text-tx">{factura.recintoFiscal ? resolverRecinto(factura.recintoFiscal) : '—'}</dd>
          <dt className="text-tx-3">Régimen</dt>
          <dd className="text-tx">{factura.regimenExportacion ? resolverRegimen(factura.regimenExportacion) : '—'}</dd>
          <dt className="text-tx-3">Incoterm</dt>
          <dd className="text-tx">{factura.incoterms ? resolverIncoterm(factura.incoterms) : '—'}</dd>
          <dt className="text-tx-3">Flete</dt>
          <dd className="font-mono text-xs text-tx">{factura.flete ? formatCurrency(factura.flete) : '—'}</dd>
          <dt className="text-tx-3">Seguro</dt>
          <dd className="font-mono text-xs text-tx">{factura.seguro ? formatCurrency(factura.seguro) : '—'}</dd>
          {factura.transporteModalidad && (
            <>
              <dt className="text-tx-3">Transporte</dt>
              <dd className="text-tx">{resolverTransporte(factura.transporteModalidad)}</dd>
              <dt className="text-tx-3">Conductor</dt>
              <dd className="text-tx">{factura.transporteConductor}</dd>
              <dt className="text-tx-3">Documento conductor</dt>
              <dd className="font-mono text-xs text-tx">{factura.transporteDocConductor}</dd>
              <dt className="text-tx-3">Placas</dt>
              <dd className="font-mono text-xs text-tx">{factura.transportePlaca}</dd>
            </>
          )}
        </dl>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-tx-2">
                Recinto fiscal <span className="text-danger">*</span>
              </label>
              <select className={errors.recintoFiscal ? inputErr : inputOk} {...register('recintoFiscal')}>
                <option value="">— Seleccionar —</option>
                {CAT027.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              {errors.recintoFiscal && <p className="text-xs text-danger mt-0.5">{errors.recintoFiscal.message}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-tx-2">
                Régimen <span className="text-danger">*</span>
              </label>
              <select className={errors.regimenExportacion ? inputErr : inputOk} {...register('regimenExportacion')}>
                <option value="">— Seleccionar —</option>
                {CAT028.map((r) => (
                  <option key={r.value} value={r.value}>{r.value} — {r.label}</option>
                ))}
              </select>
              {errors.regimenExportacion && (
                <p className="text-xs text-danger mt-0.5">{errors.regimenExportacion.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-tx-2">Incoterm</label>
              <select className={inputOk} {...register('incoterms')}>
                <option value="">— Sin especificar —</option>
                {INCOTERMS.map((i) => (
                  <option key={i.value} value={i.value}>{i.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-tx-2">Flete</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  className={`${errors.flete ? inputErr : inputOk} font-mono`}
                  {...register('flete')}
                />
                {errors.flete && <p className="text-xs text-danger mt-0.5">{errors.flete.message}</p>}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-tx-2">Seguro</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  className={`${errors.seguro ? inputErr : inputOk} font-mono`}
                  {...register('seguro')}
                />
                {errors.seguro && <p className="text-xs text-danger mt-0.5">{errors.seguro.message}</p>}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-bd">
            <h4 className="text-2xs uppercase tracking-wider text-tx-3 font-medium mb-2">
              Transporte (opcional)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-tx-2">Conductor</label>
                <input
                  className={errors.transporteConductor ? inputErr : inputOk}
                  placeholder="Nombre del conductor"
                  {...register('transporteConductor')}
                />
                {errors.transporteConductor && (
                  <p className="text-xs text-danger mt-0.5">{errors.transporteConductor.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-tx-2">Documento del conductor</label>
                <input
                  className={errors.transporteDocConductor ? inputErr : inputOk}
                  placeholder="DUI o pasaporte"
                  {...register('transporteDocConductor')}
                />
                {errors.transporteDocConductor && (
                  <p className="text-xs text-danger mt-0.5">{errors.transporteDocConductor.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-tx-2">Placas</label>
                <input
                  className={`${errors.transportePlaca ? inputErr : inputOk} font-mono`}
                  placeholder="P123-456"
                  {...register('transportePlaca')}
                />
                {errors.transportePlaca && (
                  <p className="text-xs text-danger mt-0.5">{errors.transportePlaca.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-tx-2">Modalidad</label>
                <select
                  className={errors.transporteModalidad ? inputErr : inputOk}
                  {...register('transporteModalidad')}
                >
                  <option value="">— Sin especificar —</option>
                  {TRANSPORTE_FEX.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {errors.transporteModalidad && (
                  <p className="text-xs text-danger mt-0.5">{errors.transporteModalidad.message}</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || guardar.isPending}
              className="px-4 py-2 text-sm rounded-md bg-accent text-navy font-medium hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              {guardar.isPending ? 'Guardando…' : 'Guardar datos de exportación'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
