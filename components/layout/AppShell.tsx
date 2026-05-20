'use client';

import { useState } from 'react';
import { useUiStore } from '@/stores/ui.store';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { BottomNav } from './BottomNav';
import { TweaksPanel } from './TweaksPanel';

type AppShellProps = {
  children: React.ReactNode;
};

// Wrapper de cliente necesario porque el layout del dashboard es Server Component
// pero el estado del sidebar expandido y el panel de tweaks son interactivos.
export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMini   = useUiStore((s) => s.tweaks.sidebar === 'mini');
  const tweaksOpen    = useUiStore((s) => s.tweaksOpen);
  const setTweaksOpen = useUiStore((s) => s.setTweaksOpen);

  return (
    <div className="flex min-h-screen">
      <Sidebar isMini={isMini} onCollapse={() => setSidebarOpen(false)} />

      {/* Overlay semitransparente que cierra el sidebar en móvil al tocarlo */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-navy/50 z-40 animate-fade"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex flex-col flex-1 min-w-0 bg-bg">
        <Topbar
          onMenuClick={() => setSidebarOpen(true)}
          onTweaksOpen={() => setTweaksOpen(true)}
        />
        <div className="p-6 max-md:pb-20">{children}</div>
      </div>

      <BottomNav />

      {tweaksOpen && <TweaksPanel onClose={() => setTweaksOpen(false)} />}
    </div>
  );
}
