'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { emailItemSchema } from '@/lib/schemas/ajustes';

type EmailsInputProps = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  // id opcional para que el <label htmlFor> del caller asocie el campo
  // correctamente — sin esto los lectores de pantalla no enlazan label e input.
  id?: string;
  // error se muestra debajo del input; los errores de items individuales
  // (duplicado, inválido) se muestran internamente y no propagan.
  error?: string;
};

export function EmailsInput({ value, onChange, placeholder, disabled, id, error }: EmailsInputProps) {
  const [draft, setDraft] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  function tryCommit(raw: string) {
    const trimmed = raw.trim().replace(/,$/, '').trim();
    if (!trimmed) {
      setDraft('');
      setLocalError(null);
      return;
    }
    const parsed = emailItemSchema.safeParse(trimmed);
    if (!parsed.success) {
      setLocalError('Email inválido');
      return;
    }
    // Duplicados se descartan silenciosamente (sin error visible) para no
    // saturar la UI cuando el usuario pega una lista que se solapa con la actual.
    if (value.includes(parsed.data)) {
      setDraft('');
      setLocalError(null);
      return;
    }
    onChange([...value, parsed.data]);
    setDraft('');
    setLocalError(null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Enter, coma y Tab confirman el email actual. Tab cae a blur en la siguiente
    // pasada, pero comprometemos aquí también para no perder el draft al tabular.
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      tryCommit(draft);
    }
    // Backspace en input vacío elimina el último chip — atajo común en este tipo de input.
    if (e.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  function removeAt(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  const inputBorder = localError || error ? 'border-danger' : 'border-bd';

  return (
    <div>
      <div className={`flex flex-wrap items-center gap-1.5 px-2 py-1.5 rounded-md border bg-surface transition-colors focus-within:border-accent ${inputBorder} ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`}>
        {value.map((email, idx) => (
          <span key={email} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-bg-sunken text-xs text-tx font-mono">
            {email}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-tx-3 hover:bg-bd hover:text-danger transition-colors"
                aria-label={`Eliminar ${email}`}
              >
                <Icon name="x" size={10} />
              </button>
            )}
          </span>
        ))}
        <input
          id={id}
          type="text"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setLocalError(null); }}
          onKeyDown={onKeyDown}
          onBlur={() => tryCommit(draft)}
          placeholder={value.length === 0 ? (placeholder ?? 'agrega un email…') : ''}
          disabled={disabled}
          className="flex-1 min-w-32 px-1 py-0.5 text-sm bg-transparent text-tx placeholder:text-tx-3 focus:outline-none disabled:cursor-not-allowed"
        />
      </div>
      {(localError || error) && (
        <p className="text-xs text-danger mt-1">{localError ?? error}</p>
      )}
    </div>
  );
}
