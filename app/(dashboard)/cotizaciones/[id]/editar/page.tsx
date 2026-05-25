'use client';

import { use } from 'react';
import { CotizacionWizard } from '@/components/cotizaciones/wizard/CotizacionWizard';

// Next.js 15+ entrega `params` como Promise; usar `use()` para desempaquetar
// en Client Components — RSC no aplica acá porque el wizard lleva hooks.
export default function EditarCotizacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CotizacionWizard cotizacionId={id} />;
}
