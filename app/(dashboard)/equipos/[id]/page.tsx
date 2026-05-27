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
import { MoverBodegaPanel } from '@/components/ui/MoverBodegaPanel';
import { EquipoCategoriaBadge } from '@/components/equipos/EquipoCategoriaBadge';
import { EquipoImagenUpload } from '@/components/equipos/EquipoImagenUpload';
import { EquipoMantenimientosResumen } from '@/components/equipos/EquipoMantenimientosResumen';
import { HistorialRentasCard } from '@/components/inventario/HistorialRentasCard';
import { EquipoReservaPlaceholder } from '@/components/equipos/EquipoReservaPlaceholder';
import {
  useEquipo,
  useEquipoFichaTecnica,
  useSubirImagenEquipo,
  useCambiarEstadoEquipo,
  useEquipoRentas,
  useMoverBodegaEquipo,
} from '@/hooks/use-equipos';
import { useEquiposRealtime } from '@/hooks/use-equipos-realtime';
import { useAuthStore } from '@/stores/auth.store';
import { ESTADO_LABELS, ESTADO_BADGE_KIND, puedeEjecutar } from '@/lib/equipos';
import { formatCurrency } from '@/lib/utils';
import type { EstadoEquipoEditable } from '@/types/api';

type TabKey = 'specs' | 'ficha';

const btnSec = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';
const btnPri = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const tabCls = (active: boolean) =>
  `px-3 py-2 text-sm border-b-2 transition-colors ${
    active ? 'border-accent text-tx font-semibold' : 'border-transparent text-tx-2 hover:text-tx'
  }`;

export default function EquipoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  // Next.js 19 entrega params como Promise; use() lo desempaqueta para componentes cliente.
  const { id } = use(params);
  return <EquipoDetalleClient id={id} />;
}

