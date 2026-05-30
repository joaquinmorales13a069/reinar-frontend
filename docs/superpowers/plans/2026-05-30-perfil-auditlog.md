# Perfil y Auditlog (Rama 18) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar la página de perfil del usuario autenticado (datos básicos editables, cambio de contraseña, gestión de 2FA con QR scaneable) y la vista de auditoría filtrable (solo ADMIN/GERENTE).

**Architecture:** Un endpoint nuevo en backend (`PATCH /auth/perfil`) y dos modificaciones al MFA URI (issuer "REINAR SV" + `image=`). El frontend agrega 3 hooks de React Query, ~10 componentes y 2 páginas. El QR se renderiza client-side con `qrcode.react` desde el URI `otpauth://` que devuelve el backend.

**Tech Stack:** Next.js 16 (App Router, React 19), TanStack React Query v5, React Hook Form + Zod v4, sonner, Tailwind v4, Axios, Zustand, `qrcode.react` (nuevo).

**Spec de referencia:** `docs/superpowers/specs/2026-05-30-perfil-auditlog-design.md`

**Convenciones obligatorias del proyecto (revisar antes de codificar):**
- `CLAUDE.md` — comentarios "why" en español, sin clases vanilla CSS en `globals.css`, sin valores arbitrarios (`h-[20px]`), forms con RHF + Zod, toasts con `sonner`.
- `docs/plan-trabajo-frontend.md` — secciones "Tailwind primero", "Headers de tablas — clase única".
- Patrón de hooks: ver `hooks/use-servicios.ts` (extractErrorMessage helper duplicado intencionalmente por archivo).
- Patrón de errores inline: usar `trySetFieldErrorFromApi` y `applyValidationErrors` de Rama 17.
- Patrón de permisos: ver `lib/ajustes.ts` (`esAdmin`, `puedeAccederAjustes`).
- Sticky footer canónico: `sticky bottom-0 left-0 right-0 -mx-4 px-4 py-3 bg-bg border-t border-bd flex justify-end gap-2`.
- Thead canónico: `bg-bg-sunken text-2xs uppercase tracking-wider text-tx-3`.

---

## Mapa de archivos

**Backend (rama `feat/perfil-auditlog`):**
- Modify: `src/modules/auth/auth.routes.ts` — agregar `router.patch('/perfil', ...)`.
- Modify: `src/modules/auth/auth.service.ts` — agregar `actualizarPerfil`; modificar `configurarMfa` para issuer "REINAR SV" y `image=`.
- Modify: `src/modules/auth/auth.controller.ts` — agregar handler `actualizarPerfil`.

**Frontend (rama `feat/perfil-auditlog`):**

Crear:
- `lib/schemas/perfil.ts` — Zod schemas (editar perfil, cambiar contraseña, TOTP).
- `lib/schemas/auditlog.ts` — Zod schema para validación de filtros (rango fechas).
- `lib/auditlog.ts` — Helpers: `colorPorAccion`, listas de acciones/entidades sugeridas.
- `hooks/use-perfil.ts` — useMiPerfil, useActualizarPerfil, useCambiarContrasena.
- `hooks/use-mfa.ts` — useConfigurarMfa, useVerificarMfa, useDesactivarMfa.
- `hooks/use-auditlog.ts` — useAuditLog (paginado, filtros).
- `components/perfil/PerfilTarjeta.tsx` — avatar + datos + edit nombre inline.
- `components/perfil/CambiarContrasenaCard.tsx` — form de cambio de contraseña.
- `components/perfil/MfaCard.tsx` — máquina de estados idle/setup/done/disable.
- `components/perfil/Mfa2faSetupWizard.tsx` — pasos QR + verificar TOTP.
- `components/perfil/Mfa2faDisable.tsx` — form para desactivar con TOTP.
- `components/auditlog/AuditLogFilters.tsx` — search + chips fecha + selectores.
- `components/auditlog/AuditLogTable.tsx` — tabla con paginación.
- `components/auditlog/AuditLogDrawer.tsx` — detalle con diff antes/después.
- `app/(dashboard)/perfil/page.tsx` — Mi perfil (todos los autenticados).
- `app/(dashboard)/auditlog/page.tsx` — Auditoría (gate ADMIN/GERENTE).

Modificar:
- `types/api.ts` — agregar tipos para perfil, MFA y auditlog.
- `components/layout/Topbar.tsx` — agregar item "Mi perfil" en el dropdown del usuario.
- `package.json` — agregar `qrcode.react`.

**Sin tests automáticos** — el proyecto no tiene suite. Verificación: `pnpm tsc --noEmit`, `pnpm lint`, verificación manual en `pnpm dev` (localhost:3001 frente al backend en :3000).

---

## Task 1: Backend — endpoint PATCH /auth/perfil + cambios MFA (issuer + image)

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/auth/auth.routes.ts`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/auth/auth.service.ts`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/auth/auth.controller.ts`

Working directory: `/Users/joaquinmorales13a06/Desktop/Reinar/server`
Branch: `feat/perfil-auditlog` (ya checked-out).

- [ ] **Step 1: Modificar `auth.routes.ts`**

Find this block (current end of route definitions, before `export default router`):

```typescript
router.delete('/mfa', authenticate, validate(totpSchema), controller.desactivarMfa)

export default router
```

Replace with:

```typescript
router.delete('/mfa', authenticate, validate(totpSchema), controller.desactivarMfa)

// Permite al usuario autenticado editar su propio nombre/apellido. Email y rol
// quedan fuera deliberadamente: requieren ADMIN via /usuarios (separación de
// privilegios; previene self-escalation de rol).
const actualizarPerfilSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es requerido').max(100),
  apellido: z.string().trim().min(1, 'El apellido es requerido').max(100),
})

router.patch('/perfil', authenticate, validate(actualizarPerfilSchema), controller.actualizarPerfil)

export default router
```

- [ ] **Step 2: Modificar `auth.service.ts` — issuer + image en `configurarMfa`**

Find this block within `configurarMfa`:

```typescript
  const otpauthUri = authenticator.keyuri(email, 'Reinar Dashboard', secret)
  return { otpauthUri }
```

Replace with:

```typescript
  // Issuer "REINAR SV" para que la app de autenticación muestre ese nombre y
  // no "Reinar Dashboard" / "localhost". El parámetro image= es no-estándar
  // (no en RFC 6238) pero Authy y similares lo respetan para mostrar el favicon
  // de la empresa en la lista de cuentas. Apps que no lo soportan lo ignoran
  // silenciosamente — sin riesgo.
  const FAVICON_URL = 'https://reinarsa.com/wp-content/uploads/2025/07/favicon-300x300.webp'
  const baseUri = authenticator.keyuri(email, 'REINAR SV', secret)
  const otpauthUri = `${baseUri}${baseUri.includes('?') ? '&' : '?'}image=${encodeURIComponent(FAVICON_URL)}`
  return { otpauthUri }
