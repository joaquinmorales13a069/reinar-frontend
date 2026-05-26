'use client';

import { useEffect, useRef, useState } from 'react';
import { DEPARTAMENTOS_SV, getMunicipiosByDept, getDistritosByMuniDept } from '@/lib/sv-geo';

// Cuatro niveles (Departamento, Municipio, Distrito, Calle) específicos para la
// dirección de entrega de un acta. El componente UbicacionInput existente solo
// modela tres niveles porque otros módulos (cotizaciones/PDFs) no necesitan
// municipio; este es un caso aparte y por eso no se modifica el original.
//
// Persistencia: componemos un único string con LABELS (no códigos MH), porque
// `direccionEntrega` en el backend es texto libre y el PDF del acta debe
// mostrar nombres legibles directamente.

type Parts = {
  departamento: string; // código MH; '' = no seleccionado
  municipio:    string; // código MH dentro del departamento; '' = no seleccionado
  distrito:     string; // label (no value, porque el código se repite por municipio dentro del depto)
  calle:        string; // texto libre
};

type Props = {
  value: string;
  onChange: (texto: string) => void;
  error?: string;
};

const SEPARADOR = ', ';

function componer(p: Parts): string {
  const dept = DEPARTAMENTOS_SV.find((d) => d.value === p.departamento);
  const muni = p.departamento ? getMunicipiosByDept(p.departamento).find((m) => m.value === p.municipio) : undefined;
  const dist = p.departamento && p.municipio
    ? getDistritosByMuniDept(p.departamento, p.municipio).find((d) => d.label === p.distrito)
    : undefined;
  if (!p.calle.trim() || !dept || !muni || !dist) return '';
  return `${p.calle.trim()}${SEPARADOR}${dist.label}${SEPARADOR}${muni.label}${SEPARADOR}${dept.label}`;
}

// Reconstruye los selectores si nos llega un value previo. Los 3 últimos tokens
// son depto-muni-distrito (en orden inverso al de display); todo lo anterior va
// a calle. Si algo no matchea un catálogo, dejamos el valor original en calle.
function parsear(value: string): Parts {
  if (!value) return { departamento: '', municipio: '', distrito: '', calle: '' };

  const tokens = value.split(SEPARADOR).map((t) => t.trim()).filter(Boolean);
  if (tokens.length < 4) return { departamento: '', municipio: '', distrito: '', calle: value };

  const deptLabel = tokens[tokens.length - 1];
  const muniLabel = tokens[tokens.length - 2];
  const distLabel = tokens[tokens.length - 3];

  const dept = DEPARTAMENTOS_SV.find((d) => d.label === deptLabel);
  if (!dept) return { departamento: '', municipio: '', distrito: '', calle: value };

  const muni = getMunicipiosByDept(dept.value).find((m) => m.label === muniLabel);
  if (!muni) return { departamento: '', municipio: '', distrito: '', calle: value };

  const dist = getDistritosByMuniDept(dept.value, muni.value).find((d) => d.label === distLabel);
  if (!dist) return { departamento: '', municipio: '', distrito: '', calle: value };

  return {
    departamento: dept.value,
    municipio:    muni.value,
    distrito:     dist.label,
    calle:        tokens.slice(0, -3).join(SEPARADOR),
  };
}

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';

export function DireccionCompleta({ value, onChange, error }: Props) {
  const [parts, setParts] = useState<Parts>(() => parsear(value));
  // Evita reparsear en cada render — solo sincronizamos cuando el value externo
  // cambia (ej. reset del form), no cada keystroke nuestro.
  const lastExternalValue = useRef(value);

  useEffect(() => {
    if (value !== lastExternalValue.current && value !== componer(parts)) {
      lastExternalValue.current = value;
      setParts(parsear(value));
    }
  }, [value, parts]);

  function update(next: Parts) {
    setParts(next);
    const composed = componer(next);
    lastExternalValue.current = composed;
    onChange(composed);
  }

  const municipios = parts.departamento ? getMunicipiosByDept(parts.departamento) : [];
  const distritos = parts.departamento && parts.municipio
    ? getDistritosByMuniDept(parts.departamento, parts.municipio)
    : [];
  const inputCls = error ? `${inputBase} border-danger` : `${inputBase} border-bd`;

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Departamento</label>
          <select
            className={inputCls}
            value={parts.departamento}
            onChange={(e) => update({ departamento: e.target.value, municipio: '', distrito: '', calle: parts.calle })}
          >
            <option value="">— Selecciona —</option>
            {DEPARTAMENTOS_SV.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Municipio</label>
          <select
            className={inputCls}
            value={parts.municipio}
            onChange={(e) => update({ ...parts, municipio: e.target.value, distrito: '' })}
            disabled={!parts.departamento}
          >
            <option value="">{parts.departamento ? '— Selecciona —' : '— Selecciona departamento primero —'}</option>
            {municipios.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Distrito</label>
          <select
            className={inputCls}
            value={parts.distrito}
            onChange={(e) => update({ ...parts, distrito: e.target.value })}
            disabled={!parts.municipio}
          >
            <option value="">{parts.municipio ? '— Selecciona —' : '— Selecciona municipio primero —'}</option>
            {/* value usa el label porque el código de distrito se repite entre municipios del mismo depto. */}
            {distritos.map((d) => <option key={`${d.value}-${d.label}`} value={d.label}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Calle, número y referencia</label>
          <input
            className={inputCls}
            placeholder="Calle 5, casa 20, frente a parque"
            value={parts.calle}
            onChange={(e) => update({ ...parts, calle: e.target.value })}
          />
        </div>
      </div>
      {error && <p className="text-xs text-danger mt-2">{error}</p>}
    </div>
  );
}
