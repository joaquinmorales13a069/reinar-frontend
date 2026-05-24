'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Decimal from 'decimal.js';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { useServicio, useCambiarEstadoServicio } from '@/hooks/use-servicios';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarServicio } from '@/lib/servicios';
import { formatCurrency } from '@/lib/utils';

const btnSec =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';

export default function ServicioDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const { data: servicio, isLoading, isError } = useServicio(id);
  const cambiarEstado = useCambiarEstadoServicio();
  const [confirmEstado, setConfirmEstado] = useState(false);

  const puedeEditar = puedeEjecutarServicio('editar', rol);
  const puedeEstado = puedeEjecutarServicio('cambiarEstado', rol);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (isError || !servicio) {
    return (
      <EmptyState
        icon="alertTriangle"
        title="No se encontró el servicio"
        message="Puede haber sido eliminado o el ID es incorrecto."
      />
    );
  }

  return (
    <div>
      <PageHeader
        title={servicio.nombre}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span className="font-mono text-xs text-tx-2">{servicio.codigo}</span>
            <span className="text-tx-3">·</span>
            <Badge
              status={servicio.activo ? 'ACTIVO' : 'INACTIVO'}
              kind={servicio.activo ? 'ok' : 'neutral'}
            />
          </span>
        }
        back
        backLabel="Servicios"
        onBack={() => router.push('/servicios')}
        actions={
          <div className="flex gap-2">
            {puedeEditar && (
              <Link href={`/servicios/${servicio.id}/editar`} className={btnSec}>
                <Icon name="edit" size={14} /> Editar
              </Link>
            )}
            {puedeEstado && (
              <button
                type="button"
                className={btnSec}
                onClick={() => setConfirmEstado(true)}
              >
                <Icon name={servicio.activo ? 'x' : 'check'} size={14} />{' '}
                {servicio.activo ? 'Desactivar' : 'Activar'}
              </button>
            )}
          </div>
        }
      />

      {confirmEstado && (
        <ConfirmRow
          message={
            servicio.activo
              ? `¿Desactivar el servicio "${servicio.nombre}"? No podrá agregarse a nuevas cotizaciones.`
              : `¿Activar el servicio "${servicio.nombre}"?`
          }
          confirmLabel={servicio.activo ? 'Desactivar' : 'Activar'}
          variant={servicio.activo ? 'danger' : 'primary'}
          onCancel={() => setConfirmEstado(false)}
          onConfirm={async () => {
            await cambiarEstado.mutateAsync({ id: servicio.id, activo: !servicio.activo });
            setConfirmEstado(false);
          }}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-4">
          <Card>
            <h3 className="text-sm font-semibold mb-2">Descripción</h3>
            <p className="text-sm text-tx-2 m-0 leading-relaxed">
              {servicio.descripcion || <span className="text-tx-3">Sin descripción.</span>}
            </p>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold mb-2">Notas internas</h3>
            <p className="text-sm m-0 leading-relaxed">
              {servicio.notas ? (
                <span className="text-tx-2">{servicio.notas}</span>
              ) : (
                <span className="text-tx-3">Sin notas registradas.</span>
              )}
            </p>
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <h3 className="text-sm font-semibold mb-2">Tarifa</h3>
            <div className="rounded-md bg-bg-sunken p-4">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-3xl font-medium">
                  {formatCurrency(new Decimal(servicio.tarifaBase).toNumber())}
                </span>
                <span className="text-tx-3 text-sm">/ {servicio.unidad}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
