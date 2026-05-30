'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { FilterBar } from '@/components/ui/FilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { Icon } from '@/components/ui/Icon';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { useUsuarios, useCambiarEstadoUsuario, useResetMfaUsuario } from '@/hooks/use-usuarios';
import { useAuthStore } from '@/stores/auth.store';
import { esAdmin, esElPropioUsuario } from '@/lib/ajustes';
import { formatDateTime, getInitials } from '@/lib/utils';
import type { RolUsuario, Usuario } from '@/types/api';

const ROLES: RolUsuario[] = ['ADMIN', 'GERENTE', 'OPERADOR', 'LOGISTICA', 'VISUALIZADOR'];

const ROL_LABEL: Record<RolUsuario, string> = {
  ADMIN: 'Admin',
  GERENTE: 'Gerente',
  OPERADOR: 'Operador',
  LOGISTICA: 'Logística',
  VISUALIZADOR: 'Visualizador',
};

export function UsuariosTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filtroRol, setFiltroRol] = useState<RolUsuario | undefined>(undefined);
  const [confirmEstado, setConfirmEstado] = useState<Usuario | null>(null);
  const [confirmResetMfa, setConfirmResetMfa] = useState<Usuario | null>(null);

  const rolActual = useAuthStore((s) => s.user?.rol);
  const idActual = useAuthStore((s) => s.user?.id);
  const puedeEditar = esAdmin(rolActual);

  const { data, isLoading, isError } = useUsuarios({
    page,
    limit: 20,
    busqueda: search.trim() || undefined,
    rol: filtroRol,
  });
  const cambiarEstado = useCambiarEstadoUsuario();
  const resetMfa = useResetMfaUsuario();

  function onChangeSearch(v: string) {
    setSearch(v);
    setPage(1);
  }

  function toggleFiltroRol(r: RolUsuario) {
    setFiltroRol(filtroRol === r ? undefined : r);
    setPage(1);
  }

  async function onConfirmCambiarEstado() {
    if (!confirmEstado) return;
    await cambiarEstado.mutateAsync({ id: confirmEstado.id, activo: !confirmEstado.activo });
    setConfirmEstado(null);
  }

  async function onConfirmResetMfa() {
    if (!confirmResetMfa) return;
    await resetMfa.mutateAsync(confirmResetMfa.id);
    setConfirmResetMfa(null);
  }

  return (
    <div className="rounded-lg border border-bd bg-surface overflow-hidden">
      <FilterBar
        search={search}
        onSearch={onChangeSearch}
        placeholder="Buscar por nombre, apellido o email…"
        chips={ROLES.map((r) => ({
          label: ROL_LABEL[r],
          active: filtroRol === r,
          onToggle: () => toggleFiltroRol(r),
        }))}
        onClear={() => { setSearch(''); setFiltroRol(undefined); setPage(1); }}
      />

      {isLoading && <div className="flex justify-center py-12"><Spinner /></div>}

      {isError && (
        <EmptyState
          icon="alertTriangle"
          title="Error al cargar usuarios"
          message="Intenta refrescar la página."
        />
      )}

      {!isLoading && !isError && data && data.data.length === 0 && (
        <EmptyState
          icon="users"
          title="Sin usuarios"
          message="No se encontraron usuarios con los filtros aplicados."
        />
      )}

      {!isLoading && !isError && data && data.data.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl text-sm">
              <thead className="bg-bg-sunken text-2xs uppercase tracking-wider text-tx-3">
                <tr>
                  <th className="text-left px-4 py-2 font-medium w-12">#</th>
                  <th className="text-left px-4 py-2 font-medium">Nombre</th>
                  <th className="text-left px-4 py-2 font-medium">Email</th>
                  <th className="text-left px-4 py-2 font-medium w-32">Rol</th>
                  <th className="text-left px-4 py-2 font-medium w-28">Estado</th>
                  <th className="text-center px-4 py-2 font-medium w-24">2FA</th>
                  <th className="text-left px-4 py-2 font-medium w-44">Último acceso</th>
                  {puedeEditar && (
                    <th className="text-center px-4 py-2 font-medium w-32">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.data.map((u, i) => {
                  const numero = (data.meta.page - 1) * data.meta.limit + i + 1;
                  const esYo = esElPropioUsuario(u.id, idActual);
                  return (
                    <Fragment key={u.id}>
                      <tr className="border-t border-bd hover:bg-bg-sunken transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-tx-3">{numero}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-bg-sunken text-xs font-semibold text-tx-2 shrink-0">
                              {getInitials(`${u.nombre} ${u.apellido}`)}
                            </span>
                            <span className="font-medium">{u.nombre} {u.apellido}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-tx-2">{u.email}</td>
                        <td className="px-4 py-3">
                          <Badge status={ROL_LABEL[u.rol]} kind="accent" />
                        </td>
                        <td className="px-4 py-3">
                          <Badge status={u.activo ? 'ACTIVO' : 'INACTIVO'} kind={u.activo ? 'ok' : 'neutral'} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge status={u.mfaActivo ? 'Activo' : 'Inactivo'} kind={u.mfaActivo ? 'ok' : 'neutral'} />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-tx-2">
                          {u.ultimoAcceso ? formatDateTime(u.ultimoAcceso) : 'Nunca'}
                        </td>
                        {puedeEditar && (
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <Link
                                href={`/ajustes/usuarios/${u.id}/editar`}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-tx-3 hover:bg-bg hover:text-tx transition-colors"
                                aria-label="Editar usuario"
                              >
                                <Icon name="edit" size={14} />
                              </Link>
                              <button
                                type="button"
                                onClick={() => setConfirmEstado(u)}
                                // Backend devuelve 403 si un admin se desactiva a sí mismo;
                                // deshabilitamos en UI para evitar la llamada.
                                disabled={esYo && u.activo}
                                title={esYo && u.activo ? 'No puedes desactivar tu propia cuenta' : undefined}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-tx-3 hover:bg-bg hover:text-tx transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label={u.activo ? 'Desactivar usuario' : 'Activar usuario'}
                              >
                                <Icon name={u.activo ? 'x' : 'check'} size={14} />
                              </button>
                              {/* Solo mostramos reset MFA si esta activo — el backend valida
                                  igual y devuelve 400 MFA_NO_ACTIVO, pero esconderlo evita
                                  confundir al admin con un boton que no hace nada visible. */}
                              {u.mfaActivo && (
                                <button
                                  type="button"
                                  onClick={() => setConfirmResetMfa(u)}
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-tx-3 hover:bg-bg hover:text-tx transition-colors"
                                  aria-label="Resetear MFA del usuario"
                                  title="Resetear MFA"
                                >
                                  <Icon name="shield" size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                      {confirmEstado?.id === u.id && (
                        <tr>
                          <td colSpan={puedeEditar ? 8 : 7} className="px-4 pb-3">
                            <ConfirmRow
                              variant={u.activo ? 'danger' : 'primary'}
                              message={
                                u.activo ? (
                                  <span>
                                    ¿Desactivar a <b>{u.nombre} {u.apellido}</b>?
                                    {u.mfaActivo && ' Se eliminará su 2FA configurado (el backend lo limpia automáticamente).'}
                                  </span>
                                ) : (
                                  <span>¿Activar a <b>{u.nombre} {u.apellido}</b>?</span>
                                )
                              }
                              confirmLabel={u.activo ? 'Desactivar' : 'Activar'}
                              onCancel={() => setConfirmEstado(null)}
                              onConfirm={onConfirmCambiarEstado}
                            />
                          </td>
                        </tr>
                      )}
                      {confirmResetMfa?.id === u.id && (
                        <tr>
                          <td colSpan={puedeEditar ? 8 : 7} className="px-4 pb-3">
                            <ConfirmRow
                              variant="danger"
                              message={
                                <span>
                                  ¿Resetear MFA de <b>{u.nombre} {u.apellido}</b>?
                                  El usuario podrá entrar solo con email y contraseña hasta que reactive MFA desde su perfil.
                                </span>
                              }
                              confirmLabel="Resetear MFA"
                              onCancel={() => setConfirmResetMfa(null)}
                              onConfirm={onConfirmResetMfa}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
    </div>
  );
}
