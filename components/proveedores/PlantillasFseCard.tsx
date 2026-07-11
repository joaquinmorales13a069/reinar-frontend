'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { formatCurrency } from '@/lib/utils';
import { usePlantillasFse, useCrearPlantillaFse, useEliminarPlantillaFse } from '@/hooks/use-fse';
import { useAuthStore } from '@/stores/auth.store';
import type { TipoItemFse } from '@/types/api';

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border border-bd bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const btnSec =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';

const LABEL_TIPO_ITEM: Record<TipoItemFse, string> = { BIENES: 'Bienes', SERVICIOS: 'Servicios' };
const KIND_TIPO_ITEM: Record<TipoItemFse, 'info' | 'accent'> = { BIENES: 'info', SERVICIOS: 'accent' };

// Atajos para precargar descripción/precio de compras recurrentes al mismo
// proveedor (p.ej. flete mensual) al armar una FSE — ver use-fse.ts.
export function PlantillasFseCard({ proveedorId }: { proveedorId: string }) {
  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');
  const puedeEscribir = rol !== 'VISUALIZADOR';

  const { data: plantillas, isLoading } = usePlantillasFse(proveedorId);
  const crear = useCrearPlantillaFse(proveedorId);
  const eliminar = useEliminarPlantillaFse(proveedorId);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [descripcion, setDescripcion] = useState('');
  const [tipoItem, setTipoItem] = useState<TipoItemFse>('SERVICIOS');
  const [precioUnitario, setPrecioUnitario] = useState('');
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(null);

  function resetForm() {
    setDescripcion('');
    setTipoItem('SERVICIOS');
    setPrecioUnitario('');
    setMostrarForm(false);
  }

  async function handleAgregar() {
    if (!descripcion.trim()) return;
    await crear.mutateAsync({
      descripcion: descripcion.trim(),
      tipoItem,
      precioUnitario: precioUnitario.trim() ? Number(precioUnitario) : undefined,
    });
    resetForm();
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Plantillas de ítems FSE</h3>
        {puedeEscribir && !mostrarForm && (
          <button type="button" className={btnSec} onClick={() => setMostrarForm(true)}>
            <Icon name="plus" size={12} /> Nueva plantilla
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-bd">
          {(plantillas ?? []).length === 0 && !mostrarForm && (
            <p className="text-sm text-tx-2 py-2">Este proveedor aún no tiene plantillas guardadas.</p>
          )}
          {(plantillas ?? []).map((p) =>
            confirmarEliminar === p.id ? (
              <div key={p.id} className="py-2">
                <ConfirmRow
                  message={<>¿Eliminar la plantilla <b>{p.descripcion}</b>?</>}
                  confirmLabel="Sí, eliminar"
                  onCancel={() => setConfirmarEliminar(null)}
                  onConfirm={async () => {
                    await eliminar.mutateAsync(p.id);
                    setConfirmarEliminar(null);
                  }}
                />
              </div>
            ) : (
              <div key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-tx truncate">{p.descripcion}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge status={LABEL_TIPO_ITEM[p.tipoItem]} kind={KIND_TIPO_ITEM[p.tipoItem]} />
                    <span className="font-mono text-xs text-tx-2">
                      {p.precioUnitario ? formatCurrency(p.precioUnitario) : '—'}
                    </span>
                  </div>
                </div>
                {puedeEscribir && (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center w-7 h-7 rounded text-tx-3 hover:bg-bg-sunken hover:text-danger transition-colors shrink-0"
                    onClick={() => setConfirmarEliminar(p.id)}
                    aria-label="Eliminar plantilla"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                )}
              </div>
            ),
          )}

          {mostrarForm && (
            <div className="pt-3 flex flex-col gap-2">
              <input
                className={inputBase}
                placeholder="Descripción (ej. Flete mensual)"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                maxLength={200}
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  className={inputBase}
                  value={tipoItem}
                  onChange={(e) => setTipoItem(e.target.value as TipoItemFse)}
                >
                  <option value="BIENES">Bienes</option>
                  <option value="SERVICIOS">Servicios</option>
                </select>
                <input
                  className={`${inputBase} font-mono`}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Precio (opcional)"
                  value={precioUnitario}
                  onChange={(e) => setPrecioUnitario(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className={btnSec} onClick={resetForm}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={!descripcion.trim() || crear.isPending}
                  onClick={handleAgregar}
                >
                  <Icon name="check" size={12} /> Guardar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
