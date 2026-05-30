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
