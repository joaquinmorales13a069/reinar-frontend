import type { EstadoEquipo } from '@/types/api';

export const ESTADO_LABELS: Record<EstadoEquipo, string> = {
  DISPONIBLE: 'Disponible',
  RENTADO: 'Rentado',
  MANTENIMIENTO: 'Mantenimiento',
  USO_INTERNO: 'Uso interno',
  INACTIVO: 'Inactivo',
};

// El badge usa estos kinds del componente Badge para colorear el estado.
// DISPONIBLE → ok ya existe en STATUS_KIND de Badge.tsx; el resto se mapea acá
// porque no todos están en el mapa por defecto y queremos colores consistentes.
export const ESTADO_BADGE_KIND: Record<EstadoEquipo, 'ok' | 'warn' | 'danger' | 'info' | 'neutral'> = {
  DISPONIBLE: 'ok',
  RENTADO: 'info',
  MANTENIMIENTO: 'warn',
  USO_INTERNO: 'neutral',
  INACTIVO: 'danger',
};

// Roles que pueden ejecutar cada operación. La regla viene del backend
// (equipos.routes.ts) y se replica acá para ocultar botones en la UI.
export const PERMISOS_EQUIPOS = {
  crear: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  editar: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  cambiarEstado: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  subirImagen: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  eliminar: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  verInactivos: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
};

export function puedeEjecutar(
  accion: keyof typeof PERMISOS_EQUIPOS,
  rol: string | undefined,
): boolean {
  if (!rol) return false;
  return (PERMISOS_EQUIPOS[accion] as readonly string[]).includes(rol);
}
