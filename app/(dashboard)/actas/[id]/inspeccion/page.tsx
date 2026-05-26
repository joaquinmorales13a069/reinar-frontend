'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { CondicionSelect } from '@/components/actas-recepciones/CondicionSelect';
import { describirItem } from '@/components/actas-recepciones/ItemRow';
import { useActa, useActualizarInspeccion } from '@/hooks/use-actas';
import type { ActaItem, ActualizarInspeccionDto, CondicionItem } from '@/types/api';

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border border-bd bg-surface text-tx focus:outline-none focus:border-accent transition-colors';
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';

// El bodeguero copia los valores del picking físico al sistema. La página
// solo es accesible mientras la inspección puede editarse — backend rechaza
// PENDIENTE/DESPACHADO sí, ENTREGADO+ no (datos congelados al firmar el cliente).

type FilaInspeccion = {
  id: string;
  item: ActaItem;
  condicionSalida: CondicionItem;
  observacionesSalida: string;
  horometroSalida: string;
  combustibleSalida: string;
};

function aFila(item: ActaItem): FilaInspeccion {
  return {
    id: item.id,
    item,
    condicionSalida: (item.condicionSalida as CondicionItem) ?? 'BUENO',
    observacionesSalida: item.observacionesSalida ?? '',
    horometroSalida: item.horometroSalida ?? '',
    combustibleSalida: item.combustibleSalida ?? '',
  };
}

export default function InspeccionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: acta, isLoading } = useActa(id);
  const actualizar = useActualizarInspeccion();

  const [filas, setFilas] = useState<FilaInspeccion[]>([]);

  // Cuando cargan los items, hidratamos las filas. El usuario edita estas
  // filas localmente; al guardar, se manda todo al backend en bulk.
  useEffect(() => {
    if (!acta) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilas(acta.items.map(aFila));
  }, [acta]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }
  if (!acta) {
    return <EmptyState icon="clipboard" title="Acta no encontrada" message="El acta no existe o fue eliminada." />;
  }

  const estadoEditable = acta.estado === 'PENDIENTE' || acta.estado === 'DESPACHADO';
  if (!estadoEditable) {
    return (
      <div>
        <PageHeader title={`Inspección — ${acta.numeroActa}`} back backLabel="Detalle" />
        <EmptyState
          icon="clipboard"
          title="Datos congelados"
          message={`Esta acta está en estado ${acta.estado}. Los datos de inspección no pueden editarse una vez confirmada la entrega al cliente.`}
        />
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dto: ActualizarInspeccionDto = {
      items: filas.map((f) => ({
        id: f.id,
        condicionSalida: f.condicionSalida,
        observacionesSalida: f.observacionesSalida.trim() || undefined,
        horometroSalida: f.horometroSalida.trim() ? Number(f.horometroSalida) : undefined,
        combustibleSalida: f.combustibleSalida.trim() || undefined,
      })),
    };
    try {
      await actualizar.mutateAsync({ id, data: dto });
      router.push(`/actas/${id}`);
    } catch {
      // hook ya toasteó
    }
  };

  function actualizarFila(filaId: string, patch: Partial<FilaInspeccion>) {
    setFilas((prev) => prev.map((f) => (f.id === filaId ? { ...f, ...patch } : f)));
  }

  return (
    <form onSubmit={onSubmit}>
      <PageHeader
        title="Capturar datos del picking"
        subtitle={
          <>
            <span className="font-mono">{acta.numeroActa}</span> · <Badge status={acta.estado} />
          </>
        }
        back
        backLabel="Detalle"
      />

      <div className="rounded-md border border-info-soft bg-info-soft/40 border-l-4 border-l-info p-4 mb-4 text-sm text-tx">
        Copiá los datos que la cuadrilla anotó a mano en la lista de picking. Una vez completos,
        podrás registrar el despacho. La condición de salida es obligatoria por cada ítem.
      </div>

      <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
        <h3 className="text-sm font-semibold text-tx mb-3">Ítems del acta ({filas.length})</h3>
        <div className="divide-y divide-bd">
          {filas.map((fila) => {
            const info = describirItem(fila.item);
            const esEquipo = !!fila.item.equipo;
            return (
              <div key={fila.id} className="py-3">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-tx truncate">{info.titulo}</div>
                    <div className="text-xs text-tx-3 flex items-center gap-2 mt-0.5">
                      <span className="uppercase tracking-wide font-medium">{info.tipo}</span>
                      {info.codigo && <span className="font-mono">· {info.codigo}</span>}
                    </div>
                  </div>
                </div>
                <div className="grid sm:grid-cols-3 gap-2">
                  <div>
                    <label className={labelCls}>
                      Cond. salida <span className="text-danger">*</span>
                    </label>
                    <CondicionSelect
                      value={fila.condicionSalida}
                      onChange={(v) => actualizarFila(fila.id, { condicionSalida: v })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Observaciones</label>
                    <input
                      className={inputBase}
                      value={fila.observacionesSalida}
                      onChange={(e) => actualizarFila(fila.id, { observacionesSalida: e.target.value })}
                      placeholder="Rayones, faltantes, etc."
                    />
                  </div>
                </div>
                {esEquipo && (
                  <div className="grid sm:grid-cols-2 gap-2 mt-2">
                    <div>
                      <label className={labelCls}>Horómetro salida</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        className={`${inputBase} font-mono`}
                        value={fila.horometroSalida}
                        onChange={(e) => actualizarFila(fila.id, { horometroSalida: e.target.value })}
                        placeholder="0.0"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Combustible salida</label>
                      <input
                        className={`${inputBase} font-mono`}
                        value={fila.combustibleSalida}
                        onChange={(e) => actualizarFila(fila.id, { combustibleSalida: e.target.value })}
                        placeholder="Ej. 100% / 3/4 tanque"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push(`/actas/${id}`)}
          className="px-3 py-1.5 text-sm rounded-md border border-bd text-tx hover:bg-bg-sunken transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={actualizar.isPending}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60"
        >
          <Icon name="check" size={14} /> {actualizar.isPending ? 'Guardando…' : 'Guardar inspección'}
        </button>
      </div>
    </form>
  );
}
