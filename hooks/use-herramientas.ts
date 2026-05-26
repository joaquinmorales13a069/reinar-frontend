'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  PaginatedResponse,
  HerramientaTipo,
  HerramientaUnidad,
  CrearHerramientaTipoDto,
  ActualizarHerramientaTipoDto,
  FiltrosHerramientas,
  FiltrosUnidades,
  CrearUnidadDto,
  EstadoUnidadEditable,
  UnidadMantenimientoResumen,
  HistorialRentaItem,
  MoverBodegaDto,
} from '@/types/api';

// Helper duplicado intencionalmente en cada archivo de hooks: evita una
// dependencia transitiva ("shared/api-error") y mantiene cada hook autocontenido,
// igual que en use-equipos.ts.
function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

export function useHerramientaTipos(params: FiltrosHerramientas = {}) {
  return useQuery({
    queryKey: ['herramientas', params],
    queryFn: () =>
      api
        .get<PaginatedResponse<HerramientaTipo>>('/herramientas', { params })
        .then((r) => r.data),
  });
}

export function useHerramientaTipo(id: string) {
  return useQuery({
    queryKey: ['herramientas', id],
    queryFn: () =>
      api.get<ApiResponse<HerramientaTipo>>(`/herramientas/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

export function useCrearHerramientaTipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CrearHerramientaTipoDto) =>
      api.post<ApiResponse<HerramientaTipo>>('/herramientas', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['herramientas'] });
      toast.success('Tipo de herramienta creado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear el tipo.'));
    },
  });
}

export function useEditarHerramientaTipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ActualizarHerramientaTipoDto }) =>
      api.put<ApiResponse<HerramientaTipo>>(`/herramientas/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['herramientas'] });
      qc.invalidateQueries({ queryKey: ['herramientas', id] });
      toast.success('Cambios guardados.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudieron guardar los cambios.'));
    },
  });
}

export function useDesactivarHerramientaTipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch<ApiResponse<HerramientaTipo>>(`/herramientas/${id}/activo`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (tipo, id) => {
      qc.invalidateQueries({ queryKey: ['herramientas'] });
      qc.invalidateQueries({ queryKey: ['herramientas', id] });
      toast.success(tipo.activo ? 'Tipo activado.' : 'Tipo desactivado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo cambiar el estado.'));
    },
  });
}

export function useUnidadesPorTipo(tipoId: string, filtros: FiltrosUnidades = {}) {
  return useQuery({
    queryKey: ['herramientas', tipoId, 'unidades', filtros],
    queryFn: () =>
      api
        .get<ApiResponse<HerramientaUnidad[]>>(`/herramientas/${tipoId}/unidades`, {
          params: filtros,
        })
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    enabled: !!tipoId,
  });
}

export function useCrearUnidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tipoId, data }: { tipoId: string; data: CrearUnidadDto }) =>
      api
        .post<ApiResponse<HerramientaUnidad>>(`/herramientas/${tipoId}/unidades`, data)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (_data, { tipoId }) => {
      qc.invalidateQueries({ queryKey: ['herramientas', tipoId] });
      qc.invalidateQueries({ queryKey: ['herramientas', tipoId, 'unidades'] });
      // Invalidamos la lista global también porque muestra contadores agregados
      // de unidades disponibles por tipo.
      qc.invalidateQueries({ queryKey: ['herramientas'] });
      toast.success('Unidad creada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear la unidad.'));
    },
  });
}

export function useCambiarEstadoUnidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      unidadId,
      estado,
    }: {
      unidadId: string;
      estado: EstadoUnidadEditable;
      // tipoId se acepta como parte del input para que el onSuccess pueda invalidar
      // la lista nested correspondiente sin tener que leerla del response.
      tipoId: string;
    }) =>
      api
        .patch<ApiResponse<HerramientaUnidad>>(
          `/herramientas/unidades/${unidadId}/estado`,
          { estado },
        )
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (_data, { tipoId }) => {
      qc.invalidateQueries({ queryKey: ['herramientas'] });
      qc.invalidateQueries({ queryKey: ['herramientas', tipoId] });
      qc.invalidateQueries({ queryKey: ['herramientas', tipoId, 'unidades'] });
      toast.success('Estado de la unidad actualizado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo cambiar el estado de la unidad.'));
    },
  });
}

export function useMoverBodegaUnidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ unidadId, data }: { unidadId: string; tipoId: string; data: MoverBodegaDto }) =>
      api
        .patch<ApiResponse<HerramientaUnidad>>(`/herramientas/unidades/${unidadId}/bodega`, data)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (_data, { unidadId, tipoId }) => {
      qc.invalidateQueries({ queryKey: ['herramientas'] });
      qc.invalidateQueries({ queryKey: ['herramientas', tipoId] });
      qc.invalidateQueries({ queryKey: ['herramientas', tipoId, 'unidades'] });
      qc.invalidateQueries({ queryKey: ['herramientas', 'unidades', unidadId] });
      qc.invalidateQueries({ queryKey: ['reporte-inventario'] });
      toast.success('Unidad movida a la nueva bodega.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo mover la unidad.'));
    },
  });
}

export function useMantenimientosUnidad(unidadId: string) {
  return useQuery({
    queryKey: ['herramientas', 'unidades', unidadId, 'mantenimientos'],
    queryFn: () =>
      api
        .get<PaginatedResponse<UnidadMantenimientoResumen>>(
          `/herramientas/unidades/${unidadId}/mantenimientos`,
        )
        .then((r) => r.data),
    enabled: !!unidadId,
  });
}

export function useRentasUnidad(unidadId: string) {
  return useQuery({
    queryKey: ['herramientas', 'unidades', unidadId, 'rentas'],
    queryFn: () =>
      api
        .get<ApiResponse<HistorialRentaItem[]>>(
          `/herramientas/unidades/${unidadId}/rentas`,
        )
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    enabled: !!unidadId,
  });
}
