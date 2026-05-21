'use client';

import { use } from 'react';
import { useEquipo } from '@/hooks/use-equipos';
import { EquipoForm } from '@/components/equipos/EquipoForm';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import Link from 'next/link';

export default function EditarEquipoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <EditarEquipoClient id={id} />;
}

function EditarEquipoClient({ id }: { id: string }) {
  const { data: equipo, isLoading, isError } = useEquipo(id);

  if (isLoading) {
    return <div className="flex justify-center p-12"><Spinner /></div>;
  }
  if (isError || !equipo) {
    return (
      <div>
        <EmptyState
          icon="alertTriangle"
          title="Equipo no encontrado"
          message="El equipo que intentás editar no existe o fue eliminado."
        />
        <div className="text-center">
          <Link
            href="/equipos"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors"
          >
            <Icon name="arrowLeft" size={14} /> Volver a equipos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <EquipoForm mode="editar" equipo={equipo} />
    </div>
  );
}
