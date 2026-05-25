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
import { resolverDepartamento } from '@/lib/sv-geo';
import { SECTORES_CAT019, getActividadByCodigo } from '@/lib/cat019';

type TipoFilter = 'EMPRESA' | 'PARTICULAR' | null;
type EstadoFilter = 'ACTIVO' | 'INACTIVO' | 'PROSPECTO' | null;

const btnSec = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';
const btnPri = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors';
const iconBtn = 'inline-flex items-center justify-center w-7 h-7 rounded text-tx-3 hover:bg-bg-sunken hover:text-tx transition-colors';
const thCls = 'px-4 py-2.5 text-left text-2xs uppercase tracking-wider font-medium text-tx-3 bg-bg-sunken';
const tdCls = 'px-4 py-3 text-sm text-tx';

export function ClientesList() {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');
  const [busqueda, setBusqueda] = useState('');
  const [filterTipo, setFilterTipo] = useState<TipoFilter>(null);
  const [filterEstado, setFilterEstado] = useState<EstadoFilter>(null);
  const [filterSector, setFilterSector] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useClientes({
    page, limit: 10,
    busqueda: busqueda || undefined,
    tipo: filterTipo,
    estado: filterEstado,
    sector: filterSector,
  });

  function toggleTipo(t: 'EMPRESA' | 'PARTICULAR') {
    setFilterTipo((prev) => (prev === t ? null : t));
    setPage(1);
  }
  function toggleEstado(e: 'ACTIVO' | 'INACTIVO' | 'PROSPECTO') {
    setFilterEstado((prev) => (prev === e ? null : e));
    setPage(1);
  }
  function handleSector(v: string) {
    setFilterSector(v || null);
    setPage(1);
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={`${data?.meta.total ?? '—'} empresas y particulares`}
        actions={
          <>
            <button className={btnSec}><Icon name="upload" size={14} /> Importar</button>
            <button className={btnSec}><Icon name="download" size={14} /> Exportar</button>
            {rol !== 'VISUALIZADOR' && (
              <Link href="/clientes/nuevo" className={btnPri}>
                <Icon name="plus" size={14} /> Nuevo cliente
              </Link>
            )}
          </>
        }
      />

      <div className="rounded-lg border border-bd bg-surface overflow-hidden">
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
          onClear={() => { setBusqueda(''); setFilterTipo(null); setFilterEstado(null); setFilterSector(null); setPage(1); }}
        />
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-bd bg-bg-sunken">
          <label className="text-xs text-tx-3 shrink-0">Sector</label>
          <select
            className="px-2.5 py-1 text-xs rounded-md border border-bd bg-surface text-tx focus:outline-none focus:border-accent transition-colors"
            value={filterSector ?? ''}
            onChange={(e) => handleSector(e.target.value)}
          >
            <option value="">Todos los sectores</option>
            {SECTORES_CAT019.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {filterSector && (
            <button
              className="text-xs text-tx-3 hover:text-danger transition-colors"
              onClick={() => handleSector('')}
            >
              Limpiar
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12"><Spinner /></div>
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th className={thCls} style={{ width: 50 }}>#</th>
                <th className={`${thCls} hidden sm:table-cell`} style={{ width: 110 }}>Tipo</th>
                <th className={thCls}>Cliente</th>
                <th className={`${thCls} hidden lg:table-cell`}>Actividad / Ocupación</th>
                <th className={`${thCls} hidden md:table-cell`} style={{ width: 140 }}>Departamento</th>
                <th className={`${thCls} hidden md:table-cell`} style={{ width: 120 }}>Teléfono</th>
                <th className={thCls} style={{ width: 110 }}>Estado</th>
                <th className={thCls} style={{ width: 90 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((c, i) => (
                <tr
                  key={c.id}
                  className="border-t border-bd hover:bg-row-hover transition-colors cursor-pointer group"
                  onClick={() => router.push(`/clientes/${c.id}`)}
                >
                  <td className={`${tdCls} font-mono text-tx-3 text-xs`}>{(page - 1) * 10 + i + 1}</td>
                  <td className={`${tdCls} hidden sm:table-cell`}>
                    <Badge status={c.tipo === 'EMPRESA' ? 'Empresa' : 'Particular'} kind="neutral" />
                  </td>
                  <td className={tdCls}>
                    <div className="font-medium">
                      {c.tipo === 'EMPRESA'
                        ? (c.razonSocial ?? '—')
                        : [c.nombre, c.apellido].filter(Boolean).join(' ') || '—'}
                    </div>
                    <div className="font-mono text-xs text-tx-3 mt-0.5">{c.nit ?? c.dui ?? '—'}</div>
                  </td>
                  <td className={`${tdCls} hidden lg:table-cell text-tx-2 text-xs`}>
                    {c.tipo === 'EMPRESA'
                      ? (c.actividadEconomica ? (getActividadByCodigo(c.actividadEconomica)?.descripcion ?? c.actividadEconomica) : <span className="text-tx-3">—</span>)
                      : (c.ocupacion ?? <span className="text-tx-3">—</span>)}
                  </td>
                  <td className={`${tdCls} hidden md:table-cell text-tx-2`}>{resolverDepartamento(c.departamento)}</td>
                  <td className={`${tdCls} hidden md:table-cell font-mono text-tx-2`}>{c.telefono ?? <span className="text-tx-3">—</span>}</td>
                  <td className={tdCls}><Badge status={c.estado} /></td>
                  <td className={tdCls}>
                    <div className="flex items-center gap-1">
                      <button className={iconBtn} onClick={(e) => { e.stopPropagation(); router.push(`/clientes/${c.id}`); }}>
                        <Icon name="eye" size={14} />
                      </button>
                      {rol !== 'VISUALIZADOR' && (
                        <button className={iconBtn} onClick={(e) => { e.stopPropagation(); router.push(`/clientes/${c.id}/editar`); }}>
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
    </div>
  );
}
