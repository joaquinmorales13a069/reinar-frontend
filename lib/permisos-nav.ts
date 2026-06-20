import type { NavGroup, BottomNavSlot } from '@/lib/nav';
import type { RolUsuario } from '@/types/api';

// Mapeo nav-item-id -> roles permitidos. Replica la logica de los backends en
// `server/src/modules/*/.routes.ts` (busqueda: `const todos = [...]`).
//
// IMPORTANTE: si el backend cambia el array `todos` o `admins` de un modulo,
// hay que actualizar esta tabla. La verdad operativa es del backend (devuelve
// 403); aca solo escondemos lo que el usuario no puede usar para evitar
// mostrar UI que termina en "no se pudo cargar" o 403.
export const PERMISOS_NAV: Record<string, RolUsuario[]> = {
  inicio:          ['ADMIN', 'GERENTE', 'OPERADOR', 'LOGISTICA', 'VISUALIZADOR'],

  // Operaciones — clientes/contactos NO incluyen LOGISTICA en el backend
  clientes:        ['ADMIN', 'GERENTE', 'OPERADOR', 'VISUALIZADOR'],
  contactos:       ['ADMIN', 'GERENTE', 'OPERADOR', 'VISUALIZADOR'],

  // Ventas — todos los roles
  cotizaciones:    ['ADMIN', 'GERENTE', 'OPERADOR', 'LOGISTICA', 'VISUALIZADOR'],
  facturas:        ['ADMIN', 'GERENTE', 'OPERADOR', 'LOGISTICA', 'VISUALIZADOR'],
  actas:           ['ADMIN', 'GERENTE', 'OPERADOR', 'LOGISTICA', 'VISUALIZADOR'],
  recepciones:     ['ADMIN', 'GERENTE', 'OPERADOR', 'LOGISTICA', 'VISUALIZADOR'],
  pagos:           ['ADMIN', 'GERENTE', 'OPERADOR', 'LOGISTICA', 'VISUALIZADOR'],
  'notas-credito': ['ADMIN', 'GERENTE', 'OPERADOR', 'LOGISTICA', 'VISUALIZADOR'],
  retenciones:     ['ADMIN', 'GERENTE', 'OPERADOR', 'LOGISTICA', 'VISUALIZADOR'],

  // Inventario — servicios excluye LOGISTICA en el backend; el resto los 5 roles
  equipos:         ['ADMIN', 'GERENTE', 'OPERADOR', 'LOGISTICA', 'VISUALIZADOR'],
  servicios:       ['ADMIN', 'GERENTE', 'OPERADOR', 'VISUALIZADOR'],
  andamios:        ['ADMIN', 'GERENTE', 'OPERADOR', 'LOGISTICA', 'VISUALIZADOR'],
  herramientas:    ['ADMIN', 'GERENTE', 'OPERADOR', 'LOGISTICA', 'VISUALIZADOR'],
  bodegas:         ['ADMIN', 'GERENTE', 'OPERADOR', 'LOGISTICA', 'VISUALIZADOR'],
  mantenimientos:  ['ADMIN', 'GERENTE', 'OPERADOR', 'LOGISTICA', 'VISUALIZADOR'],
  proveedores:          ['ADMIN', 'GERENTE', 'OPERADOR', 'LOGISTICA', 'VISUALIZADOR'],
  'ingresos-inventario': ['ADMIN', 'GERENTE', 'LOGISTICA'],

  // Analitica + Sistema — OPERADOR puede acceder al reporte de inventario
  reportes:        ['ADMIN', 'GERENTE', 'LOGISTICA', 'OPERADOR'],
  ajustes:         ['ADMIN', 'GERENTE'],
  auditlog:        ['ADMIN', 'GERENTE'],
};

export function puedeVerNavItem(itemId: string, rol: RolUsuario | undefined): boolean {
  if (!rol) return false;
  const roles = PERMISOS_NAV[itemId];
  // Si un item nuevo no esta en la tabla, lo dejamos visible por defecto para
  // no romper navegacion ante un olvido — el backend rechazara si no corresponde.
  if (!roles) return true;
  return roles.includes(rol);
}

// Filtra NAV_GROUPS por rol del usuario: oculta items prohibidos y elimina
// grupos que quedaron vacios tras el filtro (no mostrar headers huerfanos).
export function filtrarNavGroups(groups: NavGroup[], rol: RolUsuario | undefined): NavGroup[] {
  return groups
    .map((g) => ({ ...g, items: g.items.filter((item) => puedeVerNavItem(item.id, rol)) }))
    .filter((g) => g.items.length > 0);
}

// Filtra BOTTOM_NAV_ITEMS por rol: para slots tipo 'group' filtra los children;
// si el group queda sin children o el slot tipo 'link' no es accesible, se descarta.
export function filtrarBottomNav(slots: BottomNavSlot[], rol: RolUsuario | undefined): BottomNavSlot[] {
  return slots.flatMap<BottomNavSlot>((slot) => {
    if (slot.kind === 'link') {
      return puedeVerNavItem(slot.id, rol) ? [slot] : [];
    }
    const children = slot.children.filter((c) => puedeVerNavItem(c.id, rol));
    return children.length > 0 ? [{ ...slot, children }] : [];
  });
}
