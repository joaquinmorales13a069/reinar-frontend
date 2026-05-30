'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { AuditLogTable } from '@/components/auditlog/AuditLogTable';
import { useAuthStore } from '@/stores/auth.store';

// Gate client-side: evita render flash de UI sin permisos antes de que el
// backend devuelva 403. El server igualmente revalida en cada request.
export default function AuditLogPage() {
  const rol = useAuthStore((s) => s.user?.rol);
  const hidratado = useAuthStore((s) => !!s.user);

  if (!hidratado) return null;

  if (rol !== 'ADMIN' && rol !== 'GERENTE') {
    return (
      <div>
        <PageHeader title="Registro de auditoría" subtitle="Trazabilidad de cambios del sistema · solo lectura" />
        <div className="py-8">
          <EmptyState
            icon="shield"
            title="Sin acceso"
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
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Registro de auditoría" subtitle="Trazabilidad de cambios del sistema · solo lectura" />
      <AuditLogTable />
    </div>
  );
}
