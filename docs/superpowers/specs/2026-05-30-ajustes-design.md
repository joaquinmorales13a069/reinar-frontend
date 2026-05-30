# Spec — Rama 17 `feat/ajustes`

**Fecha:** 2026-05-30
**Rama frontend:** `feat/ajustes`
**Rama backend:** (no aplica — todos los endpoints ya existen)

## Objetivo

Implementar el módulo de Ajustes del ERP: tres tabs (Usuarios, Empresa, Reportes programados) consumiendo los endpoints `/usuarios`, `/configuracion` y `/configuracion/reportes` del backend, respetando los roles ADMIN/GERENTE y las guardas de auto-protección server-side.

## Alcance

**Dentro del alcance:**
- Listado, creación y edición de usuarios con cambio de estado (activar/desactivar).
- Edición de la configuración general de la empresa, incluyendo los prefijos de numeración de documentos (que viven en el mismo endpoint).
- Edición de la configuración de reportes programados (semanal/mensual, emails destinatarios, formato).
- Gate de acceso por rol: ADMIN escribe todo; GERENTE solo lee; demás roles reciben pantalla "Sin acceso".

**Fuera del alcance** (no existe backend para esto en esta rama; pertenecen a Rama 18 o requieren extensión del servidor):
- Cambio de contraseña y configuración de 2FA del usuario autenticado → Rama 18 `feat/perfil-auditlog`.
- Auditoría → Rama 18.
- Notificaciones in-app por tipo de evento (toggles del prototipo) — sin backend.
- Sesiones activas / cierre remoto — sin backend.
- Días específicos de envío del reporte semanal — backend solo expone activo/inactivo.
- Formato `csv` para reportes programados — backend solo soporta `pdf|excel|ambos`.
- Subida de logo binario — backend solo acepta `logoUrl` como string.
- Datos bancarios — sin backend.
- Desactivar 2FA de otro usuario desde admin — sin endpoint.

## Decisiones de diseño

| # | Decisión | Razón |
|---|---|---|
| 1 | Solo 3 tabs según plan (Usuarios, Empresa, Reportes). Numeración va embebida como card dentro de Empresa. | El backend expone los prefijos en el mismo `PUT /configuracion`. Separarlos en tab aparte forzaría dos guardados desconectados de un mismo recurso. |
| 2 | Sin página de detalle `/ajustes/usuarios/[id]/page.tsx`. | El plan no la lista y el listado ya muestra todos los campos que el backend devuelve. |
| 3 | Contraseña obligatoria al crear, opcional al editar (sección colapsable). | Coincide exactamente con `crearUsuarioSchema` y `actualizarUsuarioSchema` del backend. |
| 4 | Cambio de estado vía `<ConfirmRow>` inline en el listado, NO toggle dentro del form de editar. | El backend tiene endpoint `PATCH /usuarios/:id/estado` separado del `PUT /usuarios/:id`. Convención del proyecto: sin modales para acciones destructivas. |
| 5 | ADMIN viendo su propia fila/form: botones de desactivar y select de rol `disabled` con tooltip explicativo. | Backend devuelve 403 server-side. Prevenir la llamada en UI evita clicks que fallan y comunica la restricción antes de intentarlo. |
| 6 | GERENTE entra a `/ajustes` y ve las tres tabs en modo lectura. OPERADOR/LOGISTICA/VISUALIZADOR reciben pantalla "Sin acceso". | El backend permite a GERENTE leer (`GET`) usuarios, configuración y reportes; bloquearle la entrada contradiría esa capacidad. |
| 6.5 | Tab state vía query param `?tab=usuarios\|empresa\|reportes` (default `usuarios`). | Sobrevive a refresh y permite linkear a una tab específica desde otros lados del ERP. |
| 7 | Componente nuevo `<EmailsInput>` (chip input multi-email) para destinatarios de reportes. | El backend recibe `string[]` de emails. Chip input previene errores de parseo (espacios, comas dobles) y rechaza duplicados/inválidos al momento. |
| 8 | Schemas Zod del front replican exactamente los del backend, mismos mensajes en español. | Defensa en profundidad: validación inmediata en cliente + el backend sigue siendo la fuente de verdad si el front se desfasa. |

## Arquitectura

### Rutas y archivos

