'use client';

// Barra de progreso visual que toma stockActual sobre 2x stockMinimo como rango;
// si el stock supera el doble del mínimo, se llena al 100%. Si está por debajo,
// se colorea en warn. Patrón equivalente al `.progress` del prototipo.
type Props = { stockActual: number; stockMinimo: number };

export function StockBar({ stockActual, stockMinimo }: Props) {
  const bajo = stockActual <= stockMinimo;
  const techo = Math.max(1, stockMinimo * 2);
  const pct = Math.min(100, Math.round((stockActual / techo) * 100));
  return (
    <div className="h-2 w-full rounded-full bg-bg-sunken overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${bajo ? 'bg-warn' : 'bg-ok'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
