'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { ProveedoresTable } from '@/components/proveedores/ProveedoresTable';
import { useProveedores } from '@/hooks/use-proveedores';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarProveedor } from '@/lib/proveedores';

export default function ProveedoresPage() {
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeCrear = puedeEjecutarProveedor('crear', rol);

  const { data } = useProveedores({ page: 1, limit: 1 });
  const total = data?.meta.total ?? 0;

  return (
    <div>
      <PageHeader
        title="Proveedores"
        subtitle={`${total} ${total === 1 ? 'proveedor registrado' : 'proveedores registrados'}`}
        actions={
          puedeCrear ? (
            <Link
              href="/proveedores/nuevo"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors"
            >
              <Icon name="plus" size={14} /> Nuevo proveedor
            </Link>
          ) : undefined
        }
      />
      <ProveedoresTable />
    </div>
  );
}
