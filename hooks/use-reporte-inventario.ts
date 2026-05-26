'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiResponse } from '@/types/api';

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
};

export function useReporteInventario() {
  return useQuery({
    queryKey: ['reporte-inventario'],
    queryFn: () =>
      api.get<ApiResponse<DatosInventario>>('/reportes/inventario').then((r) => {
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
