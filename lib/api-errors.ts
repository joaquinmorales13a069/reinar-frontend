// Helper compartido para mapear errores del backend a setError de RHF.
// Patrón: el backend devuelve { success: false, error: { code, message, details? } }.
// Mantiene la convención de toast para errores genéricos (lo hacen los hooks),
// y sólo aporta el setError inline cuando el código y el campo coinciden.

import type { UseFormSetError, FieldValues, Path } from 'react-hook-form';

type ApiErrorShape = {
  response?: { data?: { error?: { code?: string; message?: string } } };
};

// Mapea un error del backend a un setError en un campo específico si el
// código está en la lista esperada y el mensaje menciona el campo.
// Devuelve `true` si se mapeó (la UI ya tiene feedback inline), `false` si no
// (el llamador decide si toastear).
export function trySetFieldErrorFromApi<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  field: Path<T>,
  opts?: { codes?: string[]; matchHint?: string },
): boolean {
  const codes = opts?.codes ?? ['CONFLICT'];
  const hint = (opts?.matchHint ?? (field as string)).toLowerCase();
  const apiErr = err as ApiErrorShape;
  const code = apiErr?.response?.data?.error?.code;
  const msg = apiErr?.response?.data?.error?.message;
  if (!code || !msg) return false;
  if (!codes.includes(code)) return false;
  if (!msg.toLowerCase().includes(hint)) return false;
  setError(field, { type: 'server', message: msg });
  return true;
}
