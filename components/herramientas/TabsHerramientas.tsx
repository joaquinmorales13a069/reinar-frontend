'use client';

import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { HerramientasTiposList } from '@/components/herramientas/HerramientasTiposList';
import { ConsumiblesList } from '@/components/herramientas/ConsumiblesList';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutar } from '@/lib/herramientas';
import Link from 'next/link';

type Tab = 'tipos' | 'consumibles';

const btnPri =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors';

const tabCls = (active: boolean) =>
  `inline-flex items-center gap-2 px-3 py-2 text-sm border-b-2 transition-colors ${
    active
      ? 'border-accent text-tx font-semibold'
      : 'border-transparent text-tx-2 hover:text-tx'
  }`;

export function TabsHerramientas({ activeTab }: { activeTab: Tab }) {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');

  const puedeCrearTipo = puedeEjecutar('crearTipo', rol);
  const puedeCrearConsumible = puedeEjecutar('crearConsumible', rol);

  // replace, no push: queremos que cambiar de tab no apile la historia.
  function setTab(next: Tab) {
    router.replace(`/herramientas?tab=${next}`);
  }

  const action =
    activeTab === 'tipos'
      ? puedeCrearTipo && (
          <Link href="/herramientas/tipos/nuevo" className={btnPri}>
            <Icon name="plus" size={14} /> Nuevo tipo de herramienta
          </Link>
        )
      : puedeCrearConsumible && (
          <Link href="/herramientas/consumibles/nuevo" className={btnPri}>
            <Icon name="plus" size={14} /> Nuevo consumible
          </Link>
        );

  return (
    <div>
      <PageHeader
        title="Herramientas & Consumibles"
        subtitle="Catálogo de tipos, unidades físicas y materiales de obra."
        actions={action}
      />

      <div className="flex border-b border-bd mb-4">
        <button
          type="button"
          className={tabCls(activeTab === 'tipos')}
          onClick={() => setTab('tipos')}
        >
          <Icon name="hammer" size={13} /> Tipos de herramienta
        </button>
        <button
          type="button"
          className={tabCls(activeTab === 'consumibles')}
          onClick={() => setTab('consumibles')}
        >
          <Icon name="box" size={13} /> Consumibles
        </button>
      </div>

      {activeTab === 'tipos' ? <HerramientasTiposList /> : <ConsumiblesList />}
    </div>
  );
}
