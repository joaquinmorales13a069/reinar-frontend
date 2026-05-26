'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { SelectorFactura } from '@/components/actas-recepciones/SelectorFactura';
import { CondicionSelect } from '@/components/actas-recepciones/CondicionSelect';
import { DireccionCompleta } from '@/components/actas-recepciones/DireccionCompleta';
import { ItemRow } from '@/components/actas-recepciones/ItemRow';
import { useBodegas } from '@/hooks/use-bodegas';
import { useFactura } from '@/hooks/use-facturas';
import { useItemsDisponiblesDespacho, useCrearActa } from '@/hooks/use-actas';
import { crearActaFormSchema, type CrearActaForm } from '@/lib/schemas/acta';
import type { ActaItem, CrearActaDto, CondicionItem, FacturaListItem } from '@/types/api';

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border border-bd bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';

type RowState = ActaItem & {
  incluido: boolean;
  condicionSalidaEdit: CondicionItem;
  observacionesSalidaEdit: string;
};

type FacturaRef = {
  id: string;
  numeroFactura: string;
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

  // useBodegas devuelve el array directamente en .data (el queryFn ya extrae .data.data).
  const { data: bodegasArr } = useBodegas();
  // Filtramos bodegas activas sin parentId (bodegas principales, no zonas).
  // parentId es opcional en el tipo; tratamos undefined como principal.
  const bodegasPrincipales = (bodegasArr ?? []).filter(
    (b) => b.activa && (b.parentId === null || b.parentId === undefined),
  );

  const [facturaSeleccionada, setFacturaSeleccionada] = useState<FacturaRef | null>(null);
  const { data: itemsDisp, isLoading: itemsLoading } = useItemsDisponiblesDespacho(
    facturaSeleccionada?.id ?? null,
  );
  const [rows, setRows] = useState<RowState[]>([]);

  const form = useForm<CrearActaForm>({
    // El resolver de @hookform/resolvers v5 + z.coerce genera un falso error de
    // tipos cuando el schema tiene z.coerce.number() en items anidados. El
    // comportamiento en runtime es correcto; suprimimos el error estático.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error ver comentario arriba
    resolver: zodResolver(crearActaFormSchema),
    defaultValues: {
      facturaId: facturaIdInicial,
      bodegaOrigenId: '',
      direccionEntrega: '',
      notas: '',
      observacionesSalida: '',
      periodoRentaInicio: '',
      periodoRentaFin: '',
      items: [],
    },
  });

  // Cuando entramos con ?facturaId=X (desde el detalle de una factura),
  // resolvemos la factura completa para poblar facturaSeleccionada y disparar
  // la carga de items. Sin esto, el usuario tendría que buscar y elegir
  // manualmente la misma factura que ya seleccionó al venir de su detalle.
  const { data: facturaInicial } = useFactura(facturaIdInicial || null);

  useEffect(() => {
    if (!facturaIdInicial) return;
    if (facturaSeleccionada) return;
    form.setValue('facturaId', facturaIdInicial);
    if (!facturaInicial) return;
    const c = facturaInicial.cliente;
    const razonSocial = c?.razonSocial ?? c?.nombre ?? '—';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFacturaSeleccionada({
      id: facturaInicial.id,
      numeroFactura: facturaInicial.numeroFactura,
      razonSocial,
    });
  }, [facturaIdInicial, facturaInicial, facturaSeleccionada, form]);

  useEffect(() => {
    if (!itemsDisp) return;
    // Defensa: filtra cualquier item que no sea físico (servicio, etc.). El
    // backend ya lo hace, pero esto evita que una versión vieja muestre líneas
    // sin nombre/tipo identificable.
    const fisicos = itemsDisp.filter(
      (it) => it.equipo || it.herramientaUnidad || it.consumible || it.piezaTipo,
    );
    const inicial: RowState[] = fisicos.map((it) => ({
      ...it,
      incluido: true,
      condicionSalidaEdit: 'BUENO' as CondicionItem,
      observacionesSalidaEdit: '',
    }));
    // El usuario edita cada row (toggle incluido, condición salida, observaciones),
    // así que necesitamos una copia mutable derivada del query data. setState desde
    // useEffect es la forma estándar de sincronizar con datos externos en RHF + React Query.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(inicial);
  }, [itemsDisp]);

  // La cotización no expone periodoInicio/periodoFin en el tipo Factura que
  // devuelve el backend, así que dejamos esos campos en blanco para que el
  // usuario los rellene manualmente.

  const crear = useCrearActa();

  // Construye el array de items en el shape que esperan tanto Zod (form schema)
  // como el DTO del backend. Centralizado para que validación y submit usen
  // exactamente lo mismo y no se desfasen.
  function buildItems(): CrearActaDto['items'] {
    return rows
      .filter((r) => r.incluido)
      .map((r) => {
        const base: Partial<CrearActaDto['items'][number]> = {};
        if (r.equipo) {
          base.equipoId = r.equipo.id;
        } else if (r.herramientaUnidad) {
          base.herramientaUnidadId = r.herramientaUnidad.id;
        } else if (r.consumible) {
          base.consumibleId = r.consumible.id;
          base.cantidadConsumible = r.cantidadConsumible ?? 1;
        } else if (r.piezaTipo) {
          base.piezaTipoId = r.piezaTipo.id;
          base.cantidadRecibida = r.cantidadRecibida ?? 1;
        }
        return {
          cotizacionItemId: r.cotizacionItemId,
          ...base,
          condicionSalida: r.condicionSalidaEdit,
          observacionesSalida: r.observacionesSalidaEdit || undefined,
        } as CrearActaDto['items'][number];
      });
  }

  // Sincroniza el array de items del form con las rows del usuario para que la
  // validación Zod (que exige items.length >= 1 y un tipo válido por línea)
  // tenga el snapshot correcto al hacer submit. Sin esto, form.values.items
  // siempre quedaba [] y se mostraba "El acta debe tener al menos un ítem"
  // aunque el checkbox estuviera activo.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    form.setValue('items', buildItems(), { shouldValidate: false });
    // buildItems es estable dentro del render; solo dependemos de rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const onSubmit = form.handleSubmit(async (data) => {
    if (!facturaSeleccionada) return;

    const dto: CrearActaDto = {
      bodegaOrigenId: data.bodegaOrigenId,
      direccionEntrega: data.direccionEntrega || undefined,
      notas: data.notas || undefined,
      observacionesSalida: data.observacionesSalida || undefined,
      periodoRentaInicio: data.periodoRentaInicio
        ? new Date(data.periodoRentaInicio).toISOString()
        : undefined,
      periodoRentaFin: data.periodoRentaFin
        ? new Date(data.periodoRentaFin).toISOString()
        : undefined,
      items: buildItems(),
    };

    try {
      const acta = await crear.mutateAsync({ facturaId: facturaSeleccionada.id, data: dto });
      router.push(`/actas/${acta.id}`);
    } catch {
      // el hook useCrearActa ya muestra toast.error internamente
    }
  });

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
  }

  return (
    <form onSubmit={onSubmit}>
      <PageHeader
        title="Nueva acta de entrega"
        subtitle="Generá un acta para despachar equipos a una factura."
        back
      />

      {/* ── Factura origen ──────────────────────────────────────────── */}
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

      {/* ── Logística ───────────────────────────────────────────────── */}
      <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
        <h3 className="text-sm font-semibold text-tx mb-3">Logística</h3>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className={labelCls}>
              Bodega de origen <span className="text-danger">*</span>
            </label>
            <Controller
              control={form.control}
              name="bodegaOrigenId"
              render={({ field }) => (
                <select {...field} className={inputBase}>
                  <option value="">— Seleccioná —</option>
                  {bodegasPrincipales.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nombre}
                    </option>
                  ))}
                </select>
              )}
            />
            {form.formState.errors.bodegaOrigenId && (
              <div className="text-xs text-danger mt-1">
                {form.formState.errors.bodegaOrigenId.message}
              </div>
            )}
          </div>
        </div>

        {/* Dirección de entrega en su propia fila por los 4 sub-campos. */}
        <div className="mb-3">
          <label className={labelCls}>Dirección de entrega</label>
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

        <div className="grid sm:grid-cols-2 gap-3">
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
          <div className="sm:col-span-2">
            <label className={labelCls}>Observaciones de salida</label>
            <textarea
              {...form.register('observacionesSalida')}
              rows={2}
              className={inputBase}
              placeholder="Condiciones del despacho, transporte, etc."
            />
          </div>
        </div>
      </div>

      {/* ── Ítems a despachar ────────────────────────────────────────── */}
      <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-tx">Ítems a despachar</h3>
          <span className="text-xs text-tx-3">
            {itemsIncluidos} de {rows.length} seleccionados
          </span>
        </div>
        {!facturaSeleccionada ? (
          <EmptyState
            icon="package"
            title="Sin ítems"
            message="Seleccioná una factura para cargar sus ítems."
          />
        ) : itemsLoading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="package"
            title="Sin ítems disponibles"
            message="Todos los ítems de esta factura ya están en campo."
          />
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
                    <ItemRow item={r} mode="compact" />
                    <div className="grid sm:grid-cols-3 gap-2 mt-2">
                      <div>
                        <label className={labelCls}>Cond. salida</label>
                        <CondicionSelect
                          value={r.condicionSalidaEdit}
                          disabled={!r.incluido}
                          onChange={(v) =>
                            setRows((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, condicionSalidaEdit: v } : row,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelCls}>Observaciones</label>
                        <input
                          className={`${inputBase} disabled:opacity-60`}
                          disabled={!r.incluido}
                          value={r.observacionesSalidaEdit}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((row, i) =>
                                i === idx
                                  ? { ...row, observacionesSalidaEdit: e.target.value }
                                  : row,
                              ),
                            )
                          }
                          placeholder="Observaciones para este ítem"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {form.formState.errors.items && (
          <div className="text-xs text-danger mt-2">
            {form.formState.errors.items.message}
          </div>
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
          disabled={crear.isPending || itemsIncluidos === 0 || !facturaSeleccionada}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60"
        >
          <Icon name="check" size={14} />
          {crear.isPending ? 'Creando…' : 'Crear acta en estado PENDIENTE'}
        </button>
      </div>
    </form>
  );
}
