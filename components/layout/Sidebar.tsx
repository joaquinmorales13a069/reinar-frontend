'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { NAV_GROUPS } from '@/lib/nav';

type SidebarProps = {
  expanded: boolean;
  onCollapse: () => void;
};

export function Sidebar({ expanded, onCollapse }: SidebarProps) {
  // usePathname en vez de prop `route` — la fuente de verdad es la URL, no un estado local
  const pathname = usePathname();

  // Compara el href completo con el pathname para determinar el item activo
  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <aside className={`sidebar ${expanded ? 'is-expanded' : ''}`}>
      <div className="sidebar__brand">
        <Image
          src="/logo-reinar.png"
          alt="Reinar"
          width={110}
          height={28}
          className="sidebar__brand-logo"
          priority
        />
        <div className="sidebar__brand-mini">
          <Image src="/logo-reinar.png" alt="R" width={28} height={28} priority />
        </div>
      </div>

      <nav className="sidebar__nav">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="nav-group">
            <div className="nav-group__label">{group.label}</div>
            {group.items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`nav-item ${isActive(item.href) ? 'is-active' : ''}`}
                title={item.label}
                onClick={onCollapse}
              >
                <span className="nav-item__icon">
                  <Icon name={item.icon} size={16} />
                </span>
                <span className="nav-item__label">{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar__foot">
        <span>v1.0.0 · 2026</span>
        <span className="mono">SV</span>
      </div>
    </aside>
  );
}
