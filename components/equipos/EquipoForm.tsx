'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { EquipoImagenUpload } from '@/components/equipos/EquipoImagenUpload';
import { BodegaSelect } from '@/components/ui/BodegaSelect';
import { DatosCompraFields, datosCompraSchema, construirDatosCompra } from '@/components/inventario/DatosCompraFields';
import { useCrearEquipo, useEditarEquipo, useCambiarEstadoEquipo, useSubirImagenEquipo, useEliminarEquipo } from '@/hooks/use-equipos';
import { useCategorias } from '@/hooks/use-categorias';
import { puedeEjecutar } from '@/lib/equipos';
import { useAuthStore } from '@/stores/auth.store';
import { hoySV } from '@/lib/utils';
import type { Equipo, EstadoEquipoEditable } from '@/types/api';

// Año actual en TZ El Salvador — evita que el límite máximo del año de
// fabricación dependa del reloj/timezone del dispositivo del usuario.
const ANIO_ACTUAL_SV = Number(hoySV().slice(0, 4));

const baseSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio.'),
  descripcion: z.string().optional(),
  categoriaId: z.string().min(1, 'La categoría es obligatoria.'),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  anoFabricacion: z.coerce.number().int().min(1900).max(ANIO_ACTUAL_SV).optional().or(z.literal('')),
  tarifaDia: z.coerce.number().positive('La tarifa por día debe ser positiva.'),
  tarifaSemana: z.coerce.number().positive('La tarifa por semana debe ser positiva.'),
  tarifaMes: z.coerce.number().positive('La tarifa por mes debe ser positiva.'),
  notas: z.string().optional(),
  estado: z.enum(['DISPONIBLE', 'USO_INTERNO', 'INACTIVO']).optional(),
});

const crearSchema = baseSchema.extend({
  // El backend regex es /^[A-Z0-9]+$/ con máximo 10 caracteres.
  // Validamos en cliente para feedback inmediato y forzar uppercase.
  prefijo: z
    .string()
    .min(1, 'El prefijo es obligatorio.')
    .max(10, 'Máximo 10 caracteres.')
    .regex(/^[A-Z0-9]+$/, 'Solo letras mayúsculas y números.'),
  bodegaId: z.string().min(1, 'La bodega es obligatoria.'),
  datosCompra: datosCompraSchema,
});

type CrearFormData = z.infer<typeof crearSchema>;
type EditarFormData = z.infer<typeof baseSchema>;

const inputBase = 'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-1';
const hintCls = 'text-xs text-tx-3 mt-1';

type Props =
  | { mode: 'crear'; equipo?: undefined }
  | { mode: 'editar'; equipo: Equipo };

