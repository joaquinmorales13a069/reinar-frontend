# Emisión de Factura de Exportación (FEX / DTE 11) — Fase 2 — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emitir la Factura de Exportación (DTE 11) vía FacturaLlama (`POST /dte/fex`), levantando el bloqueo `FEX_NO_DISPONIBLE` de Fase 1, capturando los datos de exportación por operación, y cerrando el pendiente NC-contra-FEX.

**Architecture:** Se replica el molde de emisión existente (`emitirFC`) en un nuevo `emitirFEX`; los datos de exportación son columnas nullable en `Factura` que se capturan en el detalle de la factura antes de emitir. El polling de estado y las descargas oficiales ya son genéricos por `dteId`/`estadoDTE` y se reutilizan sin cambios. Spec: `docs/superpowers/specs/2026-07-22-emision-fex-fase2-design.md`.

**Tech Stack:** Backend Express + Prisma + Zod + vitest (`/Users/joaquinmorales13a06/Desktop/Reinar/server`). Frontend Next.js + React Hook Form + Zod + React Query + Tailwind + decimal.js (`/Users/joaquinmorales13a06/Desktop/Reinar/frontend`).

## Global Constraints

- **Dos repos git independientes.** Frontend ya está en la rama `feat/emision-fex-fase2` (con el spec y los assets committeados). El server crea su rama en la Task SV-1, Step 1. Los commits van al repo que corresponda.
- **Migración Prisma:** BD remota y COMPARTIDA — `migrate dev` SE CUELGA. Usar `migrate diff` offline + `migrate deploy` (flujo del Task SV-1). NUNCA `migrate reset`/`db push --force-reset`. Los cambios son aditivos (columnas nullable).
- **Baselines de verificación:** server vitest **14 fallos pre-existentes**; frontend lint **12 errores / 25 warnings** pre-existentes. Éxito = cero nuevos. Frontend sin suite de tests: verificación = `pnpm tsc --noEmit` + `pnpm lint`.
- **Fuentes de catálogo (verificadas):** los CSV en `docs/superpowers/assets/` del repo frontend: `cat-027-recinto-fiscal.csv` (48 filas `codigo,valor`), `cat-028-regimen.csv` (90 filas), `cat-031-incoterms.csv` (11 filas). Son la fuente de transcripción exacta de los `value` (códigos). Los `label` son display.
- **Incoterms:** el `value` almacenado/enviado es el **nombre del enum de FacturaLlama** (`EXW, FCA, CPT, CIP, DAP, DPU, DDP, FAS, FOB, CFR, CIF`), NO el código CAT-031. El label es la descripción en español.
- **Modalidad de transporte (enum FacturaLlama, 7 valores):** `TERRESTRE, MARITIMO, AEREO, TERRESTRE_MARITIMO, TERRESTRE_AEREO, MARITIMO_AEREO, TERRESTRE_MARITIMO_AEREO`.
- **Idioma:** UI, mensajes de error y comentarios 100% español. Solo comentarios tipo "why".
- **Tailwind:** solo clases predefinidas; sin valores arbitrarios; sin CSS vanilla en `globals.css`.
- **Montos:** el backend devuelve Decimal como string. En el frontend, `decimal.js` + `formatCurrency`; nunca `parseFloat`.
- **FacturaLlama config:** `env.FACTURALLAMA_{API_KEY,API_VERSION,BASE_URL}` ya existen. En tests se mockean con `FACTURALLAMA_BASE_URL: 'https://api.facturallama.com'`, `API_VERSION: '1'`, `API_KEY: 'test_sk_key'`.
- **El `recipient` FEX mapea desde campos que el cliente YA tiene** (codPais, tipoPersona, tamanoContribuyente, actividadEconomica, complemento, email, documento) — no se agrega dato de cliente.

---

### Task SV-1: Migración Prisma (server)

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/prisma/schema.prisma`
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/server/prisma/migrations/<timestamp>_datos_exportacion_fex/migration.sql`

**Interfaces:**
- Produces: `Factura` gana `recintoFiscal`, `regimenExportacion`, `incoterms`, `flete`, `seguro`, `transporteConductor`, `transporteDocConductor`, `transportePlaca`, `transporteModalidad` (todos nullable). `ConfiguracionEmpresa` gana `recintoFiscalDefault`, `regimenExportacionDefault` (nullable).

- [ ] **Step 1: Crear rama en el repo server**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git checkout main && git pull && git checkout -b feat/emision-fex-fase2
```

- [ ] **Step 2: Guardar el schema viejo para el diff offline**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git show HEAD:prisma/schema.prisma > /private/tmp/claude-501/-Users-joaquinmorales13a06-Desktop-Reinar-frontend/8f15565d-e2a8-4a56-8753-c7bc855f2531/scratchpad/schema-old-fase2.prisma
```

- [ ] **Step 3: Editar `prisma/schema.prisma`**

En el modelo `Factura`, después del bloque de campos DTE (`tipoDTE`/`estadoDTE`/`dteId`/`dteControlNumber`/`dteRespuestaMH`), agregar:

```prisma
  // Datos de exportación (solo FEX / DTE 11) — se capturan antes de emitir.
  // recintoFiscal/regimenExportacion validados contra CAT-027/CAT-028 en Zod;
  // incoterms y transporteModalidad son nombres del enum de FacturaLlama.
  recintoFiscal          String?
  regimenExportacion     String?
  incoterms              String?
  flete                  Decimal? @db.Decimal(10, 2)
  seguro                 Decimal? @db.Decimal(10, 2)
  transporteConductor    String?
  transporteDocConductor String?
  transportePlaca        String?
  transporteModalidad    String?
```

En el modelo `ConfiguracionEmpresa`, después de `porcentajeIvaDefault`, agregar:

```prisma
  // Defaults de exportación (FEX). El régimen se siembra a 1000.000
  // (Exportación Definitiva, Régimen Común); el recinto lo configura Reinar.
  recintoFiscalDefault      String?
  regimenExportacionDefault String?
```

- [ ] **Step 4: Validar y generar la migración offline**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
npx prisma validate
TS=$(date +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TS}_datos_exportacion_fex"
npx prisma migrate diff \
  --from-schema /private/tmp/claude-501/-Users-joaquinmorales13a06-Desktop-Reinar-frontend/8f15565d-e2a8-4a56-8753-c7bc855f2531/scratchpad/schema-old-fase2.prisma \
  --to-schema prisma/schema.prisma \
  --script > "prisma/migrations/${TS}_datos_exportacion_fex/migration.sql"
```

**IMPORTANTE:** abrir la `migration.sql` y borrar el ruido de stdout al inicio (`npm warn …`, `Loaded Prisma config …`) si aparece. El SQL esperado son solo `ALTER TABLE "Factura" ADD COLUMN …` (×9) y `ALTER TABLE "ConfiguracionEmpresa" ADD COLUMN …` (×2), todas nullable.

- [ ] **Step 5: Regenerar cliente y verificar tipos**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
npx prisma generate && npx tsc --noEmit
```
Expected: `tsc` sin errores nuevos (columnas nullable; nada las referencia aún).

- [ ] **Step 6: Aplicar y verificar**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
npx prisma migrate deploy && npx prisma migrate status
```
Expected: "Database schema is up to date!".

- [ ] **Step 7: Sembrar el régimen por defecto (dato)**

Actualizar la fila singleton de configuración con el régimen por defecto:

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
npx prisma db execute --stdin <<'SQL'
UPDATE "ConfiguracionEmpresa" SET "regimenExportacionDefault" = '1000.000' WHERE id = 'singleton' AND "regimenExportacionDefault" IS NULL;
SQL
```
Expected: sin error (0 o 1 filas afectadas).

