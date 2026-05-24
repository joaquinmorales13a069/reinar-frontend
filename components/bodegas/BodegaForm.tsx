'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { Icon } from '@/components/ui/Icon';
import { UbicacionInput, getDistritoLabel } from '@/components/ui/UbicacionInput';
import {
  bodegaCrearSchema,
  bodegaEditarSchema,
  type BodegaCrearInput,
  type BodegaEditarInput,
} from '@/lib/schemas/bodegas';
import { useCrearBodega, useEditarBodega, useCambiarEstadoBodega } from '@/hooks/use-bodegas';
import type { Bodega } from '@/types/api';

type Props =
  | { modo: 'crear'; bodega?: undefined }
  | { modo: 'editar'; bodega: Bodega };

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-1';

export function BodegaForm(props: Props) {
  const router = useRouter();
  const crear = useCrearBodega();
  const editar = useEditarBodega();
  const cambiarEstado = useCambiarEstadoBodega();
  const [confirmDesact, setConfirmDesact] = useState(false);

  const esCrear = props.modo === 'crear';
  const bodega = esCrear ? undefined : props.bodega;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<BodegaCrearInput | BodegaEditarInput>({
    resolver: zodResolver(esCrear ? bodegaCrearSchema : bodegaEditarSchema) as never,
    defaultValues: {
      nombre: bodega?.nombre ?? '',
      descripcion: bodega?.descripcion ?? '',
      direccion: bodega?.direccion ?? '',
      // ciudad se deriva del UbicacionInput en submit — un campo "oculto" del
      // schema; lo inicializamos con el valor existente para evitar perder el
      // dato si el usuario no toca el UbicacionInput.
      ciudad: bodega?.ciudad ?? '',
    },
  });

  async function onSubmit(values: BodegaCrearInput | BodegaEditarInput) {
    // ciudad se deriva del distrito seleccionado dentro del UbicacionInput
    // (decisión D4 del spec). Si el parser del UbicacionInput cayó al fallback
    // y no pudo extraer el distrito, conservamos el valor previo de la bodega.
    const ciudadDerivada = getDistritoLabel(values.direccion) ?? values.ciudad ?? '';

    if (!ciudadDerivada) {
      // En la práctica el schema Zod garantiza direccion no vacía y al estar
      // en formato compuesto siempre habrá distrito; este check es defensivo.
      return;
    }

    const payload = {
      nombre: values.nombre.trim(),
      descripcion: values.descripcion?.trim() || undefined,
      direccion: values.direccion,
      ciudad: ciudadDerivada,
    };

    try {
      if (esCrear) {
        await crear.mutateAsync(payload);
      } else {
        await editar.mutateAsync({ id: bodega!.id, data: payload });
        router.push(`/bodegas/${bodega!.id}`);
      }
    } catch {
      // El hook maneja el toast.error.
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 pb-24">
      <PageHeader
        title={esCrear ? 'Nueva bodega' : `Editar — ${bodega!.nombre}`}
        subtitle={
          esCrear
            ? 'Registra una bodega principal. Las zonas se crean luego desde el detalle.'
            : 'Modifica los datos de la bodega principal.'
        }
        back
        backLabel={esCrear ? 'Bodegas' : bodega!.nombre}
        onBack={() => router.push(esCrear ? '/bodegas' : `/bodegas/${bodega!.id}`)}
      />

      {confirmDesact && (
        <ConfirmRow
          message={
            <>
              ¿Desactivar la bodega <b>{bodega!.nombre}</b>? Si tiene zonas activas o actas
              en vuelo, el backend bloqueará la acción.
            </>
          }
          confirmLabel="Desactivar"
          variant="danger"
          onCancel={() => setConfirmDesact(false)}
          onConfirm={async () => {
            await cambiarEstado.mutateAsync({ id: bodega!.id, activa: false });
            setConfirmDesact(false);
          }}
        />
      )}

      <FormSection title="Información">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelCls}>Nombre *</label>
            <input
              className={errors.nombre ? inputErr : inputOk}
              placeholder="Bodega Central San Salvador"
              {...register('nombre')}
            />
            {errors.nombre && <p className={errorCls}>{errors.nombre.message}</p>}
          </div>

          <div className="md:col-span-2">
            <label className={labelCls}>Descripción</label>
            <textarea
              rows={3}
              className={errors.descripcion ? inputErr : inputOk}
              placeholder="Notas operativas, capacidad, uso…"
              {...register('descripcion')}
            />
            {errors.descripcion && <p className={errorCls}>{errors.descripcion.message}</p>}
          </div>
        </div>
      </FormSection>

      <FormSection title="Dirección">
        <Controller
          control={control}
          name="direccion"
          render={({ field }) => (
            <UbicacionInput
              value={field.value ?? ''}
              onChange={field.onChange}
              error={errors.direccion?.message as string | undefined}
            />
          )}
        />
      </FormSection>

      <div className="sticky bottom-0 left-0 right-0 -mx-4 px-4 py-3 bg-bg border-t border-bd flex justify-end gap-2">
        {!esCrear && bodega!.activa && (
          <button
            type="button"
            className="mr-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-danger bg-surface text-sm font-medium hover:bg-bg-sunken transition-colors"
            onClick={() => setConfirmDesact(true)}
          >
            <Icon name="x" size={14} /> Desactivar bodega
          </button>
        )}
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
          <Icon name="check" size={14} /> {esCrear ? 'Crear bodega' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
