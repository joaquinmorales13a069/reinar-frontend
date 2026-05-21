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
  nombre: string;
  apellido?: string;
  cargo?: string;
  tipoContacto: 'PRINCIPAL' | 'SECUNDARIO' | 'SOLICITANTE' | 'FACTURACION' | 'OPERATIVO';
  telefono?: string;
  email?: string;
  notas?: string;
  activo: boolean;
};
