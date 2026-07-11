import Decimal from 'decimal.js';
import { formatCurrency } from '@/lib/utils';
import type { CrearFseItemDto } from '@/types/api';

type Props = {
  items: CrearFseItemDto[];
  exonerar: boolean;
};

// Réplica frontend del cálculo de fse.utils.ts (backend) — SOLO para preview
// en vivo mientras se arma el formulario. El backend siempre recalcula los
// totales al recibir el POST/PUT; si hay discrepancia, gana el backend.
export function FseResumenTotales({ items, exonerar }: Props) {
  const subtotalBienes = items
    .filter((i) => i.tipoItem === 'BIENES')
    .reduce((acc, i) => acc.add(new Decimal(i.precioUnitario || 0).mul(i.cantidad || 0)), new Decimal(0));

  const subtotalServicios = items
    .filter((i) => i.tipoItem === 'SERVICIOS')
    .reduce((acc, i) => acc.add(new Decimal(i.precioUnitario || 0).mul(i.cantidad || 0)), new Decimal(0));

  const totalCompra = subtotalBienes.add(subtotalServicios);
  // Retención de renta: 10% solo sobre servicios, salvo que el proveedor esté exonerado.
  const reteRenta = exonerar ? new Decimal(0) : subtotalServicios.mul(0.1).toDecimalPlaces(2);
  const totalPagar = totalCompra.sub(reteRenta);

  const filaCls = 'flex items-center justify-between py-1.5 text-sm';

  return (
    <div className="rounded-lg border border-bd bg-surface p-4">
      <h3 className="text-sm font-semibold text-tx mb-2">Resumen</h3>
      <div className="divide-y divide-bd">
        <div className={filaCls}>
          <span className="text-tx-2">Subtotal bienes</span>
          <span className="font-mono tabular-nums">{formatCurrency(subtotalBienes.toString())}</span>
        </div>
        <div className={filaCls}>
          <span className="text-tx-2">Subtotal servicios</span>
          <span className="font-mono tabular-nums">{formatCurrency(subtotalServicios.toString())}</span>
        </div>
        <div className={filaCls}>
          <span className="text-tx-2">Total compra</span>
          <span className="font-mono tabular-nums font-medium">{formatCurrency(totalCompra.toString())}</span>
        </div>
        <div className={`${filaCls} text-danger`}>
          <span>Retención renta (10% servicios){exonerar ? ' — exonerada' : ''}</span>
          <span className="font-mono tabular-nums">−{formatCurrency(reteRenta.toString())}</span>
        </div>
        <div className={`${filaCls} pt-2`}>
          <span className="text-tx font-semibold">Total a pagar</span>
          <span className="font-mono tabular-nums text-lg font-bold text-accent-dim">
            {formatCurrency(totalPagar.toString())}
          </span>
        </div>
      </div>
    </div>
  );
}
