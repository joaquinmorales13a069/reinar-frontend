'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Icon } from '@/components/ui/Icon';
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

type EstadoFilter = 'ACTIVO' | 'INACTIVO' | null;

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
            <button className="btn btn--secondary"><Icon name="download" size={14} /> Exportar</button>
            {rol !== 'VISUALIZADOR' && (
              <Link href="/contactos/nuevo" className="btn btn--primary">
                <Icon name="plus" size={14} /> Nuevo contacto
              </Link>
            )}
          </>
        }
      />

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
              <th className="hidden sm:table-cell" style={{ width: 110 }}>Código</th>
              <th>Nombre completo</th>
              <th className="hidden lg:table-cell" style={{ width: 200 }}>Cargo</th>
              <th>Cliente vinculado</th>
              <th style={{ width: 130 }}>Tipo</th>
              <th className="hidden sm:table-cell" style={{ width: 130 }}>Teléfono</th>
              <th style={{ width: 110 }}>Estado</th>
              <th style={{ width: 60 }} />
            </tr>
          </thead>
          <tbody>
            {data?.data.map((c) => (
              <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/contactos/${c.id}`)}>
                <td className="hidden sm:table-cell mono text-3">{c.id}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{c.nombre}{c.apellido ? ` ${c.apellido}` : ''}</div>
                  {c.email && <div style={{ fontSize: 'var(--t-xs)', color: 'var(--text-3)' }}>{c.email}</div>}
                </td>
                <td className="hidden lg:table-cell text-2">{c.cargo ?? <span className="text-muted">—</span>}</td>
                <td>
                  <Link href={`/clientes/${c.clienteId}`} className="text-info hover:underline" onClick={(e) => e.stopPropagation()}>
                    {c.clienteId}
                  </Link>
                </td>
                <td>
                  <span className={`badge ${TIPO_BADGE[c.tipoContacto] ?? 'badge--neutral'}`}>
                    <span className="badge__dot" />{TIPO_LABEL[c.tipoContacto] ?? c.tipoContacto}
                  </span>
                </td>
                <td className="hidden sm:table-cell mono text-2">{c.telefono ?? <span className="text-muted">—</span>}</td>
                <td>
                  <span className={`badge ${c.activo ? 'badge--ok' : 'badge--neutral'}`}>
                    <span className="badge__dot" />{c.activo ? 'ACTIVO' : 'INACTIVO'}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button className="icon-btn" onClick={(e) => { e.stopPropagation(); router.push(`/contactos/${c.id}`); }}>
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
  );
}
