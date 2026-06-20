'use client';

import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import type { ApiResponse, EstadoResumen, FiltrosReporteInventario } from '@/types/api';
import { extraerFilename, extraerErrorDeBlob } from '@/hooks/use-reportes';

export type InventarioBodegaResumen = {
  bodegaId: string;
  bodegaNombre: string;
  bodegaTipo: string;
  parentId: string | null;
  equipos: number;
  herramientas: number;
  consumiblesSku: number;
  consumiblesUnid: number;
  piezasSku: number;
  piezasUnid: number;
};

export type InventarioItemDetalle = {
  tipo: 'EQUIPO' | 'HERRAMIENTA' | 'CONSUMIBLE' | 'PIEZA';
  id: string;
  codigo: string;
  nombre: string;
  estado?: string;
  cantidad?: number;
};

export type DatosInventario = {
  porBodega: InventarioBodegaResumen[];
  totales: {
    equipos: number;
    herramientas: number;
    consumiblesSku: number;
    consumiblesUnid: number;
    piezasSku: number;
    piezasUnid: number;
  };
  // Campos enriquecidos del backend (E4) — opcionales:
  estado?: {
    equipos: EstadoResumen;
    herramientas: EstadoResumen;
  };
  equiposPorCategoria?: (EstadoResumen & { categoria: string })[];
  consumibles?: { sku: number; unidadesEnStock: number; unidadesConClientes: number };
  piezas?: { sku: number; unidadesEnStock: number; unidadesConClientes: number };
  porCliente?: {
    clienteId: string;
    clienteNombre: string;
    equipos: number;
    herramientas: number;
    consumiblesUnid: number;
    piezasUnid: number;
  }[];
};

export type FormatoExportInventario = 'pdf' | 'excel' | 'csv';

export function useReporteInventario(filtros: FiltrosReporteInventario = {}) {
  return useQuery({
    queryKey: ['reporte-inventario', filtros],
    queryFn: () =>
      api
        .get<ApiResponse<DatosInventario>>('/reportes/inventario', { params: filtros })
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
  });
}

export function useReporteInventarioDetalle(bodegaId: string | null) {
  return useQuery({
    queryKey: ['reporte-inventario-detalle', bodegaId],
    queryFn: () =>
      api
        .get<ApiResponse<InventarioItemDetalle[]>>(`/reportes/inventario/${bodegaId}`)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    enabled: !!bodegaId,
  });
}

export async function exportarReporteInventario(
  filtros: FiltrosReporteInventario,
  formato: FormatoExportInventario,
): Promise<void> {
  const toastId = toast.loading('Generando reporte de inventario…');
  try {
    const res = await api.get('/reportes/inventario', {
      responseType: 'blob',
      params: { ...filtros, formato },
    });
    const filename = extraerFilename(
      res.headers as Record<string, string | undefined>,
      'inventario',
      formato,
    );
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.dismiss(toastId);
    toast.success('Reporte descargado.');
  } catch (err) {
    toast.dismiss(toastId);
    const mensaje = await extraerErrorDeBlob(err, 'No se pudo exportar el reporte.');
    toast.error(mensaje);
    throw err;
  }
}
