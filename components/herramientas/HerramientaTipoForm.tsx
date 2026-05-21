'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { Icon } from '@/components/ui/Icon';
import {
  useCrearHerramientaTipo,
  useEditarHerramientaTipo,
} from '@/hooks/use-herramientas';
import { CATEGORIAS_HERRAMIENTA_LABEL } from '@/lib/herramientas';
import type { HerramientaTipo, CategoriaHerramienta } from '@/types/api';

// Replica el schema del backend (herramientas.schemas.ts) — los mensajes en
// español dan feedback inmediato sin esperar al server.
const baseSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio.'),
  descripcion: z.string().optional(),
  categoria: z.enum(['MANGUERA', 'BOQUILLA', 'EPP', 'HERRAMIENTA_MANUAL', 'OTRO']),
  tarifaDia: z.coerce.number().positive('La tarifa por día debe ser positiva.'),
  tarifaSemana: z.coerce.number().positive('La tarifa por semana debe ser positiva.'),
  tarifaMes: z.coerce.number().positive('La tarifa por mes debe ser positiva.'),
  notas: z.string().optional(),
});

const crearSchema = baseSchema.extend({
  codigo: z
    .string()
    .min(1, 'El código es obligatorio.')
    .max(20, 'Máximo 20 caracteres.')
    .regex(/^[A-Z0-9-]+$/, 'Solo letras mayúsculas, números y guiones.'),
});

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
  | { mode: 'crear'; tipo?: undefined }
  | { mode: 'editar'; tipo: HerramientaTipo };

export function HerramientaTipoForm(props: Props) {
  const isNew = props.mode === 'crear';
  const router = useRouter();

  const crear = useCrearHerramientaTipo();
  const editar = useEditarHerramientaTipo();

  type FormData = CrearFormData | EditarFormData;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(isNew ? crearSchema : baseSchema) as never,
    defaultValues: isNew
      ? {
          codigo: '',
          nombre: '',
          categoria: 'HERRAMIENTA_MANUAL' as CategoriaHerramienta,
          tarifaDia: undefined as unknown as number,
          tarifaSemana: undefined as unknown as number,
          tarifaMes: undefined as unknown as number,
        }
      : {
          nombre: props.tipo.nombre,
          descripcion: props.tipo.descripcion ?? '',
          categoria: props.tipo.categoria,
          tarifaDia: Number(props.tipo.tarifaDia),
          tarifaSemana: Number(props.tipo.tarifaSemana),
          tarifaMes: Number(props.tipo.tarifaMes),
          notas: props.tipo.notas ?? '',
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
        const tipo = await crear.mutateAsync({
          codigo: v.codigo,
          nombre: v.nombre,
          descripcion: v.descripcion || undefined,
          categoria: v.categoria,
          tarifaDia: v.tarifaDia,
          tarifaSemana: v.tarifaSemana,
          tarifaMes: v.tarifaMes,
          notas: v.notas || undefined,
        });
        router.push(`/herramientas/tipos/${tipo.id}`);
      } else {
        const v = values as EditarFormData;
        await editar.mutateAsync({
          id: props.tipo.id,
          data: {
            nombre: v.nombre,
            descripcion: v.descripcion || undefined,
            categoria: v.categoria,
            tarifaDia: v.tarifaDia,
            tarifaSemana: v.tarifaSemana,
            tarifaMes: v.tarifaMes,
            notas: v.notas || undefined,
          },
        });
        router.push(`/herramientas/tipos/${props.tipo.id}`);
      }
    } catch (err) {
      aplicarErroresApi(err);
    }
  }

  return (
    <form className="max-w-3xl" onSubmit={handleSubmit(onSubmit)}>
      <PageHeader
        title={isNew ? 'Nuevo tipo de herramienta' : `Editar — ${props.tipo.nombre}`}
        subtitle={
          isNew
            ? 'Registrá un tipo de herramienta. Luego podrás agregar unidades físicas.'
            : 'Modificá los datos del tipo.'
        }
        back
        backLabel={isNew ? 'Herramientas' : `Tipo ${props.tipo.codigo}`}
        onBack={() =>
          router.push(isNew ? '/herramientas?tab=tipos' : `/herramientas/tipos/${props.tipo.id}`)
        }
      />

      <FormSection title="Información general">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {isNew ? (
            <div>
              <label className={labelCls}>Código *</label>
              <input
                className={`${(errors as Record<string, unknown>).codigo ? inputErr : inputOk} font-mono uppercase`}
                placeholder="HT-007"
                {...register('codigo' as never, {
                  // Mismo patrón que EquipoForm: forzamos uppercase en cliente para
                  // que coincida con el regex /^[A-Z0-9-]+$/ del backend.
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
                value={props.tipo.codigo}
                readOnly
                disabled
              />
              <p className={hintCls}>El código no se modifica una vez creado.</p>
            </div>
          )}

          <div>
            <label className={labelCls}>Categoría *</label>
            <select className={inputOk} {...register('categoria')}>
              {Object.entries(CATEGORIAS_HERRAMIENTA_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>Nombre *</label>
            <input
              className={errors.nombre ? inputErr : inputOk}
              placeholder="Ej. Manguera de 100 ft"
              {...register('nombre')}
            />
            {errors.nombre && <p className={errorCls}>{errors.nombre.message}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>Descripción</label>
            <textarea
              className={inputOk}
              rows={2}
              placeholder="Descripción opcional del tipo."
              {...register('descripcion')}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Tarifas">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Tarifa por día (USD) *</label>
            <input
              className={errors.tarifaDia ? inputErr : `${inputOk} font-mono`}
              type="number"
              step="0.01"
              placeholder="15.00"
              {...register('tarifaDia')}
            />
            {errors.tarifaDia && <p className={errorCls}>{errors.tarifaDia.message}</p>}
          </div>
          <div>
            <label className={labelCls}>Tarifa por semana (USD) *</label>
            <input
              className={errors.tarifaSemana ? inputErr : `${inputOk} font-mono`}
              type="number"
              step="0.01"
              placeholder="80.00"
              {...register('tarifaSemana')}
            />
            {errors.tarifaSemana && <p className={errorCls}>{errors.tarifaSemana.message}</p>}
          </div>
          <div>
            <label className={labelCls}>Tarifa por mes (USD) *</label>
            <input
              className={errors.tarifaMes ? inputErr : `${inputOk} font-mono`}
              type="number"
              step="0.01"
              placeholder="280.00"
              {...register('tarifaMes')}
            />
            {errors.tarifaMes && <p className={errorCls}>{errors.tarifaMes.message}</p>}
          </div>
        </div>
      </FormSection>

      <FormSection title="Notas internas">
        <textarea
          className={inputOk}
          rows={3}
          placeholder="Observaciones operativas (taller, manejo, etc.)."
          {...register('notas')}
        />
      </FormSection>

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
          {isNew ? 'Crear tipo' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
