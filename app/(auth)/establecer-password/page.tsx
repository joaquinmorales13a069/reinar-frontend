'use client';

import { Suspense, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { useValidarTokenSetup, useEstablecerPassword } from '@/hooks/use-setup-password';

const fieldLabel = 'text-xs font-medium text-tx-2 tracking-[0.01em]';
const fieldError = 'text-2xs text-danger flex items-center gap-1 mt-0.5';
const inputBase =
  'h-9 px-3 bg-surface border border-bd-strong rounded text-sm text-tx outline-none w-full transition-[border-color,box-shadow] hover:border-tx-muted focus:border-accent focus:ring-focus';

// Validacion cliente. min 8 + confirmacion: backend valida lo mismo y devolvera
// 400 si falla — la doble check evita ida-vuelta innecesaria para errores obvios.
const schema = z
  .object({
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmar: z.string().min(1, 'Requerido'),
  })
  .refine((d) => d.password === d.confirmar, {
    path: ['confirmar'],
    message: 'No coincide con la contraseña',
  });

type FormFields = z.infer<typeof schema>;

// Page wrapper: useSearchParams obliga a Suspense boundary en Next 16.
export default function EstablecerPasswordPage() {
  return (
    <Suspense fallback={<PantallaCargando />}>
      <Contenido />
    </Suspense>
  );
}

function PantallaCargando() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <Spinner />
    </div>
  );
}

function Contenido() {
  const router = useRouter();
  const sp = useSearchParams();
  const token = sp.get('token');

  const [showPwd, setShowPwd] = useState(false);

  // Validacion del token al montar (sin consumirlo). Mientras carga mostramos
  // spinner; despues, o el form (si valido) o un mensaje de error (si no).
  const { data: validacion, isLoading: validandoToken } = useValidarTokenSetup(token);

  const establecer = useEstablecerPassword();
  const { register, handleSubmit, formState: { errors } } = useForm<FormFields>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormFields) {
    if (!token) return;
    const res = await establecer.mutateAsync({ token, password: data.password }).catch(() => null);
    if (res) {
      // Pequena pausa para que el usuario vea el toast antes de irse al login.
      setTimeout(() => router.replace('/login'), 800);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <Image src="/logo-reinar.png" alt="Reinar" width={140} height={40} priority />
        </div>

        <div className="bg-surface border border-bd rounded-lg p-6">
          {/* Estado 1: sin token en la URL */}
          {!token && <MensajeError titulo="Enlace inválido" mensaje="Falta el token en la URL." />}

          {/* Estado 2: validando token al montar */}
          {token && validandoToken && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Spinner />
              <p className="text-sm text-tx-2">Verificando enlace…</p>
            </div>
          )}

          {/* Estado 3: token invalido/expirado/usado */}
          {token && !validandoToken && validacion && !validacion.valido && (
            <MensajeError
              titulo={
                validacion.razon === 'expirado'
                  ? 'Enlace expirado'
                  : validacion.razon === 'usado'
                    ? 'Enlace ya utilizado'
                    : 'Enlace inválido'
              }
              mensaje={
                validacion.razon === 'expirado'
                  ? 'Este enlace ya pasó las 24 horas de validez. Pedile a un administrador que genere uno nuevo.'
                  : validacion.razon === 'usado'
                    ? 'Este enlace ya fue utilizado. Si necesitás restablecer tu contraseña, pedile a un administrador un nuevo enlace.'
                    : 'El enlace no es válido. Verificá que copiaste la URL completa, o pedile a un administrador uno nuevo.'
              }
            />
          )}

          {/* Estado 4: token valido — mostrar form */}
          {token && !validandoToken && validacion?.valido && (
            <form onSubmit={handleSubmit(onSubmit)}>
              <h2 className="text-title font-semibold mb-1.5 tracking-tight">Establecer contraseña</h2>
              <p className="text-sm text-tx-2 mb-6">
                Definí tu contraseña para entrar al sistema. Mínimo 8 caracteres.
              </p>

              <div className="flex flex-col gap-1.5 mb-4">
                <label className={fieldLabel}>Contraseña</label>
                <div className="relative">
                  <input
                    className={`${inputBase} pr-9`}
                    type={showPwd ? 'text' : 'password'}
                    autoComplete="new-password"
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

              <div className="flex flex-col gap-1.5 mb-6">
                <label className={fieldLabel}>Confirmar contraseña</label>
                <input
                  className={inputBase}
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="new-password"
                  {...register('confirmar')}
                />
                {errors.confirmar && (
                  <div className={fieldError}>
                    <Icon name="alertTriangle" size={12} /> {errors.confirmar.message}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-1.5 h-11 rounded bg-accent text-navy text-sm font-semibold cursor-pointer border-none transition-colors hover:bg-accent-dim disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={establecer.isPending}
              >
                {establecer.isPending ? (
                  <><Spinner size={12} /> Guardando…</>
                ) : (
                  <>Establecer contraseña <Icon name="arrowRight" size={14} /></>
                )}
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-tx-muted">
          <Link href="/login" className="hover:text-tx transition-colors">Volver al inicio de sesión</Link>
        </p>
      </div>
    </div>
  );
}

function MensajeError({ titulo, mensaje }: { titulo: string; mensaje: string }) {
  return (
    <div className="flex flex-col items-center text-center py-4">
      <div className="size-10 grid place-items-center rounded-full bg-danger/10 text-danger mb-3">
        <Icon name="alertTriangle" size={20} />
      </div>
      <h2 className="text-title font-semibold mb-2">{titulo}</h2>
      <p className="text-sm text-tx-2 mb-4">{mensaje}</p>
      <Link
        href="/login"
        className="text-xs text-accent hover:text-accent-dim transition-colors"
      >
        Volver al inicio de sesión
      </Link>
    </div>
  );
}
