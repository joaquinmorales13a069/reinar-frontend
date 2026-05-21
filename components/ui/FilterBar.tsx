'use client';

import { useState, useRef, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';

type Chip = { label: string; active: boolean; onToggle: () => void };

type FilterBarProps = {
  search: string;
  onSearch: (v: string) => void;
  placeholder?: string;
  chips?: Chip[];
  onClear: () => void;
};

export function FilterBar({ search, onSearch, placeholder, chips = [], onClear }: FilterBarProps) {
  const hasFilters = !!search || chips.some((c) => c.active);
  const activeCount = chips.filter((c) => c.active).length;
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const pillCls = (active: boolean) =>
    `px-2.5 py-1 rounded-full text-xs border transition-colors ${
      active ? 'bg-accent text-navy border-accent font-medium' : 'text-tx-2 border-bd hover:bg-bg-sunken'
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-bd">
      <div className="relative flex-1 min-w-40 max-w-xs">
        <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-3 pointer-events-none" />
        <input
          className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-bd bg-bg text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors"
          placeholder={placeholder ?? 'Buscar…'}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>

      {/* Dropdown de filtros — solo en pantallas < lg */}
      {chips.length > 0 && (
        <div className="relative flex lg:hidden" ref={dropdownRef}>
          <button
            type="button"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-colors ${
              activeCount > 0 ? 'border-accent bg-accent text-navy font-medium' : 'border-bd text-tx-2 hover:bg-bg-sunken'
            }`}
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name="filter" size={12} />
            Filtros
            {activeCount > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-navy text-accent text-[10px] font-bold leading-none">
                {activeCount}
              </span>
            )}
            <Icon name="chevronDown" size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute left-0 top-full mt-1 z-20 min-w-44 rounded-lg border border-bd bg-surface shadow-lg py-1">
              {chips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-sm transition-colors hover:bg-bg-sunken ${
                    chip.active ? 'text-accent font-medium' : 'text-tx'
                  }`}
                  onClick={chip.onToggle}
                >
                  {chip.label}
                  {chip.active && <Icon name="check" size={12} className="text-accent shrink-0" />}
                </button>
              ))}
              {hasFilters && (
                <div className="border-t border-bd mt-1 pt-1">
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-danger hover:bg-bg-sunken transition-colors"
                    onClick={() => { onClear(); setOpen(false); }}
                  >
                    <Icon name="x" size={11} /> Limpiar filtros
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pills — solo en pantallas lg+ */}
      <div className="hidden lg:flex flex-wrap items-center gap-1.5">
        {chips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            className={pillCls(chip.active)}
            onClick={chip.onToggle}
          >
            {chip.label}
          </button>
        ))}
        {hasFilters && (
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 text-xs text-tx-3 hover:text-danger transition-colors"
            onClick={onClear}
          >
            <Icon name="x" size={11} /> Limpiar
          </button>
        )}
      </div>
    </div>
  );
}
