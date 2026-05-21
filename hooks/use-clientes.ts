'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiResponse, PaginatedResponse, Cliente } from '@/types/api';

type ClientesParams = {
  page?: number;
  limit?: number;
  busqueda?: string;
  tipo?: 'EMPRESA' | 'PARTICULAR' | null;
  estado?: 'ACTIVO' | 'INACTIVO' | 'PROSPECTO' | null;
  sector?: string | null;
  activo?: boolean;
};

export function useClientes(params: ClientesParams = {}) {
  return useQuery({
    queryKey: ['clientes', params],
    queryFn: () =>
      api.get<PaginatedResponse<Cliente>>('/clientes', { params }).then((r) => r.data),
  });
}

export function useCliente(id: string) {
  return useQuery({
    queryKey: ['clientes', id],
    queryFn: () =>
      api.get<ApiResponse<Cliente>>(`/clientes/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

export function useCrearCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Cliente, 'id'>) =>
      api.post<ApiResponse<Cliente>>('/clientes', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
    },
  });
}

export function useEditarCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Cliente> }) =>
      api.put<ApiResponse<Cliente>>(`/clientes/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      qc.invalidateQueries({ queryKey: ['clientes', id] });
    },
  });
}

export function useCambiarEstadoCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: 'ACTIVO' | 'INACTIVO' | 'PROSPECTO' }) =>
      api.patch<ApiResponse<Cliente>>(`/clientes/${id}/estado`, { estado }).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      qc.invalidateQueries({ queryKey: ['clientes', id] });
    },
  });
}