- [ ] **Step 8: Commit (repo server)**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add prisma/ && git commit -m "feat(facturas): columnas de datos de exportación FEX + defaults de config

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task SV-2: Catálogos CAT-027 / CAT-028 / incoterms / transporte (server)

**Files:**
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/lib/cat027.ts`
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/lib/cat028.ts`
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/lib/incoterms.ts`
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/lib/transporte-fex.ts`
- Test: `/Users/joaquinmorales13a06/Desktop/Reinar/server/tests/lib/catalogos-fex.test.ts`

**Interfaces:**
- Produces: `CAT027_CODIGOS`, `CAT028_CODIGOS`, `INCOTERMS_CODIGOS`, `TRANSPORTE_FEX_CODIGOS` (todos `ReadonlySet<string>`), y los arrays `CAT027`, `CAT028`, `INCOTERMS`, `TRANSPORTE_FEX` (`{ value, label }[]`). Consumidos por SV-3 (validación), SV-5 (endpoint), y espejados en el frontend (FE-1).

- [ ] **Step 1: Escribir el test que falla**

```typescript
// tests/lib/catalogos-fex.test.ts
import { describe, it, expect } from 'vitest'
import { CAT027_CODIGOS } from '../../src/lib/cat027'
import { CAT028_CODIGOS } from '../../src/lib/cat028'
import { INCOTERMS_CODIGOS } from '../../src/lib/incoterms'
import { TRANSPORTE_FEX_CODIGOS } from '../../src/lib/transporte-fex'

describe('catálogos FEX', () => {
  it('CAT-027 tiene 48 recintos e incluye conocidos', () => {
    expect(CAT027_CODIGOS.size).toBe(48)
    for (const c of ['01', '02', '03', '18', '99']) expect(CAT027_CODIGOS.has(c)).toBe(true)
    expect(CAT027_CODIGOS.has('00')).toBe(false)
  })
  it('CAT-028 tiene 90 regímenes e incluye el común', () => {
    expect(CAT028_CODIGOS.size).toBe(90)
    expect(CAT028_CODIGOS.has('1000.000')).toBe(true)
    expect(CAT028_CODIGOS.has('9999.999')).toBe(false)
  })
  it('INCOTERMS tiene los 11 nombres de enum de FacturaLlama', () => {
    expect(INCOTERMS_CODIGOS.size).toBe(11)
    for (const c of ['EXW', 'FOB', 'CIF', 'DDP']) expect(INCOTERMS_CODIGOS.has(c)).toBe(true)
    expect(INCOTERMS_CODIGOS.has('DAT')).toBe(false) // obsoleto, no en los 11 vigentes
  })
  it('TRANSPORTE tiene las 7 modalidades de FacturaLlama', () => {
    expect(TRANSPORTE_FEX_CODIGOS.size).toBe(7)
    for (const c of ['TERRESTRE', 'MARITIMO', 'AEREO', 'TERRESTRE_MARITIMO_AEREO']) {
      expect(TRANSPORTE_FEX_CODIGOS.has(c)).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Verificar que falla**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx vitest run tests/lib/catalogos-fex.test.ts`
Expected: FAIL — módulos no existen.

- [ ] **Step 3: Crear `src/lib/incoterms.ts` (inline, 11 valores)**

```typescript
// Incoterms vigentes (CAT-031 MH). El `value` es el nombre del enum que
// FacturaLlama espera en el campo `incoterms` del payload FEX — NO el código
// numérico CAT-031. El label es la descripción en español.
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
```

- [ ] **Step 4: Crear `src/lib/transporte-fex.ts` (inline, 7 valores)**

```typescript
// Modalidad de transporte del anexo FEX. El `value` es el enum que FacturaLlama
// espera en attachments[].driver.transport.
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
```

- [ ] **Step 5: Crear `src/lib/cat027.ts` y `src/lib/cat028.ts` transcribiendo desde los CSV**

Leer los CSV fuente del repo frontend y transcribir cada fila a una entrada `{ value, label }`:
- `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/docs/superpowers/assets/cat-027-recinto-fiscal.csv` → `cat027.ts` (48 filas; formato de fila: `codigo,valor`, ej. `01,Terrestre San Bartolo`).
- `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/docs/superpowers/assets/cat-028-regimen.csv` → `cat028.ts` (90 filas, ej. `1000.000,"Exportación Definitiva, Régimen Común"`).

Estructura (idéntica en ambos, siguiendo el patrón de `src/lib/paises.ts`):

```typescript
// CAT-027 Recinto Fiscal (MH). El `value` es el código que FacturaLlama espera
// en taxArea del payload FEX. Transcrito de docs/superpowers/assets/cat-027-recinto-fiscal.csv.
export type RecintoFiscal = { value: string; label: string }

export const CAT027: RecintoFiscal[] = [
  { value: '01', label: 'Terrestre San Bartolo' },
  // … las 48 filas del CSV, en orden …
]

export const CAT027_CODIGOS: ReadonlySet<string> = new Set(CAT027.map((r) => r.value))
```

Para `cat028.ts` usar `type Regimen`, `export const CAT028`, `export const CAT028_CODIGOS`. **El `value` (código) debe copiarse EXACTO del CSV** — el label puede llevar el texto tal cual (respetar tildes). Verificá con el test (Step 6) que los conteos den 48 y 90.

- [ ] **Step 6: Verificar que pasa**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx vitest run tests/lib/catalogos-fex.test.ts`
Expected: PASS (4 tests). Si el conteo no da 48/90, revisá contra el CSV — NO cambies el número esperado.

- [ ] **Step 7: Commit (repo server)**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/lib/cat027.ts src/lib/cat028.ts src/lib/incoterms.ts src/lib/transporte-fex.ts tests/lib/catalogos-fex.test.ts
git commit -m "feat(lib): catálogos FEX (CAT-027, CAT-028, incoterms, transporte)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task SV-3: Tipos FEX + `emitirFEX` + validación previa (server)

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/facturallama/facturallama.types.ts`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/facturallama/facturallama.service.ts`
- Test: `/Users/joaquinmorales13a06/Desktop/Reinar/server/tests/modules/facturallama/facturallama-fex.service.test.ts`

**Interfaces:**
- Consumes: catálogos de SV-2; columnas de Factura de SV-1.
- Produces: `export async function emitirFEX(facturaId: string): Promise<void>` en `facturallama.service.ts`; tipos `RecipientFEX`, `ItemFEXPayload`, `DriverFEX`, `AttachmentFEX`, `PayloadFEX` en `facturallama.types.ts`; helper `buildItemsFex`. Consumidos por SV-4 (dispatch).

- [ ] **Step 1: Agregar tipos a `facturallama.types.ts`**

Al final del archivo (antes de `PayloadInvalidar` o después, da igual):

```typescript
// ─── FEX (Factura de Exportación, DTE 11) ──────────────────────────────────────

// A diferencia de FC/CCF, la dirección del receptor FEX es un STRING plano
// (≤300), no la estructura AddressPayload; y lleva country (ISO alpha-2).
export interface RecipientFEX {
  name: string
  country: string
  address: string
  contributorType: 'NATURAL' | 'JURIDICA'
  economicActivity: string
  identificationDocument: IdentificationDocumentPayload
  email: string
  commercialName?: string
  contributorSize?: 'GRANDE' | 'MEDIANO' | 'OTROS'
  phone?: string
}

