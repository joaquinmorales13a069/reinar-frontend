'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { useAuthStore } from '@/stores/auth.store';
import { useUiStore } from '@/stores/ui.store';
import { useLogoutMutation } from '@/hooks/use-auth';
import { useNotificaciones, useMarcarLeida, useMarcarTodasLeidas } from '@/hooks/use-notificaciones';
import { NAV_ITEMS_FLAT } from '@/lib/nav';
import { getInitials } from '@/lib/utils';

// Mapa de tipo de notificación → nombre de ícono. El backend emite el tipo como
// string (no enum) y agrega tipos con cada módulo nuevo, por eso usamos lookup
// con fallback en lugar de un Record exhaustivo: tipos nuevos caen al ícono
// default sin requerir cambios en este archivo.
const ICONO_POR_TIPO: Record<string, string> = {
  COTIZACION_APROBADA:   'check',
  COTIZACION_RECHAZADA:  'x',
  COTIZACION_ENVIADA:    'send',
  FACTURA_EMITIDA:       'fileText',
  FACTURAS_VENCIDAS:     'alertTriangle',
  PAGO_REGISTRADO:       'dollar',
  ACTA_DESPACHADA:       'package',
  ACTA_ENTREGADA:        'package',
  ACTA_DEVUELTA:         'package',
  DTE_APROBADO:          'check',
  DTE_ENVIADO_MANUAL:    'send',
  QUEDAN_POR_ENTREGAR:   'alertTriangle',
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

export function Topbar() {
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen,  setUserOpen]  = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  const user          = useAuthStore((s) => s.user);
  const theme         = useUiStore((s) => s.theme);
  const setTheme      = useUiStore((s) => s.setTheme);
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
    setConfigOpen(false);
  }

  return (
    <header className="sticky top-0 z-20 h-14 bg-topbar-bg border-b border-bd flex items-center gap-4 px-5">
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
        {/* Dropdown reemplaza al antiguo TweaksPanel. Solo conservamos toggle de tema;
            density/sidebar mini/accent se eliminaron por simplicidad. */}
        <div className="relative">
          <button
            className={iconBtn}
            onClick={() => { setConfigOpen((o) => !o); setNotifOpen(false); setUserOpen(false); }}
            aria-label="Configuración"
          >
            <Icon name="gear" size={18} />
          </button>
          {configOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={closeAll} />
              <div className="absolute top-full translate-y-1.5 right-0 min-w-56 bg-surface border border-bd rounded shadow-lg z-50 overflow-hidden">
                <Link
                  href="/ajustes"
                  onClick={closeAll}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-tx cursor-pointer hover:bg-bg-sunken"
                >
                  <Icon name="gear" size={14} /> Ajustes del sistema
                </Link>
                {(user?.rol === 'ADMIN' || user?.rol === 'GERENTE') && (
                  <Link
                    href="/auditlog"
                    onClick={closeAll}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-tx cursor-pointer hover:bg-bg-sunken"
                  >
                    <Icon name="fileText" size={14} /> Auditoría
                  </Link>
                )}
                <div className="h-px bg-bd my-1" />
                {/* Toggle de tema NO cierra el dropdown — permite experimentar antes de decidir. */}
                <button
                  type="button"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-tx cursor-pointer hover:bg-bg-sunken"
                >
                  <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={14} />
                  Tema {theme === 'dark' ? 'claro' : 'oscuro'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Notificaciones */}
        <div className="relative">
          <button
            className={`${iconBtn} relative`}
            onClick={() => { setNotifOpen((o) => !o); setUserOpen(false); setConfigOpen(false); }}
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

                {notificaciones.map((n) => {
                  const icono = ICONO_POR_TIPO[n.tipo] ?? 'fileText';
                  const cls = `flex items-start gap-2 px-2.5 py-2 hover:bg-bg-sunken cursor-pointer`;
                  // Al click: marca como leída (si aún no lo está) Y cierra el dropdown
                  // antes de navegar. Sin closeAll() el dropdown queda abierto sobre la
                  // página destino.
                  const handleClick = () => {
                    if (!n.leida) marcarLeida.mutate(n.id);
                    closeAll();
                  };
                  // Si hay enlace usamos <Link> para que Next.js haga client-side nav;
                  // si no, un <div> sin href (no navega, solo marca como leída).
                  const Contenido = (
                    <>
                      <span className="size-6 shrink-0 grid place-items-center text-tx-3">
                        <Icon name={icono as never} size={11} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs ${n.leida ? 'font-normal' : 'font-medium'}`}>{n.titulo}</div>
                        <div className="text-2xs text-tx-muted">{n.mensaje}</div>
                      </div>
                      {!n.leida && (
                        <span className="size-1.5 bg-accent rounded-full mt-1 shrink-0" />
                      )}
                    </>
                  );
                  return n.enlace ? (
                    <Link key={n.id} href={n.enlace} className={cls} onClick={handleClick}>
                      {Contenido}
                    </Link>
                  ) : (
                    <div key={n.id} className={cls} onClick={handleClick}>
                      {Contenido}
                    </div>
                  );
                })}

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
            onClick={() => { setUserOpen((o) => !o); setNotifOpen(false); setConfigOpen(false); }}
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
