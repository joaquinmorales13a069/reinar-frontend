'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import Decimal from 'decimal.js';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormSection } from '@/components/ui/FormSection';
import { BodegaSelect } from '@/components/ui/BodegaSelect';
import { MantenimientoAdjuntosCard } from '@/components/mantenimientos/MantenimientoAdjuntosCard';
import { useMantenimiento, useRegistrarSalida } from '@/hooks/use-mantenimientos';
import { useConsumibles } from '@/hooks/use-consumibles';
import { useProveedores } from '@/hooks/use-proveedores';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, fechaSVToIso } from '@/lib/utils';

const repuestoSchema = z.discriminatedUnion('modo', [
  z.object({
    modo:         z.literal('interno'),
    consumibleId: z.string().min(1, 'Selecciona un consumible'),
    bodegaId:     z.string().min(1, 'Selecciona una bodega'),
    cantidad:     z.number().int().positive('Debe ser positivo'),
  }),
  z.object({
    modo:        z.literal('externo'),
    descripcion: z.string().min(1, 'La descripción es requerida'),
    proveedorId: z.string().optional(),
    costoCompra: z.number().nonnegative().optional(),
    fechaCompra: z.string().optional(),
    cantidad:    z.number().int().positive('Debe ser positivo'),
  }),
]);

const schema = z.object({
  costoReal:           z.number().nonnegative().optional(),
  diagnostico:         z.string().max(2000).optional(),
  trabajoRealizado:    z.string().max(2000).optional(),
  observaciones:       z.string().max(2000).optional(),
  observacionesSalida: z.string().optional(),
  repuestos:           z.array(repuestoSchema),
});

type RepuestoForm = z.infer<typeof repuestoSchema>;
type FormValues = z.infer<typeof schema>;

