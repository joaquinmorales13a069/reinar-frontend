'use client';

import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { LABEL_TIPO_DOCUMENTO } from '@/lib/format-documentos';
import { Badge } from '@/components/ui/Badge';
import type { Factura } from '@/types/api';

export function ClienteFechasCard({ factura }: { factura: Factura }) {
  const c = factura.cliente;
  // Nombre del cliente: EMPRESA usa razonSocial, PARTICULAR arma con nombre+apellido.
  const nombre =
    c.tipo === 'EMPRESA'
      ? c.razonSocial ?? '—'
      : [c.nombre, c.apellido].filter(Boolean).join(' ') || '—';

  // La factura pudo emitirse a un tercero (receptorClienteId) distinto del
  // cliente que solicitó la cotización original — mostramos a ese solicitante
  // solo cuando difiere del receptor fiscal.
  const solicitante = factura.cotizacion.cliente;
  const esTercero = factura.clienteId !== solicitante.id;
  const nombreSolicitante = esTercero
    ? solicitante.tipo === 'EMPRESA'
      ? solicitante.razonSocial ?? '—'
      : [solicitante.nombre, solicitante.apellido].filter(Boolean).join(' ') || '—'
    : null;

  return (
    <div className="bg-bg border border-bd rounded-md p-4">
      <h3 className="text-sm font-medium text-tx mb-3">Cliente y fechas</h3>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 text-sm">
        <dt className="text-tx-3">Cliente</dt>
        <dd className="text-tx">
          <Link href={`/clientes/${c.id}`} className="hover:underline">{nombre}</Link>
        </dd>
        {esTercero && (
          <>
            <dt className="text-tx-3">Cotización solicitada por</dt>
            <dd className="text-tx">
              <Link href={`/clientes/${solicitante.id}`} className="hover:underline">{nombreSolicitante}</Link>
            </dd>
          </>
        )}
        {c.tipoDocumento && c.numeroDocumento && (
          <><dt className="text-tx-3">{LABEL_TIPO_DOCUMENTO[c.tipoDocumento]}</dt><dd className="font-mono text-xs">{c.numeroDocumento}</dd></>
        )}
        {c.ncr && (<><dt className="text-tx-3">NCR</dt><dd className="font-mono text-xs">{c.ncr}</dd></>)}
        <dt className="text-tx-3">Emisión</dt>
        <dd className="font-mono text-xs">{formatDate(factura.fechaEmision)}</dd>
        <dt className="text-tx-3">Condición de pago</dt>
        <dd>
          {factura.condicionPago ? (
            <Badge
              status={factura.condicionPago === 'CONTADO' ? 'Contado' : factura.condicionPago === 'CREDITO' ? 'Crédito' : 'Otro'}
              kind={factura.condicionPago === 'CONTADO' ? 'info' : 'accent'}
            />
          ) : (
            '—'
          )}
        </dd>
        <dt className="text-tx-3">Vencimiento</dt>
        <dd className="font-mono text-xs">
          {factura.fechaVencimiento
            ? formatDate(factura.fechaVencimiento)
            : 'Se define al entregar'}
        </dd>
        <dt className="text-tx-3">Cotización origen</dt>
        <dd>
          <Link href={`/cotizaciones/${factura.cotizacionId}`} className="font-mono text-xs hover:underline">
            {factura.cotizacion.numeroCotizacion}
          </Link>
        </dd>
        {factura.contactoFacturacion && (
          <>
            <dt className="text-tx-3">Contacto facturación</dt>
            <dd className="text-tx">{factura.contactoFacturacion.nombre}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
