// Permisos por acción. Espejo de usuarios.routes.ts y configuracion.routes.ts
// del backend:
//   - GET /usuarios:    ADMIN, GERENTE
//   - POST/PUT/PATCH:   ADMIN
//   - GET /configuracion:           todos los autenticados
//   - PUT /configuracion:           ADMIN
//   - GET /configuracion/reportes:  ADMIN, GERENTE
//   - PUT /configuracion/reportes:  ADMIN

import type { RolUsuario } from '@/types/api';

// Permisos para entrar a la sección /ajustes. OPERADOR/LOGISTICA/VISUALIZADOR
// no tienen ninguna acción útil aquí (el backend les deniega lectura de usuarios
// y solo les permite leer configuracion empresa, lo cual no justifica una pantalla
// dedicada). Bloqueamos en el layout para evitar render flash.
const ROLES_ACCESO_AJUSTES = ['ADMIN', 'GERENTE'] as const;

export function puedeAccederAjustes(rol: RolUsuario | undefined): boolean {
  if (!rol) return false;
  return (ROLES_ACCESO_AJUSTES as readonly string[]).includes(rol);
}

// Solo ADMIN puede escribir (crear/editar/cambiar estado de usuarios,
// guardar configuracion empresa o reportes). GERENTE entra en modo lectura.
export function esAdmin(rol: RolUsuario | undefined): boolean {
  return rol === 'ADMIN';
}

// Helper para decidir si los controles de auto-modificación deben deshabilitarse.
// El backend devuelve 403 si un admin intenta cambiar su propio rol o desactivarse;
// prevenir la llamada en UI evita clicks que fallan y comunica la restricción.
export function esElPropioUsuario(usuarioId: string, autenticadoId: string | undefined): boolean {
  return !!autenticadoId && usuarioId === autenticadoId;
}
