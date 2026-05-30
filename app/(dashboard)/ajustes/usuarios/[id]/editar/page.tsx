'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { esAdmin } from '@/lib/ajustes';
import { useUsuario } from '@/hooks/use-usuarios';
import { UsuarioForm } from '@/components/ajustes/UsuarioForm';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';

export default function UsuarioEditarPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeEditar = esAdmin(rol);

  // Misma defensa que la página de crear: GERENTE puede ver /ajustes pero no
  // debe poder editar usuarios directamente por URL.
  useEffect(() => {
    if (rol && !puedeEditar) router.replace('/ajustes?tab=usuarios');
  }, [rol, puedeEditar, router]);

  const { data: usuario, isLoading, isError } = useUsuario(params.id);

  if (!puedeEditar) return null;
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }
  if (isError || !usuario) {
    return (
      <EmptyState
        icon="alertTriangle"
        title="Usuario no encontrado"
        message="No se pudo cargar el usuario solicitado."
      />
    );
  }

  return <UsuarioForm modo="editar" usuario={usuario} />;
}