export default function SalidaMantenimientoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const id = params.id;

  const { data: m, isLoading, isError } = useMantenimiento(id);
  const salida = useRegistrarSalida(id);
  const { data: consumiblesData } = useConsumibles({ limit: 500, activo: true });
  const { data: proveedoresData } = useProveedores({ limit: 200, activo: true });

  const consumibles = (consumiblesData?.data ?? []) as { id: string; codigo: string; nombre: string }[];
  const proveedores = (proveedoresData?.data ?? []) as { id: string; nombre: string }[];

  // Solo ADMIN, GERENTE y LOGISTICA pueden eliminar adjuntos (OPERADOR excluido por el backend).
  const puedeEliminarAdjunto =
    user?.rol === 'ADMIN' || user?.rol === 'GERENTE' || user?.rol === 'LOGISTICA';

  const { control, register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { repuestos: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'repuestos' });

  const [repuestosError, setRepuestosError] = useState<string | undefined>();

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
      repuestos: [],
    });
  }, [m, reset]);

  // Calcular costo total de repuestos externos con decimal.js
  const repuestosWatch = watch('repuestos');
  const costoExterno = (repuestosWatch ?? []).reduce((acc, r) => {
    if (r.modo === 'externo' && r.costoCompra) {
      return acc.plus(new Decimal(r.costoCompra).times(r.cantidad));
    }
    return acc;
  }, new Decimal(0));

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
    setRepuestosError(undefined);
    try {
      const repuestosPayload = (values.repuestos ?? []).map((r) => {
        if (r.modo === 'interno') {
          return { consumibleId: r.consumibleId, bodegaId: r.bodegaId, cantidad: r.cantidad };
        }
        return {
          descripcion: r.descripcion,
          proveedorId: r.proveedorId || undefined,
          costoCompra: r.costoCompra,
          // fechaCompra es una fecha calendario (input type="date"), no un
          // instante — fechaSVToIso ancla a medianoche El Salvador para que
          // formatDate() (si algun dia se muestra) no la corra un dia atras.
          fechaCompra: r.fechaCompra ? fechaSVToIso(r.fechaCompra) : undefined,
          cantidad:    r.cantidad,
        };
      });

      await salida.mutateAsync({
        costoReal:           values.costoReal,
        observacionesSalida: values.observacionesSalida || undefined,
        diagnostico:         values.diagnostico || undefined,
        trabajoRealizado:    values.trabajoRealizado || undefined,
        observaciones:       values.observaciones || undefined,
        repuestos:           repuestosPayload,
      });
      router.push(`/mantenimientos/${id}`);
    } catch (err) {
      // El hook ya dispara toast.error; si es 422 de stock insuficiente mostramos
      // el mensaje también inline junto a la sección de repuestos.
      const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = anyErr?.response?.data?.error?.message;
      if (msg) setRepuestosError(msg);
    }
  }

  function agregarRepuesto() {
    append({ modo: 'interno', consumibleId: '', bodegaId: '', cantidad: 1 } as RepuestoForm);
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
              <label className="text-xs text-tx-3">Diagnóstico (opcional)</label>
              <textarea
                rows={3}
                {...register('diagnostico')}
                className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="text-xs text-tx-3">Trabajo realizado (opcional)</label>
              <textarea
                rows={3}
                {...register('trabajoRealizado')}
                className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="text-xs text-tx-3">Observaciones (opcional)</label>
              <textarea
                rows={3}
                {...register('observaciones')}
                className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="text-xs text-tx-3">Observaciones de salida (opcional)</label>
              <textarea
                rows={3}
                {...register('observacionesSalida')}
                className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </FormSection>

        <FormSection title="Repuestos utilizados">
          <div className="flex flex-col gap-4">
            {repuestosError && (
              <p className="text-sm text-danger bg-danger/10 rounded-md px-3 py-2">{repuestosError}</p>
            )}

            {fields.length === 0 && (
              <p className="text-sm text-tx-3">Sin repuestos agregados.</p>
            )}

            {fields.map((field, idx) => {
              const modo = repuestosWatch?.[idx]?.modo ?? 'interno';
              const repErr = errors.repuestos?.[idx];

              return (
                <div key={field.id} className="rounded-md border border-bd p-3 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Controller
                      control={control}
                      name={`repuestos.${idx}.modo` as const}
                      render={({ field: f }) => (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => f.onChange('interno')}
                            className={`px-3 py-1 text-xs rounded-md border ${f.value === 'interno' ? 'bg-accent text-bg border-accent' : 'border-bd hover:bg-bg-2'}`}
                          >
                            Interno
                          </button>
                          <button
                            type="button"
                            onClick={() => f.onChange('externo')}
                            className={`px-3 py-1 text-xs rounded-md border ${f.value === 'externo' ? 'bg-accent text-bg border-accent' : 'border-bd hover:bg-bg-2'}`}
                          >
                            Externo
                          </button>
                        </div>
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="px-2 py-1 text-sm rounded-md border border-bd hover:bg-bg-2"
                      aria-label="Eliminar repuesto"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {modo === 'interno' ? (
                      <>
                        <div>
                          <label className="text-xs text-tx-3">Consumible</label>
                          <select
                            {...register(`repuestos.${idx}.consumibleId` as const)}
                            className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
                          >
                            <option value="">Seleccionar consumible…</option>
                            {consumibles.map((c) => (
                              <option key={c.id} value={c.id}>{c.nombre} ({c.codigo})</option>
                            ))}
                          </select>
                          {(repErr as { consumibleId?: { message?: string } } | undefined)?.consumibleId && (
                            <p className="text-xs text-danger mt-1">{(repErr as { consumibleId?: { message?: string } }).consumibleId?.message}</p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs text-tx-3">Bodega</label>
                          <Controller
                            control={control}
                            name={`repuestos.${idx}.bodegaId` as const}
                            render={({ field: f }) => (
                              <div className="mt-1">
                                <BodegaSelect
                                  value={f.value ?? ''}
                                  onChange={f.onChange}
                                  error={!!(repErr as { bodegaId?: unknown } | undefined)?.bodegaId}
                                />
                              </div>
                            )}
                          />
                          {(repErr as { bodegaId?: { message?: string } } | undefined)?.bodegaId && (
                            <p className="text-xs text-danger mt-1">{(repErr as { bodegaId?: { message?: string } }).bodegaId?.message}</p>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="lg:col-span-2">
                          <label className="text-xs text-tx-3">Descripción</label>
                          <input
                            {...register(`repuestos.${idx}.descripcion` as const)}
                            className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
                            placeholder="Ej. Filtro de aceite marca X"
                          />
                          {(repErr as { descripcion?: { message?: string } } | undefined)?.descripcion && (
                            <p className="text-xs text-danger mt-1">{(repErr as { descripcion?: { message?: string } }).descripcion?.message}</p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs text-tx-3">Proveedor (opcional)</label>
                          <select
                            {...register(`repuestos.${idx}.proveedorId` as const)}
                            className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
                          >
                            <option value="">Sin proveedor</option>
                            {proveedores.map((p) => (
                              <option key={p.id} value={p.id}>{p.nombre}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-tx-3">Costo de compra (opcional)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            {...register(`repuestos.${idx}.costoCompra` as const, { valueAsNumber: true })}
                            className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-tx-3">Fecha de compra (opcional)</label>
                          <input
                            type="date"
                            {...register(`repuestos.${idx}.fechaCompra` as const)}
                            className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
                          />
                        </div>
                      </>
                    )}
                    <div>
                      <label className="text-xs text-tx-3">Cantidad</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        {...register(`repuestos.${idx}.cantidad` as const, { valueAsNumber: true })}
                        className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
                      />
                      {(repErr as { cantidad?: { message?: string } } | undefined)?.cantidad && (
                        <p className="text-xs text-danger mt-1">{(repErr as { cantidad?: { message?: string } }).cantidad?.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={agregarRepuesto}
                className="self-start px-3 py-1.5 text-sm rounded-md border border-bd hover:bg-bg-2"
              >
                Agregar repuesto
              </button>
              {costoExterno.greaterThan(0) && (
                <p className="text-sm text-tx-3">
                  Costo de repuestos externos: <span className="font-semibold text-tx">{formatCurrency(costoExterno.toString())}</span>
                </p>
              )}
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
