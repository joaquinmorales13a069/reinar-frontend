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
    <div className="filterbar">
      <div className="input-wrap">
        <Icon name="search" size={14} className="input-wrap__icon" />
        <input
          className="input input--with-icon"
          placeholder={placeholder ?? 'Buscar…'}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <div className="chips">
        {chips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            className={`chip${chip.active ? ' chip--active' : ''}`}
            onClick={chip.onToggle}
          >
            {chip.label}
          </button>
        ))}
        {hasFilters && (
          <button type="button" className="filterbar__clear" onClick={onClear}>
            <Icon name="x" size={11} /> Limpiar
          </button>
        )}
      </div>
    </div>
  );
}
