'use client';

import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import type { Factura } from '@/types/api';

export function ActasVinculadasCard({ factura }: { factura: Factura }) {
  const actas = factura.actasEntrega ?? [];
  return (
    <div className="bg-bg border border-bd rounded-md">
      <div className="px-4 py-3 border-b border-bd">
        <h3 className="text-sm font-medium text-tx">Actas de entrega vinculadas ({actas.length})</h3>
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
    </div>
  );
}
