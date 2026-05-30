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
// Shape derivado del modelo Prisma `Notificacion`. El backend devuelve los registros
// con `findMany` sin transform, así que los nombres deben coincidir con la BD —
// nombres distintos (texto/meta/creadoEn) producían divs vacíos en runtime.
export type Notificacion = {
  id: string;
  usuarioId: string;
  // Discriminador del evento (COTIZACION_APROBADA, FACTURA_EMITIDA, etc.).
  // El frontend deriva el ícono a partir de este string vía un lookup map.
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  // URL relativa al recurso (ej. `/cotizaciones/cmpx…`). El topbar la usa para
  // navegar al hacer click sobre la notificación.
  enlace: string | null;
  createdAt: string;
};

export type Cliente = {
  id: string;
  tipo: 'EMPRESA' | 'PARTICULAR';
  razonSocial?: string;
  nombreComercial?: string;
  nombre?: string;
  apellido?: string;
  tipoDocumento?: 'DUI' | 'NIT' | 'PASAPORTE' | 'CARNET_RESIDENTE' | 'OTRO' | null;
  numeroDocumento?: string | null;
  ncr?: string;
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
  // proyectos era un campo plano que el backend nunca devolvio — siempre era
  // undefined y caia al ?? 0. Ahora el detalle devuelve _count.proyectos.
  // Lo mantenemos opcional como fallback historico.
  proyectos?: number;
  _count?: { proyectos?: number };
  // Indica si el cliente opera bajo el regimen de QUEDAN — afecta la generacion
  // de facturas (fecha de entrega de factura requerida) y los reportes.
  manejaQuedan: boolean;
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
    tipoDocumento?: 'DUI' | 'NIT' | 'PASAPORTE' | 'CARNET_RESIDENTE' | 'OTRO' | null;
    numeroDocumento?: string | null;
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
  bodegaId: string;
  bodega?: { id: string; nombre: string; parentId: string | null };
  createdAt: string;
  updatedAt: string;
};

export type CrearEquipoDto = {
  prefijo: string;
  nombre: string;
  descripcion?: string;
  categoria: CategoriaEquipo;
  bodegaId: string;
  marca?: string;
  modelo?: string;
  anoFabricacion?: number;
  tarifaDia: number;
  tarifaSemana: number;
  tarifaMes: number;
  notas?: string;
  fichaTecnica?: FichaTecnica;
};

