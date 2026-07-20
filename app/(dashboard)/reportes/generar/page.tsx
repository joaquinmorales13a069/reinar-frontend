'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/auth.store';
import { generarReporte, type FormatoReporte, type TipoReporte } from '@/hooks/use-reportes';
import { hoySV, fechaSVHoyMasDias } from '@/lib/utils';

const TIPOS_VALIDOS: ReadonlyArray<TipoReporte> = [
  'ingresos', 'cuentas-cobrar', 'cotizaciones', 'equipos',
  'actas', 'proyectos', 'servicios', 'clientes', 'vendedores',
  'mantenimientos',
];

const ETIQUETAS: Record<TipoReporte, { titulo: string; descripcion: string }> = {
  'ingresos':        { titulo: 'Ingresos por período',     descripcion: 'Total facturado, IVA, desglose por cliente y categoría.' },
  'cuentas-cobrar':  { titulo: 'Cuentas por cobrar',       descripcion: 'Saldos pendientes por antigüedad (0-30, 31-60, 61-90, 90+).' },
  'cotizaciones':    { titulo: 'Cotizaciones por período', descripcion: 'Pipeline por estado, tasa de conversión y desempeño por vendedor.' },
  'equipos':         { titulo: 'Utilización de equipos',   descripcion: 'Ranking de equipos por ingresos y días de uso.' },
  'actas':           { titulo: 'Logística de actas',       descripcion: 'Volumen de entregas, recepciones y tiempos promedio.' },
  'proyectos':       { titulo: 'Proyectos activos',        descripcion: 'Valor cotizado, facturado y saldo pendiente por proyecto.' },
  'servicios':       { titulo: 'Servicios programados',    descripcion: 'Listado de servicios del período con comparativa.' },
  'clientes':        { titulo: 'Actividad de clientes',    descripcion: 'Nuevos, recurrentes, sin actividad y top por ingresos.' },
  'vendedores':      { titulo: 'Actividad de vendedores',  descripcion: 'Ranking de vendedores por cotizaciones e ingresos.' },
  'mantenimientos':  { titulo: 'Mantenimientos',           descripcion: 'Conteos, costos y repuestos por tipo/categoría de mantenimiento.' },
};

// Solo `clientes` y `proyectos` aceptan el parámetro `top` en el backend
// (ver `parametrosReporteSchema` en server/src/modules/reportes/reportes.schemas.ts).
const TIPOS_CON_TOP: ReadonlyArray<TipoReporte> = ['clientes', 'proyectos'];

const FORMATOS: ReadonlyArray<{ value: FormatoReporte; label: string; icon: 'fileText' | 'box' }> = [
  { value: 'pdf',   label: 'PDF',   icon: 'fileText' },
  { value: 'excel', label: 'Excel', icon: 'box' },
  { value: 'csv',   label: 'CSV',   icon: 'fileText' },
];

// Defaults: últimos 30 días hasta hoy, en TZ El Salvador — mismo calendario
// que generarReporte() usa para anclar desde/hasta (ver hooks/use-reportes.ts).
function getDefaultRango() {
  return { desde: fechaSVHoyMasDias(-30), hasta: hoySV() };
}

// `top` se modela como string en el form para evitar el split input/output de zod
// con preprocess (que rompe el typing de RHF). Convertimos a número al enviar.
const schema = z.object({
  desde:        z.string().min(1, 'La fecha desde es obligatoria.'),
  hasta:        z.string().min(1, 'La fecha hasta es obligatoria.'),
  formato:      z.enum(['pdf', 'excel', 'csv']),
  comparar:     z.boolean(),
  top:          z.string().refine(
                  (v) => v === '' || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 50),
                  { message: 'Debe ser un número entre 1 y 50.' },
                ),
  // Filtros opcionales del reporte de mantenimientos (string vacío = sin filtro)
  tipoMant:     z.string(),
  categoriaMant:z.string(),
  estadoMant:   z.string(),
  tecnico:      z.string(),
}).refine((d) => d.desde <= d.hasta, {
  message: 'La fecha desde debe ser anterior o igual a hasta.',
  path: ['desde'],
});

