# Fixes varios (mobile + CORS + tweaks cleanup) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir 6 issues post-merge de Rama 18: hook PATCH para notificaciones, reorganizar BottomNav, eliminar sandwich muerto, fix layout 2FA en mobile, reemplazar TweaksPanel con dropdown ⚙️, configurar CORS multi-origin.

**Architecture:** Cambios independientes por task excepto el bloque "tweaks overhaul" (5 archivos coordinados) que necesita commitearse junto porque el shape del store rompe consumidores. Backend: 2 archivos. Frontend: ~10 archivos en 4 tasks + 1 task final de verificación + PRs.

**Tech Stack:** Next.js 16, React 19, TanStack React Query, Zustand, Express + cors package, Tailwind v4.

**Spec de referencia:** `docs/superpowers/specs/2026-05-30-fixes-varios-design.md`

**Convenciones obligatorias** (CLAUDE.md): comentarios "why" en español, Tailwind only sin valores arbitrarios, sin clases vanilla CSS, errores mapeados según convención.

**Ramas:** ambas son `fix/varios-mobile-cors` en frontend y backend (ya checked-out). No hay PR existente — al terminar se crean PRs nuevos.

---

## Mapa de archivos

**Backend** (`/Users/joaquinmorales13a06/Desktop/Reinar/server`):
- Modify: `src/config/env.ts` — `CORS_ORIGIN` pasa a obligatorio.
- Modify: `src/index.ts` — parsear CSV, hard-fail en boot si vacío.

**Frontend** (`/Users/joaquinmorales13a06/Desktop/Reinar/frontend`):
- Modify: `hooks/use-notificaciones.ts` (Task 2) — `api.post` → `api.patch`.
- Modify: `components/perfil/MfaCard.tsx` (Task 3) — layout responsive del bloque "código manual".
- Modify: `lib/nav.ts` (Task 4) — reorganizar `BOTTOM_NAV_ITEMS`.
- Modify: `components/layout/BottomNav.tsx` (Task 4) — `max-h-[60vh] overflow-y-auto` defensivo en popover.
- Modify: `stores/ui.store.ts` (Task 5) — drop drástico del shape.
- Modify: `components/equipos/EquiposList.tsx` (Task 5) — adaptar lectura `tweaks.equiposView` → `equiposView`.
- Modify: `app/providers.tsx` (Task 5) — `TweaksHydrator` → `ThemeHydrator` simplificado.
- Modify: `components/layout/AppShell.tsx` (Task 5) — drop sidebar mini state, drop TweaksPanel render, drop sidebarOpen.
- Modify: `components/layout/Sidebar.tsx` (Task 5) — drop prop `isMini` y todas las ramas condicionales.
- Modify: `components/layout/Topbar.tsx` (Task 5) — drop hamburger, drop `onMenuClick`/`onTweaksOpen`, agregar dropdown ⚙️.
- Delete: `components/layout/TweaksPanel.tsx` (Task 5).

**Sin tests automáticos** — verificación con `pnpm tsc --noEmit` + `pnpm lint` + manual en `pnpm dev` (deferido al usuario para mobile breakpoints).

---

## Task 1: Backend — CORS multi-origin

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/config/env.ts`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/index.ts`

Working directory: `/Users/joaquinmorales13a06/Desktop/Reinar/server`
Branch: `fix/varios-mobile-cors` (ya checked-out).

### Step 1: Hacer `CORS_ORIGIN` obligatoria en `env.ts`

Find this line in `src/config/env.ts`:

```typescript
  CORS_ORIGIN: z.string().optional(),
```

Replace with:

```typescript
  // Lista CSV de origins permitidos por CORS. Obligatoria sin default: el legacy
  // `http://localhost:5173` era del scaffold Vite y nunca aplicó al Next.js en :3001.
  // Mejor fallar el boot que arrancar con configuración engañosa.
  CORS_ORIGIN: z.string().min(1, 'CORS_ORIGIN debe definir al menos un origin (CSV)'),
```

### Step 2: Agregar `CORS_ORIGIN` al `.env` local (necesario para arrancar)

Si `/Users/joaquinmorales13a06/Desktop/Reinar/server/.env` aún no tiene `CORS_ORIGIN`, agregar:

```
CORS_ORIGIN=http://localhost:3001
```

(El usuario actualizará a la lista completa de prod cuando despliegue.)

### Step 3: Parsear CSV y aplicar al cors middleware en `index.ts`

Find this line in `src/index.ts`:

```typescript
app.use(cors({ origin: env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }))
```

Replace with:

```typescript
// Lista de origins separados por coma. Hard-fail en boot si está vacía: preferimos
// que el server no arranque a aceptar CORS abierto silenciosamente.
const origins = env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
if (origins.length === 0) {
  throw new Error('CORS_ORIGIN no contiene origins válidos después de parsear')
}
app.use(cors({ origin: origins, credentials: true }))
```

### Step 4: Verificar

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm tsc --noEmit
```

