'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGenerarFactura } from '@/hooks/use-facturas';
import { ContactoSolicitanteSelect } from '@/components/cotizaciones/ContactoSolicitanteSelect';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import type { Cliente } from '@/types/api';

interface Props {
  cotizacionId: string;
  cliente: Pick<Cliente, 'id' | 'tipo' | 'manejaQuedan'>;
  // Informativo: si las actas relacionadas a la cotizacion ya devolvieron todo
  // el inventario, no mostramos el banner recomendando esperar.
  actasTodasDevueltas: boolean;
  onClose: () => void;
}

function fechaPlus30(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors border-bd';

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
  const [fechaVencimiento, setFechaVencimiento] = useState(fechaPlus30());
  const [esQuedan, setEsQuedan] = useState(cliente.manejaQuedan);
  const [fechaEntregaFactura, setFechaEntregaFactura] = useState('');

  // Cerrar con Escape para consistencia con otros modales del modulo.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // El contacto de facturacion es opcional: el cliente ya tiene sus datos
  // fiscales. Solo exigimos vencimiento y, si es QUEDAN, la fecha de entrega.
  const puedeSubmit =
    !!fechaVencimiento &&
    (!esQuedan || !!fechaEntregaFactura);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!puedeSubmit) return;
    generar.mutate(
      {
        tipoDTE,
        contactoFacturacionId: contactoFacturacionId ?? undefined,
        fechaVencimiento,
        esQuedan,
        fechaEntregaFactura: esQuedan ? fechaEntregaFactura : undefined,
      },
      {
        onSuccess: ({ factura }) => {
          router.push(`/facturas/${factura.id}`);
        },
      },
    );
  }

  const isPending = generar.isPending;
  const mostrarBannerActas = esQuedan && !actasTodasDevueltas;

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
            <label className="text-xs font-medium text-tx-2">
              Fecha de vencimiento <span className="text-danger">*</span>
            </label>
            <input
              type="date"
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
              className={inputBase}
            />
            <p className="text-xs text-tx-3 mt-0.5">
              Por defecto, 30 días desde hoy.
            </p>
          </div>

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

          {esQuedan && (
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
