'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import type { ApiResponse, DepositoGarantia } from '@/types/api';

// Helper duplicado intencionalmente — mismo patron que use-facturas.ts.
function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

const qkDeposito = (cotizacionId: string) => ['deposito', cotizacionId] as const;

export function useDeposito(cotizacionId: string, enabled = true) {
  return useQuery({
    queryKey: qkDeposito(cotizacionId),
    queryFn: () =>
      api
        .get<ApiResponse<DepositoGarantia | null>>(
          `/cotizaciones/${cotizacionId}/deposito`,
        )
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    enabled: enabled && !!cotizacionId,
  });
}

export function useRecibirDeposito(cotizacionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api
        .post<ApiResponse<DepositoGarantia>>(
          `/cotizaciones/${cotizacionId}/deposito/recibir`,
        )
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: () => {
      toast.success('Depósito marcado como recibido.');
      qc.invalidateQueries({ queryKey: qkDeposito(cotizacionId) });
      qc.invalidateQueries({ queryKey: ['cotizaciones', cotizacionId] });
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo recibir el depósito.'));
    },
  });
}

// Discriminada por `tipo` — el backend valida la combinacion y rechaza
// montoRetenido/razonRetencion inconsistentes.
export type DevolverDepositoInput =
  | { tipo: 'TOTAL' }
  | { tipo: 'RETENER_TOTAL'; razonRetencion: string }
  | { tipo: 'PARCIAL'; montoRetenido: number; razonRetencion: string };

export function useDevolverDeposito(cotizacionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DevolverDepositoInput) =>
      api
        .post<ApiResponse<DepositoGarantia>>(
          `/cotizaciones/${cotizacionId}/deposito/devolver`,
          input,
        )
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: () => {
      toast.success('Depósito actualizado.');
      qc.invalidateQueries({ queryKey: qkDeposito(cotizacionId) });
      qc.invalidateQueries({ queryKey: ['cotizaciones', cotizacionId] });
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo devolver el depósito.'));
    },
  });
}
