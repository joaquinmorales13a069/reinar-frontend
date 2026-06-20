'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { Icon } from '@/components/ui/Icon';
import { PhoneInputField } from '@/components/ui/PhoneInputField';
import {
  proveedorCrearSchema,
  proveedorEditarSchema,
  type ProveedorFormValues,
} from '@/lib/schemas/proveedores';
import { useCrearProveedor, useEditarProveedor } from '@/hooks/use-proveedores';
import type { Proveedor } from '@/types/api';

type Props =
  | { modo: 'crear'; proveedor?: undefined }
  | { modo: 'editar'; proveedor: Proveedor };

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-1';

export function ProveedorForm(props: Props) {
  const router = useRouter();
  const crear = useCrearProveedor();
  const editar = useEditarProveedor();

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProveedorFormValues>({
    resolver: zodResolver(props.modo === 'crear' ? proveedorCrearSchema : proveedorEditarSchema) as never,
    defaultValues:
      props.modo === 'crear'
        ? { nombre: '', nrc: '', nit: '', contacto: '', telefono: '', email: '', notas: '' }
        : {
            nombre: props.proveedor.nombre,
            nrc: props.proveedor.nrc ?? '',
            nit: props.proveedor.nit ?? '',
            contacto: props.proveedor.contacto ?? '',
            telefono: props.proveedor.telefono ?? '',
            email: props.proveedor.email ?? '',
            notas: props.proveedor.notas ?? '',
          },
  });

  function aplicarErroresApi(err: unknown) {
    const anyErr = err as {
      response?: { data?: { error?: { details?: { path: string; message: string }[] } } };
    };
    const details = anyErr?.response?.data?.error?.details;
    if (!details?.length) return;
    for (const d of details) {
      setError(d.path as keyof ProveedorFormValues, { type: 'server', message: d.message });
    }
  }

  async function onSubmit(values: ProveedorFormValues) {
    const payload = {
      nombre: values.nombre.trim(),
      nrc: values.nrc?.trim() || undefined,
      nit: values.nit?.trim() || undefined,
      contacto: values.contacto?.trim() || undefined,
      telefono: values.telefono?.trim() || undefined,
      email: values.email?.trim() || undefined,
      notas: values.notas?.trim() || undefined,
    };
    try {
      if (props.modo === 'crear') {
        // useCrearProveedor ya navega a /proveedores/:id en onSuccess
        await crear.mutateAsync(payload);
      } else {
        await editar.mutateAsync({ id: props.proveedor.id, data: payload });
        router.push(`/proveedores/${props.proveedor.id}`);
      }
    } catch (err) {
      aplicarErroresApi(err);
    }
  }

  const isEditar = props.modo === 'editar';
  const isPending = isSubmitting || crear.isPending || editar.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 pb-24">
      <PageHeader
        title={isEditar ? `Editar — ${props.proveedor.nombre}` : 'Nuevo proveedor'}
        subtitle={isEditar ? 'Modifica los datos del proveedor.' : 'Registra un nuevo proveedor.'}
        back
        backLabel={isEditar ? props.proveedor.nombre : 'Proveedores'}
        onBack={() => router.push(isEditar ? `/proveedores/${props.proveedor.id}` : '/proveedores')}
      />

      <FormSection title="Información general">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelCls}>Nombre *</label>
            <input
              className={errors.nombre ? inputErr : inputOk}
              placeholder="Distribuidora Nacional S.A."
              {...register('nombre')}
            />
            {errors.nombre && <p className={errorCls}>{errors.nombre.message}</p>}
          </div>

          <div>
            <label className={labelCls}>NRC</label>
            <input
              className={errors.nrc ? inputErr : `${inputOk} font-mono`}
              placeholder="123456-7"
              {...register('nrc')}
            />
            {errors.nrc && <p className={errorCls}>{errors.nrc.message}</p>}
          </div>

          <div>
            <label className={labelCls}>NIT</label>
            <input
              className={errors.nit ? inputErr : `${inputOk} font-mono`}
              placeholder="0614-123456-001-2"
              {...register('nit')}
            />
            {errors.nit && <p className={errorCls}>{errors.nit.message}</p>}
          </div>

          <div>
            <label className={labelCls}>Persona de contacto</label>
            <input
              className={errors.contacto ? inputErr : inputOk}
              placeholder="Juan Pérez"
              {...register('contacto')}
            />
            {errors.contacto && <p className={errorCls}>{errors.contacto.message}</p>}
          </div>

          <div>
            <label className={labelCls}>Teléfono</label>
            <PhoneInputField
              control={control}
              name="telefono"
              placeholder="7777-8888"
            />
            {errors.telefono && <p className={errorCls}>{errors.telefono.message}</p>}
          </div>

          <div className="md:col-span-2">
            <label className={labelCls}>Correo electrónico</label>
            <input
              type="email"
              className={errors.email ? inputErr : inputOk}
              placeholder="ventas@proveedor.com"
              {...register('email')}
            />
            {errors.email && <p className={errorCls}>{errors.email.message}</p>}
          </div>
        </div>
      </FormSection>

      <FormSection title="Notas internas">
        <textarea
          rows={3}
          className={errors.notas ? inputErr : inputOk}
          placeholder="Condiciones comerciales, tiempos de entrega, observaciones (opcional)."
          {...register('notas')}
        />
        {errors.notas && <p className={errorCls}>{errors.notas.message}</p>}
      </FormSection>

      <div className="sticky bottom-0 left-0 right-0 -mx-4 px-4 py-3 bg-bg border-t border-bd flex justify-end gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-sm hover:bg-bg-sunken transition-colors"
          onClick={() => router.push(isEditar ? `/proveedores/${props.proveedor.id}` : '/proveedores')}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Icon name="check" size={14} /> {isEditar ? 'Guardar cambios' : 'Crear proveedor'}
        </button>
      </div>
    </form>
  );
}
