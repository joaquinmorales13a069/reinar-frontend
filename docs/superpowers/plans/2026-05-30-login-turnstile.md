# Login Turnstile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar verificación Cloudflare Turnstile al paso de credenciales del login para bloquear bots/scripts antes de que el backend toque bcrypt.

**Architecture:** Frontend monta el widget de Turnstile con `@marsidev/react-turnstile` en `LoginStep`; el widget emite un token que viaja en el payload de `POST /auth/iniciar-sesion`. Backend valida el token contra `https://challenges.cloudflare.com/turnstile/v0/siteverify` en el controller ANTES de invocar `service.login` (fail-fast contra bots evitando bcrypt). Sin verificación pasa → 403 `TURNSTILE_FAILED`, frontend resetea el widget y permite reintentar.

**Tech Stack:** `@marsidev/react-turnstile` (nuevo), Cloudflare Turnstile siteverify API (HTTPS POST), existing Zod schemas + RHF + React Query.

**Spec de referencia:** `docs/superpowers/specs/2026-05-30-login-turnstile-design.md`

**Convenciones obligatorias:** comentarios "why" en español, sin clases vanilla CSS, sin valores Tailwind arbitrarios, errores backend mapeados según convención del proyecto.

**Ramas de trabajo:** ambas son **extensiones de `feat/perfil-auditlog`** (ya checked-out en ambos repos). Los commits se agregan a las PRs existentes #66 (backend) y #29 (frontend) — no se crean PRs nuevos.

---

## Mapa de archivos

**Backend** (`/Users/joaquinmorales13a06/Desktop/Reinar/server`):
- Modify: `src/config/env.ts` — agregar `TURNSTILE_SECRET_KEY` al schema.
- Create: `src/lib/turnstile.ts` — helper `verificarTurnstile(token, ip?) → Promise<boolean>`.
- Modify: `src/modules/auth/auth.routes.ts` — extender `loginSchema` con `turnstileToken`.
- Modify: `src/modules/auth/auth.controller.ts` — validar Turnstile en `login` handler antes de `service.login`.

**Frontend** (`/Users/joaquinmorales13a06/Desktop/Reinar/frontend`):
- Modify: `package.json` (vía `pnpm add @marsidev/react-turnstile`).
- Modify: `hooks/use-auth.ts` — extender `LoginPayload` type con `turnstileToken: string`.
- Modify: `app/(auth)/login/page.tsx` — integrar widget en `LoginStep`, gating del botón, tema sync, reset post-submit.

**Configuración manual (por el usuario, no parte del plan):**
- `.env` backend: `TURNSTILE_SECRET_KEY=...`
- `.env.local` frontend: `NEXT_PUBLIC_TURNSTILE_SITE_KEY=...`
- Configurar dominios permitidos en `dash.cloudflare.com` (incluir `localhost` y el dominio prod).

**Sin tests automáticos** — el proyecto no tiene suite. Verificación con `pnpm tsc --noEmit`, `pnpm lint` y manual en `pnpm dev`.

---

## Task 1: Backend — env + lib + routes + controller (coordinado)

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/config/env.ts`
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/lib/turnstile.ts`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/auth/auth.routes.ts`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/auth/auth.controller.ts`

Working directory: `/Users/joaquinmorales13a06/Desktop/Reinar/server`
Branch: `feat/perfil-auditlog` (already checked-out).

**IMPORTANT:** Before running `pnpm tsc --noEmit`, you must set `TURNSTILE_SECRET_KEY` in `/Users/joaquinmorales13a06/Desktop/Reinar/server/.env` to a non-empty placeholder (e.g. `TURNSTILE_SECRET_KEY=placeholder-for-typecheck`) — otherwise `env.ts` exits with the new validation error and any other `tsx`-based scripts would fail. The user will replace it with the real key separately.

### Step 1: Add `TURNSTILE_SECRET_KEY` to env schema

Read the current `src/config/env.ts` to find the right insertion point. The schema is a `z.object` with many fields. Insert a new entry after the existing `MFA_ENCRYPTION_KEY` line (group with other security/secret keys).

Find this block in `src/config/env.ts`:

```typescript
  MFA_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/, 'Must be 64 lowercase hex characters'),
  COOKIE_SECRET: z.string().min(16),
```

Replace with:

```typescript
  MFA_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/, 'Must be 64 lowercase hex characters'),
  // Cloudflare Turnstile — validado en POST /auth/iniciar-sesion para bloquear bots
  // antes de tocar bcrypt. Sin default: si no está configurada, el server no arranca.
  TURNSTILE_SECRET_KEY: z.string().min(1, 'Configurar la clave secreta de Cloudflare Turnstile'),
  COOKIE_SECRET: z.string().min(16),
```

