'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Decimal } from 'decimal.js';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { FacturaTypeahead } from '@/components/notas-credito/FacturaTypeahead';
import { FacturaOrigenCard } from '@/components/notas-credito/FacturaOrigenCard';
import { MontosCard } from '@/components/notas-credito/MontosCard';
import { useFacturas, useFactura } from '@/hooks/use-facturas';
import { useCrearNotaCredito } from '@/hooks/use-notas-credito';
import { formatCurrency } from '@/lib/utils';
import type { FacturaListItem, TipoNotaCredito } from '@/types/api';

type Props = { facturaIdPre?: string };

export function NotaCreditoForm({ facturaIdPre }: Props) {
  const router = useRouter();
  const crear = useCrearNotaCredito();

  // Cargamos 100 facturas recientes para el typeahead client-side; el predicado
  // filtra por estado/dte (ver justificacion en el spec, seccion 6.3).
  const facturasQ = useFacturas({ limit: 100 });
  // Si llega facturaIdPre via query param, traemos esa factura aunque no este
  // en la primera pagina del listado.
  const preQ = useFactura(facturaIdPre ?? null);

  // Factura elegida por el usuario en el typeahead.
  const [seleccionManual, setSeleccionManual] = useState<FacturaListItem | null>(null);
  // Cuando el usuario presiona "Cambiar factura", dejamos de mostrar la pre-seleccionada.
  const [descartadaPre, setDescartadaPre] = useState(false);

  // Estado derivado: evita sincronizar preQ.data → state dentro de un effect
  // (anti-pattern que rompe la regla react-hooks/set-state-in-effect).
  const seleccionDePre = useMemo<FacturaListItem | null>(() => {
    if (!preQ.data) return null;
    return {
      id: preQ.data.id,
      numeroFactura: preQ.data.numeroFactura,
      estado: preQ.data.estado,
      estadoDTE: preQ.data.estadoDTE,
      tipoDTE: preQ.data.tipoDTE,
      total: preQ.data.total,
      saldoPendiente: preQ.data.saldoPendiente,
      montoPagado: preQ.data.montoPagado,
      fechaEmision: preQ.data.fechaEmision,
      fechaVencimiento: preQ.data.fechaVencimiento,
      esQuedan: preQ.data.esQuedan,
      fechaEntregaFactura: preQ.data.fechaEntregaFactura,
      fechaEntregaReal: preQ.data.fechaEntregaReal,
      cliente: preQ.data.cliente,
      cotizacion: preQ.data.cotizacion,
      contactoFacturacion: preQ.data.contactoFacturacion,
    } as FacturaListItem;
  }, [preQ.data]);

  const seleccion: FacturaListItem | null =
    seleccionManual ?? (descartadaPre ? null : seleccionDePre);

  const [tipo, setTipo] = useState<TipoNotaCredito>('PARCIAL');
  const [subtotal, setSubtotal] = useState('');
  const [montoIva, setMontoIva] = useState('');
  const [total, setTotal] = useState('');
  const [totalManual, setTotalManual] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [confirmando, setConfirmando] = useState(false);

  // Total auto-calculado mientras el usuario no lo edite manualmente.
  const totalCalc = useMemo(() => {
    const s = Number(subtotal) || 0;
    const i = Number(montoIva) || 0;
    return s + i > 0 ? (s + i).toFixed(2) : '';
  }, [subtotal, montoIva]);
  const totalEfectivo = totalManual ? total : totalCalc;

  const facturaTotal = seleccion ? new Decimal(seleccion.total) : new Decimal(0);
  const motivoLen = motivo.trim().length;
  const motivoValido = motivoLen >= 10 && motivoLen <= 500;

  const totalNum = new Decimal(totalEfectivo || 0);
  const excedeFactura = seleccion ? totalNum.greaterThan(facturaTotal) : false;

  const montosParcialOk =
    tipo === 'TOTAL' ||
    (Number(subtotal) > 0 && Number(montoIva) >= 0 && totalNum.greaterThan(0) && !excedeFactura);

  const valido = !!seleccion && motivoValido && montosParcialOk;

  function cambiarTipo(t: TipoNotaCredito) {
    setTipo(t);
    if (t === 'TOTAL') {
      setSubtotal('');
      setMontoIva('');
      setTotal('');
      setTotalManual(false);
    }
  }

  async function onSubmit() {
    if (!seleccion) return;
    setConfirmando(false);
    try {
      const nc = await crear.mutateAsync({
        facturaId: seleccion.id,
        motivo: motivo.trim(),
        tipo,
        ...(tipo === 'PARCIAL'
          ? { subtotal, montoIva, total: totalEfectivo }
          : {}),
      });
      router.push(`/notas-credito/${nc.id}`);
    } catch {
      // Toast manejado por el hook.
    }
  }

  return (
    <div>
      <PageHeader
        title="Nueva nota de crédito"
        subtitle="Acreditá total o parcialmente una factura ya emitida."
        back
        onBack={() => router.back()}
      />

      <div className="rounded-md border border-bd p-4 mb-4">
        <h3 className="text-sm font-semibold mb-3">Factura origen</h3>
        {!seleccion ? (
          <FacturaTypeahead
            facturas={facturasQ.data?.data ?? []}
            // Acreditable solo si la factura ya esta pagada (total o parcial)
            // y tiene DTE aprobado — el backend rechaza lo contrario.
            filter={(f) => (f.estado === 'PAGADA' || f.estado === 'PARCIAL') && f.estadoDTE === 'APROBADO'}
            hint="Solo facturas PAGADA/PARCIAL con DTE APROBADO."
            totalSinFiltrar={facturasQ.data?.meta.total}
            onSelect={(f) => { setSeleccionManual(f); setDescartadaPre(false); }}
          />
        ) : (
          <>
            <FacturaOrigenCard factura={seleccion} />
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1 text-xs text-tx-3 hover:text-tx"
              onClick={() => { setSeleccionManual(null); setDescartadaPre(true); }}
            >
              <Icon name="x" size={12} /> Cambiar factura
            </button>
          </>
        )}
      </div>

      <div className="rounded-md border border-bd p-4 mb-4">
        <h3 className="text-sm font-semibold mb-3">Tipo y monto</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-tx-2 mb-1">
              Tipo <span className="text-danger">*</span>
            </label>
            <div className="inline-flex rounded-md border border-bd overflow-hidden">
              {(['PARCIAL', 'TOTAL'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`px-3 py-1.5 text-xs ${
                    tipo === t ? 'bg-accent text-navy' : 'bg-bg text-tx-2 hover:bg-bg-sunken'
                  }`}
                  onClick={() => cambiarTipo(t)}
                >
                  {t === 'TOTAL' ? 'Total' : 'Parcial'}
                </button>
              ))}
            </div>
            <div className="text-xs text-tx-3 mt-1">
              {tipo === 'TOTAL'
                ? 'Acredita el total de la factura. Pasa a ANULADA.'
                : 'Acreditá un monto parcial.'}
            </div>
          </div>
        </div>

        {tipo === 'PARCIAL' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <div>
              <label className="block text-xs font-medium text-tx-2 mb-1">
                Subtotal <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={subtotal}
                onChange={(e) => {
                  setSubtotal(e.target.value);
                  setTotalManual(false);
                }}
                placeholder="0.00"
                className="w-full px-2 py-1.5 rounded border border-bd bg-bg font-mono text-sm"
              />
              <div className="text-xs text-tx-3 mt-1">Monto sin IVA.</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-tx-2 mb-1">
                IVA (monto) <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={montoIva}
                onChange={(e) => {
                  setMontoIva(e.target.value);
                  setTotalManual(false);
                }}
                placeholder="0.00"
                className="w-full px-2 py-1.5 rounded border border-bd bg-bg font-mono text-sm"
              />
              <div className="text-xs text-tx-3 mt-1">Típicamente subtotal × 13%.</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-tx-2 mb-1">
                Total <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={totalEfectivo}
                onChange={(e) => {
                  setTotal(e.target.value);
                  setTotalManual(true);
                }}
                placeholder="0.00"
                className="w-full px-2 py-1.5 rounded border border-bd bg-bg font-mono text-sm font-semibold"
              />
              <div className="text-xs text-tx-3 mt-1">
                {totalManual
                  ? 'Editado manualmente. Borrá el campo para recalcular.'
                  : 'Calculado: subtotal + IVA.'}
              </div>
              {excedeFactura && (
                <div className="text-xs text-danger mt-1">
                  El total excede el total de la factura ({formatCurrency(facturaTotal.toString())}).
                </div>
              )}
            </div>
          </div>
        )}

        {tipo === 'TOTAL' && seleccion && (
          <div className="mt-4">
            <label className="block text-xs font-medium text-tx-2 mb-1">
              Montos de la factura (anulación total)
            </label>
            <MontosCard
              subtotal={seleccion.total}
              montoIva={0}
              total={seleccion.total}
              variant="preview"
            />
            <div className="text-xs text-tx-3 mt-1">
              El servidor toma estos valores directamente de la factura.
            </div>
          </div>
        )}

        <div className="mt-4">
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-medium text-tx-2">
              Motivo <span className="text-danger">*</span>
            </label>
            <span
              className={`font-mono text-xs ${
                motivoValido ? 'text-ok' : motivoLen > 0 ? 'text-danger' : 'text-tx-3'
              }`}
            >
              {motivoLen} / 10 mín.
            </span>
          </div>
          <textarea
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Explicá la razón de la nota de crédito (mínimo 10 caracteres)."
            className="w-full px-2 py-1.5 rounded border border-bd bg-bg text-sm"
          />
          {motivoLen > 0 && !motivoValido && (
            <div className="text-xs text-danger mt-1">
              El motivo debe tener al menos 10 caracteres.
            </div>
          )}
        </div>
      </div>

      {seleccion && tipo === 'PARCIAL' && totalNum.greaterThan(0) && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2">Preview</h3>
          <MontosCard
            subtotal={subtotal || 0}
            montoIva={montoIva || 0}
            total={totalEfectivo || 0}
            variant="preview"
          />
        </div>
      )}

      {confirmando && valido && (
        <ConfirmRow
          message={
            <>
              Esto creará una nota de crédito <b>{tipo}</b> por{' '}
              <b>
                {formatCurrency(tipo === 'TOTAL' ? seleccion!.total : totalEfectivo)}
              </b>{' '}
              contra la factura{' '}
              <span className="font-mono">{seleccion!.numeroFactura}</span>. ¿Confirmar?
            </>
          }
          confirmLabel={crear.isPending ? 'Creando…' : 'Crear nota de crédito'}
          variant="primary"
          onCancel={() => setConfirmando(false)}
          onConfirm={onSubmit}
        />
      )}

      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          className="px-3 py-1.5 text-sm rounded-md border border-bd text-tx-2 hover:bg-bg-sunken"
          onClick={() => router.back()}
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!valido || crear.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-accent text-navy hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => setConfirmando(true)}
        >
          <Icon name="fileText" size={14} /> Crear nota de crédito
        </button>
      </div>
    </div>
  );
}
