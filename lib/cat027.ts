// CAT-027 Recinto Fiscal. El `value` es el código que FacturaLlama acepta en
// `taxArea` del FEX. Son los 44 recintos que admite FacturaLlama (excluye
// 40/41/42/43 de los 48 MH). Debe coincidir con server/src/lib/cat027.ts.
export type RecintoFiscal = { value: string; label: string }

export const CAT027: RecintoFiscal[] = [
  { value: '01', label: 'Terrestre San Bartolo' },
  { value: '02', label: 'Marítima de Acajutla' },
  { value: '03', label: 'Aérea De Comalapa' },
  { value: '04', label: 'Terrestre Las Chinamas' },
  { value: '05', label: 'Terrestre La Hachadura' },
  { value: '06', label: 'Terrestre Santa Ana' },
  { value: '07', label: 'Terrestre San Cristóbal' },
  { value: '08', label: 'Terrestre Anguiatú' },
  { value: '09', label: 'Terrestre El Amatillo' },
  { value: '10', label: 'Marítima La Unión' },
  { value: '11', label: 'Terrestre El Poy' },
  { value: '12', label: 'Terrestre Metalío' },
  { value: '15', label: 'Fardos Postales' },
  { value: '16', label: 'Z.F. San Marcos' },
  { value: '17', label: 'Z.F. El Pedregal' },
  { value: '18', label: 'Z.F. San Bartolo' },
  { value: '20', label: 'Z.F. Exportsalva' },
  { value: '21', label: 'Z.F. American Park' },
  { value: '23', label: 'Z.F. Internacional' },
  { value: '24', label: 'Z.F. Diez' },
  { value: '26', label: 'Z.F. Miramar' },
  { value: '27', label: 'Z.F. Santo Tomas' },
  { value: '28', label: 'Z.F. Santa Tecla' },
  { value: '29', label: 'Z.F. Santa Ana' },
  { value: '30', label: 'Z.F. La Concordia' },
  { value: '31', label: 'Aérea Ilopango' },
  { value: '32', label: 'Z.F. Pipil' },
  { value: '33', label: 'Puerto Barillas' },
  { value: '34', label: 'Z.F. Calvo Conservas' },
  { value: '35', label: 'Feria Internacional' },
  { value: '36', label: 'Aduana El Papalón' },
  { value: '37', label: 'Z.F. Sam-Li' },
  { value: '38', label: 'Z.F. San José' },
  { value: '39', label: 'Z.F. Las Mercedes' },
  { value: '71', label: 'Aldesa' },
  { value: '72', label: 'Agdosa Merliot' },
  { value: '73', label: 'Bodesa' },
  { value: '76', label: 'Delegacion DHL' },
  { value: '77', label: 'Transauto' },
  { value: '80', label: 'Nejapa' },
  { value: '81', label: 'Almaconsa' },
  { value: '83', label: 'Agdosa Apopa' },
  { value: '85', label: 'Gutiérrez Courier Y Cargo' },
  { value: '99', label: 'San Bartolo Envío Hn/Gt' },
]

export const CAT027_CODIGOS: ReadonlySet<string> = new Set(CAT027.map((r) => r.value))

export function resolverRecinto(code?: string | null): string {
  if (!code) return ''
  return CAT027.find((r) => r.value === code)?.label ?? code
}
