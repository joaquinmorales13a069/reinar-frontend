'use client';

import { use } from 'react';
import Link from 'next/link';
import { HerramientaTipoForm } from '@/components/herramientas/HerramientaTipoForm';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { useHerramientaTipo } from '@/hooks/use-herramientas';

const btnSec =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';

export default function EditarTipoPage({ params }: { params: Promise<{ id: string }> }) {
  // Next 19 entrega params como Promise; use() lo desempaqueta.
  const { id } = use(params);
  const { data: tipo, isLoading, isError } = useHerramientaTipo(id);

  if (isLoading) return <div className="flex justify-center p-12"><Spinner /></div>;
  if (isError || !tipo) {
    return (
      <div>
        <EmptyState
          icon="alertTriangle"
          title="Tipo no encontrado"
          message="El tipo que intentás editar no existe o fue eliminado."
        />
        <div className="text-center">
          <Link href="/herramientas?tab=tipos" className={btnSec}>
            <Icon name="arrowLeft" size={14} /> Volver a herramientas
          </Link>
        </div>
      </div>
    );
  }

  return <HerramientaTipoForm mode="editar" tipo={tipo} />;
}
