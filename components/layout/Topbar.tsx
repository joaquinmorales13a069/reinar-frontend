'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { useAuthStore } from '@/stores/auth.store';
import { useLogoutMutation } from '@/hooks/use-auth';
import { useNotificaciones, useMarcarLeida, useMarcarTodasLeidas } from '@/hooks/use-notificaciones';
import { NAV_ITEMS_FLAT } from '@/lib/nav';
import { getInitials } from '@/lib/utils';

type TopbarProps = {
  onMenuClick: () => void;
  onTweaksOpen: () => void;
};

// Resuelve la info de navegación desde el pathname actual para construir el breadcrumb
function useNavInfo() {
  const pathname = usePathname();
  return (
    NAV_ITEMS_FLAT.find(
      (item) => pathname === item.href || pathname.startsWith(item.href + '/'),
    ) ?? null
  );
}

const iconBtn =
  'size-8 grid place-items-center rounded text-tx-2 hover:bg-bg-sunken hover:text-tx transition-colors';

export function Topbar({ onMenuClick, onTweaksOpen }: TopbarProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen,  setUserOpen]  = useState(false);

  const user          = useAuthStore((s) => s.user);
  const logoutMutation = useLogoutMutation();

  const { data: notifData, isLoading: notifLoading } = useNotificaciones();
  const marcarLeida = useMarcarLeida();
  const marcarTodas = useMarcarTodasLeidas();

  const navInfo       = useNavInfo();
  const notificaciones = notifData?.data ?? [];
  const unread        = notificaciones.filter((n) => !n.leida).length;

  function closeAll() {
    setNotifOpen(false);
    setUserOpen(false);
  }

  return (
    <header className="sticky top-0 z-20 h-14 bg-topbar-bg border-b border-bd flex items-center gap-4 px-5">
      {/* md:hidden porque en desktop el sidebar siempre es visible; el hamburger solo tiene
          sentido en móvil donde el sidebar está oculto vía CSS */}
      <button className={`${iconBtn} md:hidden`} onClick={onMenuClick} aria-label="Abrir menú">
        <Icon name="menu" size={18} />
      </button>

      <div className="flex items-center gap-2 text-xs text-tx-3 min-w-0">
        <span className="shrink-0">Reinar</span>
        {navInfo && (
          <>
            <span className="text-tx-muted shrink-0">/</span>
            <span className="text-tx font-medium truncate">{navInfo.label}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <button className={iconBtn} title="Tweaks" onClick={onTweaksOpen} aria-label="Configuración visual">
          <Icon name="gear" size={16} />
        </button>

        {/* Notificaciones */}
        <div className="relative">
          <button
            className={`${iconBtn} relative`}
            onClick={() => { setNotifOpen((o) => !o); setUserOpen(false); }}
            aria-label="Notificaciones"
          >
            <Icon name="bell" size={16} />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 size-2 bg-danger rounded-full border-2 border-topbar-bg" />
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={closeAll} />
              <div className="absolute top-full translate-y-1.5 right-0 min-w-80 bg-surface border border-bd rounded shadow-lg z-50 overflow-hidden">
                <div className="flex justify-between items-center px-3 py-2 text-2xs font-semibold tracking-widest uppercase text-tx-muted border-b border-bd">
                  <span>Notificaciones</span>
                  {unread > 0 && (
                    <span
                      className="text-info cursor-pointer"
                      onClick={() => marcarTodas.mutate()}
                    >
                      Marcar todo como leído
                    </span>
                  )}
                </div>

                {notifLoading && (
                  <div className="flex items-center gap-2 px-3 py-2 text-xs">
                    <Spinner size={14} />
                  </div>
                )}

                {notificaciones.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-2 px-2.5 py-2 hover:bg-bg-sunken ${!n.leida ? 'cursor-pointer' : ''}`}
                    onClick={() => { if (!n.leida) marcarLeida.mutate(n.id); }}
                  >
                    <span className="size-6 shrink-0 grid place-items-center text-tx-3">
                      {n.icono && <Icon name={n.icono as never} size={11} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs ${n.leida ? 'font-normal' : 'font-medium'}`}>{n.texto}</div>
                      <div className="text-2xs text-tx-muted font-mono">{n.meta}</div>
                    </div>
                    {!n.leida && (
                      <span className="size-1.5 bg-accent rounded-full mt-1 shrink-0" />
                    )}
                  </div>
                ))}

                {!notifLoading && notificaciones.length === 0 && (
                  <div className="px-3 py-2 text-xs text-tx-muted">Sin notificaciones</div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Usuario */}
        <div className="relative">
          <div
            className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-bg-sunken transition-colors"
            onClick={() => { setUserOpen((o) => !o); setNotifOpen(false); }}
            role="button"
            tabIndex={0}
          >
            <div className="size-8 rounded-full bg-accent text-navy flex items-center justify-center font-semibold text-xs shrink-0">
              {user ? getInitials(user.nombre) : '?'}
            </div>
            {/* Nombre y rol ocultos en pantallas < lg — en móvil y tablet solo
                se ve el avatar; el texto causaría overflow con el sidebar visible */}
            {user && (
              <div className="hidden lg:block">
                <div className="text-sm font-medium">{user.nombre}</div>
                <div className="text-2xs text-tx-muted uppercase tracking-wider">{user.rol}</div>
              </div>
            )}
            <Icon name="chevronDown" size={14} />
          </div>

          {userOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={closeAll} />
              <div className="absolute top-full translate-y-1.5 right-0 min-w-48 bg-surface border border-bd rounded shadow-lg z-50 overflow-hidden">
                <div className="px-3 py-2 text-2xs font-semibold tracking-widest uppercase text-tx-muted border-b border-bd">
                  {user?.email}
                </div>
                {/* Mi perfil arriba del divisor — es una acción personal del usuario,
                    no un módulo del shell; va en este menú según convención del proyecto. */}
                <Link
                  href="/perfil"
                  onClick={closeAll}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-tx cursor-pointer hover:bg-bg-sunken"
                >
                  <Icon name="user" size={14} /> Mi perfil
                </Link>
                <div className="h-px bg-bd my-1" />
                <div
                  className="flex items-center gap-2 px-3 py-2 text-xs text-danger cursor-pointer hover:bg-bg-sunken"
                  onClick={() => { logoutMutation.mutate(); closeAll(); }}
                >
                  {logoutMutation.isPending ? <Spinner size={12} /> : <Icon name="logout" size={14} />}
                  Cerrar sesión
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
