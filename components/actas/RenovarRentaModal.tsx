'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useRenovarRenta } from '@/hooks/use-actas';
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

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// El período sugerido arranca el día siguiente al fin vigente del acta. Si el
// acta no tiene fin o ya venció, arranca hoy: renovar una renta vencida es un
// caso real y no debe proponer fechas en el pasado.
function periodoSugerido(acta: Acta, seleccionados: Acta['items']): { inicio: string; fin: string } {
  const hoy = new Date();
  hoy.setUTCHours(0, 0, 0, 0);
  const finActa = acta.periodoRentaFin ? new Date(acta.periodoRentaFin) : null;
  const base = finActa && finActa >= hoy ? new Date(finActa.getTime() + 86400000) : hoy;

  const dias = seleccionados.length > 0 ? Math.max(...seleccionados.map(duracionDias)) : 30;
  const fin = new Date(base.getTime() + (dias - 1) * 86400000);
  return { inicio: toDateInput(base), fin: toDateInput(fin) };
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
