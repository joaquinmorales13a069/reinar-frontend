'use client';

import { Icon } from '@/components/ui/Icon';

type ConfirmRowProps = {
  message: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
};

export function ConfirmRow({ message, onCancel, onConfirm, confirmLabel = 'Confirmar', variant = 'danger' }: ConfirmRowProps) {
  const confirmCls = variant === 'danger'
    ? 'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-danger text-white hover:opacity-90 transition-opacity w-full sm:w-auto justify-center'
    : 'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors w-full sm:w-auto justify-center';

  return (
    <div className="flex flex-col sm:flex-row items-start gap-3 p-4 rounded-lg border border-bd-strong bg-bg-sunken mb-4">
      <span className="text-warn mt-0.5 shrink-0">
        <Icon name="alertTriangle" size={18} />
      </span>
      <span className="text-sm text-tx flex-1">{message}</span>
      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <button
          type="button"
          className="inline-flex items-center justify-center px-3 py-1.5 rounded-md text-sm text-tx-2 hover:bg-bg transition-colors w-full sm:w-auto border border-bd"
          onClick={onCancel}
        >
          Cancelar
        </button>
        <button type="button" className={confirmCls} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
