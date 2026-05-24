'use client';

import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { Icon } from '@/components/ui/Icon';
import { UbicacionInput } from '@/components/ui/UbicacionInput';
import { EstadoProyectoSelector } from '@/components/proyectos/EstadoProyectoSelector';
import {
  proyectoCrearSchema,
  proyectoEditarSchema,
  type ProyectoCrearInput,
  type ProyectoEditarInput,
} from '@/lib/schemas/proyectos';
import { useCrearProyecto, useEditarProyecto, useCambiarEstadoProyecto } from '@/hooks/use-proyectos';
import type { Proyecto } from '@/types/api';

type ClienteContext = { id: string; nombre: string };

type Props =
  | { modo: 'crear'; cliente: ClienteContext; proyecto?: undefined }
  | { modo: 'editar'; cliente: ClienteContext; proyecto: Proyecto };

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-1';

export function ProyectoForm(props: Props) {
  const router = useRouter();
  const esCrear = props.modo === 'crear';
  const proyecto = esCrear ? undefined : props.proyecto;

  const crear = useCrearProyecto(props.cliente.id);
  const editar = useEditarProyecto();
  const cambiarEstado = useCambiarEstadoProyecto();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProyectoCrearInput | ProyectoEditarInput>({
    resolver: zodResolver(esCrear ? proyectoCrearSchema : proyectoEditarSchema) as never,
    defaultValues: {
      nombre: proyecto?.nombre ?? '',
      descripcion: proyecto?.descripcion ?? '',
      ubicacion: proyecto?.ubicacion ?? '',
    },
  });

  async function onSubmit(values: ProyectoCrearInput | ProyectoEditarInput) {
    const payload = {
      nombre: values.nombre.trim(),
      descripcion: values.descripcion?.trim() || undefined,
      ubicacion: values.ubicacion,
    };
    try {
      if (esCrear) {
        await crear.mutateAsync(payload);
      } else {
        await editar.mutateAsync({ id: proyecto!.id, data: payload });
        router.push(`/proyectos/${proyecto!.id}`);
      }
    } catch {
      // El hook maneja toast.error.
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 pb-24">
      <PageHeader
        title={esCrear ? 'Nuevo proyecto' : `Editar — ${proyecto!.nombre}`}
        subtitle={
          <>
            Cliente: <b className="text-tx">{props.cliente.nombre}</b>
            <span className="text-tx-3 mx-2">·</span>
            <span className="font-mono text-xs text-tx-3">{props.cliente.id}</span>
          </>
        }
        back
        backLabel={esCrear ? 'Cliente' : proyecto!.nombre}
        onBack={() =>
          esCrear
            ? router.push(`/clientes/${props.cliente.id}`)
            : router.push(`/proyectos/${proyecto!.id}`)
        }
      />

      <FormSection title="Información">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className={labelCls}>Nombre del proyecto *</label>
            <input
              className={errors.nombre ? inputErr : inputOk}
              placeholder="Pasarela peatonal Bvr. Constitución"
              {...register('nombre')}
            />
            {errors.nombre && <p className={errorCls}>{errors.nombre.message}</p>}
          </div>

          <div>
            <label className={labelCls}>Descripción</label>
            <textarea
              rows={3}
              className={errors.descripcion ? inputErr : inputOk}
              placeholder="Alcance y características generales de la obra."
              {...register('descripcion')}
            />
            {errors.descripcion && <p className={errorCls}>{errors.descripcion.message}</p>}
          </div>
        </div>
      </FormSection>

      <FormSection title="Ubicación de la obra">
        <Controller
          control={control}
          name="ubicacion"
          render={({ field }) => (
            <UbicacionInput
              value={field.value ?? ''}
              onChange={field.onChange}
              error={errors.ubicacion?.message as string | undefined}
            />
          )}
        />
      </FormSection>

      {!esCrear && proyecto && (
        <FormSection title="Estado">
          <EstadoProyectoSelector
            estadoActual={proyecto.estado}
            onChange={async (siguiente) => {
              await cambiarEstado.mutateAsync({ id: proyecto.id, estado: siguiente });
            }}
            disabled={cambiarEstado.isPending}
          />
        </FormSection>
      )}

      <div className="sticky bottom-0 left-0 right-0 -mx-4 px-4 py-3 bg-bg border-t border-bd flex justify-end gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-sm hover:bg-bg-sunken transition-colors"
          onClick={() => router.back()}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting || crear.isPending || editar.isPending}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Icon name="check" size={14} /> {esCrear ? 'Crear proyecto' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
