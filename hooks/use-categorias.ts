'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import type { ApiResponse, Categoria, TipoCategoria } from '@/types/api';

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

export function useCategorias(tipo: TipoCategoria, incluirInactivas = false) {
  return useQuery({
    queryKey: ['categorias', tipo, incluirInactivas],
    queryFn: () =>
      api
        .get<ApiResponse<Categoria[]>>('/categorias', { params: { tipo, incluirInactivas } })
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
  });
}

export function useCrearCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { tipo: TipoCategoria; nombre: string; orden?: number }) =>
      api.post<ApiResponse<Categoria>>('/categorias', body).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categorias'] });
      toast.success('Categoría creada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear la categoría.'));
    },
  });
}

export function useEditarCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data: body }: { id: string; data: { nombre?: string; orden?: number } }) =>
      api.patch<ApiResponse<Categoria>>(`/categorias/${id}`, body).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categorias'] });
      toast.success('Categoría actualizada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo actualizar la categoría.'));
    },
  });
}

export function useDesactivarCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<ApiResponse<Categoria>>(`/categorias/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categorias'] });
      toast.success('Categoría desactivada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo desactivar la categoría.'));
    },
  });
}
