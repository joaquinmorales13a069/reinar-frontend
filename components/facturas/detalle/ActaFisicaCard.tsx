'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useActualizarFactura } from '@/hooks/use-facturas';
import { useActasDeFactura } from '@/hooks/use-actas';
import type { Factura } from '@/types/api';

const inputCls =
  'w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent transition-colors';

// Folio del talonario físico de actas Reinar que se imprime en el PDF de la
// factura. Prioridad: folios reales de las actas despachadas; si no hay
// ninguno, el folio manual guardado en la factura (editable acá).
export function ActaFisicaCard({ factura }: { factura: Factura }) {
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeEscribir = rol !== undefined && rol !== 'VISUALIZADOR';
  const anulada = factura.estado === 'ANULADA';
  const soloLectura = !puedeEscribir || anulada;

  const actas = useActasDeFactura(factura.id);
  const folios = (actas.data?.data ?? [])
    .map((a) => a.numeroActaFisico)
    .filter((f): f is string => !!f);

  const [manual, setManual] = useState(factura.numeroActaFisicoManual ?? '');
  // Re-sincroniza el input cuando cambia el valor persistido (tras guardar o
  // refetch) sin pisar el tipeo en curso. Patrón oficial de React de "ajustar
  // estado durante el render" — evita el setState-en-effect que lintea como error.
  const [persistido, setPersistido] = useState(factura.numeroActaFisicoManual);
  if (factura.numeroActaFisicoManual !== persistido) {
    setPersistido(factura.numeroActaFisicoManual);
    setManual(factura.numeroActaFisicoManual ?? '');
  }

  const actualizar = useActualizarFactura();

  return (
    <div className={`bg-bg border border-bd rounded-md p-4 ${anulada ? 'opacity-60' : ''}`}>
      <h3 className="text-sm font-medium text-tx mb-3">Acta(s) físicas</h3>
      {folios.length > 0 ? (
        <p className="text-sm font-mono text-tx">{folios.join(', ')}</p>
      ) : soloLectura ? (
        <p className="text-sm font-mono text-tx">{factura.numeroActaFisicoManual ?? '—'}</p>
      ) : (
        <>
          <label className="block text-xs font-medium text-tx-2 mb-1">
            Folio del talonario (manual)
          </label>
          <input
            className={`${inputCls} font-mono`}
            placeholder="Ej. 0451"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
          <p className="text-xs text-tx-3 mt-2">
            Se muestra en el PDF mientras la factura no tenga actas despachadas con folio físico.
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={actualizar.isPending}
              onClick={() => {
                void actualizar.mutateAsync({
                  id: factura.id,
                  data: { numeroActaFisicoManual: manual.trim() || null },
                });
              }}
              className="px-4 py-2 text-sm rounded-md bg-accent text-navy font-medium hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              {actualizar.isPending ? 'Guardando…' : 'Guardar folio'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
