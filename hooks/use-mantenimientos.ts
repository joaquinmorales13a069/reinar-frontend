'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  PaginatedResponse,
  Mantenimiento,
  FiltrosMantenimientos,
  CrearMantenimientoDto,
  ActualizarMantenimientoDto,
  RegistrarSalidaDto,
} from '@/types/api';

function extractErrorMessage(err: unknown, fallback: string): string {
  // Buscamos el mensaje del backend en error.response.data.error.message;
  // si no existe (red caída, 5xx sin body), usamos el fallback en español.
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

// Invalidamos las queries del equipo o unidad afectada porque la creacion,
// edicion, salida o eliminacion cambian su estado (DISPONIBLE/MANTENIMIENTO)
// y los cards "Mantenimientos recientes" en sus detalles deben recargarse.
function invalidateEntidadRelacionada(qc: ReturnType<typeof useQueryClient>, m?: Mantenimiento | null) {
  if (!m) return;
  if (m.equipoId) {
    qc.invalidateQueries({ queryKey: ['equipos'] });
    qc.invalidateQueries({ queryKey: ['equipos', m.equipoId] });
    qc.invalidateQueries({ queryKey: ['equipos', m.equipoId, 'mantenimientos'] });
  }
  if (m.herramientaUnidadId) {
    qc.invalidateQueries({ queryKey: ['herramientas'] });
    qc.invalidateQueries({ queryKey: ['herramientas', 'unidades', m.herramientaUnidadId] });
    qc.invalidateQueries({ queryKey: ['herramientas', 'unidades', m.herramientaUnidadId, 'mantenimientos'] });
  }
}

export function useMantenimientos(params: FiltrosMantenimientos = {}) {
  return useQuery({
    queryKey: ['mantenimientos', params],
    queryFn: () =>
      api.get<PaginatedResponse<Mantenimiento>>('/mantenimientos', { params }).then((r) => r.data),
  });
}

export function useMantenimiento(id: string) {
  return useQuery({
    queryKey: ['mantenimientos', id],
    queryFn: () =>
      api.get<ApiResponse<Mantenimiento>>(`/mantenimientos/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

export function useCrearMantenimiento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CrearMantenimientoDto) =>
      api.post<ApiResponse<Mantenimiento>>('/mantenimientos', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ['mantenimientos'] });
      invalidateEntidadRelacionada(qc, m);
      toast.success('Mantenimiento creado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear el mantenimiento.'));
    },
  });
}

export function useActualizarMantenimiento(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ActualizarMantenimientoDto) =>
      api.put<ApiResponse<Mantenimiento>>(`/mantenimientos/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ['mantenimientos'] });
      qc.invalidateQueries({ queryKey: ['mantenimientos', id] });
      invalidateEntidadRelacionada(qc, m);
      toast.success('Cambios guardados.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudieron guardar los cambios.'));
    },
  });
}

export function useEliminarMantenimiento() {
  const qc = useQueryClient();
  return useMutation({
    // Pasamos el mantenimiento completo (no solo el id) para invalidar
    // las queries del equipo/unidad relacionada despues del DELETE.
    mutationFn: (m: Mantenimiento) =>
      api.delete<ApiResponse<null>>(`/mantenimientos/${m.id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return m;
      }),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ['mantenimientos'] });
      invalidateEntidadRelacionada(qc, m);
      toast.success('Mantenimiento eliminado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo eliminar el mantenimiento.'));
    },
  });
}

export function useRegistrarSalida(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RegistrarSalidaDto) =>
      api.patch<ApiResponse<Mantenimiento>>(`/mantenimientos/${id}/salida`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ['mantenimientos'] });
      qc.invalidateQueries({ queryKey: ['mantenimientos', id] });
      invalidateEntidadRelacionada(qc, m);
      toast.success('Salida registrada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo registrar la salida.'));
    },
  });
}

export function useSubirAdjuntos(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) => {
      const fd = new FormData();
      // El backend espera multiples archivos bajo el mismo nombre de campo.
      files.forEach((f) => fd.append('files', f));
      // Content-Type lo setea axios automáticamente con el boundary correcto
      // cuando pasamos un FormData; setearlo manualmente lo rompería.
      return api.post<ApiResponse<Mantenimiento>>(`/mantenimientos/${id}/adjuntos`, fd).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mantenimientos', id] });
      toast.success('Adjuntos subidos.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudieron subir los adjuntos.'));
    },
  });
}

export function useEliminarAdjunto(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (adjuntoId: string) =>
      api.delete<ApiResponse<null>>(`/mantenimientos/${id}/adjuntos/${adjuntoId}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return null;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mantenimientos', id] });
      toast.success('Adjunto eliminado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo eliminar el adjunto.'));
    },
  });
}
