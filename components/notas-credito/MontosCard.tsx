import { formatCurrency } from '@/lib/utils';

type Props = {
  subtotal: string | number;
  montoIva: string | number;
  total: string | number;
  porcentajeIva?: number;     // default 13
  variant?: 'detalle' | 'preview';
};

export function MontosCard({ subtotal, montoIva, total, porcentajeIva = 13, variant = 'detalle' }: Props) {
  const wrapper =
    variant === 'preview'
      ? 'rounded-md bg-bg-sunken p-4'
      : 'rounded-md border border-bd p-4';

  return (
    <div className={wrapper}>
      <table className="w-full text-sm">
        <tbody>
          <tr>
            <td className="py-1 text-tx-2">Subtotal</td>
            <td className="py-1 text-right font-mono">{formatCurrency(subtotal)}</td>
          </tr>
          <tr>
            <td className="py-1 text-tx-2">IVA ({porcentajeIva}%)</td>
            <td className="py-1 text-right font-mono">{formatCurrency(montoIva)}</td>
          </tr>
          <tr className="border-t border-bd">
            <td className="pt-2 font-semibold">Total acreditado</td>
            <td className="pt-2 text-right font-mono font-semibold text-danger">
              −{formatCurrency(total)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
