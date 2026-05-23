'use client';

import { StockBar } from '@/components/herramientas/StockBar';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';

type Props = {
  stockActual: number;
  stockMinimo: number;
};

export function PiezaStockCard({ stockActual, stockMinimo }: Props) {
  const bajo = stockActual <= stockMinimo;
  return (
    <Card>
      <h3 className="text-sm font-semibold mb-3">Inventario</h3>
      <div className="flex items-end gap-3 mb-3">
        <div className={`font-mono text-3xl font-bold ${bajo ? 'text-warn' : 'text-tx'}`}>
          {stockActual}
        </div>
        <div className="text-xs text-tx-3 pb-1.5">unidades en stock</div>
      </div>
      <StockBar stockActual={stockActual} stockMinimo={stockMinimo} />
      <div className="flex justify-between text-xs mt-2">
        <span className="text-tx-3">
          Mínimo: <span className="font-mono">{stockMinimo}</span>
        </span>
        {bajo && (
          <span className="text-warn font-semibold inline-flex items-center gap-1">
            <Icon name="alertTriangle" size={11} /> Stock bajo — pedir reposición
          </span>
        )}
      </div>
    </Card>
  );
}
