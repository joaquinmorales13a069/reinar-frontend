'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  PaginatedResponse,
  Usuario,
  CrearUsuarioDto,
  ActualizarUsuarioDto,
  FiltrosUsuarios,
} from '@/types/api';

// Mismo patrón que use-servicios.ts: helper duplicado intencionalmente para
// mantener cada archivo de hooks autocontenido.
function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

// ─── Queries ─────────────────────────────────────────────────────────

export function useUsuarios(filtros: FiltrosUsuarios = {}) {
  return useQuery({
    queryKey: ['usuarios', filtros],
    queryFn: () =>
      api.get<PaginatedResponse<Usuario>>('/usuarios', { params: filtros }).then((r) => {
        if (!r.data.success) {
          throw new Error('Respuesta inválida del servidor');
        }
        return { data: r.data.data, meta: r.data.meta };
      }),
  });
}

export function useUsuario(id: string) {
  return useQuery({
    queryKey: ['usuario', id],
    queryFn: () =>
      api.get<ApiResponse<Usuario>>(`/usuarios/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────

export function useCrearUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CrearUsuarioDto) =>
      api.post<ApiResponse<Usuario>>('/usuarios', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success('Usuario creado.');
    },
    onError: (err) => {
      // El caller puede interceptar con trySetFieldErrorFromApi para
      // mapear 409 email-duplicado inline; si no, el toast genérico cubre el resto.
      toast.error(extractErrorMessage(err, 'No se pudo crear el usuario.'));
    },
  });
}

export function useActualizarUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ActualizarUsuarioDto }) =>
      api.put<ApiResponse<Usuario>>(`/usuarios/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      qc.invalidateQueries({ queryKey: ['usuario', id] });
      toast.success('Cambios guardados.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudieron guardar los cambios.'));
    },
  });
}

export function useCambiarEstadoUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      api.patch<ApiResponse<Usuario>>(`/usuarios/${id}/estado`, { activo }).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (usuario, { id }) => {
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      qc.invalidateQueries({ queryKey: ['usuario', id] });
      toast.success(usuario.activo ? 'Usuario activado.' : 'Usuario desactivado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo cambiar el estado.'));
    },
  });
}
