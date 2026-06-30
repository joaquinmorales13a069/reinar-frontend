'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useActualizarFactura } from '@/hooks/use-facturas';
import { useActa, useActasDeFactura } from '@/hooks/use-actas';
import type { Factura } from '@/types/api';

const inputCls =
  'w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent transition-colors';

function toDateInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : '';
}

export function PeriodoFacturaCard({ factura }: { factura: Factura }) {
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeEscribir = rol !== undefined && rol !== 'VISUALIZADOR';
  const anulada = factura.estado === 'ANULADA';
  const soloLectura = !puedeEscribir || anulada;

  // useActasDeFactura devuelve PaginatedResponse<ActaListItem>; el array va en .data.data.
  // ActaListItem no expone periodoRenta*, por eso pedimos el detalle completo
  // de la primera acta con useActa para obtener esos campos.
  const actas = useActasDeFactura(factura.id);
  const firstActaId = actas.data?.data?.[0]?.id ?? null;
  const primeraActa = useActa(firstActaId);

  const [inicio, setInicio] = useState(toDateInput(factura.periodoRentaInicio));
  const [fin, setFin] = useState(toDateInput(factura.periodoRentaFin));
  const [error, setError] = useState<string | null>(null);

  const hasSeeded = useRef(false);

  // Pre-carga del periodo del acta: solo una vez (un refetch de React Query no debe
  // pisar lo que el usuario ya tipeó).
  useEffect(() => {
    if (hasSeeded.current || !primeraActa.data) return;
    if (!factura.periodoRentaInicio && primeraActa.data.periodoRentaInicio) {
      setInicio(toDateInput(primeraActa.data.periodoRentaInicio));
    }
    if (!factura.periodoRentaFin && primeraActa.data.periodoRentaFin) {
      setFin(toDateInput(primeraActa.data.periodoRentaFin));
    }
    hasSeeded.current = true;
  }, [primeraActa.data, factura.periodoRentaInicio, factura.periodoRentaFin]);

  const actualizar = useActualizarFactura();

  async function guardar() {
    setError(null);
    if ((inicio && !fin) || (!inicio && fin)) {
      setError('Completá inicio y fin');
      return;
    }
    if (inicio && fin && inicio > fin) {
      setError('La fecha de inicio debe ser anterior o igual al fin');
      return;
    }
    await actualizar.mutateAsync({
      id: factura.id,
      data: {
        periodoRentaInicio: inicio ? new Date(inicio).toISOString() : null,
        periodoRentaFin: fin ? new Date(fin).toISOString() : null,
      },
    });
  }

  return (
    <div className={`bg-bg border border-bd rounded-md p-4 ${anulada ? 'opacity-60' : ''}`}>
      <h3 className="text-sm font-medium text-tx mb-3">Período de renta</h3>
      {soloLectura ? (
        <p className="text-sm text-tx">
          {factura.periodoRentaInicio && factura.periodoRentaFin
            ? `${toDateInput(factura.periodoRentaInicio)} — ${toDateInput(factura.periodoRentaFin)}`
            : '—'}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-tx-2 mb-1">Inicio</label>
              <input
                type="date"
                className={inputCls}
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-tx-2 mb-1">Fin</label>
              <input
                type="date"
                className={inputCls}
                value={fin}
                onChange={(e) => setFin(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-xs text-danger mt-2">{error}</p>}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={actualizar.isPending}
              onClick={() => {
                void guardar();
              }}
              className="px-4 py-2 text-sm rounded-md bg-accent text-navy font-medium hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              {actualizar.isPending ? 'Guardando…' : 'Guardar período'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
