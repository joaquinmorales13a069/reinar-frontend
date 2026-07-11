'use client';

import { useState } from 'react';
import Decimal from 'decimal.js';
import { Icon } from '@/components/ui/Icon';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { EstadoDteBadge } from '@/components/facturas/EstadoDteBadge';
import type { Fse } from '@/types/api';

type Props = {
  fse: Fse;
  // isOperador cubre ADMIN|GERENTE|OPERADOR — el mismo set que el backend
  // exige para emitir/re-emitir/sincronizar (fse.routes.ts). isAdmin solo
  // habilita anular, que el backend restringe a ADMIN.
  isAdmin: boolean;
  isOperador: boolean;
  emitirError?: string | null;
  isEmitiendo?: boolean;
  isSincronizando?: boolean;
  isDescargandoPdf?: boolean;
  isDescargandoJson?: boolean;
  isDescargandoConstancia?: boolean;
  anularError?: string | null;
  isAnulando?: boolean;
  onEmitir?: () => void;
  onReemitir?: () => void;
  onSincronizar?: () => void;
  onAnular?: (motivo: string) => void;
  onDescargarPdf?: () => void;
  onDescargarJson?: () => void;
  onDescargarConstancia?: () => void;
};

const btnPrimary =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim disabled:opacity-50';
const btnSecondary =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border border-bd text-tx-2 hover:bg-bg-sunken disabled:opacity-50';
const btnDanger =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border border-danger text-danger hover:bg-danger-soft';

