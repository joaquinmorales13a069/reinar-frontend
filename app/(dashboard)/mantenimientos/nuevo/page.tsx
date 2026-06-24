'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import {
  MantenimientoFormFields,
} from '@/components/mantenimientos/MantenimientoFormFields';
import {
  MantenimientoEntidadSelector,
  type EntidadSeleccionada,
} from '@/components/mantenimientos/MantenimientoEntidadSelector';
import { useCrearMantenimiento } from '@/hooks/use-mantenimientos';
import { useAuthStore } from '@/stores/auth.store';
import type { Control, UseFormRegister, FieldErrors } from 'react-hook-form';
import type { MantenimientoFormValues } from '@/components/mantenimientos/MantenimientoFormFields';

// Schema base para derivar el tipo de FormValues — sin superRefine para que
// TypeScript pueda inferir el tipo limpiamente.
const baseSchema = z.object({
  tipo:                 z.enum(['PREVENTIVO', 'CORRECTIVO', 'EMERGENCIA']).optional(),
  categoriaId:          z.string().min(1, 'La categoría es requerida'),
  tecnico:              z.string().min(1, 'El técnico es requerido'),
  motivo:               z.string().min(1, 'El motivo es requerido'),
  horometro:            z.number().nonnegative().optional(),
  costoEstimado:        z.number().nonnegative(),
  proximoMantenimiento: z.string().optional(),
});

type FormValues = z.infer<typeof baseSchema>;

// El horometro es requerido solo cuando el mantenimiento es de un equipo;
// no podemos capturar esa condición en el schema estático porque depende del
// estado del selector de entidad (componente), no de los valores del form.
// Solución: factory que agrega superRefine con el booleano capturado en closure.
function crearSchema(esEquipo: boolean) {
  return baseSchema.superRefine((v, ctx) => {
    if (esEquipo && (v.horometro === undefined || Number.isNaN(v.horometro))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['horometro'], message: 'El horómetro es requerido para equipos' });
    }
  });
}

export default function NuevoMantenimientoPage() {
  // useSearchParams requiere Suspense para que Next.js pueda prerenderizar
  // estáticamente la página sin esperar a los query params del cliente.
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Spinner /></div>}>
      <NuevoMantenimientoPageInner />
    </Suspense>
  );
}

function NuevoMantenimientoPageInner() {
  const router = useRouter();
  const sp    = useSearchParams();
  const equipoIdParam      = sp.get('equipoId');
  const herramientaIdParam = sp.get('herramientaUnidadId');
  // Cuando llega por URL no permitimos cambiar la entidad para evitar
  // reasignaciones accidentales desde el flujo de detalle de equipo/unidad.
  const lockedDesdeQuery = Boolean(equipoIdParam || herramientaIdParam);

  const { user } = useAuthStore();
  // La entidad inicial se deriva de los URL params en el primer render.
  const [entidad, setEntidad] = useState<EntidadSeleccionada>(() => {
    if (equipoIdParam) {
      return { kind: 'equipo', equipoId: equipoIdParam, label: `Equipo (${equipoIdParam})` };
    }
    if (herramientaIdParam) {
      return {
        kind:                'unidad',
        herramientaUnidadId: herramientaIdParam,
        label:               `Unidad (${herramientaIdParam})`,
      };
    }
    return null;
  });
  const [entidadError, setEntidadError] = useState<string | undefined>();
  const crear = useCrearMantenimiento();

  const esEquipo = entidad?.kind === 'equipo';

  // Reconstruimos el schema cada vez que cambia el tipo de entidad seleccionada
  // para que la validación condicional del horómetro sea correcta.
  const schema = useMemo(() => crearSchema(esEquipo), [esEquipo]);

  // VISUALIZADOR no puede mutar datos; el backend lo rechazaria igual,
  // pero redirigimos aqui para no mostrar un formulario inutilizable.
  useEffect(() => {
    if (user && user.rol === 'VISUALIZADOR') {
      router.replace('/mantenimientos');
    }
  }, [user, router]);

  const { control, register, handleSubmit, formState: { errors }, setError, reset } =
    useForm<FormValues>({
      resolver: zodResolver(schema),
      defaultValues: {
        tipo:      'PREVENTIVO',
        tecnico:   '',
        motivo:    '',
      },
    });

  // Cuando cambia el tipo de entidad, reseteamos el resolver con el nuevo schema
  // (react-hook-form mantiene el resolver en cierre; reset con la misma data y
  // el nuevo resolver hace que las validaciones condicionales funcionen).
  useEffect(() => {
    reset(undefined, { keepValues: true });
  }, [esEquipo, reset]);

  async function onSubmit(values: FormValues) {
    if (!entidad) {
      setEntidadError('Selecciona un equipo o unidad');
      return;
    }
    setEntidadError(undefined);
    try {
      const m = await crear.mutateAsync({
        tipo:                values.tipo ?? 'PREVENTIVO',
        categoriaId:         values.categoriaId,
        tecnico:             values.tecnico,
        motivo:              values.motivo,
        horometro:           values.horometro,
        costoEstimado:       values.costoEstimado,
        // El input datetime-local produce "YYYY-MM-DDTHH:mm" sin timezone.
        // Convertimos a ISO completo que es lo que valida z.string().datetime() en el backend.
        proximoMantenimiento: values.proximoMantenimiento
          ? new Date(values.proximoMantenimiento).toISOString()
          : undefined,
        equipoId:            entidad.kind === 'equipo' ? entidad.equipoId : undefined,
        herramientaUnidadId: entidad.kind === 'unidad' ? entidad.herramientaUnidadId : undefined,
      });
      router.push(`/mantenimientos/${m.id}`);
    } catch (err) {
      // El hook ya dispara toast.error para errores generales; aquí solo
      // manejamos los códigos específicos que requieren feedback inline.
      const anyErr = err as { response?: { data?: { error?: { code?: string; message?: string } } } };
      const code   = anyErr?.response?.data?.error?.code;
      const msg    = anyErr?.response?.data?.error?.message;
      if (code === 'ESTADO_INVALIDO' && msg) {
        // El equipo/unidad no está disponible — mostramos el motivo junto al selector.
        setEntidadError(msg);
      } else if (code === 'VALIDATION_ERROR' && msg) {
        setError('motivo', { message: msg });
      }
    }
  }

  const submitting = crear.isPending;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Nuevo mantenimiento"
        back
        backLabel="Regresar"
        onBack={() => router.back()}
      />
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <div className="rounded-lg border border-bd bg-surface p-4">
          <h2 className="text-sm font-semibold mb-3">Equipo o unidad</h2>
          <MantenimientoEntidadSelector
            value={entidad}
            onChange={setEntidad}
            locked={lockedDesdeQuery}
            error={entidadError}
          />
        </div>

        <MantenimientoFormFields
          control={control as unknown as Control<MantenimientoFormValues>}
          register={register as unknown as UseFormRegister<MantenimientoFormValues>}
          errors={errors as unknown as FieldErrors<MantenimientoFormValues>}
          mostrarTipo
          esEquipo={esEquipo}
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm rounded-md border border-bd hover:bg-bg-2"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-md bg-accent text-bg hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Creando…' : 'Crear mantenimiento'}
          </button>
        </div>
      </form>
    </div>
  );
}
