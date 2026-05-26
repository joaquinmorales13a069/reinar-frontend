'use client';

import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import {
  useReporteInventario,
  useReporteInventarioDetalle,
  type InventarioBodegaResumen,
} from '@/hooks/use-reporte-inventario';

const cardCls = 'rounded-lg border border-bd bg-surface p-4';

export default function ReporteInventarioPage() {
  const { data, isLoading } = useReporteInventario();
  const [seleccionada, setSeleccionada] = useState<InventarioBodegaResumen | null>(null);
  const detalle = useReporteInventarioDetalle(seleccionada?.bodegaId ?? null);

  // Agrupamos zonas debajo de cada principal.
  const grupos = useMemo(() => {
    if (!data) return [];
    const principales = data.porBodega.filter((b) => b.parentId === null);
    return principales.map((p) => ({
      principal: p,
      zonas: data.porBodega.filter((b) => b.parentId === p.bodegaId),
    }));
  }, [data]);

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Reporte de inventario" back backLabel="Reportes" />
        <div className="flex justify-center py-12"><Spinner /></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <PageHeader title="Reporte de inventario" back backLabel="Reportes" />
        <EmptyState icon="building" title="Sin datos" message="No se pudo cargar el reporte." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Reporte de inventario"
        subtitle="Snapshot del inventario distribuido por bodega."
        back
        backLabel="Reportes"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Equipos" value={data.totales.equipos} />
        <Stat label="Herramientas" value={data.totales.herramientas} />
        <Stat
          label="Consumibles"
          value={`${data.totales.consumiblesSku} SKU`}
          extra={`${data.totales.consumiblesUnid} unid.`}
        />
        <Stat
          label="Piezas"
          value={`${data.totales.piezasSku} SKU`}
          extra={`${data.totales.piezasUnid} unid.`}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold mb-3">Por bodega</h3>
          <div className="flex flex-col gap-3">
            {grupos.map(({ principal, zonas }) => (
              <div key={principal.bodegaId} className={cardCls}>
                <BodegaRow
                  bodega={principal}
                  onSelect={() => setSeleccionada(principal)}
                  selected={seleccionada?.bodegaId === principal.bodegaId}
                />
                {zonas.length > 0 && (
                  <div className="mt-3 pl-3 border-l border-bd flex flex-col gap-2">
                    {zonas.map((z) => (
                      <BodegaRow
                        key={z.bodegaId}
                        bodega={z}
                        onSelect={() => setSeleccionada(z)}
                        selected={seleccionada?.bodegaId === z.bodegaId}
                        compact
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-3">
            {seleccionada ? `Detalle — ${seleccionada.bodegaNombre}` : 'Detalle'}
          </h3>
          {!seleccionada && (
            <EmptyState icon="building" title="Elegí una bodega" message="Hacé clic para ver sus items." />
          )}
          {seleccionada && detalle.isLoading && (
            <div className="flex justify-center py-8"><Spinner /></div>
          )}
          {seleccionada && detalle.data && detalle.data.length === 0 && (
            <EmptyState icon="building" title="Sin items" message="Esta bodega está vacía." />
          )}
          {seleccionada && detalle.data && detalle.data.length > 0 && (
            <div className={`${cardCls} overflow-x-auto`}>
              <table className="w-full text-xs">
                <thead className="text-tx-3">
                  <tr>
                    <th className="text-left font-medium pb-2">Tipo</th>
                    <th className="text-left font-medium pb-2">Código</th>
                    <th className="text-left font-medium pb-2">Nombre</th>
                    <th className="text-left font-medium pb-2">Estado / cant.</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.data.map((it) => (
                    <tr key={`${it.tipo}-${it.id}`} className="border-t border-bd/40">
                      <td className="py-1.5 pr-2">
                        <Badge kind="neutral" status={it.tipo} />
                      </td>
                      <td className="py-1.5 pr-2 font-mono">{it.codigo}</td>
                      <td className="py-1.5 pr-2">{it.nombre}</td>
                      <td className="py-1.5 pr-2 font-mono">
                        {it.cantidad !== undefined ? `${it.cantidad} unid.` : it.estado ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, extra }: { label: string; value: string | number; extra?: string }) {
  return (
    <div className={cardCls}>
      <div className="text-xs text-tx-3">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
      {extra && <div className="text-xs text-tx-3 mt-0.5">{extra}</div>}
    </div>
  );
}

function BodegaRow({
  bodega,
  onSelect,
  selected,
  compact,
}: {
  bodega: InventarioBodegaResumen;
  onSelect: () => void;
  selected: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors ${
        selected ? 'bg-accent-soft' : 'hover:bg-bg-sunken'
      }`}
    >
      <div className="min-w-0">
        <div className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'} font-medium`}>
          {!compact && <Icon name="building" size={14} />}
          <span className="truncate">{bodega.bodegaNombre}</span>
          {compact && <Badge kind="neutral" status="Zona" />}
        </div>
        <div className="text-xs text-tx-3 mt-0.5">
          {bodega.equipos} eq · {bodega.herramientas} h · {bodega.consumiblesUnid} c · {bodega.piezasUnid} p
        </div>
      </div>
      <Icon name="chevronRight" size={12} />
    </button>
  );
}
