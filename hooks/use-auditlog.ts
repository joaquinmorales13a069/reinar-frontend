'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { PaginatedResponse, AuditLog, FiltrosAuditLog } from '@/types/api';

export function useAuditLog(filtros: FiltrosAuditLog = {}) {
  return useQuery({
    queryKey: ['auditlog', filtros],
    queryFn: () =>
      api
        .get<PaginatedResponse<AuditLog>>('/auditlog', { params: filtros })
        .then((r) => {
          if (!r.data.success) {
            throw new Error('Respuesta inválida del servidor');
          }
          return { data: r.data.data, meta: r.data.meta };
        }),
  });
}
