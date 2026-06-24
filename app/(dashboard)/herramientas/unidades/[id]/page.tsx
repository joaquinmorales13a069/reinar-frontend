'use client';

import { Suspense, use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { MoverBodegaPanel } from '@/components/ui/MoverBodegaPanel';
import { UnidadEstadoSelector } from '@/components/herramientas/UnidadEstadoSelector';
import { UnidadMantenimientosCard } from '@/components/herramientas/UnidadMantenimientosCard';
import { HistorialRentasCard } from '@/components/inventario/HistorialRentasCard';
import {
  useHerramientaTipo,
  useUnidadesPorTipo,
  useRentasUnidad,
  useMoverBodegaUnidad,
} from '@/hooks/use-herramientas';
import { useAuthStore } from '@/stores/auth.store';
import {
  ESTADO_HERRAMIENTA_LABEL,
  ESTADO_HERRAMIENTA_KIND,
  puedeEjecutar,
} from '@/lib/herramientas';

const btnSec =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';

export default function UnidadDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  // UnidadDetalleClient usa useSearchParams (?tipoId=…), por eso necesita
  // Suspense para que Next 16 no rompa el prerender estatico.
  return (
    <Suspense fallback={<div className="flex justify-center p-12"><Spinner /></div>}>
      <UnidadDetalleClient unidadId={id} />
    </Suspense>
  );
}

function UnidadDetalleClient({ unidadId }: { unidadId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tipoId = searchParams.get('tipoId') ?? '';
  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');

  // Esta página depende del tipoId en query string para localizar la unidad
  // desde la cache nested (`useUnidadesPorTipo`). El backend no expone
  // GET /unidades/:id aislado — siempre llegamos acá desde el detalle del tipo.
  useEffect(() => {
    if (!tipoId) {
      toast.error('Falta el contexto del tipo. Volvé a abrir desde el detalle del tipo.');
      router.replace('/herramientas?tab=tipos');
    }
  }, [tipoId, router]);

  const { data: tipo, isLoading: loadingTipo } = useHerramientaTipo(tipoId);
  const { data: unidades, isLoading: loadingUnidades } = useUnidadesPorTipo(tipoId);
  const moverBodega = useMoverBodegaUnidad();
  const [moverAbierto, setMoverAbierto] = useState(false);

  const puedeCambiar = puedeEjecutar('cambiarEstadoUnidad', rol);

  if (!tipoId || loadingTipo || loadingUnidades) {
    return <div className="flex justify-center p-12"><Spinner /></div>;
  }

  const unidad = (unidades ?? []).find((u) => u.id === unidadId);

  if (!tipo || !unidad) {
    return (
      <div>
        <EmptyState
          icon="alertTriangle"
          title="Unidad no encontrada"
          message="La unidad no existe o fue eliminada."
        />
        <div className="text-center">
          <Link href="/herramientas?tab=tipos" className={btnSec}>
            <Icon name="arrowLeft" size={14} /> Volver a herramientas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={unidad.codigoInterno}
        subtitle={
          <span className="inline-flex items-center gap-2 flex-wrap">
            <span className="text-tx-2">{tipo.nombre}</span>
            <span className="text-tx-3">·</span>
            <Badge
              status={ESTADO_HERRAMIENTA_LABEL[unidad.estado]}
              kind={ESTADO_HERRAMIENTA_KIND[unidad.estado]}
            />
          </span>
        }
        back
        backLabel={`Tipo ${tipo.codigo}`}
        onBack={() => router.push(`/herramientas/tipos/${tipo.id}`)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-bd bg-surface p-4">
            <h3 className="font-semibold text-tx mb-3">Datos</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-sm">
              <div>
                <dt className="text-xs text-tx-3">Tipo</dt>
                <dd>
                  <Link
                    href={`/herramientas/tipos/${tipo.id}`}
                    className="text-tx-2 hover:underline"
                  >
                    {tipo.nombre}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-tx-3">Categoría</dt>
                <dd>
                  <Badge status={tipo.categoria?.nombre ?? '—'} kind="info" />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-tx-3">Código interno</dt>
                <dd className="font-mono">{unidad.codigoInterno}</dd>
              </div>
              <div>
                <dt className="text-xs text-tx-3">Estado actual</dt>
                <dd>
                  <Badge
                    status={ESTADO_HERRAMIENTA_LABEL[unidad.estado]}
                    kind={ESTADO_HERRAMIENTA_KIND[unidad.estado]}
                  />
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-tx-3">Notas</dt>
                <dd className={unidad.notas ? '' : 'text-tx-3'}>
                  {unidad.notas ?? 'Sin notas registradas.'}
                </dd>
              </div>
            </dl>
          </div>

          {puedeCambiar && (
            <div className="rounded-lg border border-bd bg-surface p-4">
              <h3 className="font-semibold text-tx mb-3">Cambiar estado</h3>
              <UnidadEstadoSelector
                unidadId={unidad.id}
                tipoId={tipo.id}
                estadoActual={unidad.estado}
              />
            </div>
          )}

          <div className="rounded-lg border border-bd bg-surface p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-tx">Ubicación física</h3>
              {puedeCambiar && unidad.estado !== 'RENTADA' && unidad.estado !== 'RESERVADA' && !moverAbierto && (
                <button type="button" className={btnSec} onClick={() => setMoverAbierto(true)}>
                  <Icon name="refresh" size={12} /> Mover
                </button>
              )}
            </div>
            <div className="text-sm">
              <div className="text-xs text-tx-3">Bodega actual</div>
              <div className="font-medium">{unidad.bodega?.nombre ?? '—'}</div>
            </div>
            {(unidad.estado === 'RENTADA' || unidad.estado === 'RESERVADA') && (
              <p className="text-xs text-tx-3 mt-2">
                No se puede mover mientras la unidad está {unidad.estado === 'RENTADA' ? 'rentada' : 'reservada'}.
              </p>
            )}
          </div>

          {moverAbierto && (
            <MoverBodegaPanel
              currentBodegaId={unidad.bodegaId}
              isPending={moverBodega.isPending}
              onCancel={() => setMoverAbierto(false)}
              onConfirm={(data) =>
                moverBodega.mutate(
                  { unidadId: unidad.id, tipoId: tipo.id, data },
                  { onSuccess: () => setMoverAbierto(false) },
                )
              }
            />
          )}
        </div>

        <HistorialRentasUnidad unidadId={unidad.id} />
        <UnidadMantenimientosCard unidadId={unidad.id} />
      </div>
    </div>
  );
}

// Wrapper local: conecta el hook con el componente compartido del inventario.
function HistorialRentasUnidad({ unidadId }: { unidadId: string }) {
  const { data, isLoading } = useRentasUnidad(unidadId);
  return <HistorialRentasCard data={data} isLoading={isLoading} />;
}
