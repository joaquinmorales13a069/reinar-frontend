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
    <nav className="hidden max-lg:flex fixed bottom-0 left-0 right-0 h-15 bg-sidebar-bg border-t border-white/6 z-30 px-2">
      {BOTTOM_NAV_ITEMS.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-2xs transition-colors ${
            isActive(item.href) ? 'text-accent' : 'text-sidebar-fg'
          }`}
        >
          <Icon name={item.icon} size={18} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
