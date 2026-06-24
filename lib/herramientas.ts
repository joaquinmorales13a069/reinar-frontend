import type { EstadoHerramienta } from '@/types/api';

export const ESTADO_HERRAMIENTA_LABEL: Record<EstadoHerramienta, string> = {
  DISPONIBLE: 'Disponible',
  RESERVADA: 'Reservada',
  RENTADA: 'Rentada',
  MANTENIMIENTO: 'Mantenimiento',
  USO_INTERNO: 'Uso interno',
  INACTIVO: 'Inactiva',
};

export const ESTADO_HERRAMIENTA_KIND: Record<
  EstadoHerramienta,
  'ok' | 'warn' | 'danger' | 'info' | 'neutral'
> = {
  DISPONIBLE: 'ok',
  RESERVADA: 'warn',
  RENTADA: 'info',
  MANTENIMIENTO: 'warn',
  USO_INTERNO: 'neutral',
  INACTIVO: 'danger',
};

// Permisos por acción. La regla viene del backend (herramientas.routes.ts y
// consumibles.routes.ts): admins = ADMIN/GERENTE; inventario = ADMIN/GERENTE/LOGISTICA.
// VISUALIZADOR solo lee.
export const PERMISOS_HERRAMIENTAS = {
  crearTipo: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  editarTipo: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  desactivarTipo: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  crearUnidad: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  cambiarEstadoUnidad: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  crearConsumible: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  editarConsumible: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  desactivarConsumible: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  ajustarStock: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
} as const;

export function puedeEjecutar(
  accion: keyof typeof PERMISOS_HERRAMIENTAS,
  rol: string | undefined,
): boolean {
  if (!rol) return false;
  return (PERMISOS_HERRAMIENTAS[accion] as readonly string[]).includes(rol);
}
