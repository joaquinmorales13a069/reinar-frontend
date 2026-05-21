'use client';

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
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
              chip.active
                ? 'bg-accent text-navy border-accent font-medium'
                : 'text-tx-2 border-bd hover:bg-bg-sunken'
            }`}
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
