'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  Proyecto,
  CrearProyectoDto,
  ActualizarProyectoDto,
  EstadoProyecto,
  FiltrosProyectos,
  Bodega,
} from '@/types/api';

// Helper duplicado intencionalmente para mantener cada archivo de hooks
// autocontenido, igual que en use-servicios.ts y use-bodegas.ts.
function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

// ─── Queries ─────────────────────────────────────────────────────────

export function useProyectosCliente(clienteId: string, filtros: FiltrosProyectos = {}) {
  return useQuery({
    queryKey: ['proyectos-cliente', clienteId, filtros],
    queryFn: () =>
      api
        .get<ApiResponse<Proyecto[]>>(`/clientes/${clienteId}/proyectos`, { params: filtros })
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    enabled: !!clienteId,
  });
}

export function useProyecto(id: string) {
  return useQuery({
    queryKey: ['proyecto', id],
    queryFn: () =>
      api.get<ApiResponse<Proyecto>>(`/proyectos/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

// Devuelve la bodega-proyecto asociada al proyecto, o null si aún no existe.
// GET /proyectos/:id/bodega — disponible para todos los roles.
export function useBodegaProyecto(proyectoId: string | null | undefined) {
  return useQuery({
    queryKey: ['proyecto-bodega', proyectoId],
    queryFn: () =>
      api
        .get<ApiResponse<Bodega | null>>(`/proyectos/${proyectoId}/bodega`)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    enabled: !!proyectoId,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────

// Crea la bodega-proyecto para el proyecto indicado.
// POST /proyectos/:id/bodega — gated ADMIN/GERENTE/LOGISTICA en el backend.
// Devuelve 409 si ya existe una; el frontend la maneja mostrando un toast claro.
export function useCrearBodegaProyecto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data?: { nombre?: string; descripcion?: string };
    }) =>
      api
        .post<ApiResponse<Bodega>>(`/proyectos/${id}/bodega`, data ?? {})
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (_bodega, { id }) => {
      qc.invalidateQueries({ queryKey: ['proyecto-bodega', id] });
      toast.success('Bodega de proyecto creada.');
    },
    onError: (err, { id }) => {
      const anyErr = err as { response?: { status?: number } };
      if (anyErr?.response?.status === 409) {
        // Forzamos revalidación para mostrar la bodega ya existente.
        qc.invalidateQueries({ queryKey: ['proyecto-bodega', id] });
        toast.error('El proyecto ya tiene una bodega.');
      } else {
        toast.error(extractErrorMessage(err, 'No se pudo crear la bodega de proyecto.'));
      }
    },
  });
}

export function useCrearProyecto(clienteId: string) {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (data: CrearProyectoDto) =>
      api
        .post<ApiResponse<Proyecto>>(`/clientes/${clienteId}/proyectos`, data)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (proyecto) => {
      // El detalle del cliente muestra el contador de proyectos, por eso
      // invalidamos también su cache aunque pertenezca a otro módulo.
      qc.invalidateQueries({ queryKey: ['proyectos-cliente', clienteId] });
      qc.invalidateQueries({ queryKey: ['cliente', clienteId] });
      toast.success('Proyecto creado.');
      router.push(`/proyectos/${proyecto.id}`);
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear el proyecto.'));
    },
  });
}

export function useEditarProyecto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ActualizarProyectoDto }) =>
      api.put<ApiResponse<Proyecto>>(`/proyectos/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (proyecto) => {
      qc.invalidateQueries({ queryKey: ['proyecto', proyecto.id] });
      qc.invalidateQueries({ queryKey: ['proyectos-cliente', proyecto.clienteId] });
      toast.success('Cambios guardados.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudieron guardar los cambios.'));
    },
  });
}

export function useCambiarEstadoProyecto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoProyecto }) =>
      api.patch<ApiResponse<Proyecto>>(`/proyectos/${id}/estado`, { estado }).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (proyecto) => {
      qc.invalidateQueries({ queryKey: ['proyecto', proyecto.id] });
      qc.invalidateQueries({ queryKey: ['proyectos-cliente', proyecto.clienteId] });
      toast.success(`Estado: ${proyecto.estado}.`);
    },
    onError: (err) => {
      const anyErr = err as { response?: { status?: number; data?: { error?: { message?: string } } } };
      if (anyErr?.response?.status === 409) {
        // El backend rechaza cerrar el proyecto cuando su bodega-proyecto aún
        // tiene inventario. Mostramos el mensaje del backend si viene, o uno
        // genérico guiando al usuario a vaciar la bodega primero.
        const backendMsg = anyErr?.response?.data?.error?.message;
        toast.error(
          backendMsg ??
            'No se puede cerrar el proyecto: aún hay inventario en su bodega. Vaciala primero.',
        );
      } else {
        // Backend devuelve 422 ESTADO_INVALIDO si la transición es inválida.
        // El selector debería prevenirlo, pero si llega igual mostramos el mensaje.
        toast.error(extractErrorMessage(err, 'No se pudo cambiar el estado.'));
      }
    },
  });
}
