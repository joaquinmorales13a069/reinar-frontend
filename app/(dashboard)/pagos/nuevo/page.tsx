'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { Spinner } from '@/components/ui/Spinner';
import { SelectorFacturaPendiente } from '@/components/pagos/SelectorFacturaPendiente';
import { FacturaSeleccionadaCard } from '@/components/pagos/FacturaSeleccionadaCard';
import { RegistrarPagoForm } from '@/components/pagos/RegistrarPagoForm';
import { useFacturasPendientes } from '@/hooks/use-pagos';
import type { FacturaListItem } from '@/types/api';

export default function NuevoPagoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Soporta deep-link desde el detalle de factura (?facturaId=xxx) para que
  // el usuario no tenga que volver a buscar lo que ya tenía en pantalla.
  const facturaIdPre = searchParams.get('facturaId');

  const [factura, setFactura] = useState<FacturaListItem | null>(null);
  const { data: pendientes = [], isLoading } = useFacturasPendientes();

  // Pre-selección desde query param: corre una vez cuando termina de
  // cargarse la lista. Si el ID no está entre las elegibles (factura ya
  // pagada o anulada), se ignora y el usuario debe buscar manualmente.
  useEffect(() => {
    if (facturaIdPre && !factura && pendientes.length > 0) {
      const f = pendientes.find((x) => x.id === facturaIdPre);
      // sync de query param a estado local: corre una vez cuando los datos
      // llegan; el usuario puede limpiar la selección después con "Cambiar factura"
      if (f) setFactura(f); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [facturaIdPre, pendientes, factura]);

  return (
    <div>
      <PageHeader
        title="Registrar pago"
        subtitle="Aplicá un pago a una factura pendiente. Los pagos no pueden editarse después."
        back
        backLabel="Volver a pagos"
        onBack={() => router.push('/pagos')}
      />

      <FormSection title="Factura">
        {factura ? (
          <FacturaSeleccionadaCard factura={factura} onClear={() => setFactura(null)} />
        ) : isLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : (
          <SelectorFacturaPendiente
            facturas={pendientes}
            loading={false}
            onSelect={setFactura}
          />
        )}
      </FormSection>

      {factura && (
        <FormSection title="Datos del pago">
          <RegistrarPagoForm
            facturaId={factura.id}
            saldoPendiente={factura.saldoPendiente}
            onSuccess={() => router.push('/pagos')}
          />
        </FormSection>
      )}
    </div>
  );
}
