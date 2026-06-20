'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  PaginatedResponse,
  Proveedor,
  CrearProveedorDto,
  FiltrosProveedores,
} from '@/types/api';

// Mismo patrón que use-servicios.ts: helper duplicado intencionalmente.
function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

export function useProveedores(filtros: FiltrosProveedores = {}) {
  return useQuery({
    queryKey: ['proveedores', filtros],
    queryFn: () =>
      api
        .get<PaginatedResponse<Proveedor>>('/proveedores', { params: filtros })
        .then((r) => {
          if (!r.data.success) throw new Error('Respuesta inválida del servidor');
          return { data: r.data.data, meta: r.data.meta };
        }),
  });
}

export function useProveedor(id: string | null) {
  return useQuery({
    queryKey: ['proveedor', id],
    queryFn: () =>
      api.get<ApiResponse<Proveedor>>(`/proveedores/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

export function useCrearProveedor() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (data: CrearProveedorDto) =>
      api.post<ApiResponse<Proveedor>>('/proveedores', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (proveedor) => {
      qc.invalidateQueries({ queryKey: ['proveedores'] });
      toast.success('Proveedor creado.');
      router.push(`/proveedores/${proveedor.id}`);
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear el proveedor.'));
    },
  });
}

export function useEditarProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CrearProveedorDto }) =>
      api.put<ApiResponse<Proveedor>>(`/proveedores/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['proveedores'] });
      qc.invalidateQueries({ queryKey: ['proveedor', id] });
      toast.success('Cambios guardados.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudieron guardar los cambios.'));
    },
  });
}

export function useCambiarActivoProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      api
        .patch<ApiResponse<Proveedor>>(`/proveedores/${id}/activo`, { activo })
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (proveedor, { id }) => {
      qc.invalidateQueries({ queryKey: ['proveedores'] });
      qc.invalidateQueries({ queryKey: ['proveedor', id] });
      toast.success(proveedor.activo ? 'Proveedor activado.' : 'Proveedor desactivado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo cambiar el estado.'));
    },
  });
}
