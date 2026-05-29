'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { FacturaEstadoBadge } from './FacturaEstadoBadge';
import { EstadoDteBadge } from './EstadoDteBadge';
import { TipoDteBadge } from './TipoDteBadge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { descargarFacturaPdfBranded } from '@/hooks/use-facturas';
import type { FacturaListItem } from '@/types/api';

// EMPRESA usa razonSocial; PARTICULAR arma con nombre + apellido. Fallback a
// "—" si falta el dato base, para no romper la tabla con clientes mal cargados.
// Misma logica que CotizacionesTabla.nombreCliente — la duplicamos a proposito
// para no extraer un util de 6 lineas a un archivo compartido.
function nombreCliente(c: FacturaListItem['cliente']): string {
  if (c.tipo === 'EMPRESA') return c.razonSocial ?? '—';
  return [c.nombre, c.apellido].filter(Boolean).join(' ') || '—';
}

type Props = {
  data: FacturaListItem[];
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  // Cuando el filtro "Solo QUEDAN" esta activo mostramos columna Entrega.
  mostrarColumnaEntrega?: boolean;
};

// Celda Entrega para QUEDAN. Si ya esta entregada muestra la fecha real; si
// la fecha programada quedo atras pero no esta entregada, badge "Por entregar"
// en amarillo para llamar la atencion.
function celdaEntrega(f: FacturaListItem) {
  if (f.fechaEntregaReal) {
    return (
      <span className="text-tx-2 text-xs">
        Entregada el <span className="font-mono">{formatDate(f.fechaEntregaReal)}</span>
      </span>
    );
  }
  if (f.fechaEntregaFactura) {
    // Comparamos por dia (sin hora) para no marcar "Por entregar" en una
    // factura cuya fecha programada es hoy.
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const programada = new Date(f.fechaEntregaFactura);
    const vencida = programada.getTime() < hoy.getTime();
    if (vencida) return <Badge status="Por entregar" kind="warn" />;
    return <span className="font-mono text-xs text-tx-2">{formatDate(f.fechaEntregaFactura)}</span>;
  }
  return <span className="text-tx-3">—</span>;
}

export function FacturasTabla({ data, loading, page, pageSize, total, onPage, mostrarColumnaEntrega = false }: Props) {
  const router = useRouter();

  if (loading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }
  if (data.length === 0) {
    return (
      <EmptyState
        icon="fileText"
        title="Sin facturas"
        message="No se encontraron facturas con los filtros aplicados."
      />
    );
  }

  return (
    <div className="border border-bd rounded-b-md overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-bg-sunken text-2xs uppercase tracking-wider text-tx-3">
          <tr>
            <th className="text-left font-medium px-4 py-2.5">Número</th>
            <th className="text-left font-medium px-4 py-2.5">Cliente</th>
            <th className="text-left font-medium px-4 py-2.5">Cotización</th>
            <th className="text-left font-medium px-4 py-2.5">Tipo</th>
            <th className="text-left font-medium px-4 py-2.5">Estado pago</th>
            <th className="text-left font-medium px-4 py-2.5">Estado DTE</th>
            <th className="text-right font-medium px-4 py-2.5">Total</th>
            <th className="text-right font-medium px-4 py-2.5">Saldo</th>
            <th className="text-left font-medium px-4 py-2.5">Emisión</th>
            {mostrarColumnaEntrega && (
              <th className="text-left font-medium px-4 py-2.5">Entrega</th>
            )}
            <th className="text-center font-medium px-4 py-2.5 w-20">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {data.map((f) => {
            // Saldo en rojo solo si hay pendiente; gris cuando esta cero.
            const saldoNum = Number(f.saldoPendiente);
            return (
              <tr
                key={f.id}
                className="border-t border-bd hover:bg-bg-sunken cursor-pointer transition-colors"
                onClick={() => router.push(`/facturas/${f.id}`)}
              >
                <td className="px-4 py-2.5 font-mono font-medium text-tx">{f.numeroFactura}</td>
                <td className="px-4 py-2.5 text-tx">{nombreCliente(f.cliente)}</td>
                <td className="px-4 py-2.5">
                  <Link
                    href={`/cotizaciones/${f.cotizacion.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-mono text-xs text-tx-2 hover:underline"
                  >
                    {f.cotizacion.numeroCotizacion}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  {f.esQuedan
                    ? <Badge status="QUEDAN" kind="warn" />
                    : f.tipoDTE
                      ? <TipoDteBadge tipo={f.tipoDTE} />
                      : <span className="text-tx-3">—</span>}
                </td>
                <td className="px-4 py-2.5"><FacturaEstadoBadge estado={f.estado} /></td>
                <td className="px-4 py-2.5"><EstadoDteBadge estado={f.estadoDTE} /></td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatCurrency(f.total)}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${saldoNum > 0 ? 'text-danger' : 'text-tx-3'}`}>
                  {formatCurrency(f.saldoPendiente)}
                </td>
                <td className="px-4 py-2.5 font-mono text-tx-2 text-xs">{formatDate(f.fechaEmision)}</td>
                {mostrarColumnaEntrega && (
                  <td className="px-4 py-2.5">{celdaEntrega(f)}</td>
                )}
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    title="Descargar PDF"
                    className="inline-flex items-center justify-center w-8 h-8 rounded text-tx-3 hover:bg-bg hover:text-tx transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      void descargarFacturaPdfBranded(f.id, f.numeroFactura);
                    }}
                  >
                    <Icon name="download" size={14} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {total > pageSize && <Pagination page={page} pageSize={pageSize} total={total} onPage={onPage} />}
    </div>
  );
}