```

- [ ] **Step 3: Agregar `actualizarPerfil` en `auth.service.ts`**

Find this block (current `obtenerPerfil`):

```typescript
export async function obtenerPerfil(usuarioId: string) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, nombre: true, apellido: true, email: true, rol: true, mfaActivo: true, ultimoAcceso: true },
  })
  if (!usuario) throw new AppError(404, 'NOT_FOUND', 'Usuario no encontrado')
  return usuario
}
```

Insert immediately after that block (and before `cambiarContrasena`):

```typescript
// Self-edit limitado a nombre/apellido — email y rol son ADMIN-only via /usuarios
// para preservar separación de privilegios y evitar self-escalation de rol.
export async function actualizarPerfil(usuarioId: string, dto: { nombre: string; apellido: string }) {
  const usuario = await prisma.usuario.update({
    where: { id: usuarioId },
    data: { nombre: dto.nombre, apellido: dto.apellido },
    select: { id: true, nombre: true, apellido: true, email: true, rol: true, mfaActivo: true, ultimoAcceso: true },
  })
  await prisma.auditLog.create({
    data: {
      usuarioId,
      entidad: 'Usuario',
      entidadId: usuarioId,
      accion: 'ACTUALIZAR_PERFIL',
      camposDespues: { nombre: dto.nombre, apellido: dto.apellido },
    },
  })
  return usuario
}
```

- [ ] **Step 4: Agregar handler `actualizarPerfil` en `auth.controller.ts`**

Find this block (current `obtenerPerfil`):

```typescript
export async function obtenerPerfil(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuario = await authService.obtenerPerfil(req.user!.sub)
    res.json({ success: true, data: usuario })
  } catch (err) { next(err) }
}
```

Insert immediately after (before `cambiarContrasena`):

```typescript
export async function actualizarPerfil(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Devolver UserProfile completo para que el cliente hidrate su auth store sin refetch.
    const usuario = await authService.actualizarPerfil(req.user!.sub, req.body)
    res.json({ success: true, data: usuario })
  } catch (err) { next(err) }
}
```

- [ ] **Step 5: Verificar compilación**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 6: Probar el endpoint manualmente con el server corriendo**

Asumiendo que `pnpm dev` del backend está corriendo en `:3000` y el usuario está logueado en `localhost:3001` con un token válido en el navegador, el endpoint puede probarse desde DevTools console:

```js
// Reemplazar TOKEN por accessToken válido (de useAuthStore en runtime)
await fetch('http://localhost:3000/api/v1/auth/perfil', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
  credentials: 'include',
  body: JSON.stringify({ nombre: 'Joaquin', apellido: 'Morales' })
}).then(r => r.json())
```

Expected: `{ success: true, data: { id, nombre: 'Joaquin', apellido: 'Morales', email, rol, mfaActivo, ultimoAcceso } }`.

Si el server no está corriendo o el usuario no quiere probar inline, este paso se puede diferir a la verificación final (Task 13).

- [ ] **Step 7: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/modules/auth/auth.routes.ts src/modules/auth/auth.service.ts src/modules/auth/auth.controller.ts
git commit -m "feat(auth): PATCH /perfil self-edit + issuer REINAR SV con image en mfa"
```

---

## Task 2: Frontend — instalar qrcode.react y agregar tipos TS

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/package.json` (vía pnpm add)
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/types/api.ts`

Working directory: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend`
Branch: `feat/perfil-auditlog` (ya checked-out).

- [ ] **Step 1: Instalar `qrcode.react`**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm add qrcode.react
```

Expected: package agregado, lockfile actualizado.

- [ ] **Step 2: Verificar que `package.json` recibió la entry**

```bash
grep '"qrcode.react"' package.json
```

Expected: una línea con la versión.

- [ ] **Step 3: Agregar tipos al final de `types/api.ts`**

Append exactly this block at the END of `types/api.ts`:

```typescript
// ─── Rama 18: Perfil y Auditlog ─────────────────────────────────────

// Perfil reusa el shape de Usuario; alias por semántica del módulo.
// El backend devuelve los mismos 10 campos para GET /auth/perfil y PATCH /auth/perfil.
export type Perfil = Usuario;

export type ActualizarPerfilDto = {
  nombre: string;
  apellido: string;
};

export type CambiarContrasenaDto = {
  passwordActual: string;
  passwordNuevo: string;
};

export type ConfigurarMfaResponse = {
  // URI otpauth:// completo, incluye secret + issuer + image. El frontend lo
  // pasa directo a <QRCodeSVG /> y extrae el secret para mostrarlo en modo manual.
  otpauthUri: string;
};

export type TotpDto = {
  // 6 dígitos exactos — el backend rechaza otra cosa con 400.
  totpCode: string;
};

export type AuditLog = {
  id: string;
  usuarioId: string | null;
  // null si el usuario fue eliminado después del evento.
  usuario: { nombre: string; apellido: string; email: string } | null;
  entidad: string;
  entidadId: string;
  accion: string;
  camposAntes: Record<string, unknown> | null;
  camposDespues: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

// Nombres del parámetro coinciden con el backend (NO `fechaDesde`/`fechaHasta`).
export type FiltrosAuditLog = {
  page?: number;
  limit?: number;
  entidad?: string;
  entidadId?: string;
  usuarioId?: string;
  accion?: string;
  desde?: string;
  hasta?: string;
};
```

- [ ] **Step 4: Verificar compilación**

```bash
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml types/api.ts
git commit -m "feat(perfil-auditlog): tipos TS y dependencia qrcode.react"
```

---

## Task 3: Schemas Zod + helpers de auditlog

**Files:**
- Create: `lib/schemas/perfil.ts`
- Create: `lib/schemas/auditlog.ts`
- Create: `lib/auditlog.ts`

- [ ] **Step 1: Crear `lib/schemas/perfil.ts`**

```typescript
// Schemas Zod del frontend. Replican los validators del backend auth.routes.ts
// para feedback inmediato. El backend siempre revalida; no estamos saltándonos
// validación. Si se introduce un paquete shared, este archivo se elimina.
import { z } from 'zod';

// ─── Editar perfil propio (nombre/apellido) ────────────────────────

export const actualizarPerfilSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres'),
  apellido: z.string().trim().min(1, 'El apellido es requerido').max(100, 'Máximo 100 caracteres'),
});

export type ActualizarPerfilForm = z.infer<typeof actualizarPerfilSchema>;

// ─── Cambiar contraseña ────────────────────────────────────────────

// `confirmar` vive solo en UI — el backend nunca lo ve. La refine garantiza
// que coincida con `passwordNuevo` antes de mandar al server.
export const cambiarContrasenaSchema = z.object({
  passwordActual: z.string().min(1, 'Ingresá tu contraseña actual'),
  passwordNuevo: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  confirmar: z.string().min(1, 'Confirmá la nueva contraseña'),
}).refine((d) => d.passwordNuevo === d.confirmar, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmar'],
});

export type CambiarContrasenaForm = z.infer<typeof cambiarContrasenaSchema>;

// ─── Código TOTP (6 dígitos exactos) ───────────────────────────────

export const totpSchema = z.object({
  totpCode: z.string().regex(/^\d{6}$/, 'Ingresá los 6 dígitos del código'),
});

export type TotpForm = z.infer<typeof totpSchema>;
```

- [ ] **Step 2: Crear `lib/schemas/auditlog.ts`**

```typescript
// Schema de validación para filtros de auditlog. El rango fecha se valida acá
// (desde <= hasta) en lugar de en el componente porque RHF + zodResolver simplifica
// el feedback inline.
import { z } from 'zod';

export const filtrosAuditLogSchema = z.object({
  entidad: z.string().optional(),
  accion: z.string().optional(),
  desde: z.string().optional(),
  hasta: z.string().optional(),
}).refine(
  // Si ambos están presentes, desde no puede ser posterior a hasta.
  (d) => !d.desde || !d.hasta || d.desde <= d.hasta,
  { message: 'El rango es inválido (desde > hasta)', path: ['hasta'] },
);

export type FiltrosAuditLogForm = z.infer<typeof filtrosAuditLogSchema>;
```

- [ ] **Step 3: Crear `lib/auditlog.ts`**

