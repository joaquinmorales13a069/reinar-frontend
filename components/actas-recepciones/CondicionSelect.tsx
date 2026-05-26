'use client';

import type { CondicionItem } from '@/types/api';

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border border-bd bg-surface text-tx focus:outline-none focus:border-accent transition-colors disabled:opacity-60';

type Props = {
  value: CondicionItem | undefined;
  onChange: (v: CondicionItem) => void;
  disabled?: boolean;
  id?: string;
};

export function CondicionSelect({ value, onChange, disabled, id }: Props) {
  return (
    <select
      id={id}
      className={inputBase}
      value={value ?? 'BUENO'}
      onChange={(e) => onChange(e.target.value as CondicionItem)}
      disabled={disabled}
    >
      <option value="BUENO">Bueno</option>
      <option value="REGULAR">Regular</option>
      <option value="MALO">Malo</option>
    </select>
  );
}
