'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useCrearUnidad } from '@/hooks/use-herramientas';

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border border-bd bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const btnSec =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';
const btnPri =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

export function UnidadCreatePanel({ tipoId }: { tipoId: string }) {
  const [open, setOpen] = useState(false);
  const [notas, setNotas] = useState('');
  const crear = useCrearUnidad();

  async function handleConfirmar() {
    try {
      await crear.mutateAsync({ tipoId, data: { notas: notas.trim() || undefined } });
      setNotas('');
      setOpen(false);
    } catch {
      // toast lo dispara el hook
    }
  }

  if (!open) {
    return (
      <button type="button" className={btnSec} onClick={() => setOpen(true)}>
        <Icon name="plus" size={12} /> Agregar unidad
      </button>
    );
  }

  return (
    <div className="rounded-md border border-bd bg-bg-sunken p-3 flex flex-col gap-2">
      <label className="text-xs font-medium text-tx-2">
        Notas (opcional)
      </label>
      <textarea
        className={inputBase}
        rows={2}
        placeholder="Notas internas sobre la unidad — opcional"
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
      />
      <p className="text-xs text-tx-3">
        El código interno se genera automáticamente al crear la unidad.
      </p>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          className={btnSec}
          onClick={() => {
            setOpen(false);
            setNotas('');
          }}
        >
          Cancelar
        </button>
        <button
          type="button"
          className={btnPri}
          disabled={crear.isPending}
          onClick={handleConfirmar}
        >
          <Icon name="check" size={12} /> Crear unidad
        </button>
      </div>
    </div>
  );
}
