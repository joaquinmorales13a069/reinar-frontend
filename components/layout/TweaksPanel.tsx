'use client';

import { Icon } from '@/components/ui/Icon';
import { useUiStore } from '@/stores/ui.store';

type TweaksPanelProps = {
  onClose: () => void;
};

// Los acentos replican el contrato de ui.store: el ID debe coincidir con la clave del mapa ACCENTS
const ACCENTS = [
  { id: 'yellow', color: '#F2C037' },
  { id: 'blue',   color: '#2F6CB7' },
  { id: 'green',  color: '#2E8C5A' },
  { id: 'red',    color: '#C23B3B' },
] as const;

const segBase =
  'flex-1 h-7 inline-flex items-center justify-center gap-1.5 px-2.5 text-xs font-medium text-tx-2 rounded-sm cursor-pointer';
const segActive = 'bg-surface text-tx shadow-sm';

export function TweaksPanel({ onClose }: TweaksPanelProps) {
  const tweaks  = useUiStore((s) => s.tweaks);
  const setTweak = useUiStore((s) => s.setTweak);

  return (
    <div className="fixed right-4 bottom-4 w-72 bg-surface border border-bd-strong rounded shadow-2xl z-panel text-xs">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-bd">
        <span className="text-2xs font-semibold tracking-widest uppercase text-tx-2">Tweaks</span>
        <button
          className="size-6 grid place-items-center rounded text-tx-2 hover:bg-bg-sunken hover:text-tx transition-colors"
          onClick={onClose}
          aria-label="Cerrar panel"
        >
          <Icon name="x" size={14} />
        </button>
      </div>

      <div className="p-3 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="text-2xs tracking-widest uppercase text-tx-3 font-semibold">Tema</div>
          <div className="flex bg-bg-sunken border border-bd rounded p-0.5 gap-0.5">
            <div
              className={`${segBase} ${tweaks.theme === 'light' ? segActive : ''}`}
              onClick={() => setTweak('theme', 'light')}
            >
              <Icon name="sun" size={13} /> Claro
            </div>
            <div
              className={`${segBase} ${tweaks.theme === 'dark' ? segActive : ''}`}
              onClick={() => setTweak('theme', 'dark')}
            >
              <Icon name="moon" size={13} /> Oscuro
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="text-2xs tracking-widest uppercase text-tx-3 font-semibold">Densidad</div>
          <div className="flex bg-bg-sunken border border-bd rounded p-0.5 gap-0.5">
            <div
              className={`${segBase} ${tweaks.density === 'comfortable' ? segActive : ''}`}
              onClick={() => setTweak('density', 'comfortable')}
            >
              Cómodo
            </div>
            <div
              className={`${segBase} ${tweaks.density === 'compact' ? segActive : ''}`}
              onClick={() => setTweak('density', 'compact')}
            >
              Compacto
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="text-2xs tracking-widest uppercase text-tx-3 font-semibold">Sidebar</div>
          <div className="flex bg-bg-sunken border border-bd rounded p-0.5 gap-0.5">
            <div
              className={`${segBase} ${tweaks.sidebar === 'full' ? segActive : ''}`}
              onClick={() => setTweak('sidebar', 'full')}
            >
              Completo
            </div>
            <div
              className={`${segBase} ${tweaks.sidebar === 'mini' ? segActive : ''}`}
              onClick={() => setTweak('sidebar', 'mini')}
            >
              Íconos
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="text-2xs tracking-widest uppercase text-tx-3 font-semibold">Color de acento</div>
          <div className="flex gap-1.5">
            {ACCENTS.map((a) => (
              <div
                key={a.id}
                className={`size-6.5 rounded cursor-pointer border-2 transition-colors ${
                  tweaks.accent === a.id ? 'border-tx' : 'border-transparent'
                }`}
                style={{ background: a.color }}
                onClick={() => setTweak('accent', a.id)}
                title={a.id}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
