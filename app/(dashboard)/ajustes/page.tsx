'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { TabUsuarios } from '@/components/ajustes/TabUsuarios';
import { TabEmpresa } from '@/components/ajustes/TabEmpresa';
import { TabReportes } from '@/components/ajustes/TabReportes';

type TabKey = 'usuarios' | 'empresa' | 'reportes';

const TABS: { key: TabKey; label: string; icon: 'users' | 'building' | 'fileText' }[] = [
  { key: 'usuarios', label: 'Usuarios y roles', icon: 'users' },
  { key: 'empresa', label: 'Datos de Reinar', icon: 'building' },
  { key: 'reportes', label: 'Reportes programados', icon: 'fileText' },
];

function isTabKey(v: string | null): v is TabKey {
  return v === 'usuarios' || v === 'empresa' || v === 'reportes';
}

export default function AjustesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // tab vía query param para sobrevivir a refresh y permitir linkear directo
  // a una tab específica desde otros lados del ERP. Default 'usuarios'.
  const raw = searchParams.get('tab');
  const tab: TabKey = isTabKey(raw) ? raw : 'usuarios';

  function setTab(next: TabKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div>
      <PageHeader
        title="Ajustes"
        subtitle="Configuración general del sistema, usuarios y reportes programados."
      />

      <div className="flex gap-1 border-b border-bd mb-6">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 -mb-px text-sm border-b-2 transition-colors ${
                active
                  ? 'border-accent text-tx font-medium'
                  : 'border-transparent text-tx-3 hover:text-tx hover:border-bd'
              }`}
            >
              <Icon name={t.icon} size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'usuarios' && <TabUsuarios />}
      {tab === 'empresa' && <TabEmpresa />}
      {tab === 'reportes' && <TabReportes />}
    </div>
  );
}
