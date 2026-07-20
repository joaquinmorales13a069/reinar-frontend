'use client';

import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { useItemsDisponiblesDespachoCotizacion } from '@/hooks/use-actas';
import { formatDate } from '@/lib/utils';
import type { Factura } from '@/types/api';

type Props = {
  factura: Factura;
  puedeEscribir: boolean;
};

export function ActasVinculadasCard({ factura, puedeEscribir }: Props) {
  const actas = factura.actasEntrega ?? [];
  const actaOrigen = factura.cotizacion?.actaEntregaOrigen ?? null;
  const cotizacionId = factura.cotizacion?.id ?? null;

  // El botón de crear acta solo tiene sentido si queda inventario sin despachar.
  // En una renovación pura no queda ninguno: la mercadería ya está en obra.
  const disponibles = useItemsDisponiblesDespachoCotizacion(cotizacionId);
  // Solo ocultamos el botón cuando la query confirmó (con éxito) que no hay
  // nada por despachar. Mientras carga o si falla, no sabemos el estado real —
  // y ocultar de más rompería en silencio el flujo principal de despacho para
  // TODAS las facturas si esta query auxiliar cae. Mostrar de más es inofensivo:
  // el backend rechaza con 422 ITEM_YA_EN_OBRA cualquier ítem ya renovado.
  const seConfirmoSinInventarioNuevo = disponibles.isSuccess && disponibles.data.length === 0;
  const mostrarBoton = puedeEscribir && !seConfirmoSinInventarioNuevo;

  const total = actas.length + (actaOrigen ? 1 : 0);

  return (
    <div className="bg-bg border border-bd rounded-md">
      <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
        <h3 className="text-sm font-medium text-tx">Actas de entrega vinculadas ({total})</h3>
        {mostrarBoton && (
          <Link
            href={`/actas/nueva?facturaId=${factura.id}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors"
          >
            <Icon name="plus" size={12} /> Nueva acta
          </Link>
        )}
      </div>

      {total === 0 ? (
        <div className="py-6">
          <EmptyState icon="clipboard" title="Sin actas" message="Aún no se han creado actas de entrega para esta factura." />
        </div>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {actaOrigen && (
              <tr className="border-t border-bd hover:bg-bg-sunken">
                <td className="px-4 py-2.5 font-mono w-40">
                  <Link href={`/actas/${actaOrigen.id}`} className="hover:underline">{actaOrigen.numeroActa}</Link>
                </td>
                <td className="px-4 py-2.5">
                  <Badge status={actaOrigen.estado} />
                  <span className="ml-2 text-xs text-tx-3">Renovada</span>
                </td>
                <td className="px-4 py-2.5 text-xs text-tx-3 text-right">
                  {actaOrigen.numeroActaFisico && <span className="font-mono">{actaOrigen.numeroActaFisico}</span>}
                  {actaOrigen.fechaEntrega && <span className="ml-2">Entregada {formatDate(actaOrigen.fechaEntrega)}</span>}
                </td>
              </tr>
            )}
            {actas.map((a) => (
              <tr key={a.id} className="border-t border-bd hover:bg-bg-sunken">
                <td className="px-4 py-2.5 font-mono w-40">
                  <Link href={`/actas/${a.id}`} className="hover:underline">{a.numeroActa}</Link>
                </td>
                <td className="px-4 py-2.5">
                  <Badge status={a.estado} />
                  {actaOrigen && <span className="ml-2 text-xs text-tx-3">Nueva entrega</span>}
                </td>
                <td className="px-4 py-2.5 text-xs text-tx-3 text-right font-mono">
                  {a.numeroActaFisico ?? ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {actaOrigen && seConfirmoSinInventarioNuevo && (
        <div className="px-4 py-2 border-t border-bd text-xs text-tx-3">
          Esta renovación no requiere acta nueva — el inventario sigue en obra bajo el acta{' '}
          <Link href={`/actas/${actaOrigen.id}`} className="text-accent hover:underline font-mono">{actaOrigen.numeroActa}</Link>.
        </div>
      )}

      <div className="px-4 py-2 border-t border-bd text-xs text-tx-3">
        Ver{' '}
        <Link href={`/actas?busqueda=${factura.numeroFactura}`} className="text-accent hover:underline">actas de esta factura</Link>
        {' · '}
        <Link href={`/recepciones?busqueda=${factura.numeroFactura}`} className="text-accent hover:underline">recepciones</Link>
      </div>
    </div>
  );
}
