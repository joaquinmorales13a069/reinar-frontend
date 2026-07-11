'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  PaginatedResponse,
  Fse,
  FseListItem,
  FiltrosFse,
  CrearFseDto,
  PlantillaFse,
  CrearPlantillaFseDto,
} from '@/types/api';

// Helper duplicado intencionalmente — mismo patrón que use-facturas.ts/use-cotizaciones.ts.
function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

// ─── Queries ─────────────────────────────────────────────────────────

export function useFses(filtros: FiltrosFse = {}) {
  return useQuery({
    queryKey: ['fses', filtros],
    queryFn: () =>
      api
        .get<PaginatedResponse<FseListItem>>('/fse', { params: filtros })
        .then((r) => r.data),
  });
}

export function useFse(id: string | null | undefined) {
  return useQuery({
    queryKey: ['fse', id],
    queryFn: () =>
      api.get<ApiResponse<Fse>>(`/fse/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

// ─── Mutations: FSE ─────────────────────────────────────────────────

export function useCrearFse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CrearFseDto) =>
      api.post<ApiResponse<Fse>>('/fse', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fses'] });
      toast.success('FSE creada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear la FSE.'));
    },
  });
}

// El backend solo permite editar mientras estadoDTE es PENDIENTE o RECHAZADO
// (422 ESTADO_INVALIDO en otro caso) — el componente que dispara la mutation
// debe ocultar la edición fuera de esos estados; el toast es respaldo.
export function useActualizarFse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CrearFseDto }) =>
      api.put<ApiResponse<Fse>>(`/fse/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (fse) => {
      qc.invalidateQueries({ queryKey: ['fse', fse.id] });
      qc.invalidateQueries({ queryKey: ['fses'] });
      toast.success('Cambios guardados.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudieron guardar los cambios.'));
    },
  });
}

export function useEliminarFse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<ApiResponse<null>>(`/fse/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fses'] });
      toast.success('FSE eliminada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo eliminar la FSE.'));
    },
  });
}

// ─── Mutations: DTE ─────────────────────────────────────────────────

export function useEmitirDteFse(id: string) {
  const qc = useQueryClient();
  return useMutation({
    // El tipoDTE es implícito (siempre SUJETO_EXCLUIDO) — el endpoint no recibe body.
    mutationFn: () =>
      api.patch<ApiResponse<Fse>>(`/fse/${id}/dte`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (fse) => {
      qc.setQueryData(['fse', fse.id], (old: Fse | undefined) =>
        old ? { ...old, ...fse } : old,
      );
      qc.invalidateQueries({ queryKey: ['fses'] });
      toast.success('DTE enviado al Ministerio de Hacienda.');
    },
    onError: (err) => {
      // 422 = proveedor no elegible / sin items — el componente que dispara
      // la mutation muestra el error inline. El toast es respaldo.
      toast.error(extractErrorMessage(err, 'No se pudo emitir el DTE.'));
    },
  });
}

// Anular DTE requiere motivo (min 10) y rol ADMIN — el backend rechaza si no
// se cumplen las condiciones (estadoDTE APROBADO + dteId presente).
export function useAnularDteFse(id: string) {
  const qc = useQueryClient();
  return useMutation({
    // axios manda el body de un DELETE bajo `data`.
    mutationFn: (motivo: string) =>
      api.delete<ApiResponse<null>>(`/fse/${id}/dte`, { data: { motivo } }).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fse', id] });
      qc.invalidateQueries({ queryKey: ['fses'] });
      toast.success('DTE anulado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo anular el DTE.'));
    },
  });
}

export function useSincronizarDteFse(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.patch<ApiResponse<Fse>>(`/fse/${id}/dte/sincronizar`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (fse) => {
      qc.setQueryData(['fse', fse.id], (old: Fse | undefined) =>
        old ? { ...old, ...fse } : old,
      );
      qc.invalidateQueries({ queryKey: ['fses'] });
      toast.success('Estado del DTE actualizado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo sincronizar el DTE.'));
    },
  });
}

// ─── Plantillas FSE por proveedor ─────────────────────────────────────
// Viven bajo /proveedores/:id/plantillas-fse en el backend, no bajo /fse —
// atajos para precargar descripcion/precio de compras recurrentes al mismo
// proveedor (p.ej. flete mensual).

export function usePlantillasFse(proveedorId: string | null | undefined) {
  return useQuery({
    queryKey: ['plantillas-fse', proveedorId],
    queryFn: () =>
      api
        .get<ApiResponse<PlantillaFse[]>>(`/proveedores/${proveedorId}/plantillas-fse`)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    enabled: !!proveedorId,
  });
}

export function useCrearPlantillaFse(proveedorId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CrearPlantillaFseDto) =>
      api
        .post<ApiResponse<PlantillaFse>>(`/proveedores/${proveedorId}/plantillas-fse`, data)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plantillas-fse', proveedorId] });
      toast.success('Plantilla guardada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo guardar la plantilla.'));
    },
  });
}

export function useEliminarPlantillaFse(proveedorId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plantillaId: string) =>
      api
        .delete<ApiResponse<null>>(`/proveedores/${proveedorId}/plantillas-fse/${plantillaId}`)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
        }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plantillas-fse', proveedorId] });
      toast.success('Plantilla eliminada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo eliminar la plantilla.'));
    },
  });
}

// ─── PDFs ───────────────────────────────────────────────────────────
// Mismo patrón que descargarCotizacionPdf/descargarFacturaPdfBranded — el
// loading toast se descarta al llegar la respuesta o el error.

export async function descargarFsePdf(id: string, numero: string) {
  const toastId = toast.loading('Generando PDF…');
  try {
    const res = await api.get(`/fse/${id}/pdf`, { responseType: 'blob' });
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

export async function descargarConstanciaRetencion(id: string, numero: string) {
  const toastId = toast.loading('Generando constancia de retención…');
  try {
    const res = await api.get(`/fse/${id}/constancia`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `constancia-${numero}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.dismiss(toastId);
  } catch (err) {
    toast.dismiss(toastId);
    toast.error(extractErrorMessage(err, 'No se pudo descargar la constancia.'));
  }
}
