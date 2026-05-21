'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiResponse } from '@/types/api';
import type { DashboardKpis } from '@/types/dashboard';

export const DASHBOARD_KEY = ['dashboard', 'kpis'] as const;

export function useDashboardKpis() {
  return useQuery<DashboardKpis>({
    queryKey: DASHBOARD_KEY,
    queryFn: () =>
      api
        .get<ApiResponse<DashboardKpis>>('/dashboard/kpis')
        .then((r) => {
          const res = r.data;
          if (!res.success) throw new Error(res.error.message);
          return res.data;
        }),
    // El dashboard no necesita datos ultra-frescos; 2 minutos reduce carga al servidor
    staleTime: 2 * 60 * 1000,
  });
}
