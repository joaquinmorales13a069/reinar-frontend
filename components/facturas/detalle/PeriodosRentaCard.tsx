'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useActualizarPeriodosRenta } from '@/hooks/use-facturas';
import type { Factura } from '@/types/api';

// Mismas constantes de clase que en EquipoForm.tsx para consistencia visual.
const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-1';

type RangoFila = { inicio: string; fin: string };

export function PeriodosRentaCard({ factura }: { factura: Factura }) {
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeEscribir =
    rol === 'ADMIN' || rol === 'GERENTE' || rol === 'OPERADOR';
  const anulada = factura.estado === 'ANULADA';

  const mutation = useActualizarPeriodosRenta(factura.id);

  // Precarga rangos desde los items del backend si ya se guardaron.
  const [rangos, setRangos] = useState<Record<string, RangoFila>>(() => {
    const init: Record<string, RangoFila> = {};
    for (const item of factura.cotizacion.items) {
      init[item.id] = {
        // Los campos vienen como ISO completo; recortamos a YYYY-MM-DD para el input type="date".
        inicio: item.periodoRentaInicio ? item.periodoRentaInicio.slice(0, 10) : '',
        fin: item.periodoRentaFin ? item.periodoRentaFin.slice(0, 10) : '',
      };
    }
    return init;
  });

  // Errores inline por fila (cotizacionItemId -> mensaje).
  const [erroresFila, setErroresFila] = useState<Record<string, string>>({});
  // Error a nivel de card (p.ej. 400/422 del backend).
  const [errorCard, setErrorCard] = useState<string | null>(null);

  function actualizarRango(itemId: string, campo: 'inicio' | 'fin', valor: string) {
    setRangos((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [campo]: valor } }));
    // Limpiar error de esa fila al editar.
    setErroresFila((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    setErrorCard(null);
  }

  async function guardar() {
    setErrorCard(null);
    const nuevosErrores: Record<string, string> = {};

    // Validar cada fila antes de construir el DTO.
    for (const item of factura.cotizacion.items) {
      const { inicio, fin } = rangos[item.id] ?? { inicio: '', fin: '' };
      const tieneInicio = inicio.trim() !== '';
      const tieneFin = fin.trim() !== '';

      if (tieneInicio && !tieneFin) {
        nuevosErrores[item.id] = 'Completá inicio y fin';
      } else if (!tieneInicio && tieneFin) {
        nuevosErrores[item.id] = 'Completá inicio y fin';
      } else if (tieneInicio && tieneFin && inicio > fin) {
        // Comparación lexicográfica YYYY-MM-DD es equivalente a comparación cronológica.
        nuevosErrores[item.id] = 'La fecha de inicio debe ser anterior o igual al fin';
      }
    }

    if (Object.keys(nuevosErrores).length > 0) {
      setErroresFila(nuevosErrores);
      return;
    }

    // Construir payload: solo filas con ambos campos completos.
    const items = factura.cotizacion.items
      .filter(({ id }) => {
        const { inicio, fin } = rangos[id] ?? { inicio: '', fin: '' };
        return inicio.trim() !== '' && fin.trim() !== '';
      })
      .map(({ id }) => {
        const { inicio, fin } = rangos[id];
        return {
          cotizacionItemId: id,
          inicio: new Date(inicio).toISOString(),
          fin: new Date(fin).toISOString(),
        };
      });

    try {
      await mutation.mutateAsync({ items });
    } catch (err) {
      const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = anyErr?.response?.data?.error?.message;
      if (msg) setErrorCard(msg);
    }
  }

  const items = factura.cotizacion.items;

  return (
    <div className={`bg-bg border border-bd rounded-md p-4 ${anulada ? 'opacity-60' : ''}`}>
      <h3 className="text-sm font-medium text-tx mb-3">Período de renta por línea</h3>

      {anulada && (
        <p className="text-xs text-tx-3 mb-3">Factura anulada — no editable</p>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-tx-3">Sin líneas en esta cotización.</p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const rango = rangos[item.id] ?? { inicio: '', fin: '' };
            const errorFila = erroresFila[item.id];
            const soloLectura = !puedeEscribir || anulada;

            return (
              <div key={item.id} className="space-y-2">
                <p className="text-xs font-medium text-tx">{item.descripcion}</p>

                {soloLectura ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className={labelCls}>Inicio</span>
                      <p className="text-sm text-tx">{rango.inicio || '—'}</p>
                    </div>
                    <div>
                      <span className={labelCls}>Fin</span>
                      <p className="text-sm text-tx">{rango.fin || '—'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor={`inicio-${item.id}`} className={labelCls}>Inicio</label>
                      <input
                        id={`inicio-${item.id}`}
                        type="date"
                        className={errorFila ? inputErr : inputOk}
                        value={rango.inicio}
                        onChange={(e) => actualizarRango(item.id, 'inicio', e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor={`fin-${item.id}`} className={labelCls}>Fin</label>
                      <input
                        id={`fin-${item.id}`}
                        type="date"
                        className={errorFila ? inputErr : inputOk}
                        value={rango.fin}
                        onChange={(e) => actualizarRango(item.id, 'fin', e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {errorFila && <p className={errorCls}>{errorFila}</p>}
              </div>
            );
          })}
        </div>
      )}

      {errorCard && (
        <p className={`${errorCls} mt-3`}>{errorCard}</p>
      )}

      {puedeEscribir && !anulada && items.length > 0 && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => { void guardar(); }}
            className="px-4 py-2 text-sm rounded-md bg-accent text-bg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {mutation.isPending ? 'Guardando…' : 'Guardar períodos'}
          </button>
        </div>
      )}
    </div>
  );
}
