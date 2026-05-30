'use client';

import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { puedeAccederAjustes } from '@/lib/ajustes';
import { EmptyState } from '@/components/ui/EmptyState';

// Doble-check de rol en cliente: el backend ya valida cada endpoint, pero sin
// este gate los usuarios sin permiso verían un flash de UI (tabs, header) antes
// del 403. Aquí cortamos el árbol completo de la sección /ajustes para esos roles.
export default function AjustesLayout({ children }: { children: React.ReactNode }) {
  const rol = useAuthStore((s) => s.user?.rol);
  const hidratado = useAuthStore((s) => !!s.user);

  // Mientras el AuthHydrator del layout padre carga al usuario, no decidimos
  // todavía — evitamos mostrar "Sin acceso" durante el render inicial cuando
  // el rol aún es undefined.
  if (!hidratado) return null;

  if (!puedeAccederAjustes(rol)) {
    return (
      <div className="py-8">
        <EmptyState
          icon="shield"
          title="Sin acceso a Ajustes"
          message="Esta sección está disponible solo para los roles ADMIN y GERENTE."
        />
        <div className="flex justify-center mt-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors"
          >
            Volver al dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
