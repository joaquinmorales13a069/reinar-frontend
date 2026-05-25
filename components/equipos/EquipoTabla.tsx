'use client';

import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { EquipoCategoriaBadge } from '@/components/equipos/EquipoCategoriaBadge';
import { ESTADO_LABELS, ESTADO_BADGE_KIND, puedeEjecutar } from '@/lib/equipos';
import { formatCurrency } from '@/lib/utils';
import type { Equipo } from '@/types/api';

const thCls = 'px-4 py-2.5 text-left text-2xs uppercase tracking-wider font-medium text-tx-3 bg-bg-sunken';
const tdCls = 'px-4 py-3 text-sm text-tx';
const iconBtn = 'inline-flex items-center justify-center w-7 h-7 rounded text-tx-3 hover:bg-bg-sunken hover:text-tx transition-colors';

type Props = {
  equipos: Equipo[];
  rol: string;
  pageOffset: number;
};

export function EquipoTabla({ equipos, rol, pageOffset }: Props) {
  const router = useRouter();
  const puedeEditar = puedeEjecutar('editar', rol);

  return (
    <DataTable>
      <thead>
        <tr>
          <th className={thCls} style={{ width: 50 }}>#</th>
          <th className={thCls} style={{ width: 110 }}>Código</th>
          <th className={thCls}>Equipo</th>
          <th className={`${thCls} hidden md:table-cell`} style={{ width: 200 }}>Categoría</th>
          <th className={`${thCls} hidden lg:table-cell`} style={{ width: 160 }}>Marca / Modelo</th>
          <th className={`${thCls} text-right`} style={{ width: 110 }}>$/día</th>
          <th className={thCls} style={{ width: 130 }}>Estado</th>
          <th className={thCls} style={{ width: 90 }}>Acciones</th>
        </tr>
      </thead>
      <tbody>
        {equipos.map((e, i) => (
          <tr
            key={e.id}
            className="border-t border-bd hover:bg-row-hover transition-colors cursor-pointer"
            onClick={() => router.push(`/equipos/${e.id}`)}
          >
            <td className={`${tdCls} font-mono text-tx-3 text-xs`}>{pageOffset + i + 1}</td>
            <td className={`${tdCls} font-mono text-xs`}>{e.codigo}</td>
            <td className={tdCls}>
              <div className="font-medium">{e.nombre}</div>
              {e.descripcion && (
                <div className="text-xs text-tx-3 mt-0.5 truncate max-w-md">{e.descripcion}</div>
              )}
            </td>
            <td className={`${tdCls} hidden md:table-cell`}>
              <EquipoCategoriaBadge categoria={e.categoria} />
            </td>
            <td className={`${tdCls} hidden lg:table-cell text-tx-2`}>
              {e.marca ?? <span className="text-tx-3">—</span>}
              {e.modelo && <div className="font-mono text-xs text-tx-3 mt-0.5">{e.modelo}</div>}
            </td>
            <td className={`${tdCls} text-right font-mono`}>{formatCurrency(e.tarifaDia)}</td>
            <td className={tdCls}>
              <Badge status={ESTADO_LABELS[e.estado]} kind={ESTADO_BADGE_KIND[e.estado]} />
            </td>
            <td className={tdCls} onClick={(ev) => ev.stopPropagation()}>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className={iconBtn}
                  onClick={() => router.push(`/equipos/${e.id}`)}
                  aria-label="Ver detalle"
                >
                  <Icon name="eye" size={14} />
                </button>
                {puedeEditar && (
                  <button
                    type="button"
                    className={iconBtn}
                    onClick={() => router.push(`/equipos/${e.id}/editar`)}
                    aria-label="Editar"
                  >
                    <Icon name="edit" size={14} />
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
        {equipos.length === 0 && (
          <tr>
            <td colSpan={8}>
              <EmptyState
                icon="package"
                title="Sin equipos"
                message="No se encontraron equipos con los filtros aplicados."
              />
            </td>
          </tr>
        )}
      </tbody>
    </DataTable>
  );
}
