'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';
import { socket } from '@/lib/socket';
import type { ApiResponse } from '@/types/api';
import type { User } from '@/types/api';

type RenovarTokenData = { accessToken: string; user?: User };

// Repobla el store de auth tras un reload de página.
// El accessToken vive solo en memoria (Zustand sin persist) y se pierde en cada recarga;
// la cookie HTTP-only del refresh token sigue activa, así que podemos renovar la sesión
// silenciosamente sin pedir credenciales al usuario.
export function AuthHydrator() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const router = useRouter();

  useEffect(() => {
    // Leemos el estado en el momento del efecto para no añadir `user` como dep
    // (añadirlo causaría re-ejecuciones innecesarias cada vez que setAuth actualiza el store).
    if (useAuthStore.getState().user) return;

    axios
      .post<ApiResponse<RenovarTokenData>>(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/renovar-token`,
        {},
        { withCredentials: true },
      )
      .then(({ data }) => {
        if (data.success && data.data.user) {
          setAuth(data.data.accessToken, data.data.user);
          // Conectar socket tras refresh tipico de F5: sin esto el usuario
          // re-hidratado pierde notificaciones en tiempo real hasta el proximo
          // login completo. socket.connect es idempotente cuando ya esta connected.
          if (!socket.connected) socket.connect();
        }
        // Si el backend devuelve solo el token sin `user`, las llamadas API
        // funcionarán (el interceptor usará el token), pero el saludo mostrará "—".
        // Incluir `user` en la respuesta de renovar-token en el backend lo resuelve.
      })
      .catch(() => {
        // Cookie expirada o inválida — sesión irrecuperable; forzar re-login.
        clearAuth();
        router.replace('/login');
      });
  }, [setAuth, clearAuth, router]);

  return null;
}