// Los ítems FEX NO llevan saleType — la exportación va a tasa 0.
export interface ItemFEXPayload {
  type: 'BIENES' | 'SERVICIOS'
  description: string
  quantity: number
  unitPrice: number
}

export interface DriverFEX {
  name: string
  documentIdentificationNumber: string
  transportIdentificationNumber: string
  transport: string
}

export interface AttachmentFEX {
  code: 'TRANSPORTE'
  driver: DriverFEX
}

export interface PayloadFEX {
  id: string
  itemType: 'BIENES' | 'SERVICIOS' | 'BIENES_Y_SERVICIOS'
  items: ItemFEXPayload[]
  recipient: RecipientFEX
  generatedAt?: string
  paymentType?: 'CONTADO' | 'CREDITO' | 'OTRO'
  taxArea?: string
  taxRegimen?: string
  incoterms?: string
  freight?: number
  insurance?: number
  comments?: string
  attachments?: AttachmentFEX[]
}
```

- [ ] **Step 2: Escribir el test que falla (emitirFEX)**

Crear `tests/modules/facturallama/facturallama-fex.service.test.ts` siguiendo el patrón de `tests/modules/facturallama/facturallama.service.test.ts` (mock de `prisma` con `factura.findUnique`/`update`, mock de `env`, `vi.stubGlobal('fetch', vi.fn())`). Fixture de una factura FEX de cliente internacional:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/lib/prisma', () => ({
  prisma: { factura: { findUnique: vi.fn(), update: vi.fn() } },
}))
vi.mock('../../../src/config/env', () => ({
  env: { FACTURALLAMA_BASE_URL: 'https://api.facturallama.com', FACTURALLAMA_API_VERSION: '1', FACTURALLAMA_API_KEY: 'test_sk_key' },
}))

import { prisma } from '../../../src/lib/prisma'
import { emitirFEX } from '../../../src/modules/facturallama/facturallama.service'

const prismaMock = vi.mocked(prisma)

const FACTURA_FEX = {
  id: 'fac-fex-1',
  estadoDTE: 'PENDIENTE',
  tipoDTE: 'FEX',
  exentoIva: true,
  condicionPago: 'CONTADO',
  notas: null,
  periodoRentaInicio: new Date('2026-05-17'),
  periodoRentaFin: new Date('2026-06-16'),
  recintoFiscal: '01',
  regimenExportacion: '1000.000',
  incoterms: 'FOB',
  flete: '150.00',
  seguro: '50.00',
  transporteConductor: 'Juan Pérez',
  transporteDocConductor: '01234567-8',
  transportePlaca: 'P123-456',
  transporteModalidad: 'TERRESTRE',
  cotizacion: {
    condicionesPago: 'CONTADO',
    items: [{ tipo: 'EQUIPO', descripcion: 'Compactadora', cantidadUnidades: 2, cantidadDias: 30, periodo: 'MES', periodoCustomLabel: null, tarifaAplicada: '500.00' }],
  },
  cliente: {
    tipo: 'INTERNACIONAL', tipoPersona: 'JURIDICA', codPais: 'GT',
    razonSocial: 'Constructora Maya S.A.', nombre: null, apellido: null, nombreComercial: null,
    complemento: '5a Avenida 12-33, Zona 10, Ciudad de Guatemala',
    actividadEconomica: '41001', email: 'facturas@maya.gt', telefono: '+50255551234',
    tamanoContribuyente: 'GRANDE', tipoDocumento: 'OTRO', numeroDocumento: 'CF-778899', ncr: null,
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn())
})

describe('emitirFEX', () => {
  it('POST a /dte/fex con el recipient y datos de exportación correctos', async () => {
    prismaMock.factura.findUnique.mockResolvedValue(FACTURA_FEX as any)
    prismaMock.factura.update.mockResolvedValue({} as any)
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'dte-x', controlNumber: 'DTE-11-...', status: 'PROCESSING', mhResponse: {} }) } as any)

    await emitirFEX('fac-fex-1')

    // persiste dteId+tipoDTE antes, resultado después
    expect(prismaMock.factura.update).toHaveBeenCalledTimes(2)
    expect(prismaMock.factura.update.mock.calls[0][0].data).toMatchObject({ tipoDTE: 'FEX' })

    const [url, opts] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('https://api.facturallama.com/dte/fex')
    const body = JSON.parse((opts as any).body)
    expect(body.itemType).toBe('SERVICIOS')
    expect(body.taxArea).toBe('01')
    expect(body.taxRegimen).toBe('1000.000')
    expect(body.incoterms).toBe('FOB')
    expect(body.freight).toBe(150)
    expect(body.insurance).toBe(50)
    expect(body.recipient).toMatchObject({
      name: 'Constructora Maya S.A.', country: 'GT', contributorType: 'JURIDICA',
      address: '5a Avenida 12-33, Zona 10, Ciudad de Guatemala', economicActivity: '41001', email: 'facturas@maya.gt',
    })
    expect(body.recipient.identificationDocument).toMatchObject({ type: 'OTRO', number: 'CF-778899' })
    expect(body.items[0]).not.toHaveProperty('saleType')
    expect(body.attachments[0]).toMatchObject({ code: 'TRANSPORTE', driver: { name: 'Juan Pérez', transport: 'TERRESTRE', transportIdentificationNumber: 'P123-456' } })
  })

  it('rechaza si faltan datos de exportación (sin recinto)', async () => {
    prismaMock.factura.findUnique.mockResolvedValue({ ...FACTURA_FEX, recintoFiscal: null } as any)
    await expect(emitirFEX('fac-fex-1')).rejects.toMatchObject({ statusCode: 422, code: 'DATOS_EXPORTACION_REQUERIDOS' })
  })

  it('rechaza si el cliente no es elegible (sin codPais)', async () => {
    prismaMock.factura.findUnique.mockResolvedValue({ ...FACTURA_FEX, cliente: { ...FACTURA_FEX.cliente, codPais: null } } as any)
    await expect(emitirFEX('fac-fex-1')).rejects.toMatchObject({ statusCode: 422, code: 'CLIENTE_INVALIDO_FEX' })
  })
})
```

- [ ] **Step 3: Verificar que falla**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx vitest run tests/modules/facturallama/facturallama-fex.service.test.ts`
Expected: FAIL — `emitirFEX` no existe.

- [ ] **Step 4: Implementar `buildItemsFex` + `emitirFEX` en `facturallama.service.ts`**

Agregar los imports de tipos FEX al import existente de `./facturallama.types` (`RecipientFEX, ItemFEXPayload, AttachmentFEX, PayloadFEX`).

Después de `buildItems` (~línea 194), agregar:

```typescript
// Ítems FEX: mismo cálculo de unitPrice/description que buildItems, pero sin
// saleType (la exportación va a tasa 0 y el endpoint /dte/fex lo asume).
function buildItemsFex(items: Parameters<typeof buildItems>[0]): ItemFEXPayload[] {
  return buildItems(items, false).map(({ saleType, documentNumber, ...rest }) => ({
    type: rest.type === 'BIENES' ? 'BIENES' : 'SERVICIOS',
    description: rest.description,
    quantity: rest.quantity,
    unitPrice: rest.unitPrice,
  }))
}

