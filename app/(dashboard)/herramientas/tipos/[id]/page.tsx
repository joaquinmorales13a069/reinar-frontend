'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { UnidadCreatePanel } from '@/components/herramientas/UnidadCreatePanel';
import {
  useHerramientaTipo,
  useUnidadesPorTipo,
  useDesactivarHerramientaTipo,
} from '@/hooks/use-herramientas';
import { useAuthStore } from '@/stores/auth.store';
import {
  ESTADO_HERRAMIENTA_LABEL,
  ESTADO_HERRAMIENTA_KIND,
  puedeEjecutar,
} from '@/lib/herramientas';
import { formatCurrency } from '@/lib/utils';
import type { EstadoHerramienta } from '@/types/api';

const btnSec =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';

export default function TipoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TipoDetalleClient id={id} />;
}

function TipoDetalleClient({ id }: { id: string }) {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');

  const { data: tipo, isLoading, isError } = useHerramientaTipo(id);
  const { data: unidades = [] } = useUnidadesPorTipo(id);
  const desactivar = useDesactivarHerramientaTipo();
  const [confirmToggle, setConfirmToggle] = useState(false);

  const puedeEditar = puedeEjecutar('editarTipo', rol);
  const puedeDesactivar = puedeEjecutar('desactivarTipo', rol);
  const puedeCrearUnidad = puedeEjecutar('crearUnidad', rol);

  if (isLoading) return <div className="flex justify-center p-12"><Spinner /></div>;
  if (isError || !tipo) {
    return (
      <div>
        <EmptyState
          icon="alertTriangle"
          title="Tipo no encontrado"
          message="El tipo que intentás ver no existe o fue eliminado."
        />
        <div className="text-center">
          <Link href="/herramientas?tab=tipos" className={btnSec}>
            <Icon name="arrowLeft" size={14} /> Volver a herramientas
          </Link>
        </div>
      </div>
    );
  }

  // Conteo por estado para el resumen visual de la card de unidades.
  const conteoPorEstado = unidades.reduce<Record<string, number>>((acc, u) => {
    acc[u.estado] = (acc[u.estado] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title={tipo.nombre}
        subtitle={
          <span className="inline-flex items-center gap-2 flex-wrap">
            <span className="font-mono text-tx-3">{tipo.codigo}</span>
            <span className="text-tx-3">·</span>
            <Badge status={tipo.categoria?.nombre ?? '—'} kind="info" />
            <Badge
              status={tipo.activo ? 'ACTIVO' : 'INACTIVO'}
              kind={tipo.activo ? 'ok' : 'neutral'}
            />
          </span>
        }
        back
        backLabel="Herramientas"
        onBack={() => router.push('/herramientas?tab=tipos')}
        actions={
          <>
            {puedeEditar && (
              <Link href={`/herramientas/tipos/${tipo.id}/editar`} className={btnSec}>
                <Icon name="edit" size={14} /> Editar
              </Link>
            )}
            {puedeDesactivar && (
              <button type="button" className={btnSec} onClick={() => setConfirmToggle(true)}>
                <Icon name={tipo.activo ? 'x' : 'refresh'} size={14} />
                {tipo.activo ? 'Desactivar' : 'Activar'}
              </button>
            )}
          </>
        }
      />

      {confirmToggle && (
        <ConfirmRow
          message={
            <>
              ¿{tipo.activo ? 'Desactivar' : 'Activar'} el tipo <b>{tipo.nombre}</b>?
              {tipo.activo && ' Quedará fuera de los catálogos de cotización.'}
            </>
          }
          onCancel={() => setConfirmToggle(false)}
          onConfirm={() => {
            desactivar.mutate(tipo.id);
            setConfirmToggle(false);
          }}
          confirmLabel={tipo.activo ? 'Sí, desactivar' : 'Sí, activar'}
          variant="primary"
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-bd bg-surface p-4">
            <h3 className="font-semibold text-tx mb-3">Tarifas vigentes</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                ['Por día', tipo.tarifaDia],
                ['Por semana', tipo.tarifaSemana],
                ['Por mes', tipo.tarifaMes],
              ].map(([label, val]) => (
                <div key={label} className="rounded-md bg-bg-sunken p-3">
                  <div className="text-2xs uppercase tracking-wider text-tx-3 font-semibold">
                    {label}
                  </div>
                  <div className="font-mono font-semibold mt-1">{formatCurrency(val as string)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-bd bg-surface p-4">
            <h3 className="font-semibold text-tx mb-2">Descripción</h3>
            <p className={`text-sm ${tipo.descripcion ? 'text-tx' : 'text-tx-3'}`}>
              {tipo.descripcion ?? 'Sin descripción registrada.'}
            </p>
          </div>

          {tipo.notas && (
            <div className="rounded-lg border border-bd bg-surface p-4">
              <h3 className="font-semibold text-tx mb-2">Notas internas</h3>
              <p className="text-sm whitespace-pre-line">{tipo.notas}</p>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-bd bg-surface p-4">
          <div className="flex items-center justify-between mb-3 gap-2">
            <h3 className="font-semibold text-tx">Unidades ({unidades.length})</h3>
            {/* Disponibilidad efectiva: unidades físicas menos las comprometidas
                por cotizaciones aprobadas sin despachar. Es lo que se puede
                rentar hoy, y coincide con lo que valida la aprobación. */}
            {typeof tipo.disponibles === 'number' && (
              <Badge
                status={`Disponibles para rentar: ${tipo.disponibles}`}
                kind={tipo.disponibles > 0 ? 'ok' : 'warn'}
              />
            )}
          </div>

          {unidades.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(Object.keys(conteoPorEstado) as EstadoHerramienta[]).map((e) => (
                <Badge
                  key={e}
                  status={`${ESTADO_HERRAMIENTA_LABEL[e]}: ${conteoPorEstado[e]}`}
                  kind={ESTADO_HERRAMIENTA_KIND[e]}
                />
              ))}
            </div>
          )}

          {unidades.length > 0 ? (
            <ul className="flex flex-col">
              {unidades.map((u) => (
                <li key={u.id} className="border-t border-bd first:border-t-0">
                  <Link
                    href={`/herramientas/unidades/${u.id}?tipoId=${tipo.id}`}
                    className="flex items-center justify-between py-2 hover:bg-bg-sunken transition-colors px-1 rounded"
                  >
                    <span className="font-mono text-sm font-medium">{u.codigoInterno}</span>
                    <Badge
                      status={ESTADO_HERRAMIENTA_LABEL[u.estado]}
                      kind={ESTADO_HERRAMIENTA_KIND[u.estado]}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-tx-3">No hay unidades registradas para este tipo.</p>
          )}

          {puedeCrearUnidad && (
            <div className="mt-3">
              <UnidadCreatePanel tipoId={tipo.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