type FormData = z.infer<typeof schema>;

const inputBase = 'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk   = `${inputBase} border-bd`;
const inputErr  = `${inputBase} border-danger`;

function GenerarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tipoParam = searchParams.get('tipo');
  const rol = useAuthStore((s) => s.user?.rol);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validamos el tipo contra la lista cerrada antes de usarlo: si alguien pega
  // una URL con `?tipo=algo-raro` no queremos llamar al backend con un endpoint inválido.
  const tipo = useMemo<TipoReporte | null>(
    () => (tipoParam && (TIPOS_VALIDOS as ReadonlyArray<string>).includes(tipoParam) ? (tipoParam as TipoReporte) : null),
    [tipoParam],
  );

  // Mantenimientos amplía el acceso a LOGISTICA; los demás reportes quedan en ADMIN/GERENTE.
  // Bloqueamos aquí para evitar un 403 ruidoso antes de intentar la request.
  const esAdmin = rol === 'ADMIN' || rol === 'GERENTE';
  const tieneAcceso = esAdmin || (tipo === 'mantenimientos' && rol === 'LOGISTICA');

  useEffect(() => {
    if (rol && !tieneAcceso) router.replace('/reportes');
  }, [rol, tieneAcceso, router]);

  useEffect(() => {
    if (!tipo) router.replace('/reportes');
  }, [tipo, router]);

  const defaultRango = useMemo(getDefaultRango, []);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      desde:         defaultRango.desde,
      hasta:         defaultRango.hasta,
      formato:       'pdf',
      comparar:      true,
      top:           '',
      tipoMant:      '',
      categoriaMant: '',
      estadoMant:    '',
      tecnico:       '',
    },
  });

  if (!tipo || !tieneAcceso) return null;

  const meta = ETIQUETAS[tipo];
  const muestraTop = TIPOS_CON_TOP.includes(tipo);
  const esMant = tipo === 'mantenimientos';
  const formatoActual = watch('formato');

  async function onSubmit(data: FormData) {
    if (!tipo) return;
    setIsSubmitting(true);
    try {
      const topNumerico = muestraTop && data.top !== '' ? Number(data.top) : undefined;
      await generarReporte({
        tipo,
        desde:    data.desde,
        hasta:    data.hasta,
        formato:  data.formato,
        // Mantenimientos no acepta comparar ni top en el backend
        comparar: esMant ? undefined : data.comparar,
        top:      topNumerico,
        // Pasamos filtros de mantenimientos sólo cuando el tipo corresponde;
        // strings vacíos se ignoran dentro del hook (no se envían al backend).
        tipoMant:    esMant && data.tipoMant      ? data.tipoMant      : undefined,
        categoria:   esMant && data.categoriaMant ? data.categoriaMant : undefined,
        estado:      esMant && data.estadoMant    ? data.estadoMant    : undefined,
        tecnico:     esMant && data.tecnico       ? data.tecnico       : undefined,
      });
    } catch {
      // El hook ya muestra el toast con el mensaje del backend; sólo dejamos el form usable de nuevo.
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={meta.titulo}
        subtitle={meta.descripcion}
        back
        backLabel="Reportes"
        onBack={() => router.push('/reportes')}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl">
        <FormSection title="Rango de fechas">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-tx-2">Desde <span className="text-danger">*</span></label>
              <input
                type="date"
                className={`${errors.desde ? inputErr : inputOk} font-mono mt-1`}
                {...register('desde')}
              />
              {errors.desde && <p className="text-xs text-danger mt-1">{errors.desde.message}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-tx-2">Hasta <span className="text-danger">*</span></label>
              <input
                type="date"
                className={`${errors.hasta ? inputErr : inputOk} font-mono mt-1`}
                {...register('hasta')}
              />
              {errors.hasta && <p className="text-xs text-danger mt-1">{errors.hasta.message}</p>}
            </div>
          </div>
        </FormSection>

        {!esMant && (
          <FormSection title="Opciones">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-bd accent-accent cursor-pointer mt-0.5"
                {...register('comparar')}
              />
              <div>
                <div className="text-sm text-tx">Incluir comparativa con período anterior</div>
                <div className="text-xs text-tx-3 mt-0.5">Muestra el resultado del mismo rango de tiempo previo para contraste.</div>
              </div>
            </label>

            {muestraTop && (
              <div className="mt-4">
                <label className="text-xs font-medium text-tx-2">
                  Top N <span className="text-tx-3 font-normal">(opcional, 1-50)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  placeholder="Por defecto: sin recorte"
                  className={`${errors.top ? inputErr : inputOk} mt-1 max-w-50`}
                  {...register('top')}
                />
                {errors.top && <p className="text-xs text-danger mt-1">{errors.top.message}</p>}
              </div>
            )}
          </FormSection>
        )}

        {esMant && (
          <FormSection title="Filtros de mantenimiento">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-tx-2">Tipo <span className="text-tx-3 font-normal">(opcional)</span></label>
                <select
                  className={`${inputOk} mt-1`}
                  {...register('tipoMant')}
                >
                  <option value="">Todos los tipos</option>
                  <option value="PREVENTIVO">Preventivo</option>
                  <option value="CORRECTIVO">Correctivo</option>
                  <option value="EMERGENCIA">Emergencia</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-tx-2">Categoría <span className="text-tx-3 font-normal">(opcional)</span></label>
                <select
                  className={`${inputOk} mt-1`}
                  {...register('categoriaMant')}
                >
                  <option value="">Todas las categorías</option>
                  <option value="INTERNO">Interno</option>
                  <option value="EXTERNO">Externo</option>
                  <option value="EN_CLIENTE">En cliente</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-tx-2">Estado <span className="text-tx-3 font-normal">(opcional)</span></label>
                <select
                  className={`${inputOk} mt-1`}
                  {...register('estadoMant')}
                >
                  <option value="">Todos los estados</option>
                  <option value="ACTIVO">Activo</option>
                  <option value="COMPLETADO">Completado</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-tx-2">Técnico <span className="text-tx-3 font-normal">(opcional)</span></label>
                <input
                  type="text"
                  placeholder="Nombre del técnico"
                  className={`${inputOk} mt-1`}
                  {...register('tecnico')}
                />
              </div>
            </div>
            <p className="text-xs text-tx-3 mt-3">
              Los filtros por equipo y unidad de herramienta están disponibles en una versión posterior.
            </p>
          </FormSection>
        )}

        <FormSection title="Formato de exportación">
          <div className="grid grid-cols-3 gap-3">
            {FORMATOS.map((f) => {
              const activo = formatoActual === f.value;
              return (
                <label
                  key={f.value}
                  className={`flex flex-col items-center gap-2 p-4 rounded-md border cursor-pointer transition-colors ${
                    activo ? 'border-accent bg-accent-soft' : 'border-bd bg-surface hover:bg-bg-sunken'
                  }`}
                >
                  <input
                    type="radio"
                    value={f.value}
                    className="sr-only"
                    {...register('formato')}
                  />
                  <Icon name={f.icon} size={22} />
                  <span className="text-sm font-semibold text-tx">{f.label}</span>
                </label>
              );
            })}
          </div>
        </FormSection>

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => router.push('/reportes')}
            className="px-4 py-2 text-sm rounded-md border border-bd text-tx-2 hover:bg-bg-sunken transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md bg-accent text-navy hover:bg-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Icon name="download" size={14} />
            {isSubmitting ? 'Generando…' : 'Generar y descargar'}
          </button>
        </div>
      </form>
    </div>
  );
}

// useSearchParams requiere Suspense en App Router para evitar el error de prerender.
export default function GenerarReportePage() {
  return (
    <Suspense fallback={null}>
      <GenerarContent />
    </Suspense>
  );
}
