'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { useConfigurarMfa, useVerificarMfa, useDesactivarMfa } from '@/hooks/use-mfa';
import { totpSchema, type TotpForm } from '@/lib/schemas/perfil';
import { trySetFieldErrorFromApi } from '@/lib/api-errors';
import type { Perfil } from '@/types/api';

type Mode = 'idle' | 'setup' | 'done' | 'disable';

export function MfaCard({ perfil }: { perfil: Perfil }) {
  const [mode, setMode] = useState<Mode>('idle');
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);

  const configurar = useConfigurarMfa();

  async function iniciarSetup() {
    try {
      const { otpauthUri } = await configurar.mutateAsync();
      setOtpauthUri(otpauthUri);
      setMode('setup');
    } catch {
      // El hook ya disparó toast.error si aplica.
    }
  }

  function cerrarDone() {
    setMode('idle');
    setOtpauthUri(null);
  }

  function cancelarSetup() {
    setMode('idle');
    setOtpauthUri(null);
  }

  return (
    <div className="rounded-lg border border-bd bg-surface p-4">
      <h3 className="text-base font-semibold text-tx mb-3">Autenticación en dos pasos</h3>

      {mode === 'idle' && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Icon name="shield" size={22} className={perfil.mfaActivo ? 'text-ok' : 'text-tx-3'} />
            <div className="min-w-0">
              <div className="font-semibold text-sm">
                {perfil.mfaActivo ? 'Tu cuenta está protegida con 2FA' : 'Sin protección adicional'}
              </div>
              <div className="mt-1">
                <Badge status={perfil.mfaActivo ? 'Activo' : 'Inactivo'} kind={perfil.mfaActivo ? 'ok' : 'neutral'} />
              </div>
            </div>
          </div>
          {perfil.mfaActivo ? (
            <button
              type="button"
              onClick={() => setMode('disable')}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-danger border border-bd hover:bg-bg-sunken transition-colors"
            >
              <Icon name="x" size={12} /> Desactivar 2FA
            </button>
          ) : (
            <button
              type="button"
              onClick={iniciarSetup}
              disabled={configurar.isPending}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              <Icon name="shield" size={12} /> Activar 2FA
            </button>
          )}
        </div>
      )}

      {mode === 'setup' && otpauthUri && (
        <SetupWizard otpauthUri={otpauthUri} onCancelar={cancelarSetup} onDone={() => setMode('done')} />
      )}

      {mode === 'done' && (
        <div className="text-center py-3">
          <div className="w-16 h-16 rounded-full bg-ok-soft text-ok inline-grid place-items-center mb-3">
            <Icon name="check" size={32} />
          </div>
          <h3 className="font-semibold">¡Listo!</h3>
          <p className="text-sm text-tx mt-1">Autenticación en dos pasos activada correctamente.</p>
          <p className="text-sm text-tx-2 mt-1">A partir de ahora necesitarás tu código al iniciar sesión.</p>
          <button
            type="button"
            onClick={cerrarDone}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors mt-4"
          >
            Cerrar
          </button>
        </div>
      )}

      {mode === 'disable' && (
        <DisableForm onCancelar={() => setMode('idle')} onDesactivado={() => setMode('idle')} />
      )}
    </div>
  );
}

// ─── SetupWizard (paso 1 QR + paso 2 verificar) ─────────────────────

