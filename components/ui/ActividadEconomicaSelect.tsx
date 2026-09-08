'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import {
  ACTIVIDADES_ECONOMICAS_SV,
  SECTORES_CAT019,
  getActividadByCodigo,
  type ActividadEconomica,
} from '@/lib/cat019';

type Props = {
  /** Código CAT-019 seleccionado; '' cuando no hay ninguno. */
  value: string;
  /** Recibe la actividad completa (con su sector) o null al limpiar. */
  onChange: (actividad: ActividadEconomica | null) => void;
  /** Si viene, restringe la lista a ese sector. */
  sector?: string;
  hasError?: boolean;
  disabled?: boolean;
  placeholder?: string;
};

// Sin acentos y en minúsculas para que "construccion" encuentre "Construcción".
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function ActividadEconomicaSelect({
  value,
  onChange,
  sector,
  hasError = false,
  disabled = false,
  placeholder = '— Seleccionar actividad —',
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const seleccionada = value ? getActividadByCodigo(value) : undefined;

  function cerrar() {
    setOpen(false);
    setSearch('');
  }

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) cerrar();
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const grupos = useMemo(() => {
    const base = sector
      ? ACTIVIDADES_ECONOMICAS_SV.filter((a) => a.sector === sector)
      : ACTIVIDADES_ECONOMICAS_SV;
    const q = normalizar(search.trim());
    const filtradas = q
      ? base.filter((a) => a.codigo.includes(q) || normalizar(a.descripcion).includes(q))
      : base;
    // Agrupamos por sector solo cuando se recorre el catálogo completo; con sector
    // fijo el encabezado sería redundante.
    if (sector) return [{ sector, actividades: filtradas }];
    return SECTORES_CAT019
      .map((s) => ({ sector: s, actividades: filtradas.filter((a) => a.sector === s) }))
      .filter((g) => g.actividades.length > 0);
  }, [sector, search]);

  const total = grupos.reduce((n, g) => n + g.actividades.length, 0);

  function seleccionar(a: ActividadEconomica | null) {
    onChange(a);
    cerrar();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-md border bg-surface text-left transition-colors focus:outline-none focus:border-accent disabled:opacity-60 disabled:cursor-not-allowed ${hasError ? 'border-danger' : 'border-bd'}`}
        onClick={() => { setOpen((v) => !v); setSearch(''); }}
      >
        <span className={`truncate ${seleccionada ? 'text-tx' : 'text-tx-3'}`}>
          {seleccionada
            ? <><span className="font-mono">{seleccionada.codigo}</span> — {seleccionada.descripcion}</>
            : placeholder}
        </span>
        <Icon name="chevronDown" size={14} className={`text-tx-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 w-full mt-1 rounded-md border border-bd bg-surface shadow-lg">
          <div className="p-2 border-b border-bd">
            <input
              autoFocus
              type="text"
              placeholder="Buscar por código o descripción…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { e.preventDefault(); cerrar(); }
                // Enter toma el primer resultado visible para no obligar a usar el mouse.
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const primera = grupos[0]?.actividades[0];
                  if (primera) seleccionar(primera);
                }
              }}
              className="w-full px-2.5 py-1.5 text-sm rounded border border-bd bg-bg text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {seleccionada && !search && (
              <div
                className="px-3 py-2 text-sm text-tx-3 cursor-pointer hover:bg-bg-sunken transition-colors border-b border-bd"
                onMouseDown={(e) => { e.preventDefault(); seleccionar(null); }}
              >
                Quitar actividad seleccionada
              </div>
            )}
            {total === 0 ? (
              <div className="px-3 py-4 text-sm text-tx-3 text-center">Sin resultados</div>
            ) : (
              grupos.map((g) => (
                <div key={g.sector}>
                  {!sector && (
                    <div className="px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-tx-3 bg-bg-sunken sticky top-0">
                      {g.sector}
                    </div>
                  )}
                  {g.actividades.map((a) => (
                    <div
                      key={a.codigo}
                      className={`px-3 py-2 cursor-pointer hover:bg-bg-sunken transition-colors ${a.codigo === value ? 'bg-bg-sunken' : ''}`}
                      onMouseDown={(e) => { e.preventDefault(); seleccionar(a); }}
                    >
                      <div className="text-sm text-tx">
                        <span className="font-mono text-tx-2">{a.codigo}</span> — {a.descripcion}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
