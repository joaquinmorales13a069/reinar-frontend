'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { SelectorFactura } from '@/components/actas-recepciones/SelectorFactura';
import { CondicionSelect } from '@/components/actas-recepciones/CondicionSelect';
import { CondicionBadge } from '@/components/actas-recepciones/CondicionBadge';
import { ItemRow, describirItem } from '@/components/actas-recepciones/ItemRow';
import { useItemsPendientesDevolucion, useCrearRecepcion } from '@/hooks/use-recepciones';
import { crearRecepcionFormSchema, type CrearRecepcionForm } from '@/lib/schemas/recepcion';
import type { ActaItem, CondicionItem, CrearRecepcionDto, FacturaListItem } from '@/types/api';

const COND_RANK: Record<CondicionItem, number> = { BUENO: 1, REGULAR: 2, MALO: 3 };
const inputBase = 'w-full px-3 py-2 text-sm rounded-md border border-bd bg-surface text-tx focus:outline-none focus:border-accent transition-colors';
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';

type RowState = {
  actaEntregaItemId: string;
  actaEntregaId: string;
  numeroActa: string;
  item: ActaItem;
  incluido: boolean;
  condicionRetorno: CondicionItem;
  observacionesRetorno: string;
  horometroRetorno: string;
  combustibleRetorno: string;
  // Solo para consumibles: cantidad que regresa al inventario (string para el input).
  cantidadDevuelta: string;
  // Si true, el sobrante se da por consumido y el ítem se cierra.
  cerrar: boolean;
};

export default function NuevaRecepcionPageWrapper() {
  // useSearchParams requiere Suspense para que Next.js pueda prerenderizar
  // estáticamente la página sin esperar a los query params del cliente.
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Spinner /></div>}>
      <NuevaRecepcionPage />
    </Suspense>
  );
}

function NuevaRecepcionPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const facturaIdInicial = sp.get('facturaId') ?? '';
  const actaIdInicial = sp.get('actaId') ?? '';

  const [step, setStep] = useState<0 | 1>(actaIdInicial ? 1 : 0);
  const [facturaSeleccionada, setFacturaSeleccionada] = useState<{ id: string; numeroFactura: string; razonSocial: string } | null>(null);
  const [rows, setRows] = useState<RowState[]>([]);

  const { data: grupos, isLoading: gruposLoading } = useItemsPendientesDevolucion(facturaSeleccionada?.id ?? null);

  const form = useForm<CrearRecepcionForm>({
    resolver: zodResolver(crearRecepcionFormSchema),
    defaultValues: {
      facturaId: facturaIdInicial,
      numeroActaFisico: '',
      horaRecepcion: '',
      observaciones: '',
    },
  });

  // Errores de items se manejan manualmente fuera de Zod (ver schema).
  const [itemsError, setItemsError] = useState<string | null>(null);
  // Error de backend 422 (sobre-devolución) para mostrar inline tras el submit.
  const [backendError, setBackendError] = useState<string | null>(null);

  // Cargar filas al recibir grupos
  useEffect(() => {
    if (!grupos) return;
    const initial: RowState[] = grupos.flatMap((g) =>
      g.items.map((it) => ({
        actaEntregaItemId: it.id,
        actaEntregaId: g.actaEntregaId,
        numeroActa: g.numeroActa,
        item: it,
        // Si llegamos con ?actaId=, solo pre-seleccionamos los items de esa acta.
        incluido: actaIdInicial ? g.actaEntregaId === actaIdInicial : false,
        condicionRetorno: 'BUENO' as CondicionItem,
        observacionesRetorno: '',
        horometroRetorno: '',
        combustibleRetorno: '',
        cantidadDevuelta: '',
        cerrar: false,
      })),
    );
    // El usuario edita cada row (condición retorno, observaciones, horómetro, combustible),
    // así que necesitamos una copia mutable derivada del query data. setState desde
    // useEffect es la forma estándar de sincronizar con datos externos en RHF + React Query.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(initial);
  }, [grupos, actaIdInicial]);

  const crear = useCrearRecepcion();

  const onSubmit = form.handleSubmit(
    async (data) => {
      if (!facturaSeleccionada) {
        toast.error('Seleccioná una factura antes de registrar la recepción.');
        return;
      }

      const itemsIncluidos = rows.filter((r) => r.incluido);
      if (itemsIncluidos.length === 0) {
        setItemsError('Marcá al menos un ítem para devolver.');
        setStep(0); // volvé al paso 1 para que el usuario seleccione
        return;
      }
      const sinCondicion = itemsIncluidos.find((r) => !r.condicionRetorno);
      if (sinCondicion) {
        setItemsError('Cada ítem marcado debe tener condición de retorno.');
        return;
      }

      // Validar que ningún consumible exceda su pendiente antes de enviar al backend.
      for (const r of itemsIncluidos) {
        if (!r.item.consumible) continue;
        if (r.cantidadDevuelta === '') continue;
        const pendiente = (r.item.cantidadConsumible ?? 0) - (r.item.cantidadRecibida ?? 0);
        const val = Number(r.cantidadDevuelta);
        if (!Number.isInteger(val) || val < 0 || val > pendiente) {
          setItemsError(`Cantidad a devolver de "${r.item.consumible.nombre}" debe ser un entero entre 0 y ${pendiente}.`);
          return;
        }
      }

      setItemsError(null);
      setBackendError(null);

      const dto: CrearRecepcionDto = {
        numeroActaFisico: data.numeroActaFisico || undefined,
        horaRecepcion: data.horaRecepcion || undefined,
        observaciones: data.observaciones || undefined,
        items: itemsIncluidos.map((r) => {
          const esConsumible = !!r.item.consumible;
          return {
            actaEntregaItemId: r.actaEntregaItemId,
            condicionRetorno: r.condicionRetorno,
            observacionesRetorno: r.observacionesRetorno || undefined,
            horometroRetorno: r.horometroRetorno ? Number(r.horometroRetorno) : undefined,
            combustibleRetorno: r.combustibleRetorno || undefined,
            // Los campos de devolución parcial solo aplican a consumibles.
            ...(esConsumible && {
              cantidadDevuelta: r.cantidadDevuelta !== '' ? Number(r.cantidadDevuelta) : undefined,
              cerrar: r.cerrar || undefined,
            }),
          };
        }),
      };

      try {
        const recepcion = await crear.mutateAsync({ facturaId: facturaSeleccionada.id, data: dto });
        router.push(`/recepciones/${recepcion.id}`);
      } catch (err: unknown) {
        // El hook ya toasteó el error genérico; adicionalmente mostrar el mensaje inline
        // si el backend retornó un 422 con detalle (ej. sobre-devolución de consumible).
        const apiErr = err as { response?: { data?: { error?: { message?: string } } } };
        const msg = apiErr?.response?.data?.error?.message;
        if (msg) setBackendError(msg);
      }
    },
    // Surface cualquier error de validación Zod del schema base (factura, etc.)
    // para que ningún click quede sin feedback.
    (errors) => {
      const primero = Object.values(errors).find((e) => e && typeof e === 'object' && 'message' in e) as
        | { message?: string }
        | undefined;
      toast.error(primero?.message ?? 'Hay campos sin completar correctamente.');
    },
  );

  const itemsIncluidos = rows.filter((r) => r.incluido).length;
  const canAdvance = !!facturaSeleccionada && rows.length > 0 && itemsIncluidos > 0;

  // Bloquear submit si algún consumible tiene cantidad inválida (evita llamada al backend).
  const hayExceso = rows.some((r) => {
    if (!r.incluido || !r.item.consumible || r.cantidadDevuelta === '') return false;
    const pendiente = (r.item.cantidadConsumible ?? 0) - (r.item.cantidadRecibida ?? 0);
    const val = Number(r.cantidadDevuelta);
    return !Number.isInteger(val) || val < 0 || val > pendiente;
  });

  // Agrupa rows por actaEntregaId para renderizar en bloques.
  const gruposVisuales = Object.entries(
    rows.reduce<Record<string, RowState[]>>((acc, r) => {
      (acc[r.actaEntregaId] ??= []).push(r);
      return acc;
    }, {}),
  );

  return (
    <form onSubmit={onSubmit}>
      <PageHeader title="Nueva recepción" subtitle="Documentá la devolución y cerrá el ciclo de renta." back backLabel="Recepciones" />

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6">
        {[
          { id: 0, label: 'Selección' },
          { id: 1, label: 'Inspección' },
        ].map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => step > s.id && setStep(s.id as 0 | 1)}
              className={`flex items-center gap-2 text-xs ${step === s.id ? 'opacity-100' : step > s.id ? 'opacity-100' : 'opacity-50'}`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-semibold ${step > s.id ? 'bg-ok text-white' : step === s.id ? 'bg-accent text-navy' : 'bg-bg-sunken border border-bd text-tx-3'}`}>
                {step > s.id ? <Icon name="check" size={12} /> : i + 1}
              </div>
              <span className="font-medium text-tx">{s.label}</span>
            </button>
            {i === 0 && <div className={`w-12 h-px ${step > 0 ? 'bg-ok' : 'bg-bd'}`} />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <>
          <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
            <h3 className="text-sm font-semibold text-tx mb-3">Factura</h3>
            {!facturaSeleccionada ? (
              <div>
                <label className={labelCls}>Buscar factura con actas entregadas <span className="text-danger">*</span></label>
                <SelectorFactura
                  placeholder="Buscar por número o cliente…"
                  emptyMessage="Sin facturas con devoluciones pendientes."
                  onSelect={(f: FacturaListItem) => {
                    const nombre = [f.cliente.nombre, f.cliente.apellido].filter(Boolean).join(' ');
                    const razonSocial = f.cliente.razonSocial ?? (nombre || '—');
                    setFacturaSeleccionada({ id: f.id, numeroFactura: f.numeroFactura, razonSocial });
                    form.setValue('facturaId', f.id);
                  }}
                />
              </div>
            ) : (
              <div className="flex justify-between items-start gap-3 p-3 bg-bg-sunken rounded">
                <div>
                  <div className="text-sm font-mono font-semibold">{facturaSeleccionada.numeroFactura}</div>
                  <div className="text-xs text-tx-2">{facturaSeleccionada.razonSocial}</div>
                </div>
                <button
                  type="button"
                  onClick={() => { setFacturaSeleccionada(null); setRows([]); form.setValue('facturaId', ''); }}
                  className="text-xs text-tx-3 hover:text-tx flex items-center gap-1"
                >
                  <Icon name="x" size={12} /> Cambiar
                </button>
              </div>
            )}
          </div>

          {facturaSeleccionada && (
            <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
              <h3 className="text-sm font-semibold text-tx mb-3">Ítems pendientes de devolución</h3>
              {gruposLoading ? (
                <div className="flex justify-center py-6"><Spinner /></div>
              ) : rows.length === 0 ? (
                <EmptyState icon="package" title="Sin ítems" message="No hay ítems pendientes de devolución para esta factura." />
              ) : (
                <div className="space-y-3">
                  {gruposVisuales.map(([actaId, items]) => (
                    <div key={actaId} className="rounded-md border border-bd p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-mono text-tx-2">{items[0].numeroActa} · {items.length} ítems</div>
                        <button
                          type="button"
                          className="text-xs text-accent hover:underline"
                          onClick={() => setRows(prev => {
                            const todosMarcados = items.every(i => i.incluido);
                            return prev.map(r => r.actaEntregaId === actaId ? { ...r, incluido: !todosMarcados } : r);
                          })}
                        >
                          {items.every(i => i.incluido) ? 'Desmarcar todos' : 'Marcar todos'}
                        </button>
                      </div>
                      <div className="divide-y divide-bd">
                        {items.map((r) => (
                          <div key={r.actaEntregaItemId} className="py-2 flex items-start gap-3">
                            <input
                              type="checkbox"
                              className="mt-1.5"
                              checked={r.incluido}
                              onChange={(e) => setRows(prev => prev.map(x => x.actaEntregaItemId === r.actaEntregaItemId ? { ...x, incluido: e.target.checked } : x))}
                            />
                            <div className="flex-1 min-w-0">
                              <ItemRow item={r.item} mode="compact" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {facturaSeleccionada && (
            <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
              <h3 className="text-sm font-semibold text-tx mb-3">Datos de recepción</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>N° de acta físico</label>
                  <input {...form.register('numeroActaFisico')} className={`${inputBase} font-mono`} placeholder="Documento en papel (opcional)" />
                </div>
                <div>
                  <label className={labelCls}>Hora de recepción</label>
                  <input type="time" {...form.register('horaRecepcion')} className={`${inputBase} font-mono`} />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {step === 1 && (
        <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
          <h3 className="text-sm font-semibold text-tx mb-3">Inspección de ítems ({itemsIncluidos})</h3>
          {rows.filter(r => r.incluido).length === 0 ? (
            <EmptyState icon="package" title="Sin ítems marcados" message="Volvé al paso anterior y marcá al menos un ítem." />
          ) : (
            <div className="space-y-3">
              {rows.filter(r => r.incluido).map((r) => {
                const empeoro = r.item.condicionSalida != null && COND_RANK[r.condicionRetorno] > COND_RANK[r.item.condicionSalida];
                const esEquipo = !!r.item.equipo;
                const esConsumible = !!r.item.consumible;
                const pendiente = esConsumible
                  ? (r.item.cantidadConsumible ?? 0) - (r.item.cantidadRecibida ?? 0)
                  : 0;
                const cantDevVal = r.cantidadDevuelta !== '' ? Number(r.cantidadDevuelta) : pendiente;
                const vuelveInventario = esConsumible ? cantDevVal : 0;
                const quedaConsumido = esConsumible ? pendiente - cantDevVal : 0;
                const cantExcede = esConsumible && r.cantidadDevuelta !== '' && (
                  !Number.isInteger(Number(r.cantidadDevuelta)) ||
                  Number(r.cantidadDevuelta) < 0 ||
                  Number(r.cantidadDevuelta) > pendiente
                );
                const info = describirItem(r.item);
                return (
                  <div key={r.actaEntregaItemId} className={`rounded-md border p-3 ${empeoro ? 'border-warn bg-warn-soft/30' : 'border-bd bg-surface'}`}>
                    <div className="flex justify-between items-start gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{info.titulo}</div>
                        <div className="text-xs text-tx-3 font-mono">{info.codigo ?? ''}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xs text-tx-3 uppercase tracking-wide mb-0.5">Salida</div>
                        <CondicionBadge condicion={r.item.condicionSalida} />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-2">
                      <div>
                        <label className={labelCls}>Cond. retorno <span className="text-danger">*</span></label>
                        <CondicionSelect
                          value={r.condicionRetorno}
                          onChange={(v) => setRows(prev => prev.map(x => x.actaEntregaItemId === r.actaEntregaItemId ? { ...x, condicionRetorno: v } : x))}
                        />
                      </div>
                      {esEquipo && (
                        <>
                          <div>
                            <label className={labelCls}>Horómetro</label>
                            <input
                              type="number"
                              step="0.1"
                              className={`${inputBase} font-mono`}
                              value={r.horometroRetorno}
                              onChange={(e) => setRows(prev => prev.map(x => x.actaEntregaItemId === r.actaEntregaItemId ? { ...x, horometroRetorno: e.target.value } : x))}
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Combustible (%)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              className={`${inputBase} font-mono`}
                              value={r.combustibleRetorno}
                              onChange={(e) => setRows(prev => prev.map(x => x.actaEntregaItemId === r.actaEntregaItemId ? { ...x, combustibleRetorno: e.target.value } : x))}
                            />
                          </div>
                        </>
                      )}
                      <div className={esEquipo ? 'sm:col-span-3' : 'sm:col-span-2'}>
                        <label className={labelCls}>Observaciones</label>
                        <input
                          className={inputBase}
                          value={r.observacionesRetorno}
                          onChange={(e) => setRows(prev => prev.map(x => x.actaEntregaItemId === r.actaEntregaItemId ? { ...x, observacionesRetorno: e.target.value } : x))}
                          placeholder="Rayones, daños, faltantes…"
                        />
                      </div>
                    </div>
                    {/* Controles de devolución parcial — solo para consumibles */}
                    {esConsumible && (
                      <div className="mt-3 pt-3 border-t border-bd space-y-2">
                        <div className="text-xs text-tx-2 font-medium">
                          Saldo pendiente: <span className="font-semibold text-tx">{pendiente}</span> {r.item.consumible?.nombre}
                        </div>
                        <div className="grid sm:grid-cols-2 gap-2">
                          <div>
                            <label className={labelCls}>Cantidad a devolver (vacío = todo el pendiente)</label>
                            <input
                              type="number"
                              min="0"
                              max={pendiente}
                              step="1"
                              className={`${inputBase} font-mono ${cantExcede ? 'border-danger' : ''}`}
                              value={r.cantidadDevuelta}
                              placeholder={String(pendiente)}
                              onChange={(e) => setRows(prev => prev.map(x => x.actaEntregaItemId === r.actaEntregaItemId ? { ...x, cantidadDevuelta: e.target.value } : x))}
                            />
                            {cantExcede && (
                              <p className="text-xs text-danger mt-1">
                                Debe ser un entero entre 0 y {pendiente}.
                              </p>
                            )}
                          </div>
                          <div className="flex items-end pb-2">
                            <label className="flex items-center gap-2 cursor-pointer text-sm text-tx">
                              <input
                                type="checkbox"
                                checked={r.cerrar}
                                onChange={(e) => setRows(prev => prev.map(x => x.actaEntregaItemId === r.actaEntregaItemId ? { ...x, cerrar: e.target.checked } : x))}
                              />
                              Dar por consumido el resto y cerrar el ítem
                            </label>
                          </div>
                        </div>
                        {r.cantidadDevuelta !== '' && !cantExcede && (
                          <div className="text-xs text-tx-2">
                            Vuelve a inventario: <span className="font-semibold text-ok">{vuelveInventario}</span>
                            {' · '}
                            Queda consumido: <span className="font-semibold text-tx">{quedaConsumido}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {empeoro && (
                      <div className="mt-2 text-xs text-warn flex items-center gap-1.5">
                        <Icon name="alertTriangle" size={12} /> Condición peor a la salida — documentá el daño en observaciones.
                      </div>
                    )}
                  </div>
                );
              })}
              <div>
                <label className={labelCls}>Observaciones generales</label>
                <textarea {...form.register('observaciones')} rows={3} className={inputBase} placeholder="Comentario global sobre la recepción." />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-3 py-1.5 text-sm rounded-md border border-bd text-tx hover:bg-bg-sunken transition-colors"
        >
          Cancelar
        </button>
        {step === 1 && (
          <button
            type="button"
            onClick={() => setStep(0)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd bg-surface text-tx text-xs font-semibold hover:bg-bg-sunken transition-colors"
          >
            <Icon name="arrowLeft" size={14} /> Volver
          </button>
        )}
        {step === 0 && (
          <button
            type="button"
            disabled={!canAdvance}
            onClick={() => setStep(1)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60"
          >
            Siguiente <span className="rotate-180 inline-flex"><Icon name="arrowLeft" size={14} /></span>
          </button>
        )}
        {step === 1 && (
          <button
            type="submit"
            disabled={crear.isPending || itemsIncluidos === 0 || hayExceso}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60"
          >
            <Icon name="check" size={14} /> {crear.isPending ? 'Registrando…' : 'Registrar recepción'}
          </button>
        )}
      </div>

      {itemsError && (
        <div className="text-xs text-danger mt-2 text-right">{itemsError}</div>
      )}
      {backendError && (
        <div className="text-xs text-danger mt-2 text-right">{backendError}</div>
      )}
    </form>
  );
}