function EquipoDetalleClient({ id }: { id: string }) {
  useEquiposRealtime();
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');

  const { data: equipo, isLoading, isError } = useEquipo(id);
  const { data: ficha } = useEquipoFichaTecnica(id);
  const subirImagen = useSubirImagenEquipo();
  const cambiarEstado = useCambiarEstadoEquipo();
  const moverBodega = useMoverBodegaEquipo();

  const [tab, setTab] = useState<TabKey>('specs');
  const [confirmEstado, setConfirmEstado] = useState<EstadoEquipoEditable | null>(null);
  const [moverAbierto, setMoverAbierto] = useState(false);

  const puedeEditar = puedeEjecutar('editar', rol);
  const puedeSubirImagen = puedeEjecutar('subirImagen', rol);
  const puedeCambiarEstado = puedeEjecutar('cambiarEstado', rol);

  if (isLoading) {
    return (
      <div className="flex justify-center p-12"><Spinner /></div>
    );
  }
  if (isError || !equipo) {
    return (
      <div>
        <EmptyState
          icon="alertTriangle"
          title="Equipo no encontrado"
          message="El equipo que intentás ver no existe o fue eliminado."
        />
        <div className="text-center">
          <Link href="/equipos" className={btnSec}>
            <Icon name="arrowLeft" size={14} /> Volver a equipos
          </Link>
        </div>
      </div>
    );
  }

  function handleImagen(file: File) {
    subirImagen.mutate({ id, file });
  }

  return (
    <div>
      <PageHeader
        title={equipo.nombre}
        subtitle={
          <span className="inline-flex items-center gap-2 flex-wrap">
            <span className="font-mono text-tx-3">{equipo.codigo}</span>
            <span className="text-tx-3">·</span>
            <EquipoCategoriaBadge categoria={equipo.categoria} />
            <Badge status={ESTADO_LABELS[equipo.estado]} kind={ESTADO_BADGE_KIND[equipo.estado]} />
          </span>
        }
        back
        backLabel="Equipos"
        // Forzamos destino: el detalle puede haberse abierto desde la ficha o el
        // form de edición, así que router.back() generaría un bucle. Empujamos
        // explícitamente a la lista, que es el padre lógico en la jerarquía.
        onBack={() => router.push('/equipos')}
        actions={
          <>
            {puedeEditar && (
              <Link href={`/equipos/${equipo.id}/editar`} className={btnSec}>
                <Icon name="edit" size={14} /> Editar
              </Link>
            )}
            {puedeEditar && (
              <Link href={`/equipos/${equipo.id}/ficha`} className={btnSec}>
                <Icon name="fileText" size={14} /> Editar ficha técnica
              </Link>
            )}
            <button
              type="button"
              className={btnPri}
              disabled
              title="Disponible próximamente con el módulo de cotizaciones."
            >
              <Icon name="plus" size={14} /> Agregar a cotización
            </button>
          </>
        }
      />

      {puedeCambiarEstado && equipo.estado === 'RENTADO' && (
        // Mismo patron que UnidadEstadoSelector de herramientas: cuando el equipo
        // esta rentado, no ofrecemos el selector porque cualquier cambio manual
        // desincronizaria el contrato con la cotizacion. La devolucion va por el
        // flujo de Actas (recepcion) que cambia el estado automaticamente.
        <p className="text-sm text-tx-2 mb-4">
          Este equipo está rentado. Para devolverlo al inventario, registrá una recepción en el acta de entrega correspondiente.
        </p>
      )}

      {puedeCambiarEstado && equipo.estado !== 'RENTADO' && (
        <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
          <span className="text-xs text-tx-3 mr-1">Cambiar estado:</span>
          {(['DISPONIBLE', 'USO_INTERNO', 'INACTIVO'] as const).map((e) => (
            <button
              key={e}
              type="button"
              disabled={equipo.estado === e}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors ${
                equipo.estado === e
                  ? 'border-bd bg-bg-sunken text-tx-3 cursor-not-allowed'
                  : 'border-bd text-tx-2 hover:bg-bg-sunken'
              }`}
              onClick={() => setConfirmEstado(e)}
            >
              {ESTADO_LABELS[e]}
            </button>
          ))}
        </div>
      )}

      {confirmEstado && (
        <ConfirmRow
          message={
            <>
              ¿Cambiar el estado de <b>{equipo.nombre}</b> a <b>{ESTADO_LABELS[confirmEstado]}</b>?
            </>
          }
          onCancel={() => setConfirmEstado(null)}
          onConfirm={() => {
            cambiarEstado.mutate({ id, estado: confirmEstado });
            setConfirmEstado(null);
          }}
          confirmLabel="Sí, cambiar"
          variant="primary"
        />
      )}

      {equipo.estado === 'DISPONIBLE' && <EquipoReservaPlaceholder />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-bd bg-surface">
            <div className="flex border-b border-bd px-2">
              <button type="button" className={tabCls(tab === 'specs')} onClick={() => setTab('specs')}>
                Especificaciones
              </button>
              <button type="button" className={tabCls(tab === 'ficha')} onClick={() => setTab('ficha')}>
                Ficha técnica
              </button>

            </div>
            <div className="p-4">
              {tab === 'specs' && (
                <div className="flex flex-col gap-4">
                  <EquipoImagenUpload
                    imagenUrl={equipo.imagenUrl}
                    readOnly={!puedeSubirImagen}
                    onFileSelected={(file) => handleImagen(file)}
                    variant="detalle"
                  />
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-sm">
                    <div>
                      <dt className="text-xs text-tx-3">Marca</dt>
                      <dd>{equipo.marca ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-tx-3">Modelo</dt>
                      <dd className="font-mono">{equipo.modelo ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-tx-3">Año de fabricación</dt>
                      <dd className="font-mono">{equipo.anoFabricacion ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-tx-3">Categoría</dt>
                      <dd>{<EquipoCategoriaBadge categoria={equipo.categoria} />}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-tx-3">Descripción</dt>
                      <dd className={equipo.descripcion ? '' : 'text-tx-3'}>
                        {equipo.descripcion ?? 'Sin descripción registrada.'}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-tx-3">Notas</dt>
                      <dd className={equipo.notas ? '' : 'text-tx-3'}>
                        {equipo.notas ?? 'Sin notas registradas.'}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}

              {tab === 'ficha' && (
                ficha && Object.keys(ficha).length > 0 ? (
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries(ficha).map(([k, v]) => (
                        <tr key={k} className="border-b border-bd last:border-b-0">
                          <td className="py-2 text-tx-3 pr-4 align-top">{k}</td>
                          <td className="py-2 font-mono">{v || <span className="text-tx-3">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <EmptyState
                    icon="fileText"
                    title="Sin ficha técnica"
                    message="Aún no se registraron especificaciones para este equipo."
                  />
                )
              )}


            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-bd bg-surface p-4">
            <h3 className="font-semibold text-tx mb-3">Tarifas vigentes</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                ['Por día', equipo.tarifaDia],
                ['Por semana', equipo.tarifaSemana],
                ['Por mes', equipo.tarifaMes],
              ].map(([label, val]) => (
                <div key={label} className="rounded-md bg-bg-sunken p-3">
                  <div className="text-2xs uppercase tracking-wider text-tx-3 font-semibold">{label}</div>
                  <div className="font-mono font-semibold mt-1">{formatCurrency(val as string)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-bd bg-surface p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-tx">Ubicación física</h3>
              {puedeEditar && equipo.estado !== 'RENTADO' && !moverAbierto && (
                <button type="button" className={btnSec} onClick={() => setMoverAbierto(true)}>
                  <Icon name="refresh" size={12} /> Mover
                </button>
              )}
            </div>
            <div className="text-sm">
              <div className="text-xs text-tx-3">Bodega actual</div>
              <div className="font-medium">{equipo.bodega?.nombre ?? '—'}</div>
            </div>
            {equipo.estado === 'RENTADO' && (
              <p className="text-xs text-tx-3 mt-2">
                No se puede mover mientras el equipo está rentado.
              </p>
            )}
          </div>

          {moverAbierto && (
            <MoverBodegaPanel
              currentBodegaId={equipo.bodegaId}
              isPending={moverBodega.isPending}
              onCancel={() => setMoverAbierto(false)}
              onConfirm={(data) =>
                moverBodega.mutate(
                  { id: equipo.id, data },
                  { onSuccess: () => setMoverAbierto(false) },
                )
              }
            />
          )}

          <HistorialRentasEquipo equipoId={equipo.id} />
          <EquipoMantenimientosResumen equipoId={equipo.id} />
        </div>
      </div>
    </div>
  );
}

// Wrapper que conecta el hook de rentas con el componente compartido. Se
// declara local para no exportar un componente extra que solo se usa aqui.
function HistorialRentasEquipo({ equipoId }: { equipoId: string }) {
  const { data, isLoading } = useEquipoRentas(equipoId);
  return <HistorialRentasCard data={data} isLoading={isLoading} />;
}
