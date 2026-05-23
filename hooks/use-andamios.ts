'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  PiezaTipo,
  CuerpoTipo,
  CrearPiezaTipoDto,
  ActualizarPiezaTipoDto,
  AjusteStockPiezaDto,
  CrearCuerpoTipoDto,
  ActualizarCuerpoTipoDto,
  ExpandirCuerpoDto,
  ExpandirCuerpoItem,
  FiltrosPiezas,
  FiltrosCuerpos,
} from '@/types/api';

// Mismo patrón que use-herramientas.ts: helper duplicado intencionalmente para
// mantener cada archivo de hooks autocontenido (sin dependencia transitiva).
function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

// ─── Queries ─────────────────────────────────────────────────────────

export function usePiezas(filtros: FiltrosPiezas = {}) {
  return useQuery({
    queryKey: ['andamios', 'piezas', filtros],
    queryFn: () =>
      api
        .get<ApiResponse<PiezaTipo[]>>('/andamios/piezas', { params: filtros })
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
  });
}

export function usePieza(id: string) {
  return useQuery({
    queryKey: ['andamios', 'piezas', id],
    queryFn: () =>
      api.get<ApiResponse<PiezaTipo>>(`/andamios/piezas/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

export function useCuerpos(filtros: FiltrosCuerpos = {}) {
  return useQuery({
    queryKey: ['andamios', 'cuerpos', filtros],
    queryFn: () =>
      api
        .get<ApiResponse<CuerpoTipo[]>>('/andamios/cuerpos', { params: filtros })
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
  });
}

export function useCuerpo(id: string) {
  return useQuery({
    queryKey: ['andamios', 'cuerpos', id],
    queryFn: () =>
      api.get<ApiResponse<CuerpoTipo>>(`/andamios/cuerpos/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}
