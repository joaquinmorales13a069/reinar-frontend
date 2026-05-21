// components/dashboard/KpiGrid.tsx
import { KpiCard } from './KpiCard';
import type { KpiCardProps, KpiDir } from './KpiCard';
import { formatCurrency } from '@/lib/utils';
import type { DashboardKpis } from '@/types/dashboard';
import type { User } from '@/types/api';

type KpiId =
  | 'rentas' | 'cotPend' | 'ingresos' | 'porCobrar'
  | 'vencidas' | 'mantto' | 'actas' | 'servicios';

type Rol = User['rol'];

// Mapa declarativo de visibilidad por rol.
// LOGISTICA ve solo inventario/operaciones físicas; OPERADOR no ve métricas de inventario.
const KPI_POR_ROL: Record<Rol, KpiId[]> = {
  ADMIN:        ['rentas', 'cotPend', 'ingresos', 'porCobrar', 'vencidas', 'mantto', 'actas', 'servicios'],
  GERENTE:      ['rentas', 'cotPend', 'ingresos', 'porCobrar', 'vencidas', 'mantto', 'actas', 'servicios'],
  OPERADOR:     ['rentas', 'cotPend', 'ingresos', 'porCobrar', 'vencidas', 'actas', 'servicios'],
  LOGISTICA:    ['mantto', 'actas'],
  VISUALIZADOR: ['rentas', 'cotPend', 'ingresos', 'porCobrar', 'vencidas', 'mantto', 'actas', 'servicios'],
};

function buildAllKpis(data: DashboardKpis): Array<KpiCardProps & { id: KpiId }> {
  return [
    {
      id: 'rentas',
      label: 'Rentas activas',
      value: String(data.rentasActivas),
      icon: 'package',
      dir: 'flat',
    },
    {
      id: 'cotPend',
      label: 'Cotizaciones pend.',
      value: String(data.cotizacionesPendientes),
      icon: 'fileText',
      dir: (data.cotizacionesPendientes > 0 ? 'up' : 'flat') as KpiDir,
    },
    {
      id: 'ingresos',
      label: 'Ingresos del mes',
      value: formatCurrency(data.ingresosMes),
      icon: 'chartBar',
      dir: 'up',
    },
    {
      id: 'porCobrar',
      label: 'Por cobrar',
      value: formatCurrency(data.facturasPorCobrar.total),
      subvalue: `${data.facturasPorCobrar.count} facturas`,
      icon: 'dollar',
      dir: (data.facturasPorCobrar.count > 0 ? 'down' : 'flat') as KpiDir,
    },
    {
      id: 'vencidas',
      label: 'Facturas vencidas',
      value: String(data.facturasVencidas),
      icon: 'alertTriangle',
      dir: (data.facturasVencidas > 0 ? 'down' : 'flat') as KpiDir,
    },
    {
      id: 'mantto',
      label: 'En mantenimiento',
      value: String(data.maquinariaEnMantenimiento.total),
      subvalue: `${data.maquinariaEnMantenimiento.equipos} eq. · ${data.maquinariaEnMantenimiento.herramientas} herr.`,
      icon: 'wrench',
      dir: 'flat',
    },
    {
      id: 'actas',
      label: 'Actas pendientes',
      value: String(data.actasPendientesEntrega),
      icon: 'clipboard',
      dir: (data.actasPendientesEntrega > 0 ? 'down' : 'flat') as KpiDir,
    },
    {
      id: 'servicios',
      label: 'Servicios esta sem.',
      value: String(data.serviciosEstaSemana),
      icon: 'tool',
      dir: 'flat',
    },
  ];
}

type KpiGridProps = {
  data: DashboardKpis;
  rol: Rol;
};

export function KpiGrid({ data, rol }: KpiGridProps) {
  const visibles = KPI_POR_ROL[rol] ?? KPI_POR_ROL.VISUALIZADOR;
  const kpis = buildAllKpis(data).filter((k) => visibles.includes(k.id));

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {kpis.map(({ id, ...props }) => (
        <KpiCard key={id} {...props} />
      ))}
    </div>
  );
}
