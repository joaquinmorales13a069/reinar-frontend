'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { useBodegaInventario } from '@/hooks/use-bodega-inventario';

// Card que muestra los 4 tipos de inventario asignado a una bodega:
// equipos, unidades de herramienta, consumibles (stock > 0) y piezas de
// andamio (stock > 0). Cada sección es una mini-tabla independiente.
export function InventarioAsignadoCard({ bodegaId }: { bodegaId: string }) {
  const { data, isLoading, isError } = useBodegaInventario(bodegaId);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-bd bg-surface">
        <div className="flex items-center px-4 py-3 border-b border-bd">
          <h3 className="text-sm font-semibold text-tx">Inventario asignado</h3>
        </div>
        <div className="flex justify-center py-8"><Spinner /></div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-bd bg-surface">
        <div className="flex items-center px-4 py-3 border-b border-bd">
          <h3 className="text-sm font-semibold text-tx">Inventario asignado</h3>
        </div>
        <div className="px-4 py-6 text-center text-sm text-tx-3">
          No se pudo cargar el inventario.
        </div>
      </div>
    );
  }

  const totalItems =
    data.equipos.length +
    data.unidadesHerramienta.length +
    data.consumibles.length +
    data.piezasAndamio.length;

  if (totalItems === 0) {
    return (
      <div className="rounded-lg border border-bd bg-surface">
        <div className="flex items-center px-4 py-3 border-b border-bd">
          <h3 className="text-sm font-semibold text-tx">Inventario asignado</h3>
        </div>
        <div className="px-4 py-6 text-center text-sm text-tx-3">
          Sin inventario asignado a esta bodega.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-bd bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
        <h3 className="text-sm font-semibold text-tx">
          Inventario asignado <span className="text-tx-3 font-normal">({totalItems})</span>
        </h3>
      </div>

      {/* Cuerpo scrolleable: la lista puede crecer mucho con inventario real,
          así que limitamos la altura a 24rem (max-h-96) y scrolleamos. El
          header queda fuera del scroll para que siempre sea visible. */}
      <div className="max-h-96 overflow-y-auto">

      {/* Equipos */}
      {data.equipos.length > 0 && (
        <Section
          titulo={`Equipos (${data.equipos.length})`}
          verTodos={`/equipos?bodegaId=${bodegaId}`}
        >
          <table className="w-full text-sm">
            <tbody>
              {data.equipos.map((e) => (
                <tr key={e.id} className="border-t border-bd hover:bg-bg-sunken">
                  <td className="px-4 py-2 w-28 font-mono text-xs text-tx-2">
                    <Link href={`/equipos/${e.id}`} className="hover:underline">{e.codigo}</Link>
                  </td>
                  <td className="px-4 py-2">
                    <Link href={`/equipos/${e.id}`} className="hover:underline text-tx">{e.nombre}</Link>
                  </td>
                  <td className="px-4 py-2 w-32 text-right"><Badge status={e.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Unidades de herramienta */}
      {data.unidadesHerramienta.length > 0 && (
        <Section titulo={`Unidades de herramienta (${data.unidadesHerramienta.length})`}>
          <table className="w-full text-sm">
            <tbody>
              {data.unidadesHerramienta.map((u) => (
                <tr key={u.id} className="border-t border-bd hover:bg-bg-sunken">
                  <td className="px-4 py-2 w-32 font-mono text-xs text-tx-2">
                    <Link href={`/herramientas/unidades/${u.id}`} className="hover:underline">{u.codigoInterno}</Link>
                  </td>
                  <td className="px-4 py-2 text-tx">{u.tipo.nombre}</td>
                  <td className="px-4 py-2 w-32 text-right"><Badge status={u.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Consumibles */}
      {data.consumibles.length > 0 && (
        <Section titulo={`Consumibles (${data.consumibles.length})`}>
          <table className="w-full text-sm">
            <tbody>
              {data.consumibles.map((c) => (
                <tr key={c.id} className="border-t border-bd hover:bg-bg-sunken">
                  <td className="px-4 py-2 w-28 font-mono text-xs text-tx-2">
                    <Link href={`/herramientas?tab=consumibles`} className="hover:underline">{c.codigo}</Link>
                  </td>
                  <td className="px-4 py-2 text-tx">{c.nombre}</td>
                  <td className="px-4 py-2 w-32 text-right tabular-nums font-mono text-tx-2">
                    {c.stock} {c.unidad}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Piezas de andamio */}
      {data.piezasAndamio.length > 0 && (
        <Section titulo={`Piezas de andamio (${data.piezasAndamio.length})`}>
          <table className="w-full text-sm">
            <tbody>
              {data.piezasAndamio.map((p) => (
                <tr key={p.id} className="border-t border-bd hover:bg-bg-sunken">
                  <td className="px-4 py-2 text-tx">{p.nombre}</td>
                  <td className="px-4 py-2 w-32 text-right tabular-nums font-mono text-tx-2">{p.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
      </div>
    </div>
  );
}

function Section({ titulo, verTodos, children }: { titulo: string; verTodos?: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-bd first:border-t-0">
      <div className="flex items-center justify-between px-4 py-2 bg-bg-sunken">
        <span className="text-2xs uppercase tracking-wider font-semibold text-tx-3">{titulo}</span>
        {verTodos && (
          <Link href={verTodos} className="text-xs text-accent-dim hover:underline inline-flex items-center gap-1">
            Ver todos <Icon name="arrowRight" size={11} />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}
