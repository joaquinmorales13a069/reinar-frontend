'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { BOTTOM_NAV_ITEMS } from '@/lib/nav';

export function BottomNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <nav className="bottom-nav">
      {BOTTOM_NAV_ITEMS.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={`bottom-nav__item ${isActive(item.href) ? 'is-active' : ''}`}
        >
          <Icon name={item.icon} size={18} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
