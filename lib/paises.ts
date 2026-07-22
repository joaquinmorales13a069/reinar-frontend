// Códigos ISO 3166-1 alpha-2 oficialmente asignados (249). FacturaLlama exige
// este estándar en recipient.country del DTE 11 (FEX) — un código fuera de la
// lista provoca el rechazo del documento por MH. Debe coincidir con
// server/src/lib/paises.ts.
const CODIGOS_PAIS_ISO = [
  'AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ',
  'BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ',
  'CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ',
  'DE','DJ','DK','DM','DO','DZ',
  'EC','EE','EG','EH','ER','ES','ET',
  'FI','FJ','FK','FM','FO','FR',
  'GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY',
  'HK','HM','HN','HR','HT','HU',
  'ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT',
  'JE','JM','JO','JP',
  'KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ',
  'LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY',
  'MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ',
  'NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ',
  'OM',
  'PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PW','PY',
  'QA',
  'RE','RO','RS','RU','RW',
  'SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ',
  'TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ',
  'UA','UG','UM','US','UY','UZ',
  'VA','VC','VE','VG','VI','VN','VU',
  'WF','WS',
  'YE','YT',
  'ZA','ZM','ZW',
] as const

// Nombres en español vía Intl.DisplayNames (disponible en todos los browsers
// soportados y en Node) — evita mantener 249 traducciones a mano.
const nombreRegion = new Intl.DisplayNames(['es'], { type: 'region' })

export type Pais = { value: string; label: string }

export const PAISES: Pais[] = CODIGOS_PAIS_ISO
  .map((c) => ({ value: c, label: nombreRegion.of(c) ?? c }))
  .sort((a, b) => a.label.localeCompare(b.label, 'es'))

export const PAISES_CODIGOS: ReadonlySet<string> = new Set<string>(CODIGOS_PAIS_ISO)

export function resolverPais(code?: string | null): string {
  if (!code) return ''
  // Solo resolvemos códigos ISO conocidos; Intl.DisplayNames.of() lanza
  // RangeError con valores malformados, así que un código fuera del catálogo
  // se devuelve crudo en vez de romper el render (SSR).
  if (!PAISES_CODIGOS.has(code)) return code
  return nombreRegion.of(code) ?? code
}
