'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiResponse, PaginatedResponse, Contacto } from '@/types/api';

type ContactosParams = {
  clienteId?: string;
  page?: number;
  limit?: number;
  busqueda?: string;
  tipoContacto?: string | null;
  activo?: boolean | null;
};

export function useContactos(params: ContactosParams = {}) {
  return useQuery({
    queryKey: ['contactos', params],
    queryFn: () =>
      api.get<PaginatedResponse<Contacto>>('/contactos', { params }).then((r) => r.data),
  });
}

export function useContacto(id: string) {
  return useQuery({
    queryKey: ['contactos', id],
    queryFn: () =>
      api.get<ApiResponse<Contacto>>(`/contactos/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

export function useCrearContacto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Contacto, 'id'>) =>
      api.post<ApiResponse<Contacto>>('/contactos', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contactos'] });
    },
  });
}

export function useEditarContacto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Contacto> }) =>
      api.put<ApiResponse<Contacto>>(`/contactos/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['contactos'] });
      qc.invalidateQueries({ queryKey: ['contactos', id] });
    },
  });
}

export function useToggleActivoContacto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      api.patch<ApiResponse<Contacto>>(`/contactos/${id}/activo`, { activo }).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['contactos'] });
      qc.invalidateQueries({ queryKey: ['contactos', id] });
    },
  });
}
