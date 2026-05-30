# Spec — Cloudflare Turnstile en login

**Fecha:** 2026-05-30
**Rama frontend:** `feat/perfil-auditlog` (extensión)
**Rama backend:** `feat/perfil-auditlog` (extensión)

## Objetivo

Agregar verificación Cloudflare Turnstile al paso de credenciales del login para bloquear bots/scripts antes de que el backend toque bcrypt. El widget se monta siempre en `/login`; el backend valida el token contra Cloudflare siteverify antes de invocar el service de autenticación.

## Alcance

**Dentro del alcance:**

- Frontend: widget Turnstile en el paso de credenciales del login, tema sincronizado con dark mode del shell, reset automático post-submit.
- Backend: endpoint `POST /auth/iniciar-sesion` acepta y valida `turnstileToken` antes del flow de login normal.
- Env vars nuevas: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (frontend) y `TURNSTILE_SECRET_KEY` (backend), ambas obligatorias sin default.

**Fuera del alcance:**

- Turnstile en el paso MFA (`/auth/mfa/confirmar`). El sessionToken corto + TOTP ya protegen ese endpoint; agregar Turnstile sería redundante.
- Turnstile en endpoints autenticados (cambio contraseña, mfa, etc.). No los expone a bots porque requieren accessToken válido.
- Toggle `TURNSTILE_ENABLED` para bypass — el usuario configura las keys reales en `.env` y producción; no hay modo "off".
- Test keys oficiales de Cloudflare como defaults — el usuario usa sus keys reales en local y prod.
- Recovery flow si Cloudflare está caído. Decisión consciente: si siteverify falla, login rechazado (cerrar puerta antes que permitir bypass).

## Decisiones de diseño

| # | Decisión | Razón |
|---|---|---|
| 1 | Librería frontend: `@marsidev/react-turnstile`. | React wrapper maduro (~5 KB, MIT), bien tipeado, maneja script load + cleanup automáticamente. Evita las race conditions de armar el script tag a mano dentro de `useEffect` + StrictMode. |
| 2 | Widget en TODOS los logins, en el paso de credenciales únicamente. | Bloquea bots desde el primer intento sin estado server-side adicional. Modo `managed` resuelve sin checkbox en mayoría de casos — fricción mínima. El paso MFA no necesita protección extra (sessionToken corto + TOTP). |
| 3 | Si el script de Cloudflare no carga, login queda bloqueado indefinidamente. | El botón "Iniciar sesión" sólo se habilita cuando hay token. Un atacante puede simular fallo de carga; si dejáramos pasar el login en ese caso, Turnstile sería bypasseable trivialmente. |
| 4 | Keys reales en `.env` (sin defaults dev/test). | El usuario configura sus keys en `.env` local y en prod. Sin "test keys" defaults — fuerza configuración explícita y evita olvidar las keys reales en deploys. |
| 5 | Error de Turnstile devuelve 403 `TURNSTILE_FAILED`, no 401. | Semánticamente correcto (request no autorizada por captcha, no credenciales malas) y no revela si las credenciales eran válidas — mejor para anti-enumeration. El frontend muestra mensaje inline genérico. |
| 6 | Tema del widget se sincroniza con `data-theme` del `<html>` vía MutationObserver. | El TweaksPanel cambia `data-theme` en runtime sin recargar; un read único al mount deja el widget con tema viejo. MutationObserver mantiene el sync sin polling. |
| 7 | Reset automático del widget después de cada submit (éxito o fallo). | Tokens Turnstile son single-use y expiran ~300s. Sin reset, un reintento mandaría token quemado → 403 inevitable. Reset garantiza token fresco en cualquier reintento. |
| 8 | Validar Turnstile en el controller (no en el service). | El controller maneja HTTP/IP (`req.ip` se necesita para `remoteip` opcional de siteverify); el service queda agnóstico de HTTP y sigue siendo testeable sin mockear `fetch`. |
| 9 | Verificar Turnstile **antes** de invocar `service.login`. | Fail-fast contra bots: evita el costo de `bcrypt.compare` (~200ms) cuando el token es inválido. Defensa en profundidad junto al rate limiter por IP. |
| 10 | `verificarTurnstile` devuelve `false` en lugar de lanzar cuando hay timeout/red. | Preferimos cerrar la puerta que permitir bypass por error de red. El caller (controller) interpreta `false` como fallo de verificación → 403. |
| 11 | Timeout de 5s al llamar siteverify. | Cloudflare responde típicamente <300ms. Un timeout largo bloquearía login bajo degradación de Cloudflare. 5s es ~16× el p99 normal — suficiente margen sin colgar al usuario. |
| 12 | `widget.size: 'flexible'` para que se adapte al ancho disponible. | El form de login es `max-w-sm` (~24rem). El widget default (300px fijo) se desborda en mobile; flexible se ajusta al contenedor. |

