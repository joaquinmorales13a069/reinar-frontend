'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { useLoginMutation, useMfaMutation } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth.store';
import { socket } from '@/lib/socket';

// Validaciones mínimas en cliente — el servidor es la fuente de verdad para errores detallados
const loginSchema = z.object({
  email:    z.string().email('Correo inválido'),
  password: z.string().min(1, 'Requerido'),
});

const mfaSchema = z.object({
  codigo: z.string().length(6, 'El código debe tener 6 dígitos').regex(/^\d+$/, 'Solo dígitos'),
});

type LoginFields = z.infer<typeof loginSchema>;
type MfaFields  = z.infer<typeof mfaSchema>;

/* ── Clases compartidas ─────────────────────────────────────────────────── */
const fieldLabel  = 'text-xs font-medium text-tx-2 tracking-[0.01em]';
const fieldError  = 'text-2xs text-danger flex items-center gap-1 mt-0.5';
const inputBase   = 'h-9 px-3 bg-surface border border-bd-strong rounded text-sm text-tx outline-none w-full transition-[border-color,box-shadow] hover:border-tx-muted focus:border-accent focus:ring-focus';

/* ── Paso 1: credenciales ───────────────────────────────────────────────── */

type Step1Props = {
  onMfaRequired: (sessionToken: string) => void;
};

