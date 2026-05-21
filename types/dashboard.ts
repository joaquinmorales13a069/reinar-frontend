export type DashboardKpis = {
  rentasActivas: number;
  maquinariaEnMantenimiento: {
    equipos: number;
    herramientas: number;
    total: number;
  };
  totalClientes: number;
  cotizacionesPendientes: number;
  facturasPorCobrar: {
    count: number;
    total: string; // Decimal serializado — usar formatCurrency(), nunca parseFloat()
  };
  facturasVencidas: number;
  ingresosMes: string; // Decimal serializado
  utilizacionEquipos: {
    disponibles: number;
    rentados: number;
    mantenimiento: number;
    inactivos: number;
    total: number;
  };
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
  dtesPendientes: number;
};