// Deriva itemType del DTE FEX a partir de la clasificación MH de los ítems.
function derivarItemType(items: ItemFEXPayload[]): 'BIENES' | 'SERVICIOS' | 'BIENES_Y_SERVICIOS' {
  const tipos = new Set(items.map((i) => i.type))
  if (tipos.has('BIENES') && tipos.has('SERVICIOS')) return 'BIENES_Y_SERVICIOS'
  return tipos.has('BIENES') ? 'BIENES' : 'SERVICIOS'
}
```

Después de `emitirCCF` (~línea 411), agregar `emitirFEX`:

```typescript
export async function emitirFEX(facturaId: string): Promise<void> {
  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    include: { cotizacion: { include: { items: true } }, cliente: true },
  })
  if (!factura) throw new AppError(404, 'NOT_FOUND', 'Factura no encontrada')
  if (factura.estadoDTE !== 'PENDIENTE') throw new AppError(422, 'ESTADO_INVALIDO', `El DTE ya fue procesado (estado: ${factura.estadoDTE})`)
  if (!factura.periodoRentaInicio || !factura.periodoRentaFin) {
    throw new AppError(422, 'PERIODO_RENTA_REQUERIDO', 'La factura debe tener el período de renta registrado antes de emitir el DTE')
  }
  // taxArea/taxRegimen deben enviarse siempre (si se omiten, MH aprueba "con
  // observaciones"). Se exigen antes de emitir.
  if (!factura.recintoFiscal || !factura.regimenExportacion) {
    throw new AppError(422, 'DATOS_EXPORTACION_REQUERIDOS', 'Completá el recinto fiscal y el régimen de exportación antes de emitir la Factura de Exportación')
  }
  const c = factura.cliente
  const idDoc = buildIdentificationDocument(c)
  if (!c.codPais || !c.tipoPersona || !c.actividadEconomica || !c.email || !idDoc) {
    throw new AppError(422, 'CLIENTE_INVALIDO_FEX', 'El cliente internacional debe tener país, tipo de persona, actividad económica, documento y correo para emitir la Factura de Exportación')
  }

  const dteId = crypto.randomUUID()
  await prisma.factura.update({ where: { id: facturaId }, data: { dteId, tipoDTE: 'FEX' } })

  const telefonoLocal = telefonoLocalDte(c.telefono)
  const comercial = nombreComercialDte(c.nombreComercial)
  const nombrePersona = `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim()
  const recipient: RecipientFEX = {
    name: nombrePersona || c.razonSocial || '',
    country: c.codPais,
    address: c.complemento,
    contributorType: c.tipoPersona,
    economicActivity: c.actividadEconomica,
    identificationDocument: idDoc,
    email: c.email,
    ...(comercial ? { commercialName: comercial } : {}),
    ...(c.tamanoContribuyente ? { contributorSize: c.tamanoContribuyente } : {}),
    ...(telefonoLocal ? { phone: telefonoLocal } : {}),
  }

  const items = buildItemsFex(factura.cotizacion.items)

  // Transporte: solo se anexa si están los 4 datos del conductor (el endpoint
  // datos-exportacion los valida juntos, así que o vienen todos o ninguno).
  const attachments: AttachmentFEX[] = (factura.transporteConductor && factura.transporteDocConductor && factura.transportePlaca && factura.transporteModalidad)
    ? [{
        code: 'TRANSPORTE',
        driver: {
          name: factura.transporteConductor,
          documentIdentificationNumber: factura.transporteDocConductor,
          transportIdentificationNumber: factura.transportePlaca,
          transport: factura.transporteModalidad,
        },
      }]
    : []

  const payload: PayloadFEX = {
    id: dteId,
    itemType: derivarItemType(items),
    items,
    recipient,
    ...(() => {
      const paymentType = factura.condicionPago ?? factura.cotizacion.condicionesPago
      return paymentType ? { paymentType } : {}
    })(),
    taxArea: factura.recintoFiscal,
    taxRegimen: factura.regimenExportacion,
    ...(factura.incoterms ? { incoterms: factura.incoterms } : {}),
    ...(factura.flete ? { freight: Number(factura.flete) } : {}),
    ...(factura.seguro ? { insurance: Number(factura.seguro) } : {}),
    comments: buildComments({
      periodoRentaInicio: factura.periodoRentaInicio,
      periodoRentaFin:    factura.periodoRentaFin,
      notas:              factura.notas,
    }),
    ...(attachments.length ? { attachments } : {}),
  }

  const { status, data } = await facturaLlamaFetch<RespuestaEmisionDTE>('/dte/fex', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  await persistirResultadoFactura(facturaId, status, data)
}
```

- [ ] **Step 5: Verificar que pasa + tsc**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
npx tsc --noEmit && npx vitest run tests/modules/facturallama/facturallama-fex.service.test.ts
```
Expected: tsc limpio; 3 tests PASS.

- [ ] **Step 6: Commit (repo server)**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/modules/facturallama/ tests/modules/facturallama/facturallama-fex.service.test.ts
git commit -m "feat(facturallama): emitirFEX (DTE 11) y tipos de payload FEX

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task SV-4: Enganche de emisión FEX (server)

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/facturas/facturas.schemas.ts:58`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/facturas/facturas.service.ts` (`emitirDTE` ~275-314, `generarFacturaDesdeCotizacion` ~528-540)
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/pdf/pdf.service.ts:416`
- Test: agregar casos a `/Users/joaquinmorales13a06/Desktop/Reinar/server/tests/modules/facturas/facturas.service.test.ts`

**Interfaces:**
- Consumes: `emitirFEX` de SV-3.
- Produces: `emitirDTE` despacha FEX; `generarFacturaDesdeCotizacion` fuerza `exentoIva`/`montoIva=0` para receptor internacional; `emitirDTESchema` acepta FEX.

- [ ] **Step 1: Agregar casos al test de facturas**

En `tests/modules/facturas/facturas.service.test.ts`:

```typescript
describe('emitirDTE — FEX', () => {
  it('despacha a emitirFEX para una factura FEX con datos de exportación', async () => {
    ;(prismaMock.factura.findUnique as any).mockResolvedValue({
      id: 'f1', estado: 'PENDIENTE', estadoDTE: 'PENDIENTE', tipoDTE: 'FEX',
      periodoRentaInicio: new Date(), periodoRentaFin: new Date(),
      recintoFiscal: '01', regimenExportacion: '1000.000',
      cliente: { tipo: 'INTERNACIONAL' },
    })
    // emitirFEX está mockeado a nivel del módulo facturaLlamaService
    await emitirDTE('f1', { tipoDTE: 'FEX' } as any)
    expect(facturaLlamaServiceMock.emitirFEX).toHaveBeenCalledWith('f1')
  })

  it('rechaza emitir FEX sin datos de exportación', async () => {
    ;(prismaMock.factura.findUnique as any).mockResolvedValue({
      id: 'f2', estado: 'PENDIENTE', estadoDTE: 'PENDIENTE', tipoDTE: 'FEX',
      periodoRentaInicio: new Date(), periodoRentaFin: new Date(),
      recintoFiscal: null, regimenExportacion: null, cliente: { tipo: 'INTERNACIONAL' },
    })
    await expect(emitirDTE('f2', { tipoDTE: 'FEX' } as any)).rejects.toMatchObject({ statusCode: 422, code: 'DATOS_EXPORTACION_REQUERIDOS' })
  })
})
```
(Ajustá el nombre del mock de `facturaLlamaService` al que ya use el archivo; si no mockea `emitirFEX`, agregalo al `vi.mock` del módulo facturallama.)