```
app/(dashboard)/ajustes/
├── layout.tsx                    # Gate de acceso: solo ADMIN y GERENTE
├── page.tsx                      # 'use client' — tabs vía ?tab=
├── _components/
│   ├── TabUsuarios.tsx
│   ├── TabEmpresa.tsx
│   ├── TabReportes.tsx
│   └── UsuarioForm.tsx           # Reutilizado por nuevo y editar
└── usuarios/
    ├── nuevo/page.tsx
    └── [id]/editar/page.tsx

components/ui/
└── EmailsInput.tsx               # Componente nuevo (chip input multi-email)

hooks/
├── use-usuarios.ts               # Nuevo
└── use-configuracion.ts          # Nuevo (cubre /configuracion y /configuracion/reportes)

types/api.ts                      # Agregar Usuario, ConfiguracionEmpresa, ConfiguracionReportes
```

### Gate de acceso

`app/(dashboard)/ajustes/layout.tsx` envuelve toda la sección. Lee `auth.store.user.rol`; si no es `ADMIN` ni `GERENTE`, renderiza `<EmptyState>` con copy "Sin acceso a Ajustes" y botón "Volver al dashboard". Sin esto, OPERADOR/LOGISTICA/VISUALIZADOR verían un flash de UI sin permisos antes de que el backend responda 403.

Un helper `useEsAdmin()` (lee del mismo store) controla la visibilidad de controles de escritura dentro de los tabs (botones "Nuevo", "Guardar", acciones de fila).

### Hooks de React Query

**`use-usuarios.ts`:**

| Hook | Endpoint | Query key | Invalidaciones |
|---|---|---|---|
| `useUsuarios({ page, limit, busqueda, rol })` | `GET /usuarios` | `['usuarios', { page, limit, busqueda, rol }]` | — |
| `useUsuario(id)` | `GET /usuarios/:id` | `['usuario', id]` | — |
| `useCrearUsuario()` | `POST /usuarios` | — | `['usuarios']` |
| `useActualizarUsuario(id)` | `PUT /usuarios/:id` | — | `['usuarios']`, `['usuario', id]` |
| `useCambiarEstadoUsuario(id)` | `PATCH /usuarios/:id/estado` | — | `['usuarios']`, `['usuario', id]` |

**`use-configuracion.ts`:**

| Hook | Endpoint | Query key | Invalidaciones |
|---|---|---|---|
| `useConfiguracion()` | `GET /configuracion` | `['configuracion']` | — |
| `useActualizarConfiguracion()` | `PUT /configuracion` | — | `['configuracion']` |
| `useConfigReportes()` | `GET /configuracion/reportes` | `['configuracion-reportes']` | — |
| `useActualizarConfigReportes()` | `PUT /configuracion/reportes` | — | `['configuracion-reportes']` |

### Tipos TypeScript (a agregar en `types/api.ts`)

```ts
export type RolUsuario = 'ADMIN' | 'GERENTE' | 'OPERADOR' | 'LOGISTICA' | 'VISUALIZADOR';

export type Usuario = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
  mfaActivo: boolean;
  ultimoAcceso: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConfiguracionEmpresa = {
  nombreEmpresa: string;
  nit?: string | null;
  ncr?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  email?: string | null;
  telefonoCotizaciones?: string | null;
  emailCotizaciones?: string | null;
  logoUrl?: string | null;
  sitioWeb?: string | null;
  prefijoCotizacion?: string | null;
  prefijoFactura?: string | null;
  prefijoActa?: string | null;
  emailRemitente?: string | null;
  nombreRemitente?: string | null;
  emailCopiaInterna?: string | null;
  porcentajeIvaDefault?: string | null; // Decimal serializado como string
  updatedAt: string;
};

export type ConfiguracionReportes = {
  reporteSemanalActivo: boolean;
  reporteSemanalEmails: string[];
  reporteMensualActivo: boolean;
  reporteMensualDia: number; // 1-28
  reporteMensualEmails: string[];
  formatoProgramado: 'pdf' | 'excel' | 'ambos';
};
```

## UI por tab

### Tab Usuarios

