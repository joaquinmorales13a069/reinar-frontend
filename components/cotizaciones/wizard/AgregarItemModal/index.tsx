'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import { TabEquipo } from './TabEquipo';
import { TabHerramienta } from './TabHerramienta';
import { TabServicio } from './TabServicio';
import { TabConsumible } from './TabConsumible';
import { TabAndamio } from './TabAndamio';
import { TabCustom } from './TabCustom';

type TabId = 'EQUIPO' | 'HERRAMIENTA' | 'SERVICIO' | 'CONSUMIBLE' | 'PIEZA_ANDAMIO' | 'CUSTOM';

const TABS: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'EQUIPO',        label: 'Equipos',       icon: 'package' },
  { id: 'HERRAMIENTA',   label: 'Herramientas',  icon: 'hammer' },
  { id: 'SERVICIO',      label: 'Servicios',     icon: 'tool' },
  { id: 'CONSUMIBLE',    label: 'Consumibles',   icon: 'box' },
  { id: 'PIEZA_ANDAMIO', label: 'Andamios',      icon: 'layers' },
  { id: 'CUSTOM',        label: 'Personalizado', icon: 'edit' },
];

type Props = { cotizacionId: string; onClose: () => void };

export function AgregarItemModal({ cotizacionId, onClose }: Props) {
  const [tab, setTab] = useState<TabId>('EQUIPO');

  const childProps = { cotizacionId, onAdded: onClose };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-bg rounded-lg border border-bd shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
          <h3 className="text-base font-semibold text-tx">Agregar ítem</h3>
          <button
            type="button"
            className="inline-flex items-center justify-center w-8 h-8 rounded text-tx-3 hover:bg-bg-sunken hover:text-tx transition-colors"
            onClick={onClose}
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        <div className="flex gap-1 px-4 pt-3 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${
                tab === t.id ? 'bg-accent text-navy font-medium' : 'text-tx-2 hover:bg-bg-sunken'
              }`}
              onClick={() => setTab(t.id)}
            >
              <Icon name={t.icon} size={13} /> {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'EQUIPO' && <TabEquipo {...childProps} />}
          {tab === 'HERRAMIENTA' && <TabHerramienta {...childProps} />}
          {tab === 'SERVICIO' && <TabServicio {...childProps} />}
          {tab === 'CONSUMIBLE' && <TabConsumible {...childProps} />}
          {tab === 'PIEZA_ANDAMIO' && <TabAndamio {...childProps} />}
          {tab === 'CUSTOM' && <TabCustom {...childProps} />}
        </div>
      </div>
    </div>
  );
}

export type TabChildProps = { cotizacionId: string; onAdded: () => void };