### Step 2: Add placeholder to `.env` for typecheck

If you don't already have it, add this line to `/Users/joaquinmorales13a06/Desktop/Reinar/server/.env`:

```
TURNSTILE_SECRET_KEY=placeholder-for-typecheck
```

(The user will overwrite this with the real key before running the server.)

### Step 3: Create `src/lib/turnstile.ts`

```typescript
import { env } from '../config/env'

// Endpoint oficial documentado por Cloudflare. No requiere SDK — un solo POST
// con form-urlencoded. Usamos fetch nativo de Node (>= 18 lo trae).
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

### Step 4: Extend `loginSchema` in `src/modules/auth/auth.routes.ts`

Find this block:

```typescript
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})
```

Replace with:

```typescript
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  // Token emitido por el widget de Turnstile en el frontend. El backend lo verifica
  // contra Cloudflare antes de tocar bcrypt — fail-fast contra bots/scripts.
  turnstileToken: z.string().min(1, 'Token de verificación requerido'),
})
```

### Step 5: Modify `login` handler in `src/modules/auth/auth.controller.ts`

First, add the import at the top of the file. Find this block of imports:

```typescript
import { Request, Response, NextFunction } from 'express'
import * as authService from './auth.service'
import { env } from '../../config/env'
import { AppError } from '../../middleware/error.middleware'
```

Replace with:

```typescript
import { Request, Response, NextFunction } from 'express'
import * as authService from './auth.service'
import { env } from '../../config/env'
import { AppError } from '../../middleware/error.middleware'
import { verificarTurnstile } from '../../lib/turnstile'
```

Then find the `login` handler:

```typescript
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.login(req.body.email, req.body.password)
    if ('mfaRequired' in result) {
      res.json({ success: true, data: result })
      return
    }
    setRefreshCookie(res, result.refreshToken)
    // refreshToken omitted from body — client reads it from the HTTP-only cookie, not from JSON
    res.json({ success: true, data: { accessToken: result.accessToken, user: result.user } })
  } catch (err) { next(err) }
}
```

Replace with:

```typescript
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
    // refreshToken omitted from body — client reads it from the HTTP-only cookie, not from JSON
    res.json({ success: true, data: { accessToken: result.accessToken, user: result.user } })
  } catch (err) { next(err) }
}
```

### Step 6: Verify

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm tsc --noEmit
```

Expected: no errors. If the env validation fails because `TURNSTILE_SECRET_KEY` is missing from `.env`, go back to Step 2.

### Step 7: Commit

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/config/env.ts src/lib/turnstile.ts src/modules/auth/auth.routes.ts src/modules/auth/auth.controller.ts
git commit -m "feat(auth): verificar token cloudflare turnstile antes de bcrypt en login"
```

---

## Task 2: Frontend — install package + extend LoginPayload type

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/package.json` (vía pnpm)
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/hooks/use-auth.ts`

Working directory: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend`
Branch: `feat/perfil-auditlog`.

### Step 1: Install package

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm add @marsidev/react-turnstile
```

Expected: package added, `pnpm-lock.yaml` updated.

### Step 2: Verify it's in package.json

```bash
grep '"@marsidev/react-turnstile"' package.json
```

Expected: one line with the version.

### Step 3: Extend `LoginPayload` in `hooks/use-auth.ts`

Find this exact line in `hooks/use-auth.ts`:

```typescript
type LoginPayload = { email: string; password: string };
```

Replace with:

```typescript
// turnstileToken: token emitido por el widget de Cloudflare en el LoginStep.
// El backend lo valida contra siteverify antes de tocar bcrypt.
type LoginPayload = { email: string; password: string; turnstileToken: string };
```

### Step 4: Verify

```bash
pnpm tsc --noEmit
```

Expected: ONE error in `app/(auth)/login/page.tsx` complaining that the `mutateAsync` call is missing `turnstileToken` — this is INTENTIONAL and will be fixed in Task 3. Note the error and continue. (If you want to silence it for now, you can skip running tsc until Task 3.)

### Step 5: Commit

```bash
git add package.json pnpm-lock.yaml hooks/use-auth.ts
git commit -m "feat(login-turnstile): instalar @marsidev/react-turnstile y extender LoginPayload"
```

---

## Task 3: Frontend — integrate widget in LoginStep

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/app/(auth)/login/page.tsx`