export type MoverBodegaDto = {
  bodegaDestinoId: string;
  notas?: string;
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

// Adjunto del mantenimiento. archivoUrl viene presignada por el backend
// y expira; no reusarla mas alla del render actual.
export type MantenimientoAdjunto = {
  id:            string;
  nombreArchivo: string;
  mimeType:      string;
  tamaño:        number;
  archivoUrl:    string | null;
  createdAt:     string;
};

export type TipoMantenimiento   = 'PREVENTIVO' | 'CORRECTIVO' | 'EMERGENCIA';
export type EstadoMantenimiento = 'ACTIVO' | 'COMPLETADO';

export type Mantenimiento = {
  id:                   string;
  tipo:                 TipoMantenimiento;
  estado:               EstadoMantenimiento;
  tecnico:              string;
  motivo:               string;
  horometro:            string | null;        // Decimal serializado
  costoEstimado:        string | null;        // Decimal serializado
  costoReal:            string | null;        // Decimal serializado
  repuestos:            string[];
  proximoMantenimiento: string | null;        // ISO datetime
  observacionesSalida:  string | null;
  fechaEntrada:         string;               // ISO datetime
  fechaSalida:          string | null;
  equipoId:             string | null;
  herramientaUnidadId:  string | null;
  equipo: { id: string; codigo: string; nombre: string } | null;
  herramientaUnidad: {
    id:              string;
    codigoInterno:   string;
    herramientaTipo: { id: string; nombre: string };
  } | null;
  adjuntos:  MantenimientoAdjunto[];
  createdAt: string;
  updatedAt: string;
};

export type FiltrosMantenimientos = {
  page?:                number;
  limit?:               number;
  equipoId?:            string;
  herramientaUnidadId?: string;
  estado?:              EstadoMantenimiento;
  tipo?:                TipoMantenimiento;
};

export type CrearMantenimientoDto = {
  equipoId?:            string;
  herramientaUnidadId?: string;
  tipo:                 TipoMantenimiento;
  tecnico:              string;
  motivo:               string;
  horometro?:           number;
  costoEstimado?:       number;
  repuestos:            string[];
  proximoMantenimiento?: string;
};

export type ActualizarMantenimientoDto = {
  tecnico?:              string;
  motivo?:               string;
  horometro?:            number;
  costoEstimado?:        number;
  repuestos?:            string[];
  proximoMantenimiento?: string | null;
};

export type RegistrarSalidaDto = {
  costoReal?:           number;
  observacionesSalida?: string;
  repuestos?:           string[];
};

// Fila del historial de rentas — usado tanto en el detalle de equipo
// como en el de unidad de herramienta. El backend devuelve cliente con
// los 5 campos para que el componente componga el nombre segun tipo
// (EMPRESA -> razonSocial; PARTICULAR -> nombre + apellido), igual que
// en cotizaciones y facturas.
export type HistorialRentaItem = {
  cotizacionId: string;
  numeroCotizacion: string;
  fechaAprobacion: string | null;
  cliente: {
    id: string;
    tipo: 'EMPRESA' | 'PARTICULAR';
    razonSocial: string | null;
    nombre: string | null;
    apellido: string | null;
  };
  periodo: PeriodoItem | null;
  periodoCustomLabel: string | null;
  fechaServicio: string | null;
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
  bodegaId: string;
  bodega?: { id: string; nombre: string; parentId: string | null };
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

export type CrearUnidadDto = { bodegaId: string; notas?: string };

export type FiltrosUnidades = { estado?: EstadoHerramienta };

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

export type StockInicialPorBodega = {
  bodegaId: string;
  cantidad: number;
};

export type CrearConsumibleDto = {
  codigo: string;
  nombre: string;
  descripcion?: string;
  categoria: CategoriaConsumible;
  precioUnitario: number;
  // Stock inicial distribuido por bodega — reemplaza al stockActual único.
  stockInicial?: StockInicialPorBodega[];
  stockMinimo: number;
  unidad: string;
  notas?: string;
};

// stockActual no es editable vía PUT — el backend lo rechaza, se ajusta solo
// vía PATCH /:id/stock (ver AjusteStockDto) y queda distribuido por bodega.
export type ActualizarConsumibleDto = Partial<
  Omit<CrearConsumibleDto, 'codigo' | 'stockInicial'>
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
  // Bodega donde aplica el ajuste — el stock vive distribuido por bodega.
  bodegaId: string;
  // El backend valida que sea entero != 0; positivo = entrada, negativo = salida.
  delta: number;
  motivo: string;
};

export type TransferirStockDto = {
  bodegaOrigenId: string;
  bodegaDestinoId: string;
  cantidad: number;
  notas?: string;
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
  // Stock inicial por bodega — reemplaza al stockActual único.
  stockInicial?: StockInicialPorBodega[];
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

// ============================================================
// Servicios (Rama 8)
// ============================================================

export type Servicio = {
  id: string;
  codigo: string;          // SV-001, autogenerado por el backend
  nombre: string;
  descripcion: string | null;
  // Decimal serializado como string — usar decimal.js para operar, formatCurrency para mostrar.
  tarifaBase: string;
  unidad: string;          // texto libre (hora, día, m², proyecto…)
  activo: boolean;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CrearServicioDto = {
  nombre: string;
  descripcion?: string;
  tarifaBase: number;
  unidad: string;
  notas?: string;
};

// El backend rechaza cambios de `codigo`; lo dejamos fuera del DTO de edición.
export type ActualizarServicioDto = Partial<CrearServicioDto>;

export type FiltrosServicios = {
  page?: number;
  limit?: number;
  search?: string;
  activo?: boolean;
};

// ============================================================
// Bodegas (Rama 9)
// ============================================================

// Forma embebida en Bodega (GET /bodegas/:id) — el backend hace un select
// reducido que omite timestamps; no agregarlos sin actualizar también el
// backend.
export type BodegaZona = {
  id: string;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
};

export type Bodega = {
  id: string;
  nombre: string;
  descripcion: string | null;
  direccion: string | null;
  ciudad: string | null;
  activa: boolean;
  // No viene en GET /bodegas (el listado solo trae principales y el backend
  // omite el campo en su `select`). Sí viene en GET /bodegas/:id como
  // string|null. Marcarlo opcional refleja esa dualidad de shapes.
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
  // zonas viene poblado por GET /bodegas/:id (solo si es principal).
  zonas?: BodegaZona[];
  // _count viene poblado por GET /bodegas (listado).
  _count?: { zonas: number };
};

export type CrearBodegaDto = {
  nombre: string;
  descripcion?: string;
  direccion?: string;
  ciudad: string;
};

export type ActualizarBodegaDto = Partial<CrearBodegaDto>;

export type CrearZonaDto = {
  nombre: string;
  descripcion?: string;
};

export type ActualizarZonaDto = Partial<CrearZonaDto>;

// ============================================================
// Proyectos (Rama 9)
// ============================================================

// PAUSADO no aparecía en el plan original pero el backend lo soporta como
// estado intermedio. La máquina de estados completa está documentada en
// el spec (docs/superpowers/specs/2026-05-24-bodegas-proyectos-design.md).
export type EstadoProyecto = 'ACTIVO' | 'PAUSADO' | 'COMPLETADO' | 'CANCELADO';

export type Proyecto = {
  id: string;
  clienteId: string;
  nombre: string;
  descripcion: string | null;
  // Texto compuesto por UbicacionInput: "${detalle}, ${distrito}, ${departamento}".
  ubicacion: string;
  estado: EstadoProyecto;
  createdAt: string;
  updatedAt: string;
  // Embebido por GET /proyectos/:id.
  // Para clientes EMPRESA el campo `nombre` puede ser null; mostrar
  // razonSocial como fallback.
  cliente?: { id: string; razonSocial: string | null; nombre: string | null };
  _count?: { cotizaciones: number };
  // KPIs computados por el backend solo en GET /proyectos/:id.
  // Los montos son Decimal serializados como strings — usar decimal.js.
  kpis?: {
    // Cuando no hay filas agregadas el backend devuelve el número 0 (no "0"),
    // pero los Decimal serializados llegan como string. Cualquier consumidor
    // debe pasar el valor por `new Decimal(...)` antes de operar.
    totalCotizado: string | number;
    totalFacturado: string | number;
    equiposEnObra: number;
  };
};

export type CrearProyectoDto = {
  nombre: string;
  descripcion?: string;
  ubicacion: string;
};

export type ActualizarProyectoDto = Partial<CrearProyectoDto>;

// El backend de proyectos no acepta paginación porque el listado es siempre
// por cliente (sub-recurso) — el cliente raramente tiene >50 proyectos.
export type FiltrosProyectos = {
  estado?: EstadoProyecto;
};

// ============================================================
// Cotizaciones (Rama 10)
// ============================================================

// CANCELADA es estado terminal asignado automaticamente al anular la factura
// generada por la cotizacion. Libera el inventario reservado y no permite
// re-aprobacion — si se quiere rehacer la venta, crear una nueva cotizacion.
export type EstadoCotizacion = 'BORRADOR' | 'ENVIADA' | 'APROBADA' | 'RECHAZADA' | 'CANCELADA';

export type TipoItemCotizacion =
  | 'EQUIPO'
  | 'HERRAMIENTA'
  | 'SERVICIO'
  | 'CONSUMIBLE'
  | 'PIEZA_ANDAMIO'
  | 'CUSTOM';

export type PeriodoItem = 'DIA' | 'SEMANA' | 'QUINCENA' | 'MES' | 'CUSTOM';

export type TipoDocumentoFiscal = 'CF' | 'CCF' | 'SUJETO_EXCLUIDO';

export type CondicionesPago = 'CONTADO' | 'CREDITO' | 'OTRO';

export type CotizacionItem = {
  id: string;
  cotizacionId: string;
  tipo: TipoItemCotizacion;
  descripcion: string;
  // Separamos unidades fisicas (cuantos equipos/herramientas) de dias de renta.
  // Sustituye al antiguo `cantidad` plano para soportar tarifas por dia mas precisas.
  cantidadUnidades: number;
  cantidadDias: number;
  periodo: PeriodoItem;
  periodoCustomLabel: string | null;
  // Decimales serializados como string — usar decimal.js para operar.
  tarifaCatalogo: string;
  tarifaCustom: string | null;
  tarifaAplicada: string;
  esTarifaCustom: boolean;
  subtotal: string;
  orden: number;
  fechaServicio: string | null;
  tecnicoAsignado: string | null;
  equipoId: string | null;
  herramientaTipoId: string | null;
  servicioId: string | null;
  consumibleId: string | null;
  piezaTipoId: string | null;
};

// Forma reducida devuelta por GET /cotizaciones (lista).
export type CotizacionListItem = {
  id: string;
  numeroCotizacion: string;
  estado: EstadoCotizacion;
  total: string;
  fechaCreacion: string;
  fechaVencimiento: string;
  // El backend devuelve los 5 campos para que el frontend componga el label segun
  // tipo: EMPRESA -> razonSocial, PARTICULAR -> nombre + apellido.
  cliente: {
    id: string;
    tipo: 'EMPRESA' | 'PARTICULAR';
    razonSocial: string | null;
    nombre: string | null;
    apellido: string | null;
  };
  creadoPor: { id: string; nombre: string; apellido: string };
  _count: { items: number };
};

// Forma completa devuelta por GET /cotizaciones/:id.
export type Cotizacion = {
  id: string;
  numeroCotizacion: string;
  clienteId: string;
  proyectoId: string | null;
  contactoSolicitanteId: string | null;
  contactoFacturacionId: string | null;
  estado: EstadoCotizacion;
  condicionesPago: CondicionesPago | null;
  tipoDocumentoFiscal: TipoDocumentoFiscal | null;
  porcentajeIva: number;
  depositoPorcentaje: string | null;
  depositoMonto: string | null;
  subtotal: string;
  montoIva: string;
  total: string;
  notas: string | null;
  notasInternas: string | null;
  fechaCreacion: string;
  fechaEnvio: string | null;
  fechaVencimiento: string;
  fechaAprobacion: string | null;
  creadoPor: { id: string; nombre: string; apellido: string; email: string };
  cliente: {
    id: string;
    tipo: 'EMPRESA' | 'PARTICULAR';
    razonSocial: string | null;
    nombre: string | null;
    apellido: string | null;
    tipoDocumento: 'DUI' | 'NIT' | 'PASAPORTE' | 'CARNET_RESIDENTE' | 'OTRO' | null;
    numeroDocumento: string | null;
    email: string | null;
    telefono: string | null;
    // El backend incluye el cliente completo en el GET de cotizacion; manejaQuedan
    // lo necesita el modal "Generar factura" para inicializar el toggle QUEDAN.
    manejaQuedan: boolean;
  };
  proyecto: { id: string; nombre: string } | null;
  contactoSolicitante: { id: string; nombre: string; apellido: string | null; email: string | null } | null;
  contactoFacturacion: { id: string; nombre: string; apellido: string | null; cargo: string | null } | null;
  items: CotizacionItem[];
  factura: { id: string; numeroFactura: string; estado: string } | null;
};

export type CrearCotizacionDto = {
  clienteId: string;
  proyectoId?: string;
  contactoSolicitanteId?: string;
  condicionesPago?: CondicionesPago;
  tipoDocumentoFiscal?: TipoDocumentoFiscal;
  contactoFacturacionId?: string;
  notas?: string;
  notasInternas?: string;
  porcentajeIva?: number;
  fechaVencimiento?: string;
  // Mutuamente excluyentes — validado por Zod y por el backend.
  depositoPorcentaje?: number;
  depositoMonto?: number;
};

export type ActualizarCotizacionDto = Partial<CrearCotizacionDto>;

export type FiltrosCotizaciones = {
  page?: number;
  limit?: number;
  clienteId?: string;
  proyectoId?: string;
  estado?: EstadoCotizacion;
  search?: string;
};

// Discriminated union por `tipo` — espeja exactamente el schema de Zod del backend.
export type AgregarItemDto =
  | {
      tipo: 'EQUIPO';
      equipoId: string;
      // Siempre 1: cada Equipo es una unidad fisica unica. El backend ahora
      // rechaza cualquier otro valor; el frontend ni siquiera expone el input.
      cantidadUnidades?: 1;
      cantidadDias?: number;
      periodo?: PeriodoItem;
      periodoCustomLabel?: string;
      tarifaCustom?: string;
      descripcion?: string;
      fechaServicio?: string;
      tecnicoAsignado?: string;
      orden?: number;
    }
  | {
      tipo: 'HERRAMIENTA';
      herramientaTipoId: string;
      cantidadUnidades: number;
      cantidadDias?: number;
      periodo?: PeriodoItem;
      periodoCustomLabel?: string;
      tarifaCustom?: string;
      descripcion?: string;
      fechaServicio?: string;
      tecnicoAsignado?: string;
      orden?: number;
    }
  | {
      tipo: 'SERVICIO';
      servicioId: string;
      cantidadUnidades?: number;
      // SERVICIO no se renta por dias: el backend rechaza cualquier valor distinto de 1.
      cantidadDias?: 1;
      tarifaCustom?: string;
      descripcion?: string;
      fechaServicio?: string;
      tecnicoAsignado?: string;
      orden?: number;
    }
  | {
      tipo: 'CONSUMIBLE';
      consumibleId: string;
      cantidadUnidades: number;
      // CONSUMIBLE no se renta por dias: el backend rechaza cualquier valor distinto de 1.
      cantidadDias?: 1;
      tarifaCustom?: string;
      descripcion?: string;
      orden?: number;
    }
  | {
      tipo: 'PIEZA_ANDAMIO';
      piezaTipoId: string;
      cantidadUnidades: number;
      cantidadDias?: number;
      periodo?: PeriodoItem;
      periodoCustomLabel?: string;
      tarifaCustom?: string;
      descripcion?: string;
      fechaServicio?: string;
      orden?: number;
    }
  | {
      tipo: 'CUSTOM';
      descripcion: string;
      cantidadUnidades: number;
      cantidadDias?: number;
      tarifaCustom: string; // requerido
      periodo?: PeriodoItem;
      periodoCustomLabel?: string;
      orden?: number;
    };

export type EditarItemDto = {
  cantidadUnidades?: number;
  cantidadDias?: number;
  periodo?: PeriodoItem;
  periodoCustomLabel?: string;
  tarifaCustom?: string | null;
  descripcion?: string;
  fechaServicio?: string | null;
  tecnicoAsignado?: string | null;
  orden?: number;
};

// ============================================================
// Facturas (Rama 11)
// ============================================================

export type EstadoFactura =
  | 'PENDIENTE'
  | 'PARCIAL'
  | 'PAGADA'
  | 'VENCIDA'
  | 'ANULADA';

// PAGADA no esta — el backend la asigna automaticamente cuando los pagos
// cubren el total. El endpoint PATCH /:id/estado la rechaza si se envia.
export type EstadoFacturaEditable =
  | 'PENDIENTE'
  | 'PARCIAL'
  | 'VENCIDA'
  | 'ANULADA';

export type EstadoDTE =
  | 'PENDIENTE'
  | 'PROCESANDO'
  | 'APROBADO'
  | 'RECHAZADO'
  | 'ANULADO';

export type TipoDTE = 'FC' | 'CCF' | 'SUJETO_EXCLUIDO';

// El backend tambien acepta ANTICIPO, pero solo lo asigna el servicio de
// cotizaciones al aprobar — la UI no lo expone como opcion al registrar pago.
export type MetodoPago =
  | 'EFECTIVO'
  | 'TRANSFERENCIA'
  | 'CHEQUE'
  | 'TARJETA'
  | 'OTRO'
  | 'ANTICIPO';

// Forma que devuelve FacturaLlama y persistimos en dteRespuestaMH:
// { id, controlNumber, status, mhResponse: { data: {...}, status, statusText } }.
// La data del rechazo del MH viene anidada en mhResponse.data con codigoMsg
// (no 'codigo'), descripcionMsg y un array observaciones.
export type DteRespuestaMH =
  | {
      id?: string;
      controlNumber?: string | null;
      status?: string;
      mhResponse?: {
        data?: {
          estado?: string;
          codigoMsg?: string;
          descripcionMsg?: string;
          observaciones?: string[];
        };
        status?: number;
        statusText?: string;
      };
    }
  | null;

// Forma reducida del listado GET /facturas — solo los campos del select.
// cliente trae los 5 campos para que la tabla componga el nombre segun tipo
// (EMPRESA -> razonSocial; PARTICULAR -> nombre + apellido). Mismo patron
// que CotizacionListItem.
export type FacturaListItem = {
  id: string;
  numeroFactura: string;
  estado: EstadoFactura;
  estadoDTE: EstadoDTE;
  tipoDTE: TipoDTE | null;
  total: string;
  montoPagado: string;
  saldoPendiente: string;
  fechaEmision: string;
  fechaVencimiento: string;
  // Campos QUEDAN — la tabla los usa para badge en columna Tipo y para la
  // columna Entrega condicional (visible solo con filtro QUEDAN activo).
  esQuedan: boolean;
  fechaEntregaFactura: string | null;
  fechaEntregaReal: string | null;
  cliente: {
    id: string;
    tipo: 'EMPRESA' | 'PARTICULAR';
    razonSocial: string | null;
    nombre: string | null;
    apellido: string | null;
  };
  cotizacion: { id: string; numeroCotizacion: string };
  contactoFacturacion: { id: string; nombre: string } | null;
};

export type Pago = {
  id: string;
  facturaId: string;
  monto: string;
  fecha: string;
  metodoPago: MetodoPago;
  referencia: string | null;
  notas: string | null;
  createdAt: string;
};

// Acta vinculada — forma minima embebida en factura. RAMA 12 extendera con
// el modulo completo de actas.
export type ActaResumen = {
  id: string;
  numeroActa: string;
  estado: string;
};

// Forma completa devuelta por GET /facturas/:id.
export type Factura = {
  id: string;
  numeroFactura: string;
  cotizacionId: string;
  clienteId: string;
  contactoFacturacionId: string | null;
  estado: EstadoFactura;
  fechaEmision: string;
  fechaVencimiento: string;
  // Decimales serializados como string — usar decimal.js para operar.
  subtotal: string;
  porcentajeIva: string;
  montoIva: string;
  total: string;
  montoPagado: string;
  saldoPendiente: string;
  tipoDTE: TipoDTE | null;
  estadoDTE: EstadoDTE;
  dteId: string | null;
  dteControlNumber: string | null;
  dteRespuestaMH: DteRespuestaMH;
  notas: string | null;
  // Flujo QUEDAN: la factura se entrega fisicamente al cliente en una fecha
  // posterior. fechaEntregaFactura es la fecha pactada; fechaEntregaReal se
  // sella cuando se marca como entregada.
  esQuedan: boolean;
  fechaEntregaFactura: string | null;
  fechaEntregaReal: string | null;
  createdAt: string;
  updatedAt: string;
  cliente: Cliente;
  cotizacion: Pick<
    Cotizacion,
    'id' | 'numeroCotizacion' | 'items'
  > & {
    items: CotizacionItem[];
  };
  contactoFacturacion: Contacto | null;
  pagos: Pago[];
  actasEntrega: ActaResumen[];
};

export type FiltrosFacturas = {
  page?: number;
  limit?: number;
  clienteId?: string;
  estado?: EstadoFactura;
  estadoDTE?: EstadoDTE;
  fechaDesde?: string;
  fechaHasta?: string;
  // Filtros del flujo QUEDAN — el backend los acepta como query params.
  esQuedan?: boolean;
  entregaPendiente?: boolean;
};

export type ActualizarFacturaDto = {
  notas?: string;
  fechaVencimiento?: string;
};

export type CambiarEstadoFacturaDto = {
  estado: EstadoFacturaEditable;
  motivo?: string;
};

export type EmitirDTEDto = {
  tipoDTE: TipoDTE;
};

export type CrearPagoDto = {
  monto: string;
  fecha: string;
  metodoPago: Exclude<MetodoPago, 'ANTICIPO'>;
  referencia?: string;
  notas?: string;
};

// Solo referencia y notas son editables. Monto, fecha y metodoPago no se
// exponen porque cambiarlos rompería la trazabilidad contable. Al menos uno
// de los dos debe venir definido (el backend rechaza con 400 si ambos son
// undefined).
export type ActualizarPagoDto = {
  referencia?: string;
  notas?: string;
};

// ── Listado global de pagos (RAMA 13) ──────────────────────────────────
// Shape devuelta por GET /api/v1/pagos. El backend embebe factura+cliente
// (5 campos del cliente) para evitar requests adicionales y soportar
// la búsqueda libre por número de factura o nombre de cliente.
export type PagoListItem = {
  id: string;
  monto: string;
  fecha: string;
  metodoPago: MetodoPago;
  referencia: string | null;
  notas: string | null;
  createdAt: string;
  factura: {
    id: string;
    numeroFactura: string;
    estado: EstadoFactura;
    cliente: {
      id: string;
      tipo: 'EMPRESA' | 'PARTICULAR';
      razonSocial: string | null;
      nombre: string | null;
      apellido: string | null;
    };
  };
};

export type FiltrosPagos = {
  page?: number;
  limit?: number;
  busqueda?: string;
  metodoPago?: MetodoPago;
  clienteId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
};

// ── Actas y Recepciones (RAMA 12) ─────────────────────────────────────────────

export type ActaItemTipo = 'EQUIPO' | 'HERRAMIENTA' | 'CONSUMIBLE' | 'PIEZA';
export type CondicionItem = 'BUENO' | 'REGULAR' | 'MALO';
export type EstadoActa = 'PENDIENTE' | 'DESPACHADO' | 'ENTREGADO' | 'DEVUELTA_PARCIAL' | 'DEVUELTO';
export type EstadoActaItem = 'PENDIENTE_DEVOLUCION' | 'DEVUELTO';

export type ActaItem = {
  id: string;
  cotizacionItemId: string;
  equipo?: { id: string; nombre: string; codigo: string } | null;
  herramientaUnidad?: {
    id: string;
    codigoInterno: string;
    herramientaTipo: { nombre: string };
  } | null;
  consumible?: { id: string; nombre: string } | null;
  piezaTipo?:  { id: string; nombre: string } | null;
  cantidadConsumible?: number | null;
  cantidadRecibida?:   number | null;
  condicionSalida?:    CondicionItem | null;
  observacionesSalida?: string | null;
  horometroSalida?:    string | null;
  combustibleSalida?:  string | null;
  estadoOperacional?:  boolean | null;
  accesoriosCompletos?: boolean | null;
  limpieza?:           boolean | null;
  estado: EstadoActaItem;
};

export type ActaListItem = {
  id: string;
  numeroActa: string;
  estado: EstadoActa;
  fechaDespacho: string | null;
  fechaEntrega: string | null;
  fechaDevolucion: string | null;
  createdAt: string;
  bodegaOrigen: { id: string; nombre: string };
  usuarioDespacho: { id: string; nombre: string; apellido: string } | null;
  factura: {
    id: string;
    numeroFactura: string;
    clienteId: string;
    // razonSocial es null para clientes PARTICULAR; el frontend hace fallback
    // a nombre+apellido para renderizar el nombre legible.
    cliente: { id: string; razonSocial: string | null; nombre: string | null; apellido: string | null };
  };
  _count: { items: number };
};

export type Acta = {
  id: string;
  numeroActa: string;
  estado: EstadoActa;
  facturaId: string;
  bodegaOrigenId: string;
  bodegaOrigen: { id: string; nombre: string };
  direccionEntrega: string | null;
  notas: string | null;
  observacionesSalida: string | null;
  numeroActaFisico: string | null;
  horaDespacho: string | null;
  horaEntrega: string | null;
  fechaDespacho: string | null;
  fechaEntrega: string | null;
  fechaDevolucion: string | null;
  periodoRentaInicio: string | null;
  periodoRentaFin: string | null;
  usuarioDespacho: { id: string; nombre: string; apellido: string } | null;
  contactoReceptor: { id: string; nombre: string } | null;
  receptorNombre: string | null;
  receptorDocumento: string | null;
  factura: { id: string; numeroFactura: string; clienteId: string };
  items: ActaItem[];
  createdAt: string;
};

export type FiltrosActas = {
  page?: number;
  limit?: number;
  estado?: EstadoActa;
  busqueda?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  clienteId?: string;
};

// Respuesta de GET /facturas/:id/actas/items-disponibles-despacho.
// Cada elemento es un CotizacionItem (no un ActaEntregaItem). El `id` ES el
// cotizacionItemId que va al DTO al crear el acta. La `cantidad` se usa para
// consumibles/piezas (cantidadConsumible/cantidadRecibida en el acta).
export type ItemDisponibleDespacho = {
  id: string;
  cotizacionId: string;
  equipoId: string | null;
  herramientaTipoId: string | null;
  consumibleId: string | null;
  piezaTipoId: string | null;
  cantidad: number;
  descripcion: string;
  equipo:          { id: string; nombre: string; codigo: string } | null;
  herramientaTipo: { id: string; nombre: string } | null;
  consumible:      { id: string; nombre: string } | null;
  piezaTipo:       { id: string; nombre: string } | null;
};

export type RecepcionItem = {
  id: string;
  actaEntregaItemId: string;
  condicionRetorno?: CondicionItem | null;
  observacionesRetorno?: string | null;
  horometroRetorno?: string | null;
  combustibleRetorno?: string | null;
  actaEntregaItem: ActaItem & {
    actaEntrega: { id: string; numeroActa: string };
  };
};

// ── Inventario de bodega (response de GET /bodegas/:id/inventario) ──────
// Agrega los 4 tipos de inventario asignados a una bodega para el card del
// detalle. consumibles/piezas vienen solo con stock > 0 según el backend.
export type InventarioBodega = {
  equipos: Array<{
    id: string;
    codigo: string;
    nombre: string;
    categoria: string;
    estado: string;
    marca: string | null;
    modelo: string | null;
  }>;
  unidadesHerramienta: Array<{
    id: string;
    codigoInterno: string;
    estado: string;
    tipo: { id: string; nombre: string; categoria: string };
  }>;
  consumibles: Array<{
    id: string;
    codigo: string;
    nombre: string;
    categoria: string;
    unidad: string;
    stock: number;
  }>;
  piezasAndamio: Array<{
    id: string;
    nombre: string;
    stock: number;
  }>;
};

export type RecepcionListItem = {
  id: string;
  numeroActa: string;
  numeroActaFisico: string | null;
  fechaRecepcion: string;
  horaRecepcion: string | null;
  observaciones: string | null;
  usuarioRecepcion: { id: string; nombre: string; apellido: string };
  factura: {
    id: string;
    numeroFactura: string;
    clienteId: string;
    cliente: { id: string; razonSocial: string | null; nombre: string | null; apellido: string | null };
  };
  _count: { items: number };
};

export type Recepcion = RecepcionListItem & { items: RecepcionItem[] };

export type FiltrosRecepciones = Omit<FiltrosActas, 'estado'>;

// Items pendientes de devolución agrupados por acta (GET /facturas/:id/actas/items-pendientes-devolucion)
export type GrupoPendienteDevolucion = {
  actaEntregaId: string;
  numeroActa: string;
  fechaEntrega: string | null;
  items: ActaItem[];
};

// DTOs de mutaciones
// Crear acta solo selecciona ítems. Los datos de inspección (condicionSalida,
// horometroSalida, etc.) se capturan después vía useActualizarInspeccion.
// numeroActaFisico y observacionesSalida ahora van en DespacharActaDto.
export type CrearActaDto = {
  bodegaOrigenId: string;
  direccionEntrega?: string;
  notas?: string;
  horaEntrega?: string;
  periodoRentaInicio?: string;
  periodoRentaFin?: string;
  items: Array<{
    cotizacionItemId: string;
    equipoId?: string;
    herramientaUnidadId?: string;
    consumibleId?: string;
    piezaTipoId?: string;
    cantidadConsumible?: number;
    cantidadRecibida?: number;
  }>;
};

export type EditarActaDto = {
  bodegaOrigenId?: string;
  direccionEntrega?: string;
  notas?: string;
  observacionesSalida?: string;
  numeroActaFisico?: string;
  horaDespacho?: string;
  periodoRentaInicio?: string;
  periodoRentaFin?: string;
};

// Para PATCH /actas/:id/items — captura datos de inspección por línea cuando
// el bodeguero copia los valores del picking físico al sistema.
export type ActualizarInspeccionDto = {
  items: Array<{
    id: string;
    condicionSalida?: CondicionItem;
    observacionesSalida?: string;
    horometroSalida?: number;
    combustibleSalida?: string;
    estadoOperacional?: boolean;
    accesoriosCompletos?: boolean;
    limpieza?: boolean;
  }>;
};

export type DespacharActaDto = {
  estado: 'DESPACHADO';
  usuarioDespachoId: string;
  numeroActaFisico: string;
  observacionesSalida?: string;
};

export type EntregarActaDto = {
  estado: 'ENTREGADO';
  contactoReceptorId?: string;
  receptorNombre?: string;
  receptorDocumento?: string;
  receptorEmail?: string;
  horaEntrega?: string;
  enviarCorreo?: boolean;
};

export type CrearRecepcionDto = {
  numeroActaFisico?: string;
  horaRecepcion?: string;
  observaciones?: string;
  items: Array<{
    actaEntregaItemId: string;
    condicionRetorno?: CondicionItem;
    observacionesRetorno?: string;
    horometroRetorno?: number;
    combustibleRetorno?: string;
  }>;
};

// ─── Notas de Crédito ────────────────────────────────────────────────

export type TipoNotaCredito = 'TOTAL' | 'PARCIAL';

export type NotaCreditoListItem = {
  id: string;
  numero: string;
  tipo: TipoNotaCredito;
  motivo: string;
  total: string;
  estadoDTE: EstadoDTE;
  createdAt: string;
  factura: { id: string; numeroFactura: string };
};

export type NotaCredito = {
  id: string;
  numero: string;
  facturaId: string;
  factura: {
    id: string;
    numeroFactura: string;
    total: string;
    estado: EstadoFactura;
    tipoDTE: TipoDTE | null;
    estadoDTE: EstadoDTE;
    cliente: Cliente;
  };
  motivo: string;
  tipo: TipoNotaCredito;
  subtotal: string;
  montoIva: string;
  total: string;
  estadoDTE: EstadoDTE;
  dteId: string | null;
  dteControlNumber: string | null;
  dteRespuestaMH: DteRespuestaMH;
  createdAt: string;
  updatedAt: string;
};

export type FiltrosNotasCredito = {
  page?: number;
  limit?: number;
  facturaId?: string;
  estadoDTE?: EstadoDTE;
};

export type CrearNotaCreditoDto = {
  facturaId: string;
  motivo: string;
  tipo: TipoNotaCredito;
  // Requeridos solo cuando tipo === 'PARCIAL'. El backend valida la
  // combinacion; los enviamos como string para preservar precision Decimal.
  subtotal?: string;
  montoIva?: string;
  total?: string;
};

export type EmitirDTENotaCreditoDto = { tipoDTE: 'NC' };

// ─── Retenciones ─────────────────────────────────────────────────────

export type ComprobanteRetencionListItem = {
  id: string;
  numeroCR: string;
  porcentaje: string;
  monto: string;
  fecha: string;
  createdAt: string;
  factura: { id: string; numeroFactura: string };
  cliente: { id: string; nombre: string | null; razonSocial: string | null };
};

export type ComprobanteRetencion = {
  id: string;
  numeroCR: string;
  facturaId: string;
  factura: {
    id: string;
    numeroFactura: string;
    total: string;
    estado: EstadoFactura;
    fechaEmision: string;
    cliente: Cliente;
  };
  clienteId: string;
  cliente: Cliente;
  porcentaje: string;
  monto: string;
  fecha: string;
  notas: string | null;
  createdAt: string;
};

export type FiltrosRetenciones = {
  page?: number;
  limit?: number;
  facturaId?: string;
  clienteId?: string;
};

export type RegistrarRetencionDto = {
  facturaId: string;
  numeroCR: string;
  porcentaje: 1 | 13;
  // Decimal como string para no perder precision en la red.
  monto: string;
  // ISO datetime que satisface z.string().datetime() del backend.
  fecha: string;
  notas?: string;
};

// ─── Deposito de Garantia ─────────────────────────────────────────────

export type EstadoDeposito =
  | 'PENDIENTE'
  | 'RECIBIDO'
  | 'DEVUELTO'
  | 'RETENIDO_PARCIAL'
  | 'RETENIDO_TOTAL';

export interface DepositoGarantia {
  id: string;
  cotizacionId: string;
  monto: string;
  estado: EstadoDeposito;
  fechaRecibido: string | null;
  fechaDevuelto: string | null;
  montoRetenido: string | null;
  razonRetencion: string | null;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Rama 17: Ajustes (usuarios + configuracion + reportes) ─────────

// RolUsuario se duplica respecto a User.rol (línea ~25) intencionalmente:
// la forma de User llega del login y no debería cambiar de shape; este alias
// nombrado se usa en los formularios y filtros de /ajustes para escribir
// menos uniones literales por todo el módulo.
export type RolUsuario = 'ADMIN' | 'GERENTE' | 'OPERADOR' | 'LOGISTICA' | 'VISUALIZADOR';

export type Usuario = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
  mfaActivo: boolean;
  ultimoAcceso: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CrearUsuarioDto = {
  nombre: string;
  apellido: string;
  email: string;
  contrasena: string;
  rol: RolUsuario;
};

export type ActualizarUsuarioDto = {
  nombre: string;
  apellido: string;
  email: string;
  rol: RolUsuario;
  // contrasena opcional: si no se envía, el backend conserva el hash existente.
  contrasena?: string;
};

export type FiltrosUsuarios = {
  page?: number;
  limit?: number;
  busqueda?: string;
  rol?: RolUsuario;
};

export type ConfiguracionEmpresa = {
  nombreEmpresa: string;
  nit: string | null;
  ncr: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  telefonoCotizaciones: string | null;
  emailCotizaciones: string | null;
  logoUrl: string | null;
  sitioWeb: string | null;
  prefijoCotizacion: string;
  prefijoFactura: string;
  prefijoActa: string;
  emailRemitente: string | null;
  nombreRemitente: string | null;
  emailCopiaInterna: string | null;
  // El backend serializa porcentajeIvaDefault como string Decimal —
  // convertir con Number(...) o new Decimal(...) antes de operar.
  porcentajeIvaDefault: string;
  updatedAt: string;
};

// DTO de actualización: todos los campos son opcionales excepto nombreEmpresa.
// El backend hace upsert, así que un PUT parcial está permitido.
export type ActualizarConfiguracionDto = {
  nombreEmpresa: string;
  nit?: string;
  ncr?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  telefonoCotizaciones?: string;
  emailCotizaciones?: string;
  logoUrl?: string;
  sitioWeb?: string;
  prefijoCotizacion?: string;
  prefijoFactura?: string;
  prefijoActa?: string;
  emailRemitente?: string;
  nombreRemitente?: string;
  emailCopiaInterna?: string;
  // porcentajeIvaDefault va como number en el DTO (el backend lo convierte a Decimal).
  porcentajeIvaDefault?: number;
};

export type ConfiguracionReportes = {
  reporteSemanalActivo: boolean;
  reporteSemanalEmails: string[];
  reporteMensualActivo: boolean;
  // Día del mes 1-28 (el backend rechaza 29-31 porque no existen en todos los meses).
  reporteMensualDia: number;
  reporteMensualEmails: string[];
  formatoProgramado: 'pdf' | 'excel' | 'ambos';
  updatedAt: string;
};

export type ActualizarConfigReportesDto = Partial<ConfiguracionReportes>;

// ─── Rama 18: Perfil y Auditlog ─────────────────────────────────────

// Perfil reusa el tipo Usuario por conveniencia, pero el backend devuelve solo 7 campos
// (id, nombre, apellido, email, rol, mfaActivo, ultimoAcceso) — los 3 faltantes
// (activo, createdAt, updatedAt) son undefined en runtime; no usarlos en componentes de perfil.
export type Perfil = Usuario;

export type ActualizarPerfilDto = {
  nombre: string;
  apellido: string;
};

export type CambiarContrasenaDto = {
  passwordActual: string;
  passwordNuevo: string;
};

export type ConfigurarMfaResponse = {
  // URI otpauth:// completo, incluye secret + issuer + image. El frontend lo
  // pasa directo a <QRCodeSVG /> y extrae el secret para mostrarlo en modo manual.
  otpauthUri: string;
};

export type TotpDto = {
  // 6 dígitos exactos — el backend rechaza otra cosa con 400.
  totpCode: string;
};

export type AuditLog = {
  id: string;
  usuarioId: string | null;
  // null si el usuario fue eliminado después del evento.
  usuario: { nombre: string; apellido: string; email: string } | null;
  entidad: string;
  entidadId: string;
  accion: string;
  camposAntes: Record<string, unknown> | null;
  camposDespues: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

// Nombres del parámetro coinciden con el backend (NO `fechaDesde`/`fechaHasta`).
export type FiltrosAuditLog = {
  page?: number;
  limit?: number;
  entidad?: string;
  entidadId?: string;
  usuarioId?: string;
  accion?: string;
  desde?: string;
  hasta?: string;
};