Expected: no errors.

### Step 5: Smoke test (opcional, si el server corre)

Levantar el server con `pnpm dev` y confirmar que arranca. Si está corriendo, no es necesario — el siguiente push verá esto.

### Step 6: Commit

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/config/env.ts src/index.ts
git commit -m "fix(cors): aceptar lista CSV de origins y hard-fail si vacia"
```

---

## Task 2: Frontend — fix hook notificaciones (POST → PATCH)

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/hooks/use-notificaciones.ts`

Working directory: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend`
Branch: `fix/varios-mobile-cors`.

### Step 1: Cambiar método HTTP

Find this block in `hooks/use-notificaciones.ts`:

```typescript
export function useMarcarTodasLeidas() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<null>, Error, void>({
    mutationFn: () =>
      api.post<ApiResponse<null>>('/notificaciones/leer-todas').then((r) => r.data),
    onSuccess: () => {
```

Replace the `mutationFn` line:

```typescript
    mutationFn: () =>
      // Backend define router.patch('/leer-todas', ...) — usar POST devolvía 404 → toast genérico.
      api.patch<ApiResponse<null>>('/notificaciones/leer-todas').then((r) => r.data),
```

### Step 2: Verificar

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm tsc --noEmit
```

Expected: no errors.

### Step 3: Commit

```bash
git add hooks/use-notificaciones.ts
git commit -m "fix(notificaciones): usar PATCH en leer-todas (matchear ruta backend)"
```

---

## Task 3: Frontend — MfaCard layout responsivo del código manual

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/perfil/MfaCard.tsx`

Working directory: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend`
Branch: `fix/varios-mobile-cors`.

### Step 1: Encontrar el bloque del código manual

```bash
grep -n "tracking-widest\|font-mono" components/perfil/MfaCard.tsx | head -3
```

Expected: una línea con `<code>` y `tracking-widest` cerca del bloque del wizard 2FA paso 1.

### Step 2: Reemplazar contenedor + clases del `<code>`

Find this block:

```tsx
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
```

Replace with:

```tsx
              {/* flex-col en mobile + break-all permiten que el secret base32 (~32 chars
                  con tracking) wrappee por caracter sin desbordar el contenedor de 375px.
                  tracking-wider (en lugar de widest) baja el ancho visual del bloque. */}
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <code className="flex-1 px-3 py-2 bg-bg-sunken rounded font-mono text-sm tracking-wider break-all">{secret}</code>
                <button
                  type="button"
                  onClick={copiarSecret}
                  className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs text-tx-2 border border-bd hover:bg-bg-sunken transition-colors shrink-0"
                >
                  <Icon name={copied ? 'check' : 'copy'} size={12} /> {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
```

(Cambios: contenedor pasa a `flex-col sm:flex-row sm:items-center`; `<code>` agrega `break-all` y cambia `tracking-widest` → `tracking-wider`; botón agrega `justify-center` y `shrink-0` para verse bien en ambos layouts.)

### Step 3: Verificar

```bash
pnpm tsc --noEmit
```

Expected: no errors.

### Step 4: Commit

```bash
git add components/perfil/MfaCard.tsx
git commit -m "fix(perfil): bloque codigo manual 2FA responsive en mobile"
```

---

## Task 4: Frontend — Reorganizar BottomNav

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/lib/nav.ts`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/layout/BottomNav.tsx`

Working directory: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend`
Branch: `fix/varios-mobile-cors`.

### Step 1: Actualizar `BOTTOM_NAV_ITEMS` en `lib/nav.ts`

Find the existing `export const BOTTOM_NAV_ITEMS: BottomNavSlot[] = [...]` block (al final del archivo) y reemplazarlo COMPLETAMENTE con:

```typescript
export const BOTTOM_NAV_ITEMS: BottomNavSlot[] = [
  { kind: 'link', id: 'inicio', label: 'Inicio', href: '/dashboard', icon: 'home' },
  {
    kind: 'group',
    id: 'clientes-grupo',
    label: 'Clientes',
    icon: 'users',
    children: [
      NAV_GROUPS[0].items[1], // Clientes
      NAV_GROUPS[0].items[2], // Contactos
    ],
  },
  {
    kind: 'group',
    id: 'ventas',
    label: 'Ventas',
    icon: 'fileText',
    // Actas/Recepciones/Notas/Retenciones viven aquí (no en "Clientes") porque
    // son documentos del flujo de venta, no propiedades del cliente.
    children: [
      NAV_GROUPS[1].items[0], // Cotizaciones
      NAV_GROUPS[1].items[1], // Facturas
      NAV_GROUPS[1].items[4], // Pagos
      NAV_GROUPS[1].items[2], // Actas de Entrega
      NAV_GROUPS[1].items[3], // Recepciones
      NAV_GROUPS[1].items[5], // Notas de Crédito
      NAV_GROUPS[1].items[6], // Retenciones
    ],
  },
  {
    kind: 'group',
    id: 'inventario',
    label: 'Inventario',
    icon: 'package',
    children: [
      NAV_GROUPS[2].items[0], // Equipos
      NAV_GROUPS[2].items[2], // Andamios
      NAV_GROUPS[2].items[3], // Herramientas & Consum.
      NAV_GROUPS[2].items[1], // Servicios
      NAV_GROUPS[2].items[4], // Bodegas
      NAV_GROUPS[2].items[5], // Mantenimientos
    ],
  },
  { kind: 'link', id: 'reportes', label: 'Reportes', href: '/reportes', icon: 'chartBar' },
];
```

### Step 2: Agregar scroll defensivo al popover de `BottomNav.tsx`

Find this block in `components/layout/BottomNav.tsx`:

```tsx
              <div
                role="menu"
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 min-w-48 bg-sidebar-bg border border-white/10 rounded-lg shadow-lg overflow-hidden"
              >
```

Replace with:

```tsx
              <div
                role="menu"
                // max-h-[60vh] + overflow-y-auto defensivo: el grupo "Ventas" tiene 7 items
                // y en pantallas pequeñas verticales el popover podría salir del viewport.
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 min-w-48 max-h-[60vh] overflow-y-auto bg-sidebar-bg border border-white/10 rounded-lg shadow-lg"
              >
```

(Cambio: `overflow-hidden` → `overflow-y-auto` y agregamos `max-h-[60vh]`. El `max-h-[60vh]` es valor arbitrario justificado por viewport relativo — no existe en spacing scale.)

### Step 3: Verificar

```bash
pnpm tsc --noEmit
```

Expected: no errors.

### Step 4: Commit

```bash
git add lib/nav.ts components/layout/BottomNav.tsx
git commit -m "feat(nav): reorganizar BottomNav en grupos por dominio (Ventas/Inventario expandidos)"
```

---

## Task 5: Frontend — Tweaks overhaul (drop TweaksPanel + sandwich + nuevo ⚙️ menu)

Esta task es grande pero cohesiva: cambiar el shape del store sin actualizar consumidores rompe la compilación. Debe commitearse junto.

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/stores/ui.store.ts` (reescritura)
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/equipos/EquiposList.tsx` (adaptar consumidor)
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/app/providers.tsx` (TweaksHydrator → ThemeHydrator)
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/layout/AppShell.tsx` (drop sidebar mini state + TweaksPanel + sidebarOpen)
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/layout/Sidebar.tsx` (drop isMini)
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/layout/Topbar.tsx` (drop hamburger, nuevo dropdown ⚙️)
- Delete: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/layout/TweaksPanel.tsx`

Working directory: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend`
Branch: `fix/varios-mobile-cors`.

### Step 1: Reescribir `stores/ui.store.ts`

Reemplazar el archivo completo con:

```typescript
// 'use client' porque este módulo referencia localStorage y document.
// Next.js intentaría evaluarlo en el servidor durante el análisis estático,
// lo que causaría un crash porque esas APIs no existen en Node.
'use client';

import { create } from 'zustand';

export type Theme = 'light' | 'dark';
export type EquiposView = 'tabla' | 'grilla';

type UiState = {
  theme: Theme;
  equiposView: EquiposView;
  setTheme: (t: Theme) => void;
  setEquiposView: (v: EquiposView) => void;
};

// Nuevo storage key (`reinar.ui`) y no el legacy `reinar.tweaks`: la migración del
// shape viejo (density/sidebar/accent) es no-op visualmente, así que dejamos el
// JSON viejo inerte en localStorage del usuario en lugar de escribir código one-shot.
const STORAGE_KEY = 'reinar.ui';

type Persisted = Partial<Pick<UiState, 'theme' | 'equiposView'>>;

function load(): Pick<UiState, 'theme' | 'equiposView'> {
  if (typeof window === 'undefined') return { theme: 'light', equiposView: 'tabla' };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Persisted;
    return {
      theme: saved.theme ?? 'light',
      equiposView: saved.equiposView ?? 'tabla',
    };
  } catch {
    return { theme: 'light', equiposView: 'tabla' };
  }
}

function persist(theme: Theme, equiposView: EquiposView) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme, equiposView }));
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  // Usamos data-theme en vez de clase porque el CSS del proyecto targetea
  // [data-theme="dark"] — mantener este contrato evita reescribir estilos.
  document.documentElement.setAttribute('data-theme', theme);
}