**Listado:**
- `<FilterBar>` con buscador (debounce 300ms) y chip "Rol" que abre un dropdown de los 5 roles.
- Tabla con `thead` canónico (`bg-bg-sunken text-2xs uppercase tracking-wider text-tx-3`). Columnas: `#`, `Nombre` (avatar con iniciales + nombre completo), `Email` (font-mono), `Rol` (Badge accent por rol), `Estado` (Badge ok/neutral), `2FA` (Badge ok/neutral, centrado), `Último acceso` (formatDateTime, o "Nunca" si null), `Acciones` (centrado).
- Acciones por fila:
  - `<Icon name="edit">` link a `/ajustes/usuarios/[id]/editar`.
  - Botón `Desactivar`/`Activar` que abre `<ConfirmRow>` debajo de la fila.
  - Para ADMIN viendo su propia fila: el botón aparece `disabled` con `title="No puedes desactivar tu propia cuenta"`.
  - Para GERENTE: la columna `Acciones` se omite y el botón `+ Nuevo usuario` no se renderiza.
- `<ConfirmRow>` de desactivación: copy `"¿Desactivar a {nombre} {apellido}?"`; si `mfaActivo`, agrega `"Se eliminará su 2FA configurado."`.
- Paginación con `<Pagination>` (limit 20). `<EmptyState>` si no hay resultados; `<Spinner>` durante carga.

**Form `UsuarioForm` (nuevo y editar):**
- `<PageHeader title="Nuevo usuario" | "Editar usuario" back backLabel="Ajustes" onBack={() => router.push('/ajustes?tab=usuarios')}>`.
- RHF + Zod.
  - **Crear:** `{ nombre, apellido, email, contrasena (min 8), confirmar (igual a contrasena), rol }`.
  - **Editar:** `{ nombre, apellido, email, rol }` + sección colapsable "Cambiar contraseña" con `contrasena` opcional y `confirmar`.
- `<FormSection title="Datos del usuario">`: nombre y apellido en grid 2 cols; email (span 2, font-mono); rol (select de 5 roles).
- `<FormSection title="Contraseña">`:
  - En crear: dos inputs password obligatorios (contraseña + confirmar).
  - En editar: link "Cambiar contraseña" que expande los dos inputs.
- En el form de editar del propio admin: el `<select>` de rol va `disabled` con helper text "No puedes cambiar tu propio rol".
- Footer sticky: `Cancelar` (router.back) y botón `Crear usuario`/`Guardar cambios` con spinner durante submit.
- Errores del backend:
  - 409 con mensaje conteniendo "email" → `setError('email', { message })`.
  - `VALIDATION_ERROR` con `details[]` → mapear cada `detail.path` al campo correspondiente con `setError`.
  - Resto → `toast.error(message || 'No se pudo guardar.')`.

### Tab Empresa

Formulario RHF + Zod único (replica `actualizarConfiguracionSchema`), dividido en 4 cards `<FormSection>`:

1. **Información general:** nombreEmpresa (span 2), nit, ncr, direccion (span 2), telefono, email, sitioWeb (span 2).
2. **Facturación y contacto comercial:** porcentajeIvaDefault (number 0-100, step 0.01), telefonoCotizaciones, emailCotizaciones, logoUrl (input URL + preview `<img>` si parsea; placeholder gris si `onError`).
3. **Correos del sistema:** emailRemitente, nombreRemitente, emailCopiaInterna.
4. **Numeración de documentos:** prefijoCotizacion, prefijoFactura, prefijoActa. Cada input valida regex `/^[A-Z0-9]{2,5}$/`. Transform on change: uppercase automático. Debajo de cada input, helper text `"Vista previa: {prefijo}-{año}-XXXXX"` recalculado en vivo.

Footer sticky: `Cancelar` (`reset()` a valores cargados) y `Guardar cambios`.

Para GERENTE: todos los inputs `readOnly`, footer oculto.

### Tab Reportes programados

Formulario RHF + Zod (replica `actualizarConfigReportesSchema`):

1. **Card Reporte semanal:** switch on/off (`reporteSemanalActivo`). Si on, `<EmailsInput name="reporteSemanalEmails">`.
2. **Card Reporte mensual:** switch on/off. Si on, input numérico día del mes (1-28, clamp) + `<EmailsInput name="reporteMensualEmails">`. Helper text "Días 29-31 no soportados".
3. **Card Formato:** segmented control `PDF | Excel | Ambos` mapeado a `'pdf'|'excel'|'ambos'`.

