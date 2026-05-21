'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Icon } from '@/components/ui/Icon';
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

type EstadoFilter = 'ACTIVO' | 'INACTIVO' | null;

const btnSec = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';
const btnPri = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors';
const iconBtn = 'inline-flex items-center justify-center w-7 h-7 rounded text-tx-3 hover:bg-bg-sunken hover:text-tx transition-colors';
const thCls = 'px-4 py-2.5 text-left text-xs font-medium text-tx-3 bg-bg-sunken';
const tdCls = 'px-4 py-3 text-sm text-tx';

export function ContactosList() {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');
  const [busqueda, setBusqueda] = useState('');
  const [filterTipo, setFilterTipo] = useState<string | null>(null);
  const [filterEstado, setFilterEstado] = useState<EstadoFilter>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useContactos({
    page, limit: 10,
    busqueda: busqueda || undefined,
    tipoContacto: filterTipo,
    activo: filterEstado === 'ACTIVO' ? true : filterEstado === 'INACTIVO' ? false : null,
  });

  function toggleTipo(t: string) {
    setFilterTipo((prev) => (prev === t ? null : t));
    setPage(1);
  }
  function toggleEstado(e: 'ACTIVO' | 'INACTIVO') {
    setFilterEstado((prev) => (prev === e ? null : e));
    setPage(1);
  }

  return (
    <div>
      <PageHeader
        title="Contactos"
        subtitle={`${data?.meta.total ?? '—'} contactos registrados`}
        actions={
          <>
            <button className={btnSec}><Icon name="download" size={14} /> Exportar</button>
            {rol !== 'VISUALIZADOR' && (
              <Link href="/contactos/nuevo" className={btnPri}>
                <Icon name="plus" size={14} /> Nuevo contacto
              </Link>
            )}
          </>
        }
      />

      <div className="rounded-lg border border-bd bg-surface overflow-hidden">
        <FilterBar
          search={busqueda}
          onSearch={(v) => { setBusqueda(v); setPage(1); }}
          placeholder="Buscar por nombre, cargo, código…"
          chips={[
            { label: 'Principales',  active: filterTipo === 'PRINCIPAL',   onToggle: () => toggleTipo('PRINCIPAL') },
            { label: 'Secundarios',  active: filterTipo === 'SECUNDARIO',  onToggle: () => toggleTipo('SECUNDARIO') },
            { label: 'Solicitantes', active: filterTipo === 'SOLICITANTE', onToggle: () => toggleTipo('SOLICITANTE') },
            { label: 'Facturación',  active: filterTipo === 'FACTURACION', onToggle: () => toggleTipo('FACTURACION') },
            { label: 'Operativos',   active: filterTipo === 'OPERATIVO',   onToggle: () => toggleTipo('OPERATIVO') },
            { label: 'Activos',      active: filterEstado === 'ACTIVO',    onToggle: () => toggleEstado('ACTIVO') },
            { label: 'Inactivos',    active: filterEstado === 'INACTIVO',  onToggle: () => toggleEstado('INACTIVO') },
          ]}
          onClear={() => { setBusqueda(''); setFilterTipo(null); setFilterEstado(null); setPage(1); }}
        />

        {isLoading ? (
          <div className="flex justify-center p-12"><Spinner /></div>
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th className={`${thCls} hidden sm:table-cell`} style={{ width: 110 }}>Código</th>
                <th className={thCls}>Nombre completo</th>
                <th className={`${thCls} hidden lg:table-cell`} style={{ width: 200 }}>Cargo</th>
                <th className={thCls}>Cliente vinculado</th>
                <th className={thCls} style={{ width: 130 }}>Tipo</th>
                <th className={`${thCls} hidden sm:table-cell`} style={{ width: 130 }}>Teléfono</th>
                <th className={thCls} style={{ width: 110 }}>Estado</th>
                <th className={thCls} style={{ width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {data?.data.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-bd hover:bg-row-hover transition-colors cursor-pointer group"
                  onClick={() => router.push(`/contactos/${c.id}`)}
                >
                  <td className={`${tdCls} hidden sm:table-cell font-mono text-tx-3`}>{c.id}</td>
                  <td className={tdCls}>
                    <div className="font-medium">{c.nombre}{c.apellido ? ` ${c.apellido}` : ''}</div>
                    {c.email && <div className="text-xs text-tx-3 mt-0.5">{c.email}</div>}
                  </td>
                  <td className={`${tdCls} hidden lg:table-cell text-tx-2`}>
                    {c.cargo ?? <span className="text-tx-muted">—</span>}
                  </td>
                  <td className={tdCls}>
                    <Link href={`/clientes/${c.clienteId}`} className="text-info hover:underline font-mono text-xs" onClick={(e) => e.stopPropagation()}>
                      {c.clienteId}
                    </Link>
                  </td>
                  <td className={tdCls}>
                    <Badge status={TIPO_LABEL[c.tipoContacto]} kind={TIPO_KIND[c.tipoContacto]} />
                  </td>
                  <td className={`${tdCls} hidden sm:table-cell font-mono text-tx-2`}>
                    {c.telefono ?? <span className="text-tx-muted">—</span>}
                  </td>
                  <td className={tdCls}>
                    <Badge status={c.activo ? 'ACTIVO' : 'INACTIVO'} />
                  </td>
                  <td className={tdCls}>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className={iconBtn} onClick={(e) => { e.stopPropagation(); router.push(`/contactos/${c.id}`); }}>
                        <Icon name="eye" size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(data?.data?.length ?? 0) === 0 && (
                <tr><td colSpan={8}>
                  <EmptyState icon="idCard" title="Sin contactos" message="No se encontraron contactos con los filtros aplicados." />
                </td></tr>
              )}
            </tbody>
          </DataTable>
        )}

        <Pagination page={page} pageSize={10} total={data?.meta.total ?? 0} onPage={setPage} />
      </div>
    </div>
  );
}
