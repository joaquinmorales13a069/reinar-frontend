'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { InventarioAsignadoCard } from '@/components/bodegas/InventarioAsignadoCard';
import { useBodega } from '@/hooks/use-bodegas';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarBodega } from '@/lib/bodegas';

const btnSec =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';

export default function BodegaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeEditar = puedeEjecutarBodega('editar', rol);
  const { data: bodega, isLoading, isError } = useBodega(id);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  if (isError || !bodega) {
    return (
      <EmptyState
        icon="alertTriangle"
        title="No se encontró la bodega"
        message="Puede haber sido eliminada o el ID es incorrecto."
      />
    );
  }

  return (
    <div>
      <PageHeader
        title={bodega.nombre}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span className="font-mono text-xs text-tx-3">{bodega.id}</span>
            <span className="text-tx-3">·</span>
            <Badge status={bodega.activa ? 'ACTIVA' : 'INACTIVA'} kind={bodega.activa ? 'ok' : 'neutral'} />
          </span>
        }
        back
        backLabel="Bodegas"
        onBack={() => router.push('/bodegas')}
        actions={
          puedeEditar ? (
            <Link href={`/bodegas/${bodega.id}/editar`} className={btnSec}>
              <Icon name="edit" size={14} /> Editar
            </Link>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-bd bg-surface p-4">
            <h3 className="text-sm font-semibold mb-3">Información</h3>
            <dl className="m-0 text-sm">
              <div className="flex items-baseline justify-between py-2 border-b border-bd-soft last:border-0 gap-4">
                <dt className="text-tx-3 shrink-0">Descripción</dt>
                <dd className="text-tx text-right">{bodega.descripcion || <span className="text-tx-3">—</span>}</dd>
              </div>
              <div className="flex items-baseline justify-between py-2 border-b border-bd-soft last:border-0 gap-4">
                <dt className="text-tx-3 shrink-0">Dirección</dt>
                <dd className="text-tx text-right">{bodega.direccion || <span className="text-tx-3">—</span>}</dd>
              </div>
              <div className="flex items-baseline justify-between py-2 border-b border-bd-soft last:border-0 gap-4">
                <dt className="text-tx-3 shrink-0">Ciudad</dt>
                <dd className="text-tx text-right">{bodega.ciudad || <span className="text-tx-3">—</span>}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-bd bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
              <h3 className="text-sm font-semibold text-tx">
                Zonas {(bodega.zonas?.length ?? 0) > 0 && <span className="text-tx-3 font-normal">({bodega.zonas!.length})</span>}
              </h3>
              {puedeEditar && bodega.activa && (
                <Link
                  href={`/bodegas/${bodega.id}/zonas/nueva`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors"
                >
                  <Icon name="plus" size={12} /> Nueva zona
                </Link>
              )}
            </div>
            {(bodega.zonas?.length ?? 0) === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-tx-3">
                Sin zonas registradas.
              </div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {bodega.zonas!.map((z) => (
                    <tr
                      key={z.id}
                      className="border-t border-bd first:border-t-0 hover:bg-bg-sunken transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-tx">{z.nombre}</div>
                        {z.descripcion && (
                          <div className="text-xs text-tx-3 mt-0.5">{z.descripcion}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 w-28 text-right">
                        <Badge status={z.activa ? 'ACTIVA' : 'INACTIVA'} kind={z.activa ? 'ok' : 'neutral'} />
                      </td>
                      <td className="px-4 py-2.5 w-12 pr-3 text-right">
                        {puedeEditar && (
                          <Link
                            href={`/bodegas/${bodega.id}/zonas/${z.id}/editar`}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-tx-3 hover:bg-bg hover:text-tx transition-colors"
                            aria-label="Editar"
                          >
                            <Icon name="edit" size={14} />
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <InventarioAsignadoCard bodegaId={bodega.id} />
        </div>
      </div>
    </div>
  );
}
