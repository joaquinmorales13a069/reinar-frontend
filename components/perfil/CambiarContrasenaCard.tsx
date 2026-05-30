'use client';

import { useState } from 'react';
import { useForm, type UseFormRegister, type FieldError } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '@/components/ui/Icon';
import { useCambiarContrasena } from '@/hooks/use-perfil';
import { cambiarContrasenaSchema, type CambiarContrasenaForm } from '@/lib/schemas/perfil';
import { trySetFieldErrorFromApi } from '@/lib/api-errors';

const inputBase = 'w-full px-3 py-2 pr-10 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-1';
const hintCls = 'text-xs text-tx-3 mt-1';

// Medidor de fortaleza — feedback visual, no bloquea submit más allá del min 8
// que ya exige el schema. Devuelve null si el input está vacío.
function calcularFortaleza(p: string): { kind: 'danger' | 'warn' | 'ok'; pct: number; label: string } | null {
  if (!p) return null;
  if (p.length < 8) return { kind: 'danger', pct: 33, label: 'Débil' };
  const tipos = [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
  if (p.length >= 12 && tipos === 4) return { kind: 'ok', pct: 100, label: 'Fuerte' };
  if (p.length >= 8 && tipos >= 2) return { kind: 'warn', pct: 66, label: 'Media' };
  return { kind: 'danger', pct: 33, label: 'Débil' };
}

const FORTALEZA_BAR: Record<'danger' | 'warn' | 'ok', string> = {
  danger: 'bg-danger',
  warn: 'bg-warn',
  ok: 'bg-ok',
};

const FORTALEZA_TEXT: Record<'danger' | 'warn' | 'ok', string> = {
  danger: 'text-danger',
  warn: 'text-warn',
  ok: 'text-ok',
};

// PasswordInput vive a nivel de módulo (no dentro de CambiarContrasenaCard):
// si se define inline, cada render del padre crea una nueva identidad de función
// y React desmonta/remonta el input — perdiendo el foco después de cada keystroke.
type PasswordFieldName = 'passwordActual' | 'passwordNuevo' | 'confirmar';

function PasswordInput({
  name,
  label,
  show,
  onToggle,
  register,
  error,
}: {
  name: PasswordFieldName;
  label: string;
  show: boolean;
  onToggle: () => void;
  register: UseFormRegister<CambiarContrasenaForm>;
  error?: FieldError;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          className={error ? inputErr : inputOk}
          {...register(name)}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-tx-3 hover:text-tx transition-colors"
          aria-label={show ? 'Ocultar' : 'Mostrar'}
        >
          <Icon name={show ? 'x' : 'eye'} size={14} />
        </button>
      </div>
      {error && <p className={errorCls}>{error.message}</p>}
    </div>
  );
}

export function CambiarContrasenaCard() {
  const [showActual, setShowActual] = useState(false);
  const [showNueva, setShowNueva] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const cambiar = useCambiarContrasena();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CambiarContrasenaForm>({
    resolver: zodResolver(cambiarContrasenaSchema) as never,
    defaultValues: { passwordActual: '', passwordNuevo: '', confirmar: '' },
  });

  const nueva = watch('passwordNuevo');
  const fortaleza = calcularFortaleza(nueva ?? '');

  async function onSubmit(v: CambiarContrasenaForm) {
    try {
      await cambiar.mutateAsync({
        passwordActual: v.passwordActual,
        passwordNuevo: v.passwordNuevo,
      });
      reset();
    } catch (err) {
      // Backend devuelve 401 con mensaje "Contraseña actual incorrecta" — mapear inline.
      trySetFieldErrorFromApi(err, setError, 'passwordActual', {
        codes: ['UNAUTHORIZED'],
        matchHint: 'actual',
      });
    }
  }

  return (
    <div className="rounded-lg border border-bd bg-surface p-4">
      <h3 className="text-base font-semibold text-tx mb-3">Cambiar contraseña</h3>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <PasswordInput
          name="passwordActual"
          label="Contraseña actual"
          show={showActual}
          onToggle={() => setShowActual((s) => !s)}
          register={register}
          error={errors.passwordActual}
        />

        <div>
          <PasswordInput
            name="passwordNuevo"
            label="Nueva contraseña"
            show={showNueva}
            onToggle={() => setShowNueva((s) => !s)}
            register={register}
            error={errors.passwordNuevo}
          />
          {fortaleza && (
            <div className="mt-2">
              <div className="h-1 rounded-full bg-bg-sunken overflow-hidden">
                <div className={`h-full transition-all ${FORTALEZA_BAR[fortaleza.kind]}`} style={{ width: `${fortaleza.pct}%` }} />
              </div>
              <div className="flex justify-between items-center mt-1 text-xs">
                <span className="text-tx-3">Fortaleza:</span>
                <span className={`font-semibold ${FORTALEZA_TEXT[fortaleza.kind]}`}>{fortaleza.label}</span>
              </div>
            </div>
          )}
          {!errors.passwordNuevo && !fortaleza && <p className={hintCls}>Mínimo 8 caracteres.</p>}
        </div>

        <PasswordInput
          name="confirmar"
          label="Confirmar nueva contraseña"
          show={showConfirmar}
          onToggle={() => setShowConfirmar((s) => !s)}
          register={register}
          error={errors.confirmar}
        />

        <button
          type="submit"
          disabled={isSubmitting || cambiar.isPending}
          className="inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          <Icon name="check" size={12} /> Actualizar contraseña
        </button>
      </form>
    </div>
  );
}
