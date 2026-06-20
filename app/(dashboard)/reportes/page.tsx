'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/auth.store';
import type { TipoReporte, FormatoReporte } from '@/hooks/use-reportes';

type IconName = 'dollar' | 'receipt' | 'fileText' | 'tool' | 'clipboard' | 'building' | 'wrench' | 'users' | 'user' | 'box';

interface TipoCard {
  id: TipoReporte | 'inventario';
  icon: IconName;
  nombre: string;
  desc: string;
  formatos: ReadonlyArray<FormatoReporte | 'snapshot'>;
  href: string;
}

// (IDS_INVENTARIO eliminado — la visibilidad se evalúa por id en el filter de abajo)

// Los tipos coinciden 1:1 con `reportes.routes.ts` del backend. El orden replica el
// prototipo (operativos primero, financieros después) en lugar del orden de las rutas.
const TIPOS: ReadonlyArray<TipoCard> = [
  { id: 'ingresos',       icon: 'dollar',   nombre: 'Ingresos por período',     desc: 'Comparativo de ingresos facturados con desglose por cliente y categoría.', formatos: ['pdf', 'excel', 'csv'], href: '/reportes/generar?tipo=ingresos' },
  { id: 'cuentas-cobrar', icon: 'receipt',  nombre: 'Cuentas por cobrar',       desc: 'Saldos pendientes por antigüedad con buckets 0-30, 31-60, 61-90 y 90+.',  formatos: ['pdf', 'excel', 'csv'], href: '/reportes/generar?tipo=cuentas-cobrar' },
  { id: 'cotizaciones',   icon: 'fileText', nombre: 'Cotizaciones por período', desc: 'Pipeline por estado, tasa de conversión y desempeño por vendedor.',       formatos: ['pdf', 'excel', 'csv'], href: '/reportes/generar?tipo=cotizaciones' },
  { id: 'equipos',        icon: 'tool',     nombre: 'Utilización de equipos',   desc: 'Ranking de equipos más y menos rentados con ingresos generados.',        formatos: ['pdf', 'excel', 'csv'], href: '/reportes/generar?tipo=equipos' },
  { id: 'actas',          icon: 'clipboard',nombre: 'Logística de actas',       desc: 'Conteos de entregas y recepciones con tiempos promedio del período.',    formatos: ['pdf', 'excel', 'csv'], href: '/reportes/generar?tipo=actas' },
  { id: 'proyectos',      icon: 'building', nombre: 'Proyectos activos',        desc: 'Valor cotizado, facturado y saldo pendiente por proyecto.',              formatos: ['pdf', 'excel', 'csv'], href: '/reportes/generar?tipo=proyectos' },
  { id: 'servicios',      icon: 'wrench',   nombre: 'Servicios programados',    desc: 'Listado de servicios del período con totales y comparativa.',            formatos: ['pdf', 'excel', 'csv'], href: '/reportes/generar?tipo=servicios' },
  { id: 'clientes',       icon: 'users',    nombre: 'Actividad de clientes',    desc: 'Nuevos, recurrentes, sin actividad y top por ingresos.',                 formatos: ['pdf', 'excel', 'csv'], href: '/reportes/generar?tipo=clientes' },
  { id: 'vendedores',     icon: 'user',     nombre: 'Actividad de vendedores',  desc: 'Ranking de vendedores por cotizaciones cerradas e ingresos facturados.', formatos: ['pdf', 'excel', 'csv'], href: '/reportes/generar?tipo=vendedores' },
  { id: 'mantenimientos', icon: 'wrench',   nombre: 'Mantenimientos',           desc: 'Conteos, costos y repuestos por tipo/categoría de mantenimiento.',      formatos: ['pdf', 'excel', 'csv'], href: '/reportes/generar?tipo=mantenimientos' },
  // Inventario es un reporte adicional no listado en el plan original: el backend
  // lo expone como snapshot JSON sin rango de fechas y se consume directo en /reportes/inventario.
  { id: 'inventario',     icon: 'box',      nombre: 'Inventario actual',        desc: 'Snapshot por bodega de equipos, herramientas, consumibles y piezas.',     formatos: ['snapshot'],            href: '/reportes/inventario' },
];

// Reutilizamos los tokens semánticos `*-soft` del badge para no inventar paleta nueva
// y mantener consistencia con el resto de chips de estado del ERP.
const FORMATO_STYLES: Record<FormatoReporte | 'snapshot', string> = {
  pdf:      'text-danger bg-danger-soft border-danger-soft',
  excel:    'text-ok bg-ok-soft border-ok-soft',
  csv:      'text-info bg-info-soft border-info-soft',
  snapshot: 'text-warn bg-warn-soft border-warn-soft',
};

const FORMATO_LABEL: Record<FormatoReporte | 'snapshot', string> = {
  pdf:      'PDF',
  excel:    'Excel',
  csv:      'CSV',
  snapshot: 'En pantalla',
};

export default function ReportesPage() {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);

  // El backend restringe casi todos los endpoints de reportes a ADMIN/GERENTE.
  // Inventario (snapshot) permite también LOGISTICA y OPERADOR.
  // Mantenimientos permite ADMIN/GERENTE/LOGISTICA, pero NO OPERADOR.
  // VISUALIZADOR no tiene acceso a ninguno, así que lo regresamos al dashboard.
  const puedeVerExportables    = rol === 'ADMIN' || rol === 'GERENTE';
  const puedeVerMantenimientos = puedeVerExportables || rol === 'LOGISTICA';
  const puedeVerInventario     = puedeVerMantenimientos || rol === 'OPERADOR';

  useEffect(() => {
    if (rol && !puedeVerInventario) router.replace('/dashboard');
  }, [rol, puedeVerInventario, router]);

  if (rol && !puedeVerInventario) return null;

  const visibles = TIPOS.filter((t) =>
    t.id === 'inventario'
      ? puedeVerInventario
      : t.id === 'mantenimientos'
        ? puedeVerMantenimientos
        : puedeVerExportables,
  );

  return (
    <div>
      <PageHeader
        title="Reportes"
        subtitle="Generá reportes operativos y financieros. Cada tipo permite descargar en distintos formatos."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibles.map((tipo) => (
          <Link
            key={tipo.id}
            href={tipo.href}
            className="flex gap-3 p-4 rounded-lg border border-bd bg-surface hover:bg-bg-sunken hover:border-accent transition-colors"
          >
            <div className="shrink-0 w-10 h-10 rounded-md bg-accent-soft text-accent flex items-center justify-center">
              <Icon name={tipo.icon} size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-tx">{tipo.nombre}</div>
              <div className="text-xs text-tx-2 mt-1 line-clamp-2">{tipo.desc}</div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {tipo.formatos.map((f) => (
                  <span
                    key={f}
                    className={`text-2xs font-medium uppercase tracking-wide px-1.5 py-0.5 rounded border ${FORMATO_STYLES[f]}`}
                  >
                    {FORMATO_LABEL[f]}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {!puedeVerExportables && puedeVerInventario && (
        <p className="text-xs text-tx-3 mt-6">
          {rol === 'OPERADOR'
            ? 'Tu rol permite consultar el reporte de inventario. Para mantenimientos y reportes financieros u operativos contactá a un administrador.'
            : 'Tu rol permite consultar los reportes de inventario y mantenimientos. Para los reportes financieros y operativos contactá a un administrador.'}
        </p>
      )}
    </div>
  );
}
