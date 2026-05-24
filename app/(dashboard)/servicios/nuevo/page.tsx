'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ServicioForm } from '@/components/servicios/ServicioForm';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarServicio } from '@/lib/servicios';

export default function ServicioNuevoPage() {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeCrear = puedeEjecutarServicio('crear', rol);

  // Defensa en profundidad: el backend también valida el rol, pero redirigir
  // evita exponer el formulario a un rol sin permisos. El hidratado del rol es
  // síncrono después del primer render del AuthHydrator, por lo que esperamos
  // a tener un rol definido antes de decidir.
  useEffect(() => {
    if (rol && !puedeCrear) router.replace('/servicios');
  }, [rol, puedeCrear, router]);

  if (!puedeCrear) return null;

  return <ServicioForm modo="crear" />;
}
