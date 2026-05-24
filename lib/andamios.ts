// Permisos por acción. La regla viene del backend (andamios.routes.ts):
//   admins      = ADMIN/GERENTE
//   inventario  = ADMIN/GERENTE/LOGISTICA
//   operadoresLogistica = ADMIN/GERENTE/OPERADOR/LOGISTICA
//   todos       = todos los roles autenticados
// VISUALIZADOR solo lee.

export const PERMISOS_ANDAMIOS = {
  crearPieza:           ['ADMIN', 'GERENTE'] as const,
  editarPieza:          ['ADMIN', 'GERENTE'] as const,
  cambiarEstadoPieza:   ['ADMIN', 'GERENTE'] as const,
  ajustarStockPieza:    ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  crearCuerpo:          ['ADMIN', 'GERENTE'] as const,
  editarCuerpo:         ['ADMIN', 'GERENTE'] as const,
  cambiarEstadoCuerpo:  ['ADMIN', 'GERENTE'] as const,
  expandirCuerpo:       ['ADMIN', 'GERENTE', 'OPERADOR', 'LOGISTICA'] as const,
} as const;

export function puedeEjecutarAndamios(
  accion: keyof typeof PERMISOS_ANDAMIOS,
  rol: string | undefined,
): boolean {
  if (!rol) return false;
  return (PERMISOS_ANDAMIOS[accion] as readonly string[]).includes(rol);
}

export const PERIODOS_LABEL: Record<'DIA' | 'SEMANA' | 'MES', string> = {
  DIA: 'Día',
  SEMANA: 'Semana',
  MES: 'Mes',
};
