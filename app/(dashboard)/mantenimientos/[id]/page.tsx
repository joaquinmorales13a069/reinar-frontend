'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { MantenimientoEstadoBadge } from '@/components/mantenimientos/MantenimientoEstadoBadge';
import { MantenimientoAdjuntosCard } from '@/components/mantenimientos/MantenimientoAdjuntosCard';
import { useMantenimiento, useEliminarMantenimiento } from '@/hooks/use-mantenimientos';
import { useAuthStore } from '@/stores/auth.store';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils';

export default function DetalleMantenimientoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const id = params.id;

  const { data: m, isLoading, isError } = useMantenimiento(id);
  const eliminar = useEliminarMantenimiento();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }
  if (isError || !m) {
    return (
      <EmptyState
        icon="wrench"
        title="No se pudo cargar el mantenimiento"
        message="Vuelve a intentarlo o regresa al listado."
      />
    );
  }

  const rol           = user?.rol;
  const puedeEscribir = rol && rol !== 'VISUALIZADOR';
  // Solo ADMIN, GERENTE y LOGISTICA pueden eliminar (el backend rechaza a OPERADOR en DELETE)
  const puedeEliminar = rol === 'ADMIN' || rol === 'GERENTE' || rol === 'LOGISTICA';
  const esActivo      = m.estado === 'ACTIVO';

  const entidadHref = m.equipoId
    ? `/equipos/${m.equipoId}`
    : m.herramientaUnidadId
    ? `/herramientas/unidades/${m.herramientaUnidadId}`
    : null;
  const entidadLabel = m.equipo
    ? `${m.equipo.codigo} — ${m.equipo.nombre}`
    : m.herramientaUnidad
    ? `${m.herramientaUnidad.codigoInterno} — ${m.herramientaUnidad.herramientaTipo.nombre}`
    : '—';

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Mantenimiento ${m.tipo.toLowerCase()}`}
        subtitle={<MantenimientoEstadoBadge estado={m.estado} />}
        back backLabel="Regresar" onBack={() => router.push('/mantenimientos')}
        actions={esActivo && puedeEscribir ? (
          <div className="flex gap-2">
            <Link
              href={`/mantenimientos/${m.id}/editar`}
              className="px-3 py-2 text-sm rounded-md border border-bd hover:bg-bg-2"
            >
              Editar
            </Link>
            <Link
              href={`/mantenimientos/${m.id}/salida`}
              className="px-3 py-2 text-sm rounded-md bg-accent text-bg hover:opacity-90"
            >
              Registrar salida
            </Link>
            {puedeEliminar && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="px-3 py-2 text-sm rounded-md border border-danger text-danger hover:bg-danger/10"
              >
                Eliminar
              </button>
            )}
          </div>
        ) : null}
      />

      {confirmDelete && (
        <ConfirmRow
          message="Eliminar este mantenimiento revertirá el equipo o unidad a DISPONIBLE."
          confirmLabel="Eliminar"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await eliminar.mutateAsync(m);
            router.push('/mantenimientos');
          }}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-bd bg-surface p-4 flex flex-col gap-3">
          <h3 className="font-semibold">Datos</h3>
          <Dato label="Técnico"               value={m.tecnico} />
          <Dato label="Categoría"             value={m.categoria?.nombre ?? '—'} />
          <Dato label="Motivo"                value={m.motivo} />
          <Dato label="Horómetro"             value={m.horometro ?? '—'} />
          <Dato label="Fecha de entrada"      value={formatDateTime(m.fechaEntrada)} />
          <Dato
            label="Próximo mantenimiento"
            value={m.proximoMantenimiento ? formatDate(m.proximoMantenimiento) : '—'}
          />
          {m.fechaSalida && (
            <Dato label="Fecha de salida" value={formatDateTime(m.fechaSalida)} />
          )}
        </div>

        <div className="rounded-lg border border-bd bg-surface p-4 flex flex-col gap-3">
          <h3 className="font-semibold">Costos</h3>
          <Dato label="Estimado" value={m.costoEstimado ? formatCurrency(m.costoEstimado) : '—'} />
          <Dato label="Real"     value={m.costoReal     ? formatCurrency(m.costoReal)     : '—'} />
          <h3 className="font-semibold mt-3">Entidad</h3>
          {entidadHref ? (
            <Link href={entidadHref} className="text-sm text-accent hover:underline">
              {entidadLabel}
            </Link>
          ) : (
            <span className="text-sm">{entidadLabel}</span>
          )}
        </div>

        <div className="rounded-lg border border-bd bg-surface p-4 lg:col-span-2">
          <h3 className="font-semibold mb-2">Repuestos</h3>
          {m.repuestos.length === 0 ? (
            <p className="text-sm text-tx-3">Sin repuestos registrados.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {m.repuestos.map((r) => (
                <div key={r.id} className="text-sm border-b border-bd pb-2 last:border-0 last:pb-0">
                  {r.consumibleId ? (
                    <div className="flex justify-between gap-2">
                      <span className="text-tx-3">
                        Interno — consumible{' '}
                        <span className="font-mono text-xs">{r.consumibleId}</span>
                      </span>
                      <span className="font-medium">× {r.cantidad}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      <div className="flex justify-between gap-2">
                        <span>{r.descripcion}</span>
                        <span className="font-medium">× {r.cantidad}</span>
                      </div>
                      {r.costoCompra && (
                        <span className="text-xs text-tx-3">Costo: {formatCurrency(r.costoCompra)}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {m.diagnostico && (
          <div className="rounded-lg border border-bd bg-surface p-4 lg:col-span-2">
            <h3 className="font-semibold mb-2">Diagnóstico</h3>
            <p className="text-sm whitespace-pre-wrap">{m.diagnostico}</p>
          </div>
        )}

        {m.trabajoRealizado && (
          <div className="rounded-lg border border-bd bg-surface p-4 lg:col-span-2">
            <h3 className="font-semibold mb-2">Trabajo realizado</h3>
            <p className="text-sm whitespace-pre-wrap">{m.trabajoRealizado}</p>
          </div>
        )}

        {m.observacionesSalida && (
          <div className="rounded-lg border border-bd bg-surface p-4 lg:col-span-2">
            <h3 className="font-semibold mb-2">Observaciones de salida</h3>
            <p className="text-sm whitespace-pre-wrap">{m.observacionesSalida}</p>
          </div>
        )}

        {m.observaciones && (
          <div className="rounded-lg border border-bd bg-surface p-4 lg:col-span-2">
            <h3 className="font-semibold mb-2">Observaciones</h3>
            <p className="text-sm whitespace-pre-wrap">{m.observaciones}</p>
          </div>
        )}

        <div className="lg:col-span-2">
          <MantenimientoAdjuntosCard
            mantenimientoId={m.id}
            adjuntos={m.adjuntos}
            readOnly={!puedeEscribir || !esActivo}
            canDeleteAdjunto={puedeEliminar && esActivo}
          />
        </div>
      </div>
    </div>
  );
}

function Dato({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm border-b border-bd pb-2 last:border-0 last:pb-0">
      <span className="text-tx-3">{label}</span>
      <span className="text-tx font-medium text-right">{value}</span>
    </div>
  );
}
