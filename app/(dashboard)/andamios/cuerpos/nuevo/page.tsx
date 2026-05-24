'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CuerpoForm } from '@/components/andamios/cuerpos/CuerpoForm';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarAndamios } from '@/lib/andamios';

export default function NuevoCuerpoPage() {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);

  useEffect(() => {
    if (rol && !puedeEjecutarAndamios('crearCuerpo', rol)) {
      toast.error('No tenés permisos para esta acción.');
      router.replace('/andamios');
    }
  }, [rol, router]);

  return <CuerpoForm modo="crear" />;
}
