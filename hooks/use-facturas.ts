'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type {
  ApiResponse,
  PaginatedResponse,
  Factura,
  FacturaListItem,
  FiltrosFacturas,
  ActualizarFacturaDto,
  CambiarEstadoFacturaDto,
  EmitirDTEDto,
  TipoDTEGenerable,
  DatosExportacionInput,
  DatosExportacion,
} from '@/types/api';

// Helper duplicado intencionalmente — mismo patron que use-cotizaciones.ts.
function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

// ─── Queries ─────────────────────────────────────────────────────────

export function useFacturas(params: FiltrosFacturas = {}) {
  return useQuery({
    queryKey: ['facturas', params],
    queryFn: () =>
      api
        .get<PaginatedResponse<FacturaListItem>>('/facturas', { params })
        .then((r) => r.data),
  });
}

export function useFactura(id: string | null | undefined) {
  return useQuery({
    queryKey: ['factura', id],
    queryFn: () =>
      api.get<ApiResponse<Factura>>(`/facturas/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

// ─── Mutations: factura ─────────────────────────────────────────────

export function useActualizarFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ActualizarFacturaDto }) =>
      api.patch<ApiResponse<Factura>>(`/facturas/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (factura) => {
      // PATCH /facturas/:id devuelve la factura sin relaciones (cliente,
      // cotizacion, pagos…). Mergeamos sobre lo cacheado para no pisar esas
      // relaciones — sin esto el detalle re-renderiza con factura.cliente
      // undefined y crashea. Mismo patrón que las demás mutations de este hook.
      qc.setQueryData(['factura', factura.id], (old: Factura | undefined) =>
        old ? { ...old, ...factura } : old,
      );
      qc.invalidateQueries({ queryKey: ['facturas'] });
      toast.success('Cambios guardados.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo actualizar la factura.'));
    },
  });
}

export function useCambiarEstadoFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CambiarEstadoFacturaDto }) =>
      api
        .patch<ApiResponse<unknown>>(`/facturas/${id}/estado`, data)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (_data, { id, data }) => {
      qc.invalidateQueries({ queryKey: ['factura', id] });
      qc.invalidateQueries({ queryKey: ['facturas'] });
      const msg = data.estado === 'ANULADA' ? 'Factura anulada.' : 'Estado actualizado.';
      toast.success(msg);
    },
    onError: (err) => {
      // El backend rechaza transiciones invalidas con 422 ESTADO_INVALIDO.
      // Propagamos el mensaje legible al usuario.
      toast.error(extractErrorMessage(err, 'No se pudo cambiar el estado.'));
    },
  });
}

// ─── Mutations: DTE ─────────────────────────────────────────────────

export function useEmitirDTE() {
  const qc = useQueryClient();
  return useMutation({
    // El backend devuelve la factura con los campos DTE actualizados; usamos
    // setQueryData para reflejar el cambio sin GET adicional.
    mutationFn: ({ id, data }: { id: string; data: EmitirDTEDto }) =>
      api
        .patch<ApiResponse<Factura>>(`/facturas/${id}/dte`, data)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (factura) => {
      qc.setQueryData(['factura', factura.id], (old: Factura | undefined) =>
        old ? { ...old, ...factura } : old,
      );
      qc.invalidateQueries({ queryKey: ['facturas'] });
      toast.success('DTE enviado al Ministerio de Hacienda.');
    },
    onError: (err) => {
      // 400 = falta NCR/actividad/direccion del cliente — el componente que
      // dispara la mutation muestra el error inline. El toast es respaldo
      // por si el componente no lo captura.
      toast.error(extractErrorMessage(err, 'No se pudo emitir el DTE.'));
    },
  });
}

export function useSincronizarDTE() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api
        .post<ApiResponse<Factura>>(`/facturas/${id}/dte/sincronizar`)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (factura) => {
      qc.setQueryData(['factura', factura.id], (old: Factura | undefined) =>
        old ? { ...old, ...factura } : old,
      );
      qc.invalidateQueries({ queryKey: ['facturas'] });
      toast.success('Estado del DTE actualizado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo sincronizar el DTE.'));
    },
  });
}

// Anular SOLO el DTE (sin cambiar estado de factura) para poder emitir un
// nuevo tipo de DTE sobre la misma factura. Requiere motivo (min 10) porque
// el backend invalida el DTE ante el MH.
export function useAnularDTESoloDTE(id: string) {
  const qc = useQueryClient();
  return useMutation({
    // axios manda el body de un DELETE bajo `data`.
    mutationFn: ({ motivo }: { motivo: string }) =>
      api.delete<ApiResponse<unknown>>(`/facturas/${id}/dte`, { data: { motivo } }).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['factura', id] });
      qc.invalidateQueries({ queryKey: ['facturas'] });
      toast.success('DTE anulado. Asigná un nuevo tipo y emití.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo anular el DTE.'));
    },
  });
}

