'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { MantenimientoFormFields } from '@/components/mantenimientos/MantenimientoFormFields';
import { useMantenimiento, useActualizarMantenimiento } from '@/hooks/use-mantenimientos';
import { useAuthStore } from '@/stores/auth.store';
import type { Control, UseFormRegister, FieldErrors } from 'react-hook-form';
import type { MantenimientoFormValues } from '@/components/mantenimientos/MantenimientoFormFields';

const schema = z.object({
  tecnico:              z.string().min(1, 'El técnico es requerido'),
  motivo:               z.string().min(1, 'El motivo es requerido'),
  horometro:            z.number().nonnegative().optional(),
  costoEstimado:        z.number().nonnegative().optional(),
  proximoMantenimiento: z.string().optional(),
  // categoria es display-only en edición; el backend no expone endpoint para cambiarla
  categoria:            z.enum(['INTERNO', 'EXTERNO', 'EN_CLIENTE']).optional(),
});

type FormValues = z.infer<typeof schema>;

export default function EditarMantenimientoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const { user } = useAuthStore();
  const { data: m, isLoading, isError } = useMantenimiento(id);
  const actualizar = useActualizarMantenimiento(id);

  const { control, register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tecnico: '',
      motivo:  '',
    },
  });

  // VISUALIZADOR no puede mutar datos; el backend lo rechazaria igual,
  // pero redirigimos aqui para no mostrar un formulario inutilizable.
  useEffect(() => {
    if (user && user.rol === 'VISUALIZADOR') {
      router.replace(`/mantenimientos/${id}`);
    }
  }, [user, router, id]);

  // Bloqueo de edicion sobre mantenimientos completados: el backend tambien lo
  // rechazaria, pero mostrarlo aqui evita un viaje innecesario al server.
  useEffect(() => {
    if (m && m.estado === 'COMPLETADO') {
      toast.error('No se puede editar un mantenimiento completado');
      router.replace(`/mantenimientos/${id}`);
    }
  }, [m, id, router]);

  useEffect(() => {
    if (!m) return;
    reset({
      tecnico:       m.tecnico,
      motivo:        m.motivo,
      horometro:     m.horometro     ? Number(m.horometro)     : undefined,
      costoEstimado: m.costoEstimado ? Number(m.costoEstimado) : undefined,
      categoria:     m.categoria,
      proximoMantenimiento: m.proximoMantenimiento
        // datetime-local espera "YYYY-MM-DDTHH:mm" sin segundos ni TZ.
        ? m.proximoMantenimiento.slice(0, 16)
        : '',
    });
  }, [m, reset]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }
  if (isError || !m) {
    return (
      <EmptyState
        icon="wrench"
        title="No se pudo cargar el mantenimiento"
        message="Vuelve a intentarlo o regresa al listado."
      />
    );
  }

  async function onSubmit(values: FormValues) {
    try {
      await actualizar.mutateAsync({
        tecnico:       values.tecnico,
        motivo:        values.motivo,
        horometro:     values.horometro,
        costoEstimado: values.costoEstimado,
        // El input datetime-local produce "YYYY-MM-DDTHH:mm" sin timezone.
        // Convertimos a ISO completo que es lo que valida z.string().datetime() en el backend.
        // null explicito para limpiar la fecha; undefined la deja como estaba.
        proximoMantenimiento: values.proximoMantenimiento
          ? new Date(values.proximoMantenimiento).toISOString()
          : null,
      });
      router.push(`/mantenimientos/${id}`);
    } catch {
      // El hook ya muestra el toast con el mensaje del backend.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Editar mantenimiento"
        back backLabel="Regresar"
        onBack={() => router.push(`/mantenimientos/${id}`)}
      />
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <MantenimientoFormFields
          control={control as unknown as Control<MantenimientoFormValues>}
          register={register as unknown as UseFormRegister<MantenimientoFormValues>}
          errors={errors as unknown as FieldErrors<MantenimientoFormValues>}
          mostrarTipo={false}
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => router.push(`/mantenimientos/${id}`)}
            className="px-4 py-2 text-sm rounded-md border border-bd hover:bg-bg-2"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={actualizar.isPending}
            className="px-4 py-2 text-sm rounded-md bg-accent text-bg hover:opacity-90 disabled:opacity-50"
          >
            {actualizar.isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
