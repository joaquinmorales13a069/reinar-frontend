'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import Decimal from 'decimal.js';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { Icon } from '@/components/ui/Icon';
import { FseResumenTotales } from '@/components/fse/FseResumenTotales';
import { useProveedores, useProveedor } from '@/hooks/use-proveedores';
import { usePlantillasFse } from '@/hooks/use-fse';
import { crearFseFormSchema, type CrearFseFormValues } from '@/lib/schemas/fse';
import type { CrearFseDto, CrearFseItemDto, Fse, TipoItemFse } from '@/types/api';

// Umbral del Art. 28 LIVA: acumulado de compras a un mismo sujeto excluido en
// 12 meses a partir del cual debería estar inscrito en IVA. Solo informativo
// en el frontend — el backend no bloquea la creación por esto.
const UMBRAL_FSE_12M = 5714.29;

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border border-bd bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';

type ItemRow = CrearFseItemDto & { key: string };

function nuevaFila(tipoDefault: TipoItemFse): ItemRow {
  return {
    key: crypto.randomUUID(),
    tipoItem: tipoDefault,
    descripcion: '',
    cantidad: 1,
    precioUnitario: 0,
  };
}

type FseFormProps = {
  // Presente en modo edición — precarga cabecera e ítems desde el FSE existente.
  // El backend acepta el mismo shape de body en crear y actualizar (incluye
  // proveedorId), así que un único formulario cubre ambos flujos.
  fseInicial?: Fse;
  tituloPagina: string;
  subtituloPagina: string;
  submitLabel: string;
  isGuardando: boolean;
  onGuardar: (dto: CrearFseDto) => Promise<void>;
};

