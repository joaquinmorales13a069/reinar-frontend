'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import {
  descargarFacturaPdfBranded,
  descargarFacturaPdfOficialDTE,
  descargarFacturaJsonDTE,
} from '@/hooks/use-facturas';
import type { FacturaListItem } from '@/types/api';

// Menú de descargas por fila. El "⋯" agrupa PDF de sistema (siempre) + DTE en
// PDF y JSON (solo con DTE aprobado). Vive dentro de una fila clickeable, por
// eso cada handler hace stopPropagation para no navegar al detalle.
export function FacturaDescargasMenu({ factura }: { factura: FacturaListItem }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const dteAprobado = factura.estadoDTE === 'APROBADO';
  const item = 'flex items-center gap-2 w-full px-3 py-2 text-sm text-tx-2 hover:bg-bg-sunken text-left';

  function run(fn: () => void) {
    setOpen(false);
    fn();
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        title="Descargas"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center justify-center w-8 h-8 rounded text-tx-3 hover:bg-bg hover:text-tx transition-colors"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
      >
        <Icon name="moreV" size={14} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-bd bg-bg shadow-lg py-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={(e) => { e.stopPropagation(); run(() => descargarFacturaPdfBranded(factura.id, factura.numeroFactura)); }}
          >
            <Icon name="download" size={14} /> Descargar PDF (sistema)
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!dteAprobado}
            title={dteAprobado ? undefined : 'Disponible cuando el DTE está aprobado'}
            className={`${item} disabled:opacity-40 disabled:cursor-not-allowed`}
            onClick={(e) => { e.stopPropagation(); run(() => descargarFacturaPdfOficialDTE(factura.id, factura.numeroFactura)); }}
          >
            <Icon name="fileText" size={14} /> Descargar DTE (PDF)
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!dteAprobado}
            title={dteAprobado ? undefined : 'Disponible cuando el DTE está aprobado'}
            className={`${item} disabled:opacity-40 disabled:cursor-not-allowed`}
            onClick={(e) => { e.stopPropagation(); run(() => descargarFacturaJsonDTE(factura.id, factura.numeroFactura)); }}
          >
            <Icon name="clipboard" size={14} /> Descargar DTE (JSON)
          </button>
        </div>
      )}
    </div>
  );
}
