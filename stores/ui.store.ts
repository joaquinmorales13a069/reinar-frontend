// 'use client' porque este módulo referencia localStorage y document.
// Next.js intentaría evaluarlo en el servidor durante el análisis estático,
// lo que causaría un crash porque esas APIs no existen en Node.
'use client';

import { create } from 'zustand';

export type Theme = 'light' | 'dark';
export type Density = 'comfortable' | 'compact';
export type SidebarMode = 'full' | 'mini';
export type Accent = 'yellow' | 'blue' | 'green' | 'red';
export type EquiposView = 'tabla' | 'grilla';

export type Tweaks = {
  theme: Theme;
  density: Density;
  sidebar: SidebarMode;
  accent: Accent;
  equiposView: EquiposView;
};

const STORAGE_KEY = 'reinar.tweaks';

const DEFAULTS: Tweaks = {
  theme: 'light',
  density: 'comfortable',
  sidebar: 'full',
  accent: 'yellow',
  equiposView: 'tabla',
};

// La paleta de acento replica el objeto ACCENT_COLORS del prototipo para que
// cambiar el acento produzca el mismo resultado visual que en el diseño de referencia.
const ACCENT_COLORS: Record<Accent, { main: string; dim: string; soft: string }> = {
  yellow: { main: '#F2C037', dim: '#D9A820', soft: '#FFF1C2' },
  blue:   { main: '#2F6CB7', dim: '#21528F', soft: '#DBE7F6' },
  green:  { main: '#2E8C5A', dim: '#226E47', soft: '#D6EBDF' },
  red:    { main: '#C23B3B', dim: '#9D2A2A', soft: '#F6D9D9' },
};

function loadTweaks(): Tweaks {
  // Guard de SSR: esta función puede ejecutarse en el servidor si el módulo se importa
  // en un contexto compartido; retornar DEFAULTS evita un ReferenceError en Node.
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    // Spread sobre DEFAULTS para que claves faltantes usen su valor por defecto
    // en vez de ser undefined (maneja guardados parciales y nuevas claves futuras).
    return { ...DEFAULTS, ...saved };
  } catch {
    return DEFAULTS;
  }
}

function applyTweaks(tweaks: Tweaks) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  // Usamos atributos data-* en vez de clases porque el CSS del prototipo usa selectores
  // de atributo ([data-theme="dark"]) — mantener este contrato evita reescribir los estilos.
  root.setAttribute('data-theme', tweaks.theme);
  root.setAttribute('data-density', tweaks.density);
  root.setAttribute('data-sidebar', tweaks.sidebar);
  // Sobreescribimos las custom properties de CSS directamente para que el color de
  // acento cascadee a todos los componentes sin que cada uno necesite conocer los acentos.
  const accent = ACCENT_COLORS[tweaks.accent] ?? ACCENT_COLORS.yellow;
  root.style.setProperty('--accent', accent.main);
  root.style.setProperty('--accent-dim', accent.dim);
  root.style.setProperty('--accent-soft', accent.soft);
}

type UiState = {
  tweaks: Tweaks;
  tweaksOpen: boolean;
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
  setTweaksOpen: (open: boolean) => void;
  hydrate: () => void;
};

export const useUiStore = create<UiState>()((set, get) => ({
  // El store se inicializa con DEFAULTS, no con localStorage, porque se crea al cargar
  // el módulo (potencialmente en SSR). hydrate() se llama en un useEffect del cliente
  // para leer los valores persistidos una vez que el navegador está disponible.
  tweaks: DEFAULTS,
  tweaksOpen: false,

  setTweak: (key, value) => {
    const next = { ...get().tweaks, [key]: value };
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    applyTweaks(next);
    set({ tweaks: next });
  },

  setTweaksOpen: (open) => set({ tweaksOpen: open }),

  hydrate: () => {
    const tweaks = loadTweaks();
    // Aplicamos al DOM de inmediato para evitar un flash de estilos por defecto en el primer render.
    applyTweaks(tweaks);
    set({ tweaks });
  },
}));
