'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ZonaForm } from '@/components/bodegas/ZonaForm';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBodega } from '@/hooks/use-bodegas';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarBodega } from '@/lib/bodegas';

export default function EditarZonaPage({
  params,
}: {
  params: Promise<{ id: string; zonaId: string }>;
}) {
  const { id, zonaId } = use(params);
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

  const zona = bodega.zonas?.find((z) => z.id === zonaId);
  if (!zona) {
    return (
      <EmptyState
        icon="alertTriangle"
        title="Zona no encontrada"
        message="La zona puede haber sido eliminada o el ID es incorrecto."
      />
    );
  }

  return (
    <ZonaForm
      modo="editar"
      bodegaPadre={{ id: bodega.id, nombre: bodega.nombre }}
      zona={zona}
    />
  );
}
