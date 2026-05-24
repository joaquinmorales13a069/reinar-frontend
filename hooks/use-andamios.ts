'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  PiezaTipo,
  CuerpoTipo,
  CrearPiezaTipoDto,
  ActualizarPiezaTipoDto,
  AjusteStockPiezaDto,
  CrearCuerpoTipoDto,
  ActualizarCuerpoTipoDto,
  ExpandirCuerpoDto,
  ExpandirCuerpoItem,
  FiltrosPiezas,
  FiltrosCuerpos,
} from '@/types/api';

// Mismo patrón que use-herramientas.ts: helper duplicado intencionalmente para
// mantener cada archivo de hooks autocontenido (sin dependencia transitiva).
function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

// ─── Queries ─────────────────────────────────────────────────────────

export function usePiezas(filtros: FiltrosPiezas = {}) {
  return useQuery({
    queryKey: ['andamios', 'piezas', filtros],
    queryFn: () =>
      api
        .get<ApiResponse<PiezaTipo[]>>('/andamios/piezas', { params: filtros })
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
  });
}

export function usePieza(id: string) {
  return useQuery({
    queryKey: ['andamios', 'piezas', id],
    queryFn: () =>
      api.get<ApiResponse<PiezaTipo>>(`/andamios/piezas/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

export function useCuerpos(filtros: FiltrosCuerpos = {}) {
  return useQuery({
    queryKey: ['andamios', 'cuerpos', filtros],
    queryFn: () =>
      api
        .get<ApiResponse<CuerpoTipo[]>>('/andamios/cuerpos', { params: filtros })
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
  });
}

export function useCuerpo(id: string) {
  return useQuery({
    queryKey: ['andamios', 'cuerpos', id],
    queryFn: () =>
      api.get<ApiResponse<CuerpoTipo>>(`/andamios/cuerpos/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

// ─── Mutations de Piezas ─────────────────────────────────────────────

export function useCrearPieza() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (data: CrearPiezaTipoDto) =>
      api.post<ApiResponse<PiezaTipo>>('/andamios/piezas', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (pieza) => {
      qc.invalidateQueries({ queryKey: ['andamios', 'piezas'] });
      toast.success('Pieza creada.');
      router.push(`/andamios/piezas/${pieza.id}`);
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear la pieza.'));
    },
  });
}

export function useEditarPieza() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ActualizarPiezaTipoDto }) =>
      api.put<ApiResponse<PiezaTipo>>(`/andamios/piezas/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['andamios', 'piezas'] });
      qc.invalidateQueries({ queryKey: ['andamios', 'piezas', id] });
      // El stockCuerposDisponibles de los cuerpos no cambia con un PUT de pieza
      // (no toca stockActual), así que no invalidamos cuerpos aquí.
      toast.success('Cambios guardados.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudieron guardar los cambios.'));
    },
  });
}

export function useAjustarStockPieza() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AjusteStockPiezaDto }) =>
      api.patch<ApiResponse<PiezaTipo>>(`/andamios/piezas/${id}/stock`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['andamios', 'piezas'] });
      qc.invalidateQueries({ queryKey: ['andamios', 'piezas', id] });
      // Stock de piezas afecta stockCuerposDisponibles de cualquier cuerpo que la use.
      qc.invalidateQueries({ queryKey: ['andamios', 'cuerpos'] });
      toast.success('Stock ajustado correctamente.');
    },
    onError: (err) => {
      // El backend devuelve ESTADO_INVALIDO con el valor que quedaría — toast lo muestra.
      toast.error(extractErrorMessage(err, 'No se pudo ajustar el stock.'));
    },
  });
}

export function useCambiarEstadoPieza() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      api
        .patch<ApiResponse<PiezaTipo>>(`/andamios/piezas/${id}/estado`, { activo })
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (pieza, { id }) => {
      qc.invalidateQueries({ queryKey: ['andamios', 'piezas'] });
      qc.invalidateQueries({ queryKey: ['andamios', 'piezas', id] });
      // Si la pieza estaba en un cuerpo, su stockCuerposDisponibles cambia (a 0 si se desactivó).
      qc.invalidateQueries({ queryKey: ['andamios', 'cuerpos'] });
      toast.success(pieza.activo ? 'Pieza activada.' : 'Pieza desactivada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo cambiar el estado.'));
    },
  });
}

// ─── Mutations de Cuerpos ────────────────────────────────────────────

export function useCrearCuerpo() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (data: CrearCuerpoTipoDto) =>
      api.post<ApiResponse<CuerpoTipo>>('/andamios/cuerpos', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (cuerpo) => {
      qc.invalidateQueries({ queryKey: ['andamios', 'cuerpos'] });
      toast.success('Configuración creada.');
      router.push(`/andamios/cuerpos/${cuerpo.id}`);
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear la configuración.'));
    },
  });
}

export function useEditarCuerpo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ActualizarCuerpoTipoDto }) =>
      api.put<ApiResponse<CuerpoTipo>>(`/andamios/cuerpos/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['andamios', 'cuerpos'] });
      qc.invalidateQueries({ queryKey: ['andamios', 'cuerpos', id] });
      toast.success('Cambios guardados.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudieron guardar los cambios.'));
    },
  });
}

export function useCambiarEstadoCuerpo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      api
        .patch<ApiResponse<CuerpoTipo>>(`/andamios/cuerpos/${id}/estado`, { activo })
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (cuerpo, { id }) => {
      qc.invalidateQueries({ queryKey: ['andamios', 'cuerpos'] });
      qc.invalidateQueries({ queryKey: ['andamios', 'cuerpos', id] });
      toast.success(cuerpo.activo ? 'Configuración activada.' : 'Configuración desactivada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo cambiar el estado.'));
    },
  });
}

// Mutation sin invalidación: el endpoint es vista previa y no muta nada.
// Se modela como mutation (no query) porque es POST con body y se dispara on-demand.
export function useExpandirCuerpo(id: string) {
  return useMutation({
    mutationFn: (data: ExpandirCuerpoDto) =>
      api
        .post<ApiResponse<ExpandirCuerpoItem[]>>(`/andamios/cuerpos/${id}/expandir`, data)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    // Sin onSuccess toast: el resultado se muestra en la UI inline; un toast distrae.
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo calcular la expansión.'));
    },
  });
}
