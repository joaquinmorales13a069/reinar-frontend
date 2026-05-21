// Unión discriminada sobre `success` para que TypeScript estreche el tipo automáticamente:
// tras `if (res.success)`, `data` está garantizado; en el else, `error` está garantizado.
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown[] } };

// Tipo separado para listas paginadas porque envuelven data en un array e incluyen
// meta — mezclarlos en ApiResponse<T[]> perdería el campo meta.
export type PaginatedResponse<T> = {
  success: true;
  data: T[];
  meta: { page: number; limit: number; total: number };
};

// Forma del usuario devuelta por login y renovación de token.
// `rol` controla todos los chequeos de permisos en la UI
// (ocultar/deshabilitar controles de escritura para VISUALIZADOR, etc.).
export type User = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: 'ADMIN' | 'GERENTE' | 'OPERADOR' | 'LOGISTICA' | 'VISUALIZADOR';
};

// Notificaciones del usuario autenticado — mostradas en el dropdown del topbar.
export type Notificacion = {
  id: string;
  texto: string;
  meta: string;
  leida: boolean;
  creadoEn: string;
  icono?: string;
};

export type Cliente = {
  id: string;
  tipo: 'EMPRESA' | 'PARTICULAR';
  razonSocial?: string;
  nombreComercial?: string;
  nombre?: string;
  apellido?: string;
  nit?: string;
  ncr?: string;
  dui?: string;
  ocupacion?: string;
  sector?: string;
  actividadEconomica?: string;
  departamento: string;
  municipio: string;
  distrito?: string;
  complemento?: string;
  telefono?: string;
  email?: string;
  notas?: string;
  estado: 'ACTIVO' | 'INACTIVO' | 'PROSPECTO';
  facturado?: string;
  proyectos?: number;
};

export type Contacto = {
  id: string;
  clienteId: string;
  cliente?: {
    tipo?: 'EMPRESA' | 'PARTICULAR';
    razonSocial?: string;
    nombre?: string;
    apellido?: string;
    estado?: 'ACTIVO' | 'INACTIVO' | 'PROSPECTO';
    nit?: string;
    dui?: string;
    departamento?: string;
    telefono?: string;
  };
  nombre: string;
  apellido?: string;
  cargo?: string;
  tipoContacto: 'PRINCIPAL' | 'SECUNDARIO' | 'SOLICITANTE' | 'FACTURACION' | 'OPERATIVO';
  telefono?: string;
  email?: string;
  notas?: string;
  activo: boolean;
};

// ============================================================
// Equipos (Rama 5)
// ============================================================

export type CategoriaEquipo =
  | 'COMPRESOR_GENERADOR'
  | 'SANDBLASTING'
  | 'ANDAMIO_PLATAFORMA'
  | 'COMPACTADOR_RODILLO'
  | 'HERRAMIENTA_ESPECIALIZADA'
  | 'OTRO';

export type EstadoEquipo =
  | 'DISPONIBLE'
  | 'RENTADO'        // gestionado por el módulo de cotizaciones
  | 'MANTENIMIENTO'  // gestionado por el módulo de mantenimientos
  | 'USO_INTERNO'
  | 'INACTIVO';

// Solo estos 3 estados son cambiables desde la UI; el backend valida los otros
// como gestionados internamente y rechaza intentos de modificarlos manualmente.
export type EstadoEquipoEditable = 'DISPONIBLE' | 'USO_INTERNO' | 'INACTIVO';

export type FichaTecnica = Record<string, string>;

export type Equipo = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoria: CategoriaEquipo;
  estado: EstadoEquipo;
  marca: string | null;
  modelo: string | null;
  anoFabricacion: number | null;
  imagenUrl: string | null;
  fichaTecnica: FichaTecnica | null;
  // El backend serializa los Decimal como strings para preservar precisión;
  // convertir con decimal.js, no con parseFloat.
  tarifaDia: string;
  tarifaSemana: string;
  tarifaMes: string;
  activo: boolean;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CrearEquipoDto = {
  prefijo: string;
  nombre: string;
  descripcion?: string;
  categoria: CategoriaEquipo;
  marca?: string;
  modelo?: string;
  anoFabricacion?: number;
  tarifaDia: number;
  tarifaSemana: number;
  tarifaMes: number;
  notas?: string;
  fichaTecnica?: FichaTecnica;
};

export type ActualizarEquipoDto = Partial<Omit<CrearEquipoDto, 'prefijo'>>;

export type FiltrosEquipos = {
  page?: number;
  limit?: number;
  search?: string;
  categoria?: CategoriaEquipo;
  estado?: EstadoEquipo;
  incluirInactivos?: boolean;
};

// Forma del mantenimiento devuelto por GET /equipos/:id/mantenimientos.
// Tipo mínimo solo con los campos usados en el detalle del equipo —
// el módulo de mantenimientos (Rama 15) extenderá esto.
export type EquipoMantenimientoResumen = {
  id: string;
  tipo: string;
  descripcion: string | null;
  fechaIngreso: string;
  fechaSalida: string | null;
  proveedor: string | null;
  estado: string;
};
