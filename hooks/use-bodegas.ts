'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  Bodega,
  CrearBodegaDto,
  ActualizarBodegaDto,
  CrearZonaDto,
  ActualizarZonaDto,
} from '@/types/api';

// Helper duplicado intencionalmente para mantener cada archivo de hooks
// autocontenido, igual que en use-servicios.ts.
function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

// ─── Queries ─────────────────────────────────────────────────────────

export function useBodegas() {
  return useQuery({
    queryKey: ['bodegas'],
    queryFn: () =>
      api.get<ApiResponse<Bodega[]>>('/bodegas').then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
  });
}

export function useBodega(id: string) {
  return useQuery({
    queryKey: ['bodega', id],
    queryFn: () =>
      api.get<ApiResponse<Bodega>>(`/bodegas/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

// ─── Mutations: bodegas principales ──────────────────────────────────

export function useCrearBodega() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (data: CrearBodegaDto) =>
      api.post<ApiResponse<Bodega>>('/bodegas', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (bodega) => {
      qc.invalidateQueries({ queryKey: ['bodegas'] });
      toast.success('Bodega creada.');
      router.push(`/bodegas/${bodega.id}`);
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear la bodega.'));
    },
  });
}

export function useEditarBodega() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ActualizarBodegaDto }) =>
      api.put<ApiResponse<Bodega>>(`/bodegas/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['bodegas'] });
      qc.invalidateQueries({ queryKey: ['bodega', id] });
      toast.success('Cambios guardados.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudieron guardar los cambios.'));
    },
  });
}

export function useCambiarEstadoBodega() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activa }: { id: string; activa: boolean }) =>
      api.patch<ApiResponse<Bodega>>(`/bodegas/${id}/estado`, { activa }).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (bodega, { id }) => {
      qc.invalidateQueries({ queryKey: ['bodegas'] });
      qc.invalidateQueries({ queryKey: ['bodega', id] });
      toast.success(bodega.activa ? 'Bodega activada.' : 'Bodega desactivada.');
    },
    onError: (err) => {
      // El backend devuelve 409 con mensaje específico cuando hay zonas activas
      // o actas en vuelo. Propagamos el mensaje del backend tal cual.
      toast.error(extractErrorMessage(err, 'No se pudo cambiar el estado.'));
    },
  });
}

// ─── Mutations: zonas ────────────────────────────────────────────────

export function useCrearZona(bodegaId: string) {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (data: CrearZonaDto) =>
      api.post<ApiResponse<Bodega>>(`/bodegas/${bodegaId}/zonas`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bodegas'] });
      qc.invalidateQueries({ queryKey: ['bodega', bodegaId] });
      toast.success('Zona creada.');
      router.push(`/bodegas/${bodegaId}`);
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear la zona.'));
    },
  });
}

export function useEditarZona(bodegaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ zonaId, data }: { zonaId: string; data: ActualizarZonaDto }) =>
      api.put<ApiResponse<Bodega>>(`/bodegas/zonas/${zonaId}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bodega', bodegaId] });
      toast.success('Cambios guardados.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudieron guardar los cambios.'));
    },
  });
}

export function useCambiarEstadoZona(bodegaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ zonaId, activa }: { zonaId: string; activa: boolean }) =>
      api.patch<ApiResponse<Bodega>>(`/bodegas/zonas/${zonaId}/estado`, { activa }).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (zona) => {
      qc.invalidateQueries({ queryKey: ['bodega', bodegaId] });
      toast.success(zona.activa ? 'Zona activada.' : 'Zona desactivada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo cambiar el estado.'));
    },
  });
}
