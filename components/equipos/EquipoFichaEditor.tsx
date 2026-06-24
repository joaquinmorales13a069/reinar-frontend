'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { useEditarEquipo } from '@/hooks/use-equipos';
import type { Equipo, FichaTecnica } from '@/types/api';

type Row = { key: string; value: string };

const inputBase = 'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;

function fichaToRows(ficha: FichaTecnica | null | undefined): Row[] {
  if (!ficha || Object.keys(ficha).length === 0) return [{ key: '', value: '' }];
  return Object.entries(ficha).map(([k, v]) => ({ key: k, value: String(v) }));
}

export function EquipoFichaEditor({ equipo }: { equipo: Equipo }) {
  const router = useRouter();
  const editar = useEditarEquipo();
  const [rows, setRows] = useState<Row[]>(() => fichaToRows(equipo.fichaTecnica));
  const [touched, setTouched] = useState(false);

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function remove(i: number) {
    setRows((rs) => rs.filter((_, j) => j !== i));
  }
  function add() {
    setRows((rs) => [...rs, { key: '', value: '' }]);
  }

  const previewEntries = rows.filter((r) => r.key.trim());
  const filasInvalidas = rows.some((r) => !r.key.trim() && r.value.trim());

  async function guardar() {
    setTouched(true);
    if (filasInvalidas) return;
    const fichaTecnica: FichaTecnica = {};
    for (const r of rows) {
      const k = r.key.trim();
      if (k) fichaTecnica[k] = r.value;
    }
    await editar.mutateAsync({ id: equipo.id, data: { fichaTecnica } });
    router.push(`/equipos/${equipo.id}`);
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`Ficha técnica — ${equipo.nombre}`}
        subtitle="Pares clave-valor con las especificaciones técnicas del equipo."
        back
        backLabel={`Equipo ${equipo.codigo}`}
        onBack={() => router.push(`/equipos/${equipo.id}`)}
      />

      <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h3 className="font-semibold text-tx">Especificaciones ({rows.length})</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={add}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-bd text-xs text-tx-2 hover:bg-bg-sunken transition-colors"
            >
              <Icon name="plus" size={12} /> Agregar especificación
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-tx-3">
            Sin especificaciones. Hacé clic en &quot;Agregar especificación&quot; para comenzar.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((r, i) => {
              const claveVacia = touched && !r.key.trim();
              return (
                <div key={i} className="grid grid-cols-[1fr_1fr_36px] gap-2 items-start">
                  <input
                    className={claveVacia ? inputErr : inputOk}
                    value={r.key}
                    onChange={(e) => update(i, { key: e.target.value })}
                    placeholder="Especificación — ej. Potencia"
                  />
                  <input
                    className={inputOk}
                    value={r.value}
                    onChange={(e) => update(i, { value: e.target.value })}
                    placeholder="Valor — ej. 185 CFM"
                  />
                  <button
                    type="button"
                    className="inline-flex items-center justify-center w-9 h-9 rounded text-danger hover:bg-bg-sunken transition-colors"
                    onClick={() => remove(i)}
                    aria-label="Quitar fila"
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {touched && filasInvalidas && (
          <div className="flex items-start gap-2 mt-3 p-3 rounded-md border border-danger-soft bg-danger-soft text-danger">
            <Icon name="alertTriangle" size={14} className="mt-0.5 shrink-0" />
            <p className="text-sm">
              Hay filas con el campo <b>Especificación</b> vacío. Completalas o eliminalas.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-bd bg-surface overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-bd">
          <h3 className="font-semibold text-tx">Vista previa</h3>
          <p className="text-xs text-tx-3">Así se verá la ficha en el detalle del equipo.</p>
        </div>
        <div className="p-4">
          {previewEntries.length === 0 ? (
            <EmptyState
              icon="fileText"
              title="Sin especificaciones técnicas"
              message="Comenzá agregando una fila arriba para ver la vista previa."
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bd">
                  <th className="text-left py-2 text-xs text-tx-3 font-medium">Especificación</th>
                  <th className="text-left py-2 text-xs text-tx-3 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {previewEntries.map((r, i) => (
                  <tr key={i} className="border-b border-bd last:border-b-0">
                    <td className="py-2 pr-4 text-tx-3 align-top">{r.key}</td>
                    <td className="py-2 font-mono">{r.value || <span className="text-tx-3">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 justify-end">
        <button
          type="button"
          onClick={() => router.push(`/equipos/${equipo.id}`)}
          className="inline-flex items-center justify-center px-3 py-2 rounded-md border border-bd text-sm text-tx-2 hover:bg-bg-sunken transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={editar.isPending || filasInvalidas}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Icon name="check" size={14} /> Guardar ficha técnica
        </button>
      </div>
    </div>
  );
}
