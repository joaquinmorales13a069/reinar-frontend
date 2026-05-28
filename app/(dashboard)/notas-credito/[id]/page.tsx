'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { EstadoDteBadge } from '@/components/facturas/EstadoDteBadge';
import { DteSection } from '@/components/dte/DteSection';
import { MontosCard } from '@/components/notas-credito/MontosCard';
import { FacturaOrigenCard } from '@/components/notas-credito/FacturaOrigenCard';
import {
  useNotaCredito,
  useEmitirDTENotaCredito,
  sincronizarNotaCredito,
  descargarNotaCreditoPdfBranded,
  descargarNotaCreditoPdfOficialDTE,
} from '@/hooks/use-notas-credito';
import { useAuthStore } from '@/stores/auth.store';
import { formatDate } from '@/lib/utils';

export default function NotaCreditoDetallePage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const esAdmin = user?.rol === 'ADMIN';
  const puedeEscribir = ['ADMIN', 'GERENTE', 'OPERADOR'].includes(user?.rol ?? '');

  const { data: nc, isLoading, error } = useNotaCredito(id);
  const emitir = useEmitirDTENotaCredito();
  const [descargando, setDescargando] = useState(false);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error || !nc) {
    return <EmptyState icon="alertTriangle" title="Nota de crédito no encontrada" message="Revisá el enlace o volvé al listado." />;
  }

  // El cliente vive en factura.cliente — DteSection lo usa para validar
  // los campos que cada tipoDTE exige (NCR, documento de identidad, etc.).
  const cliente = nc.factura.cliente;

  // Mostramos solo el tipo de DTE que corresponde (siempre NC en este flujo).
  // DteSection ya sabe que kind="nota" implica NC.

  async function onEmitir() {
    try {
      await emitir.mutateAsync({ id, data: { tipoDTE: 'NC' } });
    } catch {
      // Toast manejado por el hook.
    }
  }

  async function onDescargarBranded() {
    setDescargando(true);
    // nc ya está garantizado por el guard anterior; los closures no lo estrechan
    await descargarNotaCreditoPdfBranded(nc!.id, nc!.numero);
    setDescargando(false);
  }

  async function onDescargarDTE() {
    setDescargando(true);
    await descargarNotaCreditoPdfOficialDTE(nc!.id, nc!.numero);
    setDescargando(false);
  }

  return (
    <div>
      <PageHeader
        title={nc.numero}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span>{cliente.razonSocial || `${cliente.nombre ?? ''} ${cliente.apellido ?? ''}`.trim()}</span>
            <span className="text-tx-3">·</span>
            <span className={`px-2 py-0.5 rounded text-xs ${
              nc.tipo === 'TOTAL' ? 'bg-danger-soft text-danger' : 'bg-warn-soft text-warn'
            }`}>{nc.tipo}</span>
            <EstadoDteBadge estado={nc.estadoDTE} />
          </span>
        }
        back
        onBack={() => router.push('/notas-credito')}
        actions={
          <button
            type="button"
            disabled={descargando}
            onClick={onDescargarBranded}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-bd text-tx-2 hover:bg-bg-sunken disabled:opacity-50"
          >
            <Icon name="download" size={14} /> Descargar PDF
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-md border border-bd p-4">
            <h3 className="text-sm font-semibold mb-2">Motivo</h3>
            <p className="text-sm text-tx-2 leading-relaxed">{nc.motivo}</p>
          </div>

          <DteSection
            doc={{
              id: nc.id,
              // DteSection usa tipoDTE; para NC mostramos como 'NC' simbolico.
              // El componente no lo renderiza como opcion porque kind="nota".
              tipoDTE: null,
              estadoDTE: nc.estadoDTE,
              dteId: nc.dteId,
              dteControlNumber: nc.dteControlNumber,
              dteRespuestaMH: nc.dteRespuestaMH,
            }}
            kind="nota"
            cliente={cliente}
            isAdmin={esAdmin}
            isOperador={puedeEscribir}
            isEmitiendo={emitir.isPending}
            isDescargandoPdf={descargando}
            onEmitir={onEmitir}
            onReemitir={onEmitir}
            onSincronizar={() => sincronizarNotaCredito(qc, id)}
            onAnular={esAdmin ? () => router.push(`/notas-credito/${id}/anular-dte`) : undefined}
            onDescargarPdf={nc.estadoDTE === 'APROBADO' ? onDescargarDTE : undefined}
          />

          <div className="rounded-md border border-bd p-4">
            <h3 className="text-sm font-semibold mb-3">Factura origen</h3>
            <FacturaOrigenCard
              factura={{
                id: nc.factura.id,
                numeroFactura: nc.factura.numeroFactura,
                total: nc.factura.total,
                // razonSocial/nombre/apellido son `string | undefined` en Cliente
                // pero FacturaOrigenCard espera `string | null` — coercemos.
                cliente: {
                  razonSocial: cliente.razonSocial ?? null,
                  nombre: cliente.nombre ?? null,
                  apellido: cliente.apellido ?? null,
                },
              }}
            />
          </div>

          <div className="rounded-md border border-bd p-4">
            <h3 className="text-sm font-semibold mb-3">Montos acreditados</h3>
            <MontosCard subtotal={nc.subtotal} montoIva={nc.montoIva} total={nc.total} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-md border border-bd p-4">
            <h3 className="text-sm font-semibold mb-3">Datos generales</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-tx-3">Tipo</dt>
                <dd>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    nc.tipo === 'TOTAL' ? 'bg-danger-soft text-danger' : 'bg-warn-soft text-warn'
                  }`}>{nc.tipo}</span>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-tx-3">Fecha</dt>
                <dd className="font-mono">{formatDate(nc.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-tx-3">N° control DTE</dt>
                <dd className="font-mono text-xs text-right">
                  {nc.dteControlNumber ?? <span className="text-tx-3">—</span>}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-tx-3">Cliente</dt>
                <dd>
                  <Link href={`/clientes/${cliente.id}`} className="hover:underline">
                    {cliente.razonSocial || `${cliente.nombre ?? ''} ${cliente.apellido ?? ''}`.trim()}
                  </Link>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
