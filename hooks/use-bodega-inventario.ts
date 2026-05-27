'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiResponse, InventarioBodega } from '@/types/api';

export function useBodegaInventario(bodegaId: string | null | undefined) {
  return useQuery({
    queryKey: ['bodega-inventario', bodegaId],
    queryFn: () =>
      api
        .get<ApiResponse<InventarioBodega>>(`/bodegas/${bodegaId}/inventario`)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    enabled: !!bodegaId,
  });
}
