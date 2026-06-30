'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useDescargarPickingPdf } from '@/hooks/use-actas';
import { useAuthStore } from '@/stores/auth.store';
import { RenovarRentaModal } from './RenovarRentaModal';
import type { Acta } from '@/types/api';

// Panel de acción contextual que cambia según el estado del acta.
// El flujo operativo es: crear → picking físico → capturar inspección →
// despachar → confirmar entrega → recepción.
export function ActaPanelAccionContextual({ acta, onIrRecepcion }: { acta: Acta; onIrRecepcion?: () => void }) {
  const user = useAuthStore((s) => s.user);
  const puedeEscribir = user && user.rol !== 'VISUALIZADOR';
  const picking = useDescargarPickingPdf();
  const [renovarOpen, setRenovarOpen] = useState(false);

  // Inspección incompleta si algún ítem no tiene condicionSalida. El backend
  // bloquea el despacho en ese caso; reflejamos la misma regla en la UI para
  // que el botón "Registrar despacho" quede deshabilitado con explicación.
  const inspeccionCompleta = acta.items.every((i) => !!i.condicionSalida);

  if (acta.estado === 'PENDIENTE') {
    return (
      <div className="rounded-md border border-info-soft bg-info-soft/40 border-l-4 border-l-info p-4 mb-4">
        <div className="flex items-start gap-3">
          <Icon name="send" size={20} />
          <div className="flex-1">
            <div className="text-sm text-tx">
              El acta está creada y pendiente de despacho. Flujo: <b>imprimí la lista de picking</b> →
              cuadrilla verifica físicamente y anota horómetro/combustible →{' '}
              <b>capturá esos datos en el sistema</b> → registrá el despacho con el folio físico Reinar.
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={picking.isLoading}
                onClick={() => picking.descargar(acta.id, acta.numeroActa)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd bg-surface text-tx text-xs font-semibold hover:bg-bg-sunken transition-colors disabled:opacity-60"
              >
                <Icon name="clipboard" size={14} /> {picking.isLoading ? 'Generando…' : 'Imprimir picking'}
              </button>
              {puedeEscribir && (
                <Link
                  href={`/actas/${acta.id}/inspeccion`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd bg-surface text-tx text-xs font-semibold hover:bg-bg-sunken transition-colors"
                >
                  <Icon name="edit" size={14} /> Capturar datos del picking
                </Link>
              )}
              {puedeEscribir && (
                inspeccionCompleta ? (
                  <Link
                    href={`/actas/${acta.id}/despacho`}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors"
                  >
                    <Icon name="send" size={14} /> Registrar despacho
                  </Link>
                ) : (
                  <span
                    title="Capturá la condición de salida de todos los ítems antes de despachar."
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold opacity-50 cursor-not-allowed"
                  >
                    <Icon name="send" size={14} /> Registrar despacho
                  </span>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (acta.estado === 'DESPACHADO') {
    return (
      <div className="rounded-md border border-accent-soft bg-accent-soft/40 border-l-4 border-l-accent p-4 mb-4">
        <div className="flex items-start gap-3">
          <Icon name="package" size={20} />
          <div className="flex-1">
            <div className="text-sm text-tx">El equipo salió de bodega. Pendiente confirmar entrega en sitio.</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {puedeEscribir && (
                <Link href={`/actas/${acta.id}/entrega`} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors">
                  <Icon name="check" size={14} /> Confirmar entrega al cliente
                </Link>
              )}
              {puedeEscribir && (
                <Link
                  href={`/actas/${acta.id}/inspeccion`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd bg-surface text-tx text-xs font-semibold hover:bg-bg-sunken transition-colors"
                >
                  <Icon name="edit" size={14} /> Editar inspección
                </Link>
              )}
              <button
                type="button"
                disabled={picking.isLoading}
                onClick={() => picking.descargar(acta.id, acta.numeroActa)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd bg-surface text-tx text-xs font-semibold hover:bg-bg-sunken transition-colors disabled:opacity-60"
              >
                <Icon name="clipboard" size={14} /> {picking.isLoading ? 'Generando…' : 'Reimprimir picking'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (acta.estado === 'ENTREGADO' || acta.estado === 'DEVUELTA_PARCIAL') {
    return (
      <div className="rounded-md border border-ok-soft bg-ok-soft/40 border-l-4 border-l-ok p-4 mb-4">
        <div className="flex items-start gap-3">
          <Icon name="check" size={20} />
          <div className="flex-1">
            <div className="text-sm text-tx">
              {acta.estado === 'ENTREGADO'
                ? 'El equipo fue entregado. Pendiente de devolución por parte del cliente.'
                : 'Devolución parcial. Quedan ítems pendientes de retorno.'}
            </div>
            {puedeEscribir && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/recepciones/nueva?facturaId=${acta.facturaId}&actaId=${acta.id}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors"
                  onClick={onIrRecepcion}
                >
                  <Icon name="package" size={14} /> Registrar devolución
                </Link>
                <button
                  type="button"
                  onClick={() => setRenovarOpen(true)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 text-xs font-semibold hover:bg-bg-sunken transition-colors"
                >
                  <Icon name="refresh" size={14} /> Renovar renta
                </button>
              </div>
            )}
            {renovarOpen && <RenovarRentaModal acta={acta} onClose={() => setRenovarOpen(false)} />}
          </div>
        </div>
      </div>
    );
  }

  // DEVUELTO
  return (
    <div className="rounded-md border border-bd bg-bg-sunken border-l-4 border-l-tx-3 p-4 mb-4">
      <div className="flex items-start gap-3">
        <Icon name="check" size={20} />
        <div className="text-sm text-tx-2">Ciclo completado. El equipo fue devuelto y recibido.</div>
      </div>
    </div>
  );
}