Working directory: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend`
Branch: `feat/perfil-auditlog`.

### Step 1: Read current LoginStep to find insertion points

```bash
sed -n '1,30p' "app/(auth)/login/page.tsx"
sed -n '40,75p' "app/(auth)/login/page.tsx"
```

The relevant region is the `LoginStep` function — uses `useForm`, `loginMutation`, and renders a form with email + password fields and a submit button.

### Step 2: Add imports

Find the imports block (top of file). It currently includes `import { useState, useRef, useEffect } from 'react';`. If `useRef` and `useEffect` are NOT already there, ensure they are. Then add the Turnstile import:

Find:

```typescript
import { useState, useRef, useEffect } from 'react';
```

Confirm it has all three. If not, fix it to be exactly that. Then below that line, add:

```typescript
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
```

### Step 3: Add SITE_KEY constant at module level

Find this region near the top, before any function declarations (after imports, before `const loginSchema = ...`):

```typescript
const mfaSchema = z.object({
```

Insert immediately BEFORE that line:

```typescript
// Si la var no está configurada en build, el frontend muestra un mensaje claro
// en lugar del form — preferimos sistema bloqueado a sin captcha.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

```

### Step 4: Modify LoginStep — guard + state + theme observer + widget + gating

Find the entire `LoginStep` function (starts with `function LoginStep({ onMfaRequired }: Step1Props) {`). The new full body is below — replace the function ENTIRELY (find and replace the existing `function LoginStep` block until its closing `}`).

The full replacement:

```typescript
function LoginStep({ onMfaRequired }: Step1Props) {
  if (!SITE_KEY) {
    return (
      <div className="text-sm text-danger p-4">
        Variable NEXT_PUBLIC_TURNSTILE_SITE_KEY no configurada. Avisar a soporte.
      </div>
    );
  }

  const [showPwd, setShowPwd] = useState(false);
  const loginMutation = useLoginMutation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const router = useRouter();

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

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFields>({
    resolver: zodResolver(loginSchema),
  });

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
      // contra Cloudflare (expirado, ya usado, sospechoso). Mismo manejo inline que
      // los demás errores de login (mensaje del backend en toast).
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
            <Icon name="lock" size={14} />
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
            onClick={() => setShowPwd((v) => !v)}
            aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            <Icon name={showPwd ? 'eye' : 'eye'} size={14} />
          </button>
        </div>
        {errors.password && (
          <div className={fieldError}>
            <Icon name="alertTriangle" size={12} /> {errors.password.message}
          </div>
        )}
      </div>

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
        className="w-full flex items-center justify-center gap-1.5 h-11 rounded bg-accent text-navy text-sm font-semibold cursor-pointer border-none transition-colors hover:bg-accent-dim disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loginMutation.isPending
          ? <><Spinner size={12} /> Iniciando sesión…</>
          : !turnstileToken
            ? <>Cargando verificación…</>
            : <><>Iniciar sesión</> <Icon name="arrowRight" size={14} /></>
        }
      </button>

      <p className="mt-6 text-xs text-tx-muted text-center">¿Problemas para acceder? Contactá a TI · <span className="font-mono">personal@joaquinmorales.dev</span></p>
    </form>
  );
}
```

**Important caveat about preserving existing JSX:** The replacement above tries to preserve the EXACT existing form structure (logo, email field, password field, submit button, footer text). Before applying, read the current `LoginStep` body in full to confirm the styling classes and footer text match. If your file has slight differences (e.g., different `inputBase` class, different footer text, different button copy), preserve those — only the new pieces (the Turnstile import, SITE_KEY guard, turnstileToken state, theme observer, onSubmit change, `<Turnstile>` widget, and updated submit button label/gating) should be NEW. The rest is unchanged.

If the existing file's `LoginStep` has structural differences that would make a wholesale replace risky, prefer surgical edits in this order:
1. Insert the `if (!SITE_KEY) return ...` guard at the top of the function body.
2. Insert the `turnstileRef`, `turnstileToken` state, and `tema` + `useEffect` block after the existing `setAuth`/`router` declarations.
3. Modify `onSubmit` to: check `turnstileToken` first, spread it into `mutateAsync`, then call `reset()` and `setTurnstileToken(null)` after.
4. Insert the `<div className="mb-4"><Turnstile ... /></div>` block BEFORE the submit button.
5. Modify the submit button's `disabled` to include `|| !turnstileToken` and the children to show "Cargando verificación…" when token is null.

### Step 5: Verify

```bash
pnpm tsc --noEmit
```

Expected: NO errors. The Task 2 type mismatch is now resolved because `mutateAsync` receives `turnstileToken`.

### Step 6: Lint check (only mention new errors)

```bash
pnpm lint 2>&1 | grep -E "(auth)/login|use-auth"
```

Expected: zero output, OR only pre-existing warnings (not errors). If new errors appear, fix them inline.

### Step 7: Commit

```bash
git add "app/(auth)/login/page.tsx"
git commit -m "feat(login-turnstile): widget cloudflare en LoginStep con tema sync y reset"
```

---

## Task 4: Verification + push + update existing PRs

**Files:** — no code changes.

### Step 1: Final tsc + lint (frontend)

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm tsc --noEmit
pnpm lint 2>&1 | tail -5
```

