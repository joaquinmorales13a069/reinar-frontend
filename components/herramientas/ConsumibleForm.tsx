'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { Icon } from '@/components/ui/Icon';
import { BodegaSelect } from '@/components/ui/BodegaSelect';
import { DatosCompraFields, datosCompraSchema, construirDatosCompra } from '@/components/inventario/DatosCompraFields';
import { useCrearConsumible, useEditarConsumible } from '@/hooks/use-consumibles';
import { useCategorias } from '@/hooks/use-categorias';
import type { Consumible } from '@/types/api';

const baseSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio.'),
  descripcion: z.string().optional(),
  categoriaId: z.string().min(1, 'La categoría es obligatoria.'),
  precioUnitario: z.coerce.number().positive('El precio debe ser positivo.'),
  unidad: z.string().min(1, 'La unidad es obligatoria.').max(50),
  stockMinimo: z.coerce.number().int().min(0, 'No puede ser negativo.'),
  notas: z.string().optional(),
});

const crearSchema = baseSchema.extend({
  codigo: z
    .string()
    .min(1, 'El código es obligatorio.')
    .max(20, 'Máximo 20 caracteres.')
    .regex(/^[A-Z0-9-]+$/, 'Solo letras mayúsculas, números y guiones.'),
  // Stock inicial opcional en una bodega. Si se omite, arranca en 0 y se carga
  // luego con ajustar-stock. La UI solo permite una bodega al crear; para más
  // bodegas el usuario usa ajustar-stock después.
  stockInicialBodegaId: z.string().optional(),
  stockInicialCantidad: z.coerce.number().int().min(0, 'No puede ser negativo.').optional(),
  datosCompra: datosCompraSchema,
}).refine(
  (d) => !d.stockInicialCantidad || d.stockInicialCantidad === 0 || !!d.stockInicialBodegaId,
  { message: 'Si cargás stock inicial, elegí una bodega.', path: ['stockInicialBodegaId'] },
);

type CrearFormData = z.infer<typeof crearSchema>;
type EditarFormData = z.infer<typeof baseSchema>;

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-1';
const hintCls = 'text-xs text-tx-3 mt-1';

type Props =
  | { mode: 'crear'; consumible?: undefined }
  | { mode: 'editar'; consumible: Consumible };

