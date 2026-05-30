# Spec — Rama 18 `feat/perfil-auditlog`

**Fecha:** 2026-05-30
**Rama frontend:** `feat/perfil-auditlog`
**Rama backend:** `feat/perfil-auditlog`

## Objetivo

Implementar la página de perfil del usuario autenticado (datos básicos editables, cambio de contraseña, gestión de 2FA con QR) y la vista de auditoría filtrable (solo ADMIN/GERENTE), consumiendo `/auth/perfil`, `/auth/mfa/*` y `/auditlog`.

## Alcance

**Dentro del alcance:**

- `/perfil`: ver y editar nombre/apellido propio, cambiar contraseña, activar/desactivar 2FA con wizard QR.
- `/auditlog`: tabla filtrable (search, entidad, acción, fechas), drawer de detalle con diff antes/después.
- Backend nuevo: `PATCH /auth/perfil` para que el usuario edite su propio nombre/apellido.
- Backend modificado: issuer del TOTP URI cambia a `REINAR SV` y se agrega parámetro `&image=` con el favicon público.
- Topbar: agregar "Mi perfil" en el dropdown del usuario.

**Fuera del alcance:**

- Cambio de email propio (sigue siendo ADMIN-only via `/usuarios`).
- Cambio de rol propio (server-side blocked y semánticamente equivocado).
- Endpoint `GET /auditlog/:entidad/:entidadId` (historial por entidad) — ya existe en backend pero no lo consume esta rama.
- Recovery codes para 2FA (no soportado por el backend actual).
- Notificación al usuario cuando cambian su contraseña por una sesión activa.

## Decisiones de diseño

| # | Decisión | Razón |
|---|---|---|
| 1 | El usuario puede editar SU PROPIO nombre y apellido vía nuevo `PATCH /auth/perfil`. | El prototipo lo expone y es razonable. La alternativa (pedir a un ADMIN) escala mal para 5+ usuarios. Email y rol siguen siendo ADMIN-only. |
| 2 | Renderizar el QR con `qrcode.react` (`<QRCodeSVG>`). | Pequeño (~10 KB), renderiza SVG nativo, no manda el secret a terceros. El backend solo devuelve el URI `otpauth://`; el QR se pinta cliente-side. |
| 3 | Issuer del TOTP URI cambia a `REINAR SV`. | El backend tenía hardcoded `'Reinar Dashboard'` — al escanear, la app de autenticación mostraba ese texto. Cambiarlo a `REINAR SV` es lo solicitado. |
| 4 | Agregar `&image=` (URL del favicon) al otpauth URI. | Parámetro no-estándar que Authy respeta para mostrar logo del servicio en la lista de cuentas. Google/Microsoft Authenticator lo ignoran silenciosamente (sin error). Sin riesgo. |
| 5 | Desactivar 2FA pide TOTP, NO contraseña. | Backend lo exige así (`DELETE /auth/mfa` con `{totpCode}`). Más seguro: una sesión hijackeada no puede quitar el 2FA sin acceso físico al dispositivo. Prototipo está obsoleto en este punto. |
| 6 | Filtro `accion` en /auditlog es input free-text con `<datalist>` de sugerencias. | El backend permite acciones heterogéneas (`CREAR_USUARIO`, `ACTA_DESPACHADA`, `CAMBIAR_ESTADO_COTIZACION`, etc.) que crecen con cada módulo. Un dropdown fijo se desincroniza; el datalist autocompleta lo común y permite cualquier valor. |
| 7 | Filtros de fecha combinan chips rápidos (Hoy/Semana/Mes) + rango libre `desde`/`hasta`. | Chips cubren el 95% de casos en un click; el rango libre es escape-hatch para investigaciones específicas. Son mutuamente excluyentes (elegir chip limpia los date inputs y viceversa). |
| 8 | Drawer del auditlog mantiene grid 2-cols incluso cuando `camposAntes` es null. | Mantener consistencia visual evita layout-shift entre filas. El panel izquierdo muestra "Sin estado previo registrado" como placeholder. |
| 9 | Color del badge `accion` se deriva del prefijo del string (`CREAR_*` → ok, `ELIMINAR_*` → danger, etc.) | Map exhaustivo se desincroniza con cada módulo nuevo; prefix-match es self-healing. |
| 10 | "Mi perfil" va en el dropdown del usuario del topbar; "Auditoría" queda en el sidebar grupo Sistema (ya estaba en `nav.ts`). | Convención del prototipo: acciones personales en el menú de usuario, módulos en el sidebar. |
| 11 | `useActualizarPerfil onSuccess` llama a `useAuthStore.setAuth(...)` además de invalidar `['perfil']`. | Sin esto, el avatar+nombre del topbar quedan stale hasta el siguiente refresh, porque el topbar lee de `useAuthStore.user`, no de la query `['perfil']`. |

