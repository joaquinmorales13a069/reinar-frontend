'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { FacturaEstadoBadge } from '@/components/facturas/FacturaEstadoBadge';
import { ClienteFechasCard } from '@/components/facturas/detalle/ClienteFechasCard';
import { ObservacionesCard } from '@/components/facturas/detalle/ObservacionesCard';
import { EntregaQuedanCard } from '@/components/facturas/detalle/EntregaQuedanCard';
import { ItemsFacturadosCard } from '@/components/facturas/detalle/ItemsFacturadosCard';
import { PagosCard } from '@/components/facturas/detalle/PagosCard';
import { ProgresoCobroCard } from '@/components/facturas/detalle/ProgresoCobroCard';
import { ActasVinculadasCard } from '@/components/facturas/detalle/ActasVinculadasCard';
import { PeriodoFacturaCard } from '@/components/facturas/detalle/PeriodoFacturaCard';
import { ActaFisicaCard } from '@/components/facturas/detalle/ActaFisicaCard';
import { AjustarEstadoCard } from '@/components/facturas/detalle/AjustarEstadoCard';
import { HeaderAcciones } from '@/components/facturas/detalle/HeaderAcciones';
import { DteSection } from '@/components/dte/DteSection';
import {
  useFactura,
  useEmitirDTE,
  useSincronizarDTE,
  useEnviarDTEPorEmail,
  useAnularDTESoloDTE,
  descargarFacturaPdfOficialDTE,
  descargarFacturaPdfBranded,
  descargarFacturaJsonDTE,
} from '@/hooks/use-facturas';
import { useAuthStore } from '@/stores/auth.store';
// Alias para no chocar con el const local `nombreCliente` usado en el JSX.
import { nombreCliente as nombreClienteDe } from '@/lib/utils';
import type { TipoDTEEmitible } from '@/types/api';

