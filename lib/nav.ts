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
      { id: 'proyectos', label: 'Proyectos', href: '/proyectos',  icon: 'building' },
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
      { id: 'bodegas',        label: 'Bodegas',                href: '/bodegas',        icon: 'warehouse' },
      { id: 'mantenimientos', label: 'Mantenimientos',         href: '/mantenimientos', icon: 'wrench' },
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

// Ítems que aparecen en el BottomNav móvil (los 5 más usados).
export const BOTTOM_NAV_ITEMS: NavItem[] = [
  NAV_GROUPS[0].items[0], // Inicio
  NAV_GROUPS[0].items[1], // Clientes
  NAV_GROUPS[1].items[0], // Cotizaciones
  NAV_GROUPS[2].items[0], // Equipos
  NAV_GROUPS[3].items[0], // Reportes
];
