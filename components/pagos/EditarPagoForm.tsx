'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useActualizarPago } from '@/hooks/use-pagos';

type Props = {
  facturaId: string;
  pagoId: string;
  referenciaActual: string | null;
  notasActuales: string | null;
  onCancel: () => void;
  onSuccess?: () => void;
};

// Form inline (en una fila acordeón de la tabla o expandido en PagosCard).
// Solo referencia y notas se exponen para edición — el backend rechazaría
// cualquier otro campo aunque lo enviáramos. Validación local: al menos uno
// de los dos debe cambiar respecto a los valores actuales.
export function EditarPagoForm({ facturaId, pagoId, referenciaActual, notasActuales, onCancel, onSuccess }: Props) {
  const [referencia, setReferencia] = useState(referenciaActual ?? '');
  const [notas, setNotas] = useState(notasActuales ?? '');
  const [error, setError] = useState<string | null>(null);
  const actualizar = useActualizarPago();

  // Comparación normalizada: tratamos '' y null como equivalentes (campo vacío).
  const refCambia   = (referencia.trim() || null) !== (referenciaActual ?? null);
  const notasCambia = (notas.trim() || null) !== (notasActuales ?? null);
  const haCambiado  = refCambia || notasCambia;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!haCambiado) {
      setError('Modifica al menos un campo antes de guardar.');
      return;
    }
    setError(null);
    try {
      await actualizar.mutateAsync({
        facturaId,
        pagoId,
        // Solo enviamos los campos que efectivamente cambiaron. El backend
        // exige al menos uno y nosotros lo validamos arriba.
        data: {
          ...(refCambia   && { referencia: referencia.trim() }),
          ...(notasCambia && { notas:      notas.trim() }),
        },
      });
      onSuccess?.();
    } catch (err) {
      const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(anyErr?.response?.data?.error?.message ?? 'No se pudo actualizar el pago.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="bg-bg-sunken border border-bd rounded-md p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-tx">Editar pago</h4>
        <button type="button" onClick={onCancel} className="text-tx-3 hover:text-tx" title="Cerrar">
          <Icon name="x" size={14} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="sm:col-span-2">
          <label className="block text-xs text-tx-3 mb-1">Referencia</label>
          <input
            type="text"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            maxLength={200}
            placeholder="N° transferencia, cheque…"
            className="w-full px-2 py-1.5 rounded border border-bd bg-bg font-mono"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-tx-3 mb-1">Notas</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            maxLength={500}
            rows={2}
            className="w-full px-2 py-1.5 rounded border border-bd bg-bg text-sm"
          />
        </div>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-md text-xs font-medium border border-bd text-tx-2 hover:bg-bg"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={actualizar.isPending || !haCambiado}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-accent text-navy hover:bg-accent-dim disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon name="check" size={12} /> {actualizar.isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
