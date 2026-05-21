'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { NAV_GROUPS } from '@/lib/nav';

type SidebarProps = {
  isMini: boolean;
  onCollapse: () => void;
};

export function Sidebar({ isMini, onCollapse }: SidebarProps) {
  // usePathname en vez de prop `route` — la fuente de verdad es la URL, no un estado local
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <aside
      className={`${isMini ? 'w-16' : 'w-60'} shrink-0 bg-sidebar-bg text-sidebar-fg flex flex-col border-r border-white/4 sticky top-0 h-screen overflow-y-auto overflow-x-hidden transition-[width] duration-150 max-lg:hidden`}
    >
      {/* Marca — logo centrado, recoloreado a blanco vía filtros CSS (brightness-0
          neutraliza los colores del PNG e invert los pinta blancos). Mantiene el
          mismo asset, sin necesidad de un PNG alternativo. */}
      <div
        className={`flex items-center justify-center border-b border-white/5 ${
          isMini ? 'min-h-14 py-3' : 'min-h-20 xl:min-h-24 py-4'
        }`}
      >
        {isMini ? (
          <Image
            src="/logo-reinar.png"
            alt="R"
            width={32}
            height={32}
            className="h-8 w-auto object-contain brightness-0 invert"
            priority
          />
        ) : (
          <Image
            src="/logo-reinar.png"
            alt="Reinar"
            width={180}
            height={56}
            className="h-12 xl:h-14 w-auto object-contain brightness-0 invert"
            priority
          />
        )}
      </div>

      {/* Navegación — texto escala en xl+/2xl+ para verse mejor en monitores grandes. */}
      <nav className="px-2 py-3 flex-1">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            {!isMini && (
              <div className="text-2xs xl:text-xs tracking-widest uppercase font-semibold opacity-50 px-2 pb-2">
                {group.label}
              </div>
            )}
            {group.items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                title={item.label}
                onClick={onCollapse}
                className={`flex items-center gap-3 h-9 xl:h-10 2xl:h-11 rounded text-xs xl:text-sm 2xl:text-base font-medium transition-colors select-none ${
                  isMini ? 'justify-center px-0' : 'px-2'
                } ${
                  isActive(item.href)
                    ? 'bg-sidebar-act text-sidebar-fgs'
                    : 'text-sidebar-fg hover:bg-white/4 hover:text-sidebar-fgs'
                }`}
              >
                <span className="size-4.5 xl:size-5 shrink-0 grid place-items-center">
                  <Icon name={item.icon} size={16} />
                </span>
                {!isMini && <span className="flex-1">{item.label}</span>}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Pie */}
      <div className={`flex items-center border-t border-white/4 px-3 py-3 text-2xs xl:text-xs opacity-45 ${isMini ? 'justify-center' : 'justify-between'}`}>
        {!isMini && <span>v1.0.0 · 2026</span>}
        <span className="font-mono">SV</span>
      </div>
    </aside>
  );
}
