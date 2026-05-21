'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { useContacto, useCrearContacto, useEditarContacto } from '@/hooks/use-contactos';
import { useClientes } from '@/hooks/use-clientes';

const TIPOS_CONTACTO = [
  { value: 'PRINCIPAL',   label: 'Principal' },
  { value: 'SECUNDARIO',  label: 'Secundario' },
  { value: 'SOLICITANTE', label: 'Solicitante' },
  { value: 'FACTURACION', label: 'Facturación' },
  { value: 'OPERATIVO',   label: 'Operativo' },
] as const;

const schema = z.object({
  clienteId: z.string().min(1, 'El cliente es obligatorio.'),
  nombre: z.string().min(1, 'El nombre es obligatorio.'),
  apellido: z.string().optional(),
  cargo: z.string().optional(),
  tipoContacto: z.enum(['PRINCIPAL', 'SECUNDARIO', 'SOLICITANTE', 'FACTURACION', 'OPERATIVO']),
  telefono: z.string().optional(),
  email: z.string().optional().refine(
    (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    { message: 'Correo inválido.' }
  ),
  notas: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const DEFAULTS: FormData = {
  clienteId: '', nombre: '', apellido: '', cargo: '',
  tipoContacto: 'SECUNDARIO',
  telefono: '', email: '', notas: '',
};

export function ContactoForm({ id }: { id?: string }) {
  const isNew = !id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientePre = searchParams.get('clienteId') ?? '';

  const { data: existing, isLoading: loadingExisting } = useContacto(id ?? '');
  const { data: clientesData } = useClientes({ limit: 200 });
  const crear = useCrearContacto();
  const editar = useEditarContacto();

  const { register, handleSubmit, watch, setError, reset, formState: { errors } } =
    useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { ...DEFAULTS, clienteId: clientePre } });

  const clienteId = watch('clienteId');
  const clienteReadonly = !isNew || !!clientePre;
  const clienteSeleccionado = clientesData?.data.find((c) => c.id === clienteId);

  useEffect(() => {
    if (existing) reset({ ...DEFAULTS, ...existing });
  }, [existing, reset]);

  const isPending = crear.isPending || editar.isPending;

  function handleError(err: unknown) {
    const e = (err as any)?.response?.data?.error;
    const details: { field: string; message: string }[] = e?.details ?? [];
    details.forEach((d) => setError(d.field as keyof FormData, { message: d.message }));
    if (!details.length) toast.error(e?.message ?? 'Ocurrió un error inesperado.');
  }

  function onSubmit(data: FormData) {
    if (isNew) {
      crear.mutate({ ...data, activo: true }, {
        onSuccess: (c) => {
          toast.success('Contacto creado correctamente.');
          router.push(clientePre ? `/clientes/${clientePre}` : `/contactos/${c.id}`);
        },
        onError: handleError,
      });
    } else {
      editar.mutate({ id: id!, data }, {
        onSuccess: () => { toast.success('Cambios guardados correctamente.'); router.push(`/contactos/${id}`); },
        onError: handleError,
      });
    }
  }

  if (!isNew && loadingExisting) return <div className="flex justify-center p-12"><Spinner /></div>;

  const fullName = [watch('nombre'), watch('apellido')].filter(Boolean).join(' ') || 'Contacto';

  return (
    <div className="form-page">
      <PageHeader
        title={isNew ? 'Nuevo contacto' : `Editar — ${fullName}`}
        subtitle={isNew ? 'Registrá un contacto vinculado a un cliente.' : 'Modificá los datos del contacto.'}
        back
        onBack={() => router.back()}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <FormSection title="Datos del contacto">
          <div className="form-grid">
            <div className="field span-2">
              <label className="field__label">Cliente vinculado <span style={{ color: 'var(--danger)' }}>*</span></label>
              {clienteReadonly ? (
                <div style={{ padding: '10px 12px', background: 'var(--bg-sunken)', border: '1px solid var(--border)', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon name="building" size={16} color="var(--text-2)" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{clienteSeleccionado?.razonSocial ?? clienteSeleccionado?.nombre ?? clienteId}</div>
                    {clienteId && <div className="mono text-3 text-xs">{clienteId}</div>}
                  </div>
                  <span className="badge badge--neutral">Bloqueado</span>
                </div>
              ) : (
                <select className={`select ${errors.clienteId ? 'input--error' : ''}`} {...register('clienteId')}>
                  <option value="">— Seleccionar cliente —</option>
                  {clientesData?.data.map((cl) => (
                    <option key={cl.id} value={cl.id}>{cl.razonSocial ?? cl.nombre} · {cl.id}</option>
                  ))}
                </select>
              )}
              {errors.clienteId && <div className="field__error">{errors.clienteId.message}</div>}
              {!isNew && <div className="field__hint">El cliente vinculado no puede modificarse después de crear el contacto.</div>}
            </div>

            <div className="field">
              <label className="field__label">Nombre <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input className={`input ${errors.nombre ? 'input--error' : ''}`} {...register('nombre')} placeholder="Ej. María José" />
              {errors.nombre && <div className="field__error">{errors.nombre.message}</div>}
            </div>
            <div className="field">
              <label className="field__label">Apellido</label>
              <input className="input" {...register('apellido')} placeholder="Ej. Hernández Pérez" />
            </div>

            <div className="field span-2">
              <label className="field__label">Cargo</label>
              <input className="input" {...register('cargo')} placeholder="Ej. Gerente de Compras, Jefe de Bodega…" />
            </div>

            <div className="field span-2">
              <label className="field__label">Tipo de contacto</label>
              <select className="select" {...register('tipoContacto')} style={{ maxWidth: 320 }}>
                {TIPOS_CONTACTO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div className="field">
              <label className="field__label">Teléfono</label>
              <input className="input mono" {...register('telefono')} placeholder="7777-0000" />
            </div>
            <div className="field">
              <label className="field__label">Correo electrónico</label>
              <input className={`input ${errors.email ? 'input--error' : ''}`} type="email" {...register('email')} placeholder="contacto@empresa.sv" />
              {errors.email && <div className="field__error">{errors.email.message}</div>}
            </div>

            <div className="field span-2">
              <label className="field__label">Notas</label>
              <textarea className="textarea" {...register('notas')} placeholder="Información adicional para el equipo de ventas (opcional)." />
            </div>
          </div>
        </FormSection>

        <div className="form-footer flex-col sm:flex-row">
          <button type="button" className="btn btn--ghost w-full sm:w-auto" onClick={() => router.back()}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary w-full sm:w-auto" disabled={isPending}>
            {isPending ? <><Spinner /> Guardando…</> : <><Icon name="check" size={14} /> {isNew ? 'Crear contacto' : 'Guardar cambios'}</>}
          </button>
        </div>
      </form>
    </div>
  );
}
