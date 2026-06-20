'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { useProveedor, useCambiarActivoProveedor } from '@/hooks/use-proveedores';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarProveedor } from '@/lib/proveedores';

const btnSec =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';

export default function ProveedorDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const { data: proveedor, isLoading, isError } = useProveedor(id);
  const cambiarActivo = useCambiarActivoProveedor();
  const [confirmActivo, setConfirmActivo] = useState(false);

  const puedeEditar = puedeEjecutarProveedor('editar', rol);
  const puedeCambiarActivo = puedeEjecutarProveedor('cambiarActivo', rol);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (isError || !proveedor) {
    return (
      <EmptyState
        icon="alertTriangle"
        title="No se encontró el proveedor"
        message="Puede haber sido eliminado o el ID es incorrecto."
      />
    );
  }

  return (
    <div>
      <PageHeader
        title={proveedor.nombre}
        subtitle={
          <Badge
            status={proveedor.activo ? 'ACTIVO' : 'INACTIVO'}
            kind={proveedor.activo ? 'ok' : 'neutral'}
          />
        }
        back
        backLabel="Proveedores"
        onBack={() => router.push('/proveedores')}
        actions={
          <div className="flex gap-2">
            {puedeEditar && (
              <Link href={`/proveedores/${proveedor.id}/editar`} className={btnSec}>
                <Icon name="edit" size={14} /> Editar
              </Link>
            )}
            {puedeCambiarActivo && (
              <button
                type="button"
                className={btnSec}
                onClick={() => setConfirmActivo(true)}
              >
                <Icon name={proveedor.activo ? 'x' : 'check'} size={14} />{' '}
                {proveedor.activo ? 'Desactivar' : 'Activar'}
              </button>
            )}
          </div>
        }
      />

      {confirmActivo && (
        <ConfirmRow
          message={
            proveedor.activo
              ? `¿Desactivar el proveedor "${proveedor.nombre}"?`
              : `¿Activar el proveedor "${proveedor.nombre}"?`
          }
          confirmLabel={proveedor.activo ? 'Desactivar' : 'Activar'}
          variant={proveedor.activo ? 'danger' : 'primary'}
          onCancel={() => setConfirmActivo(false)}
          onConfirm={async () => {
            await cambiarActivo.mutateAsync({ id: proveedor.id, activo: !proveedor.activo });
            setConfirmActivo(false);
          }}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Card>
          <h3 className="text-sm font-semibold mb-3">Datos fiscales</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-tx-3">NRC</dt>
            <dd className="font-mono text-tx-2">{proveedor.nrc ?? '—'}</dd>
            <dt className="text-tx-3">NIT</dt>
            <dd className="font-mono text-tx-2">{proveedor.nit ?? '—'}</dd>
          </dl>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold mb-3">Contacto</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-tx-3">Persona</dt>
            <dd className="text-tx-2">{proveedor.contacto ?? '—'}</dd>
            <dt className="text-tx-3">Teléfono</dt>
            <dd className="text-tx-2">{proveedor.telefono ?? '—'}</dd>
            <dt className="text-tx-3">Correo</dt>
            <dd className="text-tx-2 break-all">{proveedor.email ?? '—'}</dd>
          </dl>
        </Card>
        {proveedor.notas && (
          <div className="lg:col-span-2">
            <Card>
              <h3 className="text-sm font-semibold mb-2">Notas internas</h3>
              <p className="text-sm text-tx-2 leading-relaxed">{proveedor.notas}</p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
