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
import { PAISES, PAISES_CODIGOS } from '@/lib/paises';
import { PhoneInputField } from '@/components/ui/PhoneInputField';
import {
  formatDocumento,
  validarDocumento,
  TIPOS_DOCUMENTO_PARTICULAR,
  TIPOS_DOCUMENTO_EMPRESA,
  TIPOS_DOCUMENTO_INTERNACIONAL,
  LABEL_TIPO_DOCUMENTO,
  PLACEHOLDER_POR_TIPO,
  MAXLENGTH_POR_TIPO,
  MENSAJE_FORMATO_DOCUMENTO,
  formatNCR,
  type TipoDocumentoCliente,
} from '@/lib/format-documentos';
import { DIAS_SEMANA, LABEL_DIA_CORTO, type DiaSemana } from '@/lib/dias-semana';

const schema = z.object({
  tipo: z.enum(['EMPRESA', 'PARTICULAR', 'INTERNACIONAL']),
  razonSocial: z.string().optional(),
  nombreComercial: z.string().optional(),
  sector: z.string().optional(),
  actividadEconomica: z.string().optional(),
  nombre: z.string().optional(),
  apellido: z.string().optional(),
  ocupacion: z.string().optional(),
  tipoDocumento: z.enum(['DUI', 'NIT', 'PASAPORTE', 'CARNET_RESIDENTE', 'OTRO']).optional().or(z.literal('')),
  numeroDocumento: z.string().optional(),
  ncr: z.string().optional(),
  departamento: z.string().optional(),
  municipio: z.string().optional(),
  distrito: z.string().optional(),
  complemento: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().optional(),
  notas: z.string().optional(),
  estado: z.enum(['ACTIVO', 'INACTIVO', 'PROSPECTO']),
  manejaQuedan: z.boolean(),
  diasRecepcionQuedan: z.array(z.enum(DIAS_SEMANA)),
  tipoPersona: z.enum(['NATURAL', 'JURIDICA']).optional().or(z.literal('')),
  codPais: z.string().optional(),
  tamanoContribuyente: z.enum(['GRANDE', 'MEDIANO', 'OTROS']).optional().or(z.literal('')),
}).superRefine((d, ctx) => {
  if (d.tipo === 'EMPRESA') {
    if (!d.razonSocial?.trim())
      ctx.addIssue({ code: 'custom', path: ['razonSocial'], message: 'La razón social es obligatoria.' });
    if (d.tipoDocumento && d.tipoDocumento !== 'DUI' && d.tipoDocumento !== 'NIT')
      ctx.addIssue({ code: 'custom', path: ['tipoDocumento'], message: 'EMPRESA solo acepta DUI o NIT.' });
  } else if (d.tipo === 'PARTICULAR') {
    if (!d.nombre?.trim())
      ctx.addIssue({ code: 'custom', path: ['nombre'], message: 'El nombre es obligatorio.' });
  } else {
    // INTERNACIONAL: todos los datos del recipient FEX son obligatorios al crear.
    if (!d.tipoPersona)
      ctx.addIssue({ code: 'custom', path: ['tipoPersona'], message: 'Seleccioná persona natural o jurídica.' });
    if (d.tipoPersona === 'NATURAL' && !d.nombre?.trim())
      ctx.addIssue({ code: 'custom', path: ['nombre'], message: 'El nombre es obligatorio.' });
    if (d.tipoPersona === 'JURIDICA' && !d.razonSocial?.trim())
      ctx.addIssue({ code: 'custom', path: ['razonSocial'], message: 'La razón social es obligatoria.' });
    if (!d.codPais || !PAISES_CODIGOS.has(d.codPais))
      ctx.addIssue({ code: 'custom', path: ['codPais'], message: 'Seleccioná el país.' });
    if (!d.complemento?.trim())
      ctx.addIssue({ code: 'custom', path: ['complemento'], message: 'La dirección es obligatoria.' });
    if ((d.complemento ?? '').length > 300)
      ctx.addIssue({ code: 'custom', path: ['complemento'], message: 'Máximo 300 caracteres.' });
    if (!d.actividadEconomica)
      ctx.addIssue({ code: 'custom', path: ['actividadEconomica'], message: 'La actividad económica es obligatoria.' });
    if (!d.tipoDocumento)
      ctx.addIssue({ code: 'custom', path: ['tipoDocumento'], message: 'El documento es obligatorio.' });
    if (!d.email?.trim())
      ctx.addIssue({ code: 'custom', path: ['email'], message: 'El correo es obligatorio (recibe el DTE).' });
  }
  // Dirección SV: obligatoria solo para clientes nacionales.
  if (d.tipo !== 'INTERNACIONAL') {
    if (!d.departamento?.trim())
      ctx.addIssue({ code: 'custom', path: ['departamento'], message: 'El departamento es obligatorio.' });
    if (!d.municipio?.trim())
      ctx.addIssue({ code: 'custom', path: ['municipio'], message: 'El municipio es obligatorio.' });
  }
  const tipoDocRaw = d.tipoDocumento as string | undefined;
  const tipoDoc = tipoDocRaw && tipoDocRaw !== '' ? d.tipoDocumento : undefined;
  if (tipoDoc && !d.numeroDocumento?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['numeroDocumento'], message: 'Ingresá el número del documento.' });
  }
  if (!tipoDoc && d.numeroDocumento?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['tipoDocumento'], message: 'Seleccioná el tipo de documento.' });
  }
  if (tipoDoc && d.numeroDocumento?.trim() && !validarDocumento(tipoDoc, d.numeroDocumento)) {
    ctx.addIssue({ code: 'custom', path: ['numeroDocumento'], message: MENSAJE_FORMATO_DOCUMENTO[tipoDoc] });
  }
  if (d.ncr && !/^(\d{4}-\d|\d{6}-\d)$/.test(d.ncr))
    ctx.addIssue({ code: 'custom', path: ['ncr'], message: 'Formato: NNNN-N o NNNNNN-N' });
  if (d.telefono && !/^\+\d{6,15}$/.test(d.telefono))
    ctx.addIssue({ code: 'custom', path: ['telefono'], message: 'Número inválido (6–12 dígitos locales).' });
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))
    ctx.addIssue({ code: 'custom', path: ['email'], message: 'Correo inválido.' });
});

