'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormSection } from '@/components/ui/FormSection';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { EmailsInput } from '@/components/ui/EmailsInput';
import { useAuthStore } from '@/stores/auth.store';
import { esAdmin } from '@/lib/ajustes';
import { useConfigReportes, useActualizarConfigReportes } from '@/hooks/use-configuracion';
import {
  configuracionReportesSchema,
  type ConfiguracionReportesForm,
} from '@/lib/schemas/ajustes';

const inputBase = 'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-1';
const hintCls = 'text-xs text-tx-3 mt-1';

const FORMATOS: { value: 'pdf' | 'excel' | 'ambos'; label: string }[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'excel', label: 'Excel' },
  { value: 'ambos', label: 'Ambos' },
];

export function TabReportes() {
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeEditar = esAdmin(rol);

  const { data, isLoading, isError, refetch } = useConfigReportes();
  const actualizar = useActualizarConfigReportes();

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty, dirtyFields },
  } = useForm<ConfiguracionReportesForm>({
    resolver: zodResolver(configuracionReportesSchema) as never,
    defaultValues: {
      reporteSemanalActivo: false,
      reporteSemanalEmails: [],
      reporteMensualActivo: false,
      reporteMensualDia: 1,
      reporteMensualEmails: [],
      formatoProgramado: 'pdf',
    },
  });

  // Reset al recibir datos del backend; sin esto el form quedaría con defaults.
  useEffect(() => {
    if (data) reset(data);
  }, [data, reset]);

  const semanalActivo = watch('reporteSemanalActivo');
  const mensualActivo = watch('reporteMensualActivo');
  const formato = watch('formatoProgramado');

  async function onSubmit(v: ConfiguracionReportesForm) {
    // Enviar solo los campos modificados: el schema del backend tiene
    // .refine(d => Object.keys(d).length > 0) y permite partial updates.
    const payload: Partial<ConfiguracionReportesForm> = {};
    for (const key of Object.keys(dirtyFields) as (keyof ConfiguracionReportesForm)[]) {
      // Las claves vienen del propio shape del form — asignación segura.
      (payload as Record<string, unknown>)[key] = v[key];
    }
    if (Object.keys(payload).length === 0) return;
    await actualizar.mutateAsync(payload);
  }

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (isError) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon="alertTriangle"
          title="Error al cargar configuración"
          message="No se pudo obtener la configuración de reportes."
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
      <FormSection title="Reporte semanal">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-tx-2">Envío semanal automático del resumen.</p>
          <Switch
            on={semanalActivo}
            disabled={!puedeEditar}
            // setValue con shouldDirty marca el campo como modificado para que
            // dirtyFields lo incluya en el payload enviado al backend.
            onClick={() => setValue('reporteSemanalActivo', !semanalActivo, { shouldDirty: true })}
          />
        </div>
        {semanalActivo && (
          <div>
            <label htmlFor="reporte-semanal-emails" className={labelCls}>Emails destinatarios</label>
            <Controller
              control={control}
              name="reporteSemanalEmails"
              render={({ field, fieldState }) => (
                <EmailsInput
                  id="reporte-semanal-emails"
                  value={field.value ?? []}
                  onChange={field.onChange}
                  disabled={!puedeEditar}
                  error={fieldState.error?.message}
                  placeholder="agrega un email…"
                />
              )}
            />
          </div>
        )}
      </FormSection>

      <FormSection title="Reporte mensual">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-tx-2">Envío mensual automático del resumen.</p>
          <Switch
            on={mensualActivo}
            disabled={!puedeEditar}
            onClick={() => setValue('reporteMensualActivo', !mensualActivo, { shouldDirty: true })}
          />
        </div>
        {mensualActivo && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="reporte-mensual-dia" className={labelCls}>Día del mes (1–28)</label>
              <input
                id="reporte-mensual-dia"
                type="number"
                min={1}
                max={28}
                readOnly={!puedeEditar}
                className={`${errors.reporteMensualDia ? inputErr : inputOk} font-mono`}
                {...register('reporteMensualDia')}
              />
              {errors.reporteMensualDia && <p className={errorCls}>{errors.reporteMensualDia.message}</p>}
              {!errors.reporteMensualDia && <p className={hintCls}>Días 29-31 no soportados (no existen en todos los meses).</p>}
            </div>
            <div>
              <label htmlFor="reporte-mensual-emails" className={labelCls}>Emails destinatarios</label>
              <Controller
                control={control}
                name="reporteMensualEmails"
                render={({ field, fieldState }) => (
                  <EmailsInput
                    id="reporte-mensual-emails"
                    value={field.value ?? []}
                    onChange={field.onChange}
                    disabled={!puedeEditar}
                    error={fieldState.error?.message}
                    placeholder="agrega un email…"
                  />
                )}
              />
            </div>
          </div>
        )}
      </FormSection>

      <FormSection title="Formato">
        <div className="inline-flex rounded-md border border-bd overflow-hidden">
          {FORMATOS.map((f) => {
            const active = formato === f.value;
            return (
              <button
                key={f.value}
                type="button"
                disabled={!puedeEditar}
                onClick={() => setValue('formatoProgramado', f.value, { shouldDirty: true })}
                className={`px-4 py-2 text-sm transition-colors ${
                  active ? 'bg-accent text-navy font-medium' : 'text-tx-2 hover:bg-bg-sunken'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </FormSection>

      {puedeEditar && (
        <div className="sticky bottom-0 left-0 right-0 -mx-4 px-4 py-3 bg-bg border-t border-bd flex justify-end gap-2">
          <button
            type="button"
            disabled={!isDirty}
            onClick={() => data && reset(data)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-tx-2 border border-bd hover:bg-bg-sunken transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Descartar cambios
          </button>
          <button
            type="submit"
            disabled={isSubmitting || actualizar.isPending || !isDirty}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name="check" size={14} /> Guardar configuración
          </button>
        </div>
      )}
    </form>
  );
}

function Switch({ on, disabled, onClick }: { on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        on ? 'bg-accent' : 'bg-bd-strong'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-surface transition-transform ${
          on ? 'translate-x-5' : ''
        }`}
      />
    </button>
  );
}
