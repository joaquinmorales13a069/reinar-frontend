import { CondicionBadge } from './CondicionBadge';
import type { ActaItem } from '@/types/api';

// Resuelve label + código de identificación según el tipo polimórfico del item.
// El backend garantiza que exactamente uno de equipo/herramientaUnidad/consumible/piezaTipo
// está poblado por línea.
function describirItem(item: ActaItem): { titulo: string; codigo: string | null; tipo: 'EQUIPO' | 'HERRAMIENTA' | 'CONSUMIBLE' | 'PIEZA' } {
  if (item.equipo) return { titulo: item.equipo.nombre, codigo: item.equipo.codigoInterno, tipo: 'EQUIPO' };
  if (item.herramientaUnidad) {
    return { titulo: item.herramientaUnidad.herramientaTipo.nombre, codigo: item.herramientaUnidad.codigoInterno, tipo: 'HERRAMIENTA' };
  }
  if (item.consumible) return { titulo: item.consumible.nombre, codigo: null, tipo: 'CONSUMIBLE' };
  if (item.piezaTipo)  return { titulo: item.piezaTipo.nombre,  codigo: null, tipo: 'PIEZA' };
  return { titulo: '—', codigo: null, tipo: 'EQUIPO' };
}

type Props = {
  item: ActaItem;
  // Modo view = lectura; mostramos solo condición salida y retorno si las hay.
  mode?: 'view' | 'compact';
  // Si se pasa rightSlot, se renderiza en el lado derecho (badges, controles).
  rightSlot?: React.ReactNode;
};

export function ItemRow({ item, mode = 'view', rightSlot }: Props) {
  const info = describirItem(item);
  const cantidad = item.cantidadConsumible ?? item.cantidadRecibida ?? null;

  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-tx truncate">{info.titulo}</div>
        <div className="text-xs text-tx-3 flex items-center gap-2 mt-0.5">
          <span className="uppercase tracking-wide font-medium">{info.tipo}</span>
          {info.codigo && <span className="font-mono">· {info.codigo}</span>}
          {cantidad !== null && <span>· cant. {cantidad}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {mode === 'view' && (
          <>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-2xs text-tx-3 uppercase tracking-wide">Salida</span>
              <CondicionBadge condicion={item.condicionSalida} />
            </div>
          </>
        )}
        {rightSlot}
      </div>
    </div>
  );
}

export { describirItem };
