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
import { useClientes } from '@/hooks/use-clientes';
import { useAuthStore } from '@/stores/auth.store';

type TipoFilter = 'EMPRESA' | 'PARTICULAR' | null;
type EstadoFilter = 'ACTIVO' | 'INACTIVO' | 'PROSPECTO' | null;

export function ClientesList() {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');
  const [busqueda, setBusqueda] = useState('');
  const [filterTipo, setFilterTipo] = useState<TipoFilter>(null);
  const [filterEstado, setFilterEstado] = useState<EstadoFilter>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useClientes({
    page, limit: 10,
    busqueda: busqueda || undefined,
    tipo: filterTipo,
    estado: filterEstado,
  });

  function toggleTipo(t: 'EMPRESA' | 'PARTICULAR') {
    setFilterTipo((prev) => (prev === t ? null : t));
    setPage(1);
  }
  function toggleEstado(e: 'ACTIVO' | 'INACTIVO' | 'PROSPECTO') {
    setFilterEstado((prev) => (prev === e ? null : e));
    setPage(1);
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={`${data?.meta.total ?? '—'} empresas y particulares`}
        actions={
          <>
            <button className="btn btn--secondary"><Icon name="upload" size={14} /> Importar</button>
            <button className="btn btn--secondary"><Icon name="download" size={14} /> Exportar</button>
            {rol !== 'VISUALIZADOR' && (
              <Link href="/clientes/nuevo" className="btn btn--primary">
                <Icon name="plus" size={14} /> Nuevo cliente
              </Link>
            )}
          </>
        }
      />

      <FilterBar
        search={busqueda}
        onSearch={(v) => { setBusqueda(v); setPage(1); }}
        placeholder="Buscar por nombre, NIT, DUI, código…"
        chips={[
          { label: 'Empresas',     active: filterTipo === 'EMPRESA',     onToggle: () => toggleTipo('EMPRESA') },
          { label: 'Particulares', active: filterTipo === 'PARTICULAR',  onToggle: () => toggleTipo('PARTICULAR') },
          { label: 'Activos',      active: filterEstado === 'ACTIVO',    onToggle: () => toggleEstado('ACTIVO') },
          { label: 'Inactivos',    active: filterEstado === 'INACTIVO',  onToggle: () => toggleEstado('INACTIVO') },
          { label: 'Prospectos',   active: filterEstado === 'PROSPECTO', onToggle: () => toggleEstado('PROSPECTO') },
        ]}
        onClear={() => { setBusqueda(''); setFilterTipo(null); setFilterEstado(null); setPage(1); }}
      />

      {isLoading ? (
        <div className="flex justify-center p-12"><Spinner /></div>
      ) : (
        <DataTable>
          <thead>
            <tr>
              <th style={{ width: 110 }}>Código</th>
              <th className="hidden sm:table-cell" style={{ width: 110 }}>Tipo</th>
              <th>Cliente</th>
              <th className="hidden md:table-cell" style={{ width: 140 }}>Departamento</th>
              <th className="hidden md:table-cell" style={{ width: 120 }}>Teléfono</th>
              <th className="hidden md:table-cell" style={{ width: 70, textAlign: 'right' }}>Cot.</th>
              <th style={{ width: 110 }}>Estado</th>
              <th style={{ width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {data?.data.map((c) => (
              <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/clientes/${c.id}`)}>
                <td className="mono text-3">{c.id}</td>
                <td className="hidden sm:table-cell">
                  <span className="badge badge--neutral">{c.tipo === 'EMPRESA' ? 'Empresa' : 'Particular'}</span>
                </td>
                <td>
                  <div style={{ fontWeight: 500 }}>{c.razonSocial ?? c.nombre}</div>
                  <div className="mono text-3" style={{ fontSize: 'var(--t-xs)' }}>{c.nit ?? c.dui ?? '—'}</div>
                </td>
                <td className="hidden md:table-cell text-2">{c.departamento}</td>
                <td className="hidden md:table-cell mono text-2">{c.telefono ?? <span className="text-muted">—</span>}</td>
                <td className="hidden md:table-cell num">—</td>
                <td><Badge status={c.estado} /></td>
                <td>
                  <div className="row-actions">
                    <button className="icon-btn" onClick={(e) => { e.stopPropagation(); router.push(`/clientes/${c.id}`); }}>
                      <Icon name="eye" size={14} />
                    </button>
                    {rol !== 'VISUALIZADOR' && (
                      <button className="icon-btn" onClick={(e) => { e.stopPropagation(); router.push(`/clientes/${c.id}/editar`); }}>
                        <Icon name="edit" size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(data?.data?.length ?? 0) === 0 && (
              <tr><td colSpan={8}>
                <EmptyState icon="users" title="Sin resultados" message="Probá con otros filtros o limpiá la búsqueda." />
              </td></tr>
            )}
          </tbody>
        </DataTable>
      )}

      <Pagination page={page} pageSize={10} total={data?.meta.total ?? 0} onPage={setPage} />
    </div>
  );
}
