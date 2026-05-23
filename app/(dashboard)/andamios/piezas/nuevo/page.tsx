'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PiezaForm } from '@/components/andamios/piezas/PiezaForm';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarAndamios } from '@/lib/andamios';

export default function NuevaPiezaPage() {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);

  // Guardia client-side: si VISUALIZADOR llega por URL directa, redirigimos.
  useEffect(() => {
    if (rol && !puedeEjecutarAndamios('crearPieza', rol)) {
      toast.error('No tenés permisos para esta acción.');
      router.replace('/andamios');
    }
  }, [rol, router]);

  return <PiezaForm modo="crear" />;
}
