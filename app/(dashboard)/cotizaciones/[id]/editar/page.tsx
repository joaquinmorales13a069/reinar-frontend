'use client';

import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import { CotizacionWizard } from '@/components/cotizaciones/wizard/CotizacionWizard';

// Next.js 15+ entrega `params` como Promise; usar `use()` para desempaquetar
// en Client Components — RSC no aplica acá porque el wizard lleva hooks.
export default function EditarCotizacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const sp = useSearchParams();
  const paso = Number(sp.get('paso'));
  // Renovar renta redirige con ?paso=1 para abrir directamente el step de ítems.
  const initialStep = paso === 1 || paso === 2 || paso === 3 ? (paso as 1 | 2 | 3) : 0;
  return <CotizacionWizard cotizacionId={id} initialStep={initialStep} />;
}