## Arquitectura

### Backend (rama `feat/perfil-auditlog`)

Cambios en 3 archivos:

**`src/modules/auth/auth.routes.ts`** — agregar ruta:
```ts
const actualizarPerfilSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es requerido').max(100),
  apellido: z.string().trim().min(1, 'El apellido es requerido').max(100),
})

router.patch('/perfil', authenticate, validate(actualizarPerfilSchema), controller.actualizarPerfil)
```

**`src/modules/auth/auth.service.ts`** — agregar función y modificar issuer:
```ts
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

Y dentro de `configurarMfa`:
```ts
// Issuer "REINAR SV" para que la app del usuario muestre ese nombre, no "Reinar Dashboard"
// ni "localhost". El parámetro image= es no-estándar pero Authy y similares lo usan
// para pintar el favicon de la empresa en la lista de cuentas.
const FAVICON_URL = 'https://reinarsa.com/wp-content/uploads/2025/07/favicon-300x300.webp'
const baseUri = authenticator.keyuri(email, 'REINAR SV', secret)
const otpauthUri = `${baseUri}${baseUri.includes('?') ? '&' : '?'}image=${encodeURIComponent(FAVICON_URL)}`
return { otpauthUri }
```

**`src/modules/auth/auth.controller.ts`** — agregar handler:
```ts
export async function actualizarPerfil(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Devolver UserProfile completo para que el cliente hidrate su auth store sin refetch
    const usuario = await authService.actualizarPerfil(req.user!.sub, req.body)
    res.json({ success: true, data: usuario })
  } catch (err) { next(err) }
}
```

### Frontend (rama `feat/perfil-auditlog`)

**Archivos a crear:**

```
app/(dashboard)/
├── perfil/page.tsx                      # Mi perfil — todos los roles autenticados
└── auditlog/page.tsx                    # Auditoría — gate ADMIN/GERENTE

components/perfil/
├── PerfilTarjeta.tsx                    # Avatar + datos + edit nombre inline
├── CambiarContrasenaCard.tsx            # Form 3 inputs password con fortaleza visual
├── MfaCard.tsx                          # Máquina de estados idle|setup|done|disable
├── Mfa2faSetupWizard.tsx                # Pasos QR + verificar TOTP
└── Mfa2faDisable.tsx                    # Form pedir TOTP para desactivar

components/auditlog/
├── AuditLogTable.tsx                    # Tabla con paginación
├── AuditLogFilters.tsx                  # Search + chips fecha + entidad/accion + rango libre
└── AuditLogDrawer.tsx                   # Detalle con diff antes/después + meta

hooks/
├── use-perfil.ts                        # useMiPerfil, useActualizarPerfil, useCambiarContrasena
├── use-mfa.ts                           # useConfigurarMfa, useVerificarMfa, useDesactivarMfa
└── use-auditlog.ts                      # useAuditLog