export const useUiStore = create<UiState>((set, get) => {
  const initial = load();
  // Aplicar tema al boot del store (cliente solo) para que la primera render
  // ya tenga el data-theme correcto sin esperar al hydrator.
  if (typeof document !== 'undefined') applyTheme(initial.theme);
  return {
    theme: initial.theme,
    equiposView: initial.equiposView,
    setTheme: (theme) => {
      applyTheme(theme);
      persist(theme, get().equiposView);
      set({ theme });
    },
    setEquiposView: (equiposView) => {
      persist(get().theme, equiposView);
      set({ equiposView });
    },
  };
});
```

### Step 2: Adaptar `EquiposList.tsx` al nuevo shape

```bash
grep -n "tweaks\.equiposView\|setTweak" components/equipos/EquiposList.tsx
```

Expected: 3 líneas. Cambiar:

Find:
```tsx
  const view = useUiStore((s) => s.tweaks.equiposView);
```

Replace with:
```tsx
  const view = useUiStore((s) => s.equiposView);
```

Find (puede aparecer 2 veces, una para 'tabla' y otra para 'grilla'):
```tsx
                onClick={() => setTweak('equiposView', 'tabla')}
```

Replace with:
```tsx
                onClick={() => setEquiposView('tabla')}
```

Y similar para `setTweak('equiposView', 'grilla')` → `setEquiposView('grilla')`.

Verificar que el componente importe `setEquiposView` del store. Find:

```tsx
  const setTweak = useUiStore((s) => s.setTweak);
