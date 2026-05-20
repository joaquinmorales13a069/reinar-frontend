import { io } from 'socket.io-client';

export const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
  // withCredentials incluye la cookie HTTP-only del refresh token en el handshake
  // del socket; el servidor la usa para autenticar la conexión WebSocket.
  withCredentials: true,
  // autoConnect: false para conectar solo después de que el usuario esté autenticado;
  // conectar al cargar el módulo llegaría al servidor sin auth y sería rechazado.
  autoConnect: false,
});