export function EquipoForm(props: Props) {
  const isNew = props.mode === 'crear';
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');
  const puedeEliminar = puedeEjecutar('eliminar', rol);

  const crear = useCrearEquipo();
  const editar = useEditarEquipo();
  const cambiarEstado = useCambiarEstadoEquipo();
  const subirImagen = useSubirImagenEquipo();
  const eliminar = useEliminarEquipo();

  // Las categorías vienen de la API para que el backend sea la fuente de verdad.
  const { data: categorias } = useCategorias('EQUIPO');

  // Estado local de la imagen pendiente. En modo crear se manda tras
  // el POST exitoso; en editar se manda inmediatamente si el archivo cambia.
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(
    !isNew ? props.equipo.imagenUrl : null,
  );
  const [confirmDesact, setConfirmDesact] = useState(false);

  type FormData = CrearFormData | EditarFormData;
  const { register, handleSubmit, setError, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(isNew ? crearSchema : baseSchema) as never,
    defaultValues: isNew
      ? {
          nombre: '',
          categoriaId: '',
          prefijo: '',
          bodegaId: '',
          tarifaDia: undefined as unknown as number,
          tarifaSemana: undefined as unknown as number,
          tarifaMes: undefined as unknown as number,
        }
      : {
          nombre: props.equipo.nombre,
          descripcion: props.equipo.descripcion ?? '',
          categoriaId: props.equipo.categoriaId,
          marca: props.equipo.marca ?? '',
          modelo: props.equipo.modelo ?? '',
          anoFabricacion: props.equipo.anoFabricacion ?? undefined,
          tarifaDia: Number(props.equipo.tarifaDia),
          tarifaSemana: Number(props.equipo.tarifaSemana),
          tarifaMes: Number(props.equipo.tarifaMes),
          notas: props.equipo.notas ?? '',
          estado: (['DISPONIBLE', 'USO_INTERNO', 'INACTIVO'] as const).includes(
            props.equipo.estado as EstadoEquipoEditable,
          )
            ? (props.equipo.estado as EstadoEquipoEditable)
            : undefined,
        },
  });

  // Auto-rellena el prefijo con el prefijoCodigo de la categoría seleccionada
  // solo cuando el usuario no lo haya tocado — para no pisar un override manual.
  const [prefijoTouched, setPrefijoTouched] = useState(false);
  // FormData es una unión, por eso se necesita unknown como puente antes de string.
  const categoriaIdActual = (watch as (field: string) => unknown)('categoriaId') as string | undefined;
  useEffect(() => {
    if (!isNew || prefijoTouched || !categoriaIdActual || !categorias) return;
    const cat = categorias.find((c) => c.id === categoriaIdActual);
    if (cat?.prefijoCodigo) {
      setValue('prefijo' as never, cat.prefijoCodigo as never);
    }
  }, [isNew, prefijoTouched, categoriaIdActual, categorias, setValue]);

  function handleImagen(file: File, preview: string) {
    setImagenFile(file);
    setImagenPreview(preview);
  }
  function handleClearImagen() {
    setImagenFile(null);
    setImagenPreview(null);
  }

  function aplicarErroresApi(err: unknown) {
    // El backend devuelve error.details como array { path, message }.
    // Mapeamos cada uno a setError de RHF para mostrar inline en el campo.
    const anyErr = err as { response?: { data?: { error?: { details?: { path: string; message: string }[] } } } };
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
        const equipo = await crear.mutateAsync({
          prefijo: v.prefijo,
          nombre: v.nombre,
          descripcion: v.descripcion || undefined,
          categoriaId: v.categoriaId,
          bodegaId: v.bodegaId,
          marca: v.marca || undefined,
          modelo: v.modelo || undefined,
          anoFabricacion: typeof v.anoFabricacion === 'number' ? v.anoFabricacion : undefined,
          tarifaDia: v.tarifaDia,
          tarifaSemana: v.tarifaSemana,
          tarifaMes: v.tarifaMes,
          notas: v.notas || undefined,
          datosCompra: construirDatosCompra(v.datosCompra),
        });
        if (imagenFile) {
          await subirImagen.mutateAsync({ id: equipo.id, file: imagenFile });
        }
        router.push(`/equipos/${equipo.id}`);
      } else {
        const v = values as EditarFormData;
        await editar.mutateAsync({
          id: props.equipo.id,
          data: {
            nombre: v.nombre,
            descripcion: v.descripcion || undefined,
            // categoriaId no se manda en edit — está deshabilitada (ver UI).
            marca: v.marca || undefined,
            modelo: v.modelo || undefined,
            anoFabricacion: typeof v.anoFabricacion === 'number' ? v.anoFabricacion : undefined,
            tarifaDia: v.tarifaDia,
            tarifaSemana: v.tarifaSemana,
            tarifaMes: v.tarifaMes,
            notas: v.notas || undefined,
          },
        });
        // estado no es parte de ActualizarEquipoDto — el backend lo cambia vía
        // PATCH /:id/estado. Solo lo disparamos si el usuario lo modificó.
        if (v.estado && v.estado !== props.equipo.estado) {
          await cambiarEstado.mutateAsync({ id: props.equipo.id, estado: v.estado });
        }
        if (imagenFile) {
          await subirImagen.mutateAsync({ id: props.equipo.id, file: imagenFile });
        }
        router.push(`/equipos/${props.equipo.id}`);
      }
    } catch (err) {
      aplicarErroresApi(err);
    }
  }

  async function handleDesactivar() {
    if (isNew) return;
    try {
      await eliminar.mutateAsync(props.equipo.id);
      router.push('/equipos');
    } catch {
      // El toast lo dispara el hook; aquí no hacemos nada más.
    }
  }

  return (
    <form className="max-w-3xl" onSubmit={handleSubmit(onSubmit)}>
      <PageHeader
        title={isNew ? 'Nuevo equipo' : `Editar — ${props.equipo.nombre}`}
        subtitle={isNew ? 'Registrá un equipo nuevo en la flota.' : 'Modificá los datos del equipo.'}
        back
        backLabel={isNew ? 'Equipos' : `Equipo ${props.equipo.codigo}`}
        // Forzamos destino para evitar bucles cuando el usuario llega desde
        // distintas rutas (lista, detalle, ficha). El padre natural en editar
        // es el detalle del equipo; en crear, la lista.
        onBack={() => router.push(isNew ? '/equipos' : `/equipos/${props.equipo.id}`)}
      />

      {confirmDesact && !isNew && (
        <ConfirmRow
          message={
            <>
              ¿Desactivar el equipo <b>{props.equipo.nombre}</b>? Quedará fuera de los catálogos de cotización.
            </>
          }
          onCancel={() => setConfirmDesact(false)}
          onConfirm={() => { setConfirmDesact(false); handleDesactivar(); }}
          confirmLabel="Sí, desactivar"
        />
      )}

      <FormSection title="Imagen del equipo">
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <EquipoImagenUpload
            imagenUrl={imagenPreview}
            onFileSelected={handleImagen}
            onClear={handleClearImagen}
            variant="form"
          />
          <p className="text-xs text-tx-3 leading-relaxed flex-1">
            Hacé clic o arrastrá una imagen sobre la zona para subirla. Se aceptan JPG, PNG o WEBP hasta 5&nbsp;MB.
            {isNew && ' La imagen se sube automáticamente luego de crear el equipo.'}
          </p>
        </div>
      </FormSection>

      <FormSection title="Información general">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {isNew ? (
            <div>
              <label className={labelCls}>Prefijo *</label>
              <input
                className={`${(errors as Record<string, unknown>).prefijo ? inputErr : inputOk} font-mono uppercase`}
                placeholder="EQ"
                {...register('prefijo' as never, {
                  // Forzamos uppercase en cliente para que coincida con el regex del backend.
                  // Además marcamos prefijoTouched para que cambios posteriores de
                  // categoría no pisen el valor que el usuario editó a mano.
                  onChange: (e) => {
                    e.target.value = String(e.target.value).toUpperCase();
                    if (!prefijoTouched) setPrefijoTouched(true);
                  },
                })}
              />
              {(errors as Record<string, { message?: string }>).prefijo && (
                <p className={errorCls}>{(errors as Record<string, { message?: string }>).prefijo.message}</p>
              )}
              <p className={hintCls}>
                Sugerido según la categoría. Podés editarlo. Se generará el código <b>PREFIJO-001</b> automáticamente.
              </p>
            </div>
          ) : (
            <div>
              <label className={labelCls}>Código</label>
              <input
                className={`${inputOk} font-mono`}
                value={props.equipo.codigo}
                readOnly
                disabled
              />
            </div>
          )}

          <div>
            <label className={labelCls}>Categoría *</label>
            <select
              className={`${(errors as Record<string, unknown>).categoriaId ? inputErr : inputOk} ${!isNew ? 'opacity-60 cursor-not-allowed' : ''}`}
              disabled={!isNew}
              {...register('categoriaId')}
              title={!isNew ? 'La categoría no se modifica desde este formulario.' : undefined}
            >
              <option value="">Seleccioná una categoría…</option>
              {categorias?.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
            {(errors as Record<string, { message?: string }>).categoriaId && (
              <p className={errorCls}>{(errors as Record<string, { message?: string }>).categoriaId.message}</p>
            )}
            {!isNew && (
              <p className={hintCls}>La categoría no se modifica desde este formulario.</p>
            )}
          </div>

          {isNew && (
            <div className="sm:col-span-2">
              <label className={labelCls}>Bodega *</label>
              <BodegaSelect
                value={(watch('bodegaId' as never) as unknown as string) ?? ''}
                onChange={(id) => setValue('bodegaId' as never, id as never, { shouldValidate: true })}
                error={!!(errors as Record<string, unknown>).bodegaId}
              />
              {(errors as Record<string, { message?: string }>).bodegaId && (
                <p className={errorCls}>{(errors as Record<string, { message?: string }>).bodegaId.message}</p>
              )}
              <p className={hintCls}>El equipo nuevo se asigna a una bodega física. Podrás moverlo luego desde el detalle.</p>
            </div>
          )}

          <div className="sm:col-span-2">
            <label className={labelCls}>Nombre del equipo *</label>
            <input
              className={errors.nombre ? inputErr : inputOk}
              placeholder="Ej. Compresor Atlas 185 CFM"
              {...register('nombre')}
            />
            {errors.nombre && <p className={errorCls}>{errors.nombre.message}</p>}
          </div>

          <div>
            <label className={labelCls}>Marca</label>
            <input className={inputOk} placeholder="Atlas Copco" {...register('marca')} />
          </div>
          <div>
            <label className={labelCls}>Modelo / Serie</label>
            <input className={`${inputOk} font-mono`} placeholder="XAS-185" {...register('modelo')} />
          </div>
          <div>
            <label className={labelCls}>Año de fabricación</label>
            <input
              className={`${inputOk} font-mono`}
              type="number"
              placeholder="2024"
              {...register('anoFabricacion')}
            />
          </div>

          {!isNew && (
            <div>
              <label className={labelCls}>Estado</label>
              <select className={inputOk} {...register('estado')}>
                <option value="DISPONIBLE">Disponible</option>
                <option value="USO_INTERNO">Uso interno</option>
                <option value="INACTIVO">Inactivo</option>
              </select>
              <p className={hintCls}>
                <span className="font-mono">RENTADO</span> y <span className="font-mono">MANTENIMIENTO</span>
                {' '}los gestiona el sistema automáticamente.
              </p>
            </div>
          )}

          <div className="sm:col-span-2">
            <label className={labelCls}>Descripción</label>
            <textarea
              className={inputOk}
              rows={3}
              placeholder="Descripción general del equipo, accesorios incluidos, etc."
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
              placeholder="65.00"
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
              placeholder="360.00"
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
              placeholder="1280.00"
              {...register('tarifaMes')}
            />
            {errors.tarifaMes && <p className={errorCls}>{errors.tarifaMes.message}</p>}
          </div>
        </div>
      </FormSection>

      {isNew && (
        <FormSection title="Ficha técnica">
          <p className="text-sm text-tx-2">
            Se crearán los campos sugeridos para la categoría seleccionada.
            Podrás completarlos y agregar/quitar campos desde la pantalla de ficha técnica una vez creado el equipo.
          </p>
        </FormSection>
      )}

      {isNew && (
        <DatosCompraFields register={register} errors={errors} />
      )}

      <FormSection title="Notas internas">
        <textarea
          className={inputOk}
          rows={3}
          placeholder="Observaciones operativas para el equipo de bodega y taller."
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
        {!isNew && puedeEliminar && props.equipo.activo && (
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-bd text-sm text-danger hover:bg-bg-sunken transition-colors sm:mr-auto"
            onClick={() => setConfirmDesact(true)}
          >
            <Icon name="x" size={14} /> Desactivar equipo
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed sm:ml-auto"
        >
          <Icon name="check" size={14} />
          {isNew ? 'Crear equipo' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
