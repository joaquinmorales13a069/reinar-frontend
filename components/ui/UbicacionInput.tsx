'use client';

import { useEffect, useRef, useState } from 'react';
import { DEPARTAMENTOS_SV, getDistritosByDept } from '@/lib/sv-geo';

type UbicacionParts = {
  departamento: string; // value del catálogo (código MH); '' = no seleccionado
  distrito: string;     // label del catálogo (no el código MH, que no es único por depto); '' = no seleccionado
  detalle: string;      // texto libre (calle, número, referencia)
};

type UbicacionInputProps = {
  value: string;
  onChange: (texto: string) => void;
  error?: string;
  className?: string;
};

const SEPARADOR = ', ';

// Compone el texto final que se persiste en backend. Se guardan los nombres
// (labels) — no los códigos — porque el backend acepta texto libre y los PDFs
// del módulo de cotizaciones ya esperan strings legibles.
function componer(parts: UbicacionParts): string {
  const dept = DEPARTAMENTOS_SV.find((d) => d.value === parts.departamento);
  // parts.distrito guarda el label (no el código MH) porque dentro de un
  // departamento los códigos pueden repetirse entre municipios (ej: La Paz
  // tiene dos distritos con value '05'). Usar el label como identificador
  // interno del select evita esa ambigüedad.
  const dist = getDistritosByDept(parts.departamento).find((d) => d.label === parts.distrito);
  if (!parts.detalle.trim() || !dept || !dist) return '';
  return `${parts.detalle.trim()}${SEPARADOR}${dist.label}${SEPARADOR}${dept.label}`;
}

// Intenta reconstruir los selectores cuando el componente recibe un value en
// modo edición. Si los dos últimos tokens del split por ", " matchean labels
// del catálogo, prellenamos los dropdowns; si no, todo va al input de detalle
// (caso de datos legacy o con formato distinto).
function parsear(value: string): UbicacionParts {
  if (!value) return { departamento: '', distrito: '', detalle: '' };

  const tokens = value.split(SEPARADOR).map((t) => t.trim()).filter(Boolean);
  if (tokens.length < 3) {
    return { departamento: '', distrito: '', detalle: value };
  }

  const deptLabel = tokens[tokens.length - 1];
  const distLabel = tokens[tokens.length - 2];

  const dept = DEPARTAMENTOS_SV.find((d) => d.label === deptLabel);
  if (!dept) return { departamento: '', distrito: '', detalle: value };

  const dist = getDistritosByDept(dept.value).find((d) => d.label === distLabel);
  if (!dist) return { departamento: '', distrito: '', detalle: value };

  // El detalle es todo lo anterior unido — el join con SEPARADOR preserva las
  // comas internas si el usuario las usó al escribir (ej. "Calle 5, casa 20").
  const detalle = tokens.slice(0, -2).join(SEPARADOR);
  return { departamento: dept.value, distrito: dist.label, detalle };
}

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-2';
const hintCls = 'text-xs text-tx-3 mt-1';

export function UbicacionInput({ value, onChange, error, className }: UbicacionInputProps) {
  const [parts, setParts] = useState<UbicacionParts>(() => parsear(value));
  // El valor "estable" pre-parseado evita re-parsear en cada render — solo
  // sincronizamos cuando el `value` controlado externo cambia explícitamente
  // (ej. reset del form), no por cada keystroke nuestro.
  const lastExternalValue = useRef(value);

  useEffect(() => {
    if (value !== lastExternalValue.current && value !== componer(parts)) {
      lastExternalValue.current = value;
      setParts(parsear(value));
    }
  }, [value, parts]);

  function update(next: UbicacionParts) {
    setParts(next);
    const composed = componer(next);
    lastExternalValue.current = composed;
    onChange(composed);
  }

  const distritos = parts.departamento ? getDistritosByDept(parts.departamento) : [];
  const inputCls = error ? `${inputBase} border-danger` : `${inputBase} border-bd`;
  const fallback =
    !!value && parts.departamento === '' && parts.distrito === '' && parts.detalle === value;

  return (
    <div className={className}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Departamento *</label>
          <select
            className={inputCls}
            value={parts.departamento}
            onChange={(e) => update({ ...parts, departamento: e.target.value, distrito: '' })}
          >
            <option value="">— Selecciona departamento —</option>
            {DEPARTAMENTOS_SV.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Distrito *</label>
          <select
            className={inputCls}
            value={parts.distrito}
            onChange={(e) => update({ ...parts, distrito: e.target.value })}
            disabled={!parts.departamento}
          >
            <option value="">
              {parts.departamento ? '— Selecciona distrito —' : '— Selecciona departamento primero —'}
            </option>
            {distritos.map((d) => (
              // value usa el label (no el código MH) porque dentro del mismo
              // departamento el código se repite entre municipios — y aquí
              // estamos ignorando el municipio (decisión D3 del spec). El label
              // es el identificador estable que persistimos.
              <option key={`${d.value}-${d.label}`} value={d.label}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3">
        <label className={labelCls}>Calle, número y referencia *</label>
        <input
          className={inputCls}
          placeholder="Calle 5, casa 20, frente a parque"
          value={parts.detalle}
          onChange={(e) => update({ ...parts, detalle: e.target.value })}
        />
      </div>

      {fallback && (
        <p className={hintCls}>
          Los selectores quedaron vacíos por el formato anterior; al guardar se
          actualizará la dirección al nuevo formato.
        </p>
      )}
      {error && <p className={errorCls}>{error}</p>}
    </div>
  );
}

// Exportamos parsear/componer para que los formularios puedan derivar campos
// adicionales sin reimplementar la lógica (ej. Bodega.ciudad = distrito.label).
export function getDistritoLabel(value: string): string | null {
  if (!value) return null;
  // Búsqueda directa en el value de la composición — el último token antes del
  // departamento es el distrito.label, lo que es suficiente para Bodega.ciudad.
  const tokens = value.split(SEPARADOR).map((t) => t.trim()).filter(Boolean);
  if (tokens.length < 3) return null;
  return tokens[tokens.length - 2];
}

export function getDepartamentoLabel(value: string): string | null {
  if (!value) return null;
  const tokens = value.split(SEPARADOR).map((t) => t.trim()).filter(Boolean);
  if (tokens.length < 3) return null;
  return tokens[tokens.length - 1];
}
