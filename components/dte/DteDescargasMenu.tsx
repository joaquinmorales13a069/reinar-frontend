'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';

export type DescargaDteItem = {
  label: string;        // ej. 'PDF oficial' — el trigger de una sola opción antepone "Descargar "
  loadingLabel: string; // ej. 'Generando…'
  icon: IconName;
  isLoading?: boolean;
  onClick: () => void;
};

const triggerCls =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim disabled:opacity-50';

// Botón amarillo unificado de descargas del panel DTE (feedback REINAR).
// Compartido por DteSection (facturas/notas) y FseDtePanel; el patrón de
// dropdown replica FacturaDescargasMenu (open + mousedown fuera + role=menu).
export function DteDescargasMenu({ items }: { items: DescargaDteItem[] }) {
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

  if (items.length === 0) return null;

  // Con una sola opción un dropdown no aporta: el botón descarga directo.
  if (items.length === 1) {
    const item = items[0];
    return (
      <button type="button" className={triggerCls} onClick={item.onClick} disabled={item.isLoading}>
        <Icon name="download" size={14} /> {item.isLoading ? item.loadingLabel : `Descargar ${item.label}`}
      </button>
    );
  }

  // El menú se cierra al hacer click en una opción, así que el feedback de
  // progreso tiene que vivir en el trigger.
  const enCurso = items.find((i) => i.isLoading);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        className={triggerCls}
        disabled={!!enCurso}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="download" size={14} />
        {enCurso ? enCurso.loadingLabel : 'Descargar'}
        <Icon name="chevronDown" size={12} />
      </button>

      {open && (
        <div role="menu" className="absolute left-0 z-20 mt-1 w-56 rounded-md border border-bd bg-bg shadow-lg py-1">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.isLoading}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-tx-2 hover:bg-bg-sunken text-left disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => { setOpen(false); item.onClick(); }}
            >
              <Icon name={item.icon} size={14} /> {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
