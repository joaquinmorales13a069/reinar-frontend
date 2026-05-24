export type CategoriaFlota =
  | 'COMPRESOR_GENERADOR'
  | 'SANDBLASTING'
  | 'ANDAMIO_PLATAFORMA'
  | 'COMPACTADOR_RODILLO'
  | 'HERRAMIENTA_ESPECIALIZADA'
  | 'OTRO'
  | 'ANDAMIO_PIEZA';

// Una fila por categoría. usoInterno/inactivo se cuentan en `total` pero el
// FleetWidget sólo pinta rentado/mantenimiento/disponible en la barra visual.
export type UtilizacionCategoria = {
  categoria: CategoriaFlota;
  rentado: number;
  mantenimiento: number;
  disponible: number;
  usoInterno: number;
  inactivo: number;
  total: number;
};

// Mes en formato YYYY-MM para parseo determinista; total es Decimal serializado.
export type IngresoMensual = {
  mes: string;
  total: string;
};

export type DashboardKpis = {
  rentasActivas: number;
  maquinariaEnMantenimiento: {
    equipos: number;
    herramientas: number;
    total: number;
  };
  // Reservado para widget de clientes activos — aún no tiene sección propia en el dashboard
  totalClientes: number;
  cotizacionesPendientes: number;
  facturasPorCobrar: {
    count: number;
    total: string; // Decimal serializado — usar formatCurrency(), nunca parseFloat()
  };
  facturasVencidas: number;
  ingresosMes: string; // Decimal serializado del mes corriente (legacy)
  ingresosUltimos6Meses: IngresoMensual[]; // 5 meses previos + mes actual a la fecha
  utilizacionEquipos: {
    disponibles: number;
    rentados: number;
    mantenimiento: number;
    inactivos: number;
    total: number;
  };
  utilizacionPorCategoria: UtilizacionCategoria[];
  serviciosEstaSemana: number;
  topClientesPorIngresos: {
    clienteId: string;
    nombre: string;
    total: string; // Decimal serializado
  }[];
  actividadReciente: {
    entidad: string;
    entidadId: string;
    accion: string;
    usuario: string | null;
    createdAt: string; // ISO-8601
  }[];
  actasPendientesEntrega: number;
  // Reservado para badge de DTEs pendientes en el topbar o una futura card de Admin/Gerente
  dtesPendientes: number;
};
