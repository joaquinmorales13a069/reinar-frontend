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
