'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Decimal } from 'decimal.js';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { FacturaTypeahead } from '@/components/notas-credito/FacturaTypeahead';
import { FacturaOrigenCard } from '@/components/notas-credito/FacturaOrigenCard';
import { TipoRetencionPicker } from '@/components/retenciones/TipoRetencionPicker';
import { useFacturas, useFactura } from '@/hooks/use-facturas';
import { useRegistrarRetencion } from '@/hooks/use-retenciones';
import { formatCurrency } from '@/lib/utils';
import type { FacturaListItem } from '@/types/api';

type Props = { facturaIdPre?: string };

export function RetencionForm({ facturaIdPre }: Props) {
  const router = useRouter();
  const registrar = useRegistrarRetencion();

  // Cargamos 100 facturas recientes para el typeahead client-side.
  const facturasQ = useFacturas({ limit: 100 });
  // Si llega facturaIdPre via query param, traemos esa factura aunque no esté
  // en la primera página del listado.
  const preQ = useFactura(facturaIdPre ?? null);

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

  const [numeroCR, setNumeroCR] = useState('');
  const [porcentaje, setPorcentaje] = useState<1 | 13>(1);
  // montoUserInput guarda el valor escrito por el usuario cuando editó manualmente.
  const [montoUserInput, setMontoUserInput] = useState('');
  // Flag para saber si el usuario editó el monto; permite que el cálculo automático
  // vuelva a tomar el control al cambiar de factura.
  const [montoManual, setMontoManual] = useState(false);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [notas, setNotas] = useState('');

  // Pre-carga monto cuando hay factura + porcentaje y el usuario no lo tocó.
  const montoCalc = useMemo(() => {
    if (!seleccion) return '';
    return new Decimal(seleccion.total).mul(porcentaje).div(100).toFixed(2);
  }, [seleccion, porcentaje]);

  // El monto efectivo es el del usuario si lo editó, o el calculado de otra forma.
  const monto = montoManual ? montoUserInput : montoCalc;

  const facturaSaldo = seleccion
    ? new Decimal(seleccion.saldoPendiente ?? seleccion.total)
    : new Decimal(0);
  const montoNum = new Decimal(monto || 0);
  const excedeSaldo = seleccion ? montoNum.greaterThan(facturaSaldo) : false;

  const valido =
    !!seleccion &&
    numeroCR.trim().length > 0 &&
    (porcentaje === 1 || porcentaje === 13) &&
    montoNum.greaterThan(0) &&
    !excedeSaldo &&
    !!fecha;

  async function onSubmit() {
    if (!seleccion) return;
    try {
      const r = await registrar.mutateAsync({
        facturaId: seleccion.id,
        numeroCR: numeroCR.trim(),
        porcentaje,
        monto,
        // Backend espera ISO datetime; convertimos el date input local a
        // medianoche UTC para satisfacer z.string().datetime().
        fecha: new Date(`${fecha}T00:00:00.000Z`).toISOString(),
        ...(notas.trim() ? { notas: notas.trim() } : {}),
      });
      router.push(`/retenciones/${r.id}`);
    } catch {
      // Toast manejado por el hook.
    }
  }

  return (
    <div>
      <PageHeader
        title="Registrar retención"
        subtitle="Capturá un comprobante de retención emitido por el cliente."
        back
        onBack={() => router.back()}
      />

      <div className="rounded-md border border-bd p-4 mb-4">
        <h3 className="text-sm font-semibold mb-3">Factura</h3>
        {!seleccion ? (
          <FacturaTypeahead
            facturas={facturasQ.data?.data ?? []}
            // Backend rechaza retención contra factura ANULADA.
            filter={(f) => f.estado !== 'ANULADA'}
            hint="Solo facturas activas."
            totalSinFiltrar={facturasQ.data?.meta.total}
            onSelect={(f) => {
              setSeleccionManual(f);
              setDescartadaPre(false);
              // Al cambiar factura, el cálculo automático retoma el control.
              setMontoManual(false);
              setMontoUserInput('');
            }}
          />
        ) : (
          <>
            <FacturaOrigenCard factura={seleccion} />
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1 text-xs text-tx-3 hover:text-tx"
              onClick={() => {
                setSeleccionManual(null);
                setDescartadaPre(true);
                setMontoManual(false);
                setMontoUserInput('');
              }}
            >
              <Icon name="x" size={12} /> Cambiar factura
            </button>
          </>
        )}
      </div>

      <div className="rounded-md border border-bd p-4 mb-4">
        <h3 className="text-sm font-semibold mb-3">Datos del comprobante</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-tx-2 mb-1">
              Número de comprobante CR <span className="text-danger">*</span>
            </label>
            <input
              value={numeroCR}
              onChange={(e) => setNumeroCR(e.target.value)}
              placeholder="CR-2026-04300"
              className="w-full px-2 py-1.5 rounded border border-bd bg-bg font-mono text-sm"
            />
            <div className="text-xs text-tx-3 mt-1">Lo emite el cliente.</div>
          </div>

          <div>
            <label className="block text-xs font-medium text-tx-2 mb-1">
              Fecha <span className="text-danger">*</span>
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-2 py-1.5 rounded border border-bd bg-bg font-mono text-sm"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-tx-2 mb-1">
            Tipo de retención <span className="text-danger">*</span>
          </label>
          <TipoRetencionPicker value={porcentaje} onChange={setPorcentaje} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <div>
            <label className="block text-xs font-medium text-tx-2 mb-1">
              Monto retenido <span className="text-danger">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={monto}
              onChange={(e) => {
                setMontoUserInput(e.target.value);
                setMontoManual(true);
              }}
              placeholder="0.00"
              className="w-full px-2 py-1.5 rounded border border-bd bg-bg font-mono text-sm font-semibold"
            />
            <div className="text-xs text-tx-3 mt-1">
              {seleccion
                ? `Calculado: total × ${porcentaje}% = ${formatCurrency(montoCalc)}. Editable.`
                : 'Seleccioná una factura para pre-cargar el monto.'}
            </div>
            {excedeSaldo && (
              <div className="text-xs text-danger mt-1">
                El monto retenido excede el saldo pendiente ({formatCurrency(facturaSaldo.toString())}).
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-tx-2 mb-1">Notas</label>
          <textarea
            rows={2}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Información adicional (opcional)."
            className="w-full px-2 py-1.5 rounded border border-bd bg-bg text-sm"
            maxLength={500}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="px-3 py-1.5 text-sm rounded-md border border-bd text-tx-2 hover:bg-bg-sunken"
          onClick={() => router.back()}
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!valido || registrar.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-accent text-navy hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onSubmit}
        >
          <Icon name="check" size={14} /> Registrar retención
        </button>
      </div>
    </div>
  );
}
