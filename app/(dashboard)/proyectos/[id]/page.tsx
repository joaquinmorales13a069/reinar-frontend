'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProyectoKpisCard } from '@/components/proyectos/ProyectoKpisCard';
import { useProyecto } from '@/hooks/use-proyectos';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarProyecto } from '@/lib/proyectos';
import { formatDate } from '@/lib/utils';
import type { EstadoProyecto } from '@/types/api';

const BADGE_KIND: Record<EstadoProyecto, 'ok' | 'warn' | 'info' | 'neutral'> = {
  ACTIVO:     'ok',
  PAUSADO:    'warn',
  COMPLETADO: 'info',
  CANCELADO:  'neutral',
};

const btnSec =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';

export default function ProyectoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeEditar = puedeEjecutarProyecto('editar', rol);
  const { data: proyecto, isLoading, isError } = useProyecto(id);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (isError || !proyecto) {
    return (
      <EmptyState
        icon="alertTriangle"
        title="No se encontró el proyecto"
        message="Puede haber sido eliminado o el ID es incorrecto."
      />
    );
  }

  const clienteNombre = proyecto.cliente?.razonSocial ?? proyecto.cliente?.nombre ?? '—';

  return (
    <div>
      <PageHeader
        title={proyecto.nombre}
        subtitle={
          <span className="inline-flex items-center gap-2 flex-wrap">
            <Link href={`/clientes/${proyecto.clienteId}`} className="text-accent-dim hover:underline">
              {clienteNombre}
            </Link>
            <span className="text-tx-3">·</span>
            <Badge status={proyecto.estado} kind={BADGE_KIND[proyecto.estado]} />
            <span className="text-tx-3">·</span>
            <span className="font-mono text-xs text-tx-3">{proyecto.id}</span>
          </span>
        }
        back
        backLabel={clienteNombre}
        onBack={() => router.push(`/clientes/${proyecto.clienteId}`)}
        actions={
          puedeEditar ? (
            <Link href={`/proyectos/${proyecto.id}/editar`} className={btnSec}>
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
                <dt className="text-tx-3 shrink-0">Ubicación</dt>
                <dd className="text-tx text-right">{proyecto.ubicacion}</dd>
              </div>
              <div className="flex items-baseline justify-between py-2 border-b border-bd-soft last:border-0 gap-4">
                <dt className="text-tx-3 shrink-0">Creado</dt>
                <dd className="text-tx text-right font-mono">{formatDate(proyecto.createdAt)}</dd>
              </div>
              <div className="flex items-baseline justify-between py-2 border-b border-bd-soft last:border-0 gap-4">
                <dt className="text-tx-3 shrink-0">Última actualización</dt>
                <dd className="text-tx text-right font-mono">{formatDate(proyecto.updatedAt)}</dd>
              </div>
            </dl>
            {proyecto.descripcion && (
              <div className="mt-3 pt-3 border-t border-bd-soft">
                <div className="text-2xs font-semibold text-tx-3 uppercase tracking-wider mb-1.5">
                  Descripción
                </div>
                <p className="text-sm text-tx-2 m-0 leading-relaxed">{proyecto.descripcion}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <ProyectoKpisCard proyecto={proyecto} />
        </div>
      </div>
    </div>
  );
}
