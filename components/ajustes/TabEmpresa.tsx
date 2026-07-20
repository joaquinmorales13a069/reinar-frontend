'use client';

import { useEffect } from 'react';
import { useForm, type UseFormRegister, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormSection } from '@/components/ui/FormSection';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/auth.store';
import { esAdmin } from '@/lib/ajustes';
import { hoySV } from '@/lib/utils';
import { useConfiguracion, useActualizarConfiguracion } from '@/hooks/use-configuracion';
import {
  configuracionEmpresaSchema,
  type ConfiguracionEmpresaForm,
} from '@/lib/schemas/ajustes';
import type { ActualizarConfiguracionDto } from '@/types/api';

const inputBase = 'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const inputReadonly = `${inputBase} border-bd opacity-70 cursor-not-allowed`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-1';
const hintCls = 'text-xs text-tx-3 mt-1';

// Convertir string vacío a undefined antes de enviar al backend: los Zod
// .optional() del server rechazan '' como string vacío y devolverían 400.
function clean(v: string | undefined): string | undefined {
  if (v == null) return undefined;
  const t = v.trim();
  return t === '' ? undefined : t;
}

export function TabEmpresa() {
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeEditar = esAdmin(rol);

  const { data, isLoading, isError, refetch, error } = useConfiguracion();
  const actualizar = useActualizarConfiguracion();

  const form = useForm<ConfiguracionEmpresaForm>({
    resolver: zodResolver(configuracionEmpresaSchema) as never,
    defaultValues: {
      nombreEmpresa: '',
      nit: '', ncr: '', direccion: '', telefono: '', email: '',
      telefonoCotizaciones: '', emailCotizaciones: '', logoUrl: '', sitioWeb: '',
      prefijoCotizacion: '', prefijoFactura: '', prefijoActa: '',
      emailRemitente: '', nombreRemitente: '', emailCopiaInterna: '',
      porcentajeIvaDefault: undefined,
    },
  });

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting, isDirty } } = form;

  // Mapeo explícito BD→form reutilizado por el efecto de carga y por Descartar
  // cambios — un reset() sin args queda dependiente del orden de useEffect y
  // puede revertir a valores vacíos si el botón se clickea antes de hidratar.
  const mapDataToForm = (d: typeof data): ConfiguracionEmpresaForm => ({
    nombreEmpresa: d!.nombreEmpresa,
    nit: d!.nit ?? '',
    ncr: d!.ncr ?? '',
    direccion: d!.direccion ?? '',
    telefono: d!.telefono ?? '',
    email: d!.email ?? '',
    telefonoCotizaciones: d!.telefonoCotizaciones ?? '',
    emailCotizaciones: d!.emailCotizaciones ?? '',
    logoUrl: d!.logoUrl ?? '',
    sitioWeb: d!.sitioWeb ?? '',
    prefijoCotizacion: d!.prefijoCotizacion ?? '',
    prefijoFactura: d!.prefijoFactura ?? '',
    prefijoActa: d!.prefijoActa ?? '',
    emailRemitente: d!.emailRemitente ?? '',
    nombreRemitente: d!.nombreRemitente ?? '',
    emailCopiaInterna: d!.emailCopiaInterna ?? '',
    porcentajeIvaDefault: d!.porcentajeIvaDefault != null ? Number(d!.porcentajeIvaDefault) : undefined,
  });

  useEffect(() => {
    if (data) reset(mapDataToForm(data));
    // mapDataToForm es estable (cierra solo sobre `data` que ya está en deps);
    // omitirlo de deps evita re-suscribir el efecto en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, reset]);

  const logoUrlPreview = watch('logoUrl');
  const prefijoCot = watch('prefijoCotizacion');
  const prefijoFac = watch('prefijoFactura');
  const prefijoAct = watch('prefijoActa');
  // El backend genera números con formato {PREFIJO}{YY}{MM}{NNNNN} (sin guiones)
  // — ver server/src/lib/numeracion.ts. La vista previa replica ese formato exacto,
  // anclada a El Salvador (no al dispositivo) para no mostrar un mes distinto
  // cerca de la medianoche.
  const hoy = hoySV();
  const sufijoFecha = `${hoy.slice(2, 4)}${hoy.slice(5, 7)}`;

  async function onSubmit(v: ConfiguracionEmpresaForm) {
    const payload: ActualizarConfiguracionDto = {
      nombreEmpresa: v.nombreEmpresa.trim(),
      nit: clean(v.nit),
      ncr: clean(v.ncr),
      direccion: clean(v.direccion),
      telefono: clean(v.telefono),
      email: clean(v.email),
      telefonoCotizaciones: clean(v.telefonoCotizaciones),
      emailCotizaciones: clean(v.emailCotizaciones),
      logoUrl: clean(v.logoUrl),
      sitioWeb: clean(v.sitioWeb),
      prefijoCotizacion: clean(v.prefijoCotizacion),
      prefijoFactura: clean(v.prefijoFactura),
      prefijoActa: clean(v.prefijoActa),
      emailRemitente: clean(v.emailRemitente),
      nombreRemitente: clean(v.nombreRemitente),
      emailCopiaInterna: clean(v.emailCopiaInterna),
      porcentajeIvaDefault: v.porcentajeIvaDefault,
    };
    await actualizar.mutateAsync(payload);
  }

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;

  // 404 NOT_FOUND significa "configuración no inicializada" — permitir
  // que el usuario llene el form y guarde para crearla (el PUT hace upsert).
  const errCode = (error as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
  if (isError && errCode !== 'NOT_FOUND') {
    return (
      <div className="space-y-4">
        <EmptyState
          icon="alertTriangle"
          title="Error al cargar configuración"
          message="No se pudo obtener la configuración de empresa."
        />
        <div className="flex justify-center">
          <button onClick={() => refetch()} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm border border-bd hover:bg-bg-sunken transition-colors">
            <Icon name="refresh" size={12} /> Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 pb-24">
      {isError && errCode === 'NOT_FOUND' && (
        <div className="rounded-lg border border-warn-soft bg-warn-soft text-warn p-3 text-sm">
          Configuración aún no inicializada. Completa los campos y guarda para crearla.
        </div>
      )}

      <FormSection title="Información general">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Razón social <span className="text-danger">*</span></label>
            <input className={errors.nombreEmpresa ? inputErr : (puedeEditar ? inputOk : inputReadonly)} readOnly={!puedeEditar} {...register('nombreEmpresa')} />
            {errors.nombreEmpresa && <p className={errorCls}>{errors.nombreEmpresa.message}</p>}
          </div>
          <Field name="nit" label="NIT" mono register={register} errors={errors} puedeEditar={puedeEditar} />
          <Field name="ncr" label="NCR" mono register={register} errors={errors} puedeEditar={puedeEditar} />
          <Field name="direccion" label="Dirección" span2 register={register} errors={errors} puedeEditar={puedeEditar} />
          <Field name="telefono" label="Teléfono" mono register={register} errors={errors} puedeEditar={puedeEditar} />
          <Field name="email" label="Email" type="email" mono register={register} errors={errors} puedeEditar={puedeEditar} />
          <Field name="sitioWeb" label="Sitio web" mono span2 register={register} errors={errors} puedeEditar={puedeEditar} placeholder="https://" />
        </div>
      </FormSection>

      <FormSection title="Facturación y contacto comercial">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>IVA por defecto (%)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              max={100}
              readOnly={!puedeEditar}
              className={`${errors.porcentajeIvaDefault ? inputErr : (puedeEditar ? inputOk : inputReadonly)} font-mono`}
              {...register('porcentajeIvaDefault')}
            />
            {errors.porcentajeIvaDefault && <p className={errorCls}>{errors.porcentajeIvaDefault.message}</p>}
          </div>
          <Field name="telefonoCotizaciones" label="Teléfono de cotizaciones" mono register={register} errors={errors} puedeEditar={puedeEditar} />
          <Field name="emailCotizaciones" label="Email de cotizaciones" type="email" mono register={register} errors={errors} puedeEditar={puedeEditar} />
          <div className="sm:col-span-2">
            <Field name="logoUrl" label="URL del logo" mono register={register} errors={errors} puedeEditar={puedeEditar} placeholder="https://…/logo.png" />
            {logoUrlPreview && (
              <div className="mt-2 inline-flex items-center gap-3 p-2 bg-bg-sunken rounded">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrlPreview}
                  alt="Logo"
                  className="h-10"
                  onError={(e) => {
                    // Si la URL no resuelve a una imagen, mostramos placeholder.
                    (e.target as HTMLImageElement).style.display = 'none';
                    const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = 'inline-flex';
                  }}
                />
                <span className="hidden items-center px-2 text-xs text-tx-3">No se pudo cargar el logo</span>
              </div>
            )}
          </div>
        </div>
      </FormSection>

      <FormSection title="Correos del sistema">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field name="emailRemitente" label="Email remitente" type="email" mono register={register} errors={errors} puedeEditar={puedeEditar} />
          <Field name="nombreRemitente" label="Nombre remitente" register={register} errors={errors} puedeEditar={puedeEditar} />
          <Field name="emailCopiaInterna" label="Email copia interna (BCC)" type="email" mono span2 register={register} errors={errors} puedeEditar={puedeEditar} />
        </div>
      </FormSection>

      <FormSection title="Numeración de documentos">
        {/* Los prefijos viven en el mismo endpoint /configuracion, por eso van en esta misma tab. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <PrefijoField name="prefijoCotizacion" label="Cotizaciones" register={register} errors={errors} puedeEditar={puedeEditar} valor={prefijoCot} sufijoFecha={sufijoFecha} />
          <PrefijoField name="prefijoFactura"    label="Facturas"     register={register} errors={errors} puedeEditar={puedeEditar} valor={prefijoFac} sufijoFecha={sufijoFecha} />
          <PrefijoField name="prefijoActa"       label="Actas"        register={register} errors={errors} puedeEditar={puedeEditar} valor={prefijoAct} sufijoFecha={sufijoFecha} />
        </div>
      </FormSection>

      {puedeEditar && (
        <div className="sticky bottom-0 left-0 right-0 -mx-4 px-4 py-3 bg-bg border-t border-bd flex justify-end gap-2">
          <button
            type="button"
            disabled={!isDirty}
            onClick={() => data && reset(mapDataToForm(data))}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-tx-2 border border-bd hover:bg-bg-sunken transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Descartar cambios
          </button>
          <button
            type="submit"
            disabled={isSubmitting || actualizar.isPending || !isDirty}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name="check" size={14} /> Guardar cambios
          </button>
        </div>
      )}
    </form>
  );
}

// Field genérico para reducir repetición en la sección de información general.
function Field({
  name,
  label,
  type = 'text',
  mono,
  span2,
  placeholder,
  register,
  errors,
  puedeEditar,
}: {
  name: keyof ConfiguracionEmpresaForm;
  label: string;
  type?: string;
  mono?: boolean;
  span2?: boolean;
  placeholder?: string;
  register: UseFormRegister<ConfiguracionEmpresaForm>;
  errors: FieldErrors<ConfiguracionEmpresaForm>;
  puedeEditar: boolean;
}) {
  const err = errors[name];
  return (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <label className={labelCls}>{label}</label>
      <input
        type={type}
        readOnly={!puedeEditar}
        placeholder={placeholder}
        className={`${err ? inputErr : (puedeEditar ? inputOk : inputReadonly)} ${mono ? 'font-mono' : ''}`}
        {...register(name)}
      />
      {err && <p className={errorCls}>{err.message}</p>}
    </div>
  );
}

// Campo de prefijo con auto-uppercase y vista previa en vivo.
function PrefijoField({
  name,
  label,
  register,
  errors,
  puedeEditar,
  valor,
  sufijoFecha,
}: {
  name: 'prefijoCotizacion' | 'prefijoFactura' | 'prefijoActa';
  label: string;
  register: UseFormRegister<ConfiguracionEmpresaForm>;
  errors: FieldErrors<ConfiguracionEmpresaForm>;
  puedeEditar: boolean;
  valor: string | undefined;
  sufijoFecha: string;
}) {
  const err = errors[name];
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        readOnly={!puedeEditar}
        className={`${err ? inputErr : (puedeEditar ? inputOk : inputReadonly)} font-mono uppercase`}
        // El backend exige [A-Z0-9]; transformar a uppercase al escribir
        // evita errores de validación por usuarios que escriben en minúsculas.
        {...register(name, {
          setValueAs: (v: string) => (v ?? '').toUpperCase(),
        })}
      />
      {err && <p className={errorCls}>{err.message}</p>}
      {!err && valor && (
        <p className={hintCls}>Vista previa: <span className="font-mono text-tx-2">{valor.toUpperCase()}{sufijoFecha}XXXXX</span></p>
      )}
    </div>
  );
}
