'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { Pagination } from '@/components/ui/Pagination';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { MantenimientoEstadoBadge } from '@/components/mantenimientos/MantenimientoEstadoBadge';
import { useMantenimientos } from '@/hooks/use-mantenimientos';
import { useAuthStore } from '@/stores/auth.store';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { EstadoMantenimiento, TipoMantenimiento } from '@/types/api';

const TIPOS:   TipoMantenimiento[]   = ['PREVENTIVO', 'CORRECTIVO', 'EMERGENCIA'];
const ESTADOS: EstadoMantenimiento[] = ['ACTIVO', 'COMPLETADO'];

export default function MantenimientosPage() {
  const router = useRouter();
  const sp     = useSearchParams();
  const { user } = useAuthStore();

  // Filtros desde URL para que recargar la pagina o llegar desde un link
  // preserve el contexto (equipo/unidad concretos).
  const equipoIdParam            = sp.get('equipoId') ?? undefined;
  const herramientaUnidadIdParam = sp.get('herramientaUnidadId') ?? undefined;

  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState<EstadoMantenimiento | undefined>();
  const [tipo, setTipo]     = useState<TipoMantenimiento | undefined>();

  useEffect(() => { setPage(1); }, [estado, tipo, search, equipoIdParam, herramientaUnidadIdParam]);

  const { data, isLoading } = useMantenimientos({
    page,
    limit: 20,
    estado,
    tipo,
    equipoId:            equipoIdParam,
    herramientaUnidadId: herramientaUnidadIdParam,
  });

  const canCreate = user && user.rol !== 'VISUALIZADOR';

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Mantenimientos"
        subtitle="Equipos y herramientas en taller"
        actions={canCreate ? (
          <Link
            href="/mantenimientos/nuevo"
            className="px-3 py-2 text-sm rounded-md bg-accent text-bg hover:opacity-90"
          >
            Nuevo mantenimiento
          </Link>
        ) : null}
      />

      <div className="rounded-lg border border-bd bg-surface overflow-hidden">
        <FilterBar
          search={search}
          onSearch={setSearch}
          placeholder="Buscar por técnico, tipo…"
          chips={[
            ...ESTADOS.map((e) => ({
              label:    e,
              active:   estado === e,
              onToggle: () => setEstado(estado === e ? undefined : e),
            })),
            ...TIPOS.map((t) => ({
              label:    t,
              active:   tipo === t,
              onToggle: () => setTipo(tipo === t ? undefined : t),
            })),
          ]}
          onClear={() => { setEstado(undefined); setTipo(undefined); setSearch(''); }}
        />

        {(equipoIdParam || herramientaUnidadIdParam) && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-bd text-sm">
            <Badge
              status={equipoIdParam ? `Equipo ${equipoIdParam}` : `Unidad ${herramientaUnidadIdParam}`}
              kind="info"
            />
            <button
              type="button"
              onClick={() => router.push('/mantenimientos')}
              className="text-xs text-tx-3 hover:text-tx"
            >
              Quitar
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : !data || data.data.length === 0 ? (
          <EmptyState
            icon="wrench"
            title="Sin mantenimientos"
            message="No hay registros que coincidan con los filtros."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-tx-3 border-b border-bd">
              <tr>
                <th className="text-left font-medium px-4 py-2">Tipo</th>
                <th className="text-left font-medium px-4 py-2">Estado</th>
                <th className="text-left font-medium px-4 py-2">Entidad</th>
                <th className="text-left font-medium px-4 py-2">Técnico</th>
                <th className="text-left font-medium px-4 py-2">Entrada</th>
                <th className="text-right font-medium px-4 py-2">Costo</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((m) => {
                const entidadLabel = m.equipo
                  ? `${m.equipo.codigo} — ${m.equipo.nombre}`
                  : m.herramientaUnidad
                  ? `${m.herramientaUnidad.codigoInterno} — ${m.herramientaUnidad.herramientaTipo.nombre}`
                  : '—';
                // Mostramos costo real si ya se registró la salida (COMPLETADO),
                // costo estimado si aún está ACTIVO.
                const costo = m.costoReal ?? m.costoEstimado;
                return (
                  <tr
                    key={m.id}
                    onClick={() => router.push(`/mantenimientos/${m.id}`)}
                    className="border-b border-bd last:border-0 cursor-pointer hover:bg-bg-2"
                  >
                    <td className="px-4 py-2">{m.tipo}</td>
                    <td className="px-4 py-2"><MantenimientoEstadoBadge estado={m.estado} /></td>
                    <td className="px-4 py-2 font-mono text-xs">{entidadLabel}</td>
                    <td className="px-4 py-2">{m.tecnico}</td>
                    <td className="px-4 py-2 font-mono text-xs">{formatDate(m.fechaEntrada)}</td>
                    <td className="px-4 py-2 text-right">
                      {costo ? formatCurrency(costo) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {data && data.meta.total > data.meta.limit && (
          <Pagination
            page={page}
            pageSize={data.meta.limit}
            total={data.meta.total}
            onPage={setPage}
          />
        )}
      </div>
    </div>
  );
}
