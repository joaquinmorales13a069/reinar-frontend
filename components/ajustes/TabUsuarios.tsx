'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { UsuariosTable } from '@/components/ajustes/UsuariosTable';
import { useUsuarios } from '@/hooks/use-usuarios';
import { useAuthStore } from '@/stores/auth.store';
import { esAdmin } from '@/lib/ajustes';

export function TabUsuarios() {
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeCrear = esAdmin(rol);

  // limit: 1 minimiza la transferencia; el total real viene en meta.
  // Mismo patrón que servicios/page.tsx para mostrar conteo en el header.
  const { data } = useUsuarios({ page: 1, limit: 1 });
  const total = data?.meta.total ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-tx">
          Usuarios ({total})
        </h3>
        {puedeCrear && (
          <Link
            href="/ajustes/usuarios/nuevo"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors"
          >
            <Icon name="plus" size={14} /> Nuevo usuario
          </Link>
        )}
      </div>
      <UsuariosTable />
    </div>
  );
}