Footer: `Cancelar` y `Guardar configuración`.

Para GERENTE: todo readOnly, footer oculto.

**Estrategia de envío:** mandar solo los campos modificados al backend (el schema permite partial updates con `.refine(d => Object.keys(d).length > 0)`). Usar `formState.dirtyFields` de RHF para construir el payload mínimo.

### Componente nuevo `<EmailsInput>`

Ubicación: `components/ui/EmailsInput.tsx`.

Props:
```ts
{
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}
```

Comportamiento:
- Renderiza cada email como chip con botón × para eliminar.
- Input al final; parsea en Enter, coma o blur.
- Valida formato con regex de email; si inválido, muestra borde rojo en el input + helper text "Email inválido" sin agregar.
- Rechaza duplicados silenciosamente (no se agregan, sin error visible).
- Diseñado para integrarse vía `Controller` de RHF.

## Manejo de errores

| Caso | Manejo |
|---|---|
| `useConfiguracion` carga | `<Spinner>` centrado |
| `useConfiguracion` error | `<EmptyState>` con icono alerta + botón "Reintentar" (refetch) |
| `GET /configuracion` → 404 (`NOT_FOUND`) | `<EmptyState>` "Configuración aún no creada. Guarda el primer formulario para inicializarla." El form sigue editable porque `PUT` hace upsert. |
| Email duplicado al crear/editar usuario (409 CONFLICT) | `setError('email', ...)` inline, sin toast. |
| Auto-modificación accidental (403 FORBIDDEN) | Prevenido en UI; si llega, `toast.error(err.message)`. |
| `VALIDATION_ERROR` con `details[]` | Mapear cada `detail.path` al campo correspondiente con `setError`. |
| Otros errores | `toast.error('No se pudo guardar. Intenta de nuevo.')`. |
| Logo URL inválida o imagen rota | Validación URL de Zod al guardar; en preview, `onError` reemplaza por placeholder gris "No se pudo cargar el logo". |
| Cambios sin guardar al cambiar de tab o cerrar pestaña | `formState.isDirty` + `beforeunload` + `<ConfirmRow>` arriba del contenido si intentan cambiar de tab. |

## Comentarios "why" obligatorios (en español)

- En `app/(dashboard)/ajustes/layout.tsx`: por qué el doble-check de rol en cliente (evitar flash de UI sin permisos antes del 403 server).
- En `UsuarioForm.tsx`: por qué el select de rol del propio admin va `disabled` (el backend lo bloquea con 403; prevenimos la llamada).
- En `TabEmpresa.tsx`: por qué los prefijos de numeración están en la misma página que datos de empresa (el endpoint del backend es uno solo).
- En `EmailsInput.tsx`: por qué se rechazan duplicados silenciosamente y por qué el parseo dispara en Enter, coma y blur.
- En `useActualizarConfigReportes`: por qué se envía solo los campos modificados (el schema del backend requiere al menos uno y permite partial updates).
- En `<ConfirmRow>` de desactivar: por qué se menciona "se eliminará el 2FA" cuando `mfaActivo` (el backend lo limpia automáticamente en el service).

## Checklist final antes de PR

- [ ] Páginas cargan datos reales del backend (sin mock).
- [ ] Forms validan con Zod y mapean errores 409/VALIDATION_ERROR inline.
- [ ] GERENTE ve solo lectura; OPERADOR/LOGISTICA/VISUALIZADOR reciben "Sin acceso".
- [ ] ADMIN no puede desactivarse ni cambiar su propio rol (UI deshabilitada con tooltip).
- [ ] Tablas usan `thead` canónico + columna `#` + columna `Acciones`.
- [ ] PageHeader con `backLabel="Ajustes"` en forms de usuario.
- [ ] Toasts en todas las mutations (success y error genérico).
- [ ] `EmailsInput` valida formato y rechaza duplicados.
- [ ] Logo URL preview maneja `onError` con placeholder.
- [ ] Sin clases vanilla CSS — solo Tailwind o `@layer utilities`.
- [ ] Comentarios "why" en español en las decisiones no obvias.
- [ ] `pnpm tsc --noEmit` y `pnpm lint` pasan.
- [ ] Tab state persiste vía `?tab=` y soporta refresh.
- [ ] Dark mode no rompe la UI.
- [ ] Vista usable en tablet (768px).
