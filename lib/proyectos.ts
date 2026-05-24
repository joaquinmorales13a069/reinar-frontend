import type { EstadoProyecto } from '@/types/api';

// Espejo de server/src/modules/proyectos/proyectos.routes.ts:
//   operadores = ADMIN/GERENTE/OPERADOR pueden escribir.
//   LOGISTICA y VISUALIZADOR solo leen.
export const PERMISOS_PROYECTOS = {
  crear:         ['ADMIN', 'GERENTE', 'OPERADOR'] as const,
  editar:        ['ADMIN', 'GERENTE', 'OPERADOR'] as const,
  cambiarEstado: ['ADMIN', 'GERENTE', 'OPERADOR'] as const,
} as const;

export function puedeEjecutarProyecto(
  accion: keyof typeof PERMISOS_PROYECTOS,
  rol: string | undefined,
): boolean {
  if (!rol) return false;
  return (PERMISOS_PROYECTOS[accion] as readonly string[]).includes(rol);
}

// Espejo de TRANSICIONES_VALIDAS en proyectos.service.ts. Lo replicamos en el
// frontend para deshabilitar opciones inválidas antes de llegar al backend;
// la fuente de verdad sigue siendo el backend (422 si nos saltamos esto).
export const TRANSICIONES_PROYECTO: Record<EstadoProyecto, EstadoProyecto[]> = {
  ACTIVO:     ['PAUSADO', 'COMPLETADO', 'CANCELADO'],
  PAUSADO:    ['ACTIVO', 'CANCELADO'],
  COMPLETADO: [],
  CANCELADO:  [],
};

export function esEstadoTerminal(estado: EstadoProyecto): boolean {
  return TRANSICIONES_PROYECTO[estado].length === 0;
}
