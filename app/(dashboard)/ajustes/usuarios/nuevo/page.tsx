'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { esAdmin } from '@/lib/ajustes';
import { UsuarioForm } from '@/components/ajustes/UsuarioForm';

export default function UsuarioNuevoPage() {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeCrear = esAdmin(rol);

  // Defensa en profundidad: el layout de /ajustes ya filtra por rol de acceso,
  // pero crear/editar usuarios es solo ADMIN. GERENTE entra a /ajustes pero no
  // debe poder abrir esta página directamente.
  useEffect(() => {
    if (rol && !puedeCrear) router.replace('/ajustes?tab=usuarios');
  }, [rol, puedeCrear, router]);

  if (!puedeCrear) return null;
  return <UsuarioForm modo="crear" />;
}
