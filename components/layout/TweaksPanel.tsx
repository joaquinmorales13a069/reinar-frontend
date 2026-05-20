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

export function TweaksPanel({ onClose }: TweaksPanelProps) {
  const tweaks = useUiStore((s) => s.tweaks);
  const setTweak = useUiStore((s) => s.setTweak);

  return (
    <div className="tweaks">
      <div className="tweaks__head">
        <span className="tweaks__title">Tweaks</span>
        <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={onClose} aria-label="Cerrar panel">
          <Icon name="x" size={14} />
        </button>
      </div>

      <div className="tweaks__body">
        <div className="tweaks__row">
          <div className="tweaks__row-label">Tema</div>
          <div className="seg">
            <div
              className={`seg__opt ${tweaks.theme === 'light' ? 'is-active' : ''}`}
              onClick={() => setTweak('theme', 'light')}
            >
              <Icon name="sun" size={13} /> Claro
            </div>
            <div
              className={`seg__opt ${tweaks.theme === 'dark' ? 'is-active' : ''}`}
              onClick={() => setTweak('theme', 'dark')}
            >
              <Icon name="moon" size={13} /> Oscuro
            </div>
          </div>
        </div>

        <div className="tweaks__row">
          <div className="tweaks__row-label">Densidad</div>
          <div className="seg">
            <div
              className={`seg__opt ${tweaks.density === 'comfortable' ? 'is-active' : ''}`}
              onClick={() => setTweak('density', 'comfortable')}
            >
              Cómodo
            </div>
            <div
              className={`seg__opt ${tweaks.density === 'compact' ? 'is-active' : ''}`}
              onClick={() => setTweak('density', 'compact')}
            >
              Compacto
            </div>
          </div>
        </div>

        <div className="tweaks__row">
          <div className="tweaks__row-label">Sidebar</div>
          <div className="seg">
            <div
              className={`seg__opt ${tweaks.sidebar === 'full' ? 'is-active' : ''}`}
              onClick={() => setTweak('sidebar', 'full')}
            >
              Completo
            </div>
            <div
              className={`seg__opt ${tweaks.sidebar === 'mini' ? 'is-active' : ''}`}
              onClick={() => setTweak('sidebar', 'mini')}
            >
              Íconos
            </div>
          </div>
        </div>

        <div className="tweaks__row">
          <div className="tweaks__row-label">Color de acento</div>
          <div className="swatches">
            {ACCENTS.map((a) => (
              <div
                key={a.id}
                className={`swatch ${tweaks.accent === a.id ? 'is-active' : ''}`}
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
