'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { NotaCreditoForm } from '@/components/notas-credito/NotaCreditoForm';

// useSearchParams() obliga a Suspense en build estatico (Next 16).
function Contenido() {
  const sp = useSearchParams();
  const facturaIdPre = sp.get('facturaId') ?? undefined;
  return <NotaCreditoForm facturaIdPre={facturaIdPre} />;
}

export default function NuevaNotaCreditoPage() {
  return (
    <Suspense fallback={null}>
      <Contenido />
    </Suspense>
  );
}