```typescript
// Helpers compartidos por la tabla y el drawer de auditlog. No exporta hooks
// ni componentes — solo datos y funciones puras.

// Lista de entidades conocidas que aparecen como `entidad` en los registros
// de auditoría. Se usa para poblar el <select> del filtro. Si el backend
// genera una entidad nueva no listada, el filtro como input free-text via
// query manual sigue funcionando.
export const ENTIDADES_CONOCIDAS = [
  'Usuario',
  'Cliente',
  'Contacto',
  'Cotizacion',
  'Factura',
  'Equipo',
  'HerramientaTipo',
  'HerramientaUnidad',
  'Consumible',
  'PiezaTipo',
  'CuerpoAndamio',
  'Bodega',
  'Servicio',
  'Proyecto',
  'ActaEntrega',
  'Recepcion',
  'Pago',
  'NotaCredito',
  'Retencion',
  'Mantenimiento',
  'DepositoGarantia',
  'ConfiguracionEmpresa',
  'ConfiguracionReportes',
] as const;

// Lista de acciones top que se sugieren en el datalist del filtro accion.
// El input es free-text — esta lista solo es autocompletado, no un enum.
// Cubre las acciones más usadas hoy; otras se pueden tipear a mano.
export const ACCIONES_SUGERIDAS = [
  'CREAR_USUARIO',
  'ACTUALIZAR_USUARIO',
  'CAMBIAR_ESTADO_USUARIO',
  'ACTUALIZAR_PERFIL',
  'ACTUALIZAR_CONFIGURACION',
  'ACTUALIZAR_CONFIGURACION_REPORTES',
  'CREAR_COTIZACION',
  'ACTUALIZAR_COTIZACION',
  'CAMBIAR_ESTADO_COTIZACION',
  'CANCELAR_COTIZACION_POR_ANULACION_FACTURA',
  'CREAR_EQUIPO',
  'ACTUALIZAR_EQUIPO',
  'CAMBIAR_ESTADO_EQUIPO',
  'MOVER_BODEGA_EQUIPO',
  'ACTA_CREADA',
  'ACTA_DESPACHADA',
  'ACTA_ENTREGADA',
  'RECEPCION_REGISTRADA',
  'CREAR_MANTENIMIENTO',
  'REGISTRAR_SALIDA_MANTENIMIENTO',
] as const;

// Deriva el color del badge a partir del prefijo del string. Las acciones del
// backend crecen con cada módulo — un map exhaustivo se desincroniza, este
// prefix-match es self-healing.
type AccionKind = 'ok' | 'info' | 'warn' | 'danger';

export function colorPorAccion(accion: string): AccionKind {
  const a = accion.toUpperCase();
  if (a.startsWith('CREAR') || a.startsWith('REGISTRAR_PAGO') || a.startsWith('RECIBIR')) return 'ok';
  if (a.startsWith('ELIMINAR') || a.startsWith('CANCELAR') || a.startsWith('DESACTIVAR') || a.startsWith('ANULAR')) return 'danger';
  if (a.startsWith('CAMBIAR_ESTADO') || a.startsWith('REGISTRAR') || a.startsWith('AJUSTAR') || a.startsWith('TRANSFERIR')) return 'warn';
  return 'info';
}

// Helpers de chips de período. Devuelven `desde` como ISO date string (YYYY-MM-DD)
// para pasarlo al backend, que hace z.coerce.date().
export type Periodo = 'hoy' | 'semana' | 'mes' | null;

export function calcularDesdePeriodo(periodo: Periodo): string | undefined {
  if (!periodo) return undefined;
  const ahora = new Date();
  if (periodo === 'hoy') {
    ahora.setHours(0, 0, 0, 0);
    return ahora.toISOString();
  }
  if (periodo === 'semana') {
    // Lunes 00:00 — diaSemana=0 (Dom) cuenta como retroceder 6 días.
    const diaSemana = ahora.getDay();
    const diasDesdeElLunes = diaSemana === 0 ? 6 : diaSemana - 1;
    ahora.setDate(ahora.getDate() - diasDesdeElLunes);
    ahora.setHours(0, 0, 0, 0);
    return ahora.toISOString();
  }
  // mes
  ahora.setDate(1);
  ahora.setHours(0, 0, 0, 0);
  return ahora.toISOString();
}
```

- [ ] **Step 4: Verificar compilación**

```bash
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/perfil.ts lib/schemas/auditlog.ts lib/auditlog.ts
git commit -m "feat(perfil-auditlog): schemas zod y helpers de auditlog"
```

---

## Task 4: Hook `use-perfil`

**Files:**
- Create: `hooks/use-perfil.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import type {
  ApiResponse,
  Perfil,
  ActualizarPerfilDto,
  CambiarContrasenaDto,
} from '@/types/api';

// Mismo patrón que use-servicios.ts: helper duplicado intencionalmente para
// mantener cada archivo de hooks autocontenido.
function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

export function useMiPerfil() {
  return useQuery({
    queryKey: ['perfil'],
    queryFn: () =>
      api.get<ApiResponse<Perfil>>('/auth/perfil').then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
  });
}

export function useActualizarPerfil() {
  const qc = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (data: ActualizarPerfilDto) =>
      api.patch<ApiResponse<Perfil>>('/auth/perfil', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (perfil) => {
      qc.invalidateQueries({ queryKey: ['perfil'] });
      // setAuth además de invalidar: el topbar lee de useAuthStore.user, no de
      // la query ['perfil']. Sin esto, el avatar+nombre del header quedan stale
      // hasta el próximo refresh manual o renovación de token.
      if (accessToken) {
        setAuth(accessToken, {
          id: perfil.id,
          nombre: perfil.nombre,
          apellido: perfil.apellido,
          email: perfil.email,
          rol: perfil.rol,
        });
      }
      toast.success('Perfil actualizado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo guardar el perfil.'));
    },
  });
}

export function useCambiarContrasena() {
  return useMutation({
    mutationFn: (data: CambiarContrasenaDto) =>
      api.patch<ApiResponse<unknown>>('/auth/perfil/contrasena', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
      }),
    onSuccess: () => {
      toast.success('Contraseña actualizada.');
    },
    onError: (err) => {
      // El caller puede interceptar para mapear 401 "Contraseña actual incorrecta"
      // a setError('passwordActual'); si no, el toast genérico cubre el resto.
      toast.error(extractErrorMessage(err, 'No se pudo cambiar la contraseña.'));
    },
  });
}
```

- [ ] **Step 2: Verificar compilación**

```bash
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-perfil.ts
git commit -m "feat(perfil-auditlog): hook use-perfil"
```

---

## Task 5: Hook `use-mfa`

**Files:**
- Create: `hooks/use-mfa.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  ConfigurarMfaResponse,
  TotpDto,
} from '@/types/api';

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

export function useConfigurarMfa() {
  return useMutation({
    mutationFn: () =>
      api.post<ApiResponse<ConfigurarMfaResponse>>('/auth/mfa/configurar').then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo configurar 2FA.'));
    },
  });
}

export function useVerificarMfa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TotpDto) =>
      api.post<ApiResponse<unknown>>('/auth/mfa/verificar', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
      }),
    onSuccess: () => {
      // Invalida ['perfil'] para refrescar mfaActivo=true en la tarjeta de perfil.
      qc.invalidateQueries({ queryKey: ['perfil'] });
      toast.success('2FA activado.');
    },
    onError: (err) => {
      // El caller intercepta para mapear "Código TOTP inválido" a setError + shake.
      toast.error(extractErrorMessage(err, 'No se pudo verificar el código.'));
    },
  });
}

export function useDesactivarMfa() {
  const qc = useQueryClient();
  return useMutation({
    // axios.delete con body requiere config explícito: { data }.
    mutationFn: (data: TotpDto) =>
      api.delete<ApiResponse<unknown>>('/auth/mfa', { data }).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['perfil'] });
      toast.success('2FA desactivado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo desactivar 2FA.'));
    },
  });
}
```

- [ ] **Step 2: Verificar compilación**

```bash
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-mfa.ts
git commit -m "feat(perfil-auditlog): hook use-mfa"
```

---

## Task 6: Hook `use-auditlog`

**Files:**
- Create: `hooks/use-auditlog.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { PaginatedResponse, AuditLog, FiltrosAuditLog } from '@/types/api';

export function useAuditLog(filtros: FiltrosAuditLog = {}) {
  return useQuery({
    queryKey: ['auditlog', filtros],
    queryFn: () =>
      api.get<PaginatedResponse<AuditLog>>('/auditlog', { params: filtros }).then((r) => {
        if (!r.data.success) {
          throw new Error('Respuesta inválida del servidor');
        }
        return { data: r.data.data, meta: r.data.meta };
      }),
  });
}
```

