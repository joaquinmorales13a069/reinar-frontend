// Modalidad de transporte del anexo FEX. El `value` es el enum que FacturaLlama
// espera en attachments[].driver.transport. Debe coincidir con
// server/src/lib/transporte-fex.ts.
export type TransporteFex = { value: string; label: string }

export const TRANSPORTE_FEX: TransporteFex[] = [
  { value: 'TERRESTRE', label: 'Terrestre' },
  { value: 'MARITIMO', label: 'Marítimo' },
  { value: 'AEREO', label: 'Aéreo' },
  { value: 'TERRESTRE_MARITIMO', label: 'Terrestre y marítimo' },
  { value: 'TERRESTRE_AEREO', label: 'Terrestre y aéreo' },
  { value: 'MARITIMO_AEREO', label: 'Marítimo y aéreo' },
  { value: 'TERRESTRE_MARITIMO_AEREO', label: 'Terrestre, marítimo y aéreo' },
]

export const TRANSPORTE_FEX_CODIGOS: ReadonlySet<string> = new Set(TRANSPORTE_FEX.map((t) => t.value))

export function resolverTransporte(code?: string | null): string {
  if (!code) return ''
  return TRANSPORTE_FEX.find((t) => t.value === code)?.label ?? code
}
