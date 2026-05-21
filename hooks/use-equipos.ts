'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  PaginatedResponse,
  Equipo,
  CrearEquipoDto,
  ActualizarEquipoDto,
  FiltrosEquipos,
  EstadoEquipoEditable,
  FichaTecnica,
  EquipoMantenimientoResumen,
} from '@/types/api';

function extractErrorMessage(err: unknown, fallback: string): string {
  // Buscamos el mensaje del backend en error.response.data.error.message;
  // si no existe (red caída, 5xx sin body), usamos el fallback en español.
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

export function useEquipos(params: FiltrosEquipos = {}) {
  return useQuery({
    queryKey: ['equipos', params],
    queryFn: () =>
      api.get<PaginatedResponse<Equipo>>('/equipos', { params }).then((r) => r.data),
  });
}

export function useEquipo(id: string) {
  return useQuery({
    queryKey: ['equipos', id],
    queryFn: () =>
      api.get<ApiResponse<Equipo>>(`/equipos/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

export function useEquipoFichaTecnica(id: string) {
  return useQuery({
    queryKey: ['equipos', id, 'ficha-tecnica'],
    queryFn: () =>
      api
        .get<ApiResponse<{ fichaTecnica: FichaTecnica }>>(`/equipos/${id}/ficha-tecnica`)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data.fichaTecnica;
        }),
    enabled: !!id,
  });
}

export function useEquipoMantenimientos(id: string) {
  return useQuery({
    queryKey: ['equipos', id, 'mantenimientos'],
    queryFn: () =>
      api
        .get<PaginatedResponse<EquipoMantenimientoResumen>>(`/equipos/${id}/mantenimientos`)
        .then((r) => r.data),
    enabled: !!id,
  });
}

export function useCrearEquipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CrearEquipoDto) =>
      api.post<ApiResponse<Equipo>>('/equipos', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipos'] });
      toast.success('Equipo creado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear el equipo.'));
    },
  });
}

export function useEditarEquipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ActualizarEquipoDto }) =>
      api.put<ApiResponse<Equipo>>(`/equipos/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['equipos'] });
      qc.invalidateQueries({ queryKey: ['equipos', id] });
      toast.success('Cambios guardados.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudieron guardar los cambios.'));
    },
  });
}

export function useCambiarEstadoEquipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoEquipoEditable }) =>
      api
        .patch<ApiResponse<Equipo>>(`/equipos/${id}/estado`, { estado })
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['equipos'] });
      qc.invalidateQueries({ queryKey: ['equipos', id] });
      toast.success('Estado actualizado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo cambiar el estado.'));
    },
  });
}

export function useSubirImagenEquipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const fd = new FormData();
      fd.append('imagen', file);
      // Content-Type lo setea axios automáticamente con el boundary correcto
      // cuando pasamos un FormData; setearlo manualmente lo rompería.
      return api
        .patch<ApiResponse<Equipo>>(`/equipos/${id}/imagen`, fd)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        });
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['equipos'] });
      qc.invalidateQueries({ queryKey: ['equipos', id] });
      toast.success('Imagen actualizada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo subir la imagen.'));
    },
  });
}

export function useEliminarEquipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<ApiResponse<Equipo>>(`/equipos/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['equipos'] });
      qc.invalidateQueries({ queryKey: ['equipos', id] });
      toast.success('Equipo desactivado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo desactivar el equipo.'));
    },
  });
}
