'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate, nombreCliente } from '@/lib/utils';
import type { ActaListItem } from '@/types/api';

export function ActaTablaListado({ actas }: { actas: ActaListItem[] }) {
  if (actas.length === 0) {
    return <EmptyState icon="clipboard" title="Sin actas" message="No se encontraron actas con los filtros aplicados." />;
  }
  return (
    <div className="overflow-x-auto rounded-md border border-bd">
      <table className="w-full text-sm">
        <thead className="bg-bg-sunken text-tx-2 text-xs">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Número</th>
            <th className="text-left px-3 py-2 font-medium">Factura</th>
            <th className="text-left px-3 py-2 font-medium">Cliente</th>
            <th className="text-left px-3 py-2 font-medium">Bodega</th>
            <th className="text-left px-3 py-2 font-medium">Estado</th>
            <th className="text-left px-3 py-2 font-medium">Despacho</th>
            <th className="text-left px-3 py-2 font-medium">Entrega</th>
          </tr>
        </thead>
        <tbody>
          {actas.map((a) => (
            <tr key={a.id} className="border-t border-bd hover:bg-bg-sunken transition-colors">
              <td className="px-3 py-2">
                <Link href={`/actas/${a.id}`} className="font-mono font-medium text-tx hover:text-accent">
                  {a.numeroActa}
                </Link>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-tx-2">{a.factura.numeroFactura}</td>
              <td className="px-3 py-2 truncate max-w-xs">{nombreCliente(a.factura.cliente)}</td>
              <td className="px-3 py-2 text-xs text-tx-2">{a.bodegaOrigen.nombre}</td>
              <td className="px-3 py-2"><Badge status={a.estado} /></td>
              <td className="px-3 py-2 font-mono text-xs text-tx-2">{a.fechaDespacho ? formatDate(a.fechaDespacho) : '—'}</td>
              <td className="px-3 py-2 font-mono text-xs text-tx-2">{a.fechaEntrega ? formatDate(a.fechaEntrega) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
