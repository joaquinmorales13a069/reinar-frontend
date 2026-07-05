'use client';

import { use } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { EstadoActaTimeline } from '@/components/actas-recepciones/EstadoActaTimeline';
import { ItemRow } from '@/components/actas-recepciones/ItemRow';
import { ActaPanelAccionContextual } from '@/components/actas/ActaPanelAccionContextual';
import { CorreccionesAyuda } from '@/components/actas/CorreccionesAyuda';
import { useActa, useDescargarActaPdf } from '@/hooks/use-actas';
import { useActasRealtime } from '@/hooks/use-actas-realtime';
import { formatDate, nombreCliente } from '@/lib/utils';

export default function ActaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  useActasRealtime();
  const { data: acta, isLoading } = useActa(id);
  const pdf = useDescargarActaPdf();

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }
  if (!acta) {
    return <EmptyState icon="clipboard" title="Acta no encontrada" message="La acta no existe o fue eliminada." />;
  }

  // PDF disponible solo desde ENTREGADO. Antes el documento no tiene firma del
  // receptor ni folio físico definitivo — descargarlo prematuramente generaría
  // copias en circulación con datos incompletos.
  const pdfDisponible =
    acta.estado === 'ENTREGADO' || acta.estado === 'DEVUELTA_PARCIAL' || acta.estado === 'DEVUELTO';
  // Datos congelados: mostramos panel de ayuda con procedimientos de corrección.
  const datosCongelados = pdfDisponible;

  return (
    <div>
      <PageHeader
        title={acta.numeroActa}
        subtitle={<><Badge status={acta.estado} /></>}
        back
        backLabel="Actas"
        actions={
          pdfDisponible ? (
            <button
              type="button"
              disabled={pdf.isLoading}
              onClick={() => pdf.descargar(acta.id, acta.numeroActa)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd bg-surface text-tx text-xs font-semibold hover:bg-bg-sunken transition-colors disabled:opacity-60"
            >
              <Icon name="download" size={14} /> {pdf.isLoading ? 'Generando…' : 'Descargar PDF'}
            </button>
          ) : null
        }
      />

      <EstadoActaTimeline estado={acta.estado} fechas={{ fechaDespacho: acta.fechaDespacho, fechaEntrega: acta.fechaEntrega, fechaDevolucion: acta.fechaDevolucion }} />

      <ActaPanelAccionContextual acta={acta} />

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-bd bg-surface p-4">
          <h3 className="text-sm font-semibold text-tx mb-3">Ítems del acta ({acta.items.length})</h3>
          <div className="divide-y divide-bd">
            {/* mode="view" ya renderiza "Salida + CondicionBadge" internamente,
                así que NO pasamos rightSlot acá para evitar duplicar la columna. */}
            {acta.items.map((it) => (
              <ItemRow key={it.id} item={it} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-bd bg-surface p-4">
            <h3 className="text-sm font-semibold text-tx mb-3">Datos generales</h3>
            <dl className="text-sm space-y-1.5">
              {/* El endpoint de detalle solo incluye cliente vía cotización (no en
                  factura) — sigue disponible aunque el acta no tenga factura aún. */}
              <div className="flex justify-between gap-2"><dt className="text-tx-3">Cliente</dt><dd>{nombreCliente(acta.cotizacion.cliente)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-tx-3">Cotización</dt><dd><Link href={`/cotizaciones/${acta.cotizacion.id}`} className="font-mono text-accent hover:underline">{acta.cotizacion.numeroCotizacion}</Link></dd></div>
              <div className="flex justify-between gap-2"><dt className="text-tx-3">Factura</dt><dd>{acta.factura ? (<Link href={`/facturas/${acta.factura.id}`} className="font-mono text-accent hover:underline">{acta.factura.numeroFactura}</Link>) : (<span className="text-tx-3">Aún sin factura</span>)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-tx-3">Bodega origen</dt><dd>{acta.bodegaOrigen.nombre}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-tx-3">Dirección entrega</dt><dd className="truncate max-w-xs text-right">{acta.direccionEntrega || '—'}</dd></div>
              {(acta.periodoRentaInicio || acta.periodoRentaFin) && (
                <div className="flex justify-between gap-2"><dt className="text-tx-3">Período renta</dt><dd className="font-mono text-xs">{acta.periodoRentaInicio ? formatDate(acta.periodoRentaInicio) : '—'} — {acta.periodoRentaFin ? formatDate(acta.periodoRentaFin) : '—'}</dd></div>
              )}
            </dl>
          </div>
          <div className="rounded-lg border border-bd bg-surface p-4">
            <h3 className="text-sm font-semibold text-tx mb-3">Receptor</h3>
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between gap-2"><dt className="text-tx-3">Nombre</dt><dd>{acta.receptorNombre || '—'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-tx-3">Documento</dt><dd className="font-mono">{acta.receptorDocumento || '—'}</dd></div>
            </dl>
          </div>
          <div className="rounded-lg border border-bd bg-surface p-4">
            <h3 className="text-sm font-semibold text-tx mb-3">Fechas</h3>
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between gap-2"><dt className="text-tx-3">Despacho</dt><dd className="font-mono text-xs">{acta.fechaDespacho ? formatDate(acta.fechaDespacho) : '—'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-tx-3">Entrega</dt><dd className="font-mono text-xs">{acta.fechaEntrega ? formatDate(acta.fechaEntrega) : '—'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-tx-3">Devolución</dt><dd className="font-mono text-xs">{acta.fechaDevolucion ? formatDate(acta.fechaDevolucion) : '—'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-tx-3">Despachado por</dt><dd>{acta.usuarioDespacho ? `${acta.usuarioDespacho.nombre} ${acta.usuarioDespacho.apellido}` : '—'}</dd></div>
            </dl>
          </div>
          {acta.notas && (
            <div className="rounded-lg border border-bd bg-surface p-4">
              <h3 className="text-sm font-semibold text-tx mb-2">Notas</h3>
              <p className="text-sm text-tx-2 whitespace-pre-line">{acta.notas}</p>
            </div>
          )}
          {acta.renovaciones && acta.renovaciones.length > 0 && (
            <div className="rounded-lg border border-bd bg-surface p-4">
              <h3 className="text-sm font-semibold text-tx mb-3">Renovaciones</h3>
              <ul className="space-y-2">
                {acta.renovaciones.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/cotizaciones/${r.id}`} className="font-mono text-accent hover:underline">{r.numeroCotizacion}</Link>
                    <span className="text-xs text-tx-3">{r.estado}{r.factura ? ` · ${r.factura.numeroFactura}` : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {datosCongelados && <CorreccionesAyuda />}
    </div>
  );
}
