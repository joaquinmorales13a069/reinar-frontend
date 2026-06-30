'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useRenovarRenta } from '@/hooks/use-actas';
import type { Acta } from '@/types/api';

// Solo se renuevan ítems rentables que siguen en obra.
const TIPOS_RENTABLES = (it: Acta['items'][number]) =>
  !!it.equipo || !!it.herramientaUnidad || !!it.piezaTipo;

export function RenovarRentaModal({ acta, onClose }: { acta: Acta; onClose: () => void }) {
  const router = useRouter();
  const renovar = useRenovarRenta(acta.id);

  const renovables = acta.items.filter((it) => it.estado === 'PENDIENTE_DEVOLUCION' && TIPOS_RENTABLES(it));
  const [seleccion, setSeleccion] = useState<Record<string, boolean>>(
    () => Object.fromEntries(renovables.map((it) => [it.cotizacionItemId, true])),
  );

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
    renovar.mutate(ids, {
      onSuccess: (cot) => { router.push(`/cotizaciones/${cot.id}/editar?paso=1`); },
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-lg border border-bd bg-surface shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
          <div>
            <h3 className="text-sm font-semibold text-tx">Renovar renta</h3>
            <p className="text-xs text-tx-3 mt-0.5">Elegí el inventario a renovar. Se creará una cotización vinculada a esta acta.</p>
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
