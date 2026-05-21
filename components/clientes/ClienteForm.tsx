'use client';

import { useState, useEffect } from 'react';
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
import { DEPARTAMENTOS_SV, MUNICIPIOS_SV, SECTORES } from '@/lib/sv-geo';

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
  } else {
    if (!d.nombre?.trim())
      ctx.addIssue({ code: 'custom', path: ['nombre'], message: 'El nombre es obligatorio.' });
    if (d.dui && !/^\d{8}-\d$/.test(d.dui))
      ctx.addIssue({ code: 'custom', path: ['dui'], message: 'Formato: NNNNNNNN-N' });
    if (d.nit && !/^\d{4}-\d{6}-\d{3}-\d$/.test(d.nit))
      ctx.addIssue({ code: 'custom', path: ['nit'], message: 'Formato: 0614-DDMMAA-NNN-N' });
  }
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))
    ctx.addIssue({ code: 'custom', path: ['email'], message: 'Correo inválido.' });
});

type FormData = z.infer<typeof schema>;

const DEFAULTS: FormData = {
  tipo: 'EMPRESA',
  razonSocial: '', nombreComercial: '', nit: '', ncr: '', sector: '', actividadEconomica: '',
  nombre: '', apellido: '', dui: '', ocupacion: '',
  departamento: 'San Salvador', municipio: 'San Salvador',
  complemento: '', telefono: '', email: '', notas: '',
  estado: 'ACTIVO',
};