```

Replace with:

```tsx
  const setEquiposView = useUiStore((s) => s.setEquiposView);
```

Si no existe esa línea, agregarla cerca de las otras selecciones del store.

### Step 3: Simplificar `app/providers.tsx` (TweaksHydrator → ThemeHydrator)

```bash
grep -n "TweaksHydrator\|tweaks\." app/providers.tsx
```

Find the `TweaksHydrator` component or import (puede estar inline o importado de otro lado). Lo más probable: hay un componente que llama a `hydrate()` del store viejo.

Si está inline en `providers.tsx`, reemplazar la función completa por:

```tsx
function ThemeHydrator() {
  // Sin lógica adicional: el ui.store aplica data-theme directamente en el load()
  // del initial state. Este componente queda como anchor para futura inicialización
  // cliente-side si hace falta (analytics, feature flags, etc.).
  return null;
}
```

Y dentro del JSX donde se renderizaba `<TweaksHydrator />`, renombrar a `<ThemeHydrator />`.

Si `TweaksHydrator` está importado desde otro lado (ej. `components/layout/TweaksHydrator.tsx`), entonces:
- Si el archivo existe, simplificarlo a `return null` y renombrarlo / actualizar el import.
- Alternativa simple: eliminar el componente y el render — el applyTheme inicial ya ocurre en el store.

Después del cambio, ejecutar:

```bash
grep -rn "TweaksHydrator" app/ components/ 2>/dev/null
```

Expected: ninguna ocurrencia. Si quedan, reemplazar por `ThemeHydrator` o eliminar.

### Step 4: Simplificar `components/layout/AppShell.tsx`

Read the current AppShell content and rewrite it as:

```tsx
'use client';

import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { BottomNav } from './BottomNav';

type AppShellProps = {
  children: React.ReactNode;
};