function LoginStep({ onMfaRequired }: Step1Props) {
  const [showPwd, setShowPwd]   = useState(false);
  const loginMutation = useLoginMutation();
  const setAuth  = useAuthStore((s) => s.setAuth);
  const router   = useRouter();

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFields>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginFields) {
    const res = await loginMutation.mutateAsync(data).catch(() => null);
    if (!res) return;
    if (!res.success) { toast.error(res.error.message); return; }

    // Login directo sin MFA: el backend devuelve tokens inmediatamente
    if ('accessToken' in res.data) {
      setAuth(res.data.accessToken, res.data.user);
      socket.connect();
      toast.success(`Bienvenido, ${res.data.user.nombre}.`);
      router.replace('/dashboard');
      return;
    }
    // Con MFA activo: pasar al segundo paso con el sessionToken
    onMfaRequired(res.data.sessionToken);
  }

  return (
    <form className="w-full max-w-sm mx-auto max-md:max-w-none max-md:mx-0 animate-auth-fade" onSubmit={handleSubmit(onSubmit)}>
      {/* Logo visible solo en móvil donde auth__left está oculto */}
      <div className="hidden max-md:block mb-5">
        <Image src="/logo-reinar.png" alt="Reinar" width={120} height={30} priority />
      </div>

      <h2 className="text-title font-semibold mb-1.5 tracking-tight">Iniciar sesión</h2>
      <p className="text-sm text-tx-2 mb-6">Ingresá con tu cuenta corporativa de Reinar.</p>

      <div className="flex flex-col gap-1.5 mb-4">
        <label className={fieldLabel}>Correo electrónico</label>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <Icon name="user" size={14} />
          </span>
          <input
            className={`${inputBase} pl-9`}
            type="email"
            placeholder="usuario@reinar.com.sv"
            autoComplete="email"
            {...register('email')}
          />
        </div>
        {errors.email && (
          <div className={fieldError}>
            <Icon name="alertTriangle" size={12} /> {errors.email.message}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 mb-4">
        <label className={fieldLabel}>Contraseña</label>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <Icon name="gear" size={14} />
          </span>
          <input
            className={`${inputBase} pl-9 pr-9`}
            type={showPwd ? 'text' : 'password'}
            autoComplete="current-password"
            {...register('password')}
          />
          <button
            type="button"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-tx-muted p-1 rounded hover:text-tx hover:bg-bg-sunken transition-colors"
            onClick={() => setShowPwd((s) => !s)}
            aria-label="Mostrar contraseña"
          >
            <Icon name={showPwd ? 'x' : 'eye'} size={14} />
          </button>
        </div>
        {errors.password && (
          <div className={fieldError}>
            <Icon name="alertTriangle" size={12} /> {errors.password.message}
          </div>
        )}
      </div>

      <button
        type="submit"
        className="w-full flex items-center justify-center gap-1.5 h-11 rounded bg-accent text-navy text-sm font-semibold cursor-pointer border-none transition-colors hover:bg-accent-dim disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={loginMutation.isPending}
      >
        {loginMutation.isPending
          ? <><Spinner size={14} /> Verificando…</>
          : <>Iniciar sesión <Icon name="arrowRight" size={14} /></>}
      </button>

      <p className="mt-6 text-xs text-tx-muted text-center">
        ¿Problemas para acceder? Contactá a TI · <span className="font-mono">personal@joaquinmorales.dev</span>
      </p>
    </form>
  );
}

/* ── Paso 2: código TOTP ────────────────────────────────────────────────── */

type Step2Props = {
  sessionToken: string;
  onBack: () => void;
};

function MfaStep({ sessionToken, onBack }: Step2Props) {
  const [shake, setShake] = useState(false);
  const inputRef   = useRef<HTMLInputElement>(null);
  const mfaMutation = useMfaMutation();

  // Autoenfoque al montar el paso para que el usuario pueda escribir de inmediato
  useEffect(() => { inputRef.current?.focus(); }, []);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<MfaFields>({
    resolver: zodResolver(mfaSchema),
  });

  const codigo = watch('codigo', '');
  const { ref: rhfRef, ...rhfProps } = register('codigo');

  async function verificar(val: string) {
    const res = await mfaMutation.mutateAsync({ sessionToken, totpCode: val }).catch(() => null);
    if (!res) return;
    if (!res.success) {
      toast.error(res.error.message);
      setShake(true);
      setValue('codigo', '');
      setTimeout(() => { setShake(false); inputRef.current?.focus(); }, 500);
    }
    // En caso de éxito, useMfaMutation redirige automáticamente dentro del onSuccess
  }

  function onChange(raw: string) {
    const v = raw.replace(/\D/g, '').slice(0, 6);
    setValue('codigo', v, { shouldValidate: false });
    // Auto-enviar cuando el usuario completa los 6 dígitos
    if (v.length === 6) verificar(v);
  }

  return (
    <div className="w-full max-w-sm mx-auto max-md:max-w-none max-md:mx-0 animate-auth-fade">
      {/* Logo visible solo en móvil */}
      <div className="hidden max-md:block mb-5">
        <Image src="/logo-reinar.png" alt="Reinar" width={120} height={30} />
      </div>

      <div className="grid place-items-center mb-5">
        <div className="size-18 rounded-full bg-accent-soft grid place-items-center text-accent-dim">
          <Icon name="shield" size={36} />
        </div>
      </div>

      <h2 className="text-title font-semibold text-center tracking-tight mb-1.5">
        Verificación en dos pasos
      </h2>
      <p className="text-sm text-tx-2 text-center mb-4">
        Ingresá el código de 6 dígitos que muestra tu app autenticadora (Google Authenticator, Authy…).
      </p>

      <form onSubmit={handleSubmit((d) => verificar(d.codigo))}>
        <div className="mt-5">
          <input
            {...rhfProps}
            ref={(el) => {
              // Registrar con react-hook-form Y guardar referencia local para el foco
              rhfRef(el);
              (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
            }}
            className={`mfa-input ${shake ? 'is-shake' : ''} ${errors.codigo ? 'is-error' : ''}`}
            inputMode="numeric"
            pattern="\d*"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            aria-label="Código de verificación"
            onChange={(e) => onChange(e.target.value)}
            value={codigo}
          />
        </div>

        <button
          type="submit"
          className="mt-3 w-full flex items-center justify-center gap-1.5 h-11 rounded bg-accent text-navy text-sm font-semibold cursor-pointer border-none transition-colors hover:bg-accent-dim disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={codigo.length < 6 || mfaMutation.isPending}
        >
          {mfaMutation.isPending ? <><Spinner size={14} /> Verificando…</> : 'Verificar'}
        </button>
      </form>

      <div className="text-center mt-5">
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-info cursor-pointer bg-transparent border-none hover:underline"
          onClick={onBack}
        >
          <Icon name="arrowLeft" size={12} /> Volver al inicio de sesión
        </button>
      </div>

      <p className="mt-6 text-xs text-tx-muted text-center">
        Sesión MFA: <span className="font-mono">{sessionToken.slice(0, 20)}…</span>
      </p>
    </div>
  );
}

/* ── Página de login ────────────────────────────────────────────────────── */

export default function LoginPage() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-2 min-h-screen bg-bg max-md:grid-cols-1">
      {/* Panel izquierdo informativo — oculto en móvil */}
      <div className="relative bg-navy text-white p-12 flex flex-col justify-between overflow-hidden max-md:hidden">
        {/* Gradiente decorativo */}
        <div
          className="absolute -top-1/5 -right-1/5 w-3/5 h-3/5 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(242,192,55,0.08) 0%, transparent 70%)' }}
        />

        <div className="flex items-center gap-3 z-10 relative">
          <Image
            src="/logo-reinar.png"
            alt="Reinar"
            width={140}
            height={36}
            className="h-16 w-auto max-w-64 object-contain block mb-3"
            priority
          />
        </div>

        <div className="relative z-10">
          <div className="text-xs text-yellow uppercase tracking-widest font-semibold mb-3">
            Renta · Servicio · Confianza
          </div>
          <h1 className="text-display font-semibold tracking-tight leading-[1.08] mb-3 max-w-xl">
            Equipos y servicios para <em className="text-yellow not-italic">cada proyecto</em>, en un solo lugar.
          </h1>
          <p className="text-sm text-white/65 max-w-lg leading-relaxed">
            Plataforma interna para gestionar la flota industrial, cotizaciones, facturación y actas
            de entrega de Reinar en todo El Salvador.
          </p>
        </div>

        <div className="flex gap-3 z-10 relative">
          {[
            { val: '38',  label: 'Rentas activas' },
            { val: '12',  label: 'Clientes activos' },
            { val: '156', label: 'Equipos en flota' },
          ].map((s) => (
            <div key={s.label} className="flex-1 bg-white/3 border border-white/8 px-4 py-3 rounded">
              <div className="font-mono text-2xl font-medium text-yellow tracking-tight">{s.val}</div>
              <div className="text-2xs text-white/55 uppercase tracking-widest mt-0.5 font-semibold">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex items-center justify-center px-7 py-12 bg-surface max-md:px-5 max-md:py-6 max-md:bg-navy max-md:flex-col">
        <div className="w-full max-md:border max-md:border-bd max-md:rounded-lg max-md:p-6 max-md:bg-bg">
          {sessionToken === null ? (
            <LoginStep onMfaRequired={setSessionToken} />
          ) : (
            <MfaStep sessionToken={sessionToken} onBack={() => setSessionToken(null)} />
          )}
        </div>
      </div>
    </div>
  );
}
