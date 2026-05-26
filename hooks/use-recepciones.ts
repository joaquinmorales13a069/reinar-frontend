'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { descargarPdf } from '@/lib/download-pdf';
import type {
  ApiResponse,
  PaginatedResponse,
  Recepcion,
  RecepcionListItem,
  GrupoPendienteDevolucion,
  FiltrosRecepciones,
  CrearRecepcionDto,
} from '@/types/api';

function extractErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: { message?: string } } } };
  return e?.response?.data?.error?.message ?? fallback;
}

export function useRecepciones(params: FiltrosRecepciones = {}) {
  return useQuery({
    queryKey: ['recepciones', params],
    queryFn: () =>
      api.get<PaginatedResponse<RecepcionListItem>>('/recepciones', { params }).then((r) => r.data),
  });
}

export function useRecepcionesDeFactura(facturaId: string | null | undefined, params: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['recepciones-de-factura', facturaId, params],
    queryFn: () =>
      api.get<PaginatedResponse<RecepcionListItem>>(`/facturas/${facturaId}/recepciones`, { params }).then((r) => r.data),
    enabled: !!facturaId,
  });
}

export function useRecepcion(id: string | null | undefined) {
  return useQuery({
    queryKey: ['recepcion', id],
    queryFn: () =>
      api.get<ApiResponse<Recepcion>>(`/recepciones/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

export function useItemsPendientesDevolucion(facturaId: string | null | undefined) {
  return useQuery({
    queryKey: ['items-pendientes-devolucion', facturaId],
    queryFn: () =>
      api.get<ApiResponse<GrupoPendienteDevolucion[]>>(`/facturas/${facturaId}/actas/items-pendientes-devolucion`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!facturaId,
  });
}

export function useCrearRecepcion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ facturaId, data }: { facturaId: string; data: CrearRecepcionDto }) =>
      api.post<ApiResponse<Recepcion>>(`/facturas/${facturaId}/recepciones`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (recepcion, { facturaId }) => {
      qc.invalidateQueries({ queryKey: ['recepciones'] });
      qc.invalidateQueries({ queryKey: ['recepciones-de-factura', facturaId] });
      qc.invalidateQueries({ queryKey: ['items-pendientes-devolucion', facturaId] });
      // 'acta' sin id invalida todas las queries con prefix ['acta', ...] — necesario
      // porque la recepción puede haber cerrado ítems de varias actas distintas.
      qc.invalidateQueries({ queryKey: ['acta'] });
      qc.invalidateQueries({ queryKey: ['actas'] });
      qc.invalidateQueries({ queryKey: ['equipos'] });
      toast.success(`Recepción ${recepcion.numeroActa} registrada.`);
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo registrar la recepción.'));
    },
  });
}

export function useDescargarRecepcionPdf() {
  const [isLoading, setIsLoading] = useState(false);
  return {
    isLoading,
    descargar: (id: string, numeroActa: string) =>
      descargarPdf({
        url: `/recepciones/${id}/pdf`,
        filename: `${numeroActa}.pdf`,
        onStart: () => setIsLoading(true),
        onEnd: () => setIsLoading(false),
      }),
  };
}
