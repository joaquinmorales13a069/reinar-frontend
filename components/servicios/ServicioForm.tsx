'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { Icon } from '@/components/ui/Icon';
import {
  servicioCrearSchema,
  servicioEditarSchema,
  type ServicioCrearInput,
  type ServicioEditarInput,
} from '@/lib/schemas/servicios';
import { useCrearServicio, useEditarServicio } from '@/hooks/use-servicios';
import { trySetFieldErrorFromApi } from '@/lib/api-errors';
import type { Servicio } from '@/types/api';

type Props =
  | { modo: 'crear'; servicio?: undefined }
  | { modo: 'editar'; servicio: Servicio };

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const inputDisabled = `${inputBase} border-bd opacity-70 cursor-not-allowed`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-1';
const hintCls = 'text-xs text-tx-3 mt-1';

export function ServicioForm(props: Props) {
  const router = useRouter();
  const crear = useCrearServicio();
  const editar = useEditarServicio();

  if (props.modo === 'crear') {
    return <ServicioFormCrear router={router} crear={crear} />;
  }
  return <ServicioFormEditar servicio={props.servicio} router={router} editar={editar} />;
}

function ServicioFormCrear({
  router,
  crear,
}: {
  router: ReturnType<typeof useRouter>;
  crear: ReturnType<typeof useCrearServicio>;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ServicioCrearInput>({
    resolver: zodResolver(servicioCrearSchema) as never,
    defaultValues: {
      nombre: '',
      descripcion: '',
      tarifaBase: undefined as unknown as number,
      unidad: '',
      notas: '',
    },
  });

  async function onSubmit(values: ServicioCrearInput) {
    try {
      await crear.mutateAsync({
        nombre: values.nombre.trim(),
        descripcion: values.descripcion?.trim() || undefined,
        tarifaBase: values.tarifaBase,
        unidad: values.unidad.trim(),
        notas: values.notas?.trim() || undefined,
      });
    } catch (err) {
      // Si el backend reporta conflicto por nombre, lo mostramos inline.
      trySetFieldErrorFromApi(err, setError, 'nombre');
    }
  }

  return (
    <Layout
      title="Nuevo servicio"
      subtitle="Registra un servicio cotizable."
      onBack={() => router.push('/servicios')}
      submitLabel="Crear servicio"
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting || crear.isPending}
    >
      <CamposPrincipales register={register} errors={errors} codigo={null} />
      <CamposNotas register={register} errors={errors} />
    </Layout>
  );
}

function ServicioFormEditar({
  servicio,
  router,
  editar,
}: {
  servicio: Servicio;
  router: ReturnType<typeof useRouter>;
  editar: ReturnType<typeof useEditarServicio>;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ServicioEditarInput>({
    resolver: zodResolver(servicioEditarSchema) as never,
    defaultValues: {
      nombre: servicio.nombre,
      descripcion: servicio.descripcion ?? '',
      tarifaBase: Number(servicio.tarifaBase),
      unidad: servicio.unidad,
      notas: servicio.notas ?? '',
    },
  });

  async function onSubmit(values: ServicioEditarInput) {
    try {
      await editar.mutateAsync({
        id: servicio.id,
        data: {
          nombre: values.nombre.trim(),
          descripcion: values.descripcion?.trim() || undefined,
          tarifaBase: values.tarifaBase,
          unidad: values.unidad.trim(),
          notas: values.notas?.trim() || undefined,
        },
      });
      router.push(`/servicios/${servicio.id}`);
    } catch (err) {
      trySetFieldErrorFromApi(err, setError, 'nombre');
    }
  }

  return (
    <Layout
      title={`Editar — ${servicio.nombre}`}
      subtitle="Modifica los datos del servicio."
      onBack={() => router.push(`/servicios/${servicio.id}`)}
      submitLabel="Guardar cambios"
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting || editar.isPending}
    >
      <CamposPrincipales register={register} errors={errors} codigo={servicio.codigo} />
      <CamposNotas register={register} errors={errors} />
    </Layout>
  );
}

function Layout({
  title,
  subtitle,
  onBack,
  submitLabel,
  onSubmit,
  isSubmitting,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  submitLabel: string;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  children: React.ReactNode;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 pb-24">
      <PageHeader title={title} subtitle={subtitle} back onBack={onBack} />
      {children}
      <div className="sticky bottom-0 left-0 right-0 -mx-4 px-4 py-3 bg-bg border-t border-bd flex justify-end gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-sm hover:bg-bg-sunken transition-colors"
          onClick={onBack}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Icon name="check" size={14} /> {submitLabel}
        </button>
      </div>
    </form>
  );
}

function CamposPrincipales({
  register,
  errors,
  codigo,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: any;
  // null = modo crear; el backend asigna el código y por eso no se muestra el campo.
  codigo: string | null;
}) {
  return (
    <FormSection title="Información">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {codigo !== null && (
          <div>
            <label className={labelCls}>Código</label>
            <input
              type="text"
              readOnly
              disabled
              value={codigo}
              className={`${inputDisabled} font-mono`}
            />
            <p className={hintCls}>El código se asigna automáticamente y no es editable.</p>
          </div>
        )}

        <div>
          <label className={labelCls}>Unidad *</label>
          <input
            className={errors.unidad ? inputErr : inputOk}
            placeholder="hora, día, m², proyecto…"
            {...register('unidad')}
          />
          {errors.unidad && <p className={errorCls}>{errors.unidad.message}</p>}
        </div>

        <div className="md:col-span-2">
          <label className={labelCls}>Nombre *</label>
          <input
            className={errors.nombre ? inputErr : inputOk}
            placeholder="Sandblasting de superficies metálicas"
            {...register('nombre')}
          />
          {errors.nombre && <p className={errorCls}>{errors.nombre.message}</p>}
        </div>

        <div>
          <label className={labelCls}>Tarifa base (USD) *</label>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            className={`${errors.tarifaBase ? inputErr : inputOk} font-mono`}
            {...register('tarifaBase')}
          />
          {errors.tarifaBase && <p className={errorCls}>{errors.tarifaBase.message}</p>}
          <p className={hintCls}>Precio unitario por unidad seleccionada.</p>
        </div>

        <div className="md:col-span-2">
          <label className={labelCls}>Descripción</label>
          <textarea
            rows={3}
            className={errors.descripcion ? inputErr : inputOk}
            placeholder="Detalle del servicio, alcance, exclusiones…"
            {...register('descripcion')}
          />
          {errors.descripcion && <p className={errorCls}>{errors.descripcion.message}</p>}
        </div>
      </div>
    </FormSection>
  );
}

function CamposNotas({
  register,
  errors,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: any;
}) {
  return (
    <FormSection title="Notas internas">
      <textarea
        rows={3}
        className={errors.notas ? inputErr : inputOk}
        placeholder="Información operativa para el equipo (opcional)."
        {...register('notas')}
      />
      {errors.notas && <p className={errorCls}>{errors.notas.message}</p>}
    </FormSection>
  );
}
