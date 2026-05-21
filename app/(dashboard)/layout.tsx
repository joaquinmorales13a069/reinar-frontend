import { AppShell } from '@/components/layout/AppShell';
import { AuthHydrator } from '@/components/layout/AuthHydrator';

// Layout Server Component — solo renderiza el shell; toda la interactividad
// vive dentro de AppShell (Client Component) para mantener este árbol estático.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <AuthHydrator />
      {children}
    </AppShell>
  );
}
