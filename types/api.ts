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

// ============================================================
// Herramientas & Consumibles (Rama 6)
// ============================================================

export type CategoriaHerramienta =
  | 'MANGUERA'
  | 'BOQUILLA'
  | 'EPP'
  | 'HERRAMIENTA_MANUAL'
  | 'OTRO';

export type CategoriaConsumible =
  | 'ABRASIVO'
  | 'PINTURA'
  | 'LUBRICANTE'
  | 'QUIMICO'
  | 'OTRO';

export type EstadoHerramienta =
  | 'DISPONIBLE'
  | 'RESERVADA'     // gestionado por reservas/cotizaciones
  | 'RENTADA'       // gestionado por actas
  | 'MANTENIMIENTO' // gestionado por el módulo de mantenimientos
  | 'USO_INTERNO'
  | 'INACTIVO';

// Subconjunto de estados que el backend acepta vía PATCH /unidades/:id/estado.
// Los otros (RESERVADA, RENTADA) los maneja el sistema y el UI no debe ofrecerlos.
export type EstadoUnidadEditable =
  | 'DISPONIBLE'
  | 'MANTENIMIENTO'
  | 'USO_INTERNO'
  | 'INACTIVO';

export type HerramientaTipo = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoria: CategoriaHerramienta;
  // Decimal serializado como string — usar decimal.js para operar, formatCurrency para mostrar.
  tarifaDia: string;
  tarifaSemana: string;
  tarifaMes: string;
  activo: boolean;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
  // El backend del detalle (`GET /herramientas/:id`) incluye `unidades` y/o `_count`.
  unidades?: HerramientaUnidad[];
  _count?: { unidades?: number };
  // Campos calculados por el endpoint LIST (GET /herramientas): el backend
  // hace destructure de `_count` y `unidades` y los reemplaza por estos dos.
  totalUnidades?: number;
  unidadesDisponibles?: number;
};

export type HerramientaUnidad = {
  id: string;
  codigoInterno: string;
  herramientaTipoId: string;
  estado: EstadoHerramienta;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CrearHerramientaTipoDto = {
  codigo: string;
  nombre: string;
  descripcion?: string;
  categoria: CategoriaHerramienta;
  tarifaDia: number;
  tarifaSemana: number;
  tarifaMes: number;
  notas?: string;
};

export type ActualizarHerramientaTipoDto = Partial<
  Omit<CrearHerramientaTipoDto, 'codigo'>
>;

export type FiltrosHerramientas = {
  page?: number;
  limit?: number;
  search?: string;
  categoria?: CategoriaHerramienta;
  activo?: boolean;
};

export type CrearUnidadDto = { notas?: string };

export type FiltrosUnidades = { estado?: EstadoHerramienta };

// Tipo mínimo del mantenimiento devuelto por GET /unidades/:id/mantenimientos.
// El módulo completo de mantenimientos (Rama 15) lo extenderá.
export type UnidadMantenimientoResumen = {
  id: string;
  tipo: string;
  descripcion: string | null;
  fechaIngreso: string;
  fechaSalida: string | null;
  proveedor: string | null;
  estado: string;
};

export type Consumible = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoria: CategoriaConsumible;
  precioUnitario: string;
  stockActual: number;
  stockMinimo: number;
  unidad: string;
  activo: boolean;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CrearConsumibleDto = {
  codigo: string;
  nombre: string;
  descripcion?: string;
  categoria: CategoriaConsumible;
  precioUnitario: number;
  stockActual: number;
  stockMinimo: number;
  unidad: string;
  notas?: string;
};

// stockActual no es editable vía PUT — el backend lo rechaza, se ajusta solo
// vía PATCH /:id/stock (ver AjusteStockDto).
export type ActualizarConsumibleDto = Partial<
  Omit<CrearConsumibleDto, 'codigo' | 'stockActual'>
>;

export type FiltrosConsumibles = {
  page?: number;
  limit?: number;
  search?: string;
  categoria?: CategoriaConsumible;
  activo?: boolean;
  stockBajo?: boolean;
};

export type AjusteStockDto = {
  // El backend valida que sea entero != 0; positivo = entrada, negativo = salida.
  delta: number;
  motivo: string;
};

// ============================================================
// Andamios (Rama 7) — PiezaTipo + CuerpoTipo
// ============================================================

export type PiezaTipo = {
  id: string;
  nombre: string;
  descripcion: string | null;
  // Inventario interno. stockActual cambia vía PATCH /:id/stock (con motivo auditado),
  // no vía PUT — el form de editar no debe enviarlo.
  stockActual: number;
  stockMinimo: number;
  // Decimal serializado como string — usar decimal.js para operar, formatCurrency para mostrar.
  tarifaDia: string;
  tarifaSemana: string;
  tarifaMes: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

// CuerpoComponente viene anidado dentro de CuerpoTipo. El backend usa un select
// con sólo estos campos de piezaTipo (no devuelve tarifas ni stockMinimo aquí).
export type CuerpoComponente = {
  id: string;
  cantidad: number;
  piezaTipo: {
    id: string;
    nombre: string;
    stockActual: number;
    activo: boolean;
  };
};

export type CuerpoTipo = {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  componentes: CuerpoComponente[];
  // Calculado por backend: mínimo de floor(pieza.stockActual / componente.cantidad)
  // entre todos los componentes. 0 si alguna pieza está inactiva.
  stockCuerposDisponibles: number;
};

export type CrearPiezaTipoDto = {
  nombre: string;
  descripcion?: string;
  stockActual?: number;
  stockMinimo?: number;
  tarifaDia: number;
  tarifaSemana: number;
  tarifaMes: number;
};

// Editar omite stockActual: el backend lo rechaza, y los ajustes van por el endpoint
// dedicado (que requiere motivo y queda auditado).
export type ActualizarPiezaTipoDto = {
  nombre?: string;
  descripcion?: string;
  stockMinimo?: number;
  tarifaDia?: number;
  tarifaSemana?: number;
  tarifaMes?: number;
};

export type AjusteStockPiezaDto = {
  delta: number;       // entero != 0; positivo = entrada, negativo = salida
  motivo: string;
};

export type CrearCuerpoTipoDto = {
  nombre: string;
  descripcion?: string;
  componentes: { piezaTipoId: string; cantidad: number }[];
};

export type ActualizarCuerpoTipoDto = {
  nombre?: string;
  descripcion?: string;
  // Si se envía, reemplaza el BOM completo (delete + recreate atomicos en backend).
  componentes?: { piezaTipoId: string; cantidad: number }[];
};

export type FiltrosPiezas = {
  stockBajo?: boolean;
  incluirInactivos?: boolean;
};

export type FiltrosCuerpos = {
  incluirInactivos?: boolean;
};

export type PeriodoExpandir = 'DIA' | 'SEMANA' | 'MES';

export type ExpandirCuerpoDto = {
  cantidad: number;
  periodo: PeriodoExpandir;
};

// Resultado de POST /cuerpos/:id/expandir — preview de cuántas piezas se necesitarían
// y la tarifa unitaria correspondiente al periodo. No muta stock.
export type ExpandirCuerpoItem = {
  tipoPiezaId: string;
  nombre: string;
  cantidad: number;          // comp.cantidad * dto.cantidad
  tarifaCatalogo: string;    // Decimal correspondiente al periodo elegido
};