## Arquitectura

### Flujo end-to-end

```
1. Usuario abre /login
2. Frontend monta <Turnstile siteKey={NEXT_PUBLIC_TURNSTILE_SITE_KEY} theme={resolvedTheme} />
3. Widget se auto-resuelve (modo managed) → emite onSuccess(token)
4. Frontend habilita el botón "Iniciar sesión" una vez que tiene token
5. Submit → POST /auth/iniciar-sesion { email, password, turnstileToken }
6. Backend (controller) llama verificarTurnstile(token, req.ip)
7. verificarTurnstile hace POST a https://challenges.cloudflare.com/turnstile/v0/siteverify
   con secret + token + remoteip (timeout 5s)
8. Si !ok → throw AppError(403, 'TURNSTILE_FAILED', ...) → frontend resetea widget + inline error
9. Si ok → continúa con service.login(email, password)
10. Login normal: rate limit ya pasó (middleware), service compara bcrypt, devuelve tokens o sessionToken para MFA
```

### Backend — archivos a modificar

**`src/config/env.ts`** (agregar una línea al schema):

```typescript
TURNSTILE_SECRET_KEY: z.string().min(1, 'Configurar la clave secreta de Cloudflare Turnstile'),
```

**`src/lib/turnstile.ts`** (nuevo):

```typescript
import { env } from '../config/env'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

type SiteverifyResponse = {
  success: boolean
  'error-codes'?: string[]
  challenge_ts?: string
  hostname?: string
  action?: string
  cdata?: string
}

// Verifica un token Turnstile contra Cloudflare. Devuelve true si el token es válido,
// false si está expirado, malformado o ya consumido. NO lanza: el caller decide cómo
// presentar el fallo al usuario (en login → 403 TURNSTILE_FAILED).
export async function verificarTurnstile(token: string, ip?: string): Promise<boolean> {
  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token,
  })
  if (ip) body.append('remoteip', ip)

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      // 5s suficiente: el endpoint de Cloudflare es típicamente <300ms; un timeout
      // mayor bloquearía el login si Cloudflare está degradado.
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return false
    const data = (await res.json()) as SiteverifyResponse
    return data.success === true
  } catch {
    // Network error, timeout o JSON parse fail → tratar como fallo de verificación.
    // Mejor cerrar la puerta que dejar pasar un login sin captcha verificado.
    return false
  }
}
```

**`src/modules/auth/auth.routes.ts`** — modificar `loginSchema`:

```typescript
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  // Token emitido por el widget de Turnstile en el frontend. El backend lo verifica
  // contra Cloudflare antes de tocar bcrypt — fail-fast contra bots/scripts.
  turnstileToken: z.string().min(1, 'Token de verificación requerido'),
})
```

**`src/modules/auth/auth.controller.ts`** — modificar el handler `login`:

```typescript
import { verificarTurnstile } from '../../lib/turnstile'

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Verificar Turnstile ANTES que credenciales: fail-fast contra bots/scripts y
    // evita el costo de bcrypt.compare (>200ms) cuando el token es inválido.
    const ok = await verificarTurnstile(req.body.turnstileToken, req.ip)
    if (!ok) {
      throw new AppError(403, 'TURNSTILE_FAILED', 'No se pudo verificar que sos humano. Recargá e intentá de nuevo.')
    }

    const result = await authService.login(req.body.email, req.body.password)
    if ('mfaRequired' in result) {
      res.json({ success: true, data: result })
      return
    }
    setRefreshCookie(res, result.refreshToken)
    res.json({ success: true, data: { accessToken: result.accessToken, user: result.user } })
  } catch (err) { next(err) }
}
```

