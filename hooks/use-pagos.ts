'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import type { ApiResponse, Pago, CrearPagoDto } from '@/types/api';

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

export function useListarPagos(facturaId: string | null | undefined) {
  return useQuery({
    queryKey: ['pagos', facturaId],
    queryFn: () =>
      api
        .get<ApiResponse<Pago[]>>(`/facturas/${facturaId}/pagos`)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    enabled: !!facturaId,
  });
}

export function useCrearPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ facturaId, data }: { facturaId: string; data: CrearPagoDto }) =>
      api
        .post<ApiResponse<Pago>>(`/facturas/${facturaId}/pagos`, data)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (_pago, { facturaId }) => {
      qc.invalidateQueries({ queryKey: ['pagos', facturaId] });
      // Invalidar la factura porque el backend recalcula montoPagado,
      // saldoPendiente y estado tras crear un pago.
      qc.invalidateQueries({ queryKey: ['factura', facturaId] });
      qc.invalidateQueries({ queryKey: ['facturas'] });
      toast.success('Pago registrado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo registrar el pago.'));
    },
  });
}

export function useEliminarPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ facturaId, pagoId }: { facturaId: string; pagoId: string }) =>
      api
        .delete<ApiResponse<unknown>>(`/facturas/${facturaId}/pagos/${pagoId}`)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
        }),
    onSuccess: (_d, { facturaId }) => {
      qc.invalidateQueries({ queryKey: ['pagos', facturaId] });
      qc.invalidateQueries({ queryKey: ['factura', facturaId] });
      qc.invalidateQueries({ queryKey: ['facturas'] });
      toast.success('Pago eliminado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo eliminar el pago.'));
    },
  });
}