type FormData = z.infer<typeof schema>;

const DEFAULTS: FormData = {
  tipo: 'EMPRESA',
  razonSocial: '', nombreComercial: '', sector: '', actividadEconomica: '',
  nombre: '', apellido: '', ocupacion: '',
  tipoDocumento: '', numeroDocumento: '', ncr: '',
  departamento: '', municipio: '', distrito: '',
  complemento: '', telefono: '', email: '', notas: '',
  estado: 'ACTIVO',
  manejaQuedan: false,
  diasRecepcionQuedan: [],
  tipoPersona: '', codPais: '', tamanoContribuyente: '',
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
  const manejaQuedan = watch('manejaQuedan');
  const diasSeleccionados = watch('diasRecepcionQuedan');
  const tipoPersona = watch('tipoPersona');

  function toggleDia(dia: DiaSemana) {
    const actual = diasSeleccionados ?? [];
    setValue(
      'diasRecepcionQuedan',
      actual.includes(dia) ? actual.filter((d) => d !== dia) : [...actual, dia],
      { shouldDirty: true },
    );
  }
  const munis = getMunicipiosByDept(departamento ?? '');
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

  // Casteamos a string para poder comparar con '' sin que TS se queje del union type
  const tipoDocumentoValue = watch('tipoDocumento') as string | undefined;
  const numeroDocReg = register('numeroDocumento');

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

  async function onSubmit(data: FormData) {
    if (isNew) {
      crear.mutate(data as any, {
        onSuccess: () => { toast.success('Cliente creado correctamente.'); router.push('/clientes'); },
        onError: handleError,
      });
      return;
    }
    // El backend NO acepta `estado` en PUT /clientes/:id (el schema lo descarta
    // silenciosamente, por eso el toast salía "guardado" pero el estado no
    // cambiaba). El cambio de estado se hace en PATCH /clientes/:id/estado,
    // exactamente igual que en EquipoForm.
    const { estado, ...rest } = data;
    try {
      // El tipo Cliente en types/api.ts aún tiene nit/dui — se actualizará en Task 17
      await editar.mutateAsync({ id: id!, data: rest as any });
      if (estado && estado !== existing?.estado) {
        await cambiarEstado.mutateAsync({ id: id!, estado });
      }
      toast.success('Cambios guardados correctamente.');
      router.push(`/clientes/${id}`);
    } catch (err) {
      handleError(err);
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
            {(['EMPRESA', 'PARTICULAR', 'INTERNACIONAL'] as const).map((t) => (
              <div
                key={t}
                className={`px-4 py-1.5 rounded-md text-sm cursor-pointer select-none transition-all ${
                  tipo === t ? 'bg-surface text-tx font-medium shadow-sm' : 'text-tx-2 hover:text-tx'
                }`}
                onClick={() => setValue('tipo', t)}
              >
                {t === 'EMPRESA' ? 'Empresa' : t === 'PARTICULAR' ? 'Particular' : 'Internacional'}
              </div>
            ))}
          </div>
        </FormSection>

        <FormSection title={tipo === 'EMPRESA' ? 'Datos de la empresa' : tipo === 'PARTICULAR' ? 'Datos personales' : 'Datos del cliente internacional'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tipo === 'EMPRESA' ? (
              <>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-xs font-medium text-tx-2">Razón social <span className="text-danger">*</span></label>
                  <input className={errors.razonSocial ? inputErr : inputOk} {...register('razonSocial')} placeholder="Constructora Ejemplo, S.A. de C.V." />
                  {errors.razonSocial && <p className="text-xs text-danger mt-0.5">{errors.razonSocial.message}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">Tipo de documento</label>
                  <select
                    className={errors.tipoDocumento ? inputErr : inputOk}
                    {...register('tipoDocumento')}
                    onChange={(e) => {
                      void register('tipoDocumento').onChange(e);
                      setValue('numeroDocumento', '');
                    }}
                  >
                    <option value="">— Seleccionar —</option>
                    {TIPOS_DOCUMENTO_EMPRESA.map((t) => (
                      <option key={t} value={t}>{LABEL_TIPO_DOCUMENTO[t]}</option>
                    ))}
                  </select>
                  {errors.tipoDocumento && <p className="text-xs text-danger mt-0.5">{errors.tipoDocumento.message}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">Número del documento</label>
                  <input
                    className={`${errors.numeroDocumento ? inputErr : inputOk} ${monoBase}`}
                    inputMode="numeric"
                    maxLength={tipoDocumentoValue && tipoDocumentoValue !== '' ? MAXLENGTH_POR_TIPO[tipoDocumentoValue as TipoDocumentoCliente] : 17}
                    placeholder={tipoDocumentoValue && tipoDocumentoValue !== '' ? PLACEHOLDER_POR_TIPO[tipoDocumentoValue as TipoDocumentoCliente] : 'Seleccioná un tipo primero'}
                    disabled={!tipoDocumentoValue}
                    {...numeroDocReg}
                    onChange={(e) => {
                      if (tipoDocumentoValue && tipoDocumentoValue !== '') {
                        e.target.value = formatDocumento(tipoDocumentoValue as TipoDocumentoCliente, e.target.value);
                      }
                      void numeroDocReg.onChange(e);
                    }}
                  />
                  {errors.numeroDocumento && <p className="text-xs text-danger mt-0.5">{errors.numeroDocumento.message}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">NCR</label>
                  <input
                    className={`${errors.ncr ? inputErr : inputOk} ${monoBase}`}
                    inputMode="numeric"
                    maxLength={8}
                    {...register('ncr')}
                    onChange={(e) => {
                      e.target.value = formatNCR(e.target.value);
                      void register('ncr').onChange(e);
                    }}
                    placeholder="9166-9 o 183456-7"
                  />
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
            ) : tipo === 'PARTICULAR' ? (
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
                  <label className="text-xs font-medium text-tx-2">Tipo de documento</label>
                  <select
                    className={errors.tipoDocumento ? inputErr : inputOk}
                    {...register('tipoDocumento')}
                    onChange={(e) => {
                      void register('tipoDocumento').onChange(e);
                      setValue('numeroDocumento', '');
                    }}
                  >
                    <option value="">— Seleccionar —</option>
                    {TIPOS_DOCUMENTO_PARTICULAR.map((t) => (
                      <option key={t} value={t}>{LABEL_TIPO_DOCUMENTO[t]}</option>
                    ))}
                  </select>
                  {errors.tipoDocumento && <p className="text-xs text-danger mt-0.5">{errors.tipoDocumento.message}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">Número del documento</label>
                  <input
                    className={`${errors.numeroDocumento ? inputErr : inputOk} ${monoBase}`}
                    inputMode={tipoDocumentoValue === 'DUI' || tipoDocumentoValue === 'NIT' ? 'numeric' : 'text'}
                    maxLength={tipoDocumentoValue && tipoDocumentoValue !== '' ? MAXLENGTH_POR_TIPO[tipoDocumentoValue as TipoDocumentoCliente] : 25}
                    placeholder={tipoDocumentoValue && tipoDocumentoValue !== '' ? PLACEHOLDER_POR_TIPO[tipoDocumentoValue as TipoDocumentoCliente] : 'Seleccioná un tipo primero'}
                    disabled={!tipoDocumentoValue}
                    {...numeroDocReg}
                    onChange={(e) => {
                      if (tipoDocumentoValue && tipoDocumentoValue !== '') {
                        e.target.value = formatDocumento(tipoDocumentoValue as TipoDocumentoCliente, e.target.value);
                      }
                      void numeroDocReg.onChange(e);
                    }}
                  />
                  {errors.numeroDocumento && <p className="text-xs text-danger mt-0.5">{errors.numeroDocumento.message}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">Ocupación</label>
                  <input className={inputOk} {...register('ocupacion')} placeholder="Ej. Arquitecto independiente" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">NCR (opcional)</label>
                  <input
                    className={`${errors.ncr ? inputErr : inputOk} ${monoBase}`}
                    inputMode="numeric"
                    maxLength={8}
                    {...register('ncr')}
                    onChange={(e) => {
                      e.target.value = formatNCR(e.target.value);
                      void register('ncr').onChange(e);
                    }}
                    placeholder="9166-9 o 183456-7"
                  />
                  <p className="text-xs text-tx-3 mt-0.5">
                    El NCR solo se incluye en CCF o en FC cuando el documento es NIT.
                  </p>
                  {errors.ncr && <p className="text-xs text-danger mt-0.5">{errors.ncr.message}</p>}
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-xs font-medium text-tx-2">Tipo de persona <span className="text-danger">*</span></label>
                  <div className="flex p-0.5 rounded-lg border border-bd bg-bg-sunken w-fit">
                    {(['NATURAL', 'JURIDICA'] as const).map((p) => (
                      <div
                        key={p}
                        className={`px-4 py-1.5 rounded-md text-sm cursor-pointer select-none transition-all ${
                          tipoPersona === p ? 'bg-surface text-tx font-medium shadow-sm' : 'text-tx-2 hover:text-tx'
                        }`}
                        onClick={() => setValue('tipoPersona', p)}
                      >
                        {p === 'NATURAL' ? 'Persona natural' : 'Persona jurídica'}
                      </div>
                    ))}
                  </div>
                  {errors.tipoPersona && <p className="text-xs text-danger mt-0.5">{errors.tipoPersona.message}</p>}
                </div>

                {tipoPersona === 'JURIDICA' ? (
                  <>
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <label className="text-xs font-medium text-tx-2">Razón social <span className="text-danger">*</span></label>
                      <input className={errors.razonSocial ? inputErr : inputOk} {...register('razonSocial')} placeholder="Constructora Maya, S.A." />
                      {errors.razonSocial && <p className="text-xs text-danger mt-0.5">{errors.razonSocial.message}</p>}
                    </div>
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <label className="text-xs font-medium text-tx-2">Nombre comercial</label>
                      <input className={inputOk} {...register('nombreComercial')} placeholder="Nombre con el que se conoce comúnmente" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-tx-2">Nombre <span className="text-danger">*</span></label>
                      <input className={errors.nombre ? inputErr : inputOk} {...register('nombre')} placeholder="Carlos Andrés" />
                      {errors.nombre && <p className="text-xs text-danger mt-0.5">{errors.nombre.message}</p>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-tx-2">Apellido</label>
                      <input className={inputOk} {...register('apellido')} placeholder="Reyes Molina" />
                    </div>
                  </>
                )}

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">Tipo de documento <span className="text-danger">*</span></label>
                  <select
                    className={errors.tipoDocumento ? inputErr : inputOk}
                    {...register('tipoDocumento')}
                    onChange={(e) => {
                      void register('tipoDocumento').onChange(e);
                      setValue('numeroDocumento', '');
                    }}
                  >
                    <option value="">— Seleccionar —</option>
                    {TIPOS_DOCUMENTO_INTERNACIONAL.map((t) => (
                      <option key={t} value={t}>{LABEL_TIPO_DOCUMENTO[t]}</option>
                    ))}
                  </select>
                  {errors.tipoDocumento && <p className="text-xs text-danger mt-0.5">{errors.tipoDocumento.message}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">Número del documento <span className="text-danger">*</span></label>
                  <input
                    className={`${errors.numeroDocumento ? inputErr : inputOk} ${monoBase}`}
                    inputMode={tipoDocumentoValue === 'DUI' || tipoDocumentoValue === 'NIT' ? 'numeric' : 'text'}
                    maxLength={tipoDocumentoValue && tipoDocumentoValue !== '' ? MAXLENGTH_POR_TIPO[tipoDocumentoValue as TipoDocumentoCliente] : 25}
                    placeholder={tipoDocumentoValue && tipoDocumentoValue !== '' ? PLACEHOLDER_POR_TIPO[tipoDocumentoValue as TipoDocumentoCliente] : 'Seleccioná un tipo primero'}
                    disabled={!tipoDocumentoValue}
                    {...numeroDocReg}
                    onChange={(e) => {
                      if (tipoDocumentoValue && tipoDocumentoValue !== '') {
                        e.target.value = formatDocumento(tipoDocumentoValue as TipoDocumentoCliente, e.target.value);
                      }
                      void numeroDocReg.onChange(e);
                    }}
                  />
                  {errors.numeroDocumento && <p className="text-xs text-danger mt-0.5">{errors.numeroDocumento.message}</p>}
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
                  <label className="text-xs font-medium text-tx-2">Actividad económica (CAT-019) <span className="text-danger">*</span></label>
                  <select className={errors.actividadEconomica ? inputErr : inputOk} {...register('actividadEconomica')}>
                    <option value="">— Seleccionar actividad —</option>
                    {sector ? (
                      actividadesFiltradas.map((a) => (
                        <option key={a.codigo} value={a.codigo}>{a.codigo} — {a.descripcion}</option>
                      ))
                    ) : (
                      SECTORES_CAT019.map((s) => {
                        const acts = ACTIVIDADES_ECONOMICAS_SV.filter((a) => a.sector === s);
                        if (!acts.length) return null;
                        return (
                          <optgroup key={s} label={s}>
                            {acts.map((a) => (
                              <option key={a.codigo} value={a.codigo}>{a.codigo} — {a.descripcion}</option>
                            ))}
                          </optgroup>
                        );
                      })
                    )}
                  </select>
                  {errors.actividadEconomica
                    ? <p className="text-xs text-danger mt-0.5">{errors.actividadEconomica.message}</p>
                    : !sector && <p className="text-xs text-tx-3 mt-0.5">Seleccioná un sector para filtrar las actividades.</p>}
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">Tamaño de contribuyente</label>
                  <select className={inputOk} {...register('tamanoContribuyente')}>
                    <option value="">— Sin especificar —</option>
                    <option value="GRANDE">Grande</option>
                    <option value="MEDIANO">Mediano</option>
                    <option value="OTROS">Otros</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </FormSection>

        {tipo !== 'INTERNACIONAL' && (
          <FormSection title="Facturación">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                {...register('manejaQuedan')}
                className="h-4 w-4 rounded border-bd accent-accent cursor-pointer"
              />
              <span className="text-tx">Maneja factura QUEDAN</span>
              <span
                className="text-xs text-tx-3"
                title="Pre-marca el toggle QUEDAN al generar facturas para este cliente"
              >
                (?)
              </span>
            </label>

            {manejaQuedan && (
              <div className="mt-3">
                <span className="block text-xs font-medium text-tx-2 mb-1.5">
                  Días en que recibe facturas
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {DIAS_SEMANA.map((dia) => {
                    const activo = (diasSeleccionados ?? []).includes(dia);
                    return (
                      <button
                        key={dia}
                        type="button"
                        onClick={() => toggleDia(dia)}
                        aria-pressed={activo}
                        className={
                          activo
                            ? 'px-3 py-1.5 rounded-full text-xs font-semibold bg-accent text-navy transition-colors'
                            : 'px-3 py-1.5 rounded-full text-xs font-medium border border-bd text-tx-2 hover:bg-bg-sunken transition-colors'
                        }
                      >
                        {LABEL_DIA_CORTO[dia]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-tx-3 mt-1.5">
                  Se usa para advertir al programar la entrega de facturas QUEDAN.
                </p>
              </div>
            )}
          </FormSection>
        )}

        <FormSection title="Dirección">
          {tipo !== 'INTERNACIONAL' ? (
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
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-tx-2">País <span className="text-danger">*</span></label>
                <select className={errors.codPais ? inputErr : inputOk} {...register('codPais')}>
                  <option value="">— Seleccionar país —</option>
                  {PAISES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                {errors.codPais && <p className="text-xs text-danger mt-0.5">{errors.codPais.message}</p>}
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs font-medium text-tx-2">Dirección <span className="text-danger">*</span></label>
                <textarea
                  className={`${errors.complemento ? inputErr : inputOk} resize-y`}
                  {...register('complemento')}
                  placeholder="Calle, número, ciudad, estado/provincia…"
                  rows={2}
                  maxLength={300}
                />
                {errors.complemento && <p className="text-xs text-danger mt-0.5">{errors.complemento.message}</p>}
              </div>
            </div>
          )}
        </FormSection>

        <FormSection title="Contacto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-tx-2">Teléfono</label>
              <PhoneInputField control={control} name="telefono" error={!!errors.telefono} placeholder="2222-0000" />
              {errors.telefono && <p className="text-xs text-danger mt-0.5">{errors.telefono.message}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-tx-2">Correo electrónico {tipo === 'INTERNACIONAL' && <span className="text-danger">*</span>}</label>
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
