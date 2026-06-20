'use client';

/**
 * Sub-panel "Enviar inventario a bodega de proyecto".
 * Permite elegir tipo de ítem, el ítem específico de la bodega principal,
 * la cantidad (para stock) y llama el endpoint de transferencia correspondiente.
 *
 * DTOs confirmados contra types/api.ts y hooks existentes:
 *  - Equipo:   PATCH /equipos/:id/bodega         body: MoverBodegaDto { bodegaDestinoId }
 *  - Unidad:   PATCH /herramientas/unidades/:id/bodega  body: MoverBodegaDto { bodegaDestinoId }
 *  - Consumible: PATCH /consumibles/:id/transferir-stock body: TransferirStockDto { bodegaOrigenId, bodegaDestinoId, cantidad }
 *  - Pieza:    PATCH /andamios/piezas/:id/transferir-stock body: TransferirStockDto { bodegaOrigenId, bodegaDestinoId, cantidad }
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { useBodegaInventario } from '@/hooks/use-bodega-inventario';
import { useMoverBodegaEquipo } from '@/hooks/use-equipos';
import { useMoverBodegaUnidad } from '@/hooks/use-herramientas';
import { useTransferirStock } from '@/hooks/use-consumibles';
import { useTransferirStockPieza } from '@/hooks/use-andamios';
import { useBodegas } from '@/hooks/use-bodegas';

type TipoItem = 'equipo' | 'unidad' | 'consumible' | 'pieza';

interface Props {
  bodegaProyectoId: string;
  onCerrar: () => void;
}

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border border-bd bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors disabled:opacity-50';

export function EnviarInventarioProyecto({ bodegaProyectoId, onCerrar }: Props) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<TipoItem>('equipo');
  const [bodegaOrigenId, setBodegaOrigenId] = useState('');
  const [itemId, setItemId] = useState('');
  // Para herramientas (unidades) también se necesita el tipoId para invalidar
  const [unidadTipoId, setUnidadTipoId] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [enviando, setEnviando] = useState(false);

  // Bodegas principales para elegir la bodega origen (excluimos la bodega-proyecto)
  const { data: bodegasArr } = useBodegas();
  const bodegasOrigen = (bodegasArr ?? []).filter(
    (b) => b.activa && b.tipo !== 'PROYECTO' && (b.parentId === null || b.parentId === undefined),
  );

  // Inventario de la bodega origen seleccionada (para listar ítems disponibles)
  const { data: invOrigen, isLoading: cargandoInv } = useBodegaInventario(
    bodegaOrigenId || null,
  );

  const moverEquipo = useMoverBodegaEquipo();
  const moverUnidad = useMoverBodegaUnidad();
  const transferirConsumible = useTransferirStock();
  const transferirPieza = useTransferirStockPieza();

  // Resetear item seleccionado al cambiar tipo u origen
  function handleCambiarTipo(t: TipoItem) {
    setTipo(t);
    setItemId('');
    setUnidadTipoId('');
    setCantidad(1);
  }

  function handleCambiarOrigen(id: string) {
    setBodegaOrigenId(id);
    setItemId('');
    setUnidadTipoId('');
    setCantidad(1);
  }

  async function handleEnviar() {
    if (!itemId || !bodegaOrigenId) return;
    setEnviando(true);
    try {
      if (tipo === 'equipo') {
        await moverEquipo.mutateAsync({ id: itemId, data: { bodegaDestinoId: bodegaProyectoId } });
      } else if (tipo === 'unidad') {
        await moverUnidad.mutateAsync({
          unidadId: itemId,
          tipoId: unidadTipoId,
          data: { bodegaDestinoId: bodegaProyectoId },
        });
      } else if (tipo === 'consumible') {
        await transferirConsumible.mutateAsync({
          id: itemId,
          data: { bodegaOrigenId, bodegaDestinoId: bodegaProyectoId, cantidad },
        });
      } else if (tipo === 'pieza') {
        await transferirPieza.mutateAsync({
          id: itemId,
          data: { bodegaOrigenId, bodegaDestinoId: bodegaProyectoId, cantidad },
        });
      }
      // Invalidar el inventario de la bodega-proyecto para refrescar la tabla
      qc.invalidateQueries({ queryKey: ['bodega-inventario', bodegaProyectoId] });
      qc.invalidateQueries({ queryKey: ['bodega-inventario', bodegaOrigenId] });
      // Resetear selección
      setItemId('');
      setUnidadTipoId('');
      setCantidad(1);
    } finally {
      setEnviando(false);
    }
  }

  const tieneStock = tipo === 'consumible' || tipo === 'pieza';

  // Ítems disponibles según tipo elegido
  const equiposDisp = invOrigen?.equipos ?? [];
  const unidadesDisp = invOrigen?.unidadesHerramienta ?? [];
  const consumiblesDisp = invOrigen?.consumibles ?? [];
  const piezasDisp = invOrigen?.piezasAndamio ?? [];

  const hayItems =
    tipo === 'equipo'
      ? equiposDisp.length > 0
      : tipo === 'unidad'
        ? unidadesDisp.length > 0
        : tipo === 'consumible'
          ? consumiblesDisp.length > 0
          : piezasDisp.length > 0;

  return (
    <div className="rounded-lg border border-bd bg-bg-sunken p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold">Enviar inventario al proyecto</h4>
        <button
          type="button"
          onClick={onCerrar}
          className="text-tx-3 hover:text-tx transition-colors"
          aria-label="Cerrar"
        >
          <Icon name="x" size={14} />
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {/* Tipo de ítem */}
        <div>
          <label className="block text-xs font-medium text-tx-2 mb-1">
            Tipo de ítem
          </label>
          <select
            className={inputBase}
            value={tipo}
            onChange={(e) => handleCambiarTipo(e.target.value as TipoItem)}
          >
            <option value="equipo">Equipo</option>
            <option value="unidad">Unidad de herramienta</option>
            <option value="consumible">Consumible</option>
            <option value="pieza">Pieza de andamio</option>
          </select>
        </div>

        {/* Bodega origen */}
        <div>
          <label className="block text-xs font-medium text-tx-2 mb-1">
            Bodega origen <span className="text-danger">*</span>
          </label>
          <select
            className={inputBase}
            value={bodegaOrigenId}
            onChange={(e) => handleCambiarOrigen(e.target.value)}
          >
            <option value="">— Seleccioná —</option>
            {bodegasOrigen.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Ítem */}
        <div>
          <label className="block text-xs font-medium text-tx-2 mb-1">
            Ítem <span className="text-danger">*</span>
          </label>
          {cargandoInv && bodegaOrigenId ? (
            <div className="flex items-center gap-2 py-2">
              <Spinner size={12} />
              <span className="text-xs text-tx-3">Cargando inventario…</span>
            </div>
          ) : (
            <select
              className={inputBase}
              value={itemId}
              onChange={(e) => {
                setItemId(e.target.value);
                // Para unidades guardamos el tipoId del data-attr para invalidar queries
                if (tipo === 'unidad') {
                  const opt = e.target.selectedOptions[0];
                  setUnidadTipoId(opt?.dataset.tipoid ?? '');
                }
              }}
              disabled={!bodegaOrigenId || !hayItems}
            >
              <option value="">
                {!bodegaOrigenId
                  ? '— Elegí una bodega primero —'
                  : !hayItems
                    ? 'Sin ítems disponibles'
                    : '— Seleccioná —'}
              </option>
              {tipo === 'equipo' &&
                equiposDisp.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.codigo} — {eq.nombre}
                  </option>
                ))}
              {tipo === 'unidad' &&
                unidadesDisp.map((u) => (
                  <option key={u.id} value={u.id} data-tipoid={u.tipo.id}>
                    {u.codigoInterno} — {u.tipo.nombre}
                  </option>
                ))}
              {tipo === 'consumible' &&
                consumiblesDisp.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} — {c.nombre} (stock: {c.stock})
                  </option>
                ))}
              {tipo === 'pieza' &&
                piezasDisp.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} (stock: {p.stock})
                  </option>
                ))}
            </select>
          )}
        </div>

        {/* Cantidad — solo para consumibles y piezas */}
        {tieneStock && (
          <div>
            <label className="block text-xs font-medium text-tx-2 mb-1">
              Cantidad <span className="text-danger">*</span>
            </label>
            <input
              type="number"
              min={1}
              value={cantidad}
              onChange={(e) => setCantidad(Math.max(1, Number(e.target.value)))}
              className={inputBase}
              disabled={!itemId}
            />
          </div>
        )}
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCerrar}
          className="px-3 py-1.5 text-xs rounded-md border border-bd bg-surface text-tx-2 hover:bg-bg-sunken transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleEnviar}
          disabled={!itemId || !bodegaOrigenId || enviando || (tieneStock && cantidad < 1)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-accent text-navy font-medium hover:bg-accent-dim disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {enviando ? <Spinner size={12} /> : <Icon name="send" size={13} />}
          Enviar
        </button>
      </div>
    </div>
  );
}
