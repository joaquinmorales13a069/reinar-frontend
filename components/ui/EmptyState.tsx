import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';

type EmptyStateProps = { icon: IconName; title: string; message: string };

export function EmptyState({ icon, title, message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-bg-sunken flex items-center justify-center mb-4 text-tx-3">
        <Icon name={icon} size={22} />
      </div>
      <p className="font-medium text-tx mb-1">{title}</p>
      <p className="text-sm text-tx-2">{message}</p>
    </div>
  );
}
