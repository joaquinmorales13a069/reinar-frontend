'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormSection } from '@/components/ui/FormSection';
import { MantenimientoAdjuntosCard } from '@/components/mantenimientos/MantenimientoAdjuntosCard';
import { useMantenimiento, useRegistrarSalida } from '@/hooks/use-mantenimientos';
import { useAuthStore } from '@/stores/auth.store';

const schema = z.object({
  costoReal:           z.number().nonnegative().optional(),
  observacionesSalida: z.string().optional(),
  repuestos:           z.array(z.object({ value: z.string().min(1) })),
});

type FormValues = z.infer<typeof schema>;

export default function SalidaMantenimientoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const id = params.id;

  const { data: m, isLoading, isError } = useMantenimiento(id);
  const salida = useRegistrarSalida(id);

  // Solo ADMIN, GERENTE y LOGISTICA pueden eliminar adjuntos (OPERADOR excluido por el backend).
  const puedeEliminarAdjunto =
    user?.rol === 'ADMIN' || user?.rol === 'GERENTE' || user?.rol === 'LOGISTICA';

  const { control, register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { repuestos: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'repuestos' });

  // VISUALIZADOR no puede registrar salidas; el backend tambien lo rechazaria
  // pero redirigimos antes para evitar mostrar un form que no podra enviar.
  useEffect(() => {
    if (user && user.rol === 'VISUALIZADOR') {
      router.replace(`/mantenimientos/${id}`);
    }
  }, [user, router, id]);

  // Si ya esta COMPLETADO, no se puede registrar salida de nuevo.
  useEffect(() => {
    if (m && m.estado === 'COMPLETADO') {
      toast.error('Este mantenimiento ya fue completado');
      router.replace(`/mantenimientos/${id}`);
    }
  }, [m, id, router]);

  useEffect(() => {
    if (!m) return;
    reset({
      costoReal: m.costoReal ? Number(m.costoReal) : undefined,
      repuestos: m.repuestos.map((value) => ({ value })),
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
      await salida.mutateAsync({
        costoReal:           values.costoReal,
        observacionesSalida: values.observacionesSalida || undefined,
        repuestos:           values.repuestos.map((r) => r.value),
      });
      router.push(`/mantenimientos/${id}`);
    } catch {
      // El hook ya muestra el toast con el mensaje del backend.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Registrar salida"
        subtitle="Cierra el mantenimiento y libera el equipo o unidad"
        back backLabel="Regresar"
        onBack={() => router.push(`/mantenimientos/${id}`)}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <FormSection title="Cierre">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-tx-3">Costo real (opcional)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register('costoReal', { valueAsNumber: true })}
                className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="text-xs text-tx-3">Observaciones (opcional)</label>
              <textarea
                rows={3}
                {...register('observacionesSalida')}
                className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="text-xs text-tx-3">Repuestos finales</label>
              <div className="mt-1 flex flex-col gap-2">
                {fields.map((f, idx) => (
                  <div key={f.id} className="flex gap-2">
                    <input
                      {...register(`repuestos.${idx}.value` as const)}
                      className="flex-1 px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="px-2 py-2 text-sm rounded-md border border-bd hover:bg-bg-2"
                      aria-label="Eliminar repuesto"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => append({ value: '' })}
                  className="self-start px-3 py-1.5 text-sm rounded-md border border-bd hover:bg-bg-2"
                >
                  Añadir repuesto
                </button>
              </div>
              {errors.repuestos && <p className="text-xs text-danger mt-1">Repuestos inválidos</p>}
            </div>
          </div>
        </FormSection>

        <MantenimientoAdjuntosCard
          mantenimientoId={m.id}
          adjuntos={m.adjuntos}
          readOnly={false}
          canDeleteAdjunto={puedeEliminarAdjunto}
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
            disabled={salida.isPending}
            className="px-4 py-2 text-sm rounded-md bg-accent text-bg hover:opacity-90 disabled:opacity-50"
          >
            {salida.isPending ? 'Registrando…' : 'Registrar salida'}
          </button>
        </div>
      </form>
    </div>
  );
}
