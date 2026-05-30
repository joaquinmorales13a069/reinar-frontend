'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { NAV_GROUPS } from '@/lib/nav';
import { filtrarNavGroups } from '@/lib/permisos-nav';
import { useAuthStore } from '@/stores/auth.store';

// Sin props: el Sidebar siempre se renderiza ancho completo en lg+. El modo mini
// se eliminó con el cleanup de TweaksPanel.
export function Sidebar() {
  // usePathname en vez de prop `route` — la fuente de verdad es la URL, no un estado local
  const pathname = usePathname();
  // Filtramos los grupos por rol para que cada usuario vea solo lo que puede usar.
  // El backend igual rechaza con 403 si manipulan la URL — esto es solo UX para
  // que LOGISTICA no vea "Clientes" y caiga en pantalla de error.
  const rol = useAuthStore((s) => s.user?.rol);
  const grupos = useMemo(() => filtrarNavGroups(NAV_GROUPS, rol), [rol]);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <aside
      className="w-60 shrink-0 bg-sidebar-bg text-sidebar-fg flex flex-col border-r border-white/4 sticky top-0 h-screen overflow-y-auto overflow-x-hidden max-lg:hidden"
    >
      {/* Marca — logo en su color original (amarillo/azul). El contenedor centra
          al logo horizontal y verticalmente. mx-auto duplica el centrado en el
          Image como salvaguarda por si Next renderiza con dimensiones fijas. */}
      <div className="flex items-center justify-center border-b border-white/5 min-h-20 xl:min-h-24 py-4 px-4">
        <Image
          src="/logo-reinar.png"
          alt="Reinar"
          width={180}
          height={56}
          className="h-12 xl:h-14 w-auto object-contain mx-auto"
          priority
        />
      </div>

      {/* Navegación — texto escala en xl+/2xl+ para verse mejor en monitores grandes. */}
      <nav className="px-2 py-3 flex-1">
        {grupos.map((group) => (
          <div key={group.label} className="mb-5">
            <div className="text-2xs xl:text-xs tracking-widest uppercase font-semibold opacity-50 px-2 pb-2">
              {group.label}
            </div>
            {group.items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                title={item.label}
                className={`flex items-center gap-3 h-9 xl:h-10 2xl:h-11 rounded text-xs xl:text-sm 2xl:text-base font-medium transition-colors select-none px-2 ${
                  isActive(item.href)
                    ? 'bg-sidebar-act text-sidebar-fgs'
                    : 'text-sidebar-fg hover:bg-white/4 hover:text-sidebar-fgs'
                }`}
              >
                <span className="size-4.5 xl:size-5 shrink-0 grid place-items-center">
                  <Icon name={item.icon} size={16} />
                </span>
                <span className="flex-1">{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Pie */}
      <div className="flex items-center justify-between border-t border-white/4 px-3 py-3 text-2xs xl:text-xs opacity-45">
        <span>v1.0.0 · 2026</span>
        <span className="font-mono">SV</span>
      </div>
    </aside>
  );
}