**Orden de middlewares en la ruta:** sin cambios. `loginLimiter → validate(loginSchema) → controller.login` sigue siendo correcto.

### Frontend — archivos a modificar

**`package.json`**:
```bash
pnpm add @marsidev/react-turnstile
```

**`hooks/use-auth.ts`** — extender el `LoginPayload` type:

```typescript
type LoginPayload = { email: string; password: string; turnstileToken: string };
```

El resto del hook no cambia.

**`app/(auth)/login/page.tsx`** — modificaciones concentradas en `LoginStep`:

```typescript
import { useRef, useEffect, useState } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function LoginStep({ onMfaRequired }: Step1Props) {
  if (!SITE_KEY) {
    return (
      <div className="text-sm text-danger p-4">
        Variable NEXT_PUBLIC_TURNSTILE_SITE_KEY no configurada. Avisar a soporte.
      </div>
    );
  }

  // ... existing state (showPwd, loginMutation, setAuth, router, form) ...

  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  // Lee data-theme del <html> para que el widget coincida con el dark mode del shell.
  // useState + useEffect porque el atributo se aplica cliente-side por TweaksHydrator
  // y un read directo en render falla en SSR.
  const [tema, setTema] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    const html = document.documentElement;
    const update = () => setTema(html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    update();
    // MutationObserver porque el TweaksPanel cambia data-theme en runtime sin recargar.
    const obs = new MutationObserver(update);
    obs.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  async function onSubmit(data: LoginFields) {
    if (!turnstileToken) {
      toast.error('Esperá a que termine la verificación de seguridad.');
      return;
    }
    const res = await loginMutation.mutateAsync({ ...data, turnstileToken }).catch(() => null);
    // Reset siempre después del submit: tokens son single-use. Si el login pasó,
    // el redirect desmonta el componente y el reset es no-op; si falló, dejamos
    // el widget listo para reintento inmediato sin token expirado.
    turnstileRef.current?.reset();
    setTurnstileToken(null);

    if (!res) return;
    if (!res.success) {
      // El backend devuelve 403 TURNSTILE_FAILED si el token no pasó la verificación
      // contra Cloudflare (expirado, ya usado, sospechoso).
      toast.error(res.error.message);
      return;
    }

    if ('accessToken' in res.data) {
      setAuth(res.data.accessToken, res.data.user);
      socket.connect();
      toast.success(`Bienvenido, ${res.data.user.nombre}.`);
      router.replace('/dashboard');
      return;
    }
    onMfaRequired(res.data.sessionToken);
  }

  // ... render igual al actual, agregando el widget debajo del campo Password ...

  return (
    <form ...>
      {/* ... logo, header, email, password fields ... */}

      <div className="mb-4">
        <Turnstile
          ref={turnstileRef}
          siteKey={SITE_KEY}
          onSuccess={(token) => setTurnstileToken(token)}
          onExpire={() => setTurnstileToken(null)}
          onError={() => setTurnstileToken(null)}
          options={{ theme: tema, size: 'flexible' }}
        />
      </div>

      <button
        type="submit"
        disabled={loginMutation.isPending || !turnstileToken}
        className="..."
      >
        {loginMutation.isPending
          ? <><Spinner size={12} /> Iniciando sesión…</>
          : !turnstileToken
            ? <>Cargando verificación…</>
            : <>Iniciar sesión</>
        }
      </button>
    </form>
  );
}
```

### Env vars a configurar

**Frontend** (`.env.local`):
```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<site key de dash.cloudflare.com>
```

**Backend** (`.env`):
```
TURNSTILE_SECRET_KEY=<secret key de dash.cloudflare.com>
```

El usuario obtiene ambas keys creando un sitio Turnstile en `https://dash.cloudflare.com/?to=/:account/turnstile`. En el dashboard configura los dominios permitidos (incluir `localhost` para dev y el dominio de producción).

