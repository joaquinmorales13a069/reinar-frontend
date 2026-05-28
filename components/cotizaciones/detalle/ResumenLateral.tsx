import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { formatDate } from '@/lib/utils';
import type { Cotizacion } from '@/types/api';
import type { IconName } from '@/components/ui/Icon';

type TimelineRow = { label: string; fecha: string; icon: IconName };

function buildTimeline(cot: Cotizacion): TimelineRow[] {
  const rows: TimelineRow[] = [];
  rows.push({ label: 'Creada',  fecha: cot.fechaCreacion, icon: 'plus' });
  if (cot.fechaEnvio) rows.push({ label: 'Enviada al cliente', fecha: cot.fechaEnvio, icon: 'send' });
  if (cot.fechaAprobacion) rows.push({ label: 'Aprobada', fecha: cot.fechaAprobacion, icon: 'check' });
  // No tenemos fecha de rechazo en el modelo; mostramos solo los eventos persistidos
  // para no inventar timestamps.
  return rows;
}

const CARD_CLS = 'bg-bg border border-bd rounded-md p-4';

export function ResumenLateral({ cotizacion }: { cotizacion: Cotizacion }) {
  const cliente = cotizacion.cliente;
  const nombreCliente = cliente.razonSocial ?? `${cliente.nombre ?? ''} ${cliente.apellido ?? ''}`.trim();
  const rows = buildTimeline(cotizacion);

  return (
    <aside className="space-y-4">
      <div className={CARD_CLS}>
        <h3 className="text-sm font-medium text-tx mb-3">Cliente</h3>
        <div className="text-tx font-semibold">{nombreCliente}</div>
        {cliente.tipoDocumento && cliente.numeroDocumento && (
          <div className="text-xs text-tx-3 font-mono mt-0.5">
            {cliente.tipoDocumento} {cliente.numeroDocumento}
          </div>
        )}
        <dl className="mt-3 space-y-1.5 text-sm">
          {cotizacion.proyecto && (
            <div className="flex justify-between gap-2">
              <dt className="text-tx-3">Proyecto</dt>
              <dd className="text-tx text-right">{cotizacion.proyecto.nombre}</dd>
            </div>
          )}
          {cliente.email && (
            <div className="flex justify-between gap-2">
              <dt className="text-tx-3">Email</dt>
              <dd className="text-tx text-right font-mono text-xs truncate">{cliente.email}</dd>
            </div>
          )}
          {cliente.telefono && (
            <div className="flex justify-between gap-2">
              <dt className="text-tx-3">Teléfono</dt>
              <dd className="text-tx text-right font-mono">{cliente.telefono}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className={CARD_CLS}>
        <h3 className="text-sm font-medium text-tx mb-3">Fechas</h3>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-tx-3">Creación</dt>
            <dd className="text-tx font-mono">{formatDate(cotizacion.fechaCreacion)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-tx-3">Envío</dt>
            <dd className="text-tx font-mono">
              {cotizacion.fechaEnvio ? formatDate(cotizacion.fechaEnvio) : '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-tx-3">Vencimiento</dt>
            <dd className="text-tx font-mono">{formatDate(cotizacion.fechaVencimiento)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-tx-3">Aprobación</dt>
            <dd className="text-tx font-mono">
              {cotizacion.fechaAprobacion ? formatDate(cotizacion.fechaAprobacion) : '—'}
            </dd>
          </div>
        </dl>
      </div>

      <div className={CARD_CLS}>
        <h3 className="text-sm font-medium text-tx mb-3">Timeline</h3>
        <ol className="space-y-3">
          {rows.map((r, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-bg-sunken text-tx-2 shrink-0">
                <Icon name={r.icon} size={11} />
              </span>
              <div className="min-w-0">
                <div className="text-sm text-tx">{r.label}</div>
                <div className="text-xs text-tx-3 font-mono">{formatDate(r.fecha)}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {cotizacion.factura && (
        <div className={CARD_CLS}>
          <h3 className="text-sm font-medium text-tx mb-2">Factura generada</h3>
          <Link
            href={`/facturas/${cotizacion.factura.id}`}
            className="inline-flex items-center gap-2 text-sm font-mono text-info hover:underline"
          >
            {cotizacion.factura.numeroFactura}
            <Icon name="arrowRight" size={12} />
          </Link>
          <div className="text-xs text-tx-3 mt-1">Estado: {cotizacion.factura.estado}</div>
        </div>
      )}
    </aside>
  );
}
