'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { EstadoDteBadge } from '@/components/facturas/EstadoDteBadge';
import { TipoDteBadge } from '@/components/facturas/TipoDteBadge';
import { formatDate } from '@/lib/utils';
import type { Cliente, Factura, TipoDTE } from '@/types/api';

type DocBase = Pick<
  Factura,
  'id' | 'tipoDTE' | 'estadoDTE' | 'dteId' | 'dteControlNumber' | 'dteRespuestaMH'
> & { fechaDTE?: string | null };

type Props = {
  doc: DocBase;
  kind: 'factura' | 'nota';
  cliente?: Pick<Cliente, 'id' | 'ncr' | 'tipoDocumento' | 'numeroDocumento' | 'actividadEconomica' | 'departamento' | 'municipio' | 'complemento'>;
  isAdmin?: boolean;
  isOperador?: boolean;
  emitirError?: string | null;
  isEmitiendo?: boolean;
  isSincronizando?: boolean;
  isDescargandoPdf?: boolean;
  onAsignarTipo?: (tipo: TipoDTE) => void;
  onEmitir?: () => void;
  onSincronizar?: () => void;
  onReemitir?: () => void;
  onAnular?: () => void;
  onDescargarPdf?: () => void;
};

const TIPO_INFO: Record<TipoDTE, { label: string; desc: string }> = {
  FC:              { label: 'FC — Factura Consumidor',          desc: 'Para consumidores finales sin NIT.' },
  CCF:             { label: 'CCF — Comprobante Crédito Fiscal', desc: 'Para contribuyentes con NIT y NCR.' },
  SUJETO_EXCLUIDO: { label: 'FSE — Sujeto Excluido',            desc: 'Para sujetos no contribuyentes del IVA.' },
};

// Cada tipo de DTE exige campos distintos del cliente; el backend rechaza
// la emision si faltan. Devolvemos el motivo legible para el tooltip cuando
// la opcion queda deshabilitada.
function motivoBloqueo(tipo: TipoDTE, c: Props['cliente']): string | null {
  if (!c) return 'Falta información del cliente';
  if (tipo === 'CCF') {
    if (!c.ncr) return 'Requiere NCR en el cliente';
    if (!c.actividadEconomica) return 'Requiere actividad económica en el cliente';
    return null;
  }
  if (tipo === 'SUJETO_EXCLUIDO') {
    if (!c.numeroDocumento) return 'Requiere documento de identidad en el cliente';
    if (!c.actividadEconomica) return 'Requiere actividad económica en el cliente';
    if (!c.departamento || !c.municipio || !c.complemento) return 'Requiere dirección completa (departamento, municipio, complemento)';
    return null;
  }
  return null;
}

