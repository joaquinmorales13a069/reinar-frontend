import { io } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth.store';

// El backend (src/lib/websocket.ts) autentica el socket leyendo
// socket.handshake.auth.token y verificandolo como access token JWT.
// La cookie HTTP-only NO se usa para el socket — solo para REST /auth/renovar-token.
//
// Usamos `auth` como funcion (no objeto) para que socket.io-client la invoque en
// cada (re)conexion: si el access token se renueva durante una desconexion+reconexion
// (e.g., wifi flap), la reconexion lleva el token vigente en vez de uno stale.
//
// withCredentials se mantiene true por si el backend en el futuro tambien lee
// la cookie como fallback; hoy es no-op pero no molesta.
export const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
  withCredentials: true,
  // autoConnect: false para conectar solo despues de que el usuario este autenticado;
  // conectar al cargar el modulo llegaria al servidor sin auth y seria rechazado.
  autoConnect: false,
  auth: (cb) => {
    cb({ token: useAuthStore.getState().accessToken });
  },
});
