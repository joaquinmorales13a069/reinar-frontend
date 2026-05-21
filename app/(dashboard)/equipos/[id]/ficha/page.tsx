'use client';

import { use } from 'react';
import Link from 'next/link';
import { useEquipo } from '@/hooks/use-equipos';
import { EquipoFichaEditor } from '@/components/equipos/EquipoFichaEditor';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';

export default function FichaTecnicaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <FichaTecnicaClient id={id} />;
}

function FichaTecnicaClient({ id }: { id: string }) {
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
          message="No pudimos cargar el equipo para editar su ficha técnica."
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

  return <EquipoFichaEditor equipo={equipo} />;
}
