'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { PiezaStockCard } from '@/components/andamios/piezas/PiezaStockCard';
import { PiezaTarifasCard } from '@/components/andamios/piezas/PiezaTarifasCard';
import { AjusteStockPiezaPanel } from '@/components/andamios/piezas/AjusteStockPiezaPanel';
import { CuerposQueLaUsanCard } from '@/components/andamios/piezas/CuerposQueLaUsanCard';
import { usePieza, useCambiarEstadoPieza } from '@/hooks/use-andamios';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarAndamios } from '@/lib/andamios';

const btnSec =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';
const btnPri =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors';

export default function PiezaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const { data: pieza, isLoading, isError } = usePieza(id);
  const cambiarEstado = useCambiarEstadoPieza();
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [confirmEstado, setConfirmEstado] = useState(false);

  const puedeEditar  = puedeEjecutarAndamios('editarPieza', rol);
  const puedeAjustar = puedeEjecutarAndamios('ajustarStockPieza', rol);
  const puedeEstado  = puedeEjecutarAndamios('cambiarEstadoPieza', rol);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (isError || !pieza) {
    return (
      <EmptyState
        icon="alertTriangle"
        title="No se encontró la pieza"
        message="Puede haber sido eliminada o el ID es incorrecto."
      />
    );
  }

  return (
    <div>
      <PageHeader
        title={pieza.nombre}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span className="font-mono text-xs text-tx-2">{pieza.id}</span>
            <span className="text-tx-3">·</span>
            <Badge status={pieza.activo ? 'ACTIVO' : 'INACTIVO'} />
          </span>
        }
        back
        backLabel="Andamios"
        onBack={() => router.push('/andamios')}
        actions={
          <div className="flex gap-2">
            {puedeAjustar && (
              <button
                type="button"
                className={btnSec}
                onClick={() => setAjusteOpen((v) => !v)}
              >
                <Icon name="refresh" size={14} /> Ajustar stock
              </button>
            )}
            {puedeEditar && (
              <Link href={`/andamios/piezas/${pieza.id}/editar`} className={btnSec}>
                <Icon name="edit" size={14} /> Editar
              </Link>
            )}
            {puedeEstado && (
              <button
                type="button"
                className={btnSec}
                onClick={() => setConfirmEstado(true)}
              >
                <Icon name={pieza.activo ? 'x' : 'check'} size={14} />{' '}
                {pieza.activo ? 'Desactivar' : 'Activar'}
              </button>
            )}
          </div>
        }
      />

      {ajusteOpen && (
        <div className="mb-4">
          <AjusteStockPiezaPanel
            piezaId={pieza.id}
            stockActual={pieza.stockActual}
            onClose={() => setAjusteOpen(false)}
          />
        </div>
      )}

      {confirmEstado && (
        <ConfirmRow
          message={
            pieza.activo
              ? `¿Desactivar la pieza "${pieza.nombre}"? Dejará de aparecer en listados y no podrá usarse en nuevas configuraciones.`
              : `¿Activar la pieza "${pieza.nombre}"?`
          }
          confirmLabel={pieza.activo ? 'Desactivar' : 'Activar'}
          variant={pieza.activo ? 'danger' : 'primary'}
          onCancel={() => setConfirmEstado(false)}
          onConfirm={async () => {
            await cambiarEstado.mutateAsync({ id: pieza.id, activo: !pieza.activo });
            setConfirmEstado(false);
          }}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-4">
          <PiezaStockCard stockActual={pieza.stockActual} stockMinimo={pieza.stockMinimo} />
          <PiezaTarifasCard
            tarifaDia={pieza.tarifaDia}
            tarifaSemana={pieza.tarifaSemana}
            tarifaMes={pieza.tarifaMes}
          />
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <h3 className="text-sm font-semibold mb-2">Descripción</h3>
            <p className="text-sm text-tx-2 m-0 leading-relaxed">
              {pieza.descripcion || (
                <span className="text-tx-3">Sin descripción.</span>
              )}
            </p>
          </Card>
          <CuerposQueLaUsanCard piezaId={pieza.id} />
        </div>
      </div>
    </div>
  );
}
