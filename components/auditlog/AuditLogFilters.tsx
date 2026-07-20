// components/auditlog/AuditLogFilters.tsx
'use client';

import { FilterBar } from '@/components/ui/FilterBar';
import { Icon } from '@/components/ui/Icon';
import { fechaSVToIso } from '@/lib/utils';
import {
  ENTIDADES_CONOCIDAS,
  ACCIONES_SUGERIDAS,
  calcularDesdePeriodo,
  type Periodo,
} from '@/lib/auditlog';

export type FiltrosAuditLogState = {
  busqueda: string;
  entidad: string;
  accion: string;
  periodo: Periodo;
  // Rango libre (date YYYY-MM-DD). Solo se usa si periodo es null.
  desdeManual: string;
  hastaManual: string;
};

export const FILTROS_VACIOS: FiltrosAuditLogState = {
  busqueda: '',
  entidad: '',
  accion: '',
  periodo: null,
  desdeManual: '',
  hastaManual: '',
};

const inputBase = 'px-3 py-1.5 text-sm rounded-md border bg-surface text-tx focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;

export function AuditLogFilters({
  filtros,
  onChange,
}: {
  filtros: FiltrosAuditLogState;
  onChange: (next: FiltrosAuditLogState) => void;
}) {
  // Validación cliente del rango — desde > hasta es input inválido. Mostramos
  // helper text y el componente padre puede consultar este estado vía error
  // para no disparar la query.
  const rangoInvalido = !!(filtros.desdeManual && filtros.hastaManual && filtros.desdeManual > filtros.hastaManual);

  function togglePeriodo(p: Periodo) {
    // Chips y rango libre son mutuamente excluyentes: elegir un chip limpia los
    // date inputs y viceversa. Combinarlos da ambigüedad sobre cuál gana.
    if (filtros.periodo === p) {
      onChange({ ...filtros, periodo: null });
    } else {
      onChange({ ...filtros, periodo: p, desdeManual: '', hastaManual: '' });
    }
  }

  function setDesdeManual(v: string) {
    onChange({ ...filtros, desdeManual: v, periodo: null });
  }

  function setHastaManual(v: string) {
    onChange({ ...filtros, hastaManual: v, periodo: null });
  }

  function limpiarTodo() {
    onChange(FILTROS_VACIOS);
  }

  return (
    <div className="border border-bd rounded-t-lg bg-surface">
      <FilterBar
        search={filtros.busqueda}
        onSearch={(v) => onChange({ ...filtros, busqueda: v })}
        placeholder="Buscar por ID de entidad…"
        chips={[
          { label: 'Hoy', active: filtros.periodo === 'hoy', onToggle: () => togglePeriodo('hoy') },
          { label: 'Esta semana', active: filtros.periodo === 'semana', onToggle: () => togglePeriodo('semana') },
          { label: 'Este mes', active: filtros.periodo === 'mes', onToggle: () => togglePeriodo('mes') },
        ]}
        onClear={limpiarTodo}
      />
      <div className="flex flex-wrap items-end gap-3 px-4 py-2 border-t border-bd">
        <div className="flex flex-col gap-1">
          <label className="text-2xs uppercase tracking-wider font-medium text-tx-3">Entidad</label>
          <select
            className={`${inputOk} min-w-40`}
            value={filtros.entidad}
            onChange={(e) => onChange({ ...filtros, entidad: e.target.value })}
          >
            <option value="">Todas</option>
            {ENTIDADES_CONOCIDAS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-2xs uppercase tracking-wider font-medium text-tx-3">Acción</label>
          {/* free-text con datalist: el backend permite acciones heterogéneas
              (`CREAR_USUARIO`, `ACTA_DESPACHADA`, etc.) que crecen con cada módulo. */}
          <input
            list="acciones-sugeridas"
            className={`${inputOk} min-w-52 font-mono`}
            placeholder="Cualquier acción"
            value={filtros.accion}
            onChange={(e) => onChange({ ...filtros, accion: e.target.value })}
          />
          <datalist id="acciones-sugeridas">
            {ACCIONES_SUGERIDAS.map((a) => <option key={a} value={a} />)}
          </datalist>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-2xs uppercase tracking-wider font-medium text-tx-3">Desde</label>
          <input
            type="date"
            className={rangoInvalido ? inputErr : inputOk}
            value={filtros.desdeManual}
            onChange={(e) => setDesdeManual(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-2xs uppercase tracking-wider font-medium text-tx-3">Hasta</label>
          <input
            type="date"
            className={rangoInvalido ? inputErr : inputOk}
            value={filtros.hastaManual}
            onChange={(e) => setHastaManual(e.target.value)}
          />
          {rangoInvalido && (
            <span className="text-xs text-danger inline-flex items-center gap-1 mt-0.5">
              <Icon name="alertTriangle" size={10} /> Rango inválido (desde &gt; hasta)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Convierte el estado del componente en el shape que espera el backend.
// `desde`/`hasta` se devuelven solo si hay valor; el chip de período tiene
// precedencia sobre el rango manual.
export function aFiltrosBackend(s: FiltrosAuditLogState): { entidad?: string; accion?: string; entidadId?: string; desde?: string; hasta?: string } {
  const out: { entidad?: string; accion?: string; entidadId?: string; desde?: string; hasta?: string } = {};
  if (s.entidad) out.entidad = s.entidad;
  if (s.accion.trim()) out.accion = s.accion.trim();
  // El search busca por entidadId (match exacto contra el backend).
  if (s.busqueda.trim()) out.entidadId = s.busqueda.trim();
  if (s.periodo) {
    const d = calcularDesdePeriodo(s.periodo);
    if (d) out.desde = d;
  } else {
    // Anclamos ambos extremos a TZ El Salvador (no la del dispositivo) para
    // que el rango filtrado coincida con los días calendario que el usuario
    // ve en pantalla, sin importar dónde esté físicamente.
    if (s.desdeManual) out.desde = fechaSVToIso(s.desdeManual);
    if (s.hastaManual) {
      // Hasta el FINAL del día seleccionado en SV: medianoche SV del día
      // siguiente menos 1ms. Sumar 24h en ms es exacto porque El Salvador no
      // observa horario de verano.
      const inicioSiguiente = new Date(fechaSVToIso(s.hastaManual)).getTime() + 24 * 60 * 60 * 1000;
      out.hasta = new Date(inicioSiguiente - 1).toISOString();
    }
  }
  return out;
}
