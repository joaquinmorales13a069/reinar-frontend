'use client';

import Decimal from 'decimal.js';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { cuerpoFormSchema, type CuerpoFormInput } from '@/lib/schemas/andamios';
import { useCrearCuerpo, useEditarCuerpo, usePiezas } from '@/hooks/use-andamios';
import { trySetFieldErrorFromApi } from '@/lib/api-errors';
import { formatCurrency } from '@/lib/utils';
import type { CuerpoTipo } from '@/types/api';

type Props =
  | { modo: 'crear'; cuerpo?: undefined }
  | { modo: 'editar'; cuerpo: CuerpoTipo };

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk  = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-1';

export function CuerpoForm(props: Props) {
  const router = useRouter();
  const crear = useCrearCuerpo();
  const editar = useEditarCuerpo();
  // Solo necesitamos piezas activas para el select del BOM.
  const { data: piezas, isLoading: piezasLoading } = usePiezas();

  const defaults: CuerpoFormInput =
    props.modo === 'editar'
      ? {
          nombre: props.cuerpo.nombre,
          descripcion: props.cuerpo.descripcion ?? '',
          componentes: props.cuerpo.componentes.map((c) => ({
            piezaTipoId: c.piezaTipo.id,
            cantidad: c.cantidad,
          })),
        }
      : { nombre: '', descripcion: '', componentes: [] };

  const {
    register,
    handleSubmit,
    control,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CuerpoFormInput>({
    resolver: zodResolver(cuerpoFormSchema) as never,
    defaultValues: defaults,
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'componentes' });
  const componentes = watch('componentes');

  // Total diario aproximado: suma de tarifaDia * cantidad. Solo informativo.
  const totalDiario = (componentes ?? []).reduce((sum, c) => {
    const p = piezas?.find((x) => x.id === c.piezaTipoId);
    if (!p || !c.cantidad) return sum;
    return sum + new Decimal(p.tarifaDia).times(c.cantidad).toNumber();
  }, 0);

  async function onSubmit(values: CuerpoFormInput) {
    const payload = {
      nombre: values.nombre.trim(),
      descripcion: values.descripcion?.trim() || undefined,
      componentes: values.componentes.map((c) => ({
        piezaTipoId: c.piezaTipoId,
        cantidad: c.cantidad,
      })),
    };
    try {
      if (props.modo === 'crear') {
        await crear.mutateAsync(payload);
      } else {
        await editar.mutateAsync({ id: props.cuerpo.id, data: payload });
        router.push(`/andamios/cuerpos/${props.cuerpo.id}`);
      }
    } catch (err) {
      // Conflictos de unicidad por nombre se muestran inline; el toast del hook queda como fallback.
      trySetFieldErrorFromApi(err, setError, 'nombre');
    }
  }

  const onBack =
    props.modo === 'editar'
      ? () => router.push(`/andamios/cuerpos/${props.cuerpo.id}`)
      : () => router.push('/andamios');

  const title = props.modo === 'editar' ? 'Editar configuración' : 'Nueva configuración';
  const submitLabel = props.modo === 'editar' ? 'Guardar cambios' : 'Guardar configuración';
  const backLabel =
    props.modo === 'editar' ? `Configuración ${props.cuerpo.nombre}` : 'Andamios';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 pb-24">
      <PageHeader title={title} back backLabel={backLabel} onBack={onBack} />

      <FormSection title="Información">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelCls}>Nombre *</label>
            <input
              className={errors.nombre ? inputErr : inputOk}
              placeholder="Cuerpo estándar 2m"
              {...register('nombre')}
            />
            {errors.nombre && <p className={errorCls}>{errors.nombre.message}</p>}
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Descripción</label>
            <textarea
              rows={2}
              className={errors.descripcion ? inputErr : inputOk}
              {...register('descripcion')}
            />
            {errors.descripcion && <p className={errorCls}>{errors.descripcion.message}</p>}
          </div>
        </div>
      </FormSection>

      {/* FormSection no admite prop "action", por eso el botón "Agregar pieza"
          va adentro del contenido, encima de la tabla. */}
      <FormSection title={`Componentes (${fields.length})`}>
        <div className="flex justify-end mb-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors"
            onClick={() => append({ piezaTipoId: '', cantidad: 1 })}
            disabled={piezasLoading}
          >
            <Icon name="plus" size={12} /> Agregar pieza
          </button>
        </div>

        {piezasLoading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : fields.length === 0 ? (
          <p className="text-sm text-tx-3 m-0">
            Agregá al menos una pieza para completar la configuración.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border border-bd">
              <table className="w-full text-sm">
                <thead className="bg-bg-sunken text-xs text-tx-2 uppercase">
                  <tr>
                    <th className="text-left px-3 py-2">Pieza</th>
                    <th className="text-left px-3 py-2 w-32">Cantidad</th>
                    <th className="text-right px-3 py-2 w-32">Subtotal/día</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, i) => {
                    const compErr = errors.componentes?.[i];
                    const piezaId = componentes?.[i]?.piezaTipoId;
                    const cant = componentes?.[i]?.cantidad ?? 0;
                    const pieza = piezas?.find((p) => p.id === piezaId);
                    const subtotal = pieza
                      ? new Decimal(pieza.tarifaDia).times(cant).toNumber()
                      : null;
                    return (
                      <tr key={field.id} className="border-t border-bd">
                        <td className="px-3 py-2">
                          <select
                            className={compErr?.piezaTipoId ? inputErr : inputOk}
                            {...register(`componentes.${i}.piezaTipoId` as const)}
                          >
                            <option value="">— seleccionar —</option>
                            {(piezas ?? [])
                              .filter((p) => p.activo)
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.nombre}
                                </option>
                              ))}
                          </select>
                          {compErr?.piezaTipoId && (
                            <p className={errorCls}>{compErr.piezaTipoId.message}</p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            className={`${compErr?.cantidad ? inputErr : inputOk} font-mono`}
                            {...register(`componentes.${i}.cantidad` as const)}
                          />
                          {compErr?.cantidad && (
                            <p className={errorCls}>{compErr.cantidad.message}</p>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {subtotal !== null ? formatCurrency(subtotal) : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => remove(i)}
                            className="text-tx-3 hover:text-danger"
                            title="Quitar componente"
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-bg-sunken">
                    <td colSpan={2} className="px-3 py-2 font-semibold">
                      Total tarifa diaria
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold">
                      {formatCurrency(totalDiario)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
            {/* Error a nivel array (mínimo 1 / duplicados) */}
            {errors.componentes && typeof errors.componentes.message === 'string' && (
              <p className={errorCls}>{errors.componentes.message}</p>
            )}
          </>
        )}
      </FormSection>

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
          disabled={isSubmitting || crear.isPending || editar.isPending}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Icon name="check" size={14} /> {submitLabel}
        </button>
      </div>
    </form>
  );
}
