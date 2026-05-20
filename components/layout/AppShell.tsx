'use client';

import { useState } from 'react';
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
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [tweaksOpen, setTweaksOpen] = useState(false);

  return (
    <div className="app">
      <Sidebar
        expanded={sidebarExpanded}
        onCollapse={() => setSidebarExpanded(false)}
      />

      {/* Overlay semitransparente que cierra el sidebar en móvil al tocarlo */}
      {sidebarExpanded && (
        <div className="scrim" onClick={() => setSidebarExpanded(false)} />
      )}

      <div className="main">
        <Topbar
          onMenuClick={() => setSidebarExpanded(true)}
          onTweaksOpen={() => setTweaksOpen(true)}
        />
        <div className="content">{children}</div>
      </div>

      <BottomNav />

      {tweaksOpen && <TweaksPanel onClose={() => setTweaksOpen(false)} />}
    </div>
  );
}
