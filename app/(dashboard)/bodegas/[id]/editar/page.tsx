'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BodegaForm } from '@/components/bodegas/BodegaForm';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBodega } from '@/hooks/use-bodegas';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarBodega } from '@/lib/bodegas';

export default function EditarBodegaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeEditar = puedeEjecutarBodega('editar', rol);
  const { data: bodega, isLoading, isError } = useBodega(id);

  useEffect(() => {
    if (rol && !puedeEditar) router.replace(`/bodegas/${id}`);
  }, [rol, puedeEditar, router, id]);

  if (!puedeEditar) return null;
  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (isError || !bodega) {
    return (
      <EmptyState
        icon="alertTriangle"
        title="No se encontró la bodega"
        message="Puede haber sido eliminada o el ID es incorrecto."
      />
    );
  }

  return <BodegaForm modo="editar" bodega={bodega} />;
}
