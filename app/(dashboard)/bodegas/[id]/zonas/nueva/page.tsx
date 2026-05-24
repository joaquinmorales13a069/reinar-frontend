'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ZonaForm } from '@/components/bodegas/ZonaForm';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBodega } from '@/hooks/use-bodegas';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarBodega } from '@/lib/bodegas';

export default function NuevaZonaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeCrear = puedeEjecutarBodega('crear', rol);
  const { data: bodega, isLoading, isError } = useBodega(id);

  useEffect(() => {
    if (rol && !puedeCrear) router.replace(`/bodegas/${id}`);
  }, [rol, puedeCrear, router, id]);

  // Guard preventivo: el backend rechaza crear zonas en bodega inactiva.
  // El botón ya está oculto en el detalle, pero por URL directa redirigimos.
  useEffect(() => {
    if (bodega && !bodega.activa) router.replace(`/bodegas/${id}`);
  }, [bodega, router, id]);

  if (!puedeCrear) return null;
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

  if (!bodega.activa) return null;

  return <ZonaForm modo="crear" bodegaPadre={{ id: bodega.id, nombre: bodega.nombre }} />;
}
