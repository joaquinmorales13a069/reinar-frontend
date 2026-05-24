'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { ServiciosTable } from '@/components/servicios/ServiciosTable';
import { useServicios } from '@/hooks/use-servicios';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarServicio } from '@/lib/servicios';

export default function ServiciosPage() {
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeCrear = puedeEjecutarServicio('crear', rol);

  // Llamada ligera para mostrar el total en el subtítulo independientemente
  // de los filtros activos en la tabla. `limit: 1` minimiza la transferencia;
  // el total real viene en meta.
  const { data } = useServicios({ page: 1, limit: 1 });
  const total = data?.meta.total ?? 0;

  return (
    <div>
      <PageHeader
        title="Servicios"
        subtitle={`${total} ${total === 1 ? 'servicio cotizable' : 'servicios cotizables'}`}
        actions={
          puedeCrear ? (
            <Link
              href="/servicios/nuevo"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors"
            >
              <Icon name="plus" size={14} /> Nuevo servicio
            </Link>
          ) : undefined
        }
      />
      <ServiciosTable />
    </div>
  );
}
