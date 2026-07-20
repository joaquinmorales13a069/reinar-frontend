'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useRenovarRenta } from '@/hooks/use-actas';
import { hoySV } from '@/lib/utils';
import type { Acta } from '@/types/api';

// Solo se renuevan ítems rentables que siguen en obra.
const TIPOS_RENTABLES = (it: Acta['items'][number]) =>
  !!it.equipo || !!it.herramientaUnidad || !!it.piezaTipo;

// Duración en días de un ítem según su período de tarifa. Refleja
// calcularSubtotal del backend: cantidadDias solo multiplica en DIA/CUSTOM;
// SEMANA/QUINCENA/MES son bloques planos.
const DIAS_POR_PERIODO: Record<string, number> = { SEMANA: 7, QUINCENA: 15, MES: 30 };

function duracionDias(it: Acta['items'][number]): number {
  const ci = it.cotizacionItem;
  if (!ci) return 30;
  return DIAS_POR_PERIODO[ci.periodo] ?? ci.cantidadDias;
}

// Un período de renta es una fecha CALENDARIO, no un instante — por eso toda
// la aritmética se hace contando días desde una época fija, sin construir
// instantes intermedios que arrastren un huso horario. Date.UTC acá se usa
// solo como contador puro (no representa un instante real de nada), así que
// el resultado es exacto sin importar la TZ del navegador o del servidor.
function fechaADias(fecha: string): number {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return Date.UTC(anio, mes - 1, dia) / 86_400_000;
}

function diasAFecha(dias: number): string {
  return new Date(dias * 86_400_000).toISOString().slice(0, 10);
}

// acta.periodoRentaFin llega como el ISO de un Date que el backend construyó
// con `new Date('YYYY-MM-DD')` a partir de un string plano validado con
// z.string().date() — eso ancla el valor a medianoche UTC PURA, no a
// medianoche El Salvador. El ISO resultante es siempre "...T00:00:00.000Z"
// del mismo día calendario que se guardó, así que el día correcto se lee de
// los componentes UTC del Date. isoToFechaSV interpretaría ese instante en TZ
// El Salvador, leería medianoche UTC como las 18:00 del día anterior, y
// correría el período sugerido un día hacia atrás.
function fechaCalendarioDeIsoUtc(iso: string): string {
  const d = new Date(iso);
  const anio = d.getUTCFullYear();
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(d.getUTCDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

// El período sugerido arranca el día siguiente al fin vigente del acta. Si el
// acta no tiene fin o ya venció, arranca hoy: renovar una renta vencida es un
// caso real y no debe proponer fechas en el pasado.
function periodoSugerido(acta: Acta, seleccionados: Acta['items']): { inicio: string; fin: string } {
  // hoySV() ya devuelve el día calendario en El Salvador (evita adelantar el
  // día entre las 18:00 y las 23:59 hora local); acá solo se compara como
  // fecha calendario contra el fin del acta, sin volver a pasar por ninguna TZ.
  const hoy = fechaADias(hoySV());
  const finActa = acta.periodoRentaFin ? fechaADias(fechaCalendarioDeIsoUtc(acta.periodoRentaFin)) : null;
  const base = finActa !== null && finActa >= hoy ? finActa + 1 : hoy;

  const dias = seleccionados.length > 0 ? Math.max(...seleccionados.map(duracionDias)) : 30;
  return { inicio: diasAFecha(base), fin: diasAFecha(base + dias - 1) };
}

export function RenovarRentaModal({ acta, onClose }: { acta: Acta; onClose: () => void }) {
  const router = useRouter();
  const renovar = useRenovarRenta(acta.id);

  const renovables = acta.items.filter((it) => it.estado === 'PENDIENTE_DEVOLUCION' && TIPOS_RENTABLES(it));
  const [seleccion, setSeleccion] = useState<Record<string, boolean>>(
    () => Object.fromEntries(renovables.map((it) => [it.cotizacionItemId, true])),
  );

  const seleccionados = renovables.filter((it) => seleccion[it.cotizacionItemId]);
  const sugerido = periodoSugerido(acta, seleccionados);

  // Estado derivado en vez de sincronizado por efecto (evita setState dentro de
  // un useEffect, además de ser más simple): mientras el usuario no toque
  // ninguna fecha, ambas se recalculan solas con la selección. En cuanto edita
  // una, congelamos el PAR completo (no solo la que tocó) — si solo se frenara
  // el campo editado, un cambio de selección posterior podría recalcular la
  // otra fecha contra el "inicio" sugerido del sistema en vez del que el
  // usuario ya eligió, dejando un período inconsistente.
  const [manual, setManual] = useState<{ inicio: string; fin: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inicio = manual?.inicio ?? sugerido.inicio;
  const fin = manual?.fin ?? sugerido.fin;

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ids = Object.entries(seleccion).filter(([, v]) => v).map(([k]) => k);

  function nombre(it: Acta['items'][number]): string {
    return it.equipo?.nombre ?? it.herramientaUnidad?.herramientaTipo.nombre ?? it.piezaTipo?.nombre ?? 'Ítem';
  }

  function confirmar() {
    if (ids.length === 0) return;
    if (!inicio || !fin) { setError('Completá el período de renta'); return; }
    if (inicio > fin) { setError('La fecha de inicio debe ser anterior o igual al fin'); return; }
    setError(null);
    renovar.mutate(
      { cotizacionItemIds: ids, periodoRentaInicio: inicio, periodoRentaFin: fin },
      { onSuccess: (cot) => { router.push(`/cotizaciones/${cot.id}/editar?paso=1`); } },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-lg border border-bd bg-surface shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
          <div>
            <h3 className="text-sm font-semibold text-tx">Renovar renta</h3>
            <p className="text-xs text-tx-3 mt-0.5">Elegí el inventario a renovar y el período. Se creará una cotización vinculada a esta acta — el inventario ya entregado no requiere acta nueva.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-tx-3 hover:text-tx"><Icon name="x" size={16} /></button>
        </div>
        <div className="px-4 py-4 space-y-2 max-h-80 overflow-y-auto">
          {renovables.length === 0 ? (
            <p className="text-sm text-tx-3">No hay inventario rentable pendiente de devolución en esta acta.</p>
          ) : renovables.map((it) => (
            <label key={it.cotizacionItemId} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="accent-accent" checked={!!seleccion[it.cotizacionItemId]} onChange={(e) => setSeleccion((s) => ({ ...s, [it.cotizacionItemId]: e.target.checked }))} />
              {nombre(it)}
            </label>
          ))}
        </div>
        <div className="px-4 pb-4 pt-1 border-t border-bd space-y-2">
          <p className="text-xs font-medium text-tx-2">Período de renta</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs text-tx-3">Desde</span>
              <input
                type="date"
                value={inicio}
                onChange={(e) => setManual({ inicio: e.target.value, fin })}
                className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent transition-colors"
              />
            </label>
            <label className="block">
              <span className="text-xs text-tx-3">Hasta</span>
              <input
                type="date"
                value={fin}
                onChange={(e) => setManual({ inicio, fin: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent transition-colors"
              />
            </label>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-bd">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md border border-bd text-tx-2 text-sm hover:bg-bg-sunken">Cancelar</button>
          <button type="button" disabled={ids.length === 0 || renovar.isPending} onClick={confirmar} className="px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim disabled:opacity-50">
            {renovar.isPending ? 'Creando…' : 'Crear renovación'}
          </button>
        </div>
      </div>
    </div>
  );
}