export function ClienteForm({ id }: { id?: string }) {
  const isNew = !id;
  const router = useRouter();
  const [confirmDesact, setConfirmDesact] = useState(false);

  const { data: existing, isLoading: loadingExisting } = useCliente(id ?? '');
  const crear = useCrearCliente();
  const editar = useEditarCliente();
  const cambiarEstado = useCambiarEstadoCliente();

  const { register, handleSubmit, watch, setValue, setError, reset, formState: { errors } } =
    useForm<FormData>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });

  const tipo = watch('tipo');
  const departamento = watch('departamento');
  const munis = MUNICIPIOS_SV[departamento] ?? [departamento];

  // Descomponer el onChange de RHF para el select de departamento para poder
  // encadenar nuestra lógica de reset de municipio sin reemplazar el handler de RHF.
  const { onChange: onDeptChange, ...deptRest } = register('departamento');

  useEffect(() => {
    if (existing) reset({ ...DEFAULTS, ...existing });
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
    <div className="form-page">
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
          <div className="seg" style={{ maxWidth: 320 }}>
            {(['EMPRESA', 'PARTICULAR'] as const).map((t) => (
              <div key={t} className={`seg__opt ${tipo === t ? 'is-active' : ''}`} onClick={() => setValue('tipo', t)}>
                {t === 'EMPRESA' ? 'Empresa' : 'Particular'}
              </div>
            ))}
          </div>
        </FormSection>

        <FormSection title={tipo === 'EMPRESA' ? 'Datos de la empresa' : 'Datos personales'}>
          <div className="form-grid">
            {tipo === 'EMPRESA' ? (
              <>
                <div className="field span-2">
                  <label className="field__label">Razón social <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input className={`input ${errors.razonSocial ? 'input--error' : ''}`} {...register('razonSocial')} placeholder="Constructora Ejemplo, S.A. de C.V." />
                  {errors.razonSocial && <div className="field__error">{errors.razonSocial.message}</div>}
                </div>
                <div className="field">
                  <label className="field__label">NIT</label>
                  <input className={`input mono ${errors.nit ? 'input--error' : ''}`} {...register('nit')} placeholder="0614-DDMMAA-NNN-N" />
                  {errors.nit && <div className="field__error">{errors.nit.message}</div>}
                </div>
                <div className="field">
                  <label className="field__label">NCR</label>
                  <input className="input mono" {...register('ncr')} placeholder="183456-7" />
                </div>
                <div className="field span-2">
                  <label className="field__label">Nombre comercial</label>
                  <input className="input" {...register('nombreComercial')} placeholder="Nombre con el que se conoce comúnmente" />
                </div>
                <div className="field">
                  <label className="field__label">Sector</label>
                  <select className="select" {...register('sector')}>
                    <option value="">— Seleccionar —</option>
                    {SECTORES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field__label">Actividad económica</label>
                  <input className="input" {...register('actividadEconomica')} placeholder="Ej. Construcción de obra civil" />
                </div>
              </>
            ) : (
              <>
                <div className="field">
                  <label className="field__label">Nombre <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input className={`input ${errors.nombre ? 'input--error' : ''}`} {...register('nombre')} placeholder="Juan Carlos" />
                  {errors.nombre && <div className="field__error">{errors.nombre.message}</div>}
                </div>
                <div className="field">
                  <label className="field__label">Apellido</label>
                  <input className="input" {...register('apellido')} placeholder="Hernández Pérez" />
                </div>
                <div className="field">
                  <label className="field__label">DUI</label>
                  <input className={`input mono ${errors.dui ? 'input--error' : ''}`} {...register('dui')} placeholder="01234567-8" />
                  {errors.dui && <div className="field__error">{errors.dui.message}</div>}
                </div>
                <div className="field">
                  <label className="field__label">Ocupación</label>
                  <input className="input" {...register('ocupacion')} placeholder="Ej. Arquitecto independiente" />
                </div>
                <div className="field">
                  <label className="field__label">NIT (opcional)</label>
                  <input className={`input mono ${errors.nit ? 'input--error' : ''}`} {...register('nit')} placeholder="0614-DDMMAA-NNN-N" />
                  <div className="field__hint">Solo para particulares con obligación tributaria.</div>
                  {errors.nit && <div className="field__error">{errors.nit.message}</div>}
                </div>
                <div className="field">
                  <label className="field__label">NCR (opcional)</label>
                  <input className="input mono" {...register('ncr')} placeholder="183456-7" />
                </div>
              </>
            )}
          </div>
        </FormSection>

        <FormSection title="Dirección">
          <div className="form-grid">
            <div className="field">
              <label className="field__label">Departamento <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select
                className="select"
                {...deptRest}
                onChange={(e) => {
                  onDeptChange(e);
                  const m = MUNICIPIOS_SV[e.target.value];
                  if (m) setValue('municipio', m[0]);
                }}
              >
                {DEPARTAMENTOS_SV.map((d) => <option key={d}>{d}</option>)}
              </select>
              {errors.departamento && <div className="field__error">{errors.departamento.message}</div>}
            </div>
            <div className="field">
              <label className="field__label">Municipio</label>
              <select className="select" {...register('municipio')}>
                {munis.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="field span-2">
              <label className="field__label">Complemento (dirección detallada)</label>
              <textarea className="textarea" {...register('complemento')} placeholder="Colonia, calle, número, referencia…" style={{ minHeight: 60 }} />
            </div>
          </div>
        </FormSection>

        <FormSection title="Contacto">
          <div className="form-grid">
            <div className="field">
              <label className="field__label">Teléfono</label>
              <input className="input mono" {...register('telefono')} placeholder="2222-0000" />
            </div>
            <div className="field">
              <label className="field__label">Correo electrónico</label>
              <input className={`input ${errors.email ? 'input--error' : ''}`} type="email" {...register('email')} placeholder="contacto@empresa.sv" />
              {errors.email && <div className="field__error">{errors.email.message}</div>}
            </div>
            <div className="field span-2">
              <label className="field__label">Notas internas</label>
              <textarea className="textarea" {...register('notas')} placeholder="Información adicional para el equipo de ventas (opcional)." />
            </div>
            {!isNew && (
              <div className="field span-2">
                <label className="field__label">Estado</label>
                <div className="seg" style={{ maxWidth: 400 }}>
                  {(['ACTIVO', 'INACTIVO', 'PROSPECTO'] as const).map((s) => (
                    <div key={s} className={`seg__opt ${watch('estado') === s ? 'is-active' : ''}`} onClick={() => setValue('estado', s)}>
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </FormSection>

        <div className="form-footer flex-col sm:flex-row">
          <button type="button" className="btn btn--ghost w-full sm:w-auto" onClick={() => router.back()}>
            Cancelar
          </button>
          {!isNew && existing?.estado !== 'INACTIVO' && (
            <button type="button" className="btn btn--ghost w-full sm:w-auto sm:mr-auto" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDesact(true)}>
              <Icon name="x" size={14} /> Desactivar cliente
            </button>
          )}
          <button type="submit" className="btn btn--primary w-full sm:w-auto" disabled={isPending}>
            {isPending ? <><Spinner /> Guardando…</> : <><Icon name="check" size={14} /> {isNew ? 'Crear cliente' : 'Guardar cambios'}</>}
          </button>
        </div>
      </form>
    </div>
  );
}
