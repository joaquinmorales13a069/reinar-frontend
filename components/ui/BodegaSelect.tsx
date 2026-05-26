'use client';

import { useBodegas } from '@/hooks/use-bodegas';

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx focus:outline-none focus:border-accent transition-colors';

type Props = {
  value: string;
  onChange: (id: string) => void;
  error?: boolean;
  disabled?: boolean;
  // Si se omite o false: solo bodegas principales activas.
  // Si true: incluye zonas activas indentadas bajo cada principal.
  includeZonas?: boolean;
  // bodegaIds permitidos (opcional). Filtra el listado a estos ids únicamente.
  // Útil cuando la API ya devolvió "bodegas con items disponibles".
  filterIds?: Set<string>;
  placeholder?: string;
};

export function BodegaSelect({
  value,
  onChange,
  error,
  disabled,
  includeZonas = true,
  filterIds,
  placeholder = 'Seleccionar bodega…',
}: Props) {
  const { data: bodegas, isLoading } = useBodegas();

  return (
    <select
      className={`${inputBase} ${error ? 'border-danger' : 'border-bd'}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || isLoading}
    >
      <option value="">{isLoading ? 'Cargando bodegas…' : placeholder}</option>
      {(bodegas ?? [])
        .filter((b) => b.activa)
        .filter((b) => !filterIds || filterIds.has(b.id))
        .map((b) => (
          <optgroup key={b.id} label={b.nombre}>
            <option value={b.id}>{b.nombre} — Central</option>
            {includeZonas &&
              (b.zonas ?? [])
                .filter((z) => z.activa)
                .filter((z) => !filterIds || filterIds.has(z.id))
                .map((z) => (
                  <option key={z.id} value={z.id}>
                    {b.nombre} › {z.nombre}
                  </option>
                ))}
          </optgroup>
        ))}
    </select>
  );
}
