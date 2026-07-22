'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { Icon } from '@/components/ui/Icon';
import { useContacto, useToggleActivoContacto } from '@/hooks/use-contactos';
import { useAuthStore } from '@/stores/auth.store';
import { resolverDepartamento } from '@/lib/sv-geo';
import { LABEL_TIPO_DOCUMENTO } from '@/lib/format-documentos';
import type { Contacto } from '@/types/api';

type ClienteResumen = NonNullable<Contacto['cliente']>;

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-bd-soft last:border-0 text-sm gap-4">
      <span className="text-tx-3 shrink-0">{label}</span>
      <span className="text-tx text-right font-mono">{value}</span>
    </div>
  );
}

function ClienteCard({ cliente }: { clienteId: string; cliente: ClienteResumen }) {
  const esEmpresa = cliente.tipo === 'EMPRESA';
  const displayName = esEmpresa
    ? (cliente.razonSocial ?? '—')
    : [cliente.nombre, cliente.apellido].filter(Boolean).join(' ') || '—';
  const tipoLabel = esEmpresa ? 'EMPRESA' : 'PARTICULAR';
  const ciudad = resolverDepartamento(cliente.departamento ?? '');

  return (
    <div>
      {/* Encabezado del cliente */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-bg-sunken mb-1">
        <div className="w-11 h-11 rounded-lg bg-navy flex items-center justify-center shrink-0">
          <Icon name={esEmpresa ? 'building' : 'user'} size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-tx leading-snug truncate">{displayName}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-block px-1.5 py-0.5 rounded border border-bd text-[10px] font-semibold text-tx-2 tracking-wide">
              {tipoLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Filas de datos */}
      <div className="mt-3">
        {cliente.tipoDocumento && cliente.numeroDocumento && (
          <InfoRow label={LABEL_TIPO_DOCUMENTO[cliente.tipoDocumento]} value={cliente.numeroDocumento} />
        )}
        {ciudad && ciudad !== '—' && (
          <InfoRow label="Ciudad" value={<span className="font-sans">{ciudad}</span>} />
        )}
        {cliente.telefono && <InfoRow label="Teléfono" value={cliente.telefono} />}
      </div>
    </div>
  );
}

const TIPO_KIND: Record<Contacto['tipoContacto'], 'info' | 'neutral' | 'warn' | 'ok'> = {
  PRINCIPAL: 'info', SECUNDARIO: 'neutral',
  SOLICITANTE: 'warn', FACTURACION: 'ok', OPERATIVO: 'neutral',
};
const TIPO_LABEL: Record<Contacto['tipoContacto'], string> = {
  PRINCIPAL: 'Principal', SECUNDARIO: 'Secundario',
  SOLICITANTE: 'Solicitante', FACTURACION: 'Facturación', OPERATIVO: 'Operativo',
};

const btnSec = 'inline-flex items-center gap-2 px-4 py-2 rounded-md border border-bd text-tx-2 bg-surface text-sm font-medium hover:bg-bg-sunken transition-colors';

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between py-2.5 border-b border-bd-soft last:border-0 text-sm gap-4">
      <dt className="text-tx-3 shrink-0">{label}</dt>
      <dd className="text-tx text-right">{value}</dd>
    </div>
  );
}

export function ContactoDetalle({ id }: { id: string }) {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');
  const [confirmDesact, setConfirmDesact] = useState(false);

  const { data: contacto, isLoading, isError } = useContacto(id);
  const toggleActivo = useToggleActivoContacto();

  if (isLoading) return <div className="flex justify-center p-12"><Spinner /></div>;
  if (isError || !contacto) return <div className="p-8 text-center text-sm text-tx-2">No se pudo cargar el contacto.</div>;

  const fullName = `${contacto.nombre}${contacto.apellido ? ' ' + contacto.apellido : ''}`;

  function handleDesactivar() {
    toggleActivo.mutate({ id, activo: false }, {
      onSuccess: () => { toast.success('Contacto desactivado.'); setConfirmDesact(false); },
      onError: (err: any) => {
        toast.error(err?.response?.data?.error?.message ?? 'Ocurrió un error inesperado.');
        setConfirmDesact(false);
      },
    });
  }

  return (
    <div>
      <PageHeader
        title={fullName}
        subtitle={
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {contacto.cargo && <span className="text-sm text-tx-2">{contacto.cargo}</span>}
            <Badge status={TIPO_LABEL[contacto.tipoContacto]} kind={TIPO_KIND[contacto.tipoContacto]} />
            <Badge status={contacto.activo ? 'ACTIVO' : 'INACTIVO'} />
            <span className="font-mono text-xs text-tx-3">· {contacto.id}</span>
          </div>
        }
        back
        onBack={() => router.push('/contactos')}
        actions={
          <>
            {rol !== 'VISUALIZADOR' && (
              <Link href={`/contactos/${id}/editar`} className={btnSec}>
                <Icon name="edit" size={14} /> Editar
              </Link>
            )}
            {contacto.activo && rol !== 'VISUALIZADOR' && (
              <button
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm text-danger border border-bd hover:bg-bg-sunken transition-colors"
                onClick={() => setConfirmDesact(true)}
              >
                <Icon name="x" size={14} /> Desactivar
              </button>
            )}
          </>
        }
      />

      {confirmDesact && (
        <ConfirmRow
          message={<>¿Desactivar el contacto <b>{fullName}</b>? Dejará de aparecer en los selectores de nuevos documentos.</>}
          onCancel={() => setConfirmDesact(false)}
          onConfirm={handleDesactivar}
          confirmLabel="Sí, desactivar"
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-bd bg-surface p-4">
            <h3 className="text-sm font-semibold text-tx mb-3">Información de contacto</h3>
            <dl className="m-0">
              <DetailRow label="Teléfono" value={<span className="font-mono">{contacto.telefono ?? <span className="text-tx-muted">—</span>}</span>} />
              <DetailRow label="Correo electrónico" value={contacto.email ?? <span className="text-tx-muted">—</span>} />
              <DetailRow label="Notas" value={contacto.notas ?? <span className="text-tx-muted">Sin notas registradas.</span>} />
            </dl>
          </div>
          {/* Sección "Aparece en" se completa en RAMA 6 y RAMA 7 */}
          <div className="rounded-lg border border-bd bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
              <h3 className="text-sm font-semibold text-tx">Aparece en</h3>
              <span className="text-xs text-tx-3">Documentos vinculados</span>
            </div>
            <div className="px-4 py-4 text-sm text-tx-muted">
              Las vinculaciones estarán disponibles cuando se implementen los módulos de cotizaciones y facturas.
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-bd bg-surface p-4">
          <h3 className="text-sm font-semibold text-tx mb-3">Cliente vinculado</h3>
          <ClienteCard clienteId={contacto.clienteId} cliente={contacto.cliente ?? {}} />
          <Link
            href={`/clientes/${contacto.clienteId}`}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-md border border-bd text-tx text-sm font-medium hover:bg-bg-sunken transition-colors mt-4"
          >
            Ver detalle del cliente <Icon name="arrowRight" size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
