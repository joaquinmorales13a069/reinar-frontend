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
  email: z.string().email('Correo inválido'),
  password: z.string().min(1, 'Requerido'),
});

const mfaSchema = z.object({
  codigo: z.string().length(6, 'El código debe tener 6 dígitos').regex(/^\d+$/, 'Solo dígitos'),
});

type LoginFields = z.infer<typeof loginSchema>;
type MfaFields = z.infer<typeof mfaSchema>;

// ─── Paso 1: credenciales ───────────────────────────────────────────────────

type Step1Props = {
  onMfaRequired: (sessionToken: string) => void;
};

function LoginStep({ onMfaRequired }: Step1Props) {
  const [showPwd, setShowPwd] = useState(false);
  const loginMutation = useLoginMutation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFields>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginFields) {
    const res = await loginMutation.mutateAsync(data).catch(() => null);
    if (!res) return;
    if (!res.success) {
      toast.error(res.error.message);
      return;
    }
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
    <form className="auth__form auth__form--fade" onSubmit={handleSubmit(onSubmit)}>
      <div className="auth__form-logo">
        <Image src="/logo-reinar.png" alt="Reinar" width={120} height={30} priority />
      </div>
      <h2 className="auth__form-title">Iniciar sesión</h2>
      <p className="auth__form-sub">Ingresá con tu cuenta corporativa de Reinar.</p>

      <div className="field">
        <label className="field__label">Correo electrónico</label>
        <div className="input-wrap">
          <span className="input-wrap__icon"><Icon name="user" size={14} /></span>
          <input
            className="input input--with-icon"
            type="email"
            placeholder="usuario@reinar.com.sv"
            autoComplete="email"
            {...register('email')}
          />
        </div>
        {errors.email && (
          <div className="field__error"><Icon name="alertTriangle" size={12} /> {errors.email.message}</div>
        )}
      </div>

      <div className="field">
        <label className="field__label">Contraseña</label>
        <div className="input-wrap">
          <span className="input-wrap__icon"><Icon name="gear" size={14} /></span>
          <input
            className="input input--with-icon"
            type={showPwd ? 'text' : 'password'}
            autoComplete="current-password"
            style={{ paddingRight: 38 }}
            {...register('password')}
          />
          <button type="button" className="input-wrap__action" onClick={() => setShowPwd((s) => !s)} aria-label="Mostrar contraseña">
            <Icon name={showPwd ? 'x' : 'eye'} size={14} />
          </button>
        </div>
        {errors.password && (
          <div className="field__error"><Icon name="alertTriangle" size={12} /> {errors.password.message}</div>
        )}
      </div>

      <button
        type="submit"
        className="btn btn--primary"
        disabled={loginMutation.isPending}
      >
        {loginMutation.isPending
          ? <><Spinner size={14} /> Verificando…</>
          : <>Iniciar sesión <Icon name="arrowRight" size={14} /></>}
      </button>

      <div className="auth__form-foot">
        ¿Problemas para acceder? Contactá a TI · <span className="mono">personal@joaquinmorales.dev</span>
      </div>
    </form>
  );
}

// ─── Paso 2: código TOTP ────────────────────────────────────────────────────

type Step2Props = {
  sessionToken: string;
  onBack: () => void;
};

function MfaStep({ sessionToken, onBack }: Step2Props) {
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mfaMutation = useMfaMutation();

  // Autoenfoque al montar el paso para que el usuario pueda escribir de inmediato
  useEffect(() => { inputRef.current?.focus(); }, []);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<MfaFields>({ resolver: zodResolver(mfaSchema) });

  const codigo = watch('codigo', '');

  // Extraer ref de react-hook-form para poder combinarlo con nuestro inputRef local
  const { ref: rhfRef, ...rhfProps } = register('codigo');

  async function verificar(val: string) {
    const res = await mfaMutation.mutateAsync({ sessionToken, totpCode: val }).catch(() => null);
    if (!res) return;
    if (!res.success) {
      toast.error(res.error.message);
      setShake(true);
      setValue('codigo', '');
      setTimeout(() => {
        setShake(false);
        inputRef.current?.focus();
      }, 500);
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
    <div className="auth__form auth__form--fade">
      <div className="auth__form-logo">
        <Image src="/logo-reinar.png" alt="Reinar" width={120} height={30} />
      </div>
      <div style={{ display: 'grid', placeItems: 'center', marginBottom: 18 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--yellow-soft)', display: 'grid', placeItems: 'center', color: 'var(--yellow-dim)' }}>
          <Icon name="shield" size={36} />
        </div>
      </div>

      <h2 className="auth__form-title" style={{ textAlign: 'center' }}>Verificación en dos pasos</h2>
      <p className="auth__form-sub" style={{ textAlign: 'center' }}>
        Ingresá el código de 6 dígitos que muestra tu app autenticadora (Google Authenticator, Authy…).
      </p>

      <form onSubmit={handleSubmit((d) => verificar(d.codigo))}>
        <div className="field" style={{ marginTop: 20 }}>
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
          className="btn btn--primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
          disabled={codigo.length < 6 || mfaMutation.isPending}
        >
          {mfaMutation.isPending ? <><Spinner size={14} /> Verificando…</> : 'Verificar'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 18 }}>
        <button
          type="button"
          className="link"
          style={{ background: 'none', border: 0, fontSize: 'var(--t-sm)', cursor: 'pointer' }}
          onClick={onBack}
        >
          <Icon name="arrowLeft" size={12} /> Volver al inicio de sesión
        </button>
      </div>

      <div className="auth__form-foot">
        Sesión MFA: <span className="mono">{sessionToken.slice(0, 20)}…</span>
      </div>
    </div>
  );
}

// ─── Página de login ────────────────────────────────────────────────────────

export default function LoginPage() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  return (
    <div className="auth">
      <div className="auth__left">
        <div className="auth__brand">
          <Image
            src="/logo-reinar.png"
            alt="Reinar"
            width={140}
            height={36}
            className="auth__brand-logo"
            priority
          />
        </div>

        <div className="auth__hero">
          <div className="auth__tag">Renta · Servicio · Confianza</div>
          <h1 className="auth__title">
            Equipos y servicios para <em>cada proyecto</em>, en un solo lugar.
          </h1>
          <p className="auth__lede">
            Plataforma interna para gestionar la flota industrial, cotizaciones, facturación y actas
            de entrega de Reinar en todo El Salvador.
          </p>
        </div>

        <div className="auth__stats">
          <div className="auth__stat">
            <div className="auth__stat-val">38</div>
            <div className="auth__stat-label">Rentas activas</div>
          </div>
          <div className="auth__stat">
            <div className="auth__stat-val">12</div>
            <div className="auth__stat-label">Clientes activos</div>
          </div>
          <div className="auth__stat">
            <div className="auth__stat-val">156</div>
            <div className="auth__stat-label">Equipos en flota</div>
          </div>
        </div>
      </div>

      <div className="auth__right">
        {sessionToken === null ? (
          <LoginStep onMfaRequired={setSessionToken} />
        ) : (
          <MfaStep sessionToken={sessionToken} onBack={() => setSessionToken(null)} />
        )}
      </div>
    </div>
  );
}
