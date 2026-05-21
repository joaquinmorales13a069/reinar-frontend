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
  return (
    <div className="confirm-row flex-col sm:flex-row mb-4">
      <span className="confirm-row__icon">
        <Icon name="alertTriangle" size={18} />
      </span>
      <span className="confirm-row__msg flex-1">{message}</span>
      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <button type="button" className="btn btn--ghost btn--sm w-full sm:w-auto" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className={`btn btn--${variant} btn--sm w-full sm:w-auto`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
