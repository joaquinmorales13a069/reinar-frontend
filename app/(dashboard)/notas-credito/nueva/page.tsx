'use client';

import { useSearchParams } from 'next/navigation';
import { NotaCreditoForm } from '@/components/notas-credito/NotaCreditoForm';

export default function NuevaNotaCreditoPage() {
  // Cuando se entra desde el detalle de factura, llega `?facturaId=…`
  // y la pre-seleccionamos.
  const sp = useSearchParams();
  const facturaIdPre = sp.get('facturaId') ?? undefined;
  return <NotaCreditoForm facturaIdPre={facturaIdPre} />;
}