## Manejo de errores

| Caso | Manejo |
|---|---|
| Token ya consumido (doble-click rápido) | Backend 403 `TURNSTILE_FAILED`. Frontend resetea widget post-submit; próximo intento usa token nuevo. |
| Token expirado mientras tipea password (>300s) | `onExpire` pone token a null → botón disabled → widget auto-renueva → botón vuelve a habilitarse. |
| Cloudflare siteverify caído / 5xx | `verificarTurnstile` devuelve `false` (timeout 5s + catch). Login 403. Decisión: cerrar puerta antes que bypass. |
| Red local bloquea `challenges.cloudflare.com` | Widget nunca emite token → botón disabled "Cargando verificación…" indefinido. Usuario contacta IT. |
| `TURNSTILE_SECRET_KEY` no configurada | `env.ts` falla con `process.exit(1)` y mensaje claro al boot. Server no arranca. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no configurada | `LoginStep` muestra mensaje "Variable no configurada. Avisar a soporte." en lugar del form. |
| Bot manda request directo sin `turnstileToken` | `validate(loginSchema)` (middleware Zod) rechaza con 400 antes del controller. |
| Credenciales válidas + Turnstile válido + MFA activo | Backend continúa flow normal: `{mfaRequired, sessionToken}`. Paso MFA no requiere otro captcha. |
| Rate limit dispara antes que Turnstile | `loginLimiter` se ejecuta primero por orden de middlewares → `TOO_MANY_REQUESTS`. Sin verificar token. |
| Theme switch en vivo desde TweaksPanel mientras estás en /login | MutationObserver dispara re-render con nuevo `theme` prop → widget se actualiza. |

## Comentarios "why" obligatorios (en español)

**Backend:**
- `lib/turnstile.ts > catch returns false`: por qué cerramos la puerta en error de red en lugar de lanzar (preferimos bloqueo a bypass).
- `lib/turnstile.ts > AbortSignal.timeout(5_000)`: por qué 5s y no más (Cloudflare normalmente <300ms; timeout largo bloquearía login bajo degradación).
- `auth.controller.ts > login > verificarTurnstile antes de service.login`: por qué validar primero (fail-fast contra bots evitando el costo de bcrypt ~200ms).

**Frontend:**
- `app/(auth)/login/page.tsx > useEffect con MutationObserver`: por qué observer y no un solo read (TweaksPanel cambia data-theme en runtime sin recargar).
- `app/(auth)/login/page.tsx > reset post-submit`: por qué resetear siempre (tokens single-use; un reintento sin reset manda token quemado).
- `app/(auth)/login/page.tsx > guard if (!SITE_KEY) return`: por qué render alternativo y no fallback silencioso (sistema bloqueado es mejor que sin captcha).

## Checklist antes de PR (extensión del checklist de Rama 18)

- [ ] Backend: rechaza login sin `turnstileToken` con 400 VALIDATION_ERROR.
- [ ] Backend: rechaza login con token inválido/expirado con 403 TURNSTILE_FAILED.
- [ ] Backend: `pnpm tsc --noEmit` limpio.
- [ ] Frontend: widget aparece debajo de Password en `/login`.
- [ ] Frontend: botón submit deshabilitado hasta que el widget emite token.
- [ ] Frontend: tema del widget coincide con dark/light del shell y se actualiza al cambiarlo en TweaksPanel.
- [ ] Frontend: post-submit, el widget se resetea automáticamente.
- [ ] Frontend: `pnpm tsc --noEmit` y `pnpm lint` limpios.
- [ ] Login con credenciales válidas + Turnstile válido → redirige a /dashboard.
- [ ] Login con credenciales válidas + Turnstile válido + MFA activo → segundo paso funciona normalmente sin requerir otro captcha.
- [ ] Rate limit (10/15min) sigue funcionando — Turnstile no lo suprime.
- [ ] Tablet (768px) y mobile (<640px): widget responsive con `size: 'flexible'`.
- [ ] Comentarios "why" en español en las decisiones no obvias.
- [ ] Variables de entorno documentadas: el usuario sabe que debe agregar `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY` en sus `.env` antes del primer login.