// Panel de DTE para FSE — espejo visual de DteSection (facturas/notas), pero
// simplificado: el FSE es siempre DTE tipo 14 (Sujeto Excluido), así que no
// hay selector ni grid de tipo.
export function FseDtePanel(props: Props) {
  const { fse, isAdmin, isOperador } = props;
  const [confirmEmit, setConfirmEmit] = useState(false);
  const [confirmAnular, setConfirmAnular] = useState(false);
  const [motivoAnular, setMotivoAnular] = useState('');
  const motivoValido = motivoAnular.trim().length >= 10;

  // Solo hay retención de renta (y por lo tanto constancia) cuando hubo
  // subtotal de servicios y el proveedor no fue exonerado.
  const tieneRetencion = new Decimal(fse.reteRenta || 0).gt(0);

  return (
    <div className="bg-bg border border-bd rounded-md p-4 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="fileText" size={18} />
        <h3 className="text-sm font-medium text-tx">Documento Tributario Electrónico</h3>
      </div>

      <div className="flex flex-wrap gap-6 items-end pb-4 mb-4 border-b border-bd">
        <div>
          <div className="text-2xs uppercase tracking-wider text-tx-3 font-medium mb-1">Tipo</div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-accent-soft text-accent">
            FSE — Sujeto Excluido
          </span>
        </div>
        <div>
          <div className="text-2xs uppercase tracking-wider text-tx-3 font-medium mb-1">Estado</div>
          <EstadoDteBadge estado={fse.estadoDTE} />
        </div>
        <div className="flex-1 min-w-52">
          <div className="text-2xs uppercase tracking-wider text-tx-3 font-medium mb-1">Número de control</div>
          {fse.dteControlNumber ? (
            <div className="inline-block font-mono text-xs bg-bg-sunken px-2 py-1 rounded">{fse.dteControlNumber}</div>
          ) : (
            <span className="text-tx-3 text-sm">—</span>
          )}
        </div>
      </div>

      {/* PENDIENTE */}
      {fse.estadoDTE === 'PENDIENTE' && (
        <>
          <div className="flex items-center gap-2 bg-warn-soft text-warn rounded-md px-3 py-2 text-sm">
            <Icon name="alertTriangle" size={14} />
            <span>Este FSE aún no ha sido enviado al Ministerio de Hacienda.</span>
          </div>
          {props.emitirError && (
            <div className="mt-2 flex items-start gap-2 bg-danger-soft text-danger rounded-md px-3 py-2 text-sm">
              <Icon name="alertTriangle" size={14} />
              <span>{props.emitirError}</span>
            </div>
          )}
          {isOperador && !confirmEmit && (
            <button type="button" className={`mt-3 ${btnPrimary}`} onClick={() => setConfirmEmit(true)} disabled={props.isEmitiendo}>
              <Icon name="send" size={14} /> Emitir DTE
            </button>
          )}
          {isOperador && confirmEmit && (
            <div className="mt-3">
              <ConfirmRow
                message="Se enviará este FSE al Ministerio de Hacienda como Documento Tributario Electrónico de Sujeto Excluido. ¿Confirmar?"
                confirmLabel="Confirmar emisión"
                variant="primary"
                onCancel={() => setConfirmEmit(false)}
                onConfirm={() => { setConfirmEmit(false); props.onEmitir?.(); }}
              />
            </div>
          )}
        </>
      )}

      {/* PROCESANDO */}
      {fse.estadoDTE === 'PROCESANDO' && (
        <>
          <div className="flex items-center gap-2 bg-info-soft text-info rounded-md px-3 py-2 text-sm">
            <Icon name="refresh" size={14} />
            <span>El documento está siendo procesado por el Ministerio de Hacienda.</span>
          </div>
          <div className="flex items-center gap-3 mt-3">
            {isOperador && (
              <button type="button" className={btnSecondary} onClick={() => props.onSincronizar?.()} disabled={props.isSincronizando}>
                <Icon name="refresh" size={14} /> {props.isSincronizando ? 'Sincronizando…' : 'Sincronizar estado'}
              </button>
            )}
            <span className="text-tx-3 text-sm">Esto puede tardar entre 1 y 10 minutos.</span>
          </div>
        </>
      )}

      {/* APROBADO */}
      {fse.estadoDTE === 'APROBADO' && (
        <>
          <div className="flex items-center gap-2 bg-ok-soft text-ok rounded-md px-3 py-2 text-sm">
            <Icon name="check" size={14} />
            <span>Documento aprobado por el Ministerio de Hacienda.</span>
          </div>
          {fse.dteControlNumber && (
            <div className="my-3 p-3 bg-bg-sunken rounded-md">
              <div className="text-2xs uppercase tracking-wider text-tx-3 font-medium mb-1">N° de control DTE</div>
              <div className="font-mono text-base font-semibold">{fse.dteControlNumber}</div>
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" className={btnPrimary} onClick={() => props.onDescargarPdf?.()} disabled={props.isDescargandoPdf}>
              <Icon name="download" size={14} /> {props.isDescargandoPdf ? 'Generando…' : 'Descargar PDF oficial'}
            </button>
            <button type="button" className={btnSecondary} onClick={() => props.onDescargarJson?.()} disabled={props.isDescargandoJson}>
              <Icon name="download" size={14} /> {props.isDescargandoJson ? 'Obteniendo…' : 'Descargar JSON'}
            </button>
            {tieneRetencion && (
              <button type="button" className={btnSecondary} onClick={() => props.onDescargarConstancia?.()} disabled={props.isDescargandoConstancia}>
                <Icon name="idCard" size={14} /> {props.isDescargandoConstancia ? 'Generando…' : 'Descargar constancia de retención'}
              </button>
            )}
            {isAdmin && !confirmAnular && (
              <button type="button" className={btnDanger} onClick={() => setConfirmAnular(true)}>
                <Icon name="trash" size={14} /> Anular DTE
              </button>
            )}
          </div>
          {isAdmin && confirmAnular && (
            <div className="mt-3">
              <ConfirmRow
                message={
                  <div className="w-full space-y-2">
                    <p>Se anulará este DTE ante el Ministerio de Hacienda. Esta acción no se puede deshacer.</p>
                    <textarea
                      rows={3}
                      value={motivoAnular}
                      onChange={(e) => setMotivoAnular(e.target.value)}
                      placeholder="Motivo de la anulación (mín. 10 caracteres)…"
                      className="w-full px-2 py-1.5 rounded border border-bd bg-bg text-sm text-tx"
                    />
                    {motivoAnular.length > 0 && !motivoValido && (
                      <p className="text-xs text-danger">El motivo debe tener al menos 10 caracteres.</p>
                    )}
                  </div>
                }
                confirmLabel={props.isAnulando ? 'Anulando…' : 'Anular DTE'}
                onCancel={() => { setConfirmAnular(false); setMotivoAnular(''); }}
                onConfirm={() => { if (motivoValido) props.onAnular?.(motivoAnular.trim()); }}
              />
            </div>
          )}
          {props.anularError && (
            <div className="mt-2 flex items-start gap-2 bg-danger-soft text-danger rounded-md px-3 py-2 text-sm">
              <Icon name="alertTriangle" size={14} />
              <span>{props.anularError}</span>
            </div>
          )}
        </>
      )}

      {/* RECHAZADO */}
      {fse.estadoDTE === 'RECHAZADO' && (
        <>
          <div className="flex items-start gap-2 bg-danger-soft text-danger rounded-md px-3 py-2 text-sm">
            <Icon name="alertTriangle" size={14} />
            <span>El Ministerio de Hacienda rechazó este documento.</span>
          </div>
          {fse.dteRespuestaMH && (() => {
            // El payload real del MH vive en dteRespuestaMH.mhResponse.data —
            // mismo shape que facturas/notas de crédito.
            const mh = fse.dteRespuestaMH.mhResponse?.data;
            const codigo = mh?.codigoMsg;
            const descripcion = mh?.descripcionMsg;
            const observaciones = mh?.observaciones ?? [];
            return (
              <div className="mt-3">
                <div className="text-2xs uppercase tracking-wider text-tx-3 font-medium mb-2">Motivo del rechazo</div>
                <pre className="p-3 bg-danger-soft border border-danger rounded-md text-xs font-mono whitespace-pre-wrap text-tx">
{`Código: ${codigo ?? '—'}
Descripción: ${descripcion ?? '—'}${observaciones.length > 0 ? '\n\nObservaciones:\n' + observaciones.map((o) => '- ' + o).join('\n') : ''}`}
                </pre>
              </div>
            );
          })()}
          {props.emitirError && (
            <div className="mt-2 flex items-start gap-2 bg-danger-soft text-danger rounded-md px-3 py-2 text-sm">
              <Icon name="alertTriangle" size={14} />
              <span>{props.emitirError}</span>
            </div>
          )}
          {isOperador && (
            <button type="button" className={`mt-3 ${btnPrimary}`} onClick={() => props.onReemitir?.()} disabled={props.isEmitiendo}>
              <Icon name="refresh" size={14} /> {props.isEmitiendo ? 'Reenviando…' : 'Corregir y re-emitir'}
            </button>
          )}
        </>
      )}

      {/* ANULADO */}
      {fse.estadoDTE === 'ANULADO' && (
        <div className="flex items-center gap-2 bg-bg-sunken text-tx-2 rounded-md px-3 py-2 text-sm">
          <Icon name="x" size={14} />
          <span>Este DTE fue anulado.</span>
        </div>
      )}
    </div>
  );
}