export function DteSection(props: Props) {
  const { doc, kind, cliente, isAdmin, isOperador, emitirError, isEmitiendo, isSincronizando, isDescargandoPdf } = props;
  const [confirmEmit, setConfirmEmit] = useState(false);
  const [confirmTipo, setConfirmTipo] = useState<TipoDTE | null>(null);

  const tipoActual: TipoDTE | 'NC' | null = kind === 'nota' ? 'NC' : doc.tipoDTE;

  // ============ A) Sin tipo asignado (solo factura) ============
  if (kind === 'factura' && !doc.tipoDTE) {
    return (
      <div className="bg-bg border border-bd border-l-2 border-l-tx-3 rounded-md p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="fileText" size={18} />
          <h3 className="text-sm font-medium text-tx">Documento Tributario Electrónico</h3>
        </div>
        <p className="text-sm text-tx-2 mb-4">
          Esta factura no tiene tipo de documento tributario asignado. Seleccioná uno antes de emitir al Ministerio de Hacienda.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(['FC', 'CCF', 'SUJETO_EXCLUIDO'] as const).map((t) => {
            const bloqueo = motivoBloqueo(t, cliente);
            const deshabilitado = !!bloqueo;
            return (
              <button
                key={t}
                type="button"
                disabled={deshabilitado || !isOperador}
                onClick={() => setConfirmTipo(t)}
                title={bloqueo ?? undefined}
                className={`text-left rounded-md border p-3 transition-colors ${
                  deshabilitado
                    ? 'border-bd bg-bg-sunken opacity-60 cursor-not-allowed'
                    : 'border-bd hover:bg-bg-sunken cursor-pointer'
                }`}
              >
                <div className="text-sm font-medium text-tx mb-1">{TIPO_INFO[t].label}</div>
                <div className="text-xs text-tx-3">{TIPO_INFO[t].desc}</div>
                {bloqueo && cliente && (
                  <div className="mt-2 text-xs text-danger">
                    {bloqueo}.{' '}
                    <Link href={`/clientes/${cliente.id}`} className="underline">
                      Editar cliente
                    </Link>
                  </div>
                )}
              </button>
            );
          })}
        </div>
        {confirmTipo && (
          <div className="mt-3">
            <ConfirmRow
              message={`¿Asignar ${TIPO_INFO[confirmTipo].label} como tipo de DTE? Podrás emitirla al MH después de asignarlo.`}
              confirmLabel="Asignar tipo"
              variant="primary"
              onCancel={() => setConfirmTipo(null)}
              onConfirm={() => {
                props.onAsignarTipo?.(confirmTipo);
                setConfirmTipo(null);
              }}
            />
          </div>
        )}
      </div>
    );
  }

  // ============ B+) Con tipo asignado o nota — header + estado ============
  return (
    <div className="bg-bg border border-bd rounded-md p-4 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="fileText" size={18} />
        <h3 className="text-sm font-medium text-tx">Documento Tributario Electrónico</h3>
      </div>

      <div className="flex flex-wrap gap-6 items-end pb-4 mb-4 border-b border-bd">
        <div>
          <div className="text-2xs uppercase tracking-wider text-tx-3 font-medium mb-1">Tipo</div>
          {tipoActual === 'NC' ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-accent-soft text-accent">NC</span>
          ) : (
            tipoActual && <TipoDteBadge tipo={tipoActual} />
          )}
        </div>
        <div>
          <div className="text-2xs uppercase tracking-wider text-tx-3 font-medium mb-1">Estado</div>
          <EstadoDteBadge estado={doc.estadoDTE} />
        </div>
        <div className="flex-1 min-w-52">
          <div className="text-2xs uppercase tracking-wider text-tx-3 font-medium mb-1">Número de control</div>
          {doc.dteControlNumber ? (
            <div className="inline-block font-mono text-xs bg-bg-sunken px-2 py-1 rounded">{doc.dteControlNumber}</div>
          ) : (
            <span className="text-tx-3 text-sm">—</span>
          )}
        </div>
        {doc.fechaDTE && (
          <div>
            <div className="text-2xs uppercase tracking-wider text-tx-3 font-medium mb-1">Emisión DTE</div>
            <div className="font-mono text-sm">{formatDate(doc.fechaDTE)}</div>
          </div>
        )}
      </div>

      {/* C) PENDIENTE */}
      {doc.estadoDTE === 'PENDIENTE' && (
        <>
          <div className="flex items-center gap-2 bg-warn-soft text-warn rounded-md px-3 py-2 text-sm">
            <Icon name="alertTriangle" size={14} />
            <span>Este documento aún no ha sido enviado al Ministerio de Hacienda.</span>
          </div>
          {emitirError && (
            <div className="mt-2 flex items-start gap-2 bg-danger-soft text-danger rounded-md px-3 py-2 text-sm">
              <Icon name="alertTriangle" size={14} />
              <span>{emitirError}</span>
            </div>
          )}
          {isOperador && !confirmEmit && (
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim"
              onClick={() => setConfirmEmit(true)}
              disabled={isEmitiendo}
            >
              <Icon name="send" size={14} /> Emitir DTE
            </button>
          )}
          {isOperador && confirmEmit && (
            <div className="mt-3">
              <ConfirmRow
                message={`Se enviará la ${tipoActual} al MH. Esta acción no se puede deshacer fácilmente. ¿Confirmar?`}
                confirmLabel="Confirmar emisión"
                variant="primary"
                onCancel={() => setConfirmEmit(false)}
                onConfirm={() => {
                  setConfirmEmit(false);
                  props.onEmitir?.();
                }}
              />
            </div>
          )}
        </>
      )}

      {/* D) PROCESANDO */}
      {doc.estadoDTE === 'PROCESANDO' && (
        <>
          <div className="flex items-center gap-2 bg-info-soft text-info rounded-md px-3 py-2 text-sm">
            <Icon name="refresh" size={14} />
            <span>El documento está siendo procesado por el Ministerio de Hacienda.</span>
          </div>
          <div className="flex items-center gap-3 mt-3">
            {isAdmin && (
              <button
                type="button"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border border-bd text-tx-2 hover:bg-bg-sunken"
                onClick={() => props.onSincronizar?.()}
                disabled={isSincronizando}
              >
                <Icon name="refresh" size={14} /> {isSincronizando ? 'Sincronizando…' : 'Sincronizar estado'}
              </button>
            )}
            <span className="text-tx-3 text-sm">Esto puede tardar entre 1 y 10 minutos.</span>
          </div>
        </>
      )}

      {/* E) APROBADO */}
      {doc.estadoDTE === 'APROBADO' && (
        <>
          <div className="flex items-center gap-2 bg-ok-soft text-ok rounded-md px-3 py-2 text-sm">
            <Icon name="check" size={14} />
            <span>Documento aprobado por el Ministerio de Hacienda.</span>
          </div>
          {doc.dteControlNumber && (
            <div className="my-3 p-3 bg-bg-sunken rounded-md">
              <div className="text-2xs uppercase tracking-wider text-tx-3 font-medium mb-1">N° de control DTE</div>
              <div className="font-mono text-base font-semibold">{doc.dteControlNumber}</div>
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim disabled:opacity-50"
              onClick={() => props.onDescargarPdf?.()}
              disabled={isDescargandoPdf}
            >
              <Icon name="download" size={14} /> {isDescargandoPdf ? 'Generando…' : 'Descargar PDF oficial'}
            </button>
            {isAdmin && (
              <button
                type="button"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border border-danger text-danger hover:bg-danger-soft"
                onClick={() => props.onAnular?.()}
              >
                <Icon name="trash" size={14} /> Anular DTE
              </button>
            )}
          </div>
        </>
      )}

      {/* F) RECHAZADO */}
      {doc.estadoDTE === 'RECHAZADO' && (
        <>
          <div className="flex items-start gap-2 bg-danger-soft text-danger rounded-md px-3 py-2 text-sm">
            <Icon name="alertTriangle" size={14} />
            <span>El Ministerio de Hacienda rechazó este documento.</span>
          </div>
          {doc.dteRespuestaMH && (() => {
            // El payload real del MH vive en dteRespuestaMH.mhResponse.data —
            // antes leíamos campos planos (.codigo, .descripcionMsg, .observaciones)
            // que no existen en ese nivel y la sección salía con "—" / vacía.
            const mh = doc.dteRespuestaMH.mhResponse?.data;
            const codigo = mh?.codigoMsg;
            const descripcion = mh?.descripcionMsg;
            const observaciones = mh?.observaciones ?? [];
            return (
              <div className="mt-3">
                <div className="text-2xs uppercase tracking-wider text-tx-3 font-medium mb-2">Motivo del rechazo</div>
                <pre className="p-3 bg-danger-soft border border-danger rounded-md text-xs font-mono whitespace-pre-wrap text-tx">
{`Código: ${codigo ?? '—'}
Descripción: ${descripcion ?? '—'}${observaciones.length > 0 ? '\n\nObservaciones:\n' + observaciones.map((o: string) => '- ' + o).join('\n') : ''}`}
                </pre>
              </div>
            );
          })()}
          {isOperador && (
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim"
              onClick={() => props.onReemitir?.()}
              disabled={isEmitiendo}
            >
              <Icon name="refresh" size={14} /> {kind === 'nota' ? 'Corregir y re-emitir nota' : 'Corregir y re-emitir'}
            </button>
          )}
        </>
      )}

      {/* G) ANULADO */}
      {doc.estadoDTE === 'ANULADO' && (
        <div className="flex items-center gap-2 bg-bg-sunken text-tx-2 rounded-md px-3 py-2 text-sm">
          <Icon name="x" size={14} />
          <span>Este DTE fue anulado.</span>
        </div>
      )}
    </div>
  );
}