- [ ] **Step 2: Verificar que falla**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx vitest run tests/modules/facturas/facturas.service.test.ts`
Expected: FAIL — hoy `emitirDTE` lanza `FEX_NO_DISPONIBLE`.

- [ ] **Step 3: Ampliar `emitirDTESchema`**

En `facturas.schemas.ts:58`: `tipoDTE: z.enum(['FC', 'CCF', 'FEX'])`.

- [ ] **Step 4: Reemplazar el guard `FEX_NO_DISPONIBLE` y agregar dispatch en `emitirDTE`**

En `facturas.service.ts`, reemplazar el bloque (actual líneas ~277-280):

```typescript
  if (factura.tipoDTE === 'FEX' || factura.cliente.tipo === 'INTERNACIONAL') {
    throw new AppError(422, 'FEX_NO_DISPONIBLE', 'La emisión de Factura de Exportación estará disponible próximamente')
  }
```

por un guard de datos de exportación:

```typescript
  // FEX: un cliente internacional solo admite Factura de Exportación. Se exige
  // el recinto y el régimen antes de emitir (defensa en profundidad; emitirFEX
  // lo repite). Los datos se cargan en el detalle de la factura.
  const esFex = factura.tipoDTE === 'FEX' || factura.cliente.tipo === 'INTERNACIONAL'
  if (esFex && (!factura.recintoFiscal || !factura.regimenExportacion)) {
    throw new AppError(422, 'DATOS_EXPORTACION_REQUERIDOS', 'Completá el recinto fiscal y el régimen de exportación antes de emitir la Factura de Exportación')
  }
```

En el dispatch (actual `if (input.tipoDTE === 'FC') … else … emitirCCF`), reemplazar por:

```typescript
  if (input.tipoDTE === 'FC') {
    await facturaLlamaService.emitirFC(id)
  } else if (input.tipoDTE === 'FEX') {
    await facturaLlamaService.emitirFEX(id)
  } else {
    await facturaLlamaService.emitirCCF(id)
  }
```

Nota: el guard de CCF (`ncr`/`actividadEconomica`) y el de período de renta quedan como están; el select de `findUnique` de `emitirDTE` debe incluir `recintoFiscal`/`regimenExportacion` — como usa `include: { cliente: true }` sin `select`, ya trae todas las columnas de Factura, así que no hay que tocar el query.

- [ ] **Step 5: Forzar `exentoIva` para receptor internacional en `generarFacturaDesdeCotizacion`**

En `facturas.service.ts`, en el `tx.factura.create` (~línea 528-540), reemplazar las líneas de IVA:

```typescript
        subtotal:              cotizacion.subtotal,
        porcentajeIva:         cotizacion.porcentajeIva,
        exentoIva:             cotizacion.exentoIva,
        montoIva:              cotizacion.montoIva,
        total:                 cotizacion.total,
```

por (usando la variable `tipoReceptor` que ya existe unas líneas arriba):

```typescript
        subtotal:              cotizacion.subtotal,
        porcentajeIva:         cotizacion.porcentajeIva,
        // La exportación (FEX) va a tasa 0: se fuerza exento y montoIva=0 para
        // que los totales de la factura coincidan con el DTE.
        exentoIva:             tipoReceptor === 'INTERNACIONAL' ? true : cotizacion.exentoIva,
        montoIva:              tipoReceptor === 'INTERNACIONAL' ? new Decimal(0) : cotizacion.montoIva,
        total:                 tipoReceptor === 'INTERNACIONAL' ? cotizacion.subtotal : cotizacion.total,
        saldoPendiente:        tipoReceptor === 'INTERNACIONAL' ? cotizacion.subtotal : cotizacion.total,
```

(Buscá y ajustá también `saldoPendiente` y `total` si aparecen en otra parte del mismo `create`; el objetivo es total = subtotal cuando es internacional.)

- [ ] **Step 6: Agregar FEX al mapa de etiquetas de PDF**

En `pdf.service.ts:416`, el record `{ FC:'CF', CCF:'CCF', SUJETO_EXCLUIDO:'SE', NC:'NC' }` → agregar `FEX: 'FEX'`.

- [ ] **Step 7: Verificar y commitear**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
npx tsc --noEmit && npx vitest run tests/modules/facturas/ tests/modules/facturallama/
git add src/modules/facturas/ src/modules/pdf/pdf.service.ts tests/modules/facturas/
git commit -m "feat(facturas): despachar emisión FEX y forzar IVA 0 para internacional

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
Expected: tsc limpio; tests PASS.

---

### Task SV-5: Endpoint `PATCH /facturas/:id/datos-exportacion` (server)

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/facturas/facturas.schemas.ts`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/facturas/facturas.service.ts`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/facturas/facturas.controller.ts`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/facturas/facturas.routes.ts`
- Test: agregar a `tests/modules/facturas/facturas.service.test.ts`

**Interfaces:**
- Consumes: catálogos de SV-2; columnas de SV-1.
- Produces: `guardarDatosExportacion(id, dto)` en el service; ruta `PATCH /facturas/:id/datos-exportacion`. Consumido por el frontend (FE-3).

- [ ] **Step 1: Schema `datosExportacionSchema` en `facturas.schemas.ts`**

Agregar (importando los Sets de catálogo):

```typescript
import { CAT027_CODIGOS } from '../../lib/cat027'
import { CAT028_CODIGOS } from '../../lib/cat028'
import { INCOTERMS_CODIGOS } from '../../lib/incoterms'
import { TRANSPORTE_FEX_CODIGOS } from '../../lib/transporte-fex'

const optStr = z.preprocess((v) => (v === '' ? undefined : v), z.string().optional())

export const datosExportacionSchema = z.object({
  recintoFiscal:      z.string().refine((c) => CAT027_CODIGOS.has(c), 'Recinto fiscal inválido (CAT-027)'),
  regimenExportacion: z.string().refine((c) => CAT028_CODIGOS.has(c), 'Régimen inválido (CAT-028)'),
  incoterms:          z.preprocess((v) => (v === '' ? undefined : v), z.string().refine((c) => INCOTERMS_CODIGOS.has(c), 'Incoterm inválido').optional()),
  flete:              z.number().min(0).optional(),
  seguro:             z.number().min(0).optional(),
  transporteConductor:    optStr,
  transporteDocConductor: optStr,
  transportePlaca:        optStr,
  transporteModalidad:    z.preprocess((v) => (v === '' ? undefined : v), z.string().refine((c) => TRANSPORTE_FEX_CODIGOS.has(c), 'Modalidad de transporte inválida').optional()),
}).superRefine((d, ctx) => {
  // Si se declara transporte, FacturaLlama exige los 4 datos del conductor
  // (nombre, documento, placas, modalidad) — se piden juntos o ninguno.
  const algunTransporte = d.transporteConductor || d.transporteDocConductor || d.transportePlaca || d.transporteModalidad
  if (algunTransporte) {
    if (!d.transporteConductor) ctx.addIssue({ code: 'custom', path: ['transporteConductor'], message: 'Nombre del conductor requerido' })
    if (!d.transporteDocConductor) ctx.addIssue({ code: 'custom', path: ['transporteDocConductor'], message: 'Documento del conductor requerido' })
    if (!d.transportePlaca) ctx.addIssue({ code: 'custom', path: ['transportePlaca'], message: 'Placas requeridas' })
    if (!d.transporteModalidad) ctx.addIssue({ code: 'custom', path: ['transporteModalidad'], message: 'Modalidad requerida' })
  }
})

