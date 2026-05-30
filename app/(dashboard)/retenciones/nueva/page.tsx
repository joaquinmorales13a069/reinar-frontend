'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { RetencionForm } from '@/components/retenciones/RetencionForm';

// useSearchParams() obliga a Suspense en build estatico (Next 16).
function Contenido() {
  const sp = useSearchParams();
  const facturaIdPre = sp.get('facturaId') ?? undefined;
  return <RetencionForm facturaIdPre={facturaIdPre} />;
}

export default function NuevaRetencionPage() {
  return (
    <Suspense fallback={null}>
      <Contenido />
    </Suspense>
  );
}
