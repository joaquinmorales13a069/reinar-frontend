'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import type {
  ApiResponse,
  Perfil,
  ActualizarPerfilDto,
  CambiarContrasenaDto,
} from '@/types/api';

// Mismo patrón que use-servicios.ts: helper duplicado intencionalmente para
// mantener cada archivo de hooks autocontenido.
function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

export function useMiPerfil() {
  return useQuery({
    queryKey: ['perfil'],
    queryFn: () =>
      api.get<ApiResponse<Perfil>>('/auth/perfil').then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
  });
}

export function useActualizarPerfil() {
  const qc = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (data: ActualizarPerfilDto) =>
      api.patch<ApiResponse<Perfil>>('/auth/perfil', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (perfil) => {
      qc.invalidateQueries({ queryKey: ['perfil'] });
      // setAuth además de invalidar: el topbar lee de useAuthStore.user, no de
      // la query ['perfil']. Sin esto, el avatar+nombre del header quedan stale
      // hasta el próximo refresh manual o renovación de token.
      if (accessToken) {
        setAuth(accessToken, {
          id: perfil.id,
          nombre: perfil.nombre,
          apellido: perfil.apellido,
          email: perfil.email,
          rol: perfil.rol,
        });
      }
      toast.success('Perfil actualizado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo guardar el perfil.'));
    },
  });
}

export function useCambiarContrasena() {
  return useMutation({
    mutationFn: (data: CambiarContrasenaDto) =>
      api.patch<ApiResponse<unknown>>('/auth/perfil/contrasena', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
      }),
    onSuccess: () => {
      toast.success('Contraseña actualizada.');
    },
    onError: (err) => {
      // El caller puede interceptar para mapear 401 "Contraseña actual incorrecta"
      // a setError('passwordActual'); si no, el toast genérico cubre el resto.
      toast.error(extractErrorMessage(err, 'No se pudo cambiar la contraseña.'));
    },
  });
}
