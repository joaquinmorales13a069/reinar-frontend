// components/dashboard/KpiCard.tsx
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';

export type KpiDir = 'up' | 'down' | 'flat';

export type KpiCardProps = {
  label: string;
  value: string;
  subvalue?: string;
  icon: IconName;
  dir?: KpiDir;
};

const DIR_STYLES: Record<KpiDir, { color: string; icon: IconName; rotate?: string }> = {
  up:   { color: 'text-ok',     icon: 'arrowUpRight' },
  // arrowUpRight rotado 90° CW da la diagonal ↘ para valores negativos
  down: { color: 'text-danger', icon: 'arrowUpRight', rotate: 'rotate-90' },
  flat: { color: 'text-tx-3',   icon: 'arrowRight' },
};

export function KpiCard({ label, value, subvalue, icon, dir = 'flat' }: KpiCardProps) {
  const style = DIR_STYLES[dir];
  return (
    <div className="rounded-lg bg-surface border border-bd p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-tx-2 font-medium uppercase tracking-wide">{label}</span>
        <span className="text-tx-3">
          <Icon name={icon} size={14} />
        </span>
      </div>
      <div className="text-2xl font-semibold text-tx leading-none">{value}</div>
      {subvalue && (
        <div className={`flex items-center gap-1 text-xs ${style.color}`}>
          <Icon name={style.icon} size={11} className={style.rotate ?? ''} />
          <span>{subvalue}</span>
        </div>
      )}
    </div>
  );
}
