'use client';

import { use } from 'react';
import Link from 'next/link';
import { ConsumibleForm } from '@/components/herramientas/ConsumibleForm';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { useConsumible } from '@/hooks/use-consumibles';

const btnSec =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';

export default function EditarConsumiblePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: consumible, isLoading, isError } = useConsumible(id);

  if (isLoading) return <div className="flex justify-center p-12"><Spinner /></div>;
  if (isError || !consumible) {
    return (
      <div>
        <EmptyState
          icon="alertTriangle"
          title="Consumible no encontrado"
          message="El consumible no existe o fue eliminado."
        />
        <div className="text-center">
          <Link href="/herramientas?tab=consumibles" className={btnSec}>
            <Icon name="arrowLeft" size={14} /> Volver a consumibles
          </Link>
        </div>
      </div>
    );
  }

  return <ConsumibleForm mode="editar" consumible={consumible} />;
}
