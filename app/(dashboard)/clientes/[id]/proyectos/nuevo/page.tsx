'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProyectoForm } from '@/components/proyectos/ProyectoForm';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useCliente } from '@/hooks/use-clientes';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarProyecto } from '@/lib/proyectos';

export default function NuevoProyectoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeCrear = puedeEjecutarProyecto('crear', rol);
  const { data: cliente, isLoading, isError } = useCliente(id);

  useEffect(() => {
    if (rol && !puedeCrear) router.replace(`/clientes/${id}`);
  }, [rol, puedeCrear, router, id]);

  // El backend rechaza con 409 si el cliente no está ACTIVO. Redirigimos al
  // detalle para que el usuario lo active primero o elija otro cliente.
  useEffect(() => {
    if (cliente && cliente.estado !== 'ACTIVO') router.replace(`/clientes/${id}`);
  }, [cliente, router, id]);

  if (!puedeCrear) return null;
  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (isError || !cliente) {
    return (
      <EmptyState
        icon="alertTriangle"
        title="No se encontró el cliente"
        message="Puede haber sido eliminado o el ID es incorrecto."
      />
    );
  }
  if (cliente.estado !== 'ACTIVO') return null;

  const nombreVisible = cliente.tipo === 'EMPRESA'
    ? cliente.razonSocial ?? '—'
    : [cliente.nombre, cliente.apellido].filter(Boolean).join(' ') || '—';

  return (
    <ProyectoForm
      modo="crear"
      cliente={{ id: cliente.id, nombre: nombreVisible }}
    />
  );
}
