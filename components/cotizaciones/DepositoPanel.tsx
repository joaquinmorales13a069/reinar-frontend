'use client';

import { useState } from 'react';
import {
  useDeposito,
  useRecibirDeposito,
  useDevolverDeposito,
} from '@/hooks/use-deposito';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { EstadoCotizacion } from '@/types/api';

interface Props {
  cotizacionId: string;
  cotizacionEstado: EstadoCotizacion;
  depositoMontoCotizacion: string | null;
}

// Mismo estilo de tarjeta que ResumenLateral para que el panel se sienta parte
// del detalle de la cotizacion.
const CARD_CLS = 'bg-bg border border-bd rounded-md p-4';

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors border-bd';

const btnBase =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors';

type ModoDevolucion = null | 'PARCIAL' | 'RETENER_TOTAL';

export function DepositoPanel({
  cotizacionId,
  cotizacionEstado,
  depositoMontoCotizacion,
}: Props) {
  // El registro de DepositoGarantia solo se crea cuando la cotizacion pasa a
  // APROBADA — antes de eso no tiene sentido pedirlo al backend.
  const visible =
    cotizacionEstado === 'APROBADA' &&
    !!depositoMontoCotizacion &&
    Number(depositoMontoCotizacion) > 0;

  const { data: deposito } = useDeposito(cotizacionId, visible);
  const recibir = useRecibirDeposito(cotizacionId);
  const devolver = useDevolverDeposito(cotizacionId);
  const user = useAuthStore((s) => s.user);
  const puedeEscribir = user?.rol !== 'VISUALIZADOR';

  const [modo, setModo] = useState<ModoDevolucion>(null);
  const [montoRetenido, setMontoRetenido] = useState('');
  const [razon, setRazon] = useState('');

  if (!visible || !deposito) return null;

  const estado = deposito.estado;
  const isBusy = recibir.isPending || devolver.isPending;

  function resetModo() {
    setModo(null);
    setMontoRetenido('');
    setRazon('');
  }

  function confirmarDevolverTotal() {
    devolver.mutate({ tipo: 'TOTAL' }, { onSuccess: resetModo });
  }

  function confirmarParcial() {
    const num = parseFloat(montoRetenido);
    if (!num || num <= 0 || !razon.trim()) return;
    devolver.mutate(
      { tipo: 'PARCIAL', montoRetenido: num, razonRetencion: razon.trim() },
      { onSuccess: resetModo },
    );
  }

  function confirmarRetenerTotal() {
    if (!razon.trim()) return;
    devolver.mutate(
      { tipo: 'RETENER_TOTAL', razonRetencion: razon.trim() },
      { onSuccess: resetModo },
    );
  }

  const esTerminal =
    estado === 'DEVUELTO' ||
    estado === 'RETENIDO_PARCIAL' ||
    estado === 'RETENIDO_TOTAL';

  return (
    <div className={CARD_CLS}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-medium text-tx flex items-center gap-2">
            <Icon name="shield" size={14} /> Depósito de garantía
          </h3>
          <div className="text-lg font-semibold text-tx mt-1">
            {formatCurrency(deposito.monto)}
          </div>
        </div>
        <Badge status={estado.replace('_', ' ')} />
      </div>

      <dl className="space-y-1.5 text-sm">
        {deposito.fechaRecibido && (
          <div className="flex justify-between gap-2">
            <dt className="text-tx-3">Recibido</dt>
            <dd className="text-tx font-mono">
              {formatDate(deposito.fechaRecibido)}
            </dd>
          </div>
        )}
        {deposito.fechaDevuelto && (
          <div className="flex justify-between gap-2">
            <dt className="text-tx-3">Cerrado</dt>
            <dd className="text-tx font-mono">
              {formatDate(deposito.fechaDevuelto)}
            </dd>
          </div>
        )}
        {deposito.montoRetenido && Number(deposito.montoRetenido) > 0 && (
          <div className="flex justify-between gap-2">
            <dt className="text-tx-3">Monto retenido</dt>
            <dd className="text-tx font-mono">
              {formatCurrency(deposito.montoRetenido)}
            </dd>
          </div>
        )}
        {deposito.razonRetencion && (
          <div className="pt-2 border-t border-bd">
            <dt className="text-tx-3 text-xs mb-1">Razón</dt>
            <dd className="text-sm text-tx-2 whitespace-pre-wrap">
              {deposito.razonRetencion}
            </dd>
          </div>
        )}
      </dl>

      {puedeEscribir && !esTerminal && (
        <div className="mt-4 pt-3 border-t border-bd">
          {estado === 'PENDIENTE' && modo === null && (
            <button
              type="button"
              onClick={() => recibir.mutate()}
              disabled={isBusy}
              className={`${btnBase} bg-accent text-navy hover:bg-accent-dim disabled:opacity-50 w-full justify-center`}
            >
              {recibir.isPending ? (
                <>
                  <Spinner /> Procesando…
                </>
              ) : (
                <>
                  <Icon name="check" size={14} /> Marcar como recibido
                </>
              )}
            </button>
          )}

          {estado === 'RECIBIDO' && modo === null && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={confirmarDevolverTotal}
                disabled={isBusy}
                className={`${btnBase} bg-accent text-navy hover:bg-accent-dim disabled:opacity-50`}
              >
                <Icon name="check" size={14} /> Devolver completo
              </button>
              <button
                type="button"
                onClick={() => setModo('PARCIAL')}
                disabled={isBusy}
                className={`${btnBase} border border-bd text-tx-2 hover:bg-bg-sunken disabled:opacity-50`}
              >
                <Icon name="dollar" size={14} /> Devolver parcial
              </button>
              <button
                type="button"
                onClick={() => setModo('RETENER_TOTAL')}
                disabled={isBusy}
                className={`${btnBase} border border-bd text-danger hover:bg-danger-soft disabled:opacity-50`}
              >
                <Icon name="x" size={14} /> Retener completo
              </button>
            </div>
          )}

          {modo === 'PARCIAL' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-tx-2 block mb-1">
                  Monto a retener <span className="text-danger">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={deposito.monto}
                  value={montoRetenido}
                  onChange={(e) => setMontoRetenido(e.target.value)}
                  placeholder="0.00"
                  className={inputBase}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-tx-2 block mb-1">
                  Razón <span className="text-danger">*</span>
                </label>
                <textarea
                  rows={2}
                  value={razon}
                  onChange={(e) => setRazon(e.target.value)}
                  placeholder="Ej. Daño en equipo XYZ"
                  className={inputBase}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetModo}
                  disabled={isBusy}
                  className={`${btnBase} border border-bd text-tx-2 hover:bg-bg-sunken disabled:opacity-50`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarParcial}
                  disabled={
                    isBusy || !montoRetenido || !razon.trim()
                  }
                  className={`${btnBase} bg-accent text-navy hover:bg-accent-dim disabled:opacity-50`}
                >
                  {devolver.isPending ? (
                    <>
                      <Spinner /> Procesando…
                    </>
                  ) : (
                    <>
                      <Icon name="check" size={14} /> Confirmar devolución parcial
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {modo === 'RETENER_TOTAL' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-tx-2 block mb-1">
                  Razón <span className="text-danger">*</span>
                </label>
                <textarea
                  rows={2}
                  value={razon}
                  onChange={(e) => setRazon(e.target.value)}
                  placeholder="Motivo de la retención total"
                  className={inputBase}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetModo}
                  disabled={isBusy}
                  className={`${btnBase} border border-bd text-tx-2 hover:bg-bg-sunken disabled:opacity-50`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarRetenerTotal}
                  disabled={isBusy || !razon.trim()}
                  className={`${btnBase} bg-danger text-white hover:opacity-90 disabled:opacity-50`}
                >
                  {devolver.isPending ? (
                    <>
                      <Spinner /> Procesando…
                    </>
                  ) : (
                    <>
                      <Icon name="x" size={14} /> Confirmar retención total
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
