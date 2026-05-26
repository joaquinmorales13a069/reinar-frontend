import { Icon } from '@/components/ui/Icon';
import { formatDate } from '@/lib/utils';
import type { EstadoActa } from '@/types/api';

type Props = {
  estado: EstadoActa;
  fechas: {
    fechaDespacho: string | null;
    fechaEntrega: string | null;
    fechaDevolucion: string | null;
  };
};

const PASOS = [
  { id: 'PENDIENTE',  label: 'Pendiente' },
  { id: 'DESPACHADO', label: 'Despachado' },
  { id: 'ENTREGADO',  label: 'Entregado' },
  { id: 'DEVUELTO',   label: 'Devuelto' },
] as const;

// DEVUELTA_PARCIAL se trata como variante "en progreso" del paso DEVUELTO:
// el círculo del paso 4 se ve activo pero sin check final.
function indexCurrent(estado: EstadoActa): number {
  if (estado === 'PENDIENTE') return 0;
  if (estado === 'DESPACHADO') return 1;
  if (estado === 'ENTREGADO') return 2;
  return 3; // DEVUELTA_PARCIAL o DEVUELTO
}

export function EstadoActaTimeline({ estado, fechas }: Props) {
  const idx = indexCurrent(estado);
  const fechaPorPaso = (i: number): string | null => {
    if (i === 1) return fechas.fechaDespacho;
    if (i === 2) return fechas.fechaEntrega;
    if (i === 3) return fechas.fechaDevolucion;
    return null;
  };

  return (
    <div className="flex items-center gap-2 mb-6 overflow-x-auto">
      {PASOS.map((paso, i) => {
        const done = i < idx;
        const active = i === idx;
        const fecha = fechaPorPaso(i);
        return (
          <div key={paso.id} className="flex items-center gap-2 min-w-fit">
            <div className={`flex items-center gap-2 ${done ? 'opacity-100' : active ? 'opacity-100' : 'opacity-50'}`}>
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${done ? 'bg-ok text-white' : active ? 'bg-accent text-navy' : 'bg-bg-sunken text-tx-3 border border-bd'}`}>
                {done ? <Icon name="check" size={12} /> : i + 1}
              </div>
              <div className="text-xs">
                <div className="font-medium text-tx">{paso.label}</div>
                {fecha && <div className="text-tx-3 font-mono">{formatDate(fecha)}</div>}
              </div>
            </div>
            {i < PASOS.length - 1 && (
              <div className={`w-8 h-px ${i < idx ? 'bg-ok' : 'bg-bd'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
