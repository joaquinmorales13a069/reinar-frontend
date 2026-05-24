'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Decimal from 'decimal.js';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { CuerpoComponentesCard } from '@/components/andamios/cuerpos/CuerpoComponentesCard';
import { ExpandirCuerpoPanel } from '@/components/andamios/cuerpos/ExpandirCuerpoPanel';
import {
  useCuerpo,
  useCambiarEstadoCuerpo,
  usePiezas,
} from '@/hooks/use-andamios';
import { useAuthStore } from '@/stores/auth.store';
import { puedeEjecutarAndamios } from '@/lib/andamios';
import { formatCurrency } from '@/lib/utils';

const btnSec =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';

export default function CuerpoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const { data: cuerpo, isLoading, isError } = useCuerpo(id);
  // Necesario para resolver tarifas de los componentes (el select anidado no las trae).
  const { data: piezas } = usePiezas();
  const cambiarEstado = useCambiarEstadoCuerpo();
  const [expandirOpen, setExpandirOpen] = useState(false);
  const [confirmEstado, setConfirmEstado] = useState(false);

  const puedeEditar    = puedeEjecutarAndamios('editarCuerpo', rol);
  const puedeEstado    = puedeEjecutarAndamios('cambiarEstadoCuerpo', rol);
  const puedeExpandir  = puedeEjecutarAndamios('expandirCuerpo', rol);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (isError || !cuerpo) {
    return (
      <EmptyState
        icon="alertTriangle"
        title="No se encontró la configuración"
        message="Puede haber sido eliminada o el ID es incorrecto."
      />
    );
  }

  const totalPiezas = cuerpo.componentes.reduce((s, c) => s + c.cantidad, 0);
  const tarifaDiariaEstimada = cuerpo.componentes.reduce((s, c) => {
    const p = piezas?.find((x) => x.id === c.piezaTipo.id);
    return p ? s + new Decimal(p.tarifaDia).times(c.cantidad).toNumber() : s;
  }, 0);
  const sinStock = cuerpo.stockCuerposDisponibles === 0;

  return (
    <div>
      <PageHeader
        title={cuerpo.nombre}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span className="font-mono text-xs text-tx-2">{cuerpo.id}</span>
            <span className="text-tx-3">·</span>
            <Badge status={cuerpo.activo ? 'ACTIVO' : 'INACTIVO'} />
          </span>
        }
        back
        backLabel="Andamios"
        onBack={() => router.push('/andamios')}
        actions={
          <div className="flex gap-2">
            {puedeExpandir && (
              <button
                type="button"
                className={btnSec}
                onClick={() => setExpandirOpen((v) => !v)}
                disabled={!cuerpo.activo}
                title={cuerpo.activo ? 'Calcular piezas y costo' : 'Configuración inactiva'}
              >
                <Icon name="layers" size={14} /> Expandir cuerpo
              </button>
            )}
            {puedeEditar && (
              <Link href={`/andamios/cuerpos/${cuerpo.id}/editar`} className={btnSec}>
                <Icon name="edit" size={14} /> Editar
              </Link>
            )}
            {puedeEstado && (
              <button
                type="button"
                className={btnSec}
                onClick={() => setConfirmEstado(true)}
              >
                <Icon name={cuerpo.activo ? 'x' : 'check'} size={14} />{' '}
                {cuerpo.activo ? 'Desactivar' : 'Activar'}
              </button>
            )}
          </div>
        }
      />

      {expandirOpen && (
        <div className="mb-4">
          <ExpandirCuerpoPanel
            cuerpoId={cuerpo.id}
            onClose={() => setExpandirOpen(false)}
          />
        </div>
      )}

      {confirmEstado && (
        <ConfirmRow
          message={
            cuerpo.activo
              ? `¿Desactivar la configuración "${cuerpo.nombre}"?`
              : `¿Activar la configuración "${cuerpo.nombre}"?`
          }
          confirmLabel={cuerpo.activo ? 'Desactivar' : 'Activar'}
          variant={cuerpo.activo ? 'danger' : 'primary'}
          onCancel={() => setConfirmEstado(false)}
          onConfirm={async () => {
            await cambiarEstado.mutateAsync({ id: cuerpo.id, activo: !cuerpo.activo });
            setConfirmEstado(false);
          }}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 items-start">
        <Card>
          <h3 className="text-sm font-semibold mb-2">Descripción</h3>
          <p className="text-sm text-tx-2 m-0 leading-relaxed">
            {cuerpo.descripcion || <span className="text-tx-3">Sin descripción.</span>}
          </p>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold mb-3">Resumen</h3>
          <dl className="m-0 divide-y divide-bd-soft">
            <div className="flex justify-between py-2 text-sm">
              <dt className="text-tx-2">Piezas distintas</dt>
              <dd className="font-mono">{cuerpo.componentes.length}</dd>
            </div>
            <div className="flex justify-between py-2 text-sm">
              <dt className="text-tx-2">Total unidades por cuerpo</dt>
              <dd className="font-mono">{totalPiezas}</dd>
            </div>
            <div className="flex justify-between py-2 text-sm">
              <dt className="text-tx-2">Disponibles para armar</dt>
              <dd className={`font-mono font-semibold ${sinStock ? 'text-warn' : ''}`}>
                {cuerpo.stockCuerposDisponibles}
              </dd>
            </div>
            <div className="flex justify-between py-2 text-sm">
              <dt className="text-tx-2">Tarifa diaria estimada</dt>
              <dd className="font-mono font-semibold">{formatCurrency(tarifaDiariaEstimada)}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <CuerpoComponentesCard componentes={cuerpo.componentes} piezas={piezas} />
    </div>
  );
}
