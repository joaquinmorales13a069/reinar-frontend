'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProveedorForm } from '@/components/proveedores/ProveedorForm';
import { useProveedor } from '@/hooks/use-proveedores';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarProveedor } from '@/lib/proveedores';

export default function ProveedorEditarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeEditar = puedeEjecutarProveedor('editar', rol);
  const { data: proveedor, isLoading, isError } = useProveedor(id);

  useEffect(() => {
    if (rol && !puedeEditar) router.replace(`/proveedores/${id}`);
  }, [rol, puedeEditar, router, id]);

  if (!puedeEditar) return null;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (isError || !proveedor) {
    return (
      <EmptyState
        icon="alertTriangle"
        title="No se encontró el proveedor"
        message="Puede haber sido eliminado o el ID es incorrecto."
      />
    );
  }

  return <ProveedorForm modo="editar" proveedor={proveedor} />;
}
