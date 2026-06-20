// Espejo de server/src/modules/bodegas/bodegas.routes.ts: ADMIN/GERENTE/LOGISTICA
// pueden crear, editar o cambiar estado de bodegas y zonas (decisión D5).
export const PERMISOS_BODEGAS = {
  crear:         ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  editar:        ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  cambiarEstado: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
} as const;

export function puedeEjecutarBodega(
  accion: keyof typeof PERMISOS_BODEGAS,
  rol: string | undefined,
): boolean {
  if (!rol) return false;
  return (PERMISOS_BODEGAS[accion] as readonly string[]).includes(rol);
}