function SetupWizard({ otpauthUri, onCancelar, onDone }: {
  otpauthUri: string;
  onCancelar: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [copied, setCopied] = useState(false);
  const verificar = useVerificarMfa();

  // Extraer el secret del URI para mostrarlo en modo manual. Si el URI viene
  // malformado el bloque se esconde con fallback — el QR igual se sigue
  // mostrando porque <QRCodeSVG> solo necesita el URI completo.
  const secret = (() => {
    try {
      return new URL(otpauthUri).searchParams.get('secret') ?? null;
    } catch {
      return null;
    }
  })();

  async function copiarSecret() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // El usuario puede pegarlo manualmente — no toast obligatorio.
    }
  }

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TotpForm>({
    resolver: zodResolver(totpSchema) as never,
    defaultValues: { totpCode: '' },
  });

  const [shake, setShake] = useState(false);

  async function onSubmit(v: TotpForm) {
    try {
      await verificar.mutateAsync({ totpCode: v.totpCode });
      onDone();
    } catch (err) {
      // Shake va en el input y no en toast: feedback más directo, patrón del prototipo.
      // El toast queda para errores del sistema; código TOTP inválido es feedback de input.
      const handled = trySetFieldErrorFromApi(err, setError, 'totpCode', {
        codes: ['UNAUTHORIZED'],
        matchHint: 'totp',
      });
      if (handled) {
        setShake(true);
        setTimeout(() => { setShake(false); setValue('totpCode', ''); }, 500);
      }
    }
  }

  if (step === 1) {
    return (
      <div>
        <div className="text-sm text-tx-2 mb-3 leading-relaxed">
          <b>1.</b> Abrí Google Authenticator, Authy o similar en tu teléfono.<br />
          <b>2.</b> Tocá &quot;+&quot; y seleccioná &quot;Escanear código QR&quot;.
        </div>
        <div className="flex flex-wrap gap-4 items-start">
          <div className="bg-surface border border-bd p-3 rounded">
            <QRCodeSVG value={otpauthUri} size={180} bgColor="#ffffff" fgColor="#000000" />
          </div>
          <div className="flex-1 min-w-48">
            <div className="text-2xs uppercase tracking-wider font-semibold text-tx-3 mb-1">¿No podés escanear?</div>
            <div className="text-sm text-tx mb-2">Ingresá este código manualmente:</div>
            {secret ? (
              <div className="flex gap-2 items-center">
                <code className="flex-1 px-3 py-2 bg-bg-sunken rounded font-mono text-sm tracking-widest">{secret}</code>
                <button
                  type="button"
                  onClick={copiarSecret}
                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded text-xs text-tx-2 border border-bd hover:bg-bg-sunken transition-colors"
                >
                  <Icon name={copied ? 'check' : 'copy'} size={12} /> {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            ) : (
              <p className="text-xs text-tx-3 italic">Código manual no disponible — escaneá el QR.</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onCancelar}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-tx-2 border border-bd hover:bg-bg-sunken transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors"
          >
            Ya lo escaneé, continuar
          </button>
        </div>
      </div>
    );
  }

  // Paso 2
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="text-sm text-tx-2 mb-3 leading-relaxed">
        Ingresá el código de 6 dígitos que muestra tu app para confirmar la configuración.
      </div>
      <input
        className={`mfa-input ${shake ? 'is-shake' : ''} ${errors.totpCode ? 'is-error' : ''}`}
        inputMode="numeric"
        maxLength={6}
        placeholder="000000"
        autoFocus
        {...register('totpCode', {
          setValueAs: (v: string) => (v ?? '').replace(/\D/g, '').slice(0, 6),
        })}
      />
      {errors.totpCode && (
        <div className="flex items-center justify-center gap-1 mt-2 text-xs text-danger">
          <Icon name="alertTriangle" size={12} /> {errors.totpCode.message}
        </div>
      )}
      <div className="flex justify-between gap-2 mt-4">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-tx-2 border border-bd hover:bg-bg-sunken transition-colors"
        >
          <Icon name="arrowLeft" size={12} /> Volver
        </button>
        <button
          type="submit"
          disabled={isSubmitting || verificar.isPending}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50"
        >
          <Icon name="check" size={12} /> Confirmar y activar
        </button>
      </div>
    </form>
  );
}

// ─── DisableForm (pide TOTP, no password) ───────────────────────────

function DisableForm({ onCancelar, onDesactivado }: { onCancelar: () => void; onDesactivado: () => void }) {
  // Backend exige TOTP (no password) para desactivar — una sesión hijackeada
  // con cookies robadas no debe poder quitar el 2FA sin acceso físico al dispositivo.
  const desactivar = useDesactivarMfa();
  const [shake, setShake] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TotpForm>({
    resolver: zodResolver(totpSchema) as never,
    defaultValues: { totpCode: '' },
  });

  async function onSubmit(v: TotpForm) {
    try {
      await desactivar.mutateAsync({ totpCode: v.totpCode });
      onDesactivado();
    } catch (err) {
      const handled = trySetFieldErrorFromApi(err, setError, 'totpCode', {
        codes: ['UNAUTHORIZED'],
        matchHint: 'totp',
      });
      if (handled) {
        setShake(true);
        setTimeout(() => { setShake(false); setValue('totpCode', ''); }, 500);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="flex items-start gap-2 mb-3 p-3 rounded bg-warn-soft border border-warn-soft text-warn text-sm">
        <Icon name="alertTriangle" size={14} />
        <span>Al desactivar 2FA tu cuenta quedará protegida solo por contraseña.</span>
      </div>
      <label className="block text-xs font-medium text-tx-2 mb-1">
        Código TOTP actual <span className="text-danger">*</span>
      </label>
      <input
        className={`mfa-input ${shake ? 'is-shake' : ''} ${errors.totpCode ? 'is-error' : ''}`}
        inputMode="numeric"
        maxLength={6}
        placeholder="000000"
        autoFocus
        {...register('totpCode', {
          setValueAs: (v: string) => (v ?? '').replace(/\D/g, '').slice(0, 6),
        })}
      />
      {errors.totpCode && (
        <div className="flex items-center justify-center gap-1 mt-2 text-xs text-danger">
          <Icon name="alertTriangle" size={12} /> {errors.totpCode.message}
        </div>
      )}
      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={onCancelar}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-tx-2 border border-bd hover:bg-bg-sunken transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting || desactivar.isPending}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-danger text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Icon name="x" size={12} /> Desactivar 2FA
        </button>
      </div>
    </form>
  );
}
