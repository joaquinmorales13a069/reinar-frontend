'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  MantenimientoFormFields,
} from '@/components/mantenimientos/MantenimientoFormFields';
import {
  MantenimientoEntidadSelector,
  type EntidadSeleccionada,
} from '@/components/mantenimientos/MantenimientoEntidadSelector';
import { useCrearMantenimiento } from '@/hooks/use-mantenimientos';
import type { Control, UseFormRegister, FieldErrors } from 'react-hook-form';
import type { MantenimientoFormValues } from '@/components/mantenimientos/MantenimientoFormFields';

// Espejo del tipo MantenimientoFormValues pero como z.object para que
// zodResolver reciba el schema nativo sin annotación de tipo — patrón
// estándar del proyecto (ver login, actas, etc.).
const schema = z.object({
  tipo:                 z.enum(['PREVENTIVO', 'CORRECTIVO', 'EMERGENCIA']).optional(),
  tecnico:              z.string().min(1, 'El técnico es requerido'),
  motivo:               z.string().min(1, 'El motivo es requerido'),
  horometro:            z.number().nonnegative().optional(),
  costoEstimado:        z.number().nonnegative().optional(),
  repuestos:            z.array(z.object({ value: z.string().min(1) })),
  proximoMantenimiento: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NuevoMantenimientoPage() {
  const router = useRouter();
  const sp    = useSearchParams();
  const equipoIdParam      = sp.get('equipoId');
  const herramientaIdParam = sp.get('herramientaUnidadId');
  // Cuando llega por URL no permitimos cambiar la entidad para evitar
  // reasignaciones accidentales desde el flujo de detalle de equipo/unidad.
  const lockedDesdeQuery = Boolean(equipoIdParam || herramientaIdParam);

  const [entidad, setEntidad] = useState<EntidadSeleccionada>(null);
  const [entidadError, setEntidadError] = useState<string | undefined>();
  const crear = useCrearMantenimiento();

  useEffect(() => {
    if (equipoIdParam) {
      setEntidad({ kind: 'equipo', equipoId: equipoIdParam, label: `Equipo (${equipoIdParam})` });
    } else if (herramientaIdParam) {
      setEntidad({
        kind:               'unidad',
        herramientaUnidadId: herramientaIdParam,
        label:              `Unidad (${herramientaIdParam})`,
      });
    }
  }, [equipoIdParam, herramientaIdParam]);

  const { control, register, handleSubmit, formState: { errors }, setError } =
    useForm<FormValues>({
      resolver: zodResolver(schema),
      defaultValues: {
        tipo:      'PREVENTIVO',
        tecnico:   '',
        motivo:    '',
        repuestos: [],
      },
    });

  async function onSubmit(values: FormValues) {
    if (!entidad) {
      setEntidadError('Selecciona un equipo o unidad');
      return;
    }
    setEntidadError(undefined);
    try {
      const m = await crear.mutateAsync({
        // tipo siempre está definido: defaultValue='PREVENTIVO' y mostrarTipo=true
        tipo:                values.tipo ?? 'PREVENTIVO',
        tecnico:             values.tecnico,
        motivo:              values.motivo,
        horometro:           values.horometro,
        costoEstimado:       values.costoEstimado,
        repuestos:           values.repuestos.map((r) => r.value),
        proximoMantenimiento: values.proximoMantenimiento || undefined,
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