Expected: tsc clean. Lint: zero errors NEW from these 2 tasks (Task 2, Task 3). Pre-existing warnings in unrelated files are OK.

### Step 2: Final tsc (backend)

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm tsc --noEmit
```

Expected: clean.

### Step 3: Manual end-to-end smoke test (suggested, optional)

User can do this with both servers running:
- Levantar backend (`pnpm dev` en server) y frontend (`pnpm dev` en frontend).
- Abrir `localhost:3001/login`.
- Confirmar que aparece el widget de Turnstile debajo de Password.
- Confirmar que el botón "Iniciar sesión" arranca como "Cargando verificación…" y se habilita una vez que el widget pasa.
- Login con credenciales válidas → redirect a /dashboard. La entry del widget debe respetar dark mode si está activo.
- Cambiar a dark mode desde TweaksPanel — el widget debe cambiar de tema en vivo.
- Intentar el login con DevTools modificando el payload (borrar `turnstileToken`) → backend debe responder 400 VALIDATION_ERROR.

(Si el usuario no tiene las keys reales todavía, este step se difiere.)

### Step 4: Push frontend (actualiza PR #29)

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git push 2>&1 | tail -3
```

Expected: push exitoso. La PR #29 se actualiza automáticamente con los nuevos commits.

### Step 5: Push backend (actualiza PR #66)

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git push 2>&1 | tail -3
```

Expected: push exitoso. La PR #66 se actualiza automáticamente.

### Step 6: Actualizar descripciones de las PRs

Las PRs #29 (frontend) y #66 (backend) tienen títulos y descripciones de Rama 18 que ya no reflejan el alcance completo (ahora también incluyen Turnstile). Actualizar:

**Backend PR #66:**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
gh pr edit 66 --title "feat(auth): rama 18 + cloudflare turnstile en login" --body "$(cat <<'EOF'
## Summary

**Rama 18 (perfil + 2FA):**
- Nuevo endpoint `PATCH /api/v1/auth/perfil` para que el usuario edite su propio `nombre`/`apellido`.
- Issuer del TOTP URI cambia a `REINAR SV`, agrega `&image=` con favicon para Authy/similares.

**Cloudflare Turnstile (extensión de scope):**
- `POST /auth/iniciar-sesion` ahora exige `turnstileToken` en el payload.
- Nuevo helper `src/lib/turnstile.ts` que valida contra `https://challenges.cloudflare.com/turnstile/v0/siteverify` con timeout 5s.
- Validación ocurre en el controller ANTES de invocar `service.login` — fail-fast antes de bcrypt.
- Nueva env var **requerida** `TURNSTILE_SECRET_KEY` (sin default — server no arranca sin ella).

## Test plan

- [ ] `PATCH /auth/perfil` con `{nombre, apellido}` válidos → 200.
- [ ] Login en el frontend con widget de Turnstile pasa correctamente.
- [ ] Login sin `turnstileToken` en el payload → 400 VALIDATION_ERROR.
- [ ] Login con token inválido → 403 TURNSTILE_FAILED.
- [ ] Al escanear el nuevo QR de 2FA la app muestra "REINAR SV".

**Setup obligatorio antes de mergear a prod:** agregar `TURNSTILE_SECRET_KEY` al `.env` del VPS. Crear sitio en `dash.cloudflare.com` y configurar el dominio prod en la whitelist.

