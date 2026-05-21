'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { useContactos } from '@/hooks/use-contactos';
import { useAuthStore } from '@/stores/auth.store';

const TIPO_BADGE: Record<string, string> = {
  PRINCIPAL: 'badge--info', SECUNDARIO: 'badge--neutral',
  SOLICITANTE: 'badge--warn', FACTURACION: 'badge--ok', OPERATIVO: 'badge--neutral',
};
const TIPO_LABEL: Record<string, string> = {
  PRINCIPAL: 'Principal', SECUNDARIO: 'Secundario',
  SOLICITANTE: 'Solicitante', FACTURACION: 'Facturación', OPERATIVO: 'Operativo',
};

export function ContactosDeCliente({ clienteId }: { clienteId: string }) {
  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');
  const { data, isLoading } = useContactos({ clienteId, limit: 50 });
  const items = data?.data ?? [];

  return (
    <div className="card card--flush mt-4">
      <div className="card__head">
        <div>
          <h3 className="card__title">Contactos</h3>
          <p className="card__sub">
            {items.length} {items.length === 1 ? 'contacto vinculado' : 'contactos vinculados'}
          </p>
        </div>
        {rol !== 'VISUALIZADOR' && (
          <Link href={`/contactos/nuevo?clienteId=${clienteId}`} className="btn btn--secondary btn--sm">
            <Icon name="plus" size={12} /> Nuevo contacto
          </Link>
        )}
      </div>
      {isLoading ? (
        <div className="flex justify-center p-8"><Spinner /></div>
      ) : items.length > 0 ? (
        <table className="table">
          <thead>
            <tr>
              <th style={{ paddingLeft: 14 }}>Nombre</th>
              <th className="hidden sm:table-cell">Cargo</th>
              <th style={{ width: 120 }}>Tipo</th>
              <th className="hidden sm:table-cell" style={{ width: 130 }}>Teléfono</th>
              <th className="hidden md:table-cell">Email</th>
              <th style={{ width: 60 }} />
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td style={{ paddingLeft: 14 }}>
                  <div style={{ fontWeight: 500 }}>{c.nombre}{c.apellido ? ` ${c.apellido}` : ''}</div>
                  <div className="mono text-3" style={{ fontSize: 'var(--t-xs)' }}>{c.id}</div>
                </td>
                <td className="hidden sm:table-cell text-2">{c.cargo ?? <span className="text-muted">—</span>}</td>
                <td>
                  <span className={`badge ${TIPO_BADGE[c.tipoContacto] ?? 'badge--neutral'}`}>
                    <span className="badge__dot" />{TIPO_LABEL[c.tipoContacto] ?? c.tipoContacto}
                  </span>
                </td>
                <td className="hidden sm:table-cell mono text-2">{c.telefono ?? <span className="text-muted">—</span>}</td>
                <td className="hidden md:table-cell text-2 text-sm">{c.email ?? <span className="text-muted">—</span>}</td>
                <td>
                  <div className="row-actions">
                    <Link href={`/contactos/${c.id}`} className="icon-btn"><Icon name="eye" size={14} /></Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="py-8 text-center text-sm text-tx-2">
          Este cliente aún no tiene contactos registrados.
        </div>
      )}
    </div>
  );
}
