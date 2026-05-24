'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PiezaForm } from '@/components/andamios/piezas/PiezaForm';
import { usePieza } from '@/hooks/use-andamios';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarAndamios } from '@/lib/andamios';

export default function EditarPiezaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const { data: pieza, isLoading, isError } = usePieza(id);

  useEffect(() => {
    if (rol && !puedeEjecutarAndamios('editarPieza', rol)) {
      toast.error('No tenés permisos para esta acción.');
      router.replace(`/andamios/piezas/${id}`);
    }
  }, [rol, router, id]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (isError || !pieza) {
    return (
      <EmptyState
        icon="alertTriangle"
        title="No se encontró la pieza"
        message="Puede haber sido eliminada o el ID es incorrecto."
      />
    );
  }

  return <PiezaForm modo="editar" pieza={pieza} />;
}
