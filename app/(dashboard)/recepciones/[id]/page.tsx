'use client';

import { use } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { CondicionBadge } from '@/components/actas-recepciones/CondicionBadge';
import { describirItem } from '@/components/actas-recepciones/ItemRow';
import { useRecepcion, useDescargarRecepcionPdf } from '@/hooks/use-recepciones';
import { useActasRealtime } from '@/hooks/use-actas-realtime';
import { formatDate } from '@/lib/utils';
import type { Recepcion } from '@/types/api';

// Devuelve el nombre del cliente a mostrar — defensivo porque backends viejos
// no incluyen factura.cliente en obtenerRecepcion (PR #43 server lo agrega).
// Para clientes PARTICULAR la razonSocial es null, por eso el fallback a
// nombre+apellido.
function nombreClienteRecepcion(r: Recepcion): string {
  const c = (r.factura as { cliente?: { razonSocial?: string | null; nombre?: string | null; apellido?: string | null } }).cliente;
  if (!c) return '—';
  if (c.razonSocial) return c.razonSocial;
  return [c.nombre, c.apellido].filter(Boolean).join(' ') || '—';
}

export default function RecepcionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  useActasRealtime();
  const { data: recepcion, isLoading } = useRecepcion(id);
  const pdf = useDescargarRecepcionPdf();

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (!recepcion) return <EmptyState icon="package" title="Recepción no encontrada" message="La recepción no existe o fue eliminada." />;

  return (
    <div>
      <PageHeader
        title={recepcion.numeroActa}
        backLabel="Recepciones"
        subtitle={<>Recepción de <Link href={`/facturas/${recepcion.factura.id}`} className="font-mono text-accent hover:underline">{recepcion.factura.numeroFactura}</Link></>}
        back
        actions={
          <button
            type="button"
            disabled={pdf.isLoading}
            onClick={() => pdf.descargar(recepcion.id, recepcion.numeroActa)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd bg-surface text-tx text-xs font-semibold hover:bg-bg-sunken transition-colors disabled:opacity-60"
          >
            <Icon name="download" size={14} /> {pdf.isLoading ? 'Generando…' : 'Descargar PDF'}
          </button>
        }
      />

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="rounded-lg border border-bd bg-surface p-4">
          <h3 className="text-sm font-semibold text-tx mb-3">Datos generales</h3>
          <dl className="text-sm space-y-1.5">
            <div className="flex justify-between gap-2"><dt className="text-tx-3">Fecha recepción</dt><dd className="font-mono text-xs">{formatDate(recepcion.fechaRecepcion)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-tx-3">Hora</dt><dd className="font-mono text-xs">{recepcion.horaRecepcion ?? '—'}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-tx-3">N° físico</dt><dd className="font-mono text-xs">{recepcion.numeroActaFisico ?? '—'}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-tx-3">Recibido por</dt><dd>{recepcion.usuarioRecepcion.nombre} {recepcion.usuarioRecepcion.apellido}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-tx-3">Cliente</dt><dd className="truncate max-w-xs text-right">{nombreClienteRecepcion(recepcion)}</dd></div>
          </dl>
        </div>
        {recepcion.observaciones && (
          <div className="rounded-lg border border-bd bg-surface p-4">
            <h3 className="text-sm font-semibold text-tx mb-2">Observaciones</h3>
            <p className="text-sm text-tx-2 whitespace-pre-line">{recepcion.observaciones}</p>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-bd bg-surface p-4">
        <h3 className="text-sm font-semibold text-tx mb-3">Ítems devueltos ({recepcion.items.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-sunken text-tx-2 text-xs">
              <tr>
                <th className="text-left px-3 py-2">Ítem</th>
                <th className="text-left px-3 py-2">Acta origen</th>
                <th className="text-left px-3 py-2">Cond. salida</th>
                <th className="text-left px-3 py-2">Cond. retorno</th>
                <th className="text-left px-3 py-2">Horóm.</th>
                <th className="text-left px-3 py-2">Comb.</th>
                <th className="text-left px-3 py-2">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {recepcion.items.map((it) => {
                const info = describirItem(it.actaEntregaItem);
                return (
                  <tr key={it.id} className="border-t border-bd">
                    <td className="px-3 py-2">
                      <div className="text-sm font-medium">{info.titulo}</div>
                      {info.codigo && <div className="text-xs text-tx-3 font-mono">{info.codigo}</div>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{it.actaEntregaItem.actaEntrega.numeroActa}</td>
                    <td className="px-3 py-2"><CondicionBadge condicion={it.actaEntregaItem.condicionSalida} /></td>
                    <td className="px-3 py-2"><CondicionBadge condicion={it.condicionRetorno} /></td>
                    <td className="px-3 py-2 font-mono text-xs">{it.horometroRetorno ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{it.combustibleRetorno ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-tx-2 max-w-xs truncate">{it.observacionesRetorno ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