Rama frontend: `feat/perfil-auditlog` (PR #29 — mergear este primero).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" 2>&1 | tail -3
```

**Frontend PR #29:**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
gh pr edit 29 --title "feat: rama 18 (perfil + auditlog) + cloudflare turnstile en login" --body "$(cat <<'EOF'
## Summary

**Rama 18 (perfil + auditlog):**
- `/perfil`: datos básicos, editar nombre, cambiar contraseña con fortaleza visual, activar/desactivar 2FA con wizard QR (`qrcode.react`).
- `/auditlog`: tabla filtrable + drawer con diff antes/después.
- Topbar: item "Mi perfil" en dropdown del usuario.

**Cloudflare Turnstile (extensión de scope):**
- Widget `@marsidev/react-turnstile` integrado en `LoginStep`.
- Botón submit deshabilitado hasta que el widget emite token.
- Tema del widget sincronizado con dark mode del shell vía MutationObserver.
- Reset automático post-submit (tokens son single-use).
- Mensaje claro si `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no está configurada.

## Test plan

**Rama 18:**
- [ ] Topbar muestra "Mi perfil"; navega a /perfil.
- [ ] Editar nombre actualiza el topbar al instante.
- [ ] Cambiar contraseña: error "actual incorrecta" inline, sin toast.
- [ ] Activar 2FA: QR escaneable, la app de autenticación muestra "REINAR SV".
- [ ] TOTP inválido → shake + inline.
- [ ] Desactivar 2FA pide TOTP (no password).
- [ ] `/auditlog`: ADMIN/GERENTE entran; otros roles ven "Sin acceso".
- [ ] Drawer del auditlog abre con diff antes/después.

**Turnstile:**
- [ ] Widget aparece debajo de Password en /login.
- [ ] Botón "Iniciar sesión" deshabilitado hasta que el widget emite token.
- [ ] Tema del widget coincide con dark/light del shell, cambia en vivo.
- [ ] Login con credenciales válidas + Turnstile válido → redirect a /dashboard.
- [ ] Login con MFA activo → segundo paso funciona sin requerir otro captcha.

**Setup obligatorio:** agregar `NEXT_PUBLIC_TURNSTILE_SITE_KEY` al `.env.local`. En producción, configurar dominio en `dash.cloudflare.com`.

Specs: `docs/superpowers/specs/2026-05-30-perfil-auditlog-design.md` + `docs/superpowers/specs/2026-05-30-login-turnstile-design.md`
Plans: `docs/superpowers/plans/2026-05-30-perfil-auditlog.md` + `docs/superpowers/plans/2026-05-30-login-turnstile.md`

**Requiere mergear primero:** PR backend #66.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" 2>&1 | tail -3
```

Expected: ambos `gh pr edit` devuelven 0 / la URL de la PR.

---

## Self-Review

**Spec coverage:**

| Sección del spec | Task que lo implementa |
|---|---|
| Env var `TURNSTILE_SECRET_KEY` en backend | Task 1 (Step 1, 2) |
| Helper `verificarTurnstile` con timeout, error swallowing | Task 1 (Step 3) |
| `loginSchema` extendido con `turnstileToken` | Task 1 (Step 4) |
| Controller valida Turnstile antes de `service.login` | Task 1 (Step 5) |
| Install `@marsidev/react-turnstile` | Task 2 (Step 1) |
| `LoginPayload` type extendido | Task 2 (Step 3) |
| Widget en LoginStep, gating del botón, reset post-submit | Task 3 (Step 4) |
| Tema sync con MutationObserver | Task 3 (Step 4) |
| Guard si SITE_KEY no está configurada | Task 3 (Step 3, 4) |
| 403 TURNSTILE_FAILED handling | Task 1 (Step 5) + Task 3 (Step 4 onSubmit) |
| Push + actualizar PRs existentes | Task 4 |

Coverage completo.

**Placeholder scan:** no hay TBDs ni TODOs.

**Type consistency:** `verificarTurnstile(token, ip?)` aparece en Task 1 con la misma firma usada en Step 5. `LoginPayload` type definido en Task 2 y usado consistentemente en Task 3 (`mutateAsync({ ...data, turnstileToken })`). `TurnstileInstance` ref tipo definido en Task 3 (importado del paquete). Sin gaps.

**Notas operativas:**
- Task 1 modifica 4 archivos coordinados en un solo commit porque cambiar el schema sin agregar la validación deja el backend en estado inconsistente. No tiene sentido fragmentar.
- Task 2 produce un error TS intencional que Task 3 resuelve. El implementer debe entender que esto es esperado y proceder.
- Task 3 incluye un caveat operativo: si el `LoginStep` actual difiere estructuralmente del que se asume, hay que hacer edits surgicales en lugar de reemplazo completo. Esto evita destruir copy/styling que pueda haber cambiado entre el spec y la realidad.
- El proyecto NO tiene tests automáticos. Verificación: `pnpm tsc --noEmit` + `pnpm lint` + manual en browser (deferido al usuario porque necesita configurar las keys).
