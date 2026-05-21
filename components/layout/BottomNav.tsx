'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { BOTTOM_NAV_ITEMS, type BottomNavGroup } from '@/lib/nav';

export function BottomNav() {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  function isActiveHref(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  function isGroupActive(group: BottomNavGroup) {
    return group.children.some((c) => isActiveHref(c.href));
  }

  // Cerramos el popover al tocar fuera del nav. El cierre por navegación
  // ya lo hace el onClick de cada Link hijo (setOpenGroup(null)).
  useEffect(() => {
    if (!openGroup) return;
    function onDocPointerDown(e: PointerEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
      }
    }
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [openGroup]);

  return (
    <nav
      ref={navRef}
      className="hidden max-lg:flex fixed bottom-0 left-0 right-0 h-15 bg-sidebar-bg border-t border-white/6 z-30 px-2"
    >
      {BOTTOM_NAV_ITEMS.map((slot) => {
        if (slot.kind === 'link') {
          const active = isActiveHref(slot.href);
          return (
            <Link
              key={slot.id}
              href={slot.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-2xs transition-colors ${
                active ? 'text-accent' : 'text-sidebar-fg'
              }`}
            >
              <Icon name={slot.icon} size={18} />
              <span>{slot.label}</span>
            </Link>
          );
        }

        const active = isGroupActive(slot);
        const isOpen = openGroup === slot.id;
        return (
          <div key={slot.id} className="flex-1 relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={isOpen}
              onClick={() => setOpenGroup((prev) => (prev === slot.id ? null : slot.id))}
              className={`w-full h-full flex flex-col items-center justify-center gap-0.5 text-2xs transition-colors ${
                active || isOpen ? 'text-accent' : 'text-sidebar-fg'
              }`}
            >
              <Icon name={slot.icon} size={18} />
              <span>{slot.label}</span>
            </button>

            {isOpen && (
              <div
                role="menu"
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 min-w-48 bg-sidebar-bg border border-white/10 rounded-lg shadow-lg overflow-hidden"
              >
                {slot.children.map((child) => {
                  const childActive = isActiveHref(child.href);
                  return (
                    <Link
                      key={child.id}
                      href={child.href}
                      role="menuitem"
                      onClick={() => setOpenGroup(null)}
                      className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                        childActive
                          ? 'text-accent bg-white/5'
                          : 'text-sidebar-fg hover:bg-white/5'
                      }`}
                    >
                      <Icon name={child.icon} size={14} />
                      <span>{child.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