export type DatosExportacionInput = z.infer<typeof datosExportacionSchema>
```

- [ ] **Step 2: Escribir el test que falla**

```typescript
describe('guardarDatosExportacion', () => {
  it('guarda recinto/régimen/incoterms en una factura FEX PENDIENTE', async () => {
    ;(prismaMock.factura.findUnique as any).mockResolvedValue({ id: 'f1', tipoDTE: 'FEX', estadoDTE: 'PENDIENTE' })
    ;(prismaMock.factura.update as any).mockResolvedValue({ id: 'f1' })
    await guardarDatosExportacion('f1', { recintoFiscal: '01', regimenExportacion: '1000.000', incoterms: 'FOB' } as any)
    expect((prismaMock.factura.update as any).mock.calls[0][0].data).toMatchObject({ recintoFiscal: '01', regimenExportacion: '1000.000', incoterms: 'FOB' })
  })
  it('rechaza si la factura no es FEX', async () => {
    ;(prismaMock.factura.findUnique as any).mockResolvedValue({ id: 'f1', tipoDTE: 'FC', estadoDTE: 'PENDIENTE' })
    await expect(guardarDatosExportacion('f1', { recintoFiscal: '01', regimenExportacion: '1000.000' } as any)).rejects.toMatchObject({ statusCode: 422 })
  })
})
```

- [ ] **Step 3: Verificar que falla**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx vitest run tests/modules/facturas/facturas.service.test.ts`
Expected: FAIL — `guardarDatosExportacion` no existe.

- [ ] **Step 4: Implementar `guardarDatosExportacion` en `facturas.service.ts`**

```typescript
export async function guardarDatosExportacion(id: string, input: DatosExportacionInput) {
  const factura = await prisma.factura.findUnique({ where: { id }, select: { id: true, tipoDTE: true, estadoDTE: true } })
  if (!factura) throw new AppError(404, 'NOT_FOUND', 'Factura no encontrada')
  if (factura.tipoDTE !== 'FEX') throw new AppError(422, 'TIPO_DTE_INVALIDO', 'Solo las facturas de exportación tienen datos de exportación')
  if (factura.estadoDTE !== 'PENDIENTE' && factura.estadoDTE !== 'RECHAZADO') {
    throw new AppError(422, 'ESTADO_INVALIDO', 'Los datos de exportación no se pueden editar tras emitir el DTE')
  }
  return prisma.factura.update({
    where: { id },
    data: {
      recintoFiscal:          input.recintoFiscal,
      regimenExportacion:     input.regimenExportacion,
      incoterms:              input.incoterms ?? null,
      flete:                  input.flete != null ? new Decimal(input.flete) : null,
      seguro:                 input.seguro != null ? new Decimal(input.seguro) : null,
      transporteConductor:    input.transporteConductor ?? null,
      transporteDocConductor: input.transporteDocConductor ?? null,
      transportePlaca:        input.transportePlaca ?? null,
      transporteModalidad:    input.transporteModalidad ?? null,
    },
    select: { id: true, recintoFiscal: true, regimenExportacion: true, incoterms: true, flete: true, seguro: true, transporteConductor: true, transporteDocConductor: true, transportePlaca: true, transporteModalidad: true },
  })
}
```
(Confirmá que `Decimal` ya está importado en el archivo — se usa en `generarFacturaDesdeCotizacion`.)

- [ ] **Step 5: Controller + ruta**

En `facturas.controller.ts`, agregar (siguiendo el patrón de los otros handlers):

```typescript
export async function guardarDatosExportacion(req: Request, res: Response) {
  const data = await facturasService.guardarDatosExportacion(req.params.id, req.body)
  res.json({ success: true, data })
}
```

En `facturas.routes.ts`, después de la línea 26 (`patch('/:id/dte', …)`):

```typescript
router.patch('/:id/datos-exportacion', authenticate, requireRol(...operadores), validate(datosExportacionSchema), ctrl.guardarDatosExportacion)
```
(Usá la misma constante `operadores` que la línea 26; importá `datosExportacionSchema` en el archivo de rutas donde se importan los otros schemas.)

- [ ] **Step 6: Verificar y commitear**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
npx tsc --noEmit && npx vitest run tests/modules/facturas/
git add src/modules/facturas/ tests/modules/facturas/
git commit -m "feat(facturas): endpoint PATCH datos-exportacion validado contra catálogos

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task SV-6: Defaults de exportación en Configuración (server)

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/configuracion/configuracion.schemas.ts`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/configuracion/configuracion.service.ts`
- Test: agregar a `tests/modules/configuracion/…` si existe, o al service test correspondiente.

**Interfaces:**
- Consumes: columnas de config de SV-1.
- Produces: `actualizarConfiguracionSchema` acepta `recintoFiscalDefault`/`regimenExportacionDefault`; `obtenerConfiguracion` los devuelve. Consumido por el frontend (FE-2/FE-4).

- [ ] **Step 1: Ampliar el schema**

En `configuracion.schemas.ts`, dentro de `actualizarConfiguracionSchema`, agregar antes del cierre:

```typescript
  recintoFiscalDefault:      z.preprocess((v) => (v === '' ? undefined : v), z.string().refine((c) => CAT027_CODIGOS.has(c), 'Recinto fiscal inválido (CAT-027)').optional()),
  regimenExportacionDefault: z.preprocess((v) => (v === '' ? undefined : v), z.string().refine((c) => CAT028_CODIGOS.has(c), 'Régimen inválido (CAT-028)').optional()),
```
Con los imports `import { CAT027_CODIGOS } from '../../lib/cat027'` y `import { CAT028_CODIGOS } from '../../lib/cat028'`.

- [ ] **Step 2: Verificar persistencia en el service**

`actualizarConfiguracion` (`configuracion.service.ts:36`) hace un `update` con el dto; confirmá que pasa los campos nuevos (si hace un spread del dto, ya funciona; si lista campos explícitos, agregar los dos). `obtenerConfiguracion` (línea 27) hace `findUnique`/`upsert` sin select restrictivo → ya devuelve los campos nuevos.

- [ ] **Step 3: Test**

```typescript
it('actualizar configuración acepta recinto/régimen default válidos', () => {
  const r = actualizarConfiguracionSchema.safeParse({ nombreEmpresa: 'Reinar', recintoFiscalDefault: '01', regimenExportacionDefault: '1000.000' })
  expect(r.success).toBe(true)
})
it('rechaza recinto default inválido', () => {
  const r = actualizarConfiguracionSchema.safeParse({ nombreEmpresa: 'Reinar', recintoFiscalDefault: 'ZZ' })
  expect(r.success).toBe(false)
})
```
(Ubicá el test en el archivo de tests de configuración; si no existe, crear `tests/modules/configuracion/configuracion.schemas.test.ts`.)

