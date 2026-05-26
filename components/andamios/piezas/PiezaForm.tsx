'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { Icon } from '@/components/ui/Icon';
import { BodegaSelect } from '@/components/ui/BodegaSelect';
import {
  piezaCrearSchema,
  piezaEditarSchema,
  type PiezaCrearInput,
  type PiezaEditarInput,
} from '@/lib/schemas/andamios';
import { useCrearPieza, useEditarPieza } from '@/hooks/use-andamios';
import { trySetFieldErrorFromApi } from '@/lib/api-errors';
import type { PiezaTipo } from '@/types/api';

type Props =
  | { modo: 'crear'; pieza?: undefined }
  | { modo: 'editar'; pieza: PiezaTipo };

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk  = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-1';
const hintCls  = 'text-xs text-tx-3 mt-1';

export function PiezaForm(props: Props) {
  const router = useRouter();
  const crear = useCrearPieza();
  const editar = useEditarPieza();

  // Usamos dos forms tipados según el modo. La unión discriminada de Props
  // garantiza que `pieza` exista en modo editar.
  if (props.modo === 'crear') {
    return <PiezaFormCrear router={router} crear={crear} />;
  }
  return <PiezaFormEditar pieza={props.pieza} router={router} editar={editar} />;
}

function PiezaFormCrear({
  router,
  crear,
}: {
  router: ReturnType<typeof useRouter>;
  crear: ReturnType<typeof useCrearPieza>;
}) {
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PiezaCrearInput>({
    resolver: zodResolver(piezaCrearSchema) as never,
    defaultValues: {
      nombre: '',
      descripcion: '',
      stockInicialBodegaId: '',
      stockInicialCantidad: 0,
      stockMinimo: 0,
      tarifaDia: undefined as unknown as number,
      tarifaSemana: undefined as unknown as number,
      tarifaMes: undefined as unknown as number,
    },
  });

  async function onSubmit(values: PiezaCrearInput) {
    try {
      const stockInicial = values.stockInicialBodegaId && values.stockInicialCantidad && values.stockInicialCantidad > 0
        ? [{ bodegaId: values.stockInicialBodegaId, cantidad: values.stockInicialCantidad }]
        : undefined;
      await crear.mutateAsync({
        nombre: values.nombre.trim(),
        descripcion: values.descripcion?.trim() || undefined,
        stockInicial,
        stockMinimo: values.stockMinimo,
        tarifaDia: values.tarifaDia,
        tarifaSemana: values.tarifaSemana,
        tarifaMes: values.tarifaMes,
      });
    } catch (err) {
      // Si el backend reporta conflicto por nombre, lo mostramos inline; el hook
      // ya disparó el toast genérico como fallback.
      trySetFieldErrorFromApi(err, setError, 'nombre');
    }
  }

  return (
    <Layout
      title="Nueva pieza"
      backLabel="Andamios"
      onBack={() => router.push('/andamios')}
      submitLabel="Guardar pieza"
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting || crear.isPending}
    >
      <CamposInformacion register={register} errors={errors} mostrarStockInicial setValue={setValue} watch={watch} />
      <CamposTarifas register={register} errors={errors} />
    </Layout>
  );
}

function PiezaFormEditar({
  pieza,
  router,
  editar,
}: {
  pieza: PiezaTipo;
  router: ReturnType<typeof useRouter>;
  editar: ReturnType<typeof useEditarPieza>;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PiezaEditarInput>({
    resolver: zodResolver(piezaEditarSchema) as never,
    defaultValues: {
      nombre: pieza.nombre,
      descripcion: pieza.descripcion ?? '',
      stockMinimo: pieza.stockMinimo,
      tarifaDia: Number(pieza.tarifaDia),
      tarifaSemana: Number(pieza.tarifaSemana),
      tarifaMes: Number(pieza.tarifaMes),
    },
  });

  async function onSubmit(values: PiezaEditarInput) {
    try {
      await editar.mutateAsync({
        id: pieza.id,
        data: {
          nombre: values.nombre.trim(),
          descripcion: values.descripcion?.trim() || undefined,
          stockMinimo: values.stockMinimo,
          tarifaDia: values.tarifaDia,
          tarifaSemana: values.tarifaSemana,
          tarifaMes: values.tarifaMes,
        },
      });
      router.push(`/andamios/piezas/${pieza.id}`);
    } catch (err) {
      trySetFieldErrorFromApi(err, setError, 'nombre');
    }
  }

  return (
    <Layout
      title="Editar pieza"
      backLabel={`Pieza ${pieza.nombre}`}
      onBack={() => router.push(`/andamios/piezas/${pieza.id}`)}
      submitLabel="Guardar cambios"
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting || editar.isPending}
    >
      <CamposInformacion register={register} errors={errors} mostrarStockInicial={false} />
      <CamposTarifas register={register} errors={errors} />
    </Layout>
  );
}

