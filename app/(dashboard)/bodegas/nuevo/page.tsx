'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { BodegaForm } from '@/components/bodegas/BodegaForm';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarBodega } from '@/lib/bodegas';

export default function NuevaBodegaPage() {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeCrear = puedeEjecutarBodega('crear', rol);

  // Si un usuario sin permisos llega a la URL directa, lo regresamos al listado.
  // El botón ya está oculto en BodegasPage para esos roles.
  useEffect(() => {
    if (rol && !puedeCrear) router.replace('/bodegas');
  }, [rol, puedeCrear, router]);

  if (!puedeCrear) return null;

  return <BodegaForm modo="crear" />;
}
