'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  PaginatedResponse,
  Cotizacion,
  CotizacionListItem,
  CotizacionItem,
  CrearCotizacionDto,
  ActualizarCotizacionDto,
  AgregarItemDto,
  EditarItemDto,
  EstadoCotizacion,
  FiltrosCotizaciones,
} from '@/types/api';

// Helper duplicado intencionalmente — mismo patrón que use-proyectos.ts, etc.
function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

// ─── Queries ─────────────────────────────────────────────────────────

export function useCotizaciones(params: FiltrosCotizaciones = {}) {
  return useQuery({
    queryKey: ['cotizaciones', params],
    queryFn: () =>
      api
        .get<PaginatedResponse<CotizacionListItem>>('/cotizaciones', { params })
        .then((r) => r.data),
  });
}

export function useCotizacion(id: string | null | undefined) {
  return useQuery({
    queryKey: ['cotizacion', id],
    queryFn: () =>
      api.get<ApiResponse<Cotizacion>>(`/cotizaciones/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

// ─── Mutations: cotización ──────────────────────────────────────────

export function useCrearCotizacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CrearCotizacionDto) =>
      api.post<ApiResponse<Cotizacion>>('/cotizaciones', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cotizaciones'] });
      toast.success('Borrador creado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear la cotización.'));
    },
  });
}

export function useActualizarCotizacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ActualizarCotizacionDto }) =>
      api.put<ApiResponse<Cotizacion>>(`/cotizaciones/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (cot) => {
      qc.invalidateQueries({ queryKey: ['cotizacion', cot.id] });
      qc.invalidateQueries({ queryKey: ['cotizaciones'] });
      toast.success('Cambios guardados.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudieron guardar los cambios.'));
    },
  });
}

export function useCambiarEstadoCotizacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoCotizacion }) =>
      api
        .patch<ApiResponse<unknown>>(`/cotizaciones/${id}/estado`, { estado })
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (_data, { id, estado }) => {
      qc.invalidateQueries({ queryKey: ['cotizacion', id] });
      qc.invalidateQueries({ queryKey: ['cotizaciones'] });
      // Aprobar genera factura y rentea equipos/herramientas/stock — refrescar todo
      // lo que la UI podría estar mostrando en otro tab abierto.
      if (estado === 'APROBADA') {
        qc.invalidateQueries({ queryKey: ['equipos'] });
        qc.invalidateQueries({ queryKey: ['facturas'] });
        qc.invalidateQueries({ queryKey: ['consumibles'] });
        qc.invalidateQueries({ queryKey: ['piezas'] });
      }
      const msg =
        estado === 'ENVIADA'
          ? 'Cotización enviada.'
          : estado === 'APROBADA'
            ? 'Cotización aprobada. Factura generada.'
            : 'Cotización rechazada.';
      toast.success(msg);
    },
    onError: (err) => {
      // El backend devuelve 409 CONFLICTO_APROBACION (equipos ya tomados),
      // CONSUMIBLE_SIN_STOCK o ANDAMIO_SIN_STOCK con mensaje legible — propagarlo.
      toast.error(extractErrorMessage(err, 'No se pudo cambiar el estado.'));
    },
  });
}

export function useEliminarCotizacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<ApiResponse<unknown>>(`/cotizaciones/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cotizaciones'] });
      qc.invalidateQueries({ queryKey: ['equipos'] });
      toast.success('Borrador eliminado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo eliminar.'));
    },
  });
}

// ─── Mutations: items ───────────────────────────────────────────────

export function useAgregarItemCotizacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AgregarItemDto }) =>
      api
        .post<ApiResponse<CotizacionItem>>(`/cotizaciones/${id}/items`, data)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (_item, { id, data }) => {
      qc.invalidateQueries({ queryKey: ['cotizacion', id] });
      // Si el item afecta inventario reservado, refresca los listados relevantes
      // para que otros tabs del usuario reflejen la nueva disponibilidad.
      if (data.tipo === 'EQUIPO') qc.invalidateQueries({ queryKey: ['equipos'] });
      if (data.tipo === 'HERRAMIENTA') qc.invalidateQueries({ queryKey: ['herramientas'] });
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo agregar el ítem.'));
    },
  });
}

export function useEditarItemCotizacion() {
  const qc = useQueryClient();
  return useMutation({
    // El backend devuelve la cotización completa (no solo el item editado) para
    // que el frontend pueda hidratar el cache con un solo round-trip. Antes
    // invalidábamos y eso disparaba un GET extra por cada edit inline, lo que
    // hacía sentir la sección de ítems lenta.
    mutationFn: ({
      cotizacionId,
      itemId,
      data,
    }: {
      cotizacionId: string;
      itemId: string;
      data: EditarItemDto;
    }) =>
      api
        .patch<ApiResponse<Cotizacion>>(
          `/cotizaciones/${cotizacionId}/items/${itemId}`,
          data,
        )
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (cot, { cotizacionId }) => {
      qc.setQueryData(['cotizacion', cotizacionId], cot);
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo editar el ítem.'));
    },
  });
}

export function useEliminarItemCotizacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cotizacionId, itemId }: { cotizacionId: string; itemId: string }) =>
      api
        .delete<ApiResponse<unknown>>(
          `/cotizaciones/${cotizacionId}/items/${itemId}`,
        )
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
        }),
    onSuccess: (_data, { cotizacionId }) => {
      qc.invalidateQueries({ queryKey: ['cotizacion', cotizacionId] });
      qc.invalidateQueries({ queryKey: ['equipos'] });
      qc.invalidateQueries({ queryKey: ['herramientas'] });
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo eliminar el ítem.'));
    },
  });
}

// ─── PDF ────────────────────────────────────────────────────────────

export async function descargarCotizacionPdf(id: string, numero: string) {
  // El loading toast se descarta cuando llega la respuesta — no aplica onError
  // porque cualquier excepción la captura el caller (que muestra toast.error).
  const toastId = toast.loading('Generando PDF…');
  try {
    const res = await api.get(`/cotizaciones/${id}/pdf`, { responseType: 'blob' });
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
