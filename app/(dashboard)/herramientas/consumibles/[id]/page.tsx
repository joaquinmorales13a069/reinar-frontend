'use client';

import Decimal from 'decimal.js';
import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { StockBar } from '@/components/herramientas/StockBar';
import { AjusteStockPanel } from '@/components/herramientas/AjusteStockPanel';
import { TransferirStockPanel } from '@/components/ui/TransferirStockPanel';
import {
  useConsumible,
  useDesactivarConsumible,
  useTransferirStock,
} from '@/hooks/use-consumibles';
import { useAuthStore } from '@/stores/auth.store';
import { CATEGORIAS_CONSUMIBLE_LABEL, puedeEjecutar } from '@/lib/herramientas';
import { formatCurrency } from '@/lib/utils';

const btnSec =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';

export default function ConsumibleDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ConsumibleDetalleClient id={id} />;
}

function ConsumibleDetalleClient({ id }: { id: string }) {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');

  const { data: c, isLoading, isError } = useConsumible(id);
  const desactivar = useDesactivarConsumible();
  const transferir = useTransferirStock();

  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [transferirOpen, setTransferirOpen] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);

  const puedeEditar = puedeEjecutar('editarConsumible', rol);
  const puedeDesactivar = puedeEjecutar('desactivarConsumible', rol);
  const puedeAjustar = puedeEjecutar('ajustarStock', rol);

  if (isLoading) return <div className="flex justify-center p-12"><Spinner /></div>;
  if (isError || !c) {
    return (
      <div>
        <EmptyState
          icon="alertTriangle"
          title="Consumible no encontrado"
          message="El consumible no existe o fue eliminado."
        />
        <div className="text-center">
          <Link href="/herramientas?tab=consumibles" className={btnSec}>
            <Icon name="arrowLeft" size={14} /> Volver a consumibles
          </Link>
        </div>
      </div>
    );
  }

  const bajo = c.stockActual <= c.stockMinimo;
  // Valor de inventario: precioUnitario es string Decimal, stockActual es int.
  // Usamos decimal.js para preservar precisión y formatCurrency para mostrar.
  const valorInventario = new Decimal(c.precioUnitario).mul(c.stockActual).toFixed(2);

  return (
    <div>
      <PageHeader
        title={c.nombre}
        subtitle={
          <span className="inline-flex items-center gap-2 flex-wrap">
            <span className="font-mono text-tx-3">{c.codigo}</span>
            <span className="text-tx-3">·</span>
            <Badge status={CATEGORIAS_CONSUMIBLE_LABEL[c.categoria]} kind="info" />
            <Badge
              status={c.activo ? 'ACTIVO' : 'INACTIVO'}
              kind={c.activo ? 'ok' : 'neutral'}
            />
          </span>
        }
        back
        backLabel="Consumibles"
        onBack={() => router.push('/herramientas?tab=consumibles')}
        actions={
          <>
            {puedeEditar && (
              <Link href={`/herramientas/consumibles/${c.id}/editar`} className={btnSec}>
                <Icon name="edit" size={14} /> Editar
              </Link>
            )}
            {puedeAjustar && (
              <button type="button" className={btnSec} onClick={() => setAjusteOpen((v) => !v)}>
                <Icon name="refresh" size={14} /> Ajustar stock
              </button>
            )}
            {puedeAjustar && (
              <button type="button" className={btnSec} onClick={() => setTransferirOpen((v) => !v)}>
                <Icon name="refresh" size={14} /> Transferir entre bodegas
              </button>
            )}
            {puedeDesactivar && (
              <button type="button" className={btnSec} onClick={() => setConfirmToggle(true)}>
                <Icon name={c.activo ? 'x' : 'refresh'} size={14} />
                {c.activo ? 'Desactivar' : 'Activar'}
              </button>
            )}
          </>
        }
      />

      {confirmToggle && (
        <ConfirmRow
          message={
            <>
              ¿{c.activo ? 'Desactivar' : 'Activar'} el consumible <b>{c.nombre}</b>?
            </>
          }
          onCancel={() => setConfirmToggle(false)}
          onConfirm={() => {
            desactivar.mutate(c.id);
            setConfirmToggle(false);
          }}
          confirmLabel={c.activo ? 'Sí, desactivar' : 'Sí, activar'}
          variant="primary"
        />
      )}

      {ajusteOpen && (
        <div className="mb-4 max-w-2xl">
          <AjusteStockPanel
            consumibleId={c.id}
            stockActual={c.stockActual}
            unidad={c.unidad}
            onClose={() => setAjusteOpen(false)}
          />
        </div>
      )}

      {transferirOpen && (
        <div className="mb-4 max-w-2xl">
          <TransferirStockPanel
            unidad={c.unidad}
            isPending={transferir.isPending}
            onCancel={() => setTransferirOpen(false)}
            onConfirm={(data) =>
              transferir.mutate(
                { id: c.id, data },
                { onSuccess: () => setTransferirOpen(false) },
              )
            }
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="rounded-lg border border-bd bg-surface p-4">
          <h3 className="font-semibold text-tx mb-3">Stock</h3>
          <div className="flex items-baseline gap-2 mb-2">
            <div className={`font-mono text-3xl font-bold ${bajo ? 'text-warn' : 'text-tx'}`}>
              {c.stockActual}
            </div>
            <div className="text-sm text-tx-3">{c.unidad}</div>
          </div>
          <StockBar stockActual={c.stockActual} stockMinimo={c.stockMinimo} />
          <div className="flex justify-between text-xs mt-2">
            <span className="text-tx-3">
              Mínimo: <span className="font-mono">{c.stockMinimo} {c.unidad}</span>
            </span>
            {bajo && (
              <span className="text-warn font-semibold inline-flex items-center gap-1">
                <Icon name="alertTriangle" size={11} /> Reposición urgente
              </span>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-bd bg-surface p-4">
          <h3 className="font-semibold text-tx mb-3">Datos generales</h3>
          <dl className="grid grid-cols-1 gap-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-tx-3">Precio unitario</dt>
              <dd className="font-mono font-semibold">
                {formatCurrency(c.precioUnitario)} / {c.unidad}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-tx-3">Unidad de medida</dt>
              <dd>{c.unidad}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-tx-3">Valor de inventario</dt>
              <dd className="font-mono">{formatCurrency(valorInventario)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-tx-3">Estado</dt>
              <dd>
                <Badge
                  status={c.activo ? 'ACTIVO' : 'INACTIVO'}
                  kind={c.activo ? 'ok' : 'neutral'}
                />
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-bd bg-surface p-4 lg:col-span-2">
          <h3 className="font-semibold text-tx mb-2">Historial de uso</h3>
          <p className="text-sm text-tx-3">
            Los movimientos de stock y consumos por cotización aparecerán acá cuando el módulo de cotizaciones esté disponible.
          </p>
        </div>

        {(c.descripcion || c.notas) && (
          <div className="rounded-lg border border-bd bg-surface p-4 lg:col-span-2">
            {c.descripcion && (
              <>
                <h3 className="font-semibold text-tx mb-2">Descripción</h3>
                <p className="text-sm mb-3">{c.descripcion}</p>
              </>
            )}
            {c.notas && (
              <>
                <h3 className="font-semibold text-tx mb-2">Notas internas</h3>
                <p className="text-sm whitespace-pre-line">{c.notas}</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
