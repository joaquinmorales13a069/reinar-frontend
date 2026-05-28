'use client';

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  PaginatedResponse,
  NotaCredito,
  NotaCreditoListItem,
  FiltrosNotasCredito,
  CrearNotaCreditoDto,
  EmitirDTENotaCreditoDto,
} from '@/types/api';

// Duplicado intencional con use-facturas.ts: el patron es lo suficientemente
// pequenno como para que abstraerlo cueste mas que el copy.
function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

// ─── Queries ─────────────────────────────────────────────────────────

export function useNotasCredito(params: FiltrosNotasCredito = {}) {
  return useQuery({
    queryKey: ['notas-credito', params],
    queryFn: () =>
      api
        .get<PaginatedResponse<NotaCreditoListItem>>('/notas-credito', { params })
        .then((r) => r.data),
  });
}

export function useNotaCredito(id: string | null | undefined) {
  return useQuery({
    queryKey: ['nota-credito', id],
    queryFn: () =>
      api.get<ApiResponse<NotaCredito>>(`/notas-credito/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────

export function useCrearNotaCredito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CrearNotaCreditoDto) =>
      api.post<ApiResponse<NotaCredito>>('/notas-credito', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (nc) => {
      qc.invalidateQueries({ queryKey: ['notas-credito'] });
      // Invalidamos factura porque crear NC modifica saldoPendiente y estado.
      qc.invalidateQueries({ queryKey: ['factura', nc.facturaId] });
      qc.invalidateQueries({ queryKey: ['facturas'] });
      toast.success('Nota de crédito creada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear la nota de crédito.'));
    },
  });
}

export function useEmitirDTENotaCredito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: EmitirDTENotaCreditoDto }) =>
      api.patch<ApiResponse<unknown>>(`/notas-credito/${id}/dte`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ['nota-credito', id] });
      qc.invalidateQueries({ queryKey: ['notas-credito'] });
      toast.success('DTE enviado al Ministerio de Hacienda.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo emitir el DTE.'));
    },
  });
}

export function useAnularDTENotaCredito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<ApiResponse<unknown>>(`/notas-credito/${id}/dte`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
      }),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['nota-credito', id] });
      qc.invalidateQueries({ queryKey: ['notas-credito'] });
      toast.success('DTE anulado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo anular el DTE.'));
    },
  });
}

// El backend NO expone endpoint sincronizar para NC (solo facturas). El cron
// job sincronizarEstadosDTEs corre cada 5 min y actualiza los estados.
// "Sincronizar" en la UI = invalidar la query para refetch del estado real.
export function sincronizarNotaCredito(qc: QueryClient, id: string) {
  qc.invalidateQueries({ queryKey: ['nota-credito', id] });
  toast.success('Estado actualizado.');
}

// ─── PDFs ────────────────────────────────────────────────────────────

export async function descargarNotaCreditoPdfBranded(id: string, numero: string) {
  const toastId = toast.loading('Generando PDF…');
  try {
    const res = await api.get(`/notas-credito/${id}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${numero}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.dismiss(toastId);
  } catch (err) {
    toast.dismiss(toastId);
    toast.error(extractErrorMessage(err, 'No se pudo descargar el PDF.'));
  }
}

export async function descargarNotaCreditoPdfOficialDTE(id: string, numero: string) {
  const toastId = toast.loading('Generando PDF oficial DTE…');
  try {
    const res = await api.get(`/notas-credito/${id}/dte/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${numero}-DTE.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.dismiss(toastId);
  } catch (err) {
    toast.dismiss(toastId);
    toast.error(extractErrorMessage(err, 'No se pudo descargar el PDF oficial.'));
  }
}
