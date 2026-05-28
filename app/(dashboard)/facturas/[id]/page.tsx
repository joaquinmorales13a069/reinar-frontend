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
import { ItemsFacturadosCard } from '@/components/facturas/detalle/ItemsFacturadosCard';
import { PagosCard } from '@/components/facturas/detalle/PagosCard';
import { ProgresoCobroCard } from '@/components/facturas/detalle/ProgresoCobroCard';
import { ActasVinculadasCard } from '@/components/facturas/detalle/ActasVinculadasCard';
import { AjustarEstadoCard } from '@/components/facturas/detalle/AjustarEstadoCard';
import { HeaderAcciones } from '@/components/facturas/detalle/HeaderAcciones';
import { DteSection } from '@/components/dte/DteSection';
import {
  useFactura,
  useEmitirDTE,
  useSincronizarDTE,
  descargarFacturaPdfOficialDTE,
} from '@/hooks/use-facturas';
import { useAuthStore } from '@/stores/auth.store';
import type { TipoDTE } from '@/types/api';

export default function FacturaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: factura, isLoading, error } = useFactura(id);
  const emitirDTE = useEmitirDTE();
  const sincronizarDTE = useSincronizarDTE();
  // El error inline del DteSection viene de emitir DTE (400 = cliente sin
  // NCR/direccion). Lo mantenemos en estado local porque el hook ya manda
  // toast como respaldo.
  const [emitirError, setEmitirError] = useState<string | null>(null);
  const [descargandoPdfDte, setDescargandoPdfDte] = useState(false);
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

  // Subtitle: nombre del cliente segun tipo (EMPRESA -> razonSocial, PARTICULAR -> nombre+apellido).
  const nombreCliente =
    factura.cliente.tipo === 'EMPRESA'
      ? factura.cliente.razonSocial ?? '—'
      : [factura.cliente.nombre, factura.cliente.apellido].filter(Boolean).join(' ') || '—';

  async function emitirCon(tipo: TipoDTE) {
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

  return (
    <div>
      <PageHeader
        title={factura.numeroFactura}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span>{nombreCliente}</span>
            <span className="text-tx-3">·</span>
            <FacturaEstadoBadge estado={factura.estado} />
          </span>
        }
        back
        backLabel="Facturas"
        onBack={() => router.push('/facturas')}
        actions={
          <>
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
            onEmitir={() => { if (factura.tipoDTE) void emitirCon(factura.tipoDTE); }}
            onReemitir={() => { if (factura.tipoDTE) void emitirCon(factura.tipoDTE); }}
            onSincronizar={() => { void sincronizarDTE.mutateAsync(id); }}
            onAnular={() => router.push(`/facturas/${id}/anular-dte`)}
            onDescargarPdf={() => { void descargarPdfOficial(); }}
          />
          <ItemsFacturadosCard factura={factura} />
          <PagosCard factura={factura} isOperador={isOperador} isAdminOGerente={isAdminOGerente} />
          <ActasVinculadasCard factura={factura} puedeEscribir={!!puedeEscribir} />
        </div>
        <div className="space-y-4">
          <ProgresoCobroCard factura={factura} />
        </div>
      </div>
    </div>
  );
}
