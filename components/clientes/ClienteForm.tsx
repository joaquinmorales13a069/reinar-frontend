'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { useCliente, useCrearCliente, useEditarCliente, useCambiarEstadoCliente } from '@/hooks/use-clientes';
import { DEPARTAMENTOS_SV, DISTRITOS_SV, getMunicipiosByDept, getDistritosByMuniDept } from '@/lib/sv-geo';
import { SECTORES_CAT019, ACTIVIDADES_ECONOMICAS_SV } from '@/lib/cat019';
import { PhoneInputField } from '@/components/ui/PhoneInputField';

const schema = z.object({
  tipo: z.enum(['EMPRESA', 'PARTICULAR']),
  razonSocial: z.string().optional(),
  nombreComercial: z.string().optional(),
  nit: z.string().optional(),
  ncr: z.string().optional(),
  sector: z.string().optional(),
  actividadEconomica: z.string().optional(),
  nombre: z.string().optional(),
  apellido: z.string().optional(),
  dui: z.string().optional(),
  ocupacion: z.string().optional(),
  departamento: z.string().min(1, 'El departamento es obligatorio.'),
  municipio: z.string().min(1),
  distrito: z.string().optional(),
  complemento: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().optional(),
  notas: z.string().optional(),
  estado: z.enum(['ACTIVO', 'INACTIVO', 'PROSPECTO']),
}).superRefine((d, ctx) => {
  if (d.tipo === 'EMPRESA') {
    if (!d.razonSocial?.trim())
      ctx.addIssue({ code: 'custom', path: ['razonSocial'], message: 'La razón social es obligatoria.' });
    if (d.nit && !/^\d{4}-\d{6}-\d{3}-\d$/.test(d.nit))
      ctx.addIssue({ code: 'custom', path: ['nit'], message: 'Formato: 0614-DDMMAA-NNN-N' });
    if (d.ncr && !/^\d{1,8}-\d$/.test(d.ncr))
      ctx.addIssue({ code: 'custom', path: ['ncr'], message: 'Formato: NNNNNN-N' });
  } else {
    if (!d.nombre?.trim())
      ctx.addIssue({ code: 'custom', path: ['nombre'], message: 'El nombre es obligatorio.' });
    if (d.dui && !/^\d{8}-\d$/.test(d.dui))
      ctx.addIssue({ code: 'custom', path: ['dui'], message: 'Formato: NNNNNNNN-N' });
    if (d.nit && !/^\d{4}-\d{6}-\d{3}-\d$/.test(d.nit))
      ctx.addIssue({ code: 'custom', path: ['nit'], message: 'Formato: 0614-DDMMAA-NNN-N' });
    if (d.ncr && !/^\d{1,8}-\d$/.test(d.ncr))
      ctx.addIssue({ code: 'custom', path: ['ncr'], message: 'Formato: NNNNNN-N' });
  }
  if (d.telefono && !/^\+\d{6,15}$/.test(d.telefono))
    ctx.addIssue({ code: 'custom', path: ['telefono'], message: 'Número inválido (6–12 dígitos locales).' });
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))
    ctx.addIssue({ code: 'custom', path: ['email'], message: 'Correo inválido.' });
});

type FormData = z.infer<typeof schema>;

const DEFAULTS: FormData = {
  tipo: 'EMPRESA',
  razonSocial: '', nombreComercial: '', nit: '', ncr: '', sector: '', actividadEconomica: '',
  nombre: '', apellido: '', dui: '', ocupacion: '',
  departamento: '', municipio: '', distrito: '',
  complemento: '', telefono: '', email: '', notas: '',
  estado: 'ACTIVO',
};

// Clases reutilizables para inputs/selects/textareas
const inputBase = 'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk   = `${inputBase} border-bd`;
const inputErr  = `${inputBase} border-danger`;
const monoBase  = 'font-mono';

