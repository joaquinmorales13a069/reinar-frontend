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
  unidad?: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: (data: {
    bodegaOrigenId: string;
    bodegaDestinoId: string;
    cantidad: number;
    notas?: string;
  }) => void;
};

export function TransferirStockPanel({ unidad, isPending, onCancel, onConfirm }: Props) {
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [cantidad, setCantidad] = useState<number | ''>('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleConfirmar() {
    if (!origen)  return setError('Elegí la bodega de origen.');
    if (!destino) return setError('Elegí la bodega destino.');
    if (origen === destino) return setError('Origen y destino deben ser distintos.');
    const n = typeof cantidad === 'number' ? cantidad : Number(cantidad);
    if (!Number.isInteger(n) || n <= 0) return setError('Cantidad debe ser un entero mayor a 0.');
    setError(null);
    onConfirm({
      bodegaOrigenId: origen,
      bodegaDestinoId: destino,
      cantidad: n,
      notas: notas.trim() || undefined,
    });
  }

  return (
    <div className="rounded-lg border border-bd bg-surface p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-tx">Transferir entre bodegas</h3>
        <button type="button" className="text-tx-3 hover:text-tx" onClick={onCancel} aria-label="Cerrar">
          <Icon name="x" size={14} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-tx-2 mb-1">Bodega origen *</label>
          <BodegaSelect value={origen} onChange={(id) => { setOrigen(id); setError(null); }} />
        </div>
        <div>
          <label className="block text-xs font-medium text-tx-2 mb-1">Bodega destino *</label>
          <BodegaSelect value={destino} onChange={(id) => { setDestino(id); setError(null); }} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-tx-2 mb-1">
          Cantidad{unidad ? ` (${unidad})` : ''} *
        </label>
        <input
          className={`${inputBase} font-mono`}
          type="number"
          min={1}
          step={1}
          value={cantidad}
          onChange={(e) => {
            const v = e.target.value;
            setCantidad(v === '' ? '' : Number(v));
            setError(null);
          }}
        />
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
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className={btnSec} onClick={onCancel}>Cancelar</button>
        <button type="button" className={btnPri} disabled={isPending} onClick={handleConfirmar}>
          <Icon name="check" size={12} /> Transferir
        </button>
      </div>
    </div>
  );
}
