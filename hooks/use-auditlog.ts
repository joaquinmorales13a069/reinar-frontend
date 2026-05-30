'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { PaginatedResponse, AuditLog, FiltrosAuditLog } from '@/types/api';

// El segundo parámetro `enabled` permite al caller bloquear la query cuando
// los filtros son inválidos cliente-side (ej: rango desde > hasta). Sin esto,
// el backend recibe queries inútiles que devuelven listas vacías o errores.
export function useAuditLog(filtros: FiltrosAuditLog = {}, enabled = true) {
  return useQuery({
    queryKey: ['auditlog', filtros],
    enabled,
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
