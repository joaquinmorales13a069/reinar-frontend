'use client';

import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { EquipoCategoriaBadge } from '@/components/equipos/EquipoCategoriaBadge';
import { ESTADO_LABELS, ESTADO_BADGE_KIND } from '@/lib/equipos';
import { formatCurrency } from '@/lib/utils';
import type { Equipo } from '@/types/api';

export function EquipoGrilla({ equipos }: { equipos: Equipo[] }) {
  const router = useRouter();

  if (equipos.length === 0) {
    return (
      <EmptyState
        icon="package"
        title="Sin equipos"
        message="No se encontraron equipos con los filtros aplicados."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
      {equipos.map((e) => (
        <button
          key={e.id}
          type="button"
          className="text-left rounded-lg border border-bd bg-surface overflow-hidden hover:border-accent transition-colors"
          onClick={() => router.push(`/equipos/${e.id}`)}
        >
          <div className="aspect-[4/3] w-full bg-bg-sunken grid place-items-center text-tx-3 overflow-hidden">
            {e.imagenUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.imagenUrl} alt={e.nombre} className="w-full h-full object-cover" />
            ) : (
              <Icon name="package" size={32} />
            )}
          </div>
          <div className="p-3">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className="font-mono text-xs text-tx-3">{e.codigo}</span>
              <Badge status={ESTADO_LABELS[e.estado]} kind={ESTADO_BADGE_KIND[e.estado]} />
            </div>
            <div className="font-medium text-sm leading-snug mb-1 line-clamp-2">{e.nombre}</div>
            <div className="text-xs text-tx-3 mb-2 truncate">
              {e.marca ?? '—'} {e.modelo && <span className="font-mono">· {e.modelo}</span>}
            </div>
            <div className="mb-2">
              <EquipoCategoriaBadge nombre={e.categoria?.nombre} />
            </div>
            <div className="flex items-end justify-between pt-2 border-t border-bd">
              <span className="text-2xs uppercase tracking-wider text-tx-3 font-semibold">Por día</span>
              <span className="font-mono font-semibold">{formatCurrency(e.tarifaDia)}</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
