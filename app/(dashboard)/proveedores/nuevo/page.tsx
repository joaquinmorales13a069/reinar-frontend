'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProveedorForm } from '@/components/proveedores/ProveedorForm';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarProveedor } from '@/lib/proveedores';

export default function ProveedorNuevoPage() {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeCrear = puedeEjecutarProveedor('crear', rol);

  useEffect(() => {
    if (rol && !puedeCrear) router.replace('/proveedores');
  }, [rol, puedeCrear, router]);

  if (!puedeCrear) return null;

  return <ProveedorForm modo="crear" />;
}
