'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { FacturaEstadoBadge } from '@/components/facturas/FacturaEstadoBadge';
import { ClienteFechasCard } from '@/components/facturas/detalle/ClienteFechasCard';
import { ItemsFacturadosCard } from '@/components/facturas/detalle/ItemsFacturadosCard';
import { ProgresoCobroCard } from '@/components/facturas/detalle/ProgresoCobroCard';
import { ActasVinculadasCard } from '@/components/facturas/detalle/ActasVinculadasCard';
import { useFactura } from '@/hooks/use-facturas';

export default function FacturaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: factura, isLoading, error } = useFactura(id);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error) {
    return (
      <EmptyState
        icon="fileText"
        title="No se pudo cargar"
        message="Hubo un problema al cargar la factura. Refrescá la página para reintentar."
      />
    );
  }
  if (!factura) {
    return <EmptyState icon="fileText" title="No encontrada" message="La factura no existe." />;
  }

  // Subtitle: nombre del cliente segun tipo (EMPRESA -> razonSocial, PARTICULAR -> nombre).
  const nombreCliente =
    factura.cliente.tipo === 'EMPRESA'
      ? factura.cliente.razonSocial ?? '—'
      : [factura.cliente.nombre, factura.cliente.apellido].filter(Boolean).join(' ') || '—';

  return (
    <div>
      <PageHeader
        title={factura.numeroFactura}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span>{nombreCliente}</span>
            <span className="text-tx-3">·</span>
            <FacturaEstadoBadge estado={factura.estado} />
          </span>
        }
        back
        backLabel="Facturas"
        onBack={() => router.push('/facturas')}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          <ClienteFechasCard factura={factura} />
          <ItemsFacturadosCard factura={factura} />
          <ActasVinculadasCard factura={factura} />
        </div>
        <div className="space-y-4">
          <ProgresoCobroCard factura={factura} />
        </div>
      </div>
    </div>
  );
}
