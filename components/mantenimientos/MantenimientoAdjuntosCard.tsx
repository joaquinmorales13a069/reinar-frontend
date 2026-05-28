'use client';

import { useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { useSubirAdjuntos, useEliminarAdjunto } from '@/hooks/use-mantenimientos';
import type { MantenimientoAdjunto } from '@/types/api';

const ACCEPT = 'image/*,application/pdf';
const KB = 1024;

function formatBytes(n: number): string {
  // Cifras humanas para el usuario; no necesitamos precision binaria estricta.
  if (n < KB) return `${n} B`;
  if (n < KB * KB) return `${(n / KB).toFixed(1)} KB`;
  return `${(n / (KB * KB)).toFixed(1)} MB`;
}

export function MantenimientoAdjuntosCard({
  mantenimientoId,
  adjuntos,
  readOnly,
  canDeleteAdjunto,
}: {
  mantenimientoId: string;
  adjuntos:        MantenimientoAdjunto[];
  readOnly?:       boolean;
  // El backend exige ADMIN/GERENTE/LOGISTICA para borrar adjuntos. OPERADOR puede
  // subir pero no eliminar. Si se omite, hereda del readOnly del card.
  canDeleteAdjunto?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const subir   = useSubirAdjuntos(mantenimientoId);
  const borrar  = useEliminarAdjunto(mantenimientoId);

  // showDelete separa el gate de eliminar (ADMIN/GERENTE/LOGISTICA) del de subir
  // (incluye OPERADOR). Si no se pasa canDeleteAdjunto, hereda el readOnly general.
  const showDelete = canDeleteAdjunto ?? !readOnly;

  function abrir(adj: MantenimientoAdjunto) {
    if (adj.archivoUrl) window.open(adj.archivoUrl, '_blank', 'noopener');
  }

  return (
    <div className="rounded-lg border border-bd bg-surface overflow-hidden">
      <div className="px-4 py-3 border-b border-bd flex items-center justify-between">
        <h3 className="font-semibold text-tx">Adjuntos</h3>
        {!readOnly && (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length === 0) return;
                subir.mutate(files);
                // Reseteamos el value para permitir resubir el mismo archivo si hace falta.
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={subir.isPending}
              className="text-sm px-3 py-1.5 rounded-md border border-bd hover:bg-bg-2 disabled:opacity-50"
            >
              {subir.isPending ? 'Subiendo…' : 'Subir archivos'}
            </button>
          </>
        )}
      </div>

      <div className="p-4">
        {adjuntos.length === 0 ? (
          <p className="text-sm text-tx-3">Sin adjuntos.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {adjuntos.map((adj) => (
              <li key={adj.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-bd">
                  <button
                    type="button"
                    onClick={() => abrir(adj)}
                    disabled={!adj.archivoUrl}
                    className="flex items-center gap-2 min-w-0 text-left hover:text-accent disabled:opacity-50"
                  >
                    <Icon name="copy" size={16} />
                    <span className="truncate text-sm">{adj.nombreArchivo}</span>
                    <span className="text-xs text-tx-3 shrink-0">{formatBytes(adj.tamaño)}</span>
                  </button>
                  {showDelete && (
                    <button
                      type="button"
                      onClick={() => setConfirmId(adj.id)}
                      className="text-sm px-2 py-1 rounded-md hover:bg-bg-2"
                      aria-label="Eliminar adjunto"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  )}
                </div>
                {showDelete && confirmId === adj.id && (
                  <ConfirmRow
                    message="¿Eliminar este adjunto?"
                    onCancel={() => setConfirmId(null)}
                    onConfirm={async () => {
                      await borrar.mutateAsync(adj.id);
                      setConfirmId(null);
                    }}
                    confirmLabel="Eliminar"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        {(subir.isPending || borrar.isPending) && (
          <div className="flex justify-center pt-3"><Spinner /></div>
        )}
      </div>
    </div>
  );
}
