'use client';

import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';

type PageHeaderProps = {
  title: string;
  subtitle?: React.ReactNode;
  back?: boolean;
  backLabel?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
};

export function PageHeader({ title, subtitle, back, backLabel, onBack, actions }: PageHeaderProps) {
  const router = useRouter();

  function handleBack() {
    if (onBack) onBack();
    else router.back();
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
      <div className="flex items-start gap-3 min-w-0">
        {back && (
          <button type="button" onClick={handleBack} className={`inline-flex items-center gap-1.5 rounded text-tx-3 hover:bg-bg-sunken hover:text-tx transition-colors mt-0.5 shrink-0 ${backLabel ? 'px-2 py-1 text-sm' : 'justify-center w-7 h-7'}`}>
            <Icon name="arrowLeft" size={16} />
            {backLabel && <span>{backLabel}</span>}
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-title font-semibold tracking-tight text-tx truncate">{title}</h1>
          {subtitle && <div className="text-sm text-tx-2 mt-1">{subtitle}</div>}
        </div>
      </div>
      {actions && (
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-end gap-2 w-full sm:w-auto">
          {actions}
        </div>
      )}
    </div>
  );
}
