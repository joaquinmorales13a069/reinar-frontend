# Spec — Fixes varios (mobile + CORS + tweaks cleanup)

**Fecha:** 2026-05-30
**Rama frontend:** `fix/varios-mobile-cors`
**Rama backend:** `fix/varios-mobile-cors`

## Objetivo

Corregir 6 issues mixtos detectados en la rama 18 post-merge:
1. Hook frontend usa POST en vez de PATCH para `/notificaciones/leer-todas` → toast de error.
2. BottomNav mobile no expone Facturas, Pagos, Actas, Recepciones, Bodegas — agrupar mejor.
3. Botón hamburger del Topbar en mobile es código muerto (no muestra nada) → eliminar.
4. Bloque "código manual" del 2FA wizard rompe layout en sm/md por el secret font-mono largo.
5. Quitar TweaksPanel — el botón ⚙️ pasa a abrir un dropdown con Ajustes / Auditoría / toggle dark.
6. Configurar CORS backend para producción (`https://crmsv.reinarsa.com`) + dev (`localhost:3001`).

## Alcance

**Dentro:** los 6 fixes listados arriba, todos en la misma rama (cohesión: son ajustes de UX/infra post-merge).

**Fuera:**
- Migración explícita de `localStorage` para limpiar tweaks zombies (density, sidebar, accent quedan en JSON viejo pero no se leen — no requiere acción).
- Sidebar como drawer en mobile (alternativa al hamburger eliminado — BottomNav ya cubre la navegación mobile).
- Migrar `equiposView` fuera del store (sigue en `ui.store` porque la usa `EquiposList` con su propio toggle inline — no se afecta).
- Cambiar la posición visual o estilo del botón ⚙️ — solo cambia su comportamiento.

## Decisiones de diseño

| # | Decisión | Razón |
|---|---|---|
| 1 | `useMarcarTodasLeidas` cambia `api.post` → `api.patch`. | Backend define `router.patch('/leer-todas', ...)`. POST devolvía 404 o 405 → toast genérico. Fix de 1 línea. |
| 2 | BottomNav reorganizado: Inicio / Clientes / **Ventas** / Inventario / Reportes. Cotizaciones pasa a "Ventas". | Actas/Recepciones/Notas/Retenciones son documentos del flujo de venta, no propiedades del cliente. Agrupar todo bajo "Ventas" matchea el modelo mental del usuario y limpia la división. |
| 3 | Hamburger del Topbar se elimina (no se reusa). | `setSidebarOpen(true)` no hace nada porque el Sidebar es `max-lg:hidden` — el código nunca funcionó en mobile. Reusarlo para el menú ⚙️ confundiría semánticamente (hamburger = navegación, no = ajustes). BottomNav ya cubre mobile nav. |
| 4 | MfaCard "código manual" pasa a `flex-col sm:flex-row` con `break-all` en el `<code>` y `tracking-wider` (en lugar de `tracking-widest`). | El secret base32 (~32 chars) con `tracking-widest` (~0.1em) suma ~30+ chars + espaciado y no entra en 375px. Vertical en mobile + word break son la solución estándar. |
| 5 | Drop completo de TweaksPanel: el store conserva solo `theme`. Sidebar siempre full, accent siempre yellow, sin densidad. | Density era no-op visual (sin CSS que use `[data-density]`); sidebar mini se usa solo en `AppShell` (ancho 64px en lg+) — pérdida menor; accent agregaba complejidad sin uso real. Mantener solo dark mode simplifica el store y el menú nuevo. |
| 6 | CORS pasa de single string a lista CSV. `CORS_ORIGIN` se hace **obligatoria** (boot falla si está vacía). | Default `http://localhost:5173` era legacy de Vite — engañoso. Lista CSV permite prod + dev sin lógica condicional. Hard-fail en boot evita deploys silenciosamente abiertos. |
| 7 | El menú nuevo ⚙️ del topbar **filtra el link "Auditoría" por rol** (solo ADMIN/GERENTE). | Coincide con el gate de `/auditlog`. Mostrar un link que lleva a "Sin acceso" para los otros roles confunde. El link "Ajustes" se muestra a todos los autenticados (la página filtra internamente). |
| 8 | Toggle de tema en el menú ⚙️ **no cierra el dropdown** al click. | Permite experimentar (probar dark, volver a light) sin reabrir el menú cada vez. Los otros items (links Ajustes/Auditoría) sí cierran al navegar. |
| 9 | `loadTweaks` en `ui.store.ts` ignora campos zombi (`density`, `sidebar`, `accent`) por spread sobre los DEFAULTS reducidos. | El usuario que ya tiene tweaks viejos en localStorage no necesita limpieza manual; los campos quedan inertes y el theme se preserva. Sin código one-shot de migración. |

## Arquitectura

