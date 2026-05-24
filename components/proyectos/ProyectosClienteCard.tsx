'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useProyectosCliente } from '@/hooks/use-proyectos';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarProyecto } from '@/lib/proyectos';
import type { Cliente, EstadoProyecto } from '@/types/api';

const BADGE_KIND: Record<EstadoProyecto, 'ok' | 'warn' | 'info' | 'neutral'> = {
  ACTIVO:     'ok',
  PAUSADO:    'warn',
  COMPLETADO: 'info',
  CANCELADO:  'neutral',
};

type Props = {
  cliente: Pick<Cliente, 'id' | 'estado'>;
};

export function ProyectosClienteCard({ cliente }: Props) {
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeCrear = puedeEjecutarProyecto('crear', rol);
  // Solo ocultamos el botón si sabemos que el cliente está inactivo. El backend
  // rechaza con 409 si se intenta crear proyecto a cliente no ACTIVO.
  const puedeCrearReal = puedeCrear && cliente.estado === 'ACTIVO';

  const { data: proyectos, isLoading, isError } = useProyectosCliente(cliente.id);

  return (
    <div className="rounded-lg border border-bd bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
        <h3 className="text-sm font-semibold text-tx">
          Proyectos del cliente {proyectos && <span className="text-tx-3 font-normal">({proyectos.length})</span>}
        </h3>
        {puedeCrearReal && (
          <Link
            href={`/clientes/${cliente.id}/proyectos/nuevo`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors"
          >
            <Icon name="plus" size={12} /> Nuevo proyecto
          </Link>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-8"><Spinner /></div>
      )}

      {isError && (
        <div className="px-4 py-6 text-center text-sm text-tx-3">
          No se pudieron cargar los proyectos.
        </div>
      )}

      {!isLoading && !isError && proyectos && proyectos.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-tx-3">
          Este cliente no tiene proyectos registrados.
        </div>
      )}

      {!isLoading && !isError && proyectos && proyectos.length > 0 && (
        <table className="w-full text-sm">
          <tbody>
            {proyectos.map((p) => (
              <tr key={p.id} className="border-t border-bd first:border-t-0 hover:bg-bg-sunken transition-colors">
                <td className="px-4 py-2.5">
                  <Link href={`/proyectos/${p.id}`} className="hover:underline">
                    <div className="font-medium text-tx">{p.nombre}</div>
                    <div className="text-xs text-tx-3 mt-0.5 truncate max-w-md">
                      {p.ubicacion}
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-2.5 w-28 text-right font-mono text-xs text-tx-3">
                  {p._count?.cotizaciones ?? 0} cot.
                </td>
                <td className="px-4 py-2.5 w-32 text-right">
                  <Badge status={p.estado} kind={BADGE_KIND[p.estado]} />
                </td>
                <td className="px-4 py-2.5 w-8 pr-3 text-right">
                  <Link
                    href={`/proyectos/${p.id}`}
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-tx-3 hover:bg-bg hover:text-tx transition-colors"
                    aria-label="Ver"
                  >
                    <Icon name="arrowRight" size={14} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
