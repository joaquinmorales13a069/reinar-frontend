'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { BodegasTabla } from '@/components/bodegas/BodegasTabla';
import { useBodegas } from '@/hooks/use-bodegas';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarBodega } from '@/lib/bodegas';

export default function BodegasPage() {
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeCrear = puedeEjecutarBodega('crear', rol);
  const { data } = useBodegas();

  const total = data?.length ?? 0;
  const totalZonas = data?.reduce((acc, b) => acc + (b._count?.zonas ?? 0), 0) ?? 0;

  return (
    <div>
      <PageHeader
        title="Bodegas"
        subtitle={`${total} ${total === 1 ? 'bodega principal' : 'bodegas principales'} · ${totalZonas} ${totalZonas === 1 ? 'zona' : 'zonas'}`}
        actions={
          puedeCrear ? (
            <Link
              href="/bodegas/nuevo"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors"
            >
              <Icon name="plus" size={14} /> Nueva bodega
            </Link>
          ) : undefined
        }
      />
      <BodegasTabla />
    </div>
  );
}
