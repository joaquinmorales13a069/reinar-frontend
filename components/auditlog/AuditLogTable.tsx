// components/auditlog/AuditLogTable.tsx
'use client';

import { useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { Icon } from '@/components/ui/Icon';
import { AuditLogFilters, FILTROS_VACIOS, aFiltrosBackend, type FiltrosAuditLogState } from './AuditLogFilters';
import { AuditLogDrawer } from './AuditLogDrawer';
import { colorPorAccion } from '@/lib/auditlog';
import { useAuditLog } from '@/hooks/use-auditlog';
import { formatDateTime, getInitials } from '@/lib/utils';
import type { AuditLog } from '@/types/api';

function resumenCambio(log: AuditLog): string {
  if (!log.camposAntes && !log.camposDespues) return '—';
  if (!log.camposAntes && log.camposDespues) {
    const keys = Object.keys(log.camposDespues);
    if (keys.length === 0) return 'Registro creado';
    if (keys.length === 1) {
      const k = keys[0];
      return `${k}: ${String(log.camposDespues[k])}`;
    }
    return `Campos: ${keys.join(', ')}`;
  }
  if (log.camposAntes && !log.camposDespues) return 'Registro eliminado';
  const keys = Object.keys(log.camposDespues ?? {});
  if (keys.length === 1) {
    const k = keys[0];
    const antes = (log.camposAntes as Record<string, unknown> | null)?.[k];
    const dsp = (log.camposDespues as Record<string, unknown> | null)?.[k];
    return `${k}: ${antes ?? '—'} → ${dsp ?? '—'}`;
  }
  return `Campos modificados: ${keys.join(', ')}`;
}

export function AuditLogTable() {
  const [page, setPage] = useState(1);
  const [filtros, setFiltros] = useState<FiltrosAuditLogState>(FILTROS_VACIOS);
  const [drawerLog, setDrawerLog] = useState<AuditLog | null>(null);

  const rangoInvalido = !!(filtros.desdeManual && filtros.hastaManual && filtros.desdeManual > filtros.hastaManual);

  function onFiltrosChange(next: FiltrosAuditLogState) {
    setFiltros(next);
    setPage(1);
  }

  const { data, isLoading, isError } = useAuditLog({
    page,
    limit: 50,
    ...aFiltrosBackend(filtros),
  });

  return (
    <div className="rounded-lg border border-bd bg-surface overflow-hidden">
      <AuditLogFilters filtros={filtros} onChange={onFiltrosChange} />

      {rangoInvalido && (
        <div className="px-4 py-2 bg-warn-soft text-warn text-xs border-b border-bd">
          Corregí el rango de fechas para ver resultados.
        </div>
      )}

      {isLoading && <div className="flex justify-center py-12"><Spinner /></div>}

      {isError && (
        <EmptyState
          icon="alertTriangle"
          title="Error al cargar el registro"
          message="Intenta refrescar la página."
        />
      )}

      {!isLoading && !isError && data && data.data.length === 0 && (
        <EmptyState
          icon="fileText"
          title="Sin eventos"
          message="No se encontraron eventos con los filtros aplicados."
        />
      )}

      {!isLoading && !isError && data && data.data.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl text-sm">
              <thead className="bg-bg-sunken text-2xs uppercase tracking-wider text-tx-3">
                <tr>
                  <th className="text-left px-4 py-2 font-medium w-12">#</th>
                  <th className="text-left px-4 py-2 font-medium w-44">Fecha y hora</th>
                  <th className="text-left px-4 py-2 font-medium w-48">Usuario</th>
                  <th className="text-left px-4 py-2 font-medium w-44">Acción</th>
                  <th className="text-left px-4 py-2 font-medium w-44">Entidad</th>
                  <th className="text-left px-4 py-2 font-medium">Resumen</th>
                  <th className="text-left px-4 py-2 font-medium w-28">IP</th>
                  <th className="px-4 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((log, i) => {
                  const numero = (data.meta.page - 1) * data.meta.limit + i + 1;
                  const usuarioLabel = log.usuario
                    ? `${log.usuario.nombre} ${log.usuario.apellido}`
                    : '(Usuario eliminado)';
                  return (
                    <tr
                      key={log.id}
                      className="border-t border-bd hover:bg-bg-sunken transition-colors cursor-pointer"
                      onClick={() => setDrawerLog(log)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-tx-3">{numero}</td>
                      <td className="px-4 py-3 font-mono text-xs text-tx-2">{formatDateTime(log.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-full bg-bg-sunken text-tx-2 grid place-items-center text-2xs font-semibold shrink-0">
                            {log.usuario ? getInitials(usuarioLabel) : '?'}
                          </div>
                          <span className={log.usuario ? 'text-tx text-sm' : 'text-tx-3 text-sm italic'}>
                            {usuarioLabel}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge status={log.accion} kind={colorPorAccion(log.accion)} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium">{log.entidad}</div>
                        <div className="font-mono text-2xs text-tx-3 truncate max-w-32">{log.entidadId}</div>
                      </td>
                      <td className="px-4 py-3 text-tx-2 text-sm truncate max-w-md">{resumenCambio(log)}</td>
                      <td className="px-4 py-3 font-mono text-2xs text-tx-3">{log.ip ?? '—'}</td>
                      <td className="px-4 py-3 text-tx-3">
                        <Icon name="chevronRight" size={14} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.meta.page}
            pageSize={data.meta.limit}
            total={data.meta.total}
            onPage={setPage}
          />
        </>
      )}

      {drawerLog && <AuditLogDrawer log={drawerLog} onClose={() => setDrawerLog(null)} />}
    </div>
  );
}