lib/
├── schemas/perfil.ts                    # Zod schemas (cambio contraseña, edit perfil, TOTP)
├── schemas/auditlog.ts                  # Zod schema de filtros (validación cliente)
└── auditlog.ts                          # Helpers: acciones sugeridas, entidades conocidas, color por acción
```

**Archivos a modificar:**

- `types/api.ts` — agregar tipos.
- `components/layout/Topbar.tsx` — agregar "Mi perfil" en el dropdown del usuario.
- `package.json` — agregar `qrcode.react`.

### Hooks de React Query

**`use-perfil.ts`:**

| Hook | Endpoint | Query key | Notas especiales |
|---|---|---|---|
| `useMiPerfil()` | `GET /auth/perfil` | `['perfil']` | — |
| `useActualizarPerfil()` | `PATCH /auth/perfil` | invalida `['perfil']` | `onSuccess` llama a `useAuthStore.setAuth()` para hidratar el topbar al instante |
| `useCambiarContrasena()` | `PATCH /auth/perfil/contrasena` | — | `onError` 401 mapea a `setError('passwordActual')` |

**`use-mfa.ts`:**

| Hook | Endpoint | Notas |
|---|---|---|
| `useConfigurarMfa()` | `POST /auth/mfa/configurar` | Devuelve `{otpauthUri}` |
| `useVerificarMfa()` | `POST /auth/mfa/verificar` | Invalida `['perfil']` |
| `useDesactivarMfa()` | `DELETE /auth/mfa` | Invalida `['perfil']` |

**`use-auditlog.ts`:**

| Hook | Endpoint | Query key |
|---|---|---|
| `useAuditLog(filtros)` | `GET /auditlog` (params: `desde`/`hasta`, NO `fechaDesde`) | `['auditlog', filtros]` |

### Tipos TypeScript (agregar en `types/api.ts`)

```ts
// Perfil reusa el shape de Usuario; alias por semántica del módulo.
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
  otpauthUri: string;
};

export type TotpDto = {
  totpCode: string;
};

