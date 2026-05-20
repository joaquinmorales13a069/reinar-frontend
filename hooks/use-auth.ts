'use client';

import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { socket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth.store';
import type { ApiResponse, User } from '@/types/api';

// Convierte un error de Axios con cuerpo de respuesta en el ApiResponse del backend,
// para que los errores de negocio (401, 422…) lleguen como { success: false } al componente
// en vez de lanzar excepción — así onError solo se dispara en fallos de red reales.
function normalizeAxiosError<T>(err: unknown): ApiResponse<T> {
  if (axios.isAxiosError(err) && err.response?.data) {
    return err.response.data as ApiResponse<T>;
  }
  throw err;
}

// Payload del primer paso del login (credenciales)
type LoginPayload = { email: string; password: string };

// El backend tiene dos caminos en el paso 1:
// - Sin MFA configurado → devuelve tokens directamente (login completo)
// - Con MFA activo     → devuelve sessionToken para el segundo paso
type LoginStep1Response =
  | { mfaRequired: true; sessionToken: string }
  | { accessToken: string; refreshToken: string; user: User };

// Payload del segundo paso — campo `totpCode` según contrato del backend
type MfaPayload = { sessionToken: string; totpCode: string };

// Respuesta exitosa tras confirmar MFA — igual que el login directo sin MFA
type MfaResponse = { accessToken: string; refreshToken: string; user: User };

export function useLoginMutation() {
  return useMutation<ApiResponse<LoginStep1Response>, Error, LoginPayload>({
    mutationFn: (payload) =>
      api
        .post<ApiResponse<LoginStep1Response>>('/auth/iniciar-sesion', payload)
        .then((r) => r.data)
        .catch((err) => normalizeAxiosError<LoginStep1Response>(err)),
    onError: () => {
      // Solo llega aquí si no hubo respuesta del servidor (error de red puro)
      toast.error('No se pudo conectar con el servidor. Intenta de nuevo.');
    },
  });
}

export function useMfaMutation() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const router = useRouter();

  return useMutation<ApiResponse<MfaResponse>, Error, MfaPayload>({
    mutationFn: ({ sessionToken, totpCode }) =>
      api
        .post<ApiResponse<MfaResponse>>('/auth/mfa/confirmar', { sessionToken, totpCode })
        .then((r) => r.data)
        .catch((err) => normalizeAxiosError<MfaResponse>(err)),
    onSuccess: (res) => {
      if (!res.success) return;
      // Guardar token en memoria (no localStorage) — decisión de seguridad XSS
      setAuth(res.data.accessToken, res.data.user);
      // Conectar socket solo después de autenticarse para no exponer eventos anónimos
      socket.connect();
      toast.success(`Bienvenido, ${res.data.user.nombre}.`);
      router.replace('/dashboard');
    },
    onError: () => {
      // Solo llega aquí en error de red — código incorrecto lo maneja el formulario inline
      toast.error('No se pudo verificar el código. Intenta de nuevo.');
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