export function ConsumibleForm(props: Props) {
  const isNew = props.mode === 'crear';
  const router = useRouter();

  const crear = useCrearConsumible();
  const editar = useEditarConsumible();

  // Las categorías vienen de la API para que el backend sea la fuente de verdad.
  const { data: categorias } = useCategorias('CONSUMIBLE');

  type FormData = CrearFormData | EditarFormData;
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(isNew ? crearSchema : baseSchema) as never,
    defaultValues: isNew
      ? {
          codigo: '',
          nombre: '',
          categoriaId: '',
          precioUnitario: undefined as unknown as number,
          unidad: '',
          stockInicialBodegaId: '',
          stockInicialCantidad: 0,
          stockMinimo: 0,
        }
      : {
          nombre: props.consumible.nombre,
          descripcion: props.consumible.descripcion ?? '',
          categoriaId: props.consumible.categoriaId,
          precioUnitario: Number(props.consumible.precioUnitario),
          unidad: props.consumible.unidad,
          stockMinimo: props.consumible.stockMinimo,
          notas: props.consumible.notas ?? '',
        },
  });

  function aplicarErroresApi(err: unknown) {
    const anyErr = err as {
      response?: { data?: { error?: { details?: { path: string; message: string }[] } } };
    };
    const details = anyErr?.response?.data?.error?.details;
    if (!details?.length) return;
    for (const d of details) {
      setError(d.path as keyof FormData, { type: 'server', message: d.message });
    }
  }

  async function onSubmit(values: FormData) {
    try {
      if (isNew) {
        const v = values as CrearFormData;
        const stockInicial = v.stockInicialBodegaId && v.stockInicialCantidad && v.stockInicialCantidad > 0
          ? [{ bodegaId: v.stockInicialBodegaId, cantidad: v.stockInicialCantidad }]
          : undefined;
        const consumible = await crear.mutateAsync({
          codigo: v.codigo,
          nombre: v.nombre,
          descripcion: v.descripcion || undefined,
          categoriaId: v.categoriaId,
          precioUnitario: v.precioUnitario,
          stockInicial,
          stockMinimo: v.stockMinimo,
          unidad: v.unidad,
          notas: v.notas || undefined,
          datosCompra: construirDatosCompra(v.datosCompra),
        });
        router.push(`/herramientas/consumibles/${consumible.id}`);
      } else {
        const v = values as EditarFormData;
        await editar.mutateAsync({
          id: props.consumible.id,
          data: {
            nombre: v.nombre,
            descripcion: v.descripcion || undefined,
            categoriaId: v.categoriaId,
            precioUnitario: v.precioUnitario,
            unidad: v.unidad,
            stockMinimo: v.stockMinimo,
            notas: v.notas || undefined,
            // stockActual NO se envía — el backend rechaza el campo en PUT.
            // Para mover stock se usa PATCH /:id/stock (ver AjusteStockPanel).
          },
        });
        router.push(`/herramientas/consumibles/${props.consumible.id}`);
      }
    } catch (err) {
      aplicarErroresApi(err);
    }
  }

  return (
    <form className="max-w-3xl" onSubmit={handleSubmit(onSubmit)}>
      <PageHeader
        title={isNew ? 'Nuevo consumible' : `Editar — ${props.consumible.nombre}`}
        subtitle={
          isNew
            ? 'Registrá un consumible (abrasivo, pintura, lubricante, etc.).'
            : 'Modificá los datos del consumible.'
        }
        back
        backLabel={isNew ? 'Consumibles' : `Consumible ${props.consumible.codigo}`}
        onBack={() =>
          router.push(
            isNew ? '/herramientas?tab=consumibles' : `/herramientas/consumibles/${props.consumible.id}`,
          )
        }
      />

      <FormSection title="Información general">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {isNew ? (
            <div>
              <label className={labelCls}>Código *</label>
              <input
                className={`${(errors as Record<string, unknown>).codigo ? inputErr : inputOk} font-mono uppercase`}
                placeholder="CON-007"
                {...register('codigo' as never, {
                  onChange: (e) => {
                    e.target.value = String(e.target.value).toUpperCase();
                  },
                })}
              />
              {(errors as Record<string, { message?: string }>).codigo && (
                <p className={errorCls}>
                  {(errors as Record<string, { message?: string }>).codigo.message}
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className={labelCls}>Código</label>
              <input
                className={`${inputOk} font-mono`}
                value={props.consumible.codigo}
                readOnly
                disabled
              />
              <p className={hintCls}>El código no se modifica una vez creado.</p>
            </div>
          )}

          <div>
            <label className={labelCls}>Categoría *</label>
            <select
              className={(errors as Record<string, unknown>).categoriaId ? inputErr : inputOk}
              {...register('categoriaId')}
            >
              <option value="">Seleccioná una categoría…</option>
              {categorias?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            {(errors as Record<string, { message?: string }>).categoriaId && (
              <p className={errorCls}>
                {(errors as Record<string, { message?: string }>).categoriaId.message}
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>Nombre *</label>
            <input
              className={errors.nombre ? inputErr : inputOk}
              placeholder="Ej. Arena sílica grado 30/60"
              {...register('nombre')}
            />
            {errors.nombre && <p className={errorCls}>{errors.nombre.message}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>Descripción</label>
            <textarea className={inputOk} rows={2} {...register('descripcion')} />
          </div>
        </div>
      </FormSection>

      <FormSection title="Precio y unidad">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Precio unitario (USD) *</label>
            <input
              className={errors.precioUnitario ? inputErr : `${inputOk} font-mono`}
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register('precioUnitario')}
            />
            {errors.precioUnitario && (
              <p className={errorCls}>{errors.precioUnitario.message}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Unidad de medida *</label>
            <input
              className={errors.unidad ? inputErr : inputOk}
              placeholder="kg, litros, rollos, etc."
              {...register('unidad')}
            />
            {errors.unidad && <p className={errorCls}>{errors.unidad.message}</p>}
          </div>
        </div>
      </FormSection>

      <FormSection title="Stock">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {isNew ? (
            <>
              <div>
                <label className={labelCls}>Bodega de stock inicial</label>
                <BodegaSelect
                  value={(watch('stockInicialBodegaId' as never) as unknown as string) ?? ''}
                  onChange={(id) => setValue('stockInicialBodegaId' as never, id as never)}
                  error={!!(errors as Record<string, unknown>).stockInicialBodegaId}
                />
                {(errors as Record<string, { message?: string }>).stockInicialBodegaId && (
                  <p className={errorCls}>
                    {(errors as Record<string, { message?: string }>).stockInicialBodegaId.message}
                  </p>
                )}
                <p className={hintCls}>Opcional. Más adelante podés agregar stock en otras bodegas con &quot;Ajustar stock&quot;.</p>
              </div>
              <div>
                <label className={labelCls}>Stock inicial</label>
                <input
                  className={(errors as Record<string, unknown>).stockInicialCantidad ? inputErr : `${inputOk} font-mono`}
                  type="number"
                  min="0"
                  {...register('stockInicialCantidad' as never)}
                />
                {(errors as Record<string, { message?: string }>).stockInicialCantidad && (
                  <p className={errorCls}>
                    {(errors as Record<string, { message?: string }>).stockInicialCantidad.message}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div>
              <label className={labelCls}>Stock actual</label>
              <input
                className={`${inputOk} font-mono`}
                value={props.consumible.stockActual}
                readOnly
                disabled
              />
              <p className={hintCls}>
                Para mover el stock, usá el botón <b>Ajustar stock</b> en el detalle.
              </p>
            </div>
          )}

          <div>
            <label className={labelCls}>Stock mínimo</label>
            <input
              className={errors.stockMinimo ? inputErr : `${inputOk} font-mono`}
              type="number"
              min="0"
              {...register('stockMinimo')}
            />
            {errors.stockMinimo && <p className={errorCls}>{errors.stockMinimo.message}</p>}
            <p className={hintCls}>Si el stock cae a este valor o menos, se marca en alerta.</p>
          </div>
        </div>
      </FormSection>

      <FormSection title="Notas internas">
        <textarea className={inputOk} rows={3} {...register('notas')} />
      </FormSection>

      {isNew && (
        <DatosCompraFields register={register} errors={errors} />
      )}

      <div className="flex flex-col sm:flex-row gap-2 mt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center justify-center px-3 py-2 rounded-md border border-bd text-sm text-tx-2 hover:bg-bg-sunken transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed sm:ml-auto"
        >
          <Icon name="check" size={14} />
          {isNew ? 'Crear consumible' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
