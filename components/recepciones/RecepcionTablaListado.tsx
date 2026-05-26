'use client';

import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate, nombreCliente } from '@/lib/utils';
import type { RecepcionListItem } from '@/types/api';

export function RecepcionTablaListado({ recepciones }: { recepciones: RecepcionListItem[] }) {
  if (recepciones.length === 0) {
    return <EmptyState icon="package" title="Sin recepciones" message="No se encontraron recepciones con los filtros aplicados." />;
  }
  return (
    <div className="overflow-x-auto rounded-md border border-bd">
      <table className="w-full text-sm">
        <thead className="bg-bg-sunken text-tx-2 text-xs">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Número</th>
            <th className="text-left px-3 py-2 font-medium">Factura</th>
            <th className="text-left px-3 py-2 font-medium">Cliente</th>
            <th className="text-left px-3 py-2 font-medium">Fecha recepción</th>
            <th className="text-left px-3 py-2 font-medium">Ítems</th>
            <th className="text-left px-3 py-2 font-medium">Recibido por</th>
          </tr>
        </thead>
        <tbody>
          {recepciones.map((r) => (
            <tr key={r.id} className="border-t border-bd hover:bg-bg-sunken transition-colors">
              <td className="px-3 py-2">
                <Link href={`/recepciones/${r.id}`} className="font-mono font-medium text-tx hover:text-accent">{r.numeroActa}</Link>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-tx-2">{r.factura.numeroFactura}</td>
              <td className="px-3 py-2 truncate max-w-xs">{nombreCliente(r.factura.cliente)}</td>
              <td className="px-3 py-2 font-mono text-xs">{formatDate(r.fechaRecepcion)}</td>
              <td className="px-3 py-2 text-xs">{r._count.items}</td>
              <td className="px-3 py-2 text-xs">{r.usuarioRecepcion.nombre} {r.usuarioRecepcion.apellido}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
