import Decimal from 'decimal.js';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { formatCurrency } from '@/lib/utils';
import type { Cotizacion, PeriodoItem, TipoItemCotizacion } from '@/types/api';

const PERIODO_LABEL: Record<PeriodoItem, string> = {
  DIA: 'Día', SEMANA: 'Semana', QUINCENA: 'Quincena', MES: 'Mes', CUSTOM: 'Custom',
};
// Sufijo para la tarifa (ej "$50.00/sem"). Solo aplica a items rentables.
const PERIODO_SUFIJO: Record<PeriodoItem, string> = {
  DIA: '/día', SEMANA: '/sem', QUINCENA: '/quinc', MES: '/mes', CUSTOM: '',
};
const TIPO_LABEL: Record<TipoItemCotizacion, string> = {
  EQUIPO: 'Equipo', HERRAMIENTA: 'Herramienta', SERVICIO: 'Servicio',
  CONSUMIBLE: 'Consumible', PIEZA_ANDAMIO: 'Andamio', CUSTOM: 'Custom',
};

export function ItemsTabla({ cotizacion }: { cotizacion: Cotizacion }) {
  const { items, subtotal, montoIva, total, porcentajeIva, exentoIva, depositoMonto } = cotizacion;
  return (
    <div className="border border-bd rounded-md overflow-x-auto bg-bg">
      <div className="px-4 py-2.5 border-b border-bd flex items-center justify-between">
        <h3 className="text-sm font-medium text-tx">Ítems cotizados</h3>
        <span className="text-xs text-tx-3">{items.length} líneas</span>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-bg-sunken text-2xs uppercase tracking-wider text-tx-3">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Descripción</th>
            <th className="text-left px-3 py-2 font-medium w-28">Tarifa</th>
            <th className="text-right px-3 py-2 font-medium w-28">Cant.</th>
            <th className="text-right px-3 py-2 font-medium w-28">Tarifa</th>
            <th className="text-right px-3 py-2 font-medium w-32">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-t border-bd">
              <td className="px-3 py-2">
                <div className="font-medium text-tx">{it.descripcion}</div>
                <div className="text-2xs text-tx-3 mt-0.5 flex items-center gap-1.5">
                  {TIPO_LABEL[it.tipo]}
                  {it.cotizacionItemOrigenId && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-bg-sunken text-tx-3">
                      <Icon name="refresh" size={10} /> Renovado
                    </span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2">
                {/* Consumibles se venden por unidad — no aplica período de renta. */}
                {it.tipo === 'CONSUMIBLE' ? (
                  <span className="text-xs text-tx-3">—</span>
                ) : (
                  <Badge
                    status={
                      PERIODO_LABEL[it.periodo] +
                      (it.periodo === 'CUSTOM' && it.periodoCustomLabel ? ` · ${it.periodoCustomLabel}` : '')
                    }
                    kind="neutral"
                  />
                )}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {it.cantidadUnidades}
                {it.cantidadDias > 1 && (
                  <span className="text-tx-3"> × {it.cantidadDias} días</span>
                )}
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {formatCurrency(it.tarifaAplicada)}
                {it.tipo !== 'SERVICIO' && it.tipo !== 'CONSUMIBLE' && PERIODO_SUFIJO[it.periodo] && (
                  <span className="text-tx-3">{PERIODO_SUFIJO[it.periodo]}</span>
                )}
                {it.esTarifaCustom && (
                  <div className="mt-0.5">
                    <Badge status="CUSTOM" kind="warn" />
                  </div>
                )}
              </td>
              <td className="px-3 py-2 text-right font-mono font-medium">{formatCurrency(it.subtotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-bg-sunken">
          <tr className="border-t border-bd">
            <td colSpan={4} className="text-right px-3 py-2 text-tx-2">Subtotal</td>
            <td className="text-right px-3 py-2 font-mono">{formatCurrency(subtotal)}</td>
          </tr>
          <tr>
            <td colSpan={4} className="text-right px-3 py-2 text-tx-2">{exentoIva ? 'Exento de IVA' : `IVA (${porcentajeIva}%)`}</td>
            <td className="text-right px-3 py-2 font-mono">{formatCurrency(montoIva)}</td>
          </tr>
          <tr>
            <td colSpan={4} className="text-right px-3 py-2 font-semibold">{depositoMonto ? 'Total (sin depósito)' : 'Total'}</td>
            <td className="text-right px-3 py-2 font-mono font-bold text-base">{formatCurrency(total)}</td>
          </tr>
          {depositoMonto && (
            <>
              <tr>
                <td colSpan={4} className="text-right px-3 py-2 text-tx-2">Depósito</td>
                <td className="text-right px-3 py-2 font-mono">{formatCurrency(depositoMonto)}</td>
              </tr>
              <tr>
                <td colSpan={4} className="text-right px-3 py-2 font-semibold">Total con depósito</td>
                <td className="text-right px-3 py-2 font-mono font-bold text-base">{formatCurrency(new Decimal(total).add(depositoMonto).toFixed(2))}</td>
              </tr>
            </>
          )}
        </tfoot>
      </table>
    </div>
  );
}
