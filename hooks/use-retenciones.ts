'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  PaginatedResponse,
  ComprobanteRetencion,
  ComprobanteRetencionListItem,
  FiltrosRetenciones,
  RegistrarRetencionDto,
} from '@/types/api';

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

// ─── Queries ─────────────────────────────────────────────────────────

export function useRetenciones(params: FiltrosRetenciones = {}) {
  return useQuery({
    queryKey: ['retenciones', params],
    queryFn: () =>
      api
        .get<PaginatedResponse<ComprobanteRetencionListItem>>('/retenciones', { params })
        .then((r) => r.data),
  });
}

export function useRetencion(id: string | null | undefined) {
  return useQuery({
    queryKey: ['retencion', id],
    queryFn: () =>
      api.get<ApiResponse<ComprobanteRetencion>>(`/retenciones/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────

export function useRegistrarRetencion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RegistrarRetencionDto) =>
      api.post<ApiResponse<ComprobanteRetencion>>('/retenciones', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (ret) => {
      qc.invalidateQueries({ queryKey: ['retenciones'] });
      // La retencion modifica saldoPendiente y posiblemente el estado de la factura.
      qc.invalidateQueries({ queryKey: ['factura', ret.facturaId] });
      qc.invalidateQueries({ queryKey: ['facturas'] });
      toast.success('Retención registrada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo registrar la retención.'));
    },
  });
}

export function useEliminarRetencion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; facturaId: string }) =>
      api.delete<ApiResponse<unknown>>(`/retenciones/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
      }),
    onSuccess: (_d, { facturaId }) => {
      qc.invalidateQueries({ queryKey: ['retenciones'] });
      // Eliminar restaura saldoPendiente y re-evalua estado.
      qc.invalidateQueries({ queryKey: ['factura', facturaId] });
      qc.invalidateQueries({ queryKey: ['facturas'] });
      toast.success('Retención eliminada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo eliminar la retención.'));
    },
  });
}

// ─── PDFs ────────────────────────────────────────────────────────────

export async function descargarRetencionPdf(id: string, numeroCR: string) {
  const toastId = toast.loading('Generando PDF…');
  try {
    const res = await api.get(`/retenciones/${id}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    // numeroCR puede traer caracteres no validos para filename; saneamos.
    const safe = numeroCR.replace(/[^a-zA-Z0-9._-]/g, '_');
    a.download = `CR-${safe}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.dismiss(toastId);
  } catch (err) {
    toast.dismiss(toastId);
    toast.error(extractErrorMessage(err, 'No se pudo descargar el PDF.'));
  }
}
