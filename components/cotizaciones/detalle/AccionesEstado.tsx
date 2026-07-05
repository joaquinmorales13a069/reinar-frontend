'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { GenerarFacturaModal } from '@/components/cotizaciones/GenerarFacturaModal';
import {
  descargarCotizacionPdf,
  useCambiarEstadoCotizacion,
  useEliminarCotizacion,
} from '@/hooks/use-cotizaciones';
import { useAuthStore } from '@/stores/auth.store';
import type { Cotizacion } from '@/types/api';

type Confirm = null | 'eliminar' | 'enviar' | 'aprobar' | 'rechazar';

export function AccionesEstado({ cotizacion }: { cotizacion: Cotizacion }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [showGenerar, setShowGenerar] = useState(false);
  const [conflicto, setConflicto] = useState<string | null>(null);
  const cambiar = useCambiarEstadoCotizacion();
  const eliminar = useEliminarCotizacion();
  const user = useAuthStore((s) => s.user);
  const puedeEscribir = !!user && user.rol !== 'VISUALIZADOR';

  const btnBase =
    'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors';

  async function aplicar(estado: 'ENVIADA' | 'APROBADA' | 'RECHAZADA') {
    setConflicto(null);
    try {
      await cambiar.mutateAsync({ id: cotizacion.id, estado });
      setConfirm(null);
    } catch (err) {
      // El toast lo maneja el hook. Para conflictos de disponibilidad al aprobar
      // mostramos además un detalle inline accionable (qué ítems faltan).
      const e = err as { response?: { data?: { error?: { code?: string; message?: string } } } };
      if (e?.response?.data?.error?.code === 'CONFLICTO_DISPONIBILIDAD') {
        setConflicto(e.response.data.error.message ?? 'Inventario no disponible para aprobar.');
      }
      // Dejamos el ConfirmRow abierto para reintentar.
    }
  }

  async function quitar() {
    await eliminar.mutateAsync(cotizacion.id);
    router.push('/cotizaciones');
  }

  // Botones contextuales según estado: el backend bloquea cualquier transición
  // no listada en TRANSICIONES_VALIDAS, así que la UI solo expone las posibles.
  let botones: React.ReactNode = null;
  if (cotizacion.estado === 'BORRADOR') {
    botones = (
      <>
        <Link href={`/cotizaciones/${cotizacion.id}/editar`} className={`${btnBase} border border-bd text-tx-2 hover:bg-bg-sunken`}>
          <Icon name="edit" size={14} /> Editar
        </Link>
        <button type="button" className={`${btnBase} border border-bd text-danger hover:bg-danger-soft`} onClick={() => setConfirm('eliminar')}>
          <Icon name="trash" size={14} /> Eliminar
        </button>
        <button type="button" className={`${btnBase} bg-accent text-navy hover:bg-accent-dim`} onClick={() => setConfirm('enviar')}>
          <Icon name="send" size={14} /> Marcar como enviada
        </button>
      </>
    );
  } else if (cotizacion.estado === 'ENVIADA') {
    botones = (
      <>
        <button type="button" className={`${btnBase} border border-bd text-danger hover:bg-danger-soft`} onClick={() => setConfirm('rechazar')}>
          <Icon name="x" size={14} /> Rechazar
        </button>
        <button type="button" className={`${btnBase} bg-accent text-navy hover:bg-accent-dim`} onClick={() => setConfirm('aprobar')}>
          <Icon name="check" size={14} /> Aprobar
        </button>
      </>
    );
  } else if (cotizacion.estado === 'APROBADA' && cotizacion.factura) {
    botones = (
      <Link href={`/facturas/${cotizacion.factura.id}`} className={`${btnBase} border border-bd text-tx-2 hover:bg-bg-sunken`}>
        <Icon name="receipt" size={14} /> Ver factura {cotizacion.factura.numeroFactura}
      </Link>
    );
  } else if (cotizacion.estado === 'APROBADA' && !cotizacion.factura) {
    // Cotizacion aprobada sin factura: el usuario decide cuando generarla
    // (puede haber rentas pendientes de despachar antes de facturar).
    botones = (
      <button
        type="button"
        className={`${btnBase} bg-accent text-navy hover:bg-accent-dim`}
        onClick={() => setShowGenerar(true)}
      >
        <Icon name="receipt" size={14} /> Generar factura
      </button>
    );
  } else if (cotizacion.estado === 'CANCELADA' && cotizacion.factura) {
    // Mantenemos el link a la factura (ahora ANULADA) para trazabilidad: el
    // usuario debe poder llegar al documento que disparo la cancelacion.
    botones = (
      <Link href={`/facturas/${cotizacion.factura.id}`} className={`${btnBase} border border-bd text-tx-2 hover:bg-bg-sunken`}>
        <Icon name="receipt" size={14} /> Ver factura anulada {cotizacion.factura.numeroFactura}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`${btnBase} border border-bd text-tx-2 hover:bg-bg-sunken`}
        onClick={() => void descargarCotizacionPdf(cotizacion.id, cotizacion.numeroCotizacion)}
      >
        <Icon name="download" size={14} /> PDF
      </button>
      {/* Cotización aprobada: el despacho puede arrancar aunque aún no exista
          factura (flujo cotización-first) — se ofrece junto al link/botón de
          factura, no en su lugar. */}
      {cotizacion.estado === 'APROBADA' && puedeEscribir && (
        <button
          type="button"
          className={`${btnBase} border border-bd text-tx-2 hover:bg-bg-sunken`}
          onClick={() => router.push(`/actas/nueva?cotizacionId=${cotizacion.id}`)}
        >
          <Icon name="package" size={14} /> Crear acta de entrega
        </button>
      )}
      {botones}

      {conflicto && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-50 rounded-lg border border-danger-soft bg-danger-soft p-3 shadow-xl">
          <div className="flex items-start gap-2">
            <span className="text-danger mt-0.5 shrink-0"><Icon name="x" size={16} /></span>
            <div className="text-sm text-tx">
              <p className="font-medium">No se pudo aprobar</p>
              <p className="text-xs mt-0.5 text-tx-2">{conflicto}</p>
            </div>
            <button type="button" className="ml-auto text-tx-3 hover:text-tx" onClick={() => setConflicto(null)}>
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ConfirmRow flotante en la esquina inferior — fuera del flujo del header
          para no romper el layout del PageHeader.actions. */}
      {confirm && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-40 shadow-xl">
          {confirm === 'eliminar' && (
            <ConfirmRow
              message={`Eliminar el borrador ${cotizacion.numeroCotizacion}?`}
              confirmLabel="Eliminar"
              onCancel={() => setConfirm(null)}
              onConfirm={quitar}
            />
          )}
          {confirm === 'enviar' && (
            <ConfirmRow
              message="Marcar como enviada al cliente? No podrás editar más ítems."
              confirmLabel="Marcar enviada"
              variant="primary"
              onCancel={() => setConfirm(null)}
              onConfirm={() => aplicar('ENVIADA')}
            />
          )}
          {confirm === 'aprobar' && (
            <ConfirmRow
              message="Aprobar la cotización? Se rentean los equipos disponibles."
              confirmLabel="Aprobar"
              variant="primary"
              onCancel={() => setConfirm(null)}
              onConfirm={() => aplicar('APROBADA')}
            />
          )}
          {confirm === 'rechazar' && (
            <ConfirmRow
              message="Rechazar la cotización? No se podrá reabrir."
              confirmLabel="Rechazar"
              onCancel={() => setConfirm(null)}
              onConfirm={() => aplicar('RECHAZADA')}
            />
          )}
        </div>
      )}

      {showGenerar && (
        <GenerarFacturaModal
          cotizacionId={cotizacion.id}
          cliente={{
            id: cotizacion.cliente.id,
            tipo: cotizacion.cliente.tipo,
            razonSocial: cotizacion.cliente.razonSocial,
            nombre: cotizacion.cliente.nombre,
            apellido: cotizacion.cliente.apellido,
            manejaQuedan: cotizacion.cliente.manejaQuedan,
            diasRecepcionQuedan: cotizacion.cliente.diasRecepcionQuedan,
          }}
          // No tenemos info de actas en el detalle de cotizacion (la relacion
          // vive a traves de la factura, que aun no existe). Pasamos true para
          // ocultar el banner — el flujo de despacho/devolucion se ve en el
          // modulo de actas.
          actasTodasDevueltas={true}
          onClose={() => setShowGenerar(false)}
        />
      )}
    </>
  );
}
