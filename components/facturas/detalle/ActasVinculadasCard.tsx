'use client';

import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import type { Factura } from '@/types/api';

type Props = {
  factura: Factura;
  puedeEscribir: boolean;
};

export function ActasVinculadasCard({ factura, puedeEscribir }: Props) {
  const actas = factura.actasEntrega ?? [];
  return (
    <div className="bg-bg border border-bd rounded-md">
      <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
        <h3 className="text-sm font-medium text-tx">Actas de entrega vinculadas ({actas.length})</h3>
        {puedeEscribir && (
          <Link
            href={`/actas/nueva?facturaId=${factura.id}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors"
          >
            <Icon name="plus" size={12} /> Nueva acta
          </Link>
        )}
      </div>
      {actas.length === 0 ? (
        <div className="py-6">
          <EmptyState icon="clipboard" title="Sin actas" message="Aún no se han creado actas de entrega para esta factura." />
        </div>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {actas.map((a) => (
              <tr key={a.id} className="border-t border-bd hover:bg-bg-sunken">
                <td className="px-4 py-2.5 font-mono w-40">
                  <Link href={`/actas/${a.id}`} className="hover:underline">{a.numeroActa}</Link>
                </td>
                <td className="px-4 py-2.5">
                  <Badge status={a.estado} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="px-4 py-2 border-t border-bd text-xs text-tx-3">
        Ver{' '}
        <Link href={`/actas?busqueda=${factura.numeroFactura}`} className="text-accent hover:underline">actas de esta factura</Link>
        {' · '}
        <Link href={`/recepciones?busqueda=${factura.numeroFactura}`} className="text-accent hover:underline">recepciones</Link>
      </div>
    </div>
  );
}
