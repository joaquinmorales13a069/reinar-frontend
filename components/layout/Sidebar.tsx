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
      className={`${isMini ? 'w-16' : 'w-60'} shrink-0 bg-sidebar-bg text-sidebar-fg flex flex-col border-r border-white/4 sticky top-0 h-screen overflow-y-auto overflow-x-hidden transition-[width] duration-150 max-md:hidden`}
    >
      {/* Marca */}
      <div className={`flex items-center border-b border-white/5 min-h-14 ${isMini ? 'justify-center py-3.5' : 'gap-3 px-4 py-3.5'}`}>
        {isMini ? (
          <Image src="/logo-reinar.png" alt="R" width={28} height={28} priority />
        ) : (
          <Image
            src="/logo-reinar.png"
            alt="Reinar"
            width={110}
            height={28}
            className="h-7 w-auto object-contain"
            priority
          />
        )}
      </div>

      {/* Navegación */}
      <nav className="px-2 py-3 flex-1">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            {!isMini && (
              <div className="text-2xs tracking-widest uppercase font-semibold opacity-50 px-2 pb-2">
                {group.label}
              </div>
            )}
            {group.items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                title={item.label}
                onClick={onCollapse}
                className={`flex items-center gap-3 h-9 rounded text-xs font-medium transition-colors select-none ${
                  isMini ? 'justify-center px-0' : 'px-2'
                } ${
                  isActive(item.href)
                    ? 'bg-sidebar-act text-sidebar-fgs'
                    : 'text-sidebar-fg hover:bg-white/4 hover:text-sidebar-fgs'
                }`}
              >
                <span className="size-4.5 shrink-0 grid place-items-center">
                  <Icon name={item.icon} size={16} />
                </span>
                {!isMini && <span className="flex-1">{item.label}</span>}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Pie */}
      <div className={`flex items-center border-t border-white/4 px-3 py-3 text-2xs opacity-45 ${isMini ? 'justify-center' : 'justify-between'}`}>
        {!isMini && <span>v1.0.0 · 2026</span>}
        <span className="font-mono">SV</span>
      </div>
    </aside>
  );
}
