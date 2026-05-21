import type {
  CategoriaHerramienta,
  CategoriaConsumible,
  EstadoHerramienta,
} from '@/types/api';

export const CATEGORIAS_HERRAMIENTA_LABEL: Record<CategoriaHerramienta, string> = {
  MANGUERA: 'Manguera',
  BOQUILLA: 'Boquilla',
  EPP: 'EPP',
  HERRAMIENTA_MANUAL: 'Herramienta manual',
  OTRO: 'Otro',
};

export const CATEGORIAS_CONSUMIBLE_LABEL: Record<CategoriaConsumible, string> = {
  ABRASIVO: 'Abrasivo',
  PINTURA: 'Pintura',
  LUBRICANTE: 'Lubricante',
  QUIMICO: 'Químico',
  OTRO: 'Otro',
};

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
  crearTipo: ['ADMIN', 'GERENTE'] as const,
  editarTipo: ['ADMIN', 'GERENTE'] as const,
  desactivarTipo: ['ADMIN', 'GERENTE'] as const,
  crearUnidad: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  cambiarEstadoUnidad: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  crearConsumible: ['ADMIN', 'GERENTE'] as const,
  editarConsumible: ['ADMIN', 'GERENTE'] as const,
  desactivarConsumible: ['ADMIN', 'GERENTE'] as const,
  ajustarStock: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
} as const;

export function puedeEjecutar(
  accion: keyof typeof PERMISOS_HERRAMIENTAS,
  rol: string | undefined,
): boolean {
  if (!rol) return false;
  return (PERMISOS_HERRAMIENTAS[accion] as readonly string[]).includes(rol);
}
