'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { CotizacionStatusBadge } from '@/components/cotizaciones/CotizacionStatusBadge';
import { ItemsTabla } from '@/components/cotizaciones/detalle/ItemsTabla';
import { ResumenLateral } from '@/components/cotizaciones/detalle/ResumenLateral';
import { AccionesEstado } from '@/components/cotizaciones/detalle/AccionesEstado';
import { VariantesCard } from '@/components/cotizaciones/detalle/VariantesCard';
import { DepositoPanel } from '@/components/cotizaciones/DepositoPanel';
import { useCotizacion } from '@/hooks/use-cotizaciones';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

export default function CotizacionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: cot, isLoading, error } = useCotizacion(id);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }
  // Distinguimos error de red/servidor de "no encontrada" para no mentirle al
  // usuario cuando la cotizacion existe pero el GET fallo por otra razon.
  if (error) {
    return (
      <EmptyState
        icon="fileText"
        title="No se pudo cargar"
        message="Hubo un problema al cargar la cotización. Refrescá la página para reintentar."
      />
    );
  }
  if (!cot) {
    return (
      <EmptyState icon="fileText" title="No encontrada" message="La cotización no existe o fue eliminada." />
    );
  }

  // Los botones de escritura se ocultan en VISUALIZADOR. El sidebar de Cliente,
  // fechas y timeline sigue visible — lectura para todos.
  const puedeEscribir = user?.rol !== 'VISUALIZADOR';

  return (
    <div>
      <PageHeader
        title={cot.numeroCotizacion}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span>{cot.cliente.razonSocial ?? cot.cliente.nombre}</span>
            <span className="text-tx-3">·</span>
            <span className="font-mono text-xs">{formatDate(cot.fechaCreacion)}</span>
            <CotizacionStatusBadge estado={cot.estado} />
          </span>
        }
        back
        backLabel="Cotizaciones"
        onBack={() => router.push('/cotizaciones')}
        actions={puedeEscribir ? <AccionesEstado cotizacion={cot} /> : null}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          <ItemsTabla cotizacion={cot} />

          <DepositoPanel
            cotizacionId={cot.id}
            cotizacionEstado={cot.estado}
            depositoMontoCotizacion={cot.depositoMonto}
          />

          {(cot.notas || cot.notasInternas) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cot.notas && (
                <div className="bg-bg border border-bd rounded-md p-4">
                  <h3 className="text-sm font-medium text-tx mb-2">Notas para el cliente</h3>
                  <p className="text-sm text-tx-2 whitespace-pre-wrap">{cot.notas}</p>
                </div>
              )}
              {cot.notasInternas && puedeEscribir && (
                <div className="bg-bg-sunken border border-bd rounded-md p-4">
                  <h3 className="text-sm font-medium text-tx mb-2">Notas internas</h3>
                  <p className="text-sm text-tx-2 whitespace-pre-wrap">{cot.notasInternas}</p>
                </div>
              )}
            </div>
          )}

          <VariantesCard cotizacion={cot} />
        </div>

        <ResumenLateral cotizacion={cot} />
      </div>
    </div>
  );
}