- [ ] **Step 4: Verificar y commitear**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
npx tsc --noEmit && npx vitest run tests/modules/configuracion/
git add src/modules/configuracion/ tests/modules/configuracion/
git commit -m "feat(configuracion): defaults de recinto fiscal y régimen de exportación

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task SV-7: Fix NC-contra-FEX (pendiente de Fase 1) (server)

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/facturallama/facturallama.service.ts` (guard ~524, contributorType ~578)
- Test: agregar a `tests/modules/facturallama/facturallama.service.test.ts`

**Interfaces:**
- Produces: `emitirNC` rechaza FEX (422 `NC_FEX_NO_SOPORTADA`); `contributorType` usa `cliente.tipoPersona`.

- [ ] **Step 1: Escribir el test que falla**

```typescript
it('emitirNC rechaza una NC contra una factura FEX', async () => {
  ;(prismaMock.notaCredito.findUnique as any).mockResolvedValue({
    id: 'nc1', tipo: 'TOTAL',
    factura: { estadoDTE: 'APROBADO', dteId: 'dte-orig', tipoDTE: 'FEX', cliente: { tipo: 'INTERNACIONAL' }, cotizacion: { items: [] } },
  })
  await expect(emitirNC('nc1')).rejects.toMatchObject({ statusCode: 422, code: 'NC_FEX_NO_SOPORTADA' })
})
```
(Ajustá el fixture al shape que `emitirNC` espera en el archivo.)

- [ ] **Step 2: Verificar que falla**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx vitest run tests/modules/facturallama/facturallama.service.test.ts`
Expected: FAIL — hoy FEX no se rechaza (pasa el guard y falla más adelante o arma un payload incorrecto).

- [ ] **Step 3: Agregar el guard FEX en `emitirNC`**

En `facturallama.service.ts`, el guard actual (líneas ~524-526):

```typescript
  if (!nc.factura.tipoDTE || nc.factura.tipoDTE === 'NC') {
    throw new AppError(422, 'ESTADO_INVALIDO', 'La factura original debe tener un tipoDTE valido (FC, CCF o SUJETO_EXCLUIDO)')
  }
```

Agregar inmediatamente después:

```typescript
  // Las NC contra Factura de Exportación (FEX / DTE 11) no están soportadas en
  // esta fase — requerirían el Evento de Retorno 2.0. Se bloquean explícitamente.
  if (nc.factura.tipoDTE === 'FEX') {
    throw new AppError(422, 'NC_FEX_NO_SOPORTADA', 'Las notas de crédito sobre facturas de exportación no están disponibles')
  }
```

- [ ] **Step 4: Corregir `contributorType` (~línea 578)**

Reemplazar:

```typescript
      contributorType: cliente.tipo === 'EMPRESA' ? 'JURIDICA' : 'NATURAL',
```

por (usa el dato real cuando existe; el fallback conserva el comportamiento previo):

```typescript
      contributorType: cliente.tipoPersona ?? (cliente.tipo === 'EMPRESA' ? 'JURIDICA' : 'NATURAL'),
```

- [ ] **Step 5: Verificar y commitear**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
npx tsc --noEmit && npx vitest run tests/modules/facturallama/ && npx vitest run
git add src/modules/facturallama/facturallama.service.ts tests/modules/facturallama/facturallama.service.test.ts
git commit -m "fix(facturallama): bloquear NC contra FEX y usar tipoPersona en contributorType

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
Expected: tsc limpio; suite completa con SOLO los 14 fallos baseline.

---

### Task FE-1: Catálogos FEX en el frontend

**Files:**
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/lib/cat027.ts`
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/lib/cat028.ts`
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/lib/incoterms.ts`
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/lib/transporte-fex.ts`

**Interfaces:**
- Produces: `CAT027`, `CAT028`, `INCOTERMS`, `TRANSPORTE_FEX` (`{ value, label }[]`), sus `*_CODIGOS: ReadonlySet<string>`, y `resolverRecinto`/`resolverRegimen`/`resolverIncoterm`/`resolverTransporte` (code→label). Consumidos por FE-3 (form) y el detalle.

- [ ] **Step 1: Crear los 4 archivos copiando VERBATIM los arrays del backend**

Para garantizar paridad exacta (el frontend no tiene tests), copiá el array `value/label` de cada catálogo desde el archivo homónimo del server:
- `server/src/lib/cat027.ts` → `frontend/lib/cat027.ts`
- `server/src/lib/cat028.ts` → `frontend/lib/cat028.ts`
- `server/src/lib/incoterms.ts` → `frontend/lib/incoterms.ts`
- `server/src/lib/transporte-fex.ts` → `frontend/lib/transporte-fex.ts`

Cada archivo del frontend agrega un helper resolver (patrón de `lib/paises.ts`), p. ej. en `cat027.ts`:

```typescript
export type RecintoFiscal = { value: string; label: string }
export const CAT027: RecintoFiscal[] = [ /* … verbatim del server … */ ]
export const CAT027_CODIGOS: ReadonlySet<string> = new Set(CAT027.map((r) => r.value))
export function resolverRecinto(code?: string | null): string {
  if (!code) return ''
  return CAT027.find((r) => r.value === code)?.label ?? code
}
```
Análogo para `cat028.ts` (`resolverRegimen`), `incoterms.ts` (`resolverIncoterm`), `transporte-fex.ts` (`resolverTransporte`).

- [ ] **Step 2: Verificar paridad y tipos**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit
# Paridad de códigos con el server (deben coincidir):
diff <(grep -oE "value: '[^']+'" lib/cat027.ts) <(grep -oE "value: '[^']+'" /Users/joaquinmorales13a06/Desktop/Reinar/server/src/lib/cat027.ts) && echo "CAT027 paridad OK"
diff <(grep -oE "value: '[^']+'" lib/cat028.ts) <(grep -oE "value: '[^']+'" /Users/joaquinmorales13a06/Desktop/Reinar/server/src/lib/cat028.ts) && echo "CAT028 paridad OK"
```
Expected: tsc limpio; ambos "paridad OK".

- [ ] **Step 3: Commit (repo frontend)**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add lib/cat027.ts lib/cat028.ts lib/incoterms.ts lib/transporte-fex.ts
git commit -m "feat(lib): catálogos FEX espejo del backend (recinto, régimen, incoterms, transporte)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task FE-2: Tipos y hooks (frontend)

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/types/api.ts`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/hooks/use-facturas.ts`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/hooks/use-configuracion.ts`

**Interfaces:**
- Produces: `DatosExportacion` type; `Factura` gana los campos de exportación; `TipoDTEEmitible` incluye `FEX`; `useGuardarDatosExportacion`. `Configuracion` gana `recintoFiscalDefault`/`regimenExportacionDefault`. Consumido por FE-3/FE-4.

- [ ] **Step 1: `types/api.ts`**

- `TipoDTEEmitible`: cambiar a `'FC' | 'CCF' | 'FEX'` (queda igual a `TipoDTEGenerable`).
- En el type `Factura` (y/o `FacturaDetalle` si existe), agregar los campos de exportación (todos opcionales/nullable):

```typescript
  recintoFiscal?: string | null;
  regimenExportacion?: string | null;
  incoterms?: string | null;
  flete?: string | null;
  seguro?: string | null;
  transporteConductor?: string | null;
  transporteDocConductor?: string | null;
  transportePlaca?: string | null;
  transporteModalidad?: string | null;
```
- Agregar el payload del PATCH:

```typescript
export type DatosExportacionInput = {
  recintoFiscal: string;
  regimenExportacion: string;
  incoterms?: string;
  flete?: number;
  seguro?: number;
  transporteConductor?: string;
  transporteDocConductor?: string;
  transportePlaca?: string;
  transporteModalidad?: string;
};
```
- En el type de configuración (buscar `Configuracion`/`ConfiguracionEmpresa`), agregar `recintoFiscalDefault?: string | null` y `regimenExportacionDefault?: string | null`.

