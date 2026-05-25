'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useContactos } from '@/hooks/use-contactos';
import { useAuthStore } from '@/stores/auth.store';
import type { Contacto } from '@/types/api';

const TIPO_KIND: Record<Contacto['tipoContacto'], 'info' | 'neutral' | 'warn' | 'ok'> = {
  PRINCIPAL: 'info', SECUNDARIO: 'neutral',
  SOLICITANTE: 'warn', FACTURACION: 'ok', OPERATIVO: 'neutral',
};
const TIPO_LABEL: Record<Contacto['tipoContacto'], string> = {
  PRINCIPAL: 'Principal', SECUNDARIO: 'Secundario',
  SOLICITANTE: 'Solicitante', FACTURACION: 'Facturación', OPERATIVO: 'Operativo',
};

const thCls = 'px-4 py-2.5 text-left text-2xs uppercase tracking-wider font-medium text-tx-3 bg-bg-sunken';
const tdCls = 'px-4 py-3 text-sm text-tx';
const btnSec = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';
const iconBtn = 'inline-flex items-center justify-center w-7 h-7 rounded text-tx-3 hover:bg-bg-sunken hover:text-tx transition-colors';

export function ContactosDeCliente({ clienteId }: { clienteId: string }) {
  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');
  const { data, isLoading } = useContactos({ clienteId, limit: 50 });
  const items = data?.data ?? [];

  return (
    <div className="rounded-lg border border-bd bg-surface overflow-hidden mt-4">
      <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
        <div>
          <h3 className="text-sm font-semibold text-tx">Contactos</h3>
          <p className="text-xs text-tx-3 mt-0.5">
            {items.length} {items.length === 1 ? 'contacto vinculado' : 'contactos vinculados'}
          </p>
        </div>
        {rol !== 'VISUALIZADOR' && (
          <Link href={`/contactos/nuevo?clienteId=${clienteId}`} className={btnSec}>
            <Icon name="plus" size={12} /> Nuevo contacto
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8"><Spinner /></div>
      ) : items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={thCls}>Nombre</th>
                <th className={`${thCls} hidden sm:table-cell`}>Cargo</th>
                <th className={thCls} style={{ width: 120 }}>Tipo</th>
                <th className={`${thCls} hidden sm:table-cell`} style={{ width: 130 }}>Teléfono</th>
                <th className={`${thCls} hidden md:table-cell`}>Email</th>
                <th className={thCls} style={{ width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-bd hover:bg-row-hover transition-colors group">
                  <td className={tdCls}>
                    <div className="font-medium">{c.nombre}{c.apellido ? ` ${c.apellido}` : ''}</div>
                    <div className="font-mono text-xs text-tx-3 mt-0.5">{c.id}</div>
                  </td>
                  <td className={`${tdCls} hidden sm:table-cell text-tx-2`}>
                    {c.cargo ?? <span className="text-tx-muted">—</span>}
                  </td>
                  <td className={tdCls}>
                    <Badge status={TIPO_LABEL[c.tipoContacto]} kind={TIPO_KIND[c.tipoContacto]} />
                  </td>
                  <td className={`${tdCls} hidden sm:table-cell font-mono text-tx-2`}>
                    {c.telefono ?? <span className="text-tx-muted">—</span>}
                  </td>
                  <td className={`${tdCls} hidden md:table-cell text-tx-2`}>
                    {c.email ?? <span className="text-tx-muted">—</span>}
                  </td>
                  <td className={tdCls}>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/contactos/${c.id}`} className={iconBtn}><Icon name="eye" size={14} /></Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-tx-2">
          Este cliente aún no tiene contactos registrados.
        </div>
      )}
    </div>
  );
}
