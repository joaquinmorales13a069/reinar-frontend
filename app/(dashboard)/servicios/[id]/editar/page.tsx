'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ServicioForm } from '@/components/servicios/ServicioForm';
import { useServicio } from '@/hooks/use-servicios';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarServicio } from '@/lib/servicios';

export default function ServicioEditarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeEditar = puedeEjecutarServicio('editar', rol);
  const { data: servicio, isLoading, isError } = useServicio(id);

  useEffect(() => {
    if (rol && !puedeEditar) router.replace(`/servicios/${id}`);
  }, [rol, puedeEditar, router, id]);

  if (!puedeEditar) return null;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (isError || !servicio) {
    return (
      <EmptyState
        icon="alertTriangle"
        title="No se encontró el servicio"
        message="Puede haber sido eliminado o el ID es incorrecto."
      />
    );
  }

  return <ServicioForm modo="editar" servicio={servicio} />;
}
