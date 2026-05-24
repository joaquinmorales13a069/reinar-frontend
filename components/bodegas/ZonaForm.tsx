'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { Icon } from '@/components/ui/Icon';
import {
  zonaCrearSchema,
  zonaEditarSchema,
  type ZonaCrearInput,
  type ZonaEditarInput,
} from '@/lib/schemas/bodegas';
import { useCrearZona, useEditarZona, useCambiarEstadoZona } from '@/hooks/use-bodegas';
import type { Bodega, BodegaZona } from '@/types/api';

type Props =
  | { modo: 'crear'; bodegaPadre: Pick<Bodega, 'id' | 'nombre'>; zona?: undefined }
  | { modo: 'editar'; bodegaPadre: Pick<Bodega, 'id' | 'nombre'>; zona: BodegaZona };

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-1';

export function ZonaForm(props: Props) {
  const router = useRouter();
  const crear = useCrearZona(props.bodegaPadre.id);
  const editar = useEditarZona(props.bodegaPadre.id);
  const cambiarEstado = useCambiarEstadoZona(props.bodegaPadre.id);
  const [confirmEstado, setConfirmEstado] = useState(false);

  const esCrear = props.modo === 'crear';
  const zona = esCrear ? undefined : props.zona;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ZonaCrearInput | ZonaEditarInput>({
    resolver: zodResolver(esCrear ? zonaCrearSchema : zonaEditarSchema) as never,
    defaultValues: {
      nombre: zona?.nombre ?? '',
      descripcion: zona?.descripcion ?? '',
    },
  });

  async function onSubmit(values: ZonaCrearInput | ZonaEditarInput) {
    const payload = {
      nombre: values.nombre.trim(),
      descripcion: values.descripcion?.trim() || undefined,
    };
    try {
      if (esCrear) {
        await crear.mutateAsync(payload);
      } else {
        await editar.mutateAsync({ zonaId: zona!.id, data: payload });
        router.push(`/bodegas/${props.bodegaPadre.id}`);
      }
    } catch {
      // El hook ya dispara toast.error; no relanzar para evitar errores no manejados en consola.
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 pb-24">
      <PageHeader
        title={esCrear ? 'Nueva zona' : `Editar zona — ${zona!.nombre}`}
        subtitle={
          <>
            Zona de <b className="text-tx">{props.bodegaPadre.nombre}</b>
          </>
        }
        back
        backLabel={props.bodegaPadre.nombre}
        onBack={() => router.push(`/bodegas/${props.bodegaPadre.id}`)}
      />

      {confirmEstado && zona && (
        <ConfirmRow
          message={
            zona.activa
              ? <>¿Desactivar la zona <b>{zona.nombre}</b>?</>
              : <>¿Activar la zona <b>{zona.nombre}</b>?</>
          }
          confirmLabel={zona.activa ? 'Desactivar' : 'Activar'}
          variant={zona.activa ? 'danger' : 'primary'}
          onCancel={() => setConfirmEstado(false)}
          onConfirm={async () => {
            await cambiarEstado.mutateAsync({ zonaId: zona.id, activa: !zona.activa });
            setConfirmEstado(false);
          }}
        />
      )}

      <FormSection title="Información">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className={labelCls}>Nombre *</label>
            <input
              className={errors.nombre ? inputErr : inputOk}
              placeholder="Zona A — Equipos pesados"
              {...register('nombre')}
            />
            {errors.nombre && <p className={errorCls}>{errors.nombre.message}</p>}
          </div>

          <div>
            <label className={labelCls}>Descripción</label>
            <textarea
              rows={3}
              className={errors.descripcion ? inputErr : inputOk}
              placeholder="Para qué se usa esta zona dentro de la bodega."
              {...register('descripcion')}
            />
            {errors.descripcion && <p className={errorCls}>{errors.descripcion.message}</p>}
          </div>
        </div>
      </FormSection>

      <div className="sticky bottom-0 left-0 right-0 -mx-4 px-4 py-3 bg-bg border-t border-bd flex justify-end gap-2">
        {!esCrear && (
          <button
            type="button"
            className={`mr-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-sm font-medium bg-surface hover:bg-bg-sunken transition-colors ${zona!.activa ? 'text-danger' : 'text-ok'}`}
            onClick={() => setConfirmEstado(true)}
          >
            <Icon name={zona!.activa ? 'x' : 'check'} size={14} />
            {zona!.activa ? 'Desactivar zona' : 'Activar zona'}
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
          <Icon name="check" size={14} /> {esCrear ? 'Crear zona' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
