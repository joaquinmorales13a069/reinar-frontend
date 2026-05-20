'use client';

import { useState } from 'react';
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
  // Compara cada href contra el inicio del pathname para soportar rutas anidadas
  return NAV_ITEMS_FLAT.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/'),
  ) ?? null;
}

export function Topbar({ onMenuClick, onTweaksOpen }: TopbarProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  const user = useAuthStore((s) => s.user);
  const logoutMutation = useLogoutMutation();

  const { data: notifData, isLoading: notifLoading } = useNotificaciones();
  const marcarLeida = useMarcarLeida();
  const marcarTodas = useMarcarTodasLeidas();

  const navInfo = useNavInfo();
  const notificaciones = notifData?.data ?? [];
  const unread = notificaciones.filter((n) => !n.leida).length;

  function closeAll() {
    setNotifOpen(false);
    setUserOpen(false);
  }

  return (
    <header className="topbar">
      {/* El botón de menú móvil se muestra via CSS solo en pantallas pequeñas */}
      <button className="icon-btn" onClick={onMenuClick} aria-label="Abrir menú">
        <Icon name="menu" size={18} />
      </button>

      <div className="crumbs">
        <span>Reinar</span>
        {navInfo && (
          <>
            <span className="crumbs__sep">/</span>
            <span className="crumbs__leaf">{navInfo.label}</span>
          </>
        )}
      </div>

      <div className="topbar__right">
        <button className="icon-btn" title="Tweaks" onClick={onTweaksOpen} aria-label="Configuración visual">
          <Icon name="gear" size={16} />
        </button>

        {/* Notificaciones */}
        <div style={{ position: 'relative' }}>
          <button
            className="icon-btn"
            onClick={() => { setNotifOpen((o) => !o); setUserOpen(false); }}
            aria-label="Notificaciones"
          >
            <Icon name="bell" size={16} />
            {unread > 0 && <span className="icon-btn__dot" />}
          </button>

          {notifOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={closeAll} />
              <div className="dropdown" style={{ minWidth: 320, zIndex: 100 }}>
                <div className="dropdown__head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Notificaciones</span>
                  {unread > 0 && (
                    <span
                      style={{ color: 'var(--info)', cursor: 'pointer', fontSize: 10 }}
                      onClick={() => marcarTodas.mutate()}
                    >
                      Marcar todo como leído
                    </span>
                  )}
                </div>

                {notifLoading && (
                  <div className="dropdown__item">
                    <Spinner size={14} />
                  </div>
                )}

                {notificaciones.map((n) => (
                  <div
                    key={n.id}
                    className="dropdown__item"
                    style={{ alignItems: 'flex-start', padding: '8px 10px', cursor: n.leida ? 'default' : 'pointer' }}
                    onClick={() => { if (!n.leida) marcarLeida.mutate(n.id); }}
                  >
                    <span className="activity__dot" style={{ width: 22, height: 22, flexShrink: 0 }}>
                      {n.icono && <Icon name={n.icono as never} size={11} />}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: n.leida ? 400 : 500 }}>{n.texto}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{n.meta}</div>
                    </div>
                    {!n.leida && (
                      <span style={{ width: 6, height: 6, background: 'var(--yellow)', borderRadius: '50%', marginTop: 4, flexShrink: 0 }} />
                    )}
                  </div>
                ))}

                {!notifLoading && notificaciones.length === 0 && (
                  <div className="dropdown__item" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    Sin notificaciones
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Usuario */}
        <div style={{ position: 'relative' }}>
          <div
            className="user-chip"
            onClick={() => { setUserOpen((o) => !o); setNotifOpen(false); }}
            role="button"
            tabIndex={0}
          >
            <div className="avatar">{user ? getInitials(user.nombre) : '?'}</div>
            {user && (
              <div>
                <div className="user-chip__name">{user.nombre}</div>
                <div className="user-chip__role">{user.rol}</div>
              </div>
            )}
            <Icon name="chevronDown" size={14} color="var(--text-3)" />
          </div>

          {userOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={closeAll} />
              <div className="dropdown" style={{ zIndex: 100 }}>
                <div className="dropdown__head">{user?.email}</div>
                <div className="dropdown__sep" />
                <div
                  className="dropdown__item"
                  style={{ color: 'var(--danger)' }}
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
