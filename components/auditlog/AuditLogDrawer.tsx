// components/auditlog/AuditLogDrawer.tsx
'use client';

import { useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { colorPorAccion } from '@/lib/auditlog';
import { formatDateTime, getInitials } from '@/lib/utils';
import type { AuditLog } from '@/types/api';

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function AuditLogDrawer({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  // Cerrar con Esc — patrón común en drawers; mejora accesibilidad de teclado.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const todasLasClaves = Array.from(new Set([
    ...(log.camposAntes ? Object.keys(log.camposAntes) : []),
    ...(log.camposDespues ? Object.keys(log.camposDespues) : []),
  ]));

  function diff(k: string): boolean {
    const a = log.camposAntes?.[k];
    const b = log.camposDespues?.[k];
    return formatValue(a) !== formatValue(b);
  }

  const usuarioLabel = log.usuario
    ? `${log.usuario.nombre} ${log.usuario.apellido}`
    : '(Usuario eliminado)';

  return (
    <>
      <div className="fixed inset-0 bg-navy/50 z-40" onClick={onClose} />
      {/* Ancho del drawer: 28rem (~448px) — valor que no está en el spacing
          scale default de Tailwind; aceptado por ser único en el proyecto. */}
      <aside
        className="fixed right-0 top-0 bottom-0 w-full sm:w-[28rem] bg-surface border-l border-bd z-50 flex flex-col"
        role="dialog"
        aria-label="Detalle del registro de auditoría"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
          <h3 className="font-semibold text-base">Detalle del registro</h3>
          <button
            type="button"
            onClick={onClose}
            className="size-7 grid place-items-center rounded text-tx-3 hover:bg-bg-sunken hover:text-tx transition-colors"
            aria-label="Cerrar"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <section className="mb-5">
            <div className="text-2xs uppercase tracking-wider font-semibold text-tx-3 mb-2">Quién y cuándo</div>
            <div className="flex items-center gap-2 mb-3">
              <div className="size-8 rounded-full bg-bg-sunken text-tx-2 grid place-items-center text-xs font-semibold">
                {log.usuario ? getInitials(usuarioLabel) : '?'}
              </div>
              <div>
                <div className="font-semibold text-sm">{usuarioLabel}</div>
                {log.usuario && <div className="text-2xs text-tx-3">{log.usuario.email}</div>}
              </div>
            </div>
            <dl className="space-y-1.5 text-sm">
              <Row label="Fecha y hora" value={<span className="font-mono">{formatDateTime(log.createdAt)}</span>} />
              <Row label="IP" value={<span className="font-mono text-2xs text-tx-2">{log.ip ?? '—'}</span>} />
              <Row label="User-Agent" value={<span className="font-mono text-2xs text-tx-2 break-all">{log.userAgent ?? '—'}</span>} />
              <Row label="Entidad" value={<><span className="font-medium">{log.entidad}</span> <span className="font-mono text-xs text-tx-3 ml-1">{log.entidadId}</span></>} />
              <Row label="Acción" value={<Badge status={log.accion} kind={colorPorAccion(log.accion)} />} />
            </dl>
          </section>

          <section>
            <div className="text-2xs uppercase tracking-wider font-semibold text-tx-3 mb-2">Cambios registrados</div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <div className="text-2xs text-tx-3 mb-1.5 font-semibold">Antes</div>
                <div className="bg-bg-sunken rounded p-2.5 text-xs">
                  {log.camposAntes ? (
                    // Capturamos en variable local para que TS estreche el tipo dentro del map.
                    (() => {
                      const antes = log.camposAntes;
                      return todasLasClaves.map((k) => (
                        <div
                          key={k}
                          className={`grid grid-cols-[auto_1fr] gap-1.5 px-1.5 py-1 rounded ${
                            diff(k) ? 'bg-danger-soft line-through' : ''
                          }`}
                        >
                          <span className="text-tx-3">{k}:</span>
                          <span className="font-mono break-all">{formatValue(antes[k])}</span>
                        </div>
                      ));
                    })()
                  ) : (
                    <em className="text-tx-3">Sin estado previo registrado</em>
                  )}
                </div>
              </div>
              <div>
                <div className="text-2xs text-tx-3 mb-1.5 font-semibold">Después</div>
                <div className="bg-bg-sunken rounded p-2.5 text-xs">
                  {log.camposDespues ? (
                    // Capturamos en variable local para que TS estreche el tipo dentro del map.
                    (() => {
                      const despues = log.camposDespues;
                      return todasLasClaves.map((k) => (
                        <div
                          key={k}
                          className={`grid grid-cols-[auto_1fr] gap-1.5 px-1.5 py-1 rounded ${
                            diff(k) ? 'bg-ok-soft font-bold' : ''
                          }`}
                        >
                          <span className="text-tx-3">{k}:</span>
                          <span className="font-mono break-all">{formatValue(despues[k])}</span>
                        </div>
                      ));
                    })()
                  ) : (
                    <em className="text-tx-3">Registro eliminado</em>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2">
      <dt className="text-tx-3">{label}</dt>
      <dd className="text-tx">{value}</dd>
    </div>
  );
}