export function FseForm({
  fseInicial,
  tituloPagina,
  subtituloPagina,
  submitLabel,
  isGuardando,
  onGuardar,
}: FseFormProps) {
  const { data: proveedoresData } = useProveedores({ activo: true, limit: 100 });
  const proveedores = proveedoresData?.data ?? [];

  const form = useForm<CrearFseFormValues>({
    resolver: zodResolver(crearFseFormSchema),
    defaultValues: fseInicial
      ? {
          proveedorId: fseInicial.proveedorId,
          condicionPago: fseInicial.condicionPago,
          exonerarReteRenta: fseInicial.exonerarReteRenta,
          motivoExoneracion: fseInicial.motivoExoneracion ?? '',
          notas: fseInicial.notas ?? '',
        }
      : {
          proveedorId: '',
          condicionPago: 'CONTADO',
          exonerarReteRenta: false,
          motivoExoneracion: '',
          notas: '',
        },
  });

  // useWatch (no form.watch()) — su valor de retorno se memoiza mejor con
  // React Compiler que la función watch() de useForm().
  const proveedorId = useWatch({ control: form.control, name: 'proveedorId' });
  const exonerar = useWatch({ control: form.control, name: 'exonerarReteRenta' });
  const { data: proveedor } = useProveedor(proveedorId || null);
  const { data: plantillas } = usePlantillasFse(proveedorId || null);

  // El listado solo trae los primeros 100 proveedores activos: en modo edición
  // el proveedor del FSE puede estar inactivo o fuera de ese rango, y sin este
  // merge el <select> quedaría en blanco pese a tener proveedorId asignado.
  const proveedorFueraDeLista = !!proveedor && !proveedores.some((p) => p.id === proveedor.id);
  const opcionesProveedores = proveedorFueraDeLista ? [proveedor, ...proveedores] : proveedores;

  const [items, setItems] = useState<ItemRow[]>(() =>
    fseInicial
      ? fseInicial.items.map((it) => ({
          key: crypto.randomUUID(),
          tipoItem: it.tipoItem,
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          precioUnitario: Number(it.precioUnitario),
        }))
      : [],
  );
  const [plantillaSel, setPlantillaSel] = useState('');

  const tipoDefault: TipoItemFse = proveedor?.giroPredominante ?? 'BIENES';

  function agregarItem() {
    setItems((prev) => [...prev, nuevaFila(tipoDefault)]);
  }

  function actualizarItem(key: string, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function eliminarItem(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }

  function agregarDesdePlantilla(plantillaId: string) {
    const plantilla = (plantillas ?? []).find((p) => p.id === plantillaId);
    if (!plantilla) return;
    setItems((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        tipoItem: plantilla.tipoItem,
        descripcion: plantilla.descripcion,
        cantidad: 1,
        precioUnitario: plantilla.precioUnitario ? Number(plantilla.precioUnitario) : 0,
      },
    ]);
    setPlantillaSel('');
  }

  // Totales para el banner de umbral — mismo cálculo que FseResumenTotales,
  // pero acá solo necesitamos el total compra (sin desglose).
  const totalCompra = items.reduce(
    (acc, i) => acc.add(new Decimal(i.precioUnitario || 0).mul(i.cantidad || 0)),
    new Decimal(0),
  );
  const acumuladoProyectado = new Decimal(proveedor?.acumuladoFse12m ?? 0).add(totalCompra);
  const superaUmbral = proveedor && acumuladoProyectado.gte(UMBRAL_FSE_12M);

  const noElegible = proveedor?.elegibilidadFse && !proveedor.elegibilidadFse.elegible;

  // Evita que un item con descripcion vacia o precio en 0 (el default de
  // nuevaFila) pase el gate y falle recien en el backend via toast.
  function itemInvalido(it: ItemRow): boolean {
    return !it.descripcion.trim() || !(it.precioUnitario > 0) || !(it.cantidad >= 1);
  }
  const todosItemsValidos = items.length > 0 && items.every((it) => !itemInvalido(it));

  const puedeSubmit = !!proveedor && !noElegible && todosItemsValidos && !isGuardando;

  const onSubmit = form.handleSubmit(
    async (data) => {
      if (!proveedor) {
        toast.error('Seleccioná un proveedor antes de continuar.');
        return;
      }
      if (noElegible) {
        toast.error('Este proveedor no es elegible para FSE.');
        return;
      }
      if (items.length === 0) {
        toast.error('Agregá al menos un ítem.');
        return;
      }
      if (!todosItemsValidos) {
        toast.error('Completá descripción, cantidad y precio de cada ítem.');
        return;
      }

      const dto: CrearFseDto = {
        proveedorId: data.proveedorId,
        condicionPago: data.condicionPago,
        exonerarReteRenta: data.exonerarReteRenta,
        motivoExoneracion: data.exonerarReteRenta ? data.motivoExoneracion : undefined,
        notas: data.notas || undefined,
        items: items.map(({ tipoItem, descripcion, cantidad, precioUnitario }) => ({
          tipoItem,
          descripcion,
          cantidad,
          precioUnitario,
        })),
      };

      await onGuardar(dto);
    },
    (errors) => {
      const primero = Object.values(errors).find(
        (e) => e && typeof e === 'object' && 'message' in e,
      ) as { message?: string } | undefined;
      toast.error(primero?.message ?? 'Hay campos del formulario sin completar correctamente.');
    },
  );

  return (
    <form onSubmit={onSubmit}>
      <PageHeader title={tituloPagina} subtitle={subtituloPagina} back backLabel="FSE" />

      <FormSection title="Proveedor">
        <div>
          <label className={labelCls}>
            Proveedor <span className="text-danger">*</span>
          </label>
          <Controller
            control={form.control}
            name="proveedorId"
            render={({ field }) => (
              <select {...field} className={inputBase}>
                <option value="">— Seleccioná —</option>
                {opcionesProveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                    {!p.activo ? ' (inactivo)' : ''}
                  </option>
                ))}
              </select>
            )}
          />
          {form.formState.errors.proveedorId && (
            <div className="text-xs text-danger mt-1">{form.formState.errors.proveedorId.message}</div>
          )}
        </div>

        {noElegible && (
          <div className="flex items-start gap-2 bg-danger-soft text-danger rounded-md px-4 py-3 mt-3 text-sm">
            <Icon name="alertTriangle" size={18} className="shrink-0 mt-0.5" />
            <div>
              <p><b>Este proveedor no es elegible para FSE.</b></p>
              <p>{proveedor?.elegibilidadFse?.motivo ?? 'Motivo no especificado.'}</p>
              <Link href={`/proveedores/${proveedor?.id}`} className="underline hover:no-underline">
                Ver detalle del proveedor
              </Link>
            </div>
          </div>
        )}

        {!noElegible && superaUmbral && (
          <div className="flex items-start gap-2 bg-warn-soft text-warn rounded-md px-4 py-3 mt-3 text-sm">
            <Icon name="alertTriangle" size={18} className="shrink-0 mt-0.5" />
            <p>
              Este proveedor supera el umbral del Art. 28 LIVA ($5,714.29) en 12 meses — debería
              inscribirse en IVA.
            </p>
          </div>
        )}
      </FormSection>

      <FormSection title="Condiciones">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Condición de pago</label>
            <select {...form.register('condicionPago')} className={inputBase}>
              <option value="CONTADO">Contado</option>
              <option value="CREDITO">Crédito</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-tx-2">
              <input type="checkbox" {...form.register('exonerarReteRenta')} />
              Exonerar retención de renta
            </label>
          </div>
        </div>
        {exonerar && (
          <div className="mt-3">
            <label className={labelCls}>
              Motivo de exoneración <span className="text-danger">*</span>
            </label>
            <input
              className={inputBase}
              placeholder="Ej. proveedor domiciliado en el exterior…"
              {...form.register('motivoExoneracion')}
            />
            {form.formState.errors.motivoExoneracion && (
              <div className="text-xs text-danger mt-1">
                {form.formState.errors.motivoExoneracion.message}
              </div>
            )}
          </div>
        )}
        <div className="mt-3">
          <label className={labelCls}>Notas (opcional)</label>
          <textarea
            {...form.register('notas')}
            rows={2}
            className={inputBase}
            placeholder="Información adicional sobre esta compra."
          />
        </div>
      </FormSection>

      <FormSection title="Ítems">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span className="text-xs text-tx-3">{items.length} {items.length === 1 ? 'ítem' : 'ítems'}</span>
          <div className="flex items-center gap-2">
            {!!(plantillas ?? []).length && (
              <select
                className={`${inputBase} w-auto`}
                value={plantillaSel}
                onChange={(e) => {
                  setPlantillaSel(e.target.value);
                  if (e.target.value) agregarDesdePlantilla(e.target.value);
                }}
              >
                <option value="">Desde plantilla…</option>
                {(plantillas ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.descripcion}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={agregarItem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors"
            >
              <Icon name="plus" size={14} /> Ítem
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-tx-3 py-4 text-center">Sin ítems — agregá al menos uno.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.key} className="grid grid-cols-12 gap-2 items-start p-2 rounded-md border border-bd">
                <div className="col-span-12 sm:col-span-2">
                  <label className={labelCls}>Tipo</label>
                  <select
                    className={inputBase}
                    value={item.tipoItem}
                    onChange={(e) => actualizarItem(item.key, { tipoItem: e.target.value as TipoItemFse })}
                  >
                    <option value="BIENES">Bienes</option>
                    <option value="SERVICIOS">Servicios</option>
                  </select>
                </div>
                <div className="col-span-12 sm:col-span-4">
                  <label className={labelCls}>Descripción</label>
                  <input
                    className={inputBase}
                    value={item.descripcion}
                    onChange={(e) => actualizarItem(item.key, { descripcion: e.target.value })}
                    placeholder="Descripción del bien o servicio"
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <label className={labelCls}>Cantidad</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    className={`${inputBase} font-mono`}
                    value={item.cantidad}
                    onChange={(e) => actualizarItem(item.key, { cantidad: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label className={labelCls}>Precio unitario</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={`${inputBase} font-mono`}
                    value={item.precioUnitario}
                    onChange={(e) => actualizarItem(item.key, { precioUnitario: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="col-span-2 sm:col-span-1 flex items-end justify-end h-full pt-5">
                  <button
                    type="button"
                    onClick={() => eliminarItem(item.key)}
                    className="text-tx-3 hover:text-danger transition-colors p-1"
                    aria-label="Eliminar ítem"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
                {itemInvalido(item) && (
                  <div className="col-span-12 text-xs text-danger">
                    Completá descripción, cantidad (mín. 1) y precio (mayor a $0).
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </FormSection>

      <FseResumenTotales items={items} exonerar={exonerar} />

      <div className="flex justify-end gap-2 mt-4">
        <Link
          href={fseInicial ? `/fse/${fseInicial.id}` : '/fse'}
          className="px-3 py-1.5 text-sm rounded-md border border-bd text-tx hover:bg-bg-sunken transition-colors"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={!puedeSubmit}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60"
        >
          <Icon name="check" size={14} />
          {isGuardando ? 'Guardando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
