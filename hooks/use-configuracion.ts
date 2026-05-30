'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  ConfiguracionEmpresa,
  ConfiguracionReportes,
  ActualizarConfiguracionDto,
  ActualizarConfigReportesDto,
} from '@/types/api';

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

// ─── Configuracion empresa ───────────────────────────────────────────

export function useConfiguracion() {
  return useQuery({
    queryKey: ['configuracion'],
    queryFn: () =>
      api.get<ApiResponse<ConfiguracionEmpresa>>('/configuracion').then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
  });
}

export function useActualizarConfiguracion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ActualizarConfiguracionDto) =>
      api.put<ApiResponse<ConfiguracionEmpresa>>('/configuracion', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['configuracion'] });
      toast.success('Configuración guardada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo guardar la configuración.'));
    },
  });
}

// ─── Configuracion reportes ──────────────────────────────────────────

export function useConfigReportes() {
  return useQuery({
    queryKey: ['configuracion-reportes'],
    queryFn: () =>
      api.get<ApiResponse<ConfiguracionReportes>>('/configuracion/reportes').then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
  });
}

export function useActualizarConfigReportes() {
  const qc = useQueryClient();
  return useMutation({
    // El schema del backend tiene `.refine(d => Object.keys(d).length > 0)` —
    // enviar solo los campos modificados (dirtyFields de RHF) es la forma
    // canónica y reduce ruido en el log de auditoría.
    mutationFn: (data: ActualizarConfigReportesDto) =>
      api.put<ApiResponse<ConfiguracionReportes>>('/configuracion/reportes', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['configuracion-reportes'] });
      toast.success('Configuración de reportes guardada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo guardar la configuración de reportes.'));
    },
  });
}