export default function FacturaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: factura, isLoading, error } = useFactura(id);
  const emitirDTE = useEmitirDTE();
  const sincronizarDTE = useSincronizarDTE();
  const enviarDTE = useEnviarDTEPorEmail(id);
  // El error inline del DteSection viene de emitir DTE (400 = cliente sin
  // NCR/direccion). Lo mantenemos en estado local porque el hook ya manda
  // toast como respaldo.
  const [emitirError, setEmitirError] = useState<string | null>(null);
  const [descargandoPdfDte, setDescargandoPdfDte] = useState(false);
  const [descargandoJsonDte, setDescargandoJsonDte] = useState(false);
  const [anularError, setAnularError] = useState<string | null>(null);
  const anularSoloDTE = useAnularDTESoloDTE(id);
  const [ajusteOpen, setAjusteOpen] = useState(false);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error) {
    return (
      <EmptyState
        icon="fileText"
        title="No se pudo cargar"
        message="Hubo un problema al cargar la factura. Refrescá la página para reintentar."
      />
    );
  }
  if (!factura) {
    return <EmptyState icon="fileText" title="No encontrada" message="La factura no existe." />;
  }

  const isAdmin = user?.rol === 'ADMIN';
  // OPERADOR+ = puede emitir DTE, asignar tipo, registrar pagos. VISUALIZADOR no.
  const isOperador = user?.rol === 'ADMIN' || user?.rol === 'GERENTE' || user?.rol === 'OPERADOR';
  // Eliminar pagos es accion reversible solo para ADMIN/GERENTE — OPERADOR no.
  const isAdminOGerente = user?.rol === 'ADMIN' || user?.rol === 'GERENTE';
  // VISUALIZADOR no puede crear ni modificar registros.
  const puedeEscribir = user && user.rol !== 'VISUALIZADOR';
  // Sin período de renta el backend rechaza la emisión (422) — bloqueamos antes.
  const faltaPeriodo = !factura.periodoRentaInicio || !factura.periodoRentaFin;
  // FEX (fase 1) y SUJETO_EXCLUIDO histórico no se emiten desde ventas.
  const emisionBloqueada = factura.tipoDTE === 'SUJETO_EXCLUIDO' || factura.tipoDTE === 'FEX';

  // Subtitle: nombre del cliente vía el helper canónico (tipo-aware: EMPRESA ->
  // razonSocial, PARTICULAR -> nombre+apellido, INTERNACIONAL -> razonSocial o
  // nombre+apellido), para no divergir de como lo muestra ClienteFechasCard.
  const nombreCliente = nombreClienteDe(factura.cliente);

  async function emitirCon(tipo: TipoDTEEmitible) {
    setEmitirError(null);
    try {
      await emitirDTE.mutateAsync({ id, data: { tipoDTE: tipo } });
    } catch (err) {
      const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
      setEmitirError(anyErr?.response?.data?.error?.message ?? null);
    }
  }

  async function descargarPdfOficial() {
    setDescargandoPdfDte(true);
    try {
      await descargarFacturaPdfOficialDTE(id, factura!.numeroFactura);
    } finally {
      setDescargandoPdfDte(false);
    }
  }

  async function descargarJsonOficial() {
    setDescargandoJsonDte(true);
    try {
      await descargarFacturaJsonDTE(id, factura!.numeroFactura);
    } finally {
      setDescargandoJsonDte(false);
    }
  }

  async function anularParaCambiarTipo(motivo: string) {
    setAnularError(null);
    try {
      await anularSoloDTE.mutateAsync({ motivo });
    } catch (err) {
      const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
      setAnularError(anyErr?.response?.data?.error?.message ?? 'No se pudo anular el DTE.');
    }
  }

  return (
    <div>
      <PageHeader
        title={factura.numeroFactura}
        subtitle={
          <span className="inline-flex items-center gap-2 flex-wrap">
            <span>{nombreCliente}</span>
            <span className="text-tx-3">·</span>
            <FacturaEstadoBadge estado={factura.estado} />
            {factura.cotizacion?.actaEntregaOrigen && (
              <Link
                href={`/actas/${factura.cotizacion.actaEntregaOrigen.id}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent-soft text-accent text-xs font-medium hover:underline"
              >
                <Icon name="refresh" size={11} /> Renovación de {factura.cotizacion.actaEntregaOrigen.numeroActa}
              </Link>
            )}
          </span>
        }
        back
        backLabel="Facturas"
        onBack={() => router.push('/facturas')}
        actions={
          <>
            {/* Descarga del PDF de sistema (branded), que sí incluye el período de
                renta — a diferencia del PDF oficial del DTE. Vía /facturas/:id/pdf
                (no permitido a VISUALIZADOR). */}
            {puedeEscribir && (
              <button
                type="button"
                onClick={() => { void descargarFacturaPdfBranded(factura.id, factura.numeroFactura); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-bd text-tx-2 hover:bg-bg-sunken"
              >
                <Icon name="download" size={14} /> Descargar factura
              </button>
            )}
            {/* Crear NC requiere factura PAGADA/PARCIAL con DTE APROBADO — backend rechaza lo contrario */}
            {puedeEscribir &&
              factura.estadoDTE === 'APROBADO' &&
              (factura.estado === 'PAGADA' || factura.estado === 'PARCIAL') && (
                <Link
                  href={`/notas-credito/nueva?facturaId=${factura.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-bd text-tx-2 hover:bg-bg-sunken"
                >
                  <Icon name="fileText" size={14} /> Crear nota de crédito
                </Link>
              )}
            {/* Retención solo si la factura no está anulada */}
            {puedeEscribir && factura.estado !== 'ANULADA' && (
              <Link
                href={`/retenciones/nueva?facturaId=${factura.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-bd text-tx-2 hover:bg-bg-sunken"
              >
                <Icon name="fileText" size={14} /> Registrar retención
              </Link>
            )}
            <HeaderAcciones
              factura={factura}
              isAdminOGerente={isAdminOGerente}
              ajusteOpen={ajusteOpen}
              onToggleAjuste={() => setAjusteOpen((o) => !o)}
            />
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          {ajusteOpen && isAdminOGerente && (
            <AjustarEstadoCard factura={factura} onClose={() => setAjusteOpen(false)} />
          )}
          <ClienteFechasCard factura={factura} />
          <ObservacionesCard factura={factura} puedeEscribir={!!puedeEscribir} />
          {factura.esQuedan && (
            <EntregaQuedanCard factura={factura} puedeEscribir={!!puedeEscribir} />
          )}
          <DteSection
            doc={factura}
            kind="factura"
            cliente={factura.cliente}
            isAdmin={isAdmin}
            isOperador={isOperador}
            emitirError={emitirError}
            isEmitiendo={emitirDTE.isPending}
            isSincronizando={sincronizarDTE.isPending}
            isDescargandoPdf={descargandoPdfDte}
            onAsignarTipo={(t) => { void emitirCon(t); }}
            // Históricos con tipoDTE SUJETO_EXCLUIDO (FSE) y FEX (fase 1) no se
            // pueden (re)emitir desde ventas — el backend tampoco lo acepta.
            onEmitir={() => {
              if (factura.tipoDTE && !emisionBloqueada) void emitirCon(factura.tipoDTE as TipoDTEEmitible);
            }}
            onReemitir={() => {
              if (factura.tipoDTE && !emisionBloqueada) void emitirCon(factura.tipoDTE as TipoDTEEmitible);
            }}
            emisionBloqueada={emisionBloqueada}
            faltaPeriodo={faltaPeriodo}
            onSincronizar={() => { void sincronizarDTE.mutateAsync(id); }}
            onAnular={() => router.push(`/facturas/${id}/anular-dte`)}
            onAnularSoloDTE={(motivo) => { void anularParaCambiarTipo(motivo); }}
            isAnulandoSoloDTE={anularSoloDTE.isPending}
            anularError={anularError}
            onDescargarPdf={() => { void descargarPdfOficial(); }}
            onDescargarJson={() => { void descargarJsonOficial(); }}
            isDescargandoJson={descargandoJsonDte}
            onEnviarEmail={async (email) => { await enviarDTE.mutateAsync({ email }); }}
            isEnviandoEmail={enviarDTE.isPending}
          />
          <ItemsFacturadosCard factura={factura} />
          <PagosCard factura={factura} isOperador={isOperador} isAdminOGerente={isAdminOGerente} />
        </div>
        <div className="space-y-4">
          <ProgresoCobroCard factura={factura} />
          <PeriodoFacturaCard factura={factura} />
          <ActaFisicaCard factura={factura} />
          <ActasVinculadasCard factura={factura} puedeEscribir={!!puedeEscribir} />
        </div>
      </div>
    </div>
  );
}
