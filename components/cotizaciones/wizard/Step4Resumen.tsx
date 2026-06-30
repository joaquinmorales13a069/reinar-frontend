'use client';

import Decimal from 'decimal.js';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { FormSection } from '@/components/ui/FormSection';
import { useCambiarEstadoCotizacion } from '@/hooks/use-cotizaciones';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Cotizacion, PeriodoItem } from '@/types/api';

// Sufijo corto que acompana a la tarifa para hacer explicito que tipo de
// renta es (ej "$50/sem"). Diaria/CUSTOM no necesita sufijo en este resumen
// porque la columna "Cant." muestra "1 × N dias" cuando aplica.
const PERIODO_SUFIJO: Record<PeriodoItem, string> = {
  DIA: '/día',
  SEMANA: '/sem',
  QUINCENA: '/quinc',
  MES: '/mes',
  CUSTOM: '',
};

type Props = { cotizacion: Cotizacion; onBack: () => void };

export function Step4Resumen({ cotizacion, onBack }: Props) {
  const router = useRouter();
  const cambiarEstado = useCambiarEstadoCotizacion();

  function guardarBorrador() {
    router.push(`/cotizaciones/${cotizacion.id}`);
  }

  async function enviar() {
    try {
      await cambiarEstado.mutateAsync({ id: cotizacion.id, estado: 'ENVIADA' });
      router.push(`/cotizaciones/${cotizacion.id}`);
    } catch {
      // El toast lo maneja el hook. No avanzamos para que el usuario corrija.
    }
  }

  const clienteNombre =
    cotizacion.cliente.razonSocial ??
    `${cotizacion.cliente.nombre ?? ''} ${cotizacion.cliente.apellido ?? ''}`.trim();

  return (
    <div className="space-y-6">
      <FormSection title="Cliente y proyecto">
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-tx-3">Cliente</dt><dd className="text-tx">{clienteNombre}</dd>
          <dt className="text-tx-3">Proyecto</dt><dd className="text-tx">{cotizacion.proyecto?.nombre ?? '—'}</dd>
          <dt className="text-tx-3">Vencimiento</dt>
          <dd className="text-tx font-mono">{formatDate(cotizacion.fechaVencimiento)}</dd>
          <dt className="text-tx-3">Tipo DTE</dt>
          <dd className="text-tx">{cotizacion.tipoDocumentoFiscal ?? '—'}</dd>
        </dl>
      </FormSection>

      <div className="border border-bd rounded-md overflow-x-auto">
        <div className="px-4 py-2 bg-bg-sunken border-b border-bd text-sm font-medium text-tx">
          Ítems ({cotizacion.items.length})
        </div>
        <table className="w-full text-sm">
          <thead className="bg-bg-sunken text-2xs uppercase tracking-wider text-tx-3">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Descripción</th>
              <th className="text-right px-3 py-2 font-medium w-28">Cant.</th>
              <th className="text-right px-3 py-2 font-medium w-28">Tarifa</th>
              <th className="text-right px-3 py-2 font-medium w-28">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {cotizacion.items.map((it) => {
              const aplicaDias = it.tipo !== 'SERVICIO' && it.tipo !== 'CONSUMIBLE';
              const sufijo = PERIODO_SUFIJO[it.periodo] ?? '';
              return (
              <tr key={it.id} className="border-t border-bd">
                <td className="px-3 py-1.5">{it.descripcion}</td>
                <td className="px-3 py-1.5 text-right font-mono">
                  {it.cantidadUnidades}
                  {aplicaDias && it.cantidadDias > 1 && (
                    <span className="text-tx-3"> × {it.cantidadDias} días</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right font-mono">
                  {formatCurrency(it.tarifaAplicada)}
                  {sufijo && aplicaDias && (
                    <span className="text-tx-3">{sufijo}</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right font-mono font-medium">{formatCurrency(it.subtotal)}</td>
              </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-bg-sunken">
            <tr className="border-t border-bd">
              <td colSpan={3} className="text-right px-3 py-2 text-tx-2">Subtotal</td>
              <td className="text-right px-3 py-2 font-mono">{formatCurrency(cotizacion.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="text-right px-3 py-2 text-tx-2">{cotizacion.exentoIva ? 'Exento de IVA' : `IVA (${cotizacion.porcentajeIva}%)`}</td>
              <td className="text-right px-3 py-2 font-mono">{formatCurrency(cotizacion.montoIva)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="text-right px-3 py-2 font-semibold">{cotizacion.depositoMonto ? 'Total (sin depósito)' : 'Total'}</td>
              <td className="text-right px-3 py-2 font-mono font-bold text-base">{formatCurrency(cotizacion.total)}</td>
            </tr>
            {cotizacion.depositoMonto && (
              <>
                <tr>
                  <td colSpan={3} className="text-right px-3 py-2 text-tx-2">Depósito</td>
                  <td className="text-right px-3 py-2 font-mono">{formatCurrency(cotizacion.depositoMonto)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="text-right px-3 py-2 font-semibold">Total con depósito</td>
                  <td className="text-right px-3 py-2 font-mono font-bold text-base">{formatCurrency(new Decimal(cotizacion.total).add(cotizacion.depositoMonto).toFixed(2))}</td>
                </tr>
              </>
            )}
          </tfoot>
        </table>
      </div>

      <div className="flex justify-between gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-tx-2 border border-bd hover:bg-bg-sunken transition-colors"
          onClick={onBack}
        >
          <Icon name="arrowLeft" size={14} /> Anterior
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm border border-bd text-tx-2 hover:bg-bg-sunken transition-colors"
            onClick={guardarBorrador}
          >
            <Icon name="check" size={14} /> Guardar como borrador
          </button>
          <button
            type="button"
            disabled={cambiarEstado.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors disabled:opacity-50"
            onClick={enviar}
          >
            <Icon name="send" size={14} /> Marcar como enviada
          </button>
        </div>
      </div>
    </div>
  );
}
