'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { Icon } from '@/components/ui/Icon';
import { useContacto, useToggleActivoContacto } from '@/hooks/use-contactos';
import { useAuthStore } from '@/stores/auth.store';

const TIPO_BADGE: Record<string, string> = {
  PRINCIPAL: 'badge--info', SECUNDARIO: 'badge--neutral',
  SOLICITANTE: 'badge--warn', FACTURACION: 'badge--ok', OPERATIVO: 'badge--neutral',
};
const TIPO_LABEL: Record<string, string> = {
  PRINCIPAL: 'Principal', SECUNDARIO: 'Secundario',
  SOLICITANTE: 'Solicitante', FACTURACION: 'Facturación', OPERATIVO: 'Operativo',
};

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
          <>
            {contacto.cargo && <span className="text-2">{contacto.cargo} · </span>}
            <span className={`badge ${TIPO_BADGE[contacto.tipoContacto] ?? 'badge--neutral'}`}>
              <span className="badge__dot" />{TIPO_LABEL[contacto.tipoContacto] ?? contacto.tipoContacto}
            </span>{' '}
            <span className={`badge ${contacto.activo ? 'badge--ok' : 'badge--neutral'}`}>
              <span className="badge__dot" />{contacto.activo ? 'ACTIVO' : 'INACTIVO'}
            </span>
            <span className="text-3 mono" style={{ marginLeft: 8 }}>· {contacto.id}</span>
          </>
        }
        back
        onBack={() => router.push('/contactos')}
        actions={
          <>
            {rol !== 'VISUALIZADOR' && (
              <Link href={`/contactos/${id}/editar`} className="btn btn--secondary">
                <Icon name="edit" size={14} /> Editar
              </Link>
            )}
            {contacto.activo && rol !== 'VISUALIZADOR' && (
              <button type="button" className="btn btn--ghost" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDesact(true)}>
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
          <div className="card">
            <h3 className="card__title mb-3">Información de contacto</h3>
            <dl style={{ margin: 0 }}>
              <div className="detail-row"><dt>Teléfono</dt><dd className="mono">{contacto.telefono ?? <span className="text-muted">—</span>}</dd></div>
              <div className="detail-row"><dt>Correo electrónico</dt><dd>{contacto.email ?? <span className="text-muted">—</span>}</dd></div>
              <div className="detail-row"><dt>Notas</dt><dd>{contacto.notas ?? <span className="text-muted">Sin notas registradas.</span>}</dd></div>
            </dl>
          </div>
          {/* Sección "Aparece en" se completa en RAMA 6 (cotizaciones) y RAMA 7 (facturas) */}
          <div className="card card--flush">
            <div className="card__head">
              <h3 className="card__title">Aparece en</h3>
              <span className="text-3 text-sm">Documentos vinculados</span>
            </div>
            <div style={{ padding: '16px 18px', color: 'var(--text-muted)', fontSize: 'var(--t-sm)' }}>
              Las vinculaciones estarán disponibles cuando se implementen los módulos de cotizaciones y facturas.
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="card__title mb-3">Cliente vinculado</h3>
          <div style={{ padding: 14, background: 'var(--bg-sunken)', borderRadius: 4, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 4, background: 'var(--navy)', color: 'white', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon name="building" size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mono font-semibold">{contacto.clienteId}</div>
              </div>
            </div>
          </div>
          <Link href={`/clientes/${contacto.clienteId}`} className="btn btn--secondary" style={{ width: '100%', justifyContent: 'center' }}>
            Ver detalle del cliente <Icon name="arrowRight" size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
