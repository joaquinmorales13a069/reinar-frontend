// Auto-formateadores para documentos fiscales de El Salvador.
// Aplican dashes mientras el usuario tipea; aceptan input crudo (con o sin
// dashes) y devuelven el formato canónico que el backend valida.

function soloDigitos(value: string): string {
  return value.replace(/\D/g, '');
}

// NIT: 14 dígitos, formato XXXX-XXXXXX-XXX-X
// Ej: 0801140346001 7 -> 0801-140346-001-7
export function formatNIT(value: string): string {
  const d = soloDigitos(value).slice(0, 14);
  if (d.length <= 4) return d;
  if (d.length <= 10) return `${d.slice(0, 4)}-${d.slice(4)}`;
  if (d.length <= 13) return `${d.slice(0, 4)}-${d.slice(4, 10)}-${d.slice(10)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 10)}-${d.slice(10, 13)}-${d.slice(13)}`;
}

// NCR: 5 dígitos (XXXX-X) o 7 dígitos (XXXXXX-X). Auto-detecta por longitud.
// Mientras se tipea: con ≤5 dígitos asume el formato corto (4-1); con 6 o 7
// asume el largo (6-1). Tope 7 dígitos.
export function formatNCR(value: string): string {
  const d = soloDigitos(value).slice(0, 7);
  if (d.length <= 4) return d;
  if (d.length === 5) return `${d.slice(0, 4)}-${d.slice(4)}`;
  // length 6 o 7 -> formato largo XXXXXX-X
  return `${d.slice(0, 6)}-${d.slice(6)}`;
}

// DUI: 9 dígitos, formato XXXXXXXX-X
export function formatDUI(value: string): string {
  const d = soloDigitos(value).slice(0, 9);
  if (d.length <= 8) return d;
  return `${d.slice(0, 8)}-${d.slice(8)}`;
}

// NIT flexible para PARTICULAR: desde el 15-ene-2026 el MH usa el DUI como
// NIT para personas naturales SV mayores de edad. Pero extranjeros, menores
// y datos legacy pueden tener el NIT viejo de 14 dígitos.
// Detección por longitud: ≤9 dígitos formato DUI; ≥10 dígitos formato viejo.
export function formatNitFlexible(value: string): string {
  const d = soloDigitos(value).slice(0, 14);
  if (d.length <= 9) return formatDUI(d);
  return formatNIT(d);
}

// ─── Tipos y catálogos ─────────────────────────────────────────────────────

export type TipoDocumentoCliente = 'DUI' | 'NIT' | 'PASAPORTE' | 'CARNET_RESIDENTE' | 'OTRO';

export const TIPOS_DOCUMENTO_PARTICULAR = ['DUI', 'NIT', 'PASAPORTE', 'CARNET_RESIDENTE', 'OTRO'] as const satisfies readonly TipoDocumentoCliente[];
export const TIPOS_DOCUMENTO_EMPRESA   = ['NIT', 'DUI'] as const satisfies readonly TipoDocumentoCliente[];

export const LABEL_TIPO_DOCUMENTO: Record<TipoDocumentoCliente, string> = {
  DUI: 'DUI',
  NIT: 'NIT',
  PASAPORTE: 'Pasaporte',
  CARNET_RESIDENTE: 'Carnet de residente',
  OTRO: 'Otro documento',
};

export const PLACEHOLDER_POR_TIPO: Record<TipoDocumentoCliente, string> = {
  DUI: '12345678-9',
  NIT: '0614-140346-001-7',
  PASAPORTE: 'AB1234567',
  CARNET_RESIDENTE: 'CR12345678',
  OTRO: 'Número del documento',
};

export const MAXLENGTH_POR_TIPO: Record<TipoDocumentoCliente, number> = {
  DUI: 10,
  NIT: 17,
  PASAPORTE: 20,
  CARNET_RESIDENTE: 20,
  OTRO: 25,
};

const REGEX_POR_TIPO: Record<TipoDocumentoCliente, RegExp> = {
  DUI: /^\d{8}-\d$/,
  NIT: /^\d{4}-\d{6}-\d{3}-\d$/,
  PASAPORTE: /^[A-Z0-9]{5,20}$/,
  CARNET_RESIDENTE: /^[A-Z0-9-]{5,20}$/,
  OTRO: /^.{2,25}$/,
};

export const MENSAJE_FORMATO_DOCUMENTO: Record<TipoDocumentoCliente, string> = {
  DUI: 'Formato: NNNNNNNN-N',
  NIT: 'Formato: NNNN-NNNNNN-NNN-N',
  PASAPORTE: '5-20 caracteres alfanuméricos en mayúsculas',
  CARNET_RESIDENTE: '5-20 caracteres alfanuméricos (puede incluir guiones)',
  OTRO: '2-25 caracteres',
};

// Aplica el formato adecuado según el tipo de documento mientras el usuario
// tipea. Para DUI/NIT mantenemos los formateadores existentes con dashes
// automáticos; para los demás tipos forzamos mayúsculas y filtramos
// caracteres inválidos en tiempo real.
export function formatDocumento(tipo: TipoDocumentoCliente, value: string): string {
  switch (tipo) {
    case 'DUI':
      return formatDUI(value);
    case 'NIT':
      return formatNIT(value);
    case 'PASAPORTE':
      return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
    case 'CARNET_RESIDENTE':
      return value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20);
    case 'OTRO':
      return value.slice(0, 25);
  }
}

export function validarDocumento(tipo: TipoDocumentoCliente, value: string): boolean {
  return REGEX_POR_TIPO[tipo].test(value);
}
