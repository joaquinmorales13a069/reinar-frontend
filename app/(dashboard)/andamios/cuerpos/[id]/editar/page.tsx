'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { CuerpoForm } from '@/components/andamios/cuerpos/CuerpoForm';
import { useCuerpo } from '@/hooks/use-andamios';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarAndamios } from '@/lib/andamios';

export default function EditarCuerpoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const { data: cuerpo, isLoading, isError } = useCuerpo(id);

  useEffect(() => {
    if (rol && !puedeEjecutarAndamios('editarCuerpo', rol)) {
      toast.error('No tenés permisos para esta acción.');
      router.replace(`/andamios/cuerpos/${id}`);
    }
  }, [rol, router, id]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (isError || !cuerpo) {
    return (
      <EmptyState
        icon="alertTriangle"
        title="No se encontró la configuración"
        message="Puede haber sido eliminada o el ID es incorrecto."
      />
    );
  }

  return <CuerpoForm modo="editar" cuerpo={cuerpo} />;
}
