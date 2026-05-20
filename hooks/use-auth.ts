'use client';

import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { socket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth.store';
import type { ApiResponse, User } from '@/types/api';

// Payload del primer paso del login (credenciales)
type LoginPayload = { email: string; password: string };

// El backend devuelve un token temporal que identifica la sesión MFA pendiente;
// nunca es un access token completo — solo sirve para el segundo paso.
type LoginStep1Response = { mfaToken: string; nombre: string };

// Payload del segundo paso (código TOTP de 6 dígitos)
type MfaPayload = { mfaToken: string; codigo: string };

// Respuesta exitosa tras confirmar MFA — a partir de aquí el usuario está autenticado.
type MfaResponse = { accessToken: string; usuario: User };

export function useLoginMutation() {
  return useMutation<ApiResponse<LoginStep1Response>, Error, LoginPayload>({
    mutationFn: (payload) =>
      api.post<ApiResponse<LoginStep1Response>>('/auth/iniciar-sesion', payload).then((r) => r.data),
    onError: () => {
      toast.error('No se pudo conectar con el servidor. Intenta de nuevo.');
    },
  });
}

export function useMfaMutation() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const router = useRouter();

  return useMutation<ApiResponse<MfaResponse>, Error, MfaPayload>({
    mutationFn: (payload) =>
      api.post<ApiResponse<MfaResponse>>('/auth/mfa/confirmar', payload).then((r) => r.data),
    onSuccess: (res) => {
      if (!res.success) return;
      // Guardar token en memoria (no localStorage) — decisión de seguridad XSS
      setAuth(res.data.accessToken, res.data.usuario);
      // Conectar socket solo después de autenticarse para no exponer eventos anónimos
      socket.connect();
      toast.success(`Bienvenido, ${res.data.usuario.nombre.split(' ')[0]}.`);
      router.replace('/dashboard');
    },
    onError: () => {
      toast.error('Código incorrecto o sesión expirada. Intentá de nuevo.');
    },
  });
}

export function useLogoutMutation() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const router = useRouter();

  return useMutation<void, Error>({
    mutationFn: () =>
      // El backend invalida la cookie HTTP-only del refresh token en el servidor
      api.post('/auth/cerrar-sesion').then(() => undefined),
    onSettled: () => {
      // onSettled en vez de onSuccess: limpiar siempre aunque falle la petición de cierre
      socket.disconnect();
      clearAuth();
      router.replace('/login');
    },
  });
}
