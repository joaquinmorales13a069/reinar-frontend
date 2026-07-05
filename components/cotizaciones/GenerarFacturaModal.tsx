'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGenerarFactura } from '@/hooks/use-facturas';
import { ContactoSolicitanteSelect } from '@/components/cotizaciones/ContactoSolicitanteSelect';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { DIAS_UTC, LABEL_DIA } from '@/lib/dias-semana';
import type { Cliente } from '@/types/api';

interface Props {
  cotizacionId: string;
  cliente: Pick<Cliente, 'id' | 'tipo' | 'manejaQuedan' | 'diasRecepcionQuedan'>;
  // Informativo: si las actas relacionadas a la cotizacion ya devolvieron todo
  // el inventario, no mostramos el banner recomendando esperar.
  actasTodasDevueltas: boolean;
  onClose: () => void;
}

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors border-bd';

// Hoy en YYYY-MM-DD (UTC) para el min del input de vencimiento — coincide con
// el guard del backend, que rechaza vencimientos de crédito anteriores a hoy.
function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function GenerarFacturaModal({
  cotizacionId,
  cliente,
  actasTodasDevueltas,
  onClose,
}: Props) {
  const router = useRouter();
  const generar = useGenerarFactura(cotizacionId);

  // Pre-seleccion: las EMPRESAS suelen requerir CCF (credito fiscal) para
  // reclamar IVA; PARTICULAR cobra como consumidor final (FC). El operador
  // puede cambiarlo si el caso lo amerita.
  const [tipoDTE, setTipoDTE] =
    useState<'FC' | 'CCF' | 'SUJETO_EXCLUIDO'>(
      cliente.tipo === 'EMPRESA' ? 'CCF' : 'FC',
    );
  const [contactoFacturacionId, setContactoFacturacionId] = useState<
    string | null
  >(null);
  // Sin default: la condición de pago es una decisión consciente del operador.
  const [condicionPago, setCondicionPago] = useState<'CONTADO' | 'CREDITO' | null>(null);
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [esQuedan, setEsQuedan] = useState(cliente.manejaQuedan);
  const [plazoCredito, setPlazoCredito] = useState('');
  const [fechaEntregaFactura, setFechaEntregaFactura] = useState('');

  // Cerrar con Escape para consistencia con otros modales del modulo.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const esContado = condicionPago === 'CONTADO';
  const esCredito = condicionPago === 'CREDITO';
  // QUEDAN solo aplica con crédito: el plazo corre desde la entrega física.
  const quedanActivo = esCredito && esQuedan;

  const plazoNum = Number(plazoCredito);
  const plazoValido = Number.isInteger(plazoNum) && plazoNum >= 1 && plazoNum <= 365;
  const puedeSubmit =
    !!condicionPago &&
    (esContado ||
      (quedanActivo
        ? plazoValido && !!fechaEntregaFactura
        : !!fechaVencimiento));

  const diasCliente = cliente.diasRecepcionQuedan ?? [];
  // Advertencia local (el backend repite la validación en su warning): la
  // entrega programada cae en un día en que el cliente no recibe facturas.
  let advertenciaDia: string | null = null;
  if (quedanActivo && fechaEntregaFactura && diasCliente.length > 0) {
    const dia = DIAS_UTC[new Date(fechaEntregaFactura).getUTCDay()];
    if (!diasCliente.includes(dia)) {
      advertenciaDia = `Este cliente recibe facturas los ${diasCliente
        .map((d) => LABEL_DIA[d])
        .join(', ')}; la fecha elegida cae ${LABEL_DIA[dia]}.`;
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!puedeSubmit || !condicionPago) return;
    generar.mutate(
      {
        tipoDTE,
        contactoFacturacionId: contactoFacturacionId ?? undefined,
        condicionPago,
        esQuedan: quedanActivo,
        ...(esCredito && !quedanActivo ? { fechaVencimiento } : {}),
        ...(quedanActivo
          ? { plazoCredito: Number(plazoCredito), fechaEntregaFactura }
          : {}),
      },
      {
        onSuccess: ({ factura }) => {
          router.push(`/facturas/${factura.id}`);
        },
      },
    );
  }

  const isPending = generar.isPending;
  const mostrarBannerActas = quedanActivo && !actasTodasDevueltas;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-lg border border-bd bg-surface shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
          <div>
            <h3 className="text-sm font-semibold text-tx">Generar factura</h3>
            <p className="text-xs text-tx-3 mt-0.5">
              La factura se creará en estado BORRADOR. Podrás emitir el DTE
              después desde su detalle.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-tx-3 hover:text-tx hover:bg-bg-sunken transition-colors"
            aria-label="Cerrar"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="px-4 py-4 space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-tx-2">
              Tipo de documento fiscal <span className="text-danger">*</span>
            </label>
            <select
              value={tipoDTE}
              onChange={(e) =>
                setTipoDTE(
                  e.target.value as 'FC' | 'CCF' | 'SUJETO_EXCLUIDO',
                )
              }
              className={inputBase}
            >
              <option value="FC">FC — Factura de Consumidor Final</option>
              <option value="CCF">CCF — Crédito Fiscal</option>
              <option value="SUJETO_EXCLUIDO">FSE — Sujeto Excluido</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-tx-2">
              Facturar a <span className="text-tx-3 text-2xs">(opcional)</span>
            </label>
            <ContactoSolicitanteSelect
              clienteId={cliente.id}
              value={contactoFacturacionId}
              onChange={setContactoFacturacionId}
              defaultTipo="FACTURACION"
            />
            <p className="text-xs text-tx-3 mt-0.5">
              Contacto de facturación del cliente.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-tx-2">
              Condición de pago <span className="text-danger">*</span>
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: 'CONTADO', label: 'Contado', hint: 'Vence 24 h después de la emisión' },
                  { value: 'CREDITO', label: 'Crédito', hint: 'Con fecha de vencimiento o plazo QUEDAN' },
                ] as const
              ).map((op) => (
                <label
                  key={op.value}
                  className={
                    condicionPago === op.value
                      ? 'flex items-start gap-2 p-3 rounded-md border border-accent bg-bg-sunken cursor-pointer'
                      : 'flex items-start gap-2 p-3 rounded-md border border-bd cursor-pointer hover:bg-bg-sunken transition-colors'
                  }
                >
                  <input
                    type="radio"
                    name="condicionPago"
                    checked={condicionPago === op.value}
                    onChange={() => setCondicionPago(op.value)}
                    className="mt-0.5 accent-accent"
                  />
                  <span>
                    <span className="block text-sm font-medium text-tx">{op.label}</span>
                    <span className="block text-xs text-tx-3 mt-0.5">{op.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {esCredito && (
            <div className="flex items-start gap-3 p-3 rounded-md border border-bd bg-bg-sunken">
              <input
                id="esQuedan"
                type="checkbox"
                checked={esQuedan}
                onChange={(e) => setEsQuedan(e.target.checked)}
                className="mt-0.5 accent-[var(--yellow)]"
              />
              <div className="flex-1">
                <label
                  htmlFor="esQuedan"
                  className="text-sm font-medium text-tx cursor-pointer"
                >
                  Es factura QUEDAN
                </label>
                <p className="text-xs text-tx-3 mt-0.5">
                  La factura se entrega físicamente al cliente en una fecha
                  posterior; el plazo de crédito empieza a contar desde ese día.
                </p>
              </div>
            </div>
          )}

          {esCredito && !quedanActivo && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-tx-2">
                Fecha de vencimiento <span className="text-danger">*</span>
              </label>
              <input
                type="date"
                value={fechaVencimiento}
                min={hoyISO()}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                className={inputBase}
              />
            </div>
          )}

          {quedanActivo && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-tx-2">
                  Plazo de crédito (días) <span className="text-danger">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  value={plazoCredito}
                  onChange={(e) => setPlazoCredito(e.target.value)}
                  className={inputBase}
                  placeholder="30"
                />
                <p className="text-xs text-tx-3 mt-0.5">
                  El vencimiento se calcula al registrar la entrega física.
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-tx-2">
                  Fecha de entrega de la factura{' '}
                  <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  value={fechaEntregaFactura}
                  onChange={(e) => setFechaEntregaFactura(e.target.value)}
                  className={inputBase}
                />
                {diasCliente.length > 0 && (
                  <p className="text-xs text-tx-3 mt-0.5">
                    Este cliente recibe facturas:{' '}
                    {diasCliente.map((d) => LABEL_DIA[d]).join(', ')}.
                  </p>
                )}
              </div>
            </div>
          )}

          {esContado && (
            <p className="flex items-center gap-1.5 text-xs text-tx-2">
              <Icon name="check" size={12} className="text-accent" />
              Vence automáticamente 24 horas después de la emisión.
            </p>
          )}

          {advertenciaDia && (
            <div className="flex items-start gap-2 p-3 rounded-md border border-warn-soft bg-warn-soft text-warn text-xs">
              <Icon name="alertTriangle" size={14} />
              <span>{advertenciaDia}</span>
            </div>
          )}

          {mostrarBannerActas && (
            <div className="flex items-start gap-2 p-3 rounded-md border border-warn-soft bg-warn-soft text-warn text-xs">
              <Icon name="alertTriangle" size={14} />
              <span>
                Recomendado: emitir QUEDAN después de devolver el inventario.
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-bd">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm text-tx-2 border border-bd hover:bg-bg-sunken transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!puedeSubmit || isPending}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Spinner /> Generando…
                </>
              ) : (
                <>
                  <Icon name="receipt" size={14} /> Generar factura
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
