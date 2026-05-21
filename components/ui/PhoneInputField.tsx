'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { getCountries, getCountryCallingCode } from 'react-phone-number-input';
import type { Country } from 'react-phone-number-input';
import { Controller, type Control, type FieldValues, type FieldPath } from 'react-hook-form';
import labels from 'react-phone-number-input/locale/es.json';

type CountryOption = { code: Country; name: string; dialCode: string };

const ALL_COUNTRIES: CountryOption[] = (() => {
  const list = getCountries()
    .map((code) => ({
      code,
      name: (labels as Record<string, string>)[code] ?? code,
      dialCode: `+${getCountryCallingCode(code)}`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  // El Salvador siempre primero
  const sv = list.find((c) => c.code === 'SV');
  const rest = list.filter((c) => c.code !== 'SV');
  return sv ? [sv, ...rest] : list;
})();

function parseDialCode(value: string): { country: Country; localDigits: string } {
  if (!value || !value.startsWith('+')) return { country: 'SV', localDigits: value.replace(/\D/g, '') };

  // Intenta aislar el código de marcación comparando con códigos conocidos (de mayor a menor longitud)
  for (const { code } of ALL_COUNTRIES) {
    const dial = `+${getCountryCallingCode(code)}`;
    if (value.startsWith(dial)) {
      return { country: code, localDigits: value.slice(dial.length).replace(/\D/g, '') };
    }
  }
  return { country: 'SV', localDigits: value.replace(/\D/g, '') };
}

type Props<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> = {
  control: Control<TFieldValues>;
  name: TName;
  error?: boolean;
  placeholder?: string;
};

function PhoneInputInner({
  value,
  onChange,
  onBlur,
  error,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  error?: boolean;
  placeholder: string;
}) {
  const initial = useMemo(() => parseDialCode(value), []);
  const [country, setCountry] = useState<Country>(initial.country);
  const [localInput, setLocalInput] = useState(initial.localDigits);

  // Sincroniza cuando el formulario se reinicia externamente (ej. carga de datos existentes)
  const prevRef = useRef(value);
  useEffect(() => {
    if (value !== prevRef.current) {
      prevRef.current = value;
      if (value) {
        const { country: c, localDigits } = parseDialCode(value);
        setCountry(c);
        setLocalInput(localDigits);
      } else {
        setCountry('SV');
        setLocalInput('');
      }
    }
  }, [value]);

  function emit(c: Country, local: string) {
    const dial = `+${getCountryCallingCode(c)}`;
    const digits = local.replace(/\D/g, '');
    onChange(digits ? `${dial}${digits}` : '');
  }

  function handleCountryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const code = e.target.value as Country;
    setCountry(code);
    emit(code, localInput);
  }

  function handleLocalChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 12);
    setLocalInput(raw);
    emit(country, raw);
  }

  const borderCls = error ? 'border-danger' : 'border-bd';

  return (
    <div className={`flex items-stretch overflow-hidden rounded-md border bg-surface transition-colors focus-within:border-accent ${borderCls}`}>
      <select
        value={country}
        onChange={handleCountryChange}
        className="w-24 shrink-0 border-r border-bd bg-bg-sunken px-2 py-2 text-sm text-tx-2 focus:outline-none cursor-pointer"
        aria-label="Código de país"
      >
        {ALL_COUNTRIES.map(({ code, name, dialCode }) => (
          <option key={code} value={code}>
            {dialCode} — {name}
          </option>
        ))}
      </select>
      <input
        type="tel"
        value={localInput}
        onChange={handleLocalChange}
        onBlur={onBlur}
        placeholder={placeholder}
        maxLength={12}
        inputMode="numeric"
        className="flex-1 min-w-0 px-3 py-2 text-sm font-mono bg-transparent text-tx placeholder:text-tx-3 focus:outline-none"
      />
    </div>
  );
}

export function PhoneInputField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ control, name, error, placeholder = '7777-0000' }: Props<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <PhoneInputInner
          value={field.value ?? ''}
          onChange={field.onChange}
          onBlur={field.onBlur}
          error={error}
          placeholder={placeholder}
        />
      )}
    />
  );
}
