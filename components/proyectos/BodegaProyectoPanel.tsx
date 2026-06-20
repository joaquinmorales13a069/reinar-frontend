'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBodegaProyecto, useCrearBodegaProyecto } from '@/hooks/use-proyectos';
import { useBodegaInventario } from '@/hooks/use-bodega-inventario';
import { useAuthStore } from '@/stores/auth.store';
import { EnviarInventarioProyecto } from './EnviarInventarioProyecto';
import type { Proyecto } from '@/types/api';

// Solo estos roles pueden crear la bodega-proyecto o enviar inventario.
// Espejo de requireRol(...inventario) en el backend:
//   inventario = ADMIN, GERENTE, LOGISTICA (ver proyectos.routes.ts).
const ROLES_INVENTARIO = ['ADMIN', 'GERENTE', 'LOGISTICA'];

interface Props {
  proyecto: Proyecto;
}

export function BodegaProyectoPanel({ proyecto }: Props) {
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeEscribir = !!rol && ROLES_INVENTARIO.includes(rol);

  const { data: bodega, isLoading } = useBodegaProyecto(proyecto.id);
  const crearBodega = useCrearBodegaProyecto();

  const [mostrarEnviar, setMostrarEnviar] = useState(false);

  // Inventario de la bodega-proyecto (solo si existe)
  const { data: inventario, isLoading: cargandoInv } = useBodegaInventario(
    bodega?.id ?? null,
  );

  if (isLoading) {
    return (
      <div className="rounded-lg border border-bd bg-surface p-4">
        <h3 className="text-sm font-semibold mb-3">Bodega de proyecto</h3>
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      </div>
    );
  }

  // Bodega aún no creada — mostrar card de creación
  if (!bodega) {
    return (
      <div className="rounded-lg border border-bd bg-surface p-4">
        <h3 className="text-sm font-semibold mb-1">Bodega de proyecto</h3>
        <p className="text-sm text-tx-3 mb-4">
          Este proyecto no tiene una bodega asignada. Podés crear una para
          gestionar el inventario en obra.
        </p>
        {puedeEscribir ? (
          <button
            type="button"
            disabled={crearBodega.isPending}
            onClick={() => crearBodega.mutate({ id: proyecto.id })}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-medium hover:bg-accent-dim disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {crearBodega.isPending ? (
              <Spinner size={12} />
            ) : (
              <Icon name="warehouse" size={13} />
            )}
            Crear bodega de proyecto
          </button>
        ) : (
          <p className="text-xs text-tx-3 italic">
            Solo ADMIN, GERENTE o LOGISTICA pueden crear la bodega.
          </p>
        )}
      </div>
    );
  }

  // Bodega existe — mostrar inventario
  const equipos = inventario?.equipos ?? [];
  const unidades = inventario?.unidadesHerramienta ?? [];
  const consumibles = inventario?.consumibles ?? [];
  const piezas = inventario?.piezasAndamio ?? [];
  const hayItems = equipos.length + unidades.length + consumibles.length + piezas.length > 0;

  return (
    <div className="rounded-lg border border-bd bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Icon name="warehouse" size={16} className="text-tx-3" />
          <h3 className="text-sm font-semibold">{bodega.nombre}</h3>
          <Badge status="PROYECTO" kind="accent" />
        </div>
        {puedeEscribir && !mostrarEnviar && (
          <button
            type="button"
            onClick={() => setMostrarEnviar(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-bd bg-surface text-tx-2 hover:bg-bg-sunken transition-colors"
          >
            <Icon name="send" size={13} />
            Enviar inventario
          </button>
        )}
      </div>

      {mostrarEnviar && (
        <div className="mb-4">
          <EnviarInventarioProyecto
            bodegaProyectoId={bodega.id}
            onCerrar={() => setMostrarEnviar(false)}
          />
        </div>
      )}

      {cargandoInv && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}

      {!cargandoInv && !hayItems && (
        <EmptyState
          icon="warehouse"
          title="Bodega vacía"
          message="No hay inventario en esta bodega todavía."
        />
      )}

      {!cargandoInv && hayItems && (
        <div className="flex flex-col gap-4">
          {/* Equipos */}
          {equipos.length > 0 && (
            <div>
              <div className="text-2xs font-semibold text-tx-3 uppercase tracking-wider mb-2">
                Equipos ({equipos.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-tx-3">
                    <tr>
                      <th className="text-left font-medium pb-1.5 pr-3">Código</th>
                      <th className="text-left font-medium pb-1.5 pr-3">Nombre</th>
                      <th className="text-left font-medium pb-1.5">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipos.map((eq) => (
                      <tr key={eq.id} className="border-t border-bd/40">
                        <td className="py-1.5 pr-3 font-mono">{eq.codigo}</td>
                        <td className="py-1.5 pr-3">{eq.nombre}</td>
                        <td className="py-1.5">
                          <Badge kind="neutral" status={eq.estado} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Unidades de herramienta */}
          {unidades.length > 0 && (
            <div>
              <div className="text-2xs font-semibold text-tx-3 uppercase tracking-wider mb-2">
                Herramientas ({unidades.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-tx-3">
                    <tr>
                      <th className="text-left font-medium pb-1.5 pr-3">Código</th>
                      <th className="text-left font-medium pb-1.5 pr-3">Tipo</th>
                      <th className="text-left font-medium pb-1.5">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unidades.map((u) => (
                      <tr key={u.id} className="border-t border-bd/40">
                        <td className="py-1.5 pr-3 font-mono">{u.codigoInterno}</td>
                        <td className="py-1.5 pr-3">{u.tipo.nombre}</td>
                        <td className="py-1.5">
                          <Badge kind="neutral" status={u.estado} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Consumibles */}
          {consumibles.length > 0 && (
            <div>
              <div className="text-2xs font-semibold text-tx-3 uppercase tracking-wider mb-2">
                Consumibles ({consumibles.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-tx-3">
                    <tr>
                      <th className="text-left font-medium pb-1.5 pr-3">Código</th>
                      <th className="text-left font-medium pb-1.5 pr-3">Nombre</th>
                      <th className="text-right font-medium pb-1.5 pr-3">Stock</th>
                      <th className="text-left font-medium pb-1.5">Unidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consumibles.map((c) => (
                      <tr key={c.id} className="border-t border-bd/40">
                        <td className="py-1.5 pr-3 font-mono">{c.codigo}</td>
                        <td className="py-1.5 pr-3">{c.nombre}</td>
                        <td className="py-1.5 pr-3 text-right font-mono">{c.stock}</td>
                        <td className="py-1.5 text-tx-3">{c.unidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Piezas de andamio */}
          {piezas.length > 0 && (
            <div>
              <div className="text-2xs font-semibold text-tx-3 uppercase tracking-wider mb-2">
                Piezas de andamio ({piezas.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-tx-3">
                    <tr>
                      <th className="text-left font-medium pb-1.5 pr-3">Nombre</th>
                      <th className="text-right font-medium pb-1.5">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {piezas.map((p) => (
                      <tr key={p.id} className="border-t border-bd/40">
                        <td className="py-1.5 pr-3">{p.nombre}</td>
                        <td className="py-1.5 text-right font-mono">{p.stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