// Guarda los datos de exportación (FEX, fase 2) antes de emitir el DTE. El
// backend solo devuelve los campos de exportación actualizados (no la factura
// completa: el tipo DatosExportacion documenta ese select parcial), así que
// invalidamos en lugar de mergear con setQueryData — el error de validación
// (recinto/régimen inválidos, transporte incompleto) lo maneja el componente
// (FE-3), no este hook.
export function useGuardarDatosExportacion(facturaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DatosExportacionInput) =>
      api.patch<ApiResponse<DatosExportacion>>(`/facturas/${facturaId}/datos-exportacion`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['factura', facturaId] });
    },
  });
}

// ─── Mutations: generacion desde cotizacion / entrega QUEDAN ────────

// El tipoDTE para cotizacion->factura excluye NC (las notas de credito se
// crean contra una factura existente, no contra una cotizacion).
export type GenerarFacturaInput = {
  tipoDTE: TipoDTEGenerable;
  contactoFacturacionId?: string;
  condicionPago: 'CONTADO' | 'CREDITO';
  // Requerida solo para CREDITO sin QUEDAN; CONTADO vence solo (+24h) y en
  // QUEDAN el vencimiento se calcula al entregar. El backend valida.
  fechaVencimiento?: string;
  esQuedan: boolean;
  // Requerida cuando esQuedan = true; el backend valida la combinacion.
  fechaEntregaFactura?: string;
  plazoCredito?: number;
  // Receptor fiscal de la factura; se envía solo cuando difiere del cliente
  // de la cotización (facturación a un tercero).
  receptorClienteId?: string;
};

export function useGenerarFactura(cotizacionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerarFacturaInput) =>
      api
        .post<ApiResponse<Factura> & { warning?: string }>(
          `/cotizaciones/${cotizacionId}/factura`,
          input,
        )
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          // warning vive a la par de success/data — el backend lo usa para
          // avisar de inconsistencias no bloqueantes (p.ej. credito insuficiente).
          return { factura: r.data.data, warning: r.data.warning };
        }),
    onSuccess: ({ warning }) => {
      if (warning) toast.info(warning);
      else toast.success('Factura generada.');
      qc.invalidateQueries({ queryKey: ['cotizaciones', cotizacionId] });
      qc.invalidateQueries({ queryKey: ['facturas'] });
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo generar la factura.'));
    },
  });
}

export function useMarcarFacturaEntregada(facturaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fechaEntregaReal: string) =>
      api
        .post<ApiResponse<Factura>>(
          `/facturas/${facturaId}/marcar-entregada`,
          { fechaEntregaReal },
        )
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (factura) => {
      qc.setQueryData(['factura', factura.id], (old: Factura | undefined) =>
        old ? { ...old, ...factura } : old,
      );
      qc.invalidateQueries({ queryKey: ['facturas'] });
      // En QUEDAN el backend acaba de materializar el vencimiento — lo confirmamos.
      toast.success(
        factura.fechaVencimiento
          ? `Factura entregada. Vence el ${formatDate(factura.fechaVencimiento)}.`
          : 'Factura marcada como entregada.',
      );
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo marcar como entregada.'));
    },
  });
}

// ─── Enviar DTE por correo ──────────────────────────────────────────

export function useEnviarDTEPorEmail(facturaId: string) {
  return useMutation({
    mutationFn: (input: { email: string; mensaje?: string }) =>
      api
        .post<ApiResponse<{ destinatario: string }>>(
          `/facturas/${facturaId}/dte/enviar-email`,
          input,
        )
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: ({ destinatario }) => {
      toast.success(`DTE enviado a ${destinatario}.`);
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo enviar el DTE.'));
    },
  });
}

// ─── PDFs ───────────────────────────────────────────────────────────

// El loading toast se descarta cuando llega la respuesta o el error.
// Mismo patron que descargarCotizacionPdf — no usar onError de useMutation
// porque la descarga es side-effect (DOM), no un dato cacheable.
export async function descargarFacturaPdfBranded(id: string, numero: string) {
  const toastId = toast.loading('Generando PDF…');
  try {
    const res = await api.get(`/facturas/${id}/pdf`, { responseType: 'blob' });
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

export async function descargarFacturaPdfOficialDTE(id: string, numero: string) {
  const toastId = toast.loading('Generando PDF oficial DTE…');
  try {
    const res = await api.get(`/facturas/${id}/dte/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${numero}-DTE.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.dismiss(toastId);
  } catch (err) {
    toast.dismiss(toastId);
    toast.error(extractErrorMessage(err, 'No se pudo descargar el PDF oficial.'));
  }
}

export async function descargarFacturaJsonDTE(id: string, numero: string) {
  const toastId = toast.loading('Obteniendo JSON del DTE…');
  try {
    const res = await api.get(`/facturas/${id}/dte/json`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${numero}-DTE.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.dismiss(toastId);
  } catch (err) {
    toast.dismiss(toastId);
    toast.error(extractErrorMessage(err, 'No se pudo descargar el JSON del DTE.'));
  }
}