- [ ] **Step 2: `hooks/use-facturas.ts` — mutation nueva**

```typescript
export function useGuardarDatosExportacion(facturaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DatosExportacionInput) =>
      api.patch<ApiResponse<Factura>>(`/facturas/${facturaId}/datos-exportacion`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['facturas', facturaId] });
    },
  });
}
```
(Ajustá los query keys al patrón real del archivo.)

- [ ] **Step 3: Verificar y commitear**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm tsc --noEmit && pnpm lint
git add types/api.ts hooks/use-facturas.ts hooks/use-configuracion.ts
git commit -m "feat(tipos): datos de exportación FEX y TipoDTEEmitible con FEX

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
Expected: tsc limpio (el cast `as TipoDTEEmitible` del detalle ahora es seguro para FEX); lint sin warnings nuevos.

---

### Task FE-3: Tarjeta "Datos de exportación" + desbloqueo de emisión (frontend)

**Files:**
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/facturas/detalle/DatosExportacionCard.tsx`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/app/(dashboard)/facturas/[id]/page.tsx`

**Interfaces:**
- Consumes: catálogos FE-1; `useGuardarDatosExportacion`, `DatosExportacionInput`, `Factura` de FE-2.
- Produces: la tarjeta de datos de exportación (solo FEX) y el desbloqueo de la emisión FEX.

- [ ] **Step 1: Crear `DatosExportacionCard.tsx`**

Componente `'use client'` con React Hook Form + Zod (patrón de los otros cards de `components/facturas/detalle/`). Campos: select de recinto (`CAT027`, default `factura.recintoFiscal ?? config?.recintoFiscalDefault`), select de régimen (`CAT028`, default `factura.regimenExportacion ?? config?.regimenExportacionDefault ?? '1000.000'`), select de incoterms (`INCOTERMS`, opcional), inputs de flete y seguro (numéricos), y una sub-sección "Transporte (opcional)" con conductor, documento, placas, y select de modalidad (`TRANSPORTE_FEX`). Al enviar, llama `useGuardarDatosExportacion(factura.id).mutate(...)`, `toast.success('Datos de exportación guardados.')` en onSuccess, y errores del backend inline con `setError`. Solo editable si `factura.estadoDTE === 'PENDIENTE' || 'RECHAZADO'`; si ya se emitió, mostrar los datos en modo lectura. Props: `{ factura, puedeEscribir }`. Usar clases Tailwind predefinidas (mirar `ClienteFechasCard.tsx`/`ObservacionesCard.tsx` para el estilo de card).

- [ ] **Step 2: Montar la tarjeta en el detalle (solo FEX) y desbloquear emisión**

En `app/(dashboard)/facturas/[id]/page.tsx`:
- Importar `DatosExportacionCard`.
- Renderizarla en la columna principal (junto a `ClienteFechasCard`/`ObservacionesCard`) **solo cuando** `factura.tipoDTE === 'FEX'`.
- Cambiar `emisionBloqueada`: hoy es `factura.tipoDTE === 'SUJETO_EXCLUIDO' || factura.tipoDTE === 'FEX'`. Pasa a: `factura.tipoDTE === 'SUJETO_EXCLUIDO'` (FEX ya NO se bloquea).
- Los guards `factura.tipoDTE !== 'SUJETO_EXCLUIDO' && factura.tipoDTE !== 'FEX'` en `onEmitir`/`onReemitir` (agregados en Fase 1): quitar el `&& factura.tipoDTE !== 'FEX'` para que FEX emita. `emitirCon(factura.tipoDTE)` ahora acepta FEX porque `TipoDTEEmitible` lo incluye (FE-2).
- Agregar un guard de UX: si `factura.tipoDTE === 'FEX'` y faltan `recintoFiscal`/`regimenExportacion`, deshabilitar el botón Emitir y mostrar un texto guía ("Completá los datos de exportación antes de emitir"). Reutilizar el patrón `faltaPeriodo` existente (ya hay un `faltaPeriodo` que deshabilita por período faltante — agregar un `faltanDatosExportacion` análogo y combinarlos).

- [ ] **Step 3: Verificar y commitear**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm tsc --noEmit && pnpm lint
git add components/facturas/detalle/DatosExportacionCard.tsx "app/(dashboard)/facturas/[id]/page.tsx"
git commit -m "feat(facturas): tarjeta de datos de exportación y emisión FEX habilitada

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
Expected: tsc limpio; lint sin warnings nuevos.

---

### Task FE-4: Recinto/régimen por defecto en Ajustes (frontend)

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/ajustes/TabEmpresa.tsx`

**Interfaces:**
- Consumes: `CAT027`/`CAT028` (FE-1); el type de configuración con los defaults (FE-2).
- Produces: campos en Ajustes para configurar el recinto y régimen por defecto.

- [ ] **Step 1: Agregar los campos al formulario de empresa**

En `TabEmpresa.tsx`, agregar una sección "Exportación (FEX)" con un select de recinto fiscal (`CAT027`, con opción "— Sin configurar —") y un select de régimen (`CAT028`, default visible `1000.000`), ligados a `recintoFiscalDefault`/`regimenExportacionDefault` del formulario de configuración. Seguir el patrón de los otros campos del tab (React Hook Form, el mismo submit que ya guarda la config). Etiquetas y placeholder en español; solo Tailwind predefinido.

- [ ] **Step 2: Verificar y commitear**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm tsc --noEmit && pnpm lint
git add components/ajustes/TabEmpresa.tsx
git commit -m "feat(ajustes): configurar recinto fiscal y régimen de exportación por defecto

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task V-1: Verificación integral

**Files:** ninguno — solo verificación.

- [ ] **Step 1: Suites completas de ambos repos**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx tsc --noEmit && npx vitest run
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit && pnpm lint
```
Expected: server tsc limpio + vitest SOLO 14 fallos baseline; frontend tsc limpio + lint sin warnings nuevos (baseline 12/25).

- [ ] **Step 2: Prueba manual E2E (backend + frontend corriendo)**

1. Ajustes → configurar recinto fiscal por defecto.
2. Crear/usar un cliente internacional → cotización → aprobar → generar factura (FEX fijo). Verificar que la factura nace con IVA 0 (total = subtotal).
3. En el detalle de la factura FEX: la tarjeta "Datos de exportación" aparece; el botón Emitir está deshabilitado hasta completar recinto+régimen.
4. Completar datos de exportación (recinto default precargado, régimen 1000.000, incoterms FOB, flete/seguro, transporte) → guardar.
5. Emitir DTE → factura pasa a `PROCESANDO`.
6. Esperar/forzar el polling (o `POST /:id/dte/sincronizar` como ADMIN) → `APROBADO`.
7. Descargar PDF y JSON oficiales.
8. Verificar que FC/CCF de clientes nacionales siguen intactos (sin regresión).
9. Verificar que crear una NC contra la factura FEX se bloquea con mensaje claro.
10. Dark mode + viewport 768px en la tarjeta de exportación.

- [ ] **Step 3: Checklist CLAUDE.md pre-PR** (datos reales, errores inline, VISUALIZADOR sin escritura, PDFs, paginación, dark mode, tablet, toasts en mutations, sin CSS vanilla, comentarios "why" en español).
