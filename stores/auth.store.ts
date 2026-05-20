import { create } from 'zustand';
import type { User } from '@/types/api';

type AuthState = {
  accessToken: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
};

// Sin middleware persist de forma intencional: el access token debe vivir solo en memoria.
// Guardarlo en localStorage lo expondría a cualquier JS de la página (riesgo XSS).
// El refresh token vive en una cookie HTTP-only que el navegador gestiona y JS no puede leer.
export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,
  setAuth: (token, user) => set({ accessToken: token, user }),
  // clearAuth se llama en logout y al fallar la renovación del token para forzar redirección al login.
  clearAuth: () => set({ accessToken: null, user: null }),
}));