export function ClienteForm({ id }: { id?: string }) {
  const isNew = !id;
  const router = useRouter();
  const [confirmDesact, setConfirmDesact] = useState(false);

  const { data: existing, isLoading: loadingExisting } = useCliente(id ?? '');
  const crear = useCrearCliente();
  const editar = useEditarCliente();
  const cambiarEstado = useCambiarEstadoCliente();

  const { register, handleSubmit, watch, setValue, setError, reset, control, formState: { errors } } =
    useForm<FormData>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });

  const tipo = watch('tipo');
  const departamento = watch('departamento');
  const municipio = watch('municipio');
  const sector = watch('sector');
  const munis = getMunicipiosByDept(departamento);
  // Sin dept+muni → muestra los 262 distritos; solo dept → filtra por dept; ambos → filtra por ambos.
  const distritos = !departamento
    ? DISTRITOS_SV
    : !municipio
      ? DISTRITOS_SV.filter((d) => d.department === departamento)
      : getDistritosByMuniDept(departamento, municipio);

  // Actividades filtradas según el sector seleccionado; sin sector muestra todas.
  const actividadesFiltradas = sector
    ? ACTIVIDADES_ECONOMICAS_SV.filter((a) => a.sector === sector)
    : ACTIVIDADES_ECONOMICAS_SV;

  const { onChange: onDeptChange, ...deptRest } = register('departamento');
  const { onChange: onMuniChange, ...muniRest } = register('municipio');
  const { onChange: onSectorChange, ...sectorRest } = register('sector');

  // Cuando el distrito se selecciona primero, guardamos el municipio pendiente aquí
  // y lo aplicamos en el efecto de abajo, DESPUÉS de que el nuevo departamento haya
  // causado un re-render con las opciones de municipio ya actualizadas en el DOM.
  const pendingMuniRef = useRef<string>('');

  useEffect(() => {
    if (pendingMuniRef.current) {
      setValue('municipio', pendingMuniRef.current);
      pendingMuniRef.current = '';
    }
  }, [departamento, setValue]);

  useEffect(() => {
    if (existing) {
      // null desde Prisma rompe z.string().optional() que solo acepta string|undefined — normalizar a ''
      const clean = Object.fromEntries(
        Object.entries(existing).map(([k, v]) => [k, v ?? ''])
      );
      reset({ ...DEFAULTS, ...(clean as Partial<FormData>) });
    }
  }, [existing, reset]);

  const isPending = crear.isPending || editar.isPending || cambiarEstado.isPending;

  function handleError(err: unknown) {
    const e = (err as any)?.response?.data?.error;
    const details: { field: string; message: string }[] = e?.details ?? [];
    details.forEach((d) => setError(d.field as keyof FormData, { message: d.message }));
    if (!details.length) toast.error(e?.message ?? 'Ocurrió un error inesperado.');
  }

  function onSubmit(data: FormData) {
    if (isNew) {
      crear.mutate(data as any, {
        onSuccess: () => { toast.success('Cliente creado correctamente.'); router.push('/clientes'); },
        onError: handleError,
      });
    } else {
      editar.mutate({ id: id!, data }, {
        onSuccess: () => { toast.success('Cambios guardados correctamente.'); router.push(`/clientes/${id}`); },
        onError: handleError,
      });
    }
  }

  function handleDesactivar() {
    cambiarEstado.mutate({ id: id!, estado: 'INACTIVO' }, {
      onSuccess: () => { toast.success('Cliente desactivado.'); router.push(`/clientes/${id}`); },
      onError: handleError,
    });
    setConfirmDesact(false);
  }

  if (!isNew && loadingExisting) return <div className="flex justify-center p-12"><Spinner /></div>;

  return (
    <div>
      <PageHeader
        title={isNew ? 'Nuevo cliente' : `Editar — ${existing?.razonSocial ?? existing?.nombre ?? ''}`}
        subtitle={isNew ? 'Registrá un cliente para emitir cotizaciones y facturas.' : 'Modificá los datos del cliente.'}
        back
        onBack={() => router.push(isNew ? '/clientes' : `/clientes/${id}`)}
      />

      {confirmDesact && (
        <ConfirmRow
          message={<>¿Desactivar al cliente <b>{existing?.razonSocial ?? existing?.nombre}</b>? El registro permanecerá pero quedará fuera de los selectores de nuevos documentos.</>}
          onCancel={() => setConfirmDesact(false)}
          onConfirm={handleDesactivar}
          confirmLabel="Sí, desactivar"
        />
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <FormSection title="Tipo de cliente">
          <div className="flex p-0.5 rounded-lg border border-bd bg-bg-sunken w-fit">
            {(['EMPRESA', 'PARTICULAR'] as const).map((t) => (
              <div
                key={t}
                className={`px-4 py-1.5 rounded-md text-sm cursor-pointer select-none transition-all ${
                  tipo === t ? 'bg-surface text-tx font-medium shadow-sm' : 'text-tx-2 hover:text-tx'
                }`}
                onClick={() => setValue('tipo', t)}
              >
                {t === 'EMPRESA' ? 'Empresa' : 'Particular'}
              </div>
            ))}
          </div>
        </FormSection>

        <FormSection title={tipo === 'EMPRESA' ? 'Datos de la empresa' : 'Datos personales'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tipo === 'EMPRESA' ? (
              <>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-xs font-medium text-tx-2">Razón social <span className="text-danger">*</span></label>
                  <input className={errors.razonSocial ? inputErr : inputOk} {...register('razonSocial')} placeholder="Constructora Ejemplo, S.A. de C.V." />
                  {errors.razonSocial && <p className="text-xs text-danger mt-0.5">{errors.razonSocial.message}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">NIT</label>
                  <input className={`${errors.nit ? inputErr : inputOk} ${monoBase}`} {...register('nit')} placeholder="0614-DDMMAA-NNN-N" />
                  {errors.nit && <p className="text-xs text-danger mt-0.5">{errors.nit.message}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">NCR</label>
                  <input className={`${errors.ncr ? inputErr : inputOk} ${monoBase}`} {...register('ncr')} placeholder="183456-7" />
                  {errors.ncr && <p className="text-xs text-danger mt-0.5">{errors.ncr.message}</p>}
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-xs font-medium text-tx-2">Nombre comercial</label>
                  <input className={inputOk} {...register('nombreComercial')} placeholder="Nombre con el que se conoce comúnmente" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">Sector</label>
                  <select
                    className={inputOk}
                    {...sectorRest}
                    onChange={(e) => {
                      onSectorChange(e);
                      setValue('actividadEconomica', '');
                    }}
                  >
                    <option value="">— Seleccionar —</option>
                    {SECTORES_CAT019.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">Actividad económica (CAT-019)</label>
                  <select className={inputOk} {...register('actividadEconomica')}>
                    <option value="">— Seleccionar actividad —</option>
                    {sector ? (
                      actividadesFiltradas.map((a) => (
                        <option key={a.codigo} value={a.codigo}>
                          {a.codigo} — {a.descripcion}
                        </option>
                      ))
                    ) : (
                      SECTORES_CAT019.map((s) => {
                        const acts = ACTIVIDADES_ECONOMICAS_SV.filter((a) => a.sector === s);
                        if (!acts.length) return null;
                        return (
                          <optgroup key={s} label={s}>
                            {acts.map((a) => (
                              <option key={a.codigo} value={a.codigo}>
                                {a.codigo} — {a.descripcion}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })
                    )}
                  </select>
                  {!sector && <p className="text-xs text-tx-3 mt-0.5">Seleccioná un sector para filtrar las actividades.</p>}
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">Nombre <span className="text-danger">*</span></label>
                  <input className={errors.nombre ? inputErr : inputOk} {...register('nombre')} placeholder="Juan Carlos" />
                  {errors.nombre && <p className="text-xs text-danger mt-0.5">{errors.nombre.message}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">Apellido</label>
                  <input className={inputOk} {...register('apellido')} placeholder="Hernández Pérez" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">DUI</label>
                  <input className={`${errors.dui ? inputErr : inputOk} ${monoBase}`} {...register('dui')} placeholder="01234567-8" />
                  {errors.dui && <p className="text-xs text-danger mt-0.5">{errors.dui.message}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">Ocupación</label>
                  <input className={inputOk} {...register('ocupacion')} placeholder="Ej. Arquitecto independiente" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">NIT (opcional)</label>
                  <input className={`${errors.nit ? inputErr : inputOk} ${monoBase}`} {...register('nit')} placeholder="0614-DDMMAA-NNN-N" />
                  <p className="text-xs text-tx-3 mt-0.5">Solo para particulares con obligación tributaria.</p>
                  {errors.nit && <p className="text-xs text-danger mt-0.5">{errors.nit.message}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">NCR (opcional)</label>
                  <input className={`${errors.ncr ? inputErr : inputOk} ${monoBase}`} {...register('ncr')} placeholder="183456-7" />
                  {errors.ncr && <p className="text-xs text-danger mt-0.5">{errors.ncr.message}</p>}
                </div>
              </>
            )}
          </div>
        </FormSection>

        <FormSection title="Dirección">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-tx-2">Departamento <span className="text-danger">*</span></label>
              <select
                className={errors.departamento ? inputErr : inputOk}
                {...deptRest}
                onChange={(e) => {
                  onDeptChange(e);
                  setValue('municipio', '');
                  setValue('distrito', '');
                }}
              >
                <option value="">— Seleccionar —</option>
                {DEPARTAMENTOS_SV.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              {errors.departamento && <p className="text-xs text-danger mt-0.5">{errors.departamento.message}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-tx-2">Municipio</label>
              <select
                className={inputOk}
                {...muniRest}
                onChange={(e) => {
                  onMuniChange(e);
                  setValue('distrito', '');
                }}
              >
                <option value="">— Seleccionar —</option>
                {munis.map((m) => <option key={`${m.department}-${m.value}`} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-tx-2">Distrito</label>
              {/* Clave compuesta dept|muni|value en el <option> porque el código de distrito
                  no es único globalmente — el mismo valor existe en distintos municipios. */}
              <select
                className={inputOk}
                value={
                  departamento && municipio && watch('distrito')
                    ? `${departamento}|${municipio}|${watch('distrito')}`
                    : ''
                }
                onChange={(e) => {
                  const composite = e.target.value;
                  if (!composite) { setValue('distrito', ''); return; }
                  const [dept, muni, code] = composite.split('|');
                  setValue('distrito', code);
                  if (dept !== departamento) {
                    // El cambio de departamento causa un re-render que actualiza las opciones
                    // de municipio en el DOM. Guardamos el municipio en un ref y lo aplicamos
                    // en el useEffect que se ejecuta después de ese re-render.
                    pendingMuniRef.current = muni;
                    setValue('departamento', dept);
                  } else if (muni !== municipio) {
                    setValue('municipio', muni);
                  }
                }}
              >
                <option value="">— Seleccionar —</option>
                {distritos.map((d) => (
                  <option
                    key={`${d.department}-${d.municipality}-${d.value}`}
                    value={`${d.department}|${d.municipality}|${d.value}`}
                  >
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-3">
              <label className="text-xs font-medium text-tx-2">Complemento (dirección detallada)</label>
              <textarea className={`${inputOk} resize-y`} {...register('complemento')} placeholder="Colonia, calle, número, referencia…" rows={2} />
            </div>
          </div>
        </FormSection>

        <FormSection title="Contacto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-tx-2">Teléfono</label>
              <PhoneInputField control={control} name="telefono" error={!!errors.telefono} placeholder="2222-0000" />
              {errors.telefono && <p className="text-xs text-danger mt-0.5">{errors.telefono.message}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-tx-2">Correo electrónico</label>
              <input className={errors.email ? inputErr : inputOk} type="email" {...register('email')} placeholder="contacto@empresa.sv" />
              {errors.email && <p className="text-xs text-danger mt-0.5">{errors.email.message}</p>}
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-tx-2">Notas internas</label>
              <textarea className={`${inputOk} resize-y`} {...register('notas')} placeholder="Información adicional para el equipo de ventas (opcional)." rows={3} />
            </div>
            {!isNew && (
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs font-medium text-tx-2">Estado</label>
                <div className="flex p-0.5 rounded-lg border border-bd bg-bg-sunken w-fit">
                  {(['ACTIVO', 'INACTIVO', 'PROSPECTO'] as const).map((s) => (
                    <div
                      key={s}
                      className={`px-4 py-1.5 rounded-md text-sm cursor-pointer select-none transition-all ${
                        watch('estado') === s ? 'bg-surface text-tx font-medium shadow-sm' : 'text-tx-2 hover:text-tx'
                      }`}
                      onClick={() => setValue('estado', s)}
                    >
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </FormSection>

        <div className="flex flex-col sm:flex-row gap-3 pt-4 mt-2 border-t border-bd">
          <button type="button" className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm text-tx-2 border border-bd hover:bg-bg-sunken transition-colors w-full sm:w-auto" onClick={() => router.back()}>
            Cancelar
          </button>
          {!isNew && existing?.estado !== 'INACTIVO' && (
            <button type="button" className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm text-danger border border-bd hover:bg-bg-sunken transition-colors w-full sm:w-auto sm:mr-auto" onClick={() => setConfirmDesact(true)}>
              <Icon name="x" size={14} /> Desactivar cliente
            </button>
          )}
          <button type="submit" className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors w-full sm:w-auto disabled:opacity-50" disabled={isPending}>
            {isPending ? <><Spinner /> Guardando…</> : <><Icon name="check" size={14} /> {isNew ? 'Crear cliente' : 'Guardar cambios'}</>}
          </button>
        </div>
      </form>
    </div>
  );
}
