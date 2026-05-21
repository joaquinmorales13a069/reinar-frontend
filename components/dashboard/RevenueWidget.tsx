// components/dashboard/RevenueWidget.tsx
import { formatCurrency } from '@/lib/utils';

type RevenueWidgetProps = {
  ingresosMes: string;
};

export function RevenueWidget({ ingresosMes }: RevenueWidgetProps) {
  return (
    <div className="rounded-lg bg-surface border border-bd p-5 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-medium text-tx">Ingresos del mes en curso</h3>
        <p className="text-xs text-tx-3 mt-0.5">Total cobrado en pagos del mes actual</p>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-display font-bold text-tx leading-none">
          {formatCurrency(ingresosMes)}
        </span>
      </div>
    </div>
  );
}