export type AuditLog = {
  id: string;
  usuarioId: string | null;
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

export type FiltrosAuditLog = {
  page?: number;
  limit?: number;
  entidad?: string;
  entidadId?: string;
  usuarioId?: string;
  accion?: string;
  // Nombres del backend (NO `fechaDesde`/`fechaHasta` como decía el plan original).
  desde?: string;
  hasta?: string;
};
```

## UI por página

### `/perfil`

**Layout:** grid `lg:grid-cols-[1fr_2fr]`, stack en mobile.

**Card izquierda — `<PerfilTarjeta>`:**
- Avatar circular 96px con iniciales sobre `bg-accent text-navy`.
- Nombre completo, email mono.
- Dos badges: rol (color por rol) + `2FA activo`/`inactivo`.
- Línea "Último acceso: {formatDateTime(ultimoAcceso)}".
- Botón "Editar nombre" → expande inline form (2 inputs + Cancelar/Guardar). RHF + Zod.
- Errores: validation inline; en `onSuccess` invalida `['perfil']` Y llama `useAuthStore.setAuth(token, perfilActualizado)`.

**Cards derecha (stack vertical):**

**`<CambiarContrasenaCard>`:**
- Form RHF + Zod con 3 inputs password (actual, nueva, confirmar) y toggle eye/x por input.
- Medidor de fortaleza calculado en cliente (long + tipos de chars) — solo feedback visual, no bloquea submit más allá del min 8 (que es lo que exige el backend).
- Submit deshabilitado hasta tener los 3 campos + confirm coincide + nueva ≥ 8 chars.
- `onError` con `code: 'UNAUTHORIZED'` y message contiene "Contraseña actual" → `setError('passwordActual', { message })`.
- `onSuccess` → `toast.success('Contraseña actualizada.')` + `reset()`.

**`<MfaCard>`** — máquina de estados:

- **idle:** ícono shield, texto "Tu cuenta está protegida con 2FA" o "Sin protección adicional", badge ok/neutral, botón Activar/Desactivar.
- **setup paso 1:**
  - Instrucciones cortas (numeradas).
  - `<QRCodeSVG value={otpauthUri} size={180} bgColor="#fff" fgColor="#000" />` de `qrcode.react`.
  - Bloque "¿No podés escanear?" con secret extraído del URI (`new URL(uri).searchParams.get('secret')`) + botón "Copiar" al portapapeles.
  - Botones: Cancelar / "Ya lo escaneé, continuar".
- **setup paso 2:**
  - Input grande mono 6 dígitos centrado (`inputMode="numeric"`, `maxLength={6}`, auto-strip non-digits).
  - Si error TOTP → animación shake (clase `animate-shake` en `@layer utilities`) + `setError('totpCode')`.
  - Botones: Volver / Confirmar.
- **done:** ícono check grande verde + mensaje "2FA activado correctamente". Botón "Cerrar" → vuelve a idle (`mfaActivo` ya refrescado por invalidación).
- **disable:** alert warn + input TOTP de 6 dígitos (NO password). Botones: Cancelar / Desactivar (rojo).

### `/auditlog`

**Gate de acceso:** la página verifica `useAuthStore.user.rol`. Si no es ADMIN ni GERENTE, render de `<EmptyState>` "Sin acceso" con link al dashboard.

**`<AuditLogFilters>`:**
- `<FilterBar>` con buscador (search por entidadId — match exacto contra backend).
- Chips de período: Hoy / Esta semana / Este mes (calcula `desde` cliente-side, `hasta=undefined`).
- Fila secundaria:
  - `<select>` "Entidad" con lista hardcoded (`Usuario, Cliente, Cotizacion, Factura, Equipo, Acta, Pago, NotaCredito, Mantenimiento, ConfiguracionEmpresa, ...`) + opción "Todas".
  - `<input list="acciones-comunes">` para acción (datalist con ~20 sugerencias top).
  - 2 `<input type="date">` para rango libre.
- Comportamiento: cualquier cambio resetea `page` a 1. Chips y rango libre son mutuamente excluyentes (elegir uno limpia el otro). Si `desde > hasta`, helper text "Rango inválido" y no se dispara query.

**`<AuditLogTable>`:**
- Thead canónico. Columnas: `#`, `Fecha y hora` (mono `formatDateTime`), `Usuario` (avatar + nombre, `'(Usuario eliminado)'` si null), `Acción` (badge color derivado del prefijo), `Entidad` (nombre + entidadId mono), `Resumen del cambio`, `IP` (mono), `→`.
- `colorPorAccion(accion)` en `lib/auditlog.ts`: prefix-match (`startsWith('CREAR')` → ok, `startsWith('ELIMINAR')|startsWith('CANCELAR')|startsWith('DESACTIVAR')` → danger, `startsWith('CAMBIAR_ESTADO')|startsWith('REGISTRAR')|startsWith('AJUSTAR')` → warn, else → info).
- Fila clickeable → abre drawer.
- `<Pagination>` con limit 50 (default del backend).

**`<AuditLogDrawer>`:**
- Lateral derecho, scrim cubre el resto, cierra con click fuera o Esc.
- Header "Detalle del registro" + botón X.
- Sección "Quién y cuándo": avatar + nombre + email; rows con Fecha, IP, User-Agent (mono, break-all), Entidad+entidadId, Acción badge.
- Sección "Cambios registrados" — grid 2 cols (Antes / Después):
  - Si `camposAntes` null → izquierda muestra "Sin estado previo registrado".
  - Si ambos hay valores: lista cada clave. Las que difieren se resaltan: izquierda con `bg-danger-soft` + `line-through`, derecha con `bg-ok-soft` + `font-bold`.
  - Valores complejos (objetos/arrays) se renderizan con `JSON.stringify`.
- Body `overflow-y-auto` para diffs largos.

### Topbar modificado

En `Topbar.tsx`, el dropdown del usuario actualmente solo tiene "Cerrar sesión". Agregar arriba:
```tsx
<Link href="/perfil" className="flex items-center gap-2 px-3 py-2 text-xs text-tx cursor-pointer hover:bg-bg-sunken">
  <Icon name="user" size={14} /> Mi perfil
</Link>
```
Antes del `<div className="h-px bg-bd my-1" />`.

## Manejo de errores

| Caso | Manejo |
|---|---|
| `useMiPerfil` carga | `<Spinner>` centrado |
| `useMiPerfil` error | `<EmptyState icon="alertTriangle">` + botón "Reintentar" |
| `useCambiarContrasena` 401 "Contraseña actual incorrecta" | `setError('passwordActual', ...)` inline, sin toast |
| `useVerificarMfa` / `useDesactivarMfa` 401 "Código TOTP inválido" | `setError('totpCode', ...)` inline + animación shake |
| `useConfigurarMfa` 400 "MFA no configurado" | toast.error (camino raro pero defendido) |
| URI otpauth malformado o sin `secret` | Render del QR sigue (solo necesita el URI completo); el bloque "código manual" se esconde con fallback "no disponible" |
| Usuario cancela el wizard en paso 2 | El `mfaSecret` quedó persistido pero `mfaActivo=false`; en el próximo intento `configurar` lo sobrescribe. Sin leak. |
| `useActualizarPerfil` 400 VALIDATION_ERROR con `details[]` | `applyValidationErrors` (helper de Rama 17) mapea a setError por campo |
| Auditlog usuario null | Render `'(Usuario eliminado)'` en gris |
| Auditlog `desde > hasta` | Helper text inline "Rango inválido", query no se dispara |
| Auditlog camposAntes/Despues con valores Decimal/Date serializados | Mostrar como string crudo — no intentar formatear, es vista técnica |

## Comentarios "why" obligatorios (en español)

**Frontend:**
- `hooks/use-perfil.ts > useActualizarPerfil onSuccess`: por qué llama `setAuth()` además de invalidar `['perfil']`.
- `components/perfil/Mfa2faSetupWizard.tsx > paso 1`: por qué extrae el secret del URI con `URL.searchParams.get('secret')` en vez de pedirlo aparte al backend.
- `components/perfil/Mfa2faSetupWizard.tsx > paso 2 onError`: por qué el shake va en el input y no en un toast.
- `components/perfil/Mfa2faDisable.tsx`: por qué pide TOTP en lugar de password.
- `lib/auditlog.ts > colorPorAccion`: por qué deriva color del prefijo en vez de un map exhaustivo.
- `components/auditlog/AuditLogFilters.tsx`: por qué chips y rango libre se limpian mutuamente.
- `components/auditlog/AuditLogDrawer.tsx`: por qué mantiene grid 2-cols incluso sin `camposAntes`.
- `app/(dashboard)/auditlog/page.tsx`: por qué el gate de rol es client-side (evitar flash de UI sin permisos antes del 403).

**Backend:**
- `auth.service.ts > actualizarPerfil`: por qué solo expone `nombre` y `apellido` (separación de privilegios).
- `auth.service.ts > configurarMfa`: por qué el issuer es "REINAR SV" y por qué se agrega `&image=`.
- `auth.controller.ts > actualizarPerfil`: por qué devuelve el UserProfile completo (hidrata el store cliente sin refetch).

## Checklist antes de PR

- [ ] `/perfil` carga datos reales; editar nombre actualiza el topbar al instante.
- [ ] Cambio de contraseña: error "actual incorrecta" inline, no toast.
- [ ] Wizard 2FA: QR escaneable con Google Authenticator, el nombre que aparece en la app es **REINAR SV**.
- [ ] Bloque "código manual" copia el secret al portapapeles.
- [ ] Verificar TOTP inválido → shake + `setError` inline.
- [ ] Desactivar 2FA pide TOTP (no password).
- [ ] `/auditlog` carga para ADMIN/GERENTE; otros roles ven "Sin acceso".
- [ ] Filtros funcionan: search, chips fecha, datalist acción, select entidad, rango libre.
- [ ] Drawer abre con detalle completo (diff antes/después, IP, UA, usuario).
- [ ] Topbar muestra "Mi perfil" arriba de "Cerrar sesión".
- [ ] Backend: `PATCH /auth/perfil` rechaza email/rol, acepta nombre/apellido.
- [ ] Backend: `configurarMfa` devuelve URI con `issuer=REINAR%20SV` y `image=<favicon-url>`.
- [ ] `pnpm tsc --noEmit` y `pnpm lint` limpios en ambos repos.
- [ ] Sin clases vanilla CSS, sin valores Tailwind arbitrarios.
- [ ] Comentarios "why" en español en decisiones no obvias (front y back).
- [ ] Dark mode no rompe la UI ni el QR.
- [ ] Tablet (768px) usable.
