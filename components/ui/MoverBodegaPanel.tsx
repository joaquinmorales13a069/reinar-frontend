'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { BodegaSelect } from '@/components/ui/BodegaSelect';

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border border-bd bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const btnSec =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';
const btnPri =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

type Props = {
  // Bodega/zona donde está actualmente — se excluye del selector para que la
  // operación tenga sentido (no se puede mover a la misma bodega).
  currentBodegaId: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: (data: { bodegaDestinoId: string; notas?: string }) => void;
};

export function MoverBodegaPanel({ currentBodegaId, isPending, onCancel, onConfirm }: Props) {
  const [bodegaDestinoId, setBodegaDestinoId] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleConfirmar() {
    if (!bodegaDestinoId) {
      setError('Elegí una bodega destino.');
      return;
    }
    if (bodegaDestinoId === currentBodegaId) {
      setError('Bodega destino debe ser distinta a la actual.');
      return;
    }
    setError(null);
    onConfirm({ bodegaDestinoId, notas: notas.trim() || undefined });
  }

  return (
    <div className="rounded-lg border border-bd bg-surface p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-tx">Mover a otra bodega</h3>
        <button type="button" className="text-tx-3 hover:text-tx" onClick={onCancel} aria-label="Cerrar">
          <Icon name="x" size={14} />
        </button>
      </div>
      <div>
        <label className="block text-xs font-medium text-tx-2 mb-1">Bodega destino *</label>
        <BodegaSelect
          value={bodegaDestinoId}
          onChange={(id) => { setBodegaDestinoId(id); if (id) setError(null); }}
          error={!!error}
        />
        {error && <p className="text-xs text-danger mt-1">{error}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-tx-2 mb-1">Notas (opcional)</label>
        <textarea
          className={inputBase}
          rows={2}
          placeholder="Motivo del movimiento — queda registrado en auditoría."
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className={btnSec} onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className={btnPri} disabled={isPending} onClick={handleConfirmar}>
          <Icon name="check" size={12} /> Mover
        </button>
      </div>
    </div>
  );
}
