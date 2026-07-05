'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { SelectorFactura } from '@/components/actas-recepciones/SelectorFactura';
import { SelectorCotizacion } from '@/components/actas-recepciones/SelectorCotizacion';
import { DireccionCompleta } from '@/components/actas-recepciones/DireccionCompleta';
import { ItemRow } from '@/components/actas-recepciones/ItemRow';
import { useBodegas } from '@/hooks/use-bodegas';
import { useFactura } from '@/hooks/use-facturas';
import { useCotizacion } from '@/hooks/use-cotizaciones';
import {
  useItemsDisponiblesDespacho,
  useItemsDisponiblesDespachoCotizacion,
  useCrearActa,
  useCrearActaDesdeCotizacion,
  useBodegasConItemsDisponibles,
  useBodegasConItemsDisponiblesCotizacion,
} from '@/hooks/use-actas';
import { crearActaFormSchema, type CrearActaForm } from '@/lib/schemas/acta';
import type {
  ItemDisponibleDespacho,
  CrearActaDto,
  FacturaListItem,
  ActaItem,
} from '@/types/api';

// Adapta un CotizacionItem (lo que viene de items-disponibles-despacho) al
// shape que espera ItemRow (ActaItem). El componente ItemRow se diseñó para
// renderizar items DE UN ACTA ya existente; reutilizarlo aquí ahorra duplicar
// el resolver polimórfico (4 tipos). Mapeamos herramientaTipo → un pseudo
// herramientaUnidad solo para fines de display (codigoInterno vacío, ya que
// la unidad real se asigna después).
function rowToActaItemDisplay(r: ItemDisponibleDespacho): ActaItem {
  return {
    id: r.id,
    cotizacionItemId: r.id,
    equipo: r.equipo,
    herramientaUnidad: r.herramientaTipo
      ? {
          id: r.herramientaTipo.id,
          codigoInterno: '',
          herramientaTipo: { nombre: r.herramientaTipo.nombre },
        }
      : null,
    consumible: r.consumible,
    piezaTipo: r.piezaTipo,
    cantidadConsumible: r.consumible ? r.cantidad : null,
    cantidadRecibida: r.piezaTipo ? r.cantidad : null,
    estado: 'PENDIENTE_DEVOLUCION',
  };
}

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border border-bd bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';

// Crear acta solo necesita saber qué ítems van. Los datos de inspección viven
// en otro paso (página /actas/[id]/inspeccion).
type RowState = ItemDisponibleDespacho & {
  incluido: boolean;
};

type FacturaRef = {
  id: string;
  numeroFactura: string;
  razonSocial: string;
};

type CotizacionRef = {
  id: string;
  numeroCotizacion: string;
  razonSocial: string;
};

export default function NuevaActaPageWrapper() {
  // useSearchParams requiere Suspense para que Next.js pueda prerenderizar
  // estáticamente la página sin esperar a los query params del cliente.
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Spinner /></div>}>
      <NuevaActaPage />
    </Suspense>
  );
}

function NuevaActaPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const facturaIdInicial = sp.get('facturaId') ?? '';
  const cotizacionIdInicial = sp.get('cotizacionId') ?? '';

  // Flujo cotización-first (Task 7/8): si viene ?facturaId= usamos el flujo
  // clásico (factura ya emitida). En cualquier otro caso — venga o no
  // ?cotizacionId=, o el usuario entre sin parámetros — el origen es una
  // cotización aprobada (con o sin factura todavía).
  const modo: 'factura' | 'cotizacion' = facturaIdInicial ? 'factura' : 'cotizacion';

  // useBodegas devuelve el array directamente en .data (el queryFn ya extrae .data.data).
  const { data: bodegasArr } = useBodegas();
  // Filtramos bodegas activas sin parentId (bodegas principales, no zonas).
  // Excluimos tipo PROYECTO: el backend rechaza las bodegas-proyecto como
  // origen de despacho con 400 — no las ofrecemos para evitar el error.
  // parentId es opcional en el tipo; tratamos undefined como principal.
  const bodegasPrincipales = (bodegasArr ?? []).filter(
    (b) =>
      b.activa &&
      b.tipo !== 'PROYECTO' &&
      (b.parentId === null || b.parentId === undefined),
  );

  const [facturaSeleccionada, setFacturaSeleccionada] = useState<FacturaRef | null>(null);
  const [cotizacionSeleccionada, setCotizacionSeleccionada] = useState<CotizacionRef | null>(null);
  // Id "activo" de cotización: se fija al entrar con ?cotizacionId= o al
  // elegir una en <SelectorCotizacion>. Separado de cotizacionSeleccionada
  // porque esta última se deriva de la respuesta completa (necesitamos
  // numeroCotizacion + cliente, que el selector no expone).
  const [cotizacionIdActivo, setCotizacionIdActivo] = useState<string | null>(
    cotizacionIdInicial || null,
  );

  const { data: bodegasConItemsFactura } = useBodegasConItemsDisponibles(
    modo === 'factura' ? facturaSeleccionada?.id ?? null : null,
  );
  const { data: bodegasConItemsCotizacion } = useBodegasConItemsDisponiblesCotizacion(
    modo === 'cotizacion' ? cotizacionSeleccionada?.id ?? null : null,
  );
  const bodegasConItems = modo === 'factura' ? bodegasConItemsFactura : bodegasConItemsCotizacion;

  const [rows, setRows] = useState<RowState[]>([]);

  const form = useForm<CrearActaForm>({
    resolver: zodResolver(crearActaFormSchema),
    defaultValues: {
      facturaId: facturaIdInicial,
      cotizacionId: modo === 'cotizacion' ? cotizacionIdInicial : '',
      bodegaOrigenId: '',
      direccionEntrega: '',
      notas: '',
      periodoRentaInicio: '',
      periodoRentaFin: '',
    },
  });

  // Items se filtran por bodegaOrigenId del form — al cambiar la bodega, los
  // items mostrados cambian a los que están físicamente en esa bodega.
  const bodegaOrigenId = form.watch('bodegaOrigenId');
  const { data: itemsDispFactura, isLoading: itemsLoadingFactura } = useItemsDisponiblesDespacho(
    modo === 'factura' ? facturaSeleccionada?.id ?? null : null,
    bodegaOrigenId || null,
  );
  const { data: itemsDispCotizacion, isLoading: itemsLoadingCotizacion } =
    useItemsDisponiblesDespachoCotizacion(
      modo === 'cotizacion' ? cotizacionSeleccionada?.id ?? null : null,
      bodegaOrigenId || null,
    );
  const itemsDisp = modo === 'factura' ? itemsDispFactura : itemsDispCotizacion;
  const itemsLoading = modo === 'factura' ? itemsLoadingFactura : itemsLoadingCotizacion;

  // Cuando entramos con ?facturaId=X (desde el detalle de una factura),
  // resolvemos la factura completa para poblar facturaSeleccionada y disparar
  // la carga de items. Sin esto, el usuario tendría que buscar y elegir
  // manualmente la misma factura que ya seleccionó al venir de su detalle.
  const { data: facturaInicial } = useFactura(modo === 'factura' ? facturaIdInicial || null : null);

  useEffect(() => {
    if (modo !== 'factura') return;
    if (!facturaIdInicial) return;
    if (facturaSeleccionada) return;
    form.setValue('facturaId', facturaIdInicial);
    if (!facturaInicial) return;
    const c = facturaInicial.cliente;
    // Para PARTICULAR la razonSocial es null y queremos nombre + apellido;
    // antes el código tomaba solo nombre y se perdía el apellido.
    const nombreCompleto = [c?.nombre, c?.apellido].filter(Boolean).join(' ');
    const razonSocial = c?.razonSocial ?? (nombreCompleto || '—');

    setFacturaSeleccionada({
      id: facturaInicial.id,
      numeroFactura: facturaInicial.numeroFactura,
      razonSocial,
    });
  }, [modo, facturaIdInicial, facturaInicial, facturaSeleccionada, form]);

  // Análogo al efecto de factura: resuelve la cotización completa (para
  // numeroCotizacion + cliente) tanto si viene por ?cotizacionId= como si el
  // usuario la elige en <SelectorCotizacion> (que solo entrega el id).
  const { data: cotizacionActiva } = useCotizacion(modo === 'cotizacion' ? cotizacionIdActivo : null);

  useEffect(() => {
    if (modo !== 'cotizacion') return;
    if (!cotizacionActiva) return;
    const c = cotizacionActiva.cliente;
    const nombreCompleto = [c?.nombre, c?.apellido].filter(Boolean).join(' ');
    const razonSocial = c?.razonSocial ?? (nombreCompleto || '—');
    setCotizacionSeleccionada({
      id: cotizacionActiva.id,
      numeroCotizacion: cotizacionActiva.numeroCotizacion,
      razonSocial,
    });
    form.setValue('cotizacionId', cotizacionActiva.id);
  }, [modo, cotizacionActiva, form]);

  useEffect(() => {
    if (!itemsDisp) return;
    // Defensa: filtra cualquier item que no sea físico (servicio, etc.). El
    // backend ya lo hace, pero esto evita que una versión vieja muestre líneas
    // sin nombre/tipo identificable.
    // CotizacionItem expone herramientaTipo (no herramientaUnidad — la unidad
     // se resuelve recién al despachar). Aquí solo aseguramos que hay algún
     // FK físico para excluir servicios u otras líneas no despachables.
    const fisicos = itemsDisp.filter(
      (it) => it.equipo || it.herramientaTipo || it.consumible || it.piezaTipo,
    );
    const inicial: RowState[] = fisicos.map((it) => ({
      ...it,
      incluido: true,
    }));
    // El usuario edita cada row (toggle incluido, condición salida, observaciones),
    // así que necesitamos una copia mutable derivada del query data. setState desde
    // useEffect es la forma estándar de sincronizar con datos externos en RHF + React Query.

    setRows(inicial);
  }, [itemsDisp]);

  // La cotización no expone periodoInicio/periodoFin en el tipo Factura que
  // devuelve el backend, así que dejamos esos campos en blanco para que el
  // usuario los rellene manualmente.

  const crearFactura = useCrearActa();
  const crearCotizacion = useCrearActaDesdeCotizacion(cotizacionSeleccionada?.id ?? '');
  const crear = modo === 'factura' ? crearFactura : crearCotizacion;

  // Crear acta = solo SELECCIONA qué ítems van. Los datos de inspección
  // (horómetro, combustible, condición, observaciones por ítem) se capturan
  // después en /actas/[id]/inspeccion cuando el bodeguero copia el picking
  // físico al sistema. Acá solo enviamos el id de la cotización y, según el
  // tipo, el FK + cantidad.
  function buildItems(): CrearActaDto['items'] {
    return rows
      .filter((r) => r.incluido)
      .map((r) => {
        const base: Partial<CrearActaDto['items'][number]> = {};
        if (r.equipoId && r.equipo) {
          base.equipoId = r.equipoId;
        } else if (r.consumibleId && r.consumible) {
          base.consumibleId = r.consumibleId;
          base.cantidadConsumible = r.cantidad;
        } else if (r.piezaTipoId && r.piezaTipo) {
          base.piezaTipoId = r.piezaTipoId;
          base.cantidadRecibida = r.cantidad;
        }
        // Nota: herramientas requieren elegir una HerramientaUnidad específica
        // (no el tipo). Esa selección aún no está en el form — TODO cuando se
        // agregue soporte para herramientas en el flujo de despacho.
        return {
          cotizacionItemId: r.id,
          ...base,
        } as CrearActaDto['items'][number];
      });
  }

  // Errores de items se manejan manualmente fuera de Zod (ver schema).
  const [itemsError, setItemsError] = useState<string | null>(null);

  const origenSeleccionado = modo === 'factura' ? facturaSeleccionada : cotizacionSeleccionada;

  const onSubmit = form.handleSubmit(
    async (data) => {
      if (!origenSeleccionado) {
        toast.error(
          modo === 'factura'
            ? 'Seleccioná una factura antes de crear el acta.'
            : 'Seleccioná una cotización antes de crear el acta.',
        );
        return;
      }

      const items = buildItems();
      if (items.length === 0) {
        setItemsError('El acta debe tener al menos un ítem seleccionado.');
        return;
      }
      setItemsError(null);

      const dto: CrearActaDto = {
        bodegaOrigenId: data.bodegaOrigenId,
        direccionEntrega: data.direccionEntrega || undefined,
        notas: data.notas || undefined,
        periodoRentaInicio: data.periodoRentaInicio
          ? new Date(data.periodoRentaInicio).toISOString()
          : undefined,
        periodoRentaFin: data.periodoRentaFin
          ? new Date(data.periodoRentaFin).toISOString()
          : undefined,
        items,
      };

      try {
        const acta =
          modo === 'factura'
            ? await crearFactura.mutateAsync({ facturaId: facturaSeleccionada!.id, data: dto })
            : await crearCotizacion.mutateAsync(dto);
        router.push(`/actas/${acta.id}`);
      } catch {
        // el hook useCrearActa/useCrearActaDesdeCotizacion ya muestra toast.error internamente
      }
    },
    // Si el submit falla por validación Zod, surface el primer error con un
    // toast para no dejar al usuario con un botón que "no hace nada".
    (errors) => {
      const primero = Object.values(errors).find((e) => e && typeof e === 'object' && 'message' in e) as
        | { message?: string }
        | undefined;
      toast.error(primero?.message ?? 'Hay campos del formulario sin completar correctamente.');
    },
  );

  const itemsIncluidos = rows.filter((r) => r.incluido).length;

  function handleSeleccionarFactura(f: FacturaListItem) {
    const nombreCompleto = [f.cliente.nombre, f.cliente.apellido].filter(Boolean).join(' ');
    const razonSocial = f.cliente.razonSocial ?? (nombreCompleto || '—');
    setFacturaSeleccionada({ id: f.id, numeroFactura: f.numeroFactura, razonSocial });
    form.setValue('facturaId', f.id);
  }

  function handleCambiarFactura() {
    setFacturaSeleccionada(null);
    setRows([]);
    form.setValue('facturaId', '');
    // Reseteamos la bodega elegida: las bodegas disponibles dependen de la
    // factura, así que la selección previa puede ya no ser válida.
    form.setValue('bodegaOrigenId', '');
  }

  function handleSeleccionarCotizacion(cotizacionId: string) {
    setCotizacionIdActivo(cotizacionId);
  }

  function handleCambiarCotizacion() {
    setCotizacionIdActivo(null);
    setCotizacionSeleccionada(null);
    setRows([]);
    form.setValue('cotizacionId', '');
    // Reseteamos la bodega elegida: las bodegas disponibles dependen de la
    // cotización, así que la selección previa puede ya no ser válida.
    form.setValue('bodegaOrigenId', '');
  }

  return (
    <form onSubmit={onSubmit}>
      <PageHeader
        title="Nueva acta de entrega"
        subtitle={
          modo === 'factura'
            ? 'Generá un acta para despachar equipos a una factura.'
            : 'Generá un acta desde cotización (sin factura aún).'
        }
        back
        backLabel="Actas"
      />

      {/* ── Origen (factura o cotización) ──────────────────────────── */}
      {modo === 'factura' ? (
        <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
          <h3 className="text-sm font-semibold text-tx mb-3">Factura origen</h3>
          {!facturaSeleccionada ? (
            <div>
              <label className={labelCls}>
                Buscar factura aprobada <span className="text-danger">*</span>
              </label>
              <SelectorFactura
                placeholder="Buscar por número o cliente…"
                emptyMessage="Sin facturas elegibles."
                onSelect={handleSeleccionarFactura}
              />
              {form.formState.errors.facturaId && (
                <div className="text-xs text-danger mt-1">
                  {form.formState.errors.facturaId.message}
                </div>
              )}
            </div>
          ) : (
            <div className="flex justify-between items-start gap-3 p-3 bg-bg-sunken rounded">
              <div>
                <div className="text-sm font-mono font-semibold">
                  {facturaSeleccionada.numeroFactura}
                </div>
                <div className="text-xs text-tx-2">{facturaSeleccionada.razonSocial}</div>
              </div>
              <button
                type="button"
                onClick={handleCambiarFactura}
                className="flex items-center gap-1 text-xs text-tx-3 hover:text-tx transition-colors"
              >
                <Icon name="x" size={12} /> Cambiar
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
          <h3 className="text-sm font-semibold text-tx mb-3">Cotización origen</h3>
          {!cotizacionSeleccionada ? (
            <div>
              <label className={labelCls}>
                Buscar cotización aprobada <span className="text-danger">*</span>
              </label>
              <SelectorCotizacion
                value={cotizacionIdActivo}
                onChange={handleSeleccionarCotizacion}
                placeholder="Buscar por número o cliente…"
                emptyMessage="Sin cotizaciones elegibles."
              />
              {form.formState.errors.cotizacionId && (
                <div className="text-xs text-danger mt-1">
                  {form.formState.errors.cotizacionId.message}
                </div>
              )}
            </div>
          ) : (
            <div className="flex justify-between items-start gap-3 p-3 bg-bg-sunken rounded">
              <div>
                <div className="text-sm font-mono font-semibold">
                  {cotizacionSeleccionada.numeroCotizacion}
                </div>
                <div className="text-xs text-tx-2">{cotizacionSeleccionada.razonSocial}</div>
              </div>
              <button
                type="button"
                onClick={handleCambiarCotizacion}
                className="flex items-center gap-1 text-xs text-tx-3 hover:text-tx transition-colors"
              >
                <Icon name="x" size={12} /> Cambiar
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Logística ───────────────────────────────────────────────── */}
      <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
        <h3 className="text-sm font-semibold text-tx mb-3">Logística</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>
              Bodega de origen <span className="text-danger">*</span>
            </label>
            <Controller
              control={form.control}
              name="bodegaOrigenId"
              render={({ field }) => {
                // Mostramos solo las bodegas que tienen al menos un item
                // despachable para este origen. Cae al listado general si aún
                // no se seleccionó factura/cotización.
                const idsPermitidos = bodegasConItems
                  ? new Set(bodegasConItems.map((b) => b.id))
                  : null;
                const opciones = origenSeleccionado && idsPermitidos
                  ? bodegasPrincipales.filter((b) => idsPermitidos.has(b.id))
                  : bodegasPrincipales;
                return (
                  <select {...field} className={inputBase}>
                    <option value="">
                      {origenSeleccionado && opciones.length === 0
                        ? 'Sin bodegas con items disponibles'
                        : '— Seleccioná —'}
                    </option>
                    {opciones.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nombre}
                      </option>
                    ))}
                  </select>
                );
              }}
            />
            {form.formState.errors.bodegaOrigenId && (
              <div className="text-xs text-danger mt-1">
                {form.formState.errors.bodegaOrigenId.message}
              </div>
            )}
          </div>
          <div>
            <label className={labelCls}>Período renta — inicio</label>
            <input
              type="date"
              {...form.register('periodoRentaInicio')}
              className={`${inputBase} font-mono`}
            />
          </div>
          <div>
            <label className={labelCls}>Período renta — fin</label>
            <input
              type="date"
              {...form.register('periodoRentaFin')}
              className={`${inputBase} font-mono`}
            />
            {form.formState.errors.periodoRentaFin && (
              <div className="text-xs text-danger mt-1">
                {form.formState.errors.periodoRentaFin.message}
              </div>
            )}
          </div>
        </div>
        <p className="text-xs text-tx-3 mt-3">
          El folio físico Reinar y las observaciones del despacho se capturan
          al momento de registrar el despacho, no al crear el acta.
        </p>
      </div>

      {/* ── Dirección de entrega ─────────────────────────────────────── */}
      <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
        <h3 className="text-sm font-semibold text-tx mb-3">Dirección de entrega</h3>
        <Controller
          control={form.control}
          name="direccionEntrega"
          render={({ field }) => (
            <DireccionCompleta
              value={field.value ?? ''}
              onChange={field.onChange}
              error={form.formState.errors.direccionEntrega?.message}
            />
          )}
        />
      </div>

      {/* ── Ítems a despachar ────────────────────────────────────────── */}
      <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-tx">Ítems a despachar</h3>
          <span className="text-xs text-tx-3">
            {itemsIncluidos} de {rows.length} seleccionados
          </span>
        </div>
        {!origenSeleccionado ? (
          <EmptyState
            icon="package"
            title="Sin ítems"
            message={
              modo === 'factura'
                ? 'Seleccioná una factura para cargar sus ítems.'
                : 'Seleccioná una cotización para cargar sus ítems.'
            }
          />
        ) : itemsLoading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <div>
            <EmptyState
              icon="package"
              title="Sin ítems disponibles"
              message="Todos los ítems físicos de este origen ya fueron asignados a otra acta (en campo o ya devueltos). No hay nada nuevo que despachar."
            />
            <div className="text-center mt-3">
              <button
                type="button"
                onClick={modo === 'factura' ? handleCambiarFactura : handleCambiarCotizacion}
                className="text-xs text-accent hover:underline"
              >
                {modo === 'factura' ? 'Elegir otra factura' : 'Elegir otra cotización'}
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-bd">
            {rows.map((r, idx) => (
              <div key={r.id} className={`py-2 ${r.incluido ? '' : 'opacity-50'}`}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1.5"
                    checked={r.incluido}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, incluido: e.target.checked } : row,
                        ),
                      )
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <ItemRow item={rowToActaItemDisplay(r)} mode="compact" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-tx-3 mt-3">
          Condición de salida, horómetro y combustible se capturan después,
          desde el botón &quot;Capturar datos del picking&quot; en el detalle del acta.
        </p>
        {itemsError && (
          <div className="text-xs text-danger mt-2">{itemsError}</div>
        )}
      </div>

      {/* ── Notas generales ─────────────────────────────────────────── */}
      <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
        <h3 className="text-sm font-semibold text-tx mb-2">Notas generales</h3>
        <textarea
          {...form.register('notas')}
          rows={3}
          className={inputBase}
          placeholder="Información adicional sobre este despacho."
        />
      </div>

      {/* ── Acciones ────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-3 py-1.5 text-sm rounded-md border border-bd text-tx hover:bg-bg-sunken transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={crear.isPending || itemsIncluidos === 0 || !origenSeleccionado}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60"
        >
          <Icon name="check" size={14} />
          {crear.isPending ? 'Creando…' : 'Crear acta en estado PENDIENTE'}
        </button>
      </div>
    </form>
  );
}
