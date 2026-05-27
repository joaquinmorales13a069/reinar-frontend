'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Decimal from 'decimal.js';
import api from '@/lib/api';
import type {
  ApiResponse,
  PaginatedResponse,
  Pago,
  CrearPagoDto, ActualizarPagoDto,
  PagoListItem,
  FiltrosPagos,
  FacturaListItem,
} from '@/types/api';

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

// ─── Pagos por factura (existente) ─────────────────────────────────────

export function useListarPagos(facturaId: string | null | undefined) {
  return useQuery({
    queryKey: ['pagos', facturaId],
    queryFn: () =>
      api
        .get<ApiResponse<Pago[]>>(`/facturas/${facturaId}/pagos`)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    enabled: !!facturaId,
  });
}

// ─── Listado global (RAMA 13) ──────────────────────────────────────────
// QueryKey separado de ['pagos', facturaId] porque son consultas distintas
// (lista global con filtros vs. pagos de una factura). placeholderData
// mantiene la página anterior visible mientras paginamos para evitar
// el flash de loading.
export function useListadoPagos(filtros: FiltrosPagos) {
  return useQuery({
    queryKey: ['pagos-listado', filtros],
    queryFn: () =>
      api
        .get<PaginatedResponse<PagoListItem>>('/pagos', { params: filtros })
        .then((r) => r.data),
    placeholderData: (prev) => prev,
  });
}

// ─── Facturas elegibles para registrar un pago (typeahead) ─────────────
// El backend no soporta filtrar por múltiples estados ni buscar por
// numeroFactura en GET /facturas, así que cargamos hasta 100 y filtramos
// client-side. El volumen esperado (decenas de facturas pendientes) hace
// que esto sea suficiente; si crece, se migra a un endpoint dedicado.
export function useFacturasPendientes() {
  return useQuery({
    queryKey: ['facturas-pendientes'],
    queryFn: () =>
      api
        .get<PaginatedResponse<FacturaListItem>>('/facturas', { params: { limit: 100 } })
        .then((r) =>
          r.data.data.filter(
            (f) =>
              ['PENDIENTE', 'PARCIAL', 'VENCIDA'].includes(f.estado) &&
              new Decimal(f.saldoPendiente).gt(0),
          ),
        ),
    staleTime: 30_000,
  });
}

// ─── Mutations ─────────────────────────────────────────────────────────

export function useCrearPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ facturaId, data }: { facturaId: string; data: CrearPagoDto }) =>
      api
        .post<ApiResponse<Pago>>(`/facturas/${facturaId}/pagos`, data)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (_pago, { facturaId }) => {
      // Invalidamos los pagos de esa factura (detalle), el listado global
      // (rama 13) y la factura misma (el backend recalcula montoPagado,
      // saldoPendiente y estado tras crear un pago). El listado de
      // facturas también porque su columna "Saldo" cambia.
      qc.invalidateQueries({ queryKey: ['pagos', facturaId] });
      qc.invalidateQueries({ queryKey: ['pagos-listado'] });
      qc.invalidateQueries({ queryKey: ['factura', facturaId] });
      qc.invalidateQueries({ queryKey: ['facturas'] });
      qc.invalidateQueries({ queryKey: ['facturas-pendientes'] });
      toast.success('Pago registrado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo registrar el pago.'));
    },
  });
}

export function useEliminarPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ facturaId, pagoId }: { facturaId: string; pagoId: string }) =>
      api
        .delete<ApiResponse<unknown>>(`/facturas/${facturaId}/pagos/${pagoId}`)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
        }),
    onSuccess: (_d, { facturaId }) => {
      qc.invalidateQueries({ queryKey: ['pagos', facturaId] });
      qc.invalidateQueries({ queryKey: ['pagos-listado'] });
      qc.invalidateQueries({ queryKey: ['factura', facturaId] });
      qc.invalidateQueries({ queryKey: ['facturas'] });
      qc.invalidateQueries({ queryKey: ['facturas-pendientes'] });
      toast.success('Pago eliminado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo eliminar el pago.'));
    },
  });
}

export function useActualizarPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ facturaId, pagoId, data }: { facturaId: string; pagoId: string; data: ActualizarPagoDto }) =>
      api
        .patch<ApiResponse<Pago>>(`/facturas/${facturaId}/pagos/${pagoId}`, data)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (_pago, { facturaId }) => {
      // Solo 3 invalidaciones (no 5 como crear/eliminar): referencia/notas no
      // afectan el saldo ni la elegibilidad de la factura, así que ['facturas']
      // y ['facturas-pendientes'] no necesitan refresh. Sí invalidamos la
      // factura misma porque su lista de pagos embebida cambia.
      qc.invalidateQueries({ queryKey: ['pagos', facturaId] });
      qc.invalidateQueries({ queryKey: ['pagos-listado'] });
      qc.invalidateQueries({ queryKey: ['factura', facturaId] });
      toast.success('Pago actualizado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo actualizar el pago.'));
    },
  });
}
