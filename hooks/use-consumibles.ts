'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  PaginatedResponse,
  Consumible,
  CrearConsumibleDto,
  ActualizarConsumibleDto,
  FiltrosConsumibles,
  AjusteStockDto,
} from '@/types/api';

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

export function useConsumibles(params: FiltrosConsumibles = {}) {
  return useQuery({
    queryKey: ['consumibles', params],
    queryFn: () =>
      api
        .get<PaginatedResponse<Consumible>>('/consumibles', { params })
        .then((r) => r.data),
  });
}

export function useConsumible(id: string) {
  return useQuery({
    queryKey: ['consumibles', id],
    queryFn: () =>
      api.get<ApiResponse<Consumible>>(`/consumibles/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

export function useCrearConsumible() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CrearConsumibleDto) =>
      api.post<ApiResponse<Consumible>>('/consumibles', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consumibles'] });
      toast.success('Consumible creado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear el consumible.'));
    },
  });
}

export function useEditarConsumible() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ActualizarConsumibleDto }) =>
      api.put<ApiResponse<Consumible>>(`/consumibles/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['consumibles'] });
      qc.invalidateQueries({ queryKey: ['consumibles', id] });
      toast.success('Cambios guardados.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudieron guardar los cambios.'));
    },
  });
}

export function useAjustarStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AjusteStockDto }) =>
      api
        .patch<ApiResponse<Consumible>>(`/consumibles/${id}/stock`, data)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['consumibles'] });
      qc.invalidateQueries({ queryKey: ['consumibles', id] });
      toast.success('Stock ajustado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo ajustar el stock.'));
    },
  });
}

export function useDesactivarConsumible() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch<ApiResponse<Consumible>>(`/consumibles/${id}/activo`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (consumible, id) => {
      qc.invalidateQueries({ queryKey: ['consumibles'] });
      qc.invalidateQueries({ queryKey: ['consumibles', id] });
      toast.success(consumible.activo ? 'Consumible activado.' : 'Consumible desactivado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo cambiar el estado.'));
    },
  });
}
