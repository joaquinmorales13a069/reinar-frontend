'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { PiezasTable } from '@/components/andamios/piezas/PiezasTable';
import { CuerposTable } from '@/components/andamios/cuerpos/CuerposTable';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarAndamios } from '@/lib/andamios';

type Tab = 'piezas' | 'cuerpos';

// Clave usada para persistir el tab activo entre navegaciones del módulo.
const STORAGE_KEY = 'andamios:lastTab';

const btnPri =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors';

const tabCls = (active: boolean) =>
  `inline-flex items-center gap-2 px-3 py-2 text-sm border-b-2 transition-colors ${
    active ? 'border-accent text-tx font-semibold' : 'border-transparent text-tx-2 hover:text-tx'
  }`;

export function AndamiosTabs() {
  // Inicializamos en piezas para evitar mismatch SSR; el useEffect ajusta al
  // valor persistido tras hidratar.
  const [tab, setTab] = useState<Tab>('piezas');
  const rol = useAuthStore((s) => s.user?.rol);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved === 'piezas' || saved === 'cuerpos') setTab(saved);
  }, []);

  function changeTab(next: Tab) {
    setTab(next);
    sessionStorage.setItem(STORAGE_KEY, next);
  }

  const puedeCrearPieza  = puedeEjecutarAndamios('crearPieza', rol);
  const puedeCrearCuerpo = puedeEjecutarAndamios('crearCuerpo', rol);

  const action =
    tab === 'piezas'
      ? puedeCrearPieza && (
          <Link href="/andamios/piezas/nuevo" className={btnPri}>
            <Icon name="plus" size={14} /> Nueva pieza
          </Link>
        )
      : puedeCrearCuerpo && (
          <Link href="/andamios/cuerpos/nuevo" className={btnPri}>
            <Icon name="plus" size={14} /> Nueva configuración
          </Link>
        );

  return (
    <div>
      <PageHeader
        title="Andamios"
        subtitle="Catálogo de piezas y configuraciones de cuerpo."
        actions={action}
      />

      <div className="flex border-b border-bd mb-4" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'piezas'}
          className={tabCls(tab === 'piezas')}
          onClick={() => changeTab('piezas')}
        >
          <Icon name="package" size={13} /> Piezas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'cuerpos'}
          className={tabCls(tab === 'cuerpos')}
          onClick={() => changeTab('cuerpos')}
        >
          <Icon name="layers" size={13} /> Configuraciones de cuerpo
        </button>
      </div>

      {tab === 'piezas' ? <PiezasTable /> : <CuerposTable />}
    </div>
  );
}
