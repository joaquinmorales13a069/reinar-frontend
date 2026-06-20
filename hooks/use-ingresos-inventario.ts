'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiResponse, PaginatedResponse, IngresoInventario } from '@/types/api';

type FiltrosIngresos = {
  page?: number;
  limit?: number;
  proveedorId?: string;
};

export function useIngresosInventario(filtros: FiltrosIngresos = {}) {
  return useQuery({
    queryKey: ['ingresos-inventario', filtros],
    queryFn: () =>
      api
        .get<PaginatedResponse<IngresoInventario>>('/ingresos-inventario', { params: filtros })
        .then((r) => {
          if (!r.data.success) throw new Error('Respuesta inválida del servidor');
          return { data: r.data.data, meta: r.data.meta };
        }),
  });
}

export function useIngresoInventario(id: string | null) {
  return useQuery({
    queryKey: ['ingreso-inventario', id],
    queryFn: () =>
      api.get<ApiResponse<IngresoInventario>>(`/ingresos-inventario/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}