- [ ] **Step 2: Verificar compilación**

```bash
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-auditlog.ts
git commit -m "feat(perfil-auditlog): hook use-auditlog"
```

---

## Task 7: `PerfilTarjeta` (datos básicos + edit nombre inline)

**Files:**
- Create: `components/perfil/PerfilTarjeta.tsx`

- [ ] **Step 1: Crear la carpeta y el componente**

```bash
mkdir -p components/perfil
```

```typescript
// components/perfil/PerfilTarjeta.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { useActualizarPerfil } from '@/hooks/use-perfil';
import { actualizarPerfilSchema, type ActualizarPerfilForm } from '@/lib/schemas/perfil';
import { formatDateTime, getInitials } from '@/lib/utils';
import type { Perfil, RolUsuario } from '@/types/api';

const ROL_LABEL: Record<RolUsuario, string> = {
  ADMIN: 'Admin',
  GERENTE: 'Gerente',
  OPERADOR: 'Operador',
  LOGISTICA: 'Logística',
  VISUALIZADOR: 'Visualizador',
};

const inputBase = 'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1 text-left';
const errorCls = 'text-xs text-danger mt-1';

export function PerfilTarjeta({ perfil }: { perfil: Perfil }) {
  const [editando, setEditando] = useState(false);
  const actualizar = useActualizarPerfil();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ActualizarPerfilForm>({
    resolver: zodResolver(actualizarPerfilSchema) as never,
    defaultValues: { nombre: perfil.nombre, apellido: perfil.apellido },
  });

  async function onSubmit(v: ActualizarPerfilForm) {
    await actualizar.mutateAsync({ nombre: v.nombre.trim(), apellido: v.apellido.trim() });
    setEditando(false);
  }

  function cancelar() {
    reset({ nombre: perfil.nombre, apellido: perfil.apellido });
    setEditando(false);
  }

  return (
    <div className="rounded-lg border border-bd bg-surface p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-24 h-24 rounded-full bg-accent text-navy grid place-items-center text-3xl font-bold">
          {getInitials(`${perfil.nombre} ${perfil.apellido}`)}
        </div>

        {!editando ? (
          <>
            <div>
              <h2 className="text-xl font-semibold">{perfil.nombre} {perfil.apellido}</h2>
              <div className="text-sm font-mono text-tx-2 mt-1">{perfil.email}</div>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              <Badge status={ROL_LABEL[perfil.rol]} kind="accent" />
              <Badge status={perfil.mfaActivo ? '2FA activo' : '2FA inactivo'} kind={perfil.mfaActivo ? 'ok' : 'neutral'} />
            </div>
            <div className="text-xs font-mono text-tx-3">
              Último acceso: {perfil.ultimoAcceso ? formatDateTime(perfil.ultimoAcceso) : 'Nunca'}
            </div>
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-tx-2 border border-bd hover:bg-bg-sunken transition-colors"
            >
              <Icon name="edit" size={12} /> Editar nombre
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="w-full text-left">
            <div className="mb-3">
              <label className={labelCls}>Nombre</label>
              <input className={errors.nombre ? inputErr : inputOk} {...register('nombre')} />
              {errors.nombre && <p className={errorCls}>{errors.nombre.message}</p>}
            </div>
            <div className="mb-3">
              <label className={labelCls}>Apellido</label>
              <input className={errors.apellido ? inputErr : inputOk} {...register('apellido')} />
              {errors.apellido && <p className={errorCls}>{errors.apellido.message}</p>}
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={cancelar}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-tx-2 border border-bd hover:bg-bg-sunken transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || actualizar.isPending}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon name="check" size={12} /> Guardar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilación**

```bash
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/perfil/PerfilTarjeta.tsx
git commit -m "feat(perfil-auditlog): PerfilTarjeta con edit nombre inline"
```

---

## Task 8: `CambiarContrasenaCard`

**Files:**
- Create: `components/perfil/CambiarContrasenaCard.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
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

  function PasswordInput({
    name,
    label,
    show,
    onToggle,
  }: {
    name: keyof Pick<CambiarContrasenaForm, 'passwordActual' | 'passwordNuevo' | 'confirmar'>;
    label: string;
    show: boolean;
    onToggle: () => void;
  }) {
    const err = errors[name];
    return (
      <div>
        <label className={labelCls}>{label}</label>
        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            className={err ? inputErr : inputOk}
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
        {err && <p className={errorCls}>{err.message}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-bd bg-surface p-4">
      <h3 className="text-base font-semibold text-tx mb-3">Cambiar contraseña</h3>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <PasswordInput name="passwordActual" label="Contraseña actual" show={showActual} onToggle={() => setShowActual((s) => !s)} />

        <div>
          <PasswordInput name="passwordNuevo" label="Nueva contraseña" show={showNueva} onToggle={() => setShowNueva((s) => !s)} />
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

        <PasswordInput name="confirmar" label="Confirmar nueva contraseña" show={showConfirmar} onToggle={() => setShowConfirmar((s) => !s)} />

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
```

- [ ] **Step 2: Verificar compilación**

```bash
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/perfil/CambiarContrasenaCard.tsx
git commit -m "feat(perfil-auditlog): CambiarContrasenaCard con fortaleza visual"
```

---

## Task 9: `MfaCard` (máquina de estados con wizard y disable)

**Files:**
- Create: `components/perfil/MfaCard.tsx` (componente principal + sub-componentes inline)

- [ ] **Step 1: Crear el archivo**

```typescript
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
    const { otpauthUri } = await configurar.mutateAsync();
    setOtpauthUri(otpauthUri);
    setMode('setup');
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
          <b>2.</b> Tocá "+" y seleccioná "Escanear código QR".
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
```

- [ ] **Step 2: Verificar que los íconos `shield`, `copy`, `arrowLeft` existen**

```bash
grep -E "shield:|copy:|arrowLeft:" components/ui/Icon.tsx | head -5
```

Expected: las 3 entries presentes. Si alguno falta, registrar la concern y aún así commitear; tomar la decisión de agregarlo en task de verificación final.

- [ ] **Step 3: Verificar compilación**

```bash
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/perfil/MfaCard.tsx
git commit -m "feat(perfil-auditlog): MfaCard con wizard QR y disable"
```

---

## Task 10: Página `/perfil` + Topbar "Mi perfil"

**Files:**
- Create: `app/(dashboard)/perfil/page.tsx`
- Modify: `components/layout/Topbar.tsx`

- [ ] **Step 1: Crear la página**

```bash
mkdir -p "app/(dashboard)/perfil"
```

```typescript
// app/(dashboard)/perfil/page.tsx
'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PerfilTarjeta } from '@/components/perfil/PerfilTarjeta';
import { CambiarContrasenaCard } from '@/components/perfil/CambiarContrasenaCard';
import { MfaCard } from '@/components/perfil/MfaCard';
import { useMiPerfil } from '@/hooks/use-perfil';

export default function PerfilPage() {
  const { data: perfil, isLoading, isError, refetch } = useMiPerfil();

  if (isLoading) return (
    <div>
      <PageHeader title="Mi perfil" subtitle="Configuración personal de tu cuenta" />
      <div className="flex justify-center py-12"><Spinner /></div>
    </div>
  );

  if (isError || !perfil) return (
    <div>
      <PageHeader title="Mi perfil" subtitle="Configuración personal de tu cuenta" />
      <EmptyState
        icon="alertTriangle"
        title="No se pudo cargar el perfil"
        message="Verificá tu conexión e intentá de nuevo."
      />
      <div className="flex justify-center mt-4">
        <button onClick={() => refetch()} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-tx-2 border border-bd hover:bg-bg-sunken transition-colors">
          Reintentar
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader title="Mi perfil" subtitle="Configuración personal de tu cuenta" />
      <div className="grid lg:grid-cols-[1fr_2fr] gap-4">
        <PerfilTarjeta perfil={perfil} />
        <div className="flex flex-col gap-4">
          <CambiarContrasenaCard />
          <MfaCard perfil={perfil} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Modificar `Topbar.tsx` para agregar "Mi perfil"**

Read the file first to confirm the exact block:

```bash
grep -n "Cerrar sesión" components/layout/Topbar.tsx
```

The relevant region is lines ~158-175 (the userOpen dropdown). Find this block:

```tsx
              <div className="px-3 py-2 text-2xs font-semibold tracking-widest uppercase text-tx-muted border-b border-bd">
                {user?.email}
              </div>
              <div className="h-px bg-bd my-1" />
              <div
                className="flex items-center gap-2 px-3 py-2 text-xs text-danger cursor-pointer hover:bg-bg-sunken"
                onClick={() => { logoutMutation.mutate(); closeAll(); }}
              >
                {logoutMutation.isPending ? <Spinner size={12} /> : <Icon name="logout" size={14} />}
                Cerrar sesión
              </div>
```

Replace with:

```tsx
              <div className="px-3 py-2 text-2xs font-semibold tracking-widest uppercase text-tx-muted border-b border-bd">
                {user?.email}
              </div>
              {/* Mi perfil arriba del divisor — es una acción personal del usuario,
                  no un módulo del shell; va en este menú según convención del proyecto. */}
              <Link
                href="/perfil"
                onClick={closeAll}
                className="flex items-center gap-2 px-3 py-2 text-xs text-tx cursor-pointer hover:bg-bg-sunken"
              >
                <Icon name="user" size={14} /> Mi perfil
              </Link>
              <div className="h-px bg-bd my-1" />
              <div
                className="flex items-center gap-2 px-3 py-2 text-xs text-danger cursor-pointer hover:bg-bg-sunken"
                onClick={() => { logoutMutation.mutate(); closeAll(); }}
              >
                {logoutMutation.isPending ? <Spinner size={12} /> : <Icon name="logout" size={14} />}
                Cerrar sesión
              </div>
```

- [ ] **Step 3: Asegurar que `Link` está importado en `Topbar.tsx`**

```bash
grep -n "^import Link" components/layout/Topbar.tsx
```

Expected: si NO está presente, agregar:

```tsx
import Link from 'next/link';
```

al bloque de imports (después de `import { useState } from 'react';`).

- [ ] **Step 4: Verificar que el ícono `user` existe en `Icon.tsx`**

```bash
grep "user:" components/ui/Icon.tsx | head -3
```

Expected: una entry `user: '...'`. Si NO existe, agregarlo siguiendo el patrón del archivo (SVG path para una silueta de usuario).

- [ ] **Step 5: Verificar compilación**

```bash
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/perfil/page.tsx" components/layout/Topbar.tsx
git commit -m "feat(perfil-auditlog): pagina /perfil y item Mi perfil en topbar"
```

---

## Task 11: `AuditLogFilters`

**Files:**
- Create: `components/auditlog/AuditLogFilters.tsx`

- [ ] **Step 1: Crear la carpeta y el componente**

```bash
mkdir -p components/auditlog
```

```typescript
// components/auditlog/AuditLogFilters.tsx
'use client';

import { useState } from 'react';
import { FilterBar } from '@/components/ui/FilterBar';
import { Icon } from '@/components/ui/Icon';
import {
  ENTIDADES_CONOCIDAS,
  ACCIONES_SUGERIDAS,
  calcularDesdePeriodo,
  type Periodo,
} from '@/lib/auditlog';

export type FiltrosAuditLogState = {
  busqueda: string;
  entidad: string;
  accion: string;
  periodo: Periodo;
  // Rango libre (date YYYY-MM-DD). Solo se usa si periodo es null.
  desdeManual: string;
  hastaManual: string;
};

export const FILTROS_VACIOS: FiltrosAuditLogState = {
  busqueda: '',
  entidad: '',
  accion: '',
  periodo: null,
  desdeManual: '',
  hastaManual: '',
};

const inputBase = 'px-3 py-1.5 text-sm rounded-md border bg-surface text-tx focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;

export function AuditLogFilters({
  filtros,
  onChange,
}: {
  filtros: FiltrosAuditLogState;
  onChange: (next: FiltrosAuditLogState) => void;
}) {
  // Validación cliente del rango — desde > hasta es input inválido. Mostramos
  // helper text y el componente padre puede consultar este estado vía error
  // para no disparar la query.
  const rangoInvalido = !!(filtros.desdeManual && filtros.hastaManual && filtros.desdeManual > filtros.hastaManual);

  function togglePeriodo(p: Periodo) {
    // Chips y rango libre son mutuamente excluyentes: elegir un chip limpia los
    // date inputs y viceversa. Combinarlos da ambigüedad sobre cuál gana.
    if (filtros.periodo === p) {
      onChange({ ...filtros, periodo: null });
    } else {
      onChange({ ...filtros, periodo: p, desdeManual: '', hastaManual: '' });
    }
  }

  function setDesdeManual(v: string) {
    onChange({ ...filtros, desdeManual: v, periodo: null });
  }

  function setHastaManual(v: string) {
    onChange({ ...filtros, hastaManual: v, periodo: null });
  }

  function limpiarTodo() {
    onChange(FILTROS_VACIOS);
  }

  return (
    <div className="border border-bd rounded-t-lg bg-surface">
      <FilterBar
        search={filtros.busqueda}
        onSearch={(v) => onChange({ ...filtros, busqueda: v })}
        placeholder="Buscar por ID de entidad…"
        chips={[
          { label: 'Hoy', active: filtros.periodo === 'hoy', onToggle: () => togglePeriodo('hoy') },
          { label: 'Esta semana', active: filtros.periodo === 'semana', onToggle: () => togglePeriodo('semana') },
          { label: 'Este mes', active: filtros.periodo === 'mes', onToggle: () => togglePeriodo('mes') },
        ]}
        onClear={limpiarTodo}
      />
      <div className="flex flex-wrap items-end gap-3 px-4 py-2 border-t border-bd">
        <div className="flex flex-col gap-1">
          <label className="text-2xs uppercase tracking-wider font-medium text-tx-3">Entidad</label>
          <select
            className={`${inputOk} min-w-40`}
            value={filtros.entidad}
            onChange={(e) => onChange({ ...filtros, entidad: e.target.value })}
          >
            <option value="">Todas</option>
            {ENTIDADES_CONOCIDAS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-2xs uppercase tracking-wider font-medium text-tx-3">Acción</label>
          {/* free-text con datalist: el backend permite acciones heterogéneas
              (`CREAR_USUARIO`, `ACTA_DESPACHADA`, etc.) que crecen con cada módulo. */}
          <input
            list="acciones-sugeridas"
            className={`${inputOk} min-w-52 font-mono`}
            placeholder="Cualquier acción"
            value={filtros.accion}
            onChange={(e) => onChange({ ...filtros, accion: e.target.value })}
          />
          <datalist id="acciones-sugeridas">
            {ACCIONES_SUGERIDAS.map((a) => <option key={a} value={a} />)}
          </datalist>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-2xs uppercase tracking-wider font-medium text-tx-3">Desde</label>
          <input
            type="date"
            className={rangoInvalido ? inputErr : inputOk}
            value={filtros.desdeManual}
            onChange={(e) => setDesdeManual(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-2xs uppercase tracking-wider font-medium text-tx-3">Hasta</label>
          <input
            type="date"
            className={rangoInvalido ? inputErr : inputOk}
            value={filtros.hastaManual}
            onChange={(e) => setHastaManual(e.target.value)}
          />
          {rangoInvalido && (
            <span className="text-xs text-danger inline-flex items-center gap-1 mt-0.5">
              <Icon name="alertTriangle" size={10} /> Rango inválido (desde &gt; hasta)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Convierte el estado del componente en el shape que espera el backend.
// `desde`/`hasta` se devuelven solo si hay valor; el chip de período tiene
// precedencia sobre el rango manual.
export function aFiltrosBackend(s: FiltrosAuditLogState): { entidad?: string; accion?: string; entidadId?: string; desde?: string; hasta?: string } {
  const out: { entidad?: string; accion?: string; entidadId?: string; desde?: string; hasta?: string } = {};
  if (s.entidad) out.entidad = s.entidad;
  if (s.accion.trim()) out.accion = s.accion.trim();
  // El search busca por entidadId (match exacto contra el backend).
  if (s.busqueda.trim()) out.entidadId = s.busqueda.trim();
  if (s.periodo) {
    const d = calcularDesdePeriodo(s.periodo);
    if (d) out.desde = d;
  } else {
    if (s.desdeManual) out.desde = new Date(s.desdeManual).toISOString();
    if (s.hastaManual) {
      // Hasta el FINAL del día seleccionado: 23:59:59.999.
      const d = new Date(s.hastaManual);
      d.setHours(23, 59, 59, 999);
      out.hasta = d.toISOString();
    }
  }
  return out;
}
```

- [ ] **Step 2: Verificar compilación**

```bash
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/auditlog/AuditLogFilters.tsx
git commit -m "feat(perfil-auditlog): AuditLogFilters con chips y rango manual"
```

---

## Task 12: `AuditLogTable` + `AuditLogDrawer`

**Files:**
- Create: `components/auditlog/AuditLogTable.tsx`
- Create: `components/auditlog/AuditLogDrawer.tsx`

- [ ] **Step 1: Crear `AuditLogDrawer.tsx`**

```typescript
// components/auditlog/AuditLogDrawer.tsx
'use client';

import { useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { colorPorAccion } from '@/lib/auditlog';
import { formatDateTime, getInitials } from '@/lib/utils';
import type { AuditLog } from '@/types/api';

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function AuditLogDrawer({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  // Cerrar con Esc — patrón común en drawers; mejora accesibilidad de teclado.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const todasLasClaves = Array.from(new Set([
    ...(log.camposAntes ? Object.keys(log.camposAntes) : []),
    ...(log.camposDespues ? Object.keys(log.camposDespues) : []),
  ]));

  function diff(k: string): boolean {
    const a = log.camposAntes?.[k];
    const b = log.camposDespues?.[k];
    return formatValue(a) !== formatValue(b);
  }

  const usuarioLabel = log.usuario
    ? `${log.usuario.nombre} ${log.usuario.apellido}`
    : '(Usuario eliminado)';

  return (
    <>
      <div className="fixed inset-0 bg-navy/50 z-40" onClick={onClose} />
      <aside
        className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-surface border-l border-bd z-50 flex flex-col"
        role="dialog"
        aria-label="Detalle del registro de auditoría"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
          <h3 className="font-semibold text-base">Detalle del registro</h3>
          <button
            type="button"
            onClick={onClose}
            className="size-7 grid place-items-center rounded text-tx-3 hover:bg-bg-sunken hover:text-tx transition-colors"
            aria-label="Cerrar"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <section className="mb-5">
            <div className="text-2xs uppercase tracking-wider font-semibold text-tx-3 mb-2">Quién y cuándo</div>
            <div className="flex items-center gap-2 mb-3">
              <div className="size-8 rounded-full bg-bg-sunken text-tx-2 grid place-items-center text-xs font-semibold">
                {log.usuario ? getInitials(usuarioLabel) : '?'}
              </div>
              <div>
                <div className="font-semibold text-sm">{usuarioLabel}</div>
                {log.usuario && <div className="text-2xs text-tx-3">{log.usuario.email}</div>}
              </div>
            </div>
            <dl className="space-y-1.5 text-sm">
              <Row label="Fecha y hora" value={<span className="font-mono">{formatDateTime(log.createdAt)}</span>} />
              <Row label="IP" value={<span className="font-mono text-2xs text-tx-2">{log.ip ?? '—'}</span>} />
              <Row label="User-Agent" value={<span className="font-mono text-2xs text-tx-2 break-all">{log.userAgent ?? '—'}</span>} />
              <Row label="Entidad" value={<><span className="font-medium">{log.entidad}</span> <span className="font-mono text-xs text-tx-3 ml-1">{log.entidadId}</span></>} />
              <Row label="Acción" value={<Badge status={log.accion} kind={colorPorAccion(log.accion)} />} />
            </dl>
          </section>

          <section>
            <div className="text-2xs uppercase tracking-wider font-semibold text-tx-3 mb-2">Cambios registrados</div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <div className="text-2xs text-tx-3 mb-1.5 font-semibold">Antes</div>
                <div className="bg-bg-sunken rounded p-2.5 text-xs">
                  {log.camposAntes ? (
                    todasLasClaves.map((k) => (
                      <div
                        key={k}
                        className={`grid grid-cols-[auto_1fr] gap-1.5 px-1.5 py-1 rounded ${
                          diff(k) ? 'bg-danger-soft line-through' : ''
                        }`}
                      >
                        <span className="text-tx-3">{k}:</span>
                        <span className="font-mono break-all">{formatValue(log.camposAntes[k])}</span>
                      </div>
                    ))
                  ) : (
                    <em className="text-tx-3">Sin estado previo registrado</em>
                  )}
                </div>
              </div>
              <div>
                <div className="text-2xs text-tx-3 mb-1.5 font-semibold">Después</div>
                <div className="bg-bg-sunken rounded p-2.5 text-xs">
                  {log.camposDespues ? (
                    todasLasClaves.map((k) => (
                      <div
                        key={k}
                        className={`grid grid-cols-[auto_1fr] gap-1.5 px-1.5 py-1 rounded ${
                          diff(k) ? 'bg-ok-soft font-bold' : ''
                        }`}
                      >
                        <span className="text-tx-3">{k}:</span>
                        <span className="font-mono break-all">{formatValue(log.camposDespues[k])}</span>
                      </div>
                    ))
                  ) : (
                    <em className="text-tx-3">Registro eliminado</em>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2">
      <dt className="text-tx-3">{label}</dt>
      <dd className="text-tx">{value}</dd>
    </div>
  );
}
```

- [ ] **Step 2: Crear `AuditLogTable.tsx`**

```typescript
// components/auditlog/AuditLogTable.tsx
'use client';

import { useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { Icon } from '@/components/ui/Icon';
import { AuditLogFilters, FILTROS_VACIOS, aFiltrosBackend, type FiltrosAuditLogState } from './AuditLogFilters';
import { AuditLogDrawer } from './AuditLogDrawer';
import { colorPorAccion } from '@/lib/auditlog';
import { useAuditLog } from '@/hooks/use-auditlog';
import { formatDateTime, getInitials } from '@/lib/utils';
import type { AuditLog } from '@/types/api';

function resumenCambio(log: AuditLog): string {
  if (!log.camposAntes && !log.camposDespues) return '—';
  if (!log.camposAntes && log.camposDespues) {
    const keys = Object.keys(log.camposDespues);
    if (keys.length === 0) return 'Registro creado';
    if (keys.length === 1) {
      const k = keys[0];
      return `${k}: ${String(log.camposDespues[k])}`;
    }
    return `Campos: ${keys.join(', ')}`;
  }
  if (log.camposAntes && !log.camposDespues) return 'Registro eliminado';
  const keys = Object.keys(log.camposDespues ?? {});
  if (keys.length === 1) {
    const k = keys[0];
    const antes = (log.camposAntes as Record<string, unknown> | null)?.[k];
    const dsp = (log.camposDespues as Record<string, unknown> | null)?.[k];
    return `${k}: ${antes ?? '—'} → ${dsp ?? '—'}`;
  }
  return `Campos modificados: ${keys.join(', ')}`;
}

export function AuditLogTable() {
  const [page, setPage] = useState(1);
  const [filtros, setFiltros] = useState<FiltrosAuditLogState>(FILTROS_VACIOS);
  const [drawerLog, setDrawerLog] = useState<AuditLog | null>(null);

  const rangoInvalido = !!(filtros.desdeManual && filtros.hastaManual && filtros.desdeManual > filtros.hastaManual);

  function onFiltrosChange(next: FiltrosAuditLogState) {
    setFiltros(next);
    setPage(1);
  }

  const { data, isLoading, isError } = useAuditLog({
    page,
    limit: 50,
    ...aFiltrosBackend(filtros),
  });

  return (
    <div className="rounded-lg border border-bd bg-surface overflow-hidden">
      <AuditLogFilters filtros={filtros} onChange={onFiltrosChange} />

      {rangoInvalido && (
        <div className="px-4 py-2 bg-warn-soft text-warn text-xs border-b border-bd">
          Corregí el rango de fechas para ver resultados.
        </div>
      )}

      {isLoading && <div className="flex justify-center py-12"><Spinner /></div>}

      {isError && (
        <EmptyState
          icon="alertTriangle"
          title="Error al cargar el registro"
          message="Intenta refrescar la página."
        />
      )}

      {!isLoading && !isError && data && data.data.length === 0 && (
        <EmptyState
          icon="fileText"
          title="Sin eventos"
          message="No se encontraron eventos con los filtros aplicados."
        />
      )}

      {!isLoading && !isError && data && data.data.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl text-sm">
              <thead className="bg-bg-sunken text-2xs uppercase tracking-wider text-tx-3">
                <tr>
                  <th className="text-left px-4 py-2 font-medium w-12">#</th>
                  <th className="text-left px-4 py-2 font-medium w-44">Fecha y hora</th>
                  <th className="text-left px-4 py-2 font-medium w-48">Usuario</th>
                  <th className="text-left px-4 py-2 font-medium w-44">Acción</th>
                  <th className="text-left px-4 py-2 font-medium w-44">Entidad</th>
                  <th className="text-left px-4 py-2 font-medium">Resumen</th>
                  <th className="text-left px-4 py-2 font-medium w-28">IP</th>
                  <th className="px-4 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((log, i) => {
                  const numero = (data.meta.page - 1) * data.meta.limit + i + 1;
                  const usuarioLabel = log.usuario
                    ? `${log.usuario.nombre} ${log.usuario.apellido}`
                    : '(Usuario eliminado)';
                  return (
                    <tr
                      key={log.id}
                      className="border-t border-bd hover:bg-bg-sunken transition-colors cursor-pointer"
                      onClick={() => setDrawerLog(log)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-tx-3">{numero}</td>
                      <td className="px-4 py-3 font-mono text-xs text-tx-2">{formatDateTime(log.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-full bg-bg-sunken text-tx-2 grid place-items-center text-2xs font-semibold shrink-0">
                            {log.usuario ? getInitials(usuarioLabel) : '?'}
                          </div>
                          <span className={log.usuario ? 'text-tx text-sm' : 'text-tx-3 text-sm italic'}>
                            {usuarioLabel}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge status={log.accion} kind={colorPorAccion(log.accion)} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium">{log.entidad}</div>
                        <div className="font-mono text-2xs text-tx-3 truncate max-w-32">{log.entidadId}</div>
                      </td>
                      <td className="px-4 py-3 text-tx-2 text-sm truncate max-w-md">{resumenCambio(log)}</td>
                      <td className="px-4 py-3 font-mono text-2xs text-tx-3">{log.ip ?? '—'}</td>
                      <td className="px-4 py-3 text-tx-3">
                        <Icon name="chevronRight" size={14} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.meta.page}
            pageSize={data.meta.limit}
            total={data.meta.total}
            onPage={setPage}
          />
        </>
      )}

      {drawerLog && <AuditLogDrawer log={drawerLog} onClose={() => setDrawerLog(null)} />}
    </div>
  );
}
```

- [ ] **Step 3: Verificar que el ícono `chevronRight` existe**

```bash
grep "chevronRight:" components/ui/Icon.tsx | head -3
```

Expected: una entry. Si no existe, registrar como concern y agregarla en Task 13.

- [ ] **Step 4: Verificar compilación**

```bash
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add components/auditlog/AuditLogTable.tsx components/auditlog/AuditLogDrawer.tsx
git commit -m "feat(perfil-auditlog): AuditLogTable y AuditLogDrawer con diff"
```

---

## Task 13: Página `/auditlog` + verificación final + PRs

**Files:**
- Create: `app/(dashboard)/auditlog/page.tsx`

- [ ] **Step 1: Crear la página con gate de acceso**

```bash
mkdir -p "app/(dashboard)/auditlog"
```

```typescript
// app/(dashboard)/auditlog/page.tsx
'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { AuditLogTable } from '@/components/auditlog/AuditLogTable';
import { useAuthStore } from '@/stores/auth.store';

// Gate client-side: evita render flash de UI sin permisos antes de que el
// backend devuelva 403. El server igualmente revalida en cada request.
export default function AuditLogPage() {
  const rol = useAuthStore((s) => s.user?.rol);
  const hidratado = useAuthStore((s) => !!s.user);

  if (!hidratado) return null;

  if (rol !== 'ADMIN' && rol !== 'GERENTE') {
    return (
      <div>
        <PageHeader title="Registro de auditoría" subtitle="Trazabilidad de cambios del sistema · solo lectura" />
        <div className="py-8">
          <EmptyState
            icon="shield"
            title="Sin acceso"
            message="Esta sección está disponible solo para los roles ADMIN y GERENTE."
          />
          <div className="flex justify-center mt-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors"
            >
              Volver al dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Registro de auditoría" subtitle="Trazabilidad de cambios del sistema · solo lectura" />
      <AuditLogTable />
    </div>
  );
}
```

- [ ] **Step 2: Verificación de tipos y lint completos**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm tsc --noEmit
pnpm lint
```

Expected: tsc sin errores; lint sin errores nuevos atribuibles a esta rama (warnings preexistentes del proyecto no cuentan).

- [ ] **Step 3: Si algún ícono mencionado en tasks anteriores resultó no existir**, agregarlo a `components/ui/Icon.tsx` siguiendo el patrón de las entries existentes (objeto `ICONS` con clave kebab-case-camel y valor un string de `d=` para el `<path>`). Confirmar visualmente que el ícono renderiza al menos algo coherente.

- [ ] **Step 4: Verificación manual end-to-end con servidores corriendo**

```bash
# Terminal A — backend
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm dev

# Terminal B — frontend
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm dev
```

Checklist en `http://localhost:3001` con un usuario ADMIN:

- [ ] Topbar → click sobre el avatar → aparece "Mi perfil" arriba de "Cerrar sesión".
- [ ] Click "Mi perfil" → carga `/perfil` con datos reales.
- [ ] Editar nombre/apellido → toast success → topbar refresca el nombre al instante (sin refresh).
- [ ] Cambiar contraseña con la actual mal → error inline en el campo "Contraseña actual", sin toast de error.
- [ ] Cambiar contraseña correctamente → toast "Contraseña actualizada", form se limpia.
- [ ] Activar 2FA → ver QR escaneable. Al abrir Google Authenticator, la entry debe aparecer como **"REINAR SV"** (no localhost ni "Reinar Dashboard").
- [ ] El bloque "código manual" muestra el secret y "Copiar" funciona.
- [ ] Ingresar código TOTP correcto → "¡Listo!" → cerrar → estado vuelve a idle con `2FA activo`.
- [ ] Ingresar código TOTP incorrecto → animación shake + error inline.
- [ ] Desactivar 2FA → pide TOTP (no password). Ingresar TOTP correcto → 2FA desactivado.
- [ ] Ir a `/auditlog` → tabla carga.
- [ ] Filtros: probar chip "Hoy", "Esta semana", "Este mes". Probar select Entidad. Probar input Acción con datalist. Probar rango libre desde/hasta.
- [ ] Probar rango inválido (desde > hasta) → helper text rojo aparece, query no se dispara, banner warn aparece.
- [ ] Click una fila → drawer abre con detalle. Cerrar con Esc o click fuera.
- [ ] Drawer con `camposAntes` null → muestra "Sin estado previo registrado" en lado izquierdo.

Con un usuario GERENTE: igual que ADMIN excepto que `/auditlog` carga normalmente.

Con un usuario OPERADOR/LOGISTICA/VISUALIZADOR: `/auditlog` muestra "Sin acceso" con link al dashboard. `/perfil` carga normalmente para todos.

Detener ambos `pnpm dev`.

- [ ] **Step 5: Commit final de la página**

```bash
git add "app/(dashboard)/auditlog/page.tsx"
git commit -m "feat(perfil-auditlog): pagina /auditlog con gate ADMIN/GERENTE"
```

Si hubo fixes adicionales (íconos faltantes, etc.):

```bash
git status
# Si hay cambios pendientes:
# git add <archivos>
# git commit -m "chore(perfil-auditlog): correcciones de lint/iconos"
```

- [ ] **Step 6: Push y crear PR de backend (mergear primero)**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git push -u origin feat/perfil-auditlog
gh pr create --title "feat(auth): PATCH /perfil + MFA issuer REINAR SV con image" --body "$(cat <<'EOF'
## Summary

- Nuevo endpoint `PATCH /api/v1/auth/perfil` que permite al usuario autenticado editar su propio `nombre`/`apellido`. Email y rol siguen siendo ADMIN-only via `/usuarios` (separación de privilegios).
- Issuer del TOTP URI cambia de `Reinar Dashboard` → `REINAR SV` (lo que muestra Google Authenticator/Authy al escanear).
- Se agrega parámetro `&image=` con URL pública del favicon de Reinar; Authy y similares lo usan para pintar el logo en la lista de cuentas, otras apps lo ignoran silenciosamente.

## Test plan

- [ ] `PATCH /auth/perfil` con `{nombre, apellido}` válidos → 200 con el UserProfile actualizado.
- [ ] `PATCH /auth/perfil` con `{email}` o `{rol}` adicionales → los campos extra se ignoran (Zod schema solo permite nombre/apellido).
- [ ] Al escanear el nuevo QR de 2FA, la entry de la app autenticadora muestra "REINAR SV".
- [ ] Cambio queda registrado en AuditLog como `accion=ACTUALIZAR_PERFIL`.

Rama frontend: \`feat/perfil-auditlog\` (PR separado, mergear este primero).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL devuelta. Mergear este PR primero antes que el frontend.

- [ ] **Step 7: Push y crear PR de frontend**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git push -u origin feat/perfil-auditlog
gh pr create --title "feat: perfil y auditlog (rama 18)" --body "$(cat <<'EOF'
## Summary

Implementa la **Rama 18** del plan-trabajo-frontend.md — **Mi perfil** y **Auditoría**.

- `/perfil`: ver datos básicos, editar nombre/apellido propio, cambiar contraseña con fortaleza visual, activar/desactivar 2FA con wizard QR (renderizado con `qrcode.react`).
- `/auditlog`: tabla filtrable (search, entidad, acción con datalist, rango fechas via chips o manual) con drawer de detalle (diff antes/después + meta).
- Topbar: nuevo item "Mi perfil" en el dropdown del usuario.
- Errores del backend mapeados a inline: 401 "Contraseña actual incorrecta" / "Código TOTP inválido" → `setError` con animación shake en el caso TOTP.
- 2FA disable pide TOTP (no password) — coincide con el contrato del backend.

## Test plan

- [ ] Topbar muestra "Mi perfil"; click navega a `/perfil`.
- [ ] Editar nombre actualiza el topbar al instante.
- [ ] Cambiar contraseña: error "actual incorrecta" inline, no toast.
- [ ] Activar 2FA: QR scanneable, la app muestra "REINAR SV".
- [ ] TOTP incorrecto → shake + inline.
- [ ] Desactivar 2FA pide TOTP (no password).
- [ ] `/auditlog`: ADMIN/GERENTE entran; otros roles ven "Sin acceso".
- [ ] Filtros: chips, select entidad, datalist acción, rango libre, rango inválido bloquea query con helper text.
- [ ] Drawer abre con diff antes/después; "Sin estado previo registrado" cuando aplica.

Spec: \`docs/superpowers/specs/2026-05-30-perfil-auditlog-design.md\`
Plan: \`docs/superpowers/plans/2026-05-30-perfil-auditlog.md\`

Requiere mergear primero: PR de backend \`feat(auth): PATCH /perfil + MFA issuer REINAR SV con image\`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL devuelta.

---

## Self-Review

**Spec coverage:**

| Sección del spec | Task que lo implementa |
|---|---|
| Backend: PATCH /auth/perfil + cambios MFA URI | Task 1 |
| Install qrcode.react + tipos TS | Task 2 |
| Schemas Zod (perfil + auditlog) + helpers de auditlog | Task 3 |
| Hook use-perfil con setAuth hidratando topbar | Task 4 |
| Hook use-mfa | Task 5 |
| Hook use-auditlog | Task 6 |
| PerfilTarjeta con edit nombre inline | Task 7 |
| CambiarContrasenaCard con fortaleza + mapeo 401 | Task 8 |
| MfaCard con wizard QR (incluye extracción de secret, copia) y disable con TOTP | Task 9 |
| Página /perfil + Topbar "Mi perfil" | Task 10 |
| AuditLogFilters con chips + datalist + rango manual + validación | Task 11 |
| AuditLogTable + AuditLogDrawer con diff y caso null | Task 12 |
| Página /auditlog con gate ADMIN/GERENTE + verificación final + PRs | Task 13 |
| Comentarios "why" en español | Distribuidos en todas las tasks |
| Sticky footer canónico | N/A — esta rama no tiene forms con footer (forms inline o cards) |
| Thead canónico | Task 12 |
| Manejo de errores inline vs toast | Tasks 4, 5, 8, 9 |

Coverage completo. Sin gaps.

**Placeholder scan:** sin TBDs, TODOs, "implement later" o referencias circulares. Cada bloque de código es ejecutable.

**Type consistency:** `Perfil`, `ActualizarPerfilDto`, `CambiarContrasenaDto`, `ConfigurarMfaResponse`, `TotpDto`, `AuditLog`, `FiltrosAuditLog` definidos en Task 2 y usados consistentemente en Tasks 4, 5, 6, 7, 8, 9, 11, 12. Schemas Zod (`actualizarPerfilSchema`, `cambiarContrasenaSchema`, `totpSchema`) definidos en Task 3 y usados en Tasks 7, 8, 9. Helpers `colorPorAccion`, `ENTIDADES_CONOCIDAS`, `ACCIONES_SUGERIDAS`, `calcularDesdePeriodo` definidos en Task 3 y usados en Tasks 11, 12. `FiltrosAuditLogState` y `aFiltrosBackend` definidos en Task 11 y usados en Task 12.

**Notas operativas:**
- Las tasks 9, 10, 12 hacen verificaciones runtime opcionales sobre íconos (`shield`, `copy`, `arrowLeft`, `user`, `chevronRight`). Si alguno falta, Task 13 incluye el fix.
- Backend tiene 1 sola task con 4 cambios coordinados — mantenerlos juntos preserva la semántica del MFA (issuer cambia + image se agrega + endpoint nuevo).
- El proyecto NO tiene tests automáticos (CLAUDE.md). Verificación: `pnpm tsc --noEmit` + `pnpm lint` + checklist manual en browser.
