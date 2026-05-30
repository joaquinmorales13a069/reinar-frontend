'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PerfilTarjeta } from '@/components/perfil/PerfilTarjeta';
import { CambiarContrasenaCard } from '@/components/perfil/CambiarContrasenaCard';
import { MfaCard } from '@/components/perfil/MfaCard';
import { useMiPerfil } from '@/hooks/use-perfil';

export default function PerfilPage() {
  const { data: perfil, isLoading, isError, refetch } = useMiPerfil();

  if (isLoading) return (
    <div>
      <PageHeader title="Mi perfil" subtitle="Configuración personal de tu cuenta" />
      <div className="flex justify-center py-12"><Spinner /></div>
    </div>
  );

  if (isError || !perfil) return (
    <div>
      <PageHeader title="Mi perfil" subtitle="Configuración personal de tu cuenta" />
      <EmptyState
        icon="alertTriangle"
        title="No se pudo cargar el perfil"
        message="Verificá tu conexión e intentá de nuevo."
      />
      <div className="flex justify-center mt-4">
        <button onClick={() => refetch()} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-tx-2 border border-bd hover:bg-bg-sunken transition-colors">
          Reintentar
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader title="Mi perfil" subtitle="Configuración personal de tu cuenta" />
      <div className="grid lg:grid-cols-[1fr_2fr] gap-4">
        <PerfilTarjeta perfil={perfil} />
        <div className="flex flex-col gap-4">
          <CambiarContrasenaCard />
          <MfaCard perfil={perfil} />
        </div>
      </div>
    </div>
  );
}