// Antes había state de sidebarOpen + overlay + TweaksPanel — todo eliminado:
// el hamburger era código muerto (Sidebar es max-lg:hidden), el sidebar mini
// se removió (siempre full), y TweaksPanel se reemplazó por dropdown en Topbar.
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 bg-bg">
        <Topbar />
        <div className="p-6 max-lg:pb-20">{children}</div>
      </div>
      <BottomNav />
    </div>
  );
}
```

(Eliminado: import de `useState`, `useUiStore`, `TweaksPanel`; toda la lógica de `sidebarOpen`, `isMini`, `tweaksOpen`, `setTweaksOpen`; el overlay y el render de TweaksPanel; las props `onMenuClick`/`onTweaksOpen` del Topbar.)

### Step 5: Simplificar `components/layout/Sidebar.tsx`

```bash
grep -n "isMini\|onCollapse" components/layout/Sidebar.tsx | head -10
```

El archivo tiene ramas `isMini ? 'X' : 'Y'` en varias clases. Eliminar la prop y simplificar a la rama "full".

Cambios concretos:

Find:
```tsx
type SidebarProps = {
  isMini: boolean;
  onCollapse: () => void;
};

export function Sidebar({ isMini, onCollapse }: SidebarProps) {
```

Replace with:
```tsx
// Sin props: el Sidebar siempre se renderiza ancho completo en lg+. El modo mini
// se eliminó con el cleanup de TweaksPanel.
export function Sidebar() {
```

Luego para cada ocurrencia `${isMini ? 'CLASES_MINI' : 'CLASES_FULL'}`, quedarse con `CLASES_FULL`:

Find:
```tsx
      className={`${isMini ? 'w-16' : 'w-60'} shrink-0 bg-sidebar-bg text-sidebar-fg flex flex-col border-r border-white/4 sticky top-0 h-screen overflow-y-auto overflow-x-hidden transition-[width] duration-150 max-lg:hidden`}
```

Replace with:
```tsx
      className="w-60 shrink-0 bg-sidebar-bg text-sidebar-fg flex flex-col border-r border-white/4 sticky top-0 h-screen overflow-y-auto overflow-x-hidden max-lg:hidden"
```

Find:
```tsx
        isMini ? 'min-h-14 py-3' : 'min-h-20 xl:min-h-24 py-4 px-4'
```

Donde esto se use (probablemente template literal), reemplazar por `'min-h-20 xl:min-h-24 py-4 px-4'`.

Find:
```tsx
        {isMini ? (
```

Si hay un ternario que renderiza distinto en mini vs full (típicamente logo pequeño vs grande), quedarse con la rama del else (full).

Find:
```tsx
            {!isMini && (
```

Eliminar el wrapper condicional `{!isMini && (...)}` — quedarse con el contenido directo.

Find:
```tsx
                onClick={onCollapse}
```

Eliminar el handler `onClick={onCollapse}`. Si está en un botón que ya no tiene función, eliminar el botón entero.

Find:
```tsx
                  isMini ? 'justify-center px-0' : 'px-2'
```

Reemplazar por `'px-2'`.

Find:
```tsx
                {!isMini && <span className="flex-1">{item.label}</span>}
```

Reemplazar por:
```tsx
                <span className="flex-1">{item.label}</span>
```

Find:
```tsx
      <div className={`flex items-center border-t border-white/4 px-3 py-3 text-2xs xl:text-xs opacity-45 ${isMini ? 'justify-center' : 'justify-between'}`}>
        {!isMini && <span>v1.0.0 · 2026</span>}
```

Reemplazar por:
```tsx
      <div className="flex items-center justify-between border-t border-white/4 px-3 py-3 text-2xs xl:text-xs opacity-45">
        <span>v1.0.0 · 2026</span>
```

**Después de todos los cambios, verificar que NO queda ninguna referencia a `isMini` o `onCollapse`:**

```bash
grep -n "isMini\|onCollapse" components/layout/Sidebar.tsx
```

Expected: ninguna ocurrencia.

### Step 6: Modificar `components/layout/Topbar.tsx` — drop hamburger + dropdown ⚙️

Lee el archivo completo primero:

```bash
cat components/layout/Topbar.tsx
```

Cambios concretos:

**Sub-step 6.1 — Drop hamburger button + onMenuClick prop:**

Find:
```tsx
type TopbarProps = {
  onMenuClick: () => void;
  onTweaksOpen: () => void;
};
```

Replace with:
```tsx
// Sin props: el hamburger se eliminó (era código muerto, el Sidebar es max-lg:hidden)
// y el botón de tweaks pasa a manejar su dropdown internamente.
type TopbarProps = Record<string, never>;
```

Find:
```tsx
export function Topbar({ onMenuClick, onTweaksOpen }: TopbarProps) {
```

Replace with:
```tsx
export function Topbar() {
```

Find:
```tsx
      {/* md:hidden porque en desktop el sidebar siempre es visible; el hamburger solo tiene
          sentido en móvil donde el sidebar está oculto vía CSS */}
      <button className={`${iconBtn} md:hidden`} onClick={onMenuClick} aria-label="Abrir menú">
        <Icon name="menu" size={18} />
      </button>
```

Eliminar este bloque completo.

**Sub-step 6.2 — Reemplazar el botón ⚙️ con dropdown:**

Buscar dónde está el botón actual del ⚙️ (que llama a `onTweaksOpen`):

```bash
grep -n "onTweaksOpen\|gear" components/layout/Topbar.tsx
```

Find el botón actual:
```tsx
      <button className={iconBtn} onClick={onTweaksOpen} aria-label="Tweaks">
        <Icon name="gear" size={18} />
      </button>
```

Replace with:
```tsx
      {/* Dropdown reemplaza al antiguo TweaksPanel. Solo conservamos toggle de tema;
          density/sidebar mini/accent se eliminaron por simplicidad. */}
      <div className="relative">
        <button
          className={iconBtn}
          onClick={() => { setConfigOpen((o) => !o); setNotifOpen(false); setUserOpen(false); }}
          aria-label="Configuración"
        >
          <Icon name="gear" size={18} />
        </button>
        {configOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={closeAll} />
            <div className="absolute top-full translate-y-1.5 right-0 min-w-56 bg-surface border border-bd rounded shadow-lg z-50 overflow-hidden">
              <Link
                href="/ajustes"
                onClick={closeAll}
                className="flex items-center gap-2 px-3 py-2 text-xs text-tx cursor-pointer hover:bg-bg-sunken"
              >
                <Icon name="gear" size={14} /> Ajustes del sistema
              </Link>
              {(user?.rol === 'ADMIN' || user?.rol === 'GERENTE') && (
                <Link
                  href="/auditlog"
                  onClick={closeAll}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-tx cursor-pointer hover:bg-bg-sunken"
                >
                  <Icon name="fileText" size={14} /> Auditoría
                </Link>
              )}
              <div className="h-px bg-bd my-1" />
              {/* Toggle de tema NO cierra el dropdown — permite experimentar antes de decidir. */}
              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-tx cursor-pointer hover:bg-bg-sunken"
              >
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={14} />
                Tema {theme === 'dark' ? 'claro' : 'oscuro'}
              </button>
            </div>
          </>
        )}
      </div>
```

**Sub-step 6.3 — Agregar imports + state + cerrar dropdown handler:**

Find el bloque de imports al inicio del archivo, asegurar que incluya `Link from 'next/link'` (ya debería estar — agregado en Rama 18). Si no:

```tsx
import Link from 'next/link';
```

En el bloque de imports también, asegurar:

```tsx
import { useAuthStore } from '@/stores/auth.store';
import { useUiStore } from '@/stores/ui.store';
```

(El primero ya debe estar. El segundo agregar si no está.)

En el cuerpo del componente Topbar, después de `const user = useAuthStore(...)`, agregar:

```tsx
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
```

En el state del componente (donde están `notifOpen`, `userOpen`), agregar:

```tsx
  const [configOpen, setConfigOpen] = useState(false);
```

En la función `closeAll`, agregar `setConfigOpen(false)`:

Find:
```tsx
  function closeAll() {
    setNotifOpen(false);
    setUserOpen(false);
  }
```

Replace with:
```tsx
  function closeAll() {
    setNotifOpen(false);
    setUserOpen(false);
    setConfigOpen(false);
  }
```

(Si la firma es distinta, simplemente agregar `setConfigOpen(false)` al cuerpo.)

También en los otros handlers que abren dropdowns (notif/user), agregar `setConfigOpen(false)` para mantener exclusividad:

Find (en el click del bell):
```tsx
            onClick={() => { setNotifOpen((o) => !o); setUserOpen(false); }}
```

Replace with:
```tsx
            onClick={() => { setNotifOpen((o) => !o); setUserOpen(false); setConfigOpen(false); }}
```

Y similar para el click del usuario avatar:
```tsx
            onClick={() => { setUserOpen((o) => !o); setNotifOpen(false); }}
```

→

```tsx
            onClick={() => { setUserOpen((o) => !o); setNotifOpen(false); setConfigOpen(false); }}
```

### Step 7: Eliminar `TweaksPanel.tsx`

```bash
rm components/layout/TweaksPanel.tsx
```

### Step 8: Verificación de tipos + lint

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm tsc --noEmit
```

Expected: no errors. Si hay errores en `EquiposList.tsx` o `providers.tsx`, revisar que los cambios de los Steps 2 y 3 estén completos.

```bash
pnpm lint 2>&1 | grep -E "layout/Topbar|layout/AppShell|layout/Sidebar|equipos/EquiposList|stores/ui.store|app/providers" | head -10
```

Expected: zero output o solo warnings preexistentes.

### Step 9: Actualizar `AppShell.tsx` callers (verificar que `<Topbar>` y `<Sidebar>` se llamen sin props)

```bash
grep -rn "<Topbar\|<Sidebar" app/ components/ 2>/dev/null
```

Expected: solo `<Topbar />` y `<Sidebar />` sin props (AppShell ya simplificado en Step 4). Si quedan props legacy en algún otro lado, eliminarlas.

### Step 10: Commit (TODO el cambio coordinado)

```bash
git add stores/ui.store.ts components/equipos/EquiposList.tsx app/providers.tsx components/layout/AppShell.tsx components/layout/Sidebar.tsx components/layout/Topbar.tsx
git rm components/layout/TweaksPanel.tsx
git commit -m "feat(ui): drop TweaksPanel y sandwich menu, reemplazar por dropdown gear con theme toggle"
```

---

## Task 6: Verificación final + push + crear PRs

**Files:** — no code changes.

### Step 1: Final tsc + lint frontend

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm tsc --noEmit
pnpm lint 2>&1 | tail -10
```

Expected: tsc clean. Lint: zero NEW errors atribuibles a esta rama (warnings preexistentes en `PhoneInputField.tsx`, `depositos`, etc. son OK).

### Step 2: Final tsc backend

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm tsc --noEmit
```

Expected: clean.

### Step 3: Push backend

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git push -u origin fix/varios-mobile-cors 2>&1 | tail -5
```

Expected: push successful.

### Step 4: Push frontend

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git push -u origin fix/varios-mobile-cors 2>&1 | tail -5
```

Expected: push successful.

### Step 5: Crear PR backend

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
gh pr create --title "fix(cors): aceptar lista CSV de origins y hard-fail si vacia" --body "$(cat <<'EOF'
## Summary

- `env.CORS_ORIGIN` ahora es obligatorio (sin default) — el legacy `http://localhost:5173` era engañoso (era el default de Vite, nunca aplicó al Next.js en :3001).
- El middleware cors recibe lista de origins separados por coma, parseada en `index.ts`. Hard-fail al boot si la lista queda vacía después de parsear.

## Test plan

- [ ] Arranque con \`CORS_ORIGIN=https://crmsv.reinarsa.com,http://localhost:3001\` → server arranca, ambos origins aceptados.
- [ ] Arranque sin \`CORS_ORIGIN\` → server falla con mensaje claro.
- [ ] Arranque con \`CORS_ORIGIN="  ,  "\` → server falla con throw explícito en index.ts.
- [ ] Frontend en localhost:3001 puede hacer requests al backend (CORS no bloquea).

**Setup obligatorio en VPS prod:** asegurar que \`.env\` tenga \`CORS_ORIGIN=https://crmsv.reinarsa.com\` (o incluir localhost si se quiere debugging puntual).

Rama frontend: \`fix/varios-mobile-cors\` (PR separado).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" 2>&1 | tail -3
```

Expected: gh devuelve URL del PR.

### Step 6: Crear PR frontend

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
gh pr create --title "fix: bugs varios mobile + tweaks cleanup + nuevo gear menu" --body "$(cat <<'EOF'
## Summary

6 fixes post-merge de Rama 18:

1. **Notificaciones**: hook \`useMarcarTodasLeidas\` ahora usa PATCH (matchea ruta backend). Adiós toast de error al \"marcar todo como leído\".
2. **BottomNav** mobile reorganizado por dominio: Inicio / Clientes (Clientes + Contactos) / Ventas (Cotizaciones + Facturas + Pagos + Actas + Recepciones + Notas + Retenciones) / Inventario (Equipos + Andamios + Herramientas + Servicios + Bodegas + Mantenimientos) / Reportes. Popover con \`max-h-[60vh] overflow-y-auto\` para grupos grandes.
3. **Sandwich menu** del Topbar en mobile eliminado (era código muerto — el Sidebar es \`max-lg:hidden\`, el handler nunca tenía efecto).
4. **MfaCard** wizard 2FA: bloque \"código manual\" pasa a \`flex-col sm:flex-row\` con \`break-all\` en el \`<code>\`. El secret base32 ya no desborda en mobile.
5. **TweaksPanel eliminado**. Botón ⚙️ del topbar ahora abre dropdown con: Ajustes del sistema, Auditoría (solo ADMIN/GERENTE), toggle Tema claro/oscuro. Sidebar siempre full-width; accent siempre amarillo; densidad ya no es configurable (no tenía CSS asociado). Store \`ui.store\` simplificado a \`theme + equiposView\`.
6. Backend CORS (PR separado).

## Test plan

**Notificaciones**
- [ ] Click \"marcar todo como leído\" → 200 OK, sin toast de error, puntos amarillos desaparecen.

**BottomNav mobile (<lg)**
- [ ] Visible solo en mobile/tablet.
- [ ] 5 slots: Inicio, Clientes, Ventas, Inventario, Reportes.
- [ ] Tap en Ventas → popover muestra 7 items.
- [ ] Tap en Inventario → popover muestra 6 items.

**Sandwich menu**
- [ ] En mobile NO aparece hamburger en el Topbar.

**2FA wizard en mobile (375px)**
- [ ] Activar 2FA → paso 1 muestra QR + bloque código manual.
- [ ] Secret base32 visible sin scroll horizontal.
- [ ] Botón \"Copiar\" debajo del secret en mobile, al lado en sm+.

**Dropdown ⚙️**
- [ ] Click ⚙️ abre dropdown con 3 items.
- [ ] \"Ajustes del sistema\" → navega a /ajustes y cierra dropdown.
- [ ] \"Auditoría\" visible solo para ADMIN/GERENTE.
- [ ] Toggle Tema cambia dark/light sin cerrar dropdown. Persiste tras refresh.
- [ ] TweaksPanel.tsx no existe.
- [ ] Sidebar siempre 240px en lg+, sin botón collapse.

**Equipos**
- [ ] /equipos sigue funcionando con toggle tabla/grilla (consumidor adaptado al nuevo shape del store).

Spec: \`docs/superpowers/specs/2026-05-30-fixes-varios-design.md\`
Plan: \`docs/superpowers/plans/2026-05-30-fixes-varios.md\`

**Requiere mergear primero:** PR backend \`fix(cors): aceptar lista CSV de origins\`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" 2>&1 | tail -3
```

Expected: gh devuelve URL del PR.

---

## Self-Review

**Spec coverage:**

| Sección del spec | Task |
|---|---|
| Fix #1 (hook PATCH) | Task 2 |
| Fix #2 (BottomNav) | Task 4 |
| Fix #3 (sandwich removal) | Task 5 sub-step 6.1 |
| Fix #4 (MfaCard layout) | Task 3 |
| Fix #5 (TweaksPanel cleanup + dropdown ⚙️) | Task 5 (todos los sub-steps) |
| Fix #6 (CORS) | Task 1 |
| Persistencia legacy `reinar.tweaks` queda inerte | Task 5 Step 1 (nuevo storage key `reinar.ui`) |
| EquiposList adaptado al nuevo shape | Task 5 Step 2 |
| TweaksHydrator → ThemeHydrator | Task 5 Step 3 |
| Sidebar drop isMini | Task 5 Step 5 |
| Topbar dropdown ⚙️ | Task 5 sub-step 6.2 |
| Toggle tema no cierra dropdown | Task 5 sub-step 6.2 (comentario + render) |
| Push + PRs (sin merge automático) | Task 6 |

Coverage completo. Sin gaps.

**Placeholder scan:** sin TBDs, TODOs, "implement later" o referencias circulares.

**Type consistency:** `UiState` con `theme`, `equiposView`, `setTheme`, `setEquiposView` definido en Task 5 Step 1 y usado consistentemente en Steps 2 (EquiposList) y 6.3 (Topbar). `Theme` y `EquiposView` exportados como union types. `BottomNavSlot` ya existente — Task 4 lo respeta.

**Notas operativas:**
- Task 5 es la única grande (~7 archivos coordinados). El resto son surgical.
- Task 5 NO se puede commitear parcialmente: cambiar el shape del store rompe EquiposList y AppShell hasta que se actualicen — todo va en un commit.
- El plan asume que `Sidebar.tsx` tiene un botón con `onCollapse` que se elimina al quitar la prop. Si la implementación real lo tiene en otra forma (ej. wrapper component), el implementer ajusta sin perder el cleanup.
- No hay PRs existentes en esta rama — Task 6 crea PRs nuevos.
