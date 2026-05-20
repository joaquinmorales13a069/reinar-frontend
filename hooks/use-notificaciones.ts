'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiResponse, PaginatedResponse, Notificacion } from '@/types/api';

// Clave estable para poder invalidar desde cualquier parte sin importar la forma del objeto
const NOTIF_KEY = ['notificaciones'] as const;

export function useNotificaciones() {
  return useQuery<PaginatedResponse<Notificacion>>({
    queryKey: NOTIF_KEY,
    queryFn: () =>
      api.get<PaginatedResponse<Notificacion>>('/notificaciones').then((r) => r.data),
    // Las notificaciones pueden cambiar frecuentemente; staleTime corto para refrescar pronto
    staleTime: 10_000,
  });
}

export function useMarcarLeida() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<null>, Error, string>({
    mutationFn: (id) =>
      api.patch<ApiResponse<null>>(`/notificaciones/${id}/leer`).then((r) => r.data),
    onSuccess: (_, id) => {
      // Actualización optimista en caché: evita un refetch completo por un campo booleano
      qc.setQueryData<PaginatedResponse<Notificacion>>(NOTIF_KEY, (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((n) => (n.id === id ? { ...n, leida: true } : n)),
        };
      });
    },
  });
}

export function useMarcarTodasLeidas() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<null>, Error, void>({
    mutationFn: () =>
      api.post<ApiResponse<null>>('/notificaciones/leer-todas').then((r) => r.data),
    onSuccess: () => {
      // Invalidar en vez de actualizar manualmente — más simple cuando son todas
      qc.invalidateQueries({ queryKey: NOTIF_KEY });
    },
  });
}
