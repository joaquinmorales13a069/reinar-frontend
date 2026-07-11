'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { FseForm } from '@/components/fse/FseForm';
import { useFse, useActualizarFse } from '@/hooks/use-fse';
import { useAuthStore } from '@/stores/auth.store';
import type { CrearFseDto } from '@/types/api';

export default function EditarFsePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuthStore();
  const { data: fse, isLoading, error } = useFse(id);
  const actualizar = useActualizarFse();

  // Solo ADMIN, GERENTE y OPERADOR pueden editar FSE.
  // LOGISTICA y VISUALIZADOR no tienen permiso de escritura.
  const puedeEditar = user && ['ADMIN', 'GERENTE', 'OPERADOR'].includes(user.rol);

  // Redirigir roles sin permisos de escritura a la vista de solo lectura.
  useEffect(() => {
    if (user && !puedeEditar) {
      router.replace(`/fse/${id}`);
    }
  }, [user, puedeEditar, router, id]);

  // No renderizar form si no tiene permisos.
  if (!puedeEditar) return null;

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error || !fse) {
    return (
      <EmptyState
        icon="fileText"
        title="No se pudo cargar"
        message="Hubo un problema al cargar la FSE. Refrescá la página para reintentar."
      />
    );
  }

  // El backend solo permite editar mientras el DTE está pendiente de emisión
  // o fue rechazado (422 ESTADO_INVALIDO en otro caso).
  if (fse.estadoDTE !== 'PENDIENTE' && fse.estadoDTE !== 'RECHAZADO') {
    return (
      <EmptyState
        icon="shield"
        title="No se puede editar"
        message="Esta FSE ya tiene un DTE en proceso o aprobado y no admite ediciones."
      />
    );
  }

  async function guardar(dto: CrearFseDto) {
    try {
      await actualizar.mutateAsync({ id, data: dto });
      router.push(`/fse/${id}`);
    } catch {
      // useActualizarFse ya muestra toast.error internamente
    }
  }

  return (
    <FseForm
      fseInicial={fse}
      tituloPagina={fse.numeroFse}
      subtituloPagina="Editar formulario único de sujeto excluido."
      submitLabel="Guardar cambios"
      isGuardando={actualizar.isPending}
      onGuardar={guardar}
    />
  );
}
