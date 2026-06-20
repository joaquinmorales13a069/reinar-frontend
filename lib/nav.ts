import type { IconName } from '@/components/ui/Icon';

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: IconName;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

// Estructura de navegación compartida entre Sidebar y BottomNav.
// El campo `href` es la ruta real de Next.js; `id` es el identificador lógico
// para comparar con el pathname activo sin depender del formato exacto de la URL.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operaciones',
    items: [
      { id: 'inicio',    label: 'Inicio',    href: '/dashboard',  icon: 'home' },
      { id: 'clientes',  label: 'Clientes',  href: '/clientes',   icon: 'users' },
      { id: 'contactos', label: 'Contactos', href: '/contactos',  icon: 'idCard' },
      // Proyectos no aparece como item de navegación global porque viven bajo
      // el cliente (ver spec D1). El detalle individual se accede desde
      // /clientes/:id o desde el módulo de cotizaciones.
    ],
  },
  {
    label: 'Ventas',
    items: [
      { id: 'cotizaciones',  label: 'Cotizaciones',     href: '/cotizaciones',  icon: 'fileText' },
      { id: 'facturas',      label: 'Facturas',         href: '/facturas',      icon: 'receipt' },
      { id: 'actas',         label: 'Actas de Entrega', href: '/actas',         icon: 'clipboard' },
      { id: 'recepciones',   label: 'Recepciones',      href: '/recepciones',   icon: 'package' },
      { id: 'pagos',         label: 'Pagos',            href: '/pagos',         icon: 'dollar' },
      { id: 'notas-credito', label: 'Notas de Crédito', href: '/notas-credito', icon: 'fileText' },
      { id: 'retenciones',   label: 'Retenciones',      href: '/retenciones',   icon: 'fileText' },
    ],
  },
  {
    label: 'Inventario',
    items: [
      { id: 'equipos',        label: 'Equipos',                href: '/equipos',        icon: 'package' },
      { id: 'servicios',      label: 'Servicios',              href: '/servicios',      icon: 'tool' },
      { id: 'andamios',       label: 'Andamios',               href: '/andamios',       icon: 'layers' },
      { id: 'herramientas',   label: 'Herramientas & Consum.', href: '/herramientas',   icon: 'hammer' },
      { id: 'bodegas',               label: 'Bodegas',                href: '/bodegas',               icon: 'warehouse' },
      { id: 'mantenimientos',        label: 'Mantenimientos',         href: '/mantenimientos',        icon: 'wrench' },
      { id: 'proveedores',           label: 'Proveedores',            href: '/proveedores',           icon: 'building' },
      { id: 'ingresos-inventario',   label: 'Ingresos de inventario', href: '/ingresos-inventario',   icon: 'download' },
    ],
  },
  {
    label: 'Analítica',
    items: [
      { id: 'reportes', label: 'Reportes', href: '/reportes', icon: 'chartBar' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { id: 'ajustes',  label: 'Ajustes',   href: '/ajustes',  icon: 'gear' },
      { id: 'auditlog', label: 'Auditoría', href: '/auditlog', icon: 'fileText' },
    ],
  },
];

// Todos los items aplanados — útil para resolver breadcrumbs desde un pathname.
export const NAV_ITEMS_FLAT: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

// Estructura del BottomNav móvil: cada slot puede ser un link directo
// (kind: 'link') o un grupo (kind: 'group') que abre un popover con
// sub-items al tocar el botón. Esto resuelve que con sólo 5 slots
// quedaban afuera secciones importantes del sidebar como Contactos,
// Andamios, Herramientas o Servicios.
export type BottomNavLink = {
  kind: 'link';
  id: string;
  label: string;
  href: string;
  icon: IconName;
};

export type BottomNavGroup = {
  kind: 'group';
  id: string;
  label: string;
  icon: IconName;
  children: NavItem[];
};

export type BottomNavSlot = BottomNavLink | BottomNavGroup;

export const BOTTOM_NAV_ITEMS: BottomNavSlot[] = [
  { kind: 'link', id: 'inicio', label: 'Inicio', href: '/dashboard', icon: 'home' },
  {
    kind: 'group',
    id: 'clientes-grupo',
    label: 'Clientes',
    icon: 'users',
    children: [
      NAV_GROUPS[0].items[1], // Clientes
      NAV_GROUPS[0].items[2], // Contactos
    ],
  },
  {
    kind: 'group',
    id: 'ventas',
    label: 'Ventas',
    icon: 'fileText',
    // Actas/Recepciones/Notas/Retenciones viven aquí (no en "Clientes") porque
    // son documentos del flujo de venta, no propiedades del cliente.
    children: [
      NAV_GROUPS[1].items[0], // Cotizaciones
      NAV_GROUPS[1].items[1], // Facturas
      NAV_GROUPS[1].items[4], // Pagos
      NAV_GROUPS[1].items[2], // Actas de Entrega
      NAV_GROUPS[1].items[3], // Recepciones
      NAV_GROUPS[1].items[5], // Notas de Crédito
      NAV_GROUPS[1].items[6], // Retenciones
    ],
  },
  {
    kind: 'group',
    id: 'inventario',
    label: 'Inventario',
    icon: 'package',
    children: [
      NAV_GROUPS[2].items[0], // Equipos
      NAV_GROUPS[2].items[2], // Andamios
      NAV_GROUPS[2].items[3], // Herramientas & Consum.
      NAV_GROUPS[2].items[1], // Servicios
      NAV_GROUPS[2].items[4], // Bodegas
      NAV_GROUPS[2].items[5], // Mantenimientos
      NAV_GROUPS[2].items[6], // Proveedores
      NAV_GROUPS[2].items[7], // Ingresos de inventario
    ],
  },
  { kind: 'link', id: 'reportes', label: 'Reportes', href: '/reportes', icon: 'chartBar' },
];
