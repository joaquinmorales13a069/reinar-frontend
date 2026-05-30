'use client';

import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { BottomNav } from './BottomNav';

type AppShellProps = {
  children: React.ReactNode;
};

// Antes había state de sidebarOpen + overlay + TweaksPanel — todo eliminado:
// el hamburger era código muerto (Sidebar es max-lg:hidden), el sidebar mini
// se removió (siempre full), y TweaksPanel se reemplazó por dropdown en Topbar.
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 bg-bg">
        <Topbar />
        <div className="p-6 max-lg:pb-20">{children}</div>
      </div>
      <BottomNav />
    </div>
  );
}
