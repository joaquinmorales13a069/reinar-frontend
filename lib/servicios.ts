// Permisos por acción. Espejo de servicios.routes.ts del backend:
//   admins = ADMIN/GERENTE escriben; OPERADOR/LOGISTICA/VISUALIZADOR sólo leen.

export const PERMISOS_SERVICIOS = {
  crear:         ['ADMIN', 'GERENTE'] as const,
  editar:        ['ADMIN', 'GERENTE'] as const,
  cambiarEstado: ['ADMIN', 'GERENTE'] as const,
} as const;

export function puedeEjecutarServicio(
  accion: keyof typeof PERMISOS_SERVICIOS,
  rol: string | undefined,
): boolean {
  if (!rol) return false;
  return (PERMISOS_SERVICIOS[accion] as readonly string[]).includes(rol);
}