### Backend (rama `fix/varios-mobile-cors`)

**`src/config/env.ts`** — hacer `CORS_ORIGIN` obligatorio:
```typescript
CORS_ORIGIN: z.string().min(1, 'CORS_ORIGIN debe definir al menos un origin (CSV)'),
```
(reemplaza el `z.string().optional()` actual).

**`src/index.ts`** — parsear CSV y construir lista:
```typescript
// Lista de origins separados por coma. Hard-fail en boot si está vacía: preferimos
// que el server no arranque a aceptar CORS abierto silenciosamente.
const origins = env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);
if (origins.length === 0) {
  throw new Error('CORS_ORIGIN no contiene origins válidos después de parsear');
}
app.use(cors({ origin: origins, credentials: true }));
```

**`.env` (no commited):** `CORS_ORIGIN=https://crmsv.reinarsa.com,http://localhost:3001` (prod tendrá ambos para permitir debugging puntual; si querés solo prod podés sacar el localhost).

### Frontend (rama `fix/varios-mobile-cors`)

**Archivos a modificar:**

| Archivo | Cambio |
|---|---|
| `hooks/use-notificaciones.ts` | `api.post` → `api.patch` en `useMarcarTodasLeidas` (1 línea). |
| `lib/nav.ts` | `BOTTOM_NAV_ITEMS` reorganizado (5 slots con nueva agrupación). |
| `components/layout/BottomNav.tsx` | Sin cambios estructurales — el componente ya itera `slot.children` genéricamente. Verificar que con 7 ítems el popover no se sale del viewport (agregar `max-h-[60vh] overflow-y-auto` si hace falta). |
| `components/layout/Topbar.tsx` | (a) Eliminar el `<button hamburger>` + prop `onMenuClick`. (b) Reemplazar el botón ⚙️ — antes llamaba `onTweaksOpen()`, ahora abre un dropdown propio (siguiendo patrón del dropdown de notificaciones/usuario). |
| `components/layout/AppShell.tsx` | Eliminar `sidebarOpen`, overlay, `isMini`, `tweaksOpen`, `setTweaksOpen`. Sidebar siempre full. No incluir TweaksPanel. |
| `components/layout/Sidebar.tsx` | Eliminar prop `isMini` y todas las ramas `isMini ?`. El Sidebar es ancho fijo `w-60`. Eliminar prop `onCollapse` (no usada). |
| `components/layout/TweaksPanel.tsx` | **Eliminar archivo.** |
| `app/providers.tsx` | `TweaksHydrator` se simplifica para aplicar solo `data-theme`. Renombrar a `ThemeHydrator` (más honesto). |
| `stores/ui.store.ts` | Drop drástico — solo `theme` + `setTheme` + persistencia. Mantener `equiposView` aparte. |
| `components/perfil/MfaCard.tsx` | Cambiar el contenedor del bloque "código manual" de `flex gap-2 items-center` a `flex flex-col sm:flex-row sm:items-center gap-2`. Agregar `break-all` al `<code>` y bajar `tracking-widest` → `tracking-wider`. |

**Sin cambios:**
- `EquiposList.tsx` (sigue usando `useUiStore((s) => s.tweaks.equiposView)` — verificar que el store siga exponiendo este campo).
- Componentes de páginas (`/ajustes`, `/auditlog`, etc.) — los gates internos no cambian.

### Cambios detallados clave

**`lib/nav.ts > BOTTOM_NAV_ITEMS` final:**
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
    children: [
      NAV_GROUPS[1].items[0], // Cotizaciones
      NAV_GROUPS[1].items[1], // Facturas
      NAV_GROUPS[1].items[4], // Pagos
      NAV_GROUPS[1].items[2], // Actas de entrega
      NAV_GROUPS[1].items[3], // Recepciones
      NAV_GROUPS[1].items[5], // Notas de crédito
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

Antes de codear, verificar contra `NAV_GROUPS` real que los índices `items[N]` apunten a lo correcto — los nombres canónicos son los que importan, no los índices.

**`stores/ui.store.ts` reducido:**
```typescript
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
  document.documentElement.setAttribute('data-theme', theme);
}

export const useUiStore = create<UiState>((set, get) => {
  const initial = load();
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

**Nota retro-compat:** `EquiposList.tsx` lee `useUiStore((s) => s.tweaks.equiposView)` — el shape cambia (sin `tweaks`). Hay que ajustar también esa lectura: `useUiStore((s) => s.equiposView)`. Y los `setTweak('equiposView', ...)` pasan a `setEquiposView(...)`. Mismo cambio en cualquier otro consumidor.

**`components/layout/Topbar.tsx` — nuevo botón ⚙️:**
```tsx
{/* Reemplaza el botón ⚙️ anterior (que abría TweaksPanel) por un dropdown */}
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
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-full flex items-center justify-between px-3 py-2 text-xs text-tx cursor-pointer hover:bg-bg-sunken"
        >
          <span className="flex items-center gap-2">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={14} />
            Tema {theme === 'dark' ? 'claro' : 'oscuro'}
          </span>
          {/* Switch visual reutilizado del MfaCard si conviene; mínimo: solo el texto cambia */}
        </button>
      </div>
    </>
  )}
