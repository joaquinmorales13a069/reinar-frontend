'use client';

import { useState } from 'react';
import { useActualizarFactura } from '@/hooks/use-facturas';
import type { Factura } from '@/types/api';

// Edita factura.notas — el PDF de factura ya lo muestra como sección "Observaciones".
export function ObservacionesCard({ factura, puedeEscribir }: { factura: Factura; puedeEscribir: boolean }) {
  const anulada = factura.estado === 'ANULADA';
  const soloLectura = !puedeEscribir || anulada;
  const [notas, setNotas] = useState(factura.notas ?? '');
  const actualizar = useActualizarFactura();

  async function guardar() {
    await actualizar.mutateAsync({ id: factura.id, data: { notas } });
  }

  return (
    <div className={`bg-bg border border-bd rounded-md p-4 ${anulada ? 'opacity-60' : ''}`}>
      <h3 className="text-sm font-medium text-tx mb-3">Observaciones</h3>
      {soloLectura ? (
        <p className="text-sm text-tx whitespace-pre-wrap">{factura.notas || '—'}</p>
      ) : (
        <>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Notas que aparecerán en el PDF de la factura…"
            className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors"
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={actualizar.isPending || notas === (factura.notas ?? '')}
              onClick={() => { void guardar(); }}
              className="px-4 py-2 text-sm rounded-md bg-accent text-navy font-medium hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              {actualizar.isPending ? 'Guardando…' : 'Guardar observaciones'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
