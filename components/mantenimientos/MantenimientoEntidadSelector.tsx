'use client';

import { useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { useEquipos } from '@/hooks/use-equipos';
import { useHerramientaTipos, useUnidadesPorTipo } from '@/hooks/use-herramientas';
import type { Equipo, HerramientaTipo, HerramientaUnidad } from '@/types/api';

export type EntidadSeleccionada =
  | { kind: 'equipo'; equipoId: string; label: string }
  | { kind: 'unidad'; herramientaUnidadId: string; label: string }
  | null;

type Props = {
  value: EntidadSeleccionada;
  onChange: (v: EntidadSeleccionada) => void;
  // Cuando llega desde una URL con ?equipoId o ?herramientaUnidadId,
  // ocultamos el toggle y el combobox para evitar reasignaciones.
  locked?: boolean;
  error?: string;
};

export function MantenimientoEntidadSelector({ value, onChange, locked, error }: Props) {
  const [kind, setKind] = useState<'equipo' | 'unidad'>(
    value?.kind === 'unidad' ? 'unidad' : 'equipo',
  );
  const [search, setSearch] = useState('');

  if (locked && value) {
    return (
      <div className="rounded-md border border-bd bg-surface px-3 py-2 text-sm">
        <div className="text-xs text-tx-3">
          {value.kind === 'equipo' ? 'Equipo' : 'Unidad de herramienta'}
        </div>
        <div className="font-medium">{value.label}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="inline-flex rounded-md border border-bd overflow-hidden self-start">
        <button
          type="button"
          onClick={() => { setKind('equipo'); onChange(null); }}
          className={`px-3 py-1.5 text-sm ${kind === 'equipo' ? 'bg-accent text-bg' : 'bg-surface text-tx'}`}
        >
          Equipo
        </button>
        <button
          type="button"
          onClick={() => { setKind('unidad'); onChange(null); }}
          className={`px-3 py-1.5 text-sm ${kind === 'unidad' ? 'bg-accent text-bg' : 'bg-surface text-tx'}`}
        >
          Unidad de herramienta
        </button>
      </div>

      {kind === 'equipo' ? (
        <EquipoPicker search={search} setSearch={setSearch} value={value} onChange={onChange} />
      ) : (
        <UnidadPicker search={search} setSearch={setSearch} value={value} onChange={onChange} />
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function EquipoPicker({
  search, setSearch, value, onChange,
}: {
  search: string; setSearch: (s: string) => void;
  value: EntidadSeleccionada; onChange: (v: EntidadSeleccionada) => void;
}) {
  // Solo equipos DISPONIBLES; el backend rechaza RENTADO o MANTENIMIENTO al crear.
  // FiltrosEquipos usa `search` (no `busqueda`) y acepta `estado` y `limit`.
  const { data, isLoading } = useEquipos({
    search:  search || undefined,
    estado:  'DISPONIBLE',
    limit:   20,
  });

  return (
    <>
      <input
        type="search"
        placeholder="Buscar equipo por código o nombre…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
      />
      <div className="border border-bd rounded-md max-h-56 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : (
          (data?.data ?? []).map((eq: Equipo) => {
            const isActive = value?.kind === 'equipo' && value.equipoId === eq.id;
            return (
              <button
                key={eq.id}
                type="button"
                onClick={() => onChange({
                  kind: 'equipo',
                  equipoId: eq.id,
                  // Equipo usa `codigo` (no `codigoInterno`) según types/api.ts
                  label: `${eq.codigo} — ${eq.nombre}`,
                })}
                className={`w-full text-left px-3 py-2 text-sm border-b border-bd last:border-0 ${
                  isActive ? 'bg-accent/15 text-accent' : 'hover:bg-bg-2'
                }`}
              >
                <span className="font-mono">{eq.codigo}</span> — {eq.nombre}
              </button>
            );
          })
        )}
      </div>
    </>
  );
}

function UnidadPicker({
  search, setSearch, value, onChange,
}: {
  search: string; setSearch: (s: string) => void;
  value: EntidadSeleccionada; onChange: (v: EntidadSeleccionada) => void;
}) {
  const [tipoId, setTipoId] = useState<string | null>(null);
  // FiltrosHerramientas usa `search` (no `busqueda`).
  // useHerramientaTipos retorna PaginatedResponse<HerramientaTipo>, por eso accedemos a data.data.
  const tiposQ = useHerramientaTipos({ search: search || undefined });
  // useUnidadesPorTipo retorna ApiResponse<HerramientaUnidad[]>: el hook ya extrae
  // .data, así que el resultado es directamente el array (no .data.data).
  // FiltrosUnidades acepta `estado?: EstadoHerramienta` — 'DISPONIBLE' es válido.
  const unidadesQ = useUnidadesPorTipo(tipoId ?? '', { estado: 'DISPONIBLE' });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div>
        <input
          type="search"
          placeholder="Buscar tipo de herramienta…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
        />
        <div className="mt-2 border border-bd rounded-md max-h-56 overflow-y-auto">
          {tiposQ.isLoading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : (
            (tiposQ.data?.data ?? []).map((t: HerramientaTipo) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTipoId(t.id)}
                className={`w-full text-left px-3 py-2 text-sm border-b border-bd last:border-0 ${
                  tipoId === t.id ? 'bg-accent/15 text-accent' : 'hover:bg-bg-2'
                }`}
              >
                {t.nombre}
              </button>
            ))
          )}
        </div>
      </div>
      <div>
        <div className="text-xs text-tx-3 px-1 pb-1">
          {tipoId ? 'Unidades disponibles' : 'Selecciona un tipo primero'}
        </div>
        <div className="border border-bd rounded-md max-h-56 overflow-y-auto">
          {!tipoId ? (
            <div className="text-sm text-tx-3 px-3 py-6 text-center">—</div>
          ) : unidadesQ.isLoading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : (unidadesQ.data ?? []).length === 0 ? (
            <div className="text-sm text-tx-3 px-3 py-6 text-center">Sin unidades disponibles</div>
          ) : (
            (unidadesQ.data ?? []).map((u: HerramientaUnidad) => {
              const isActive = value?.kind === 'unidad' && value.herramientaUnidadId === u.id;
              const tipoNombre = tiposQ.data?.data.find((t: HerramientaTipo) => t.id === tipoId)?.nombre ?? '';
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onChange({
                    kind: 'unidad',
                    herramientaUnidadId: u.id,
                    label: `${u.codigoInterno} — ${tipoNombre}`,
                  })}
                  className={`w-full text-left px-3 py-2 text-sm border-b border-bd last:border-0 ${
                    isActive ? 'bg-accent/15 text-accent' : 'hover:bg-bg-2'
                  }`}
                >
                  <span className="font-mono">{u.codigoInterno}</span> — {tipoNombre}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