function Layout({
  title,
  backLabel,
  onBack,
  submitLabel,
  onSubmit,
  isSubmitting,
  children,
}: {
  title: string;
  backLabel?: string;
  onBack: () => void;
  submitLabel: string;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  children: React.ReactNode;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 pb-24">
      <PageHeader title={title} back backLabel={backLabel} onBack={onBack} />
      {children}
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
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Icon name="check" size={14} /> {submitLabel}
        </button>
      </div>
    </form>
  );
}

// Bloque "Información" — reusado por crear y editar.
function CamposInformacion({
  register,
  errors,
  mostrarStockInicial,
  setValue,
  watch,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: any;
  mostrarStockInicial: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setValue?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  watch?: any;
}) {
  return (
    <FormSection title="Información">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className={labelCls}>Nombre *</label>
          <input
            className={errors.nombre ? inputErr : inputOk}
            placeholder="Tubo 48mm × 3.00m"
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

        {mostrarStockInicial && (
          <>
            <div>
              <label className={labelCls}>Bodega de stock inicial</label>
              <BodegaSelect
                value={(watch?.('stockInicialBodegaId') as string) ?? ''}
                onChange={(id) => setValue?.('stockInicialBodegaId', id)}
                error={!!errors.stockInicialBodegaId}
              />
              {errors.stockInicialBodegaId && <p className={errorCls}>{errors.stockInicialBodegaId.message}</p>}
              <p className={hintCls}>Opcional. Luego podés agregar stock en más bodegas con &quot;Ajustar stock&quot;.</p>
            </div>
            <div>
              <label className={labelCls}>Stock inicial</label>
              <input
                type="number"
                min="0"
                step="1"
                className={`${errors.stockInicialCantidad ? inputErr : inputOk} font-mono`}
                {...register('stockInicialCantidad')}
              />
              {errors.stockInicialCantidad && <p className={errorCls}>{errors.stockInicialCantidad.message}</p>}
            </div>
          </>
        )}

        <div>
          <label className={labelCls}>Stock mínimo</label>
          <input
            type="number"
            min="0"
            step="1"
            className={`${errors.stockMinimo ? inputErr : inputOk} font-mono`}
            {...register('stockMinimo')}
          />
          {errors.stockMinimo && <p className={errorCls}>{errors.stockMinimo.message}</p>}
          <p className={hintCls}>Se mostrará alerta cuando el stock actual sea ≤ mínimo.</p>
        </div>

        {!mostrarStockInicial && (
          <div className="md:col-span-2 text-xs text-tx-3">
            El stock actual se ajusta desde el detalle de la pieza (acción &quot;Ajustar stock&quot;),
            no desde este formulario.
          </div>
        )}
      </div>
    </FormSection>
  );
}

// Bloque "Tarifas" — los 3 valores se piden siempre.
function CamposTarifas({
  register,
  errors,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: any;
}) {
  return (
    <FormSection title="Tarifas">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['tarifaDia', 'tarifaSemana', 'tarifaMes'] as const).map((key) => {
          const label =
            key === 'tarifaDia' ? 'Tarifa por día *' :
            key === 'tarifaSemana' ? 'Tarifa por semana *' :
            'Tarifa por mes *';
          return (
            <div key={key}>
              <label className={labelCls}>{label}</label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                className={`${errors[key] ? inputErr : inputOk} font-mono`}
                {...register(key)}
              />
              {errors[key] && <p className={errorCls}>{errors[key].message}</p>}
            </div>
          );
        })}
      </div>
    </FormSection>
  );
}
