// Espejo de server/src/modules/bodegas/bodegas.routes.ts: solo ADMIN/GERENTE
// pueden crear, editar o cambiar estado. Resto de roles ven en read-only.
export const PERMISOS_BODEGAS = {
  crear:         ['ADMIN', 'GERENTE'] as const,
  editar:        ['ADMIN', 'GERENTE'] as const,
  cambiarEstado: ['ADMIN', 'GERENTE'] as const,
} as const;

export function puedeEjecutarBodega(
  accion: keyof typeof PERMISOS_BODEGAS,
  rol: string | undefined,
): boolean {
  if (!rol) return false;
  return (PERMISOS_BODEGAS[accion] as readonly string[]).includes(rol);
}
