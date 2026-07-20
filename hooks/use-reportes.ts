'use client';

import { toast } from 'sonner';
import api from '@/lib/api';
import { fechaSVToIso } from '@/lib/utils';

// Tipos de reporte exportables (devuelven blob PDF/Excel/CSV).
// Inventario queda fuera porque su endpoint devuelve JSON y se consume en /reportes/inventario.
export type TipoReporte =
  | 'ingresos'
  | 'cuentas-cobrar'
  | 'cotizaciones'
  | 'equipos'
  | 'actas'
  | 'proyectos'
  | 'servicios'
  | 'clientes'
  | 'vendedores'
  | 'mantenimientos';

// Coincide con backend `parametrosReporteSchema` — el formato `excel` produce .xlsx.
export type FormatoReporte = 'pdf' | 'excel' | 'csv';

export interface GenerarReporteParams {
  tipo: TipoReporte;
  desde: string;
  hasta: string;
  formato: FormatoReporte;
  comparar?: boolean;
  top?: number;
  // Filtros opcionales exclusivos del reporte de mantenimientos
  tipoMant?: string;
  categoria?: string;
  estado?: string;
  equipoId?: string;
  herramientaUnidadId?: string;
  tecnico?: string;
}

// El backend envía el filename en Content-Disposition. Lo extraemos para
// preservar el nombre canónico ("reporte-ingresos-2026-01-01_2026-03-31.pdf");
// si por algún motivo no llega, caemos a un nombre construido en el cliente.
export function extraerFilename(headers: Record<string, string | undefined>, tipo: string, formato: FormatoReporte | string): string {
  const cd = headers['content-disposition'] ?? '';
  const match = cd.match(/filename="?([^";]+)"?/i);
  if (match) return match[1];
  const ext = formato === 'excel' ? 'xlsx' : formato;
  return `reporte-${tipo}.${ext}`;
}

// Cuando el backend responde con error a una request `responseType: 'blob'`,
// el cuerpo viene como Blob aunque sea JSON: hay que leerlo como texto y parsear
// manualmente para mostrar el mensaje real en el toast.
export async function extraerErrorDeBlob(err: unknown, fallback: string): Promise<string> {
  const anyErr = err as { response?: { data?: unknown } };
  const data = anyErr?.response?.data;
  if (data instanceof Blob) {
    try {
      const texto = await data.text();
      const json = JSON.parse(texto) as { error?: { message?: string } };
      return json.error?.message ?? fallback;
    } catch {
      return fallback;
    }
  }
  const fallbackErr = anyErr?.response?.data as { error?: { message?: string } } | undefined;
  return fallbackErr?.error?.message ?? fallback;
}

export async function generarReporte(params: GenerarReporteParams): Promise<void> {
  const { tipo, desde, hasta, formato, comparar, top,
          tipoMant, categoria, estado, equipoId, herramientaUnidadId, tecnico } = params;
  const toastId = toast.loading('Generando reporte…');

  try {
    const res = await api.get(`/reportes/${tipo}`, {
      responseType: 'blob',
      params: {
        // Las fechas viajan al backend como ISO completo (zod las valida con
        // `.datetime()`) y los reportes comparan contra columnas ancladas al
        // día calendario de El Salvador (fecha, fechaServicio, createdAt…).
        // Anclamos a medianoche SV, no UTC, para que el corte coincida con el
        // día que ve el usuario sin importar su ubicación física.
        desde:    fechaSVToIso(desde),
        hasta:    fechaSVToIso(hasta),
        formato,
        // Sólo enviamos `comparar` y `top` cuando vienen definidos para no
        // sobreescribir los defaults del backend ni romper el schema (top tiene min/max).
        ...(comparar !== undefined ? { comparar: String(comparar) } : {}),
        ...(top !== undefined      ? { top: String(top) }           : {}),
        // Filtros opcionales de mantenimientos: se omiten cuando no vienen definidos
        // para no pisar defaults del backend ni enviar strings vacíos.
        ...(tipoMant              ? { tipo: tipoMant }                               : {}),
        ...(categoria             ? { categoria }                                     : {}),
        ...(estado                ? { estado }                                        : {}),
        ...(equipoId              ? { equipoId }                                      : {}),
        ...(herramientaUnidadId   ? { herramientaUnidadId }                           : {}),
        ...(tecnico               ? { tecnico }                                       : {}),
      },
    });

    const filename = extraerFilename(res.headers as Record<string, string | undefined>, tipo, formato);
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
    const mensaje = await extraerErrorDeBlob(err, 'No se pudo generar el reporte.');
    toast.error(mensaje);
    throw err;
  }
}