</div>
```
`closeAll` ya existe en el Topbar y maneja los 3 dropdowns. Agregar `setConfigOpen(false)` al cierre.

**`components/perfil/MfaCard.tsx` — fix layout código manual:**

Encontrar este bloque:
```tsx
<div className="flex gap-2 items-center">
  <code className="flex-1 px-3 py-2 bg-bg-sunken rounded font-mono text-sm tracking-widest">{secret}</code>
  <button ...>...</button>
</div>
```

Reemplazar con:
```tsx
<div className="flex flex-col sm:flex-row gap-2 sm:items-center">
  {/* break-all permite que el secret base32 (32 chars con tracking) wrappee
      por caracter en mobile sin desbordar. tracking-wider en lugar de
      tracking-widest reduce el ancho visual del bloque. */}
  <code className="flex-1 px-3 py-2 bg-bg-sunken rounded font-mono text-sm tracking-wider break-all">{secret}</code>
  <button ...>...</button>
</div>
```

## Manejo de errores

| Caso | Manejo |
|---|---|
| Backend sin `CORS_ORIGIN` en `.env` | `env.ts` rechaza el parse del schema → `process.exit(1)` con mensaje claro. |
| Backend con `CORS_ORIGIN=" "` (solo whitespace) | `.filter(Boolean)` devuelve `[]` → throw explícito al boot. |
| Frontend en mobile pre-cambio + usuario tap hamburger | Sin el botón ya no aparece — sin acción posible que confunda. |
| Theme persiste viejo formato (`reinar.tweaks` con `density`/`sidebar`/`accent`) | El nuevo storage key es `reinar.ui` — el legacy queda olvidado, no se lee. El theme nuevo carga en el primer uso del nuevo menú (default `light`). |
| Backend recibe origin no whitelisteado | `cors` package rechaza con `CORS error` estándar — el frontend ve un error de red en DevTools. No requiere manejo especial. |

## Comentarios "why" obligatorios

**Backend:**
- `src/index.ts > origins parse + throw`: por qué hard-fail en boot.
- `src/config/env.ts > CORS_ORIGIN required`: por qué obligatoria (el default Vite era engañoso).

**Frontend:**
- `hooks/use-notificaciones.ts > useMarcarTodasLeidas patch`: por qué patch (route definition en backend).
- `lib/nav.ts > BOTTOM_NAV_ITEMS`: por qué Actas/Recepciones en grupo "Ventas" y no "Clientes".
- `components/perfil/MfaCard.tsx > flex-col sm:flex-row + break-all`: por qué este layout (secret base32 desborda en mobile con tracking).
- `stores/ui.store.ts > load`: por qué nuevo storage key `reinar.ui` y no migración (el legacy queda inerte).
- `components/layout/AppShell.tsx > eliminado sidebarOpen y TweaksPanel`: por qué removemos código que parecía útil.

## Checklist antes de PR

- [ ] **#1**: marcar todo como leído en dropdown notificaciones → 200 OK, refetch, sin toast de error.
- [ ] **#2**: BottomNav en mobile muestra 5 slots con grupos: Clientes, Ventas (7 items), Inventario (6 items), 2 links directos.
- [ ] **#3**: en mobile no aparece hamburger en Topbar; en desktop nada cambia.
- [ ] **#4**: `/perfil` activando 2FA en sm (375px) → bloque código manual sin scroll horizontal, secret wrappea con `break-all`.
- [ ] **#5**: botón ⚙️ del topbar abre dropdown con 3 items (Ajustes / Auditoría visible solo para ADMIN-GERENTE / toggle Tema). TweaksPanel.tsx no existe. Sidebar siempre full-width. Accent siempre amarillo.
- [ ] **#6**: backend con `CORS_ORIGIN=https://crmsv.reinarsa.com,http://localhost:3001` acepta requests de ambos; con `CORS_ORIGIN` vacío, server no arranca.
- [ ] `pnpm tsc --noEmit` limpio en ambos repos.
- [ ] `pnpm lint` sin errores nuevos.
- [ ] Comentarios "why" en español en decisiones no obvias.
- [ ] Sin clases vanilla CSS, sin valores Tailwind arbitrarios.
- [ ] Dark mode sigue funcionando (toggle persiste en `localStorage.reinar.ui`).
- [ ] EquiposList sigue funcionando con `useUiStore((s) => s.equiposView)` (sin `tweaks.`).
