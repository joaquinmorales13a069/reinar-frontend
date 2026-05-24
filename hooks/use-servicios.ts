'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  PaginatedResponse,
  Servicio,
  CrearServicioDto,
  ActualizarServicioDto,
  FiltrosServicios,
} from '@/types/api';

// Mismo patrón que use-andamios.ts: helper duplicado intencionalmente para
// mantener cada archivo de hooks autocontenido (sin dependencia transitiva).
function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

// ─── Queries ─────────────────────────────────────────────────────────

export function useServicios(filtros: FiltrosServicios = {}) {
  return useQuery({
    queryKey: ['servicios', filtros],
    queryFn: () =>
      api
        .get<PaginatedResponse<Servicio>>('/servicios', { params: filtros })
        .then((r) => {
          if (!r.data.success) {
            // PaginatedResponse no modela el error: tras autenticación los 4xx van por
            // catch de axios. Este check es defensivo por consistencia con otros hooks.
            throw new Error('Respuesta inválida del servidor');
          }
          return { data: r.data.data, meta: r.data.meta };
        }),
  });
}

export function useServicio(id: string) {
  return useQuery({
    queryKey: ['servicio', id],
    queryFn: () =>
      api.get<ApiResponse<Servicio>>(`/servicios/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────

export function useCrearServicio() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (data: CrearServicioDto) =>
      api.post<ApiResponse<Servicio>>('/servicios', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (servicio) => {
      qc.invalidateQueries({ queryKey: ['servicios'] });
      toast.success('Servicio creado.');
      router.push(`/servicios/${servicio.id}`);
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear el servicio.'));
    },
  });
}

export function useEditarServicio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ActualizarServicioDto }) =>
      api.put<ApiResponse<Servicio>>(`/servicios/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['servicios'] });
      qc.invalidateQueries({ queryKey: ['servicio', id] });
      toast.success('Cambios guardados.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudieron guardar los cambios.'));
    },
  });
}

export function useCambiarEstadoServicio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      api
        .patch<ApiResponse<Servicio>>(`/servicios/${id}/estado`, { activo })
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (servicio, { id }) => {
      qc.invalidateQueries({ queryKey: ['servicios'] });
      qc.invalidateQueries({ queryKey: ['servicio', id] });
      toast.success(servicio.activo ? 'Servicio activado.' : 'Servicio desactivado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo cambiar el estado.'));
    },
  });
}
