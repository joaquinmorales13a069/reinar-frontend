'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProyectoForm } from '@/components/proyectos/ProyectoForm';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useProyecto } from '@/hooks/use-proyectos';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarProyecto } from '@/lib/proyectos';

export default function EditarProyectoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeEditar = puedeEjecutarProyecto('editar', rol);
  const { data: proyecto, isLoading, isError } = useProyecto(id);

  useEffect(() => {
    if (rol && !puedeEditar) router.replace(`/proyectos/${id}`);
  }, [rol, puedeEditar, router, id]);

  if (!puedeEditar) return null;
  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (isError || !proyecto) {
    return (
      <EmptyState
        icon="alertTriangle"
        title="No se encontró el proyecto"
        message="Puede haber sido eliminado o el ID es incorrecto."
      />
    );
  }

  const clienteNombre = proyecto.cliente?.razonSocial ?? proyecto.cliente?.nombre ?? '—';

  return (
    <ProyectoForm
      modo="editar"
      cliente={{ id: proyecto.clienteId, nombre: clienteNombre }}
      proyecto={proyecto}
    />
  );
}
