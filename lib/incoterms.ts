// Incoterms vigentes (CAT-031 MH). El `value` es el nombre del enum que
// FacturaLlama espera en el campo `incoterms` del payload FEX — NO el código
// numérico CAT-031. El label es la descripción en español.
// Debe coincidir con server/src/lib/incoterms.ts.
export type Incoterm = { value: string; label: string }

export const INCOTERMS: Incoterm[] = [
  { value: 'EXW', label: 'EXW — En fábrica' },
  { value: 'FCA', label: 'FCA — Libre transportista' },
  { value: 'CPT', label: 'CPT — Transporte pagado hasta' },
  { value: 'CIP', label: 'CIP — Transporte y seguro pagado hasta' },
  { value: 'DAP', label: 'DAP — Entrega en el lugar' },
  { value: 'DPU', label: 'DPU — Entregado en el lugar descargado' },
  { value: 'DDP', label: 'DDP — Entrega con impuestos pagados' },
  { value: 'FAS', label: 'FAS — Libre al costado del buque' },
  { value: 'FOB', label: 'FOB — Libre a bordo' },
  { value: 'CFR', label: 'CFR — Costo y flete' },
  { value: 'CIF', label: 'CIF — Costo, seguro y flete' },
]

export const INCOTERMS_CODIGOS: ReadonlySet<string> = new Set(INCOTERMS.map((i) => i.value))

export function resolverIncoterm(code?: string | null): string {
  if (!code) return ''
  return INCOTERMS.find((i) => i.value === code)?.label ?? code
}
