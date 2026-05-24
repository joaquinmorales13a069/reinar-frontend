'use client';
// components/dashboard/FleetWidget.tsx

import type { CategoriaFlota, UtilizacionCategoria } from '@/types/dashboard';

type FleetWidgetProps = {
  utilizacionPorCategoria: UtilizacionCategoria[];
};

const CATEGORIA_LABEL: Record<CategoriaFlota, string> = {
  COMPRESOR_GENERADOR:       'Compresores y generadores',
  SANDBLASTING:              'Sandblasting',
  ANDAMIO_PLATAFORMA:        'Andamios y plataformas',
  COMPACTADOR_RODILLO:       'Compactadores y rodillos',
  HERRAMIENTA_ESPECIALIZADA: 'Herramienta especializada',
  OTRO:                      'Otros equipos',
  ANDAMIO_PIEZA:             'Andamios (piezas)',
};

function pct(n: number, total: number): number {
  return total > 0 ? (n / total) * 100 : 0;
}

export function FleetWidget({ utilizacionPorCategoria }: FleetWidgetProps) {
  const totalEquipos = utilizacionPorCategoria.reduce((acc, f) => acc + f.total, 0);

  return (
    <div className="rounded-lg bg-surface border border-bd p-5 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-medium text-tx">Utilización de flota</h3>
        <p className="text-xs text-tx-3 mt-0.5">
          Por categoría · {totalEquipos} unidades en total
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {utilizacionPorCategoria.map((fila) => (
          <div key={fila.categoria} className="grid grid-cols-[1fr_auto] gap-x-3 items-center">
            <div className="min-w-0">
              <div className="text-sm text-tx truncate">{CATEGORIA_LABEL[fila.categoria]}</div>
              <div className="flex h-2 rounded-full overflow-hidden bg-bd mt-1.5">
                <div className="bg-accent" style={{ width: `${pct(fila.rentado, fila.total)}%` }} />
                <div className="bg-warn"   style={{ width: `${pct(fila.mantenimiento, fila.total)}%` }} />
                <div className="bg-bg-sunken" style={{ width: `${pct(fila.disponible, fila.total)}%` }} />
              </div>
            </div>
            <span className="font-mono text-xs text-tx-2 whitespace-nowrap">
              {fila.total > 0 ? `${fila.rentado}/${fila.total}` : '—'}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 mt-1 border-t border-bd text-xs text-tx-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-accent" />
          Rentado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-warn" />
          Mantenimiento
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-bg-sunken border border-bd" />
          Disponible
        </span>
      </div>
    </div>
  );
}
