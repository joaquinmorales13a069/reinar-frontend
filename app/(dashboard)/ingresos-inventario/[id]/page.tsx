'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Decimal from 'decimal.js';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { useIngresoInventario } from '@/hooks/use-ingresos-inventario';
import { useAuthStore } from '@/stores/auth.store';
import { formatDate, formatCurrency } from '@/lib/utils';

const ROLES_INGRESOS = ['ADMIN', 'GERENTE', 'LOGISTICA'];

export default function IngresoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const { data: ingreso, isLoading, isError } = useIngresoInventario(id);

  useEffect(() => {
    if (rol && !ROLES_INGRESOS.includes(rol)) router.replace('/dashboard');
  }, [rol, router]);

  if (!rol || !ROLES_INGRESOS.includes(rol)) return null;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (isError || !ingreso) {
    return (
      <EmptyState
        icon="alertTriangle"
        title="No se encontró el ingreso"
        message="Puede haber sido eliminado o el ID es incorrecto."
      />
    );
  }

  const items = ingreso.items ?? [];

  return (
    <div>
      <PageHeader
        title={ingreso.numeroFacturaCompra ? `Ingreso — ${ingreso.numeroFacturaCompra}` : 'Detalle de ingreso'}
        subtitle={ingreso.fechaCompra ? formatDate(ingreso.fechaCompra) : undefined}
        back
        backLabel="Ingresos de inventario"
        onBack={() => router.push('/ingresos-inventario')}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start mb-4">
        <Card>
          <h3 className="text-sm font-semibold mb-3">Datos de la compra</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-tx-3">N° Factura</dt>
            <dd className="font-mono text-tx-2">{ingreso.numeroFacturaCompra ?? '—'}</dd>
            <dt className="text-tx-3">Proveedor</dt>
            <dd className="text-tx-2">{ingreso.proveedor?.nombre ?? '—'}</dd>
            <dt className="text-tx-3">Fecha de compra</dt>
            <dd className="text-tx-2">{ingreso.fechaCompra ? formatDate(ingreso.fechaCompra) : '—'}</dd>
            <dt className="text-tx-3">N° Acta interna</dt>
            <dd className="font-mono text-tx-2">{ingreso.numeroActaInterna ?? '—'}</dd>
            <dt className="text-tx-3">Registrado por</dt>
            <dd className="text-tx-2">
              {ingreso.registradoPor
                ? `${ingreso.registradoPor.nombre} ${ingreso.registradoPor.apellido}`
                : '—'}
            </dd>
          </dl>
        </Card>
        {ingreso.notas && (
          <Card>
            <h3 className="text-sm font-semibold mb-2">Notas</h3>
            <p className="text-sm text-tx-2 leading-relaxed">{ingreso.notas}</p>
          </Card>
        )}
      </div>

      <div className="rounded-lg border border-bd bg-surface overflow-hidden">
        <div className="px-4 py-3 bg-bg-sunken border-b border-bd">
          <h3 className="text-sm font-semibold">Ítems del ingreso</h3>
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-6 text-sm text-tx-3 text-center">Sin ítems registrados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-sunken text-2xs uppercase tracking-wider text-tx-3">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Destino</th>
                  <th className="text-right px-4 py-2 font-medium w-24">Cantidad</th>
                  <th className="text-right px-4 py-2 font-medium w-36">Valor unitario</th>
                  <th className="text-right px-4 py-2 font-medium w-36">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  // Resolver el nombre del destino según qué relación viene poblada
                  let destinoLabel = '—';
                  if (item.equipo) {
                    destinoLabel = `${item.equipo.codigo} — ${item.equipo.nombre}`;
                  } else if (item.herramientaUnidad) {
                    destinoLabel = `Unidad ${item.herramientaUnidad.codigoInterno}`;
                  } else if (item.consumible) {
                    destinoLabel = `${item.consumible.codigo} — ${item.consumible.nombre}`;
                  }

                  const valorUnit = new Decimal(item.valorUnitarioCompra);
                  const total = valorUnit.times(item.cantidad);

                  return (
                    <tr key={item.id} className="border-t border-bd">
                      <td className="px-4 py-3">{destinoLabel}</td>
                      <td className="px-4 py-3 text-right font-mono">{item.cantidad}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(valorUnit.toNumber())}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{formatCurrency(total.toNumber())}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
