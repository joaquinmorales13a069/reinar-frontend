// Espejo de server/src/modules/proveedores/proveedores.routes.ts:
// lectura todos los roles; escritura ADMIN/GERENTE/LOGISTICA.
export const PERMISOS_PROVEEDORES = {
  crear:         ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  editar:        ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  cambiarActivo: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
} as const;

export function puedeEjecutarProveedor(
  accion: keyof typeof PERMISOS_PROVEEDORES,
  rol: string | undefined,
): boolean {
  if (!rol) return false;
  return (PERMISOS_PROVEEDORES[accion] as readonly string[]).includes(rol);
}
