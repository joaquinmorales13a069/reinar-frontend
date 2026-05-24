'use client';

import { formatCurrency } from '@/lib/utils';
import type { Proyecto } from '@/types/api';

export function ProyectoKpisCard({ proyecto }: { proyecto: Proyecto }) {
  // Los KPIs solo vienen poblados por GET /proyectos/:id. Defensive: si por
  // alguna razón no están, mostramos los placeholders en cero.
  const totalCotizado = proyecto.kpis?.totalCotizado ?? '0';
  const totalFacturado = proyecto.kpis?.totalFacturado ?? '0';
  const equiposEnObra = proyecto.kpis?.equiposEnObra ?? 0;

  return (
    <div className="rounded-lg border border-bd bg-surface p-4">
      <h3 className="text-sm font-semibold mb-3">Resumen del proyecto</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-md bg-bg-sunken p-4">
          <div className="text-2xs font-semibold text-tx-3 uppercase tracking-wider">Total cotizado</div>
          <div className="font-mono text-xl font-medium text-tx mt-1">
            {formatCurrency(totalCotizado)}
          </div>
        </div>
        <div className="rounded-md bg-bg-sunken p-4">
          <div className="text-2xs font-semibold text-tx-3 uppercase tracking-wider">Total facturado</div>
          <div className="font-mono text-xl font-medium text-ok mt-1">
            {formatCurrency(totalFacturado)}
          </div>
        </div>
        <div className="rounded-md bg-bg-sunken p-4">
          <div className="text-2xs font-semibold text-tx-3 uppercase tracking-wider">Equipos en obra</div>
          <div className="font-mono text-xl font-medium text-tx mt-1">{equiposEnObra}</div>
        </div>
      </div>
    </div>
  );
}
