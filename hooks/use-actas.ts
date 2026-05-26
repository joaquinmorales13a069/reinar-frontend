'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { descargarPdf } from '@/lib/download-pdf';
import type {
  ApiResponse,
  PaginatedResponse,
  Acta,
  ActaListItem,
  ItemDisponibleDespacho,
  FiltrosActas,
  CrearActaDto,
  EditarActaDto,
  DespacharActaDto,
  EntregarActaDto,
} from '@/types/api';

// Backend devuelve { error: { code, message, details?: Array<{field, message}> } }
// (la convención del middleware validate del server). Concatenamos los details
// al toast para que un fallo de schema te diga qué campo falló, no solo
// "Datos inválidos".
function extractErrorMessage(err: unknown, fallback: string): string {
  const e = err as {
    response?: {
      data?: {
        error?: {
          message?: string;
          details?: Array<{ field?: string; message?: string }>;
        };
      };
    };
  };
  const top = e?.response?.data?.error?.message;
  const details = e?.response?.data?.error?.details;
  if (Array.isArray(details) && details.length > 0) {
    const lineas = details
      .map((d) => (d.field ? `${d.field}: ${d.message}` : d.message))
      .filter(Boolean)
      .join(' · ');
    return top ? `${top} (${lineas})` : lineas;
  }
  return top ?? fallback;
}

// ─── Queries ─────────────────────────────────────────────────────────

export function useActas(params: FiltrosActas = {}) {
  return useQuery({
    queryKey: ['actas', params],
    queryFn: () =>
      api.get<PaginatedResponse<ActaListItem>>('/actas', { params }).then((r) => r.data),
  });
}

export function useActasDeFactura(facturaId: string | null | undefined, params: { page?: number; limit?: number; estado?: string } = {}) {
  return useQuery({
    queryKey: ['actas-de-factura', facturaId, params],
    queryFn: () =>
      api.get<PaginatedResponse<ActaListItem>>(`/facturas/${facturaId}/actas`, { params }).then((r) => r.data),
    enabled: !!facturaId,
  });
}

export function useActa(id: string | null | undefined) {
  return useQuery({
    queryKey: ['acta', id],
    queryFn: () =>
      api.get<ApiResponse<Acta>>(`/actas/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

export function useItemsDisponiblesDespacho(facturaId: string | null | undefined) {
  return useQuery({
    queryKey: ['items-disponibles-despacho', facturaId],
    queryFn: () =>
      api.get<ApiResponse<ItemDisponibleDespacho[]>>(`/facturas/${facturaId}/actas/items-disponibles-despacho`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!facturaId,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────

export function useCrearActa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ facturaId, data }: { facturaId: string; data: CrearActaDto }) =>
      api.post<ApiResponse<Acta>>(`/facturas/${facturaId}/actas`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (acta, { facturaId }) => {
      qc.invalidateQueries({ queryKey: ['actas'] });
      qc.invalidateQueries({ queryKey: ['actas-de-factura', facturaId] });
      qc.invalidateQueries({ queryKey: ['items-disponibles-despacho', facturaId] });
      qc.invalidateQueries({ queryKey: ['factura', facturaId] });
      toast.success(`Acta ${acta.numeroActa} creada.`);
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear el acta.'));
    },
  });
}

export function useEditarActa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditarActaDto }) =>
      api.patch<ApiResponse<Acta>>(`/actas/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (acta) => {
      qc.setQueryData(['acta', acta.id], acta);
      qc.invalidateQueries({ queryKey: ['actas'] });
      toast.success('Cambios guardados.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo actualizar el acta.'));
    },
  });
}

export function useCambiarEstadoActa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DespacharActaDto | EntregarActaDto }) =>
      api.patch<ApiResponse<null>>(`/actas/${id}/estado`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_data, { id, data }) => {
      qc.invalidateQueries({ queryKey: ['acta', id] });
      qc.invalidateQueries({ queryKey: ['actas'] });
      qc.invalidateQueries({ queryKey: ['actas-de-factura'] });
      if (data.estado === 'ENTREGADO') {
        qc.invalidateQueries({ queryKey: ['items-pendientes-devolucion'] });
      }
      toast.success(data.estado === 'DESPACHADO' ? 'Despacho registrado.' : 'Entrega confirmada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo cambiar el estado del acta.'));
    },
  });
}

// ─── PDFs ────────────────────────────────────────────────────────────

export function useDescargarActaPdf() {
  const [isLoading, setIsLoading] = useState(false);
  return {
    isLoading,
    descargar: (id: string, numeroActa: string) =>
      descargarPdf({
        url: `/actas/${id}/pdf`,
        filename: `${numeroActa}.pdf`,
        onStart: () => setIsLoading(true),
        onEnd: () => setIsLoading(false),
      }),
  };
}

export function useDescargarPickingPdf() {
  const [isLoading, setIsLoading] = useState(false);
  return {
    isLoading,
    descargar: (id: string, numeroActa: string) =>
      descargarPdf({
        url: `/actas/${id}/pdf/picking`,
        filename: `${numeroActa}-picking.pdf`,
        onStart: () => setIsLoading(true),
        onEnd: () => setIsLoading(false),
      }),
  };
}
