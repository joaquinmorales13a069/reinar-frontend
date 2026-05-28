'use client';

import { useSearchParams } from 'next/navigation';
import { RetencionForm } from '@/components/retenciones/RetencionForm';

export default function NuevaRetencionPage() {
  // Cuando se entra desde el detalle de factura llega `?facturaId=…`
  // y la pre-seleccionamos.
  const sp = useSearchParams();
  const facturaIdPre = sp.get('facturaId') ?? undefined;
  return <RetencionForm facturaIdPre={facturaIdPre} />;
}
