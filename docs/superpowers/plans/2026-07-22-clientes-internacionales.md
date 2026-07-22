# Clientes Internacionales (Fase 1 de FEX) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar el tipo de cliente INTERNACIONAL (BD + API + UI) con todos los datos que FacturaLlama exige para el `recipient` de la Factura de Exportación (DTE 11), y bloquear la emisión FC/CCF para estos clientes.

**Architecture:** Tercer valor `INTERNACIONAL` en el enum `TipoCliente` con campos nuevos nullable en `Cliente` (Enfoque A del spec). El valor `FEX` se agrega a `TipoDTE`/`TipoDocumentoCotizacion` para etiquetar documentos, pero su emisión queda bloqueada (422 `FEX_NO_DISPONIBLE`) hasta la fase 2. Spec: `docs/superpowers/specs/2026-07-22-clientes-internacionales-design.md`.

**Tech Stack:** Backend Express + Prisma + Zod + vitest (`/Users/joaquinmorales13a06/Desktop/Reinar/server`). Frontend Next.js + React Hook Form + Zod + React Query + Tailwind (`/Users/joaquinmorales13a06/Desktop/Reinar/frontend`).

## Global Constraints

- **Dos repos git independientes.** Frontend ya está en la rama `feat/clientes-internacionales`; el server necesita crear la suya (Task 1, Step 1). Los commits van al repo que corresponda.
- **Migración Prisma:** la BD es remota y compartida — `migrate dev` SE CUELGA. Usar el flujo del Task 1 (`migrate diff` offline + `migrate deploy`). NUNCA `migrate reset` ni `db push --force-reset`.
- **Baselines de verificación:** server vitest tiene **14 fallos pre-existentes** y el lint del frontend **12/25 warnings pre-existentes**. Éxito = cero fallos/warnings NUEVOS.
- **Idioma:** UI, mensajes de error y comentarios 100 % en español. Solo comentarios tipo "why".
- **Tailwind:** solo clases predefinidas; sin valores arbitrarios (`h-[20px]` prohibido); sin CSS vanilla en `globals.css`.
- **Formularios:** errores del backend inline con `setError`, no toast. Mutations con `toast.success`/`toast.error`.
- **País:** estrictamente **ISO 3166-1 alpha-2** (249 códigos) — es lo único que FacturaLlama acepta en `recipient.country`.
- Frontend no tiene suite de tests: su verificación es `pnpm tsc --noEmit` + `pnpm lint`. El server sí usa TDD con vitest.
- `TipoDocumentoCliente` de Prisma ya tiene los 5 valores necesarios (`DUI/NIT/PASAPORTE/CARNET_RESIDENTE/OTRO`) — no se toca.

---

### Task 1: Migración Prisma (server)

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/prisma/schema.prisma`
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/server/prisma/migrations/<timestamp>_clientes_internacionales/migration.sql` (generado)

**Interfaces:**
- Produces: enum `TipoCliente` con `INTERNACIONAL`; enums nuevos `TipoPersonaCliente { NATURAL, JURIDICA }` y `TamanoContribuyente { GRANDE, MEDIANO, OTROS }`; `TipoDTE` y `TipoDocumentoCotizacion` con `FEX`; campos `Cliente.tipoPersona`, `Cliente.codPais`, `Cliente.tamanoContribuyente` (nullable); `Cliente.departamento` y `Cliente.municipio` nullable.

- [ ] **Step 1: Crear rama en el repo server**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git checkout main && git pull && git checkout -b feat/clientes-internacionales
```

- [ ] **Step 2: Guardar el schema viejo para el diff offline**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git show HEAD:prisma/schema.prisma > /private/tmp/claude-501/-Users-joaquinmorales13a06-Desktop-Reinar-frontend/8f15565d-e2a8-4a56-8753-c7bc855f2531/scratchpad/schema-old.prisma
```

- [ ] **Step 3: Editar `prisma/schema.prisma`**

En el enum `TipoCliente` (línea ~11) agregar `INTERNACIONAL`:

```prisma
enum TipoCliente {
  EMPRESA
  PARTICULAR
  INTERNACIONAL
}
```

Después de `EstadoCliente` (línea ~28) agregar los dos enums nuevos:

```prisma
// Naturaleza del cliente INTERNACIONAL — mapea a recipient.contributorType
// del DTE 11 (FEX) de FacturaLlama. No se reutiliza TipoPersonaProveedor
// para no acoplar clientes al naming del módulo de proveedores.
enum TipoPersonaCliente {
  NATURAL
  JURIDICA
}

// Tamaño del contribuyente extranjero — recipient.contributorSize del FEX.
enum TamanoContribuyente {
  GRANDE
  MEDIANO
  OTROS
}
```

En el enum `TipoDTE` (línea ~168) agregar `FEX` con comentario:

```prisma
enum TipoDTE {
  FC
  CCF
  NC
  // Se agrega para que Factura pueda almacenarlo; la emisión de DTE para sujeto excluido aún no está implementada
  SUJETO_EXCLUIDO
  // Factura de Exportación (DTE 11) — clientes INTERNACIONALES. La emisión
  // llega en la fase 2; en fase 1 solo etiqueta la factura y bloquea FC/CCF.
  FEX
}
```

En `TipoDocumentoCotizacion` (línea ~177) agregar `FEX`:

```prisma
enum TipoDocumentoCotizacion {
  CF
  CCF
  SUJETO_EXCLUIDO
  FEX
}
```

En el modelo `Cliente` (línea ~299): cambiar `departamento String` → `departamento String?` y `municipio String` → `municipio String?`, y después de `numeroDocumento`/`ncr` agregar:

```prisma
  // Datos de exportación (solo tipo INTERNACIONAL) — mapean al recipient del
  // DTE 11 (FEX): contributorType, country (ISO 3166-1 alpha-2) y
  // contributorSize. La dirección extranjera vive en `complemento`.
  tipoPersona         TipoPersonaCliente?
  codPais             String?
  tamanoContribuyente TamanoContribuyente?
```

- [ ] **Step 4: Validar y generar la migración offline**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
npx prisma validate
TS=$(date +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TS}_clientes_internacionales"
npx prisma migrate diff \
  --from-schema /private/tmp/claude-501/-Users-joaquinmorales13a06-Desktop-Reinar-frontend/8f15565d-e2a8-4a56-8753-c7bc855f2531/scratchpad/schema-old.prisma \
  --to-schema prisma/schema.prisma \
  --script > "prisma/migrations/${TS}_clientes_internacionales/migration.sql"
```

**IMPORTANTE:** abrir la `migration.sql` generada y **borrar el ruido de stdout** al inicio (`npm warn …`, `Loaded Prisma config …`) — si queda, la migración falla al aplicar. El SQL esperado contiene: `ALTER TYPE "TipoCliente" ADD VALUE 'INTERNACIONAL'`, `ALTER TYPE "TipoDTE" ADD VALUE 'FEX'`, `ALTER TYPE "TipoDocumentoCotizacion" ADD VALUE 'FEX'`, `CREATE TYPE "TipoPersonaCliente"`, `CREATE TYPE "TamanoContribuyente"`, `ALTER TABLE "Cliente" ... DROP NOT NULL` (departamento y municipio) y `ADD COLUMN` (tipoPersona, codPais, tamanoContribuyente).

- [ ] **Step 5: Regenerar cliente Prisma y verificar tipos**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
npx prisma generate && npx tsc --noEmit
```

Expected: `tsc` sin errores nuevos (los campos nuevos son nullable; nada existente los referencia todavía).

- [ ] **Step 6: Aplicar y verificar**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
npx prisma migrate deploy && npx prisma migrate status
```

Expected: `migrate status` termina con "Database schema is up to date!".

- [ ] **Step 7: Commit (repo server)**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add prisma/ && git commit -m "feat(clientes): tipo INTERNACIONAL + enums FEX en schema Prisma

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Catálogo de países ISO en el server

**Files:**
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/lib/paises.ts`
- Test: `/Users/joaquinmorales13a06/Desktop/Reinar/server/tests/lib/paises.test.ts`

**Interfaces:**
- Produces: `PAISES_CODIGOS: ReadonlySet<string>` — los 249 códigos ISO 3166-1 alpha-2 oficialmente asignados. Consumido por `clientes.schemas.ts` (Task 3).

- [ ] **Step 1: Escribir el test que falla**

```typescript
// tests/lib/paises.test.ts
import { describe, it, expect } from 'vitest'
import { PAISES_CODIGOS } from '../../src/lib/paises'

describe('PAISES_CODIGOS', () => {
  it('contiene los 249 códigos ISO 3166-1 alpha-2 asignados', () => {
    expect(PAISES_CODIGOS.size).toBe(249)
  })

  it('incluye países frecuentes para Reinar y El Salvador (zona franca)', () => {
    for (const c of ['US', 'GT', 'HN', 'SV', 'CR', 'NI', 'PA', 'MX']) {
      expect(PAISES_CODIGOS.has(c)).toBe(true)
    }
  })

  it('rechaza códigos no asignados o mal formados', () => {
    for (const c of ['XX', 'ZZ', 'sv', 'USA', '']) {
      expect(PAISES_CODIGOS.has(c)).toBe(false)
    }
  })
})
```

- [ ] **Step 2: Verificar que falla**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx vitest run tests/lib/paises.test.ts`
Expected: FAIL — "Cannot find module '../../src/lib/paises'".

- [ ] **Step 3: Implementar `src/lib/paises.ts`**

```typescript
// Códigos ISO 3166-1 alpha-2 oficialmente asignados (249). FacturaLlama exige
// este estándar en recipient.country del DTE 11 (FEX) — un código fuera de la
// lista provoca el rechazo del documento por MH.
export const CODIGOS_PAIS_ISO = [
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

export const PAISES_CODIGOS: ReadonlySet<string> = new Set(CODIGOS_PAIS_ISO)
```

- [ ] **Step 4: Verificar que pasa**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx vitest run tests/lib/paises.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit (repo server)**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/lib/paises.ts tests/lib/paises.test.ts
git commit -m "feat(lib): catálogo de códigos de país ISO 3166-1 alpha-2

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Rama INTERNACIONAL en el schema Zod de clientes (server)

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/clientes/clientes.schemas.ts`
- Test: `/Users/joaquinmorales13a06/Desktop/Reinar/server/tests/modules/clientes/clientes.schemas.test.ts` (nuevo)

**Interfaces:**
- Consumes: `PAISES_CODIGOS` de `../../lib/paises` (Task 2).
- Produces: `crearClienteSchema`/`actualizarClienteSchema` aceptan la variante `{ tipo: 'INTERNACIONAL', tipoPersona, codPais, complemento, actividadEconomica, tipoDocumento, numeroDocumento, email, telefono?, tamanoContribuyente?, nombre?, apellido?, razonSocial?, nombreComercial?, notas? }`. `CrearClienteDto`/`ActualizarClienteDto` pasan a ser uniones de 3 miembros — Task 4 depende de esto.

- [ ] **Step 1: Escribir los tests que fallan**

```typescript
// tests/modules/clientes/clientes.schemas.test.ts
import { describe, it, expect } from 'vitest'
import { crearClienteSchema } from '../../../src/modules/clientes/clientes.schemas'

const baseInternacional = {
  tipo: 'INTERNACIONAL' as const,
  tipoPersona: 'JURIDICA' as const,
  razonSocial: 'Constructora Maya S.A.',
  codPais: 'GT',
  complemento: '5a Avenida 12-33, Zona 10, Ciudad de Guatemala',
  actividadEconomica: '41001',
  tipoDocumento: 'OTRO' as const,
  numeroDocumento: 'CF-778899',
  email: 'facturas@maya.gt',
}

describe('crearClienteSchema — INTERNACIONAL', () => {
  it('acepta una jurídica válida con todos los datos FEX', () => {
    const r = crearClienteSchema.safeParse(baseInternacional)
    expect(r.success).toBe(true)
  })

  it('acepta una natural válida con nombre', () => {
    const r = crearClienteSchema.safeParse({
      ...baseInternacional,
      tipoPersona: 'NATURAL',
      razonSocial: undefined,
      nombre: 'Carlos',
      apellido: 'Reyes',
      tipoDocumento: 'PASAPORTE',
      numeroDocumento: 'A12345678',
    })
    expect(r.success).toBe(true)
  })

  it('rechaza jurídica sin razón social', () => {
    const r = crearClienteSchema.safeParse({ ...baseInternacional, razonSocial: undefined })
    expect(r.success).toBe(false)
  })

  it('rechaza natural sin nombre', () => {
    const r = crearClienteSchema.safeParse({
      ...baseInternacional,
      tipoPersona: 'NATURAL',
      razonSocial: undefined,
    })
    expect(r.success).toBe(false)
  })

  it('rechaza código de país fuera de ISO 3166-1 alpha-2', () => {
    for (const codPais of ['XX', 'gt', 'GTM', '']) {
      const r = crearClienteSchema.safeParse({ ...baseInternacional, codPais })
      expect(r.success).toBe(false)
    }
  })

  it('rechaza sin actividad económica o con código CAT-019 inválido', () => {
    expect(crearClienteSchema.safeParse({ ...baseInternacional, actividadEconomica: undefined }).success).toBe(false)
    expect(crearClienteSchema.safeParse({ ...baseInternacional, actividadEconomica: '99999999' }).success).toBe(false)
  })

  it('rechaza sin email, sin documento o con dirección de más de 300 caracteres', () => {
    expect(crearClienteSchema.safeParse({ ...baseInternacional, email: undefined }).success).toBe(false)
    expect(crearClienteSchema.safeParse({ ...baseInternacional, numeroDocumento: undefined }).success).toBe(false)
    expect(crearClienteSchema.safeParse({ ...baseInternacional, complemento: 'x'.repeat(301) }).success).toBe(false)
  })

  it('valida el formato del documento según su tipo (NIT malformado)', () => {
    const r = crearClienteSchema.safeParse({ ...baseInternacional, tipoDocumento: 'NIT', numeroDocumento: '123' })
    expect(r.success).toBe(false)
  })

  it('descarta campos no aplicables (ncr, departamento, manejaQuedan)', () => {
    const r = crearClienteSchema.safeParse({
      ...baseInternacional,
      ncr: '9166-9',
      departamento: '06',
      manejaQuedan: true,
    })
    expect(r.success).toBe(true)
    if (r.success && r.data.tipo === 'INTERNACIONAL') {
      expect('ncr' in r.data).toBe(false)
      expect('departamento' in r.data).toBe(false)
      expect('manejaQuedan' in r.data).toBe(false)
    }
  })
})
```

- [ ] **Step 2: Verificar que fallan**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx vitest run tests/modules/clientes/clientes.schemas.test.ts`
Expected: FAIL — la discriminated union no tiene rama INTERNACIONAL ("Invalid discriminator value").

- [ ] **Step 3: Implementar la rama en `clientes.schemas.ts`**

Cambiar la línea 2 de imports para incluir los enums nuevos:

```typescript
import { TipoCliente, EstadoCliente, TipoDocumentoCliente, TipoPersonaCliente, TamanoContribuyente } from '@prisma/client'
import { PAISES_CODIGOS } from '../../lib/paises'
```

Después de `particularFields` (línea ~73) agregar:

```typescript
// Cliente INTERNACIONAL: receptor de Factura de Exportación (DTE 11). Todos
// los campos que FacturaLlama exige en el recipient del FEX son obligatorios
// al crear (decisión del spec) — así un cliente guardado siempre es emitible.
// No comparte camposCompartidos: la dirección extranjera es texto libre en
// `complemento` (ISO país + address ≤300), sin departamento/municipio/NCR/QUEDAN.
const internacionalFields = {
  tipo: z.literal('INTERNACIONAL'),
  tipoPersona: z.nativeEnum(TipoPersonaCliente),
  nombre: z.string().optional(),
  apellido: z.string().optional(),
  ocupacion: z.string().optional(),
  razonSocial: z.string().optional(),
  nombreComercial: z.string().optional(),
  sector: z.string().optional(),
  codPais: z.string().refine((c) => PAISES_CODIGOS.has(c), 'Código de país inválido (ISO 3166-1 alpha-2)'),
  complemento: z.string().min(1, 'La dirección es requerida').max(300, 'La dirección no puede superar 300 caracteres'),
  actividadEconomica: z.string().refine((c) => CAT019_CODIGOS.has(c), 'Código de actividad económica inválido (CAT-019)'),
  tipoDocumento: z.nativeEnum(TipoDocumentoCliente),
  numeroDocumento: z.string().min(1, 'Ingresá el número del documento'),
  email: z.string().email('Email inválido'),
  // FacturaLlama limita phone a 8–25 caracteres; el frontend guarda +503XXXXXXXX.
  telefono: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(8, 'Teléfono muy corto').max(25, 'Teléfono muy largo').optional(),
  ),
  tamanoContribuyente: z.nativeEnum(TamanoContribuyente).optional(),
  notas: z.string().optional(),
}

const validarInternacional = (
  d: { tipoPersona: TipoPersonaCliente; nombre?: string; razonSocial?: string; tipoDocumento: TipoDocumentoCliente; numeroDocumento: string },
  ctx: z.RefinementCtx,
) => {
  if (d.tipoPersona === 'NATURAL' && !d.nombre?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['nombre'], message: 'El nombre es requerido' })
  }
  if (d.tipoPersona === 'JURIDICA' && !d.razonSocial?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['razonSocial'], message: 'La razón social es requerida' })
  }
  const regex = FORMATO_POR_TIPO_DOCUMENTO[d.tipoDocumento]
  if (!regex.test(d.numeroDocumento)) {
    ctx.addIssue({ code: 'custom', path: ['numeroDocumento'], message: MENSAJE_FORMATO[d.tipoDocumento] })
  }
}
```

Reemplazar ambas discriminated unions (líneas ~101-109) para agregar la tercera rama:

```typescript
export const crearClienteSchema = z.discriminatedUnion('tipo', [
  z.object(empresaFields).superRefine((d, ctx) => { validarDocumento(d, ctx); validarTipoEmpresa(d, ctx) }),
  z.object(particularFields).superRefine(validarDocumento),
  z.object(internacionalFields).superRefine(validarInternacional),
])

export const actualizarClienteSchema = z.discriminatedUnion('tipo', [
  z.object(empresaFields).superRefine((d, ctx) => { validarDocumento(d, ctx); validarTipoEmpresa(d, ctx) }),
  z.object(particularFields).superRefine(validarDocumento),
  z.object(internacionalFields).superRefine(validarInternacional),
])
```

- [ ] **Step 4: Verificar que pasan**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx vitest run tests/modules/clientes/clientes.schemas.test.ts`
Expected: PASS (9 tests). Nota: `npx tsc --noEmit` todavía FALLA en `clientes.service.ts` (accesos a `dto.ncr`/`dto.manejaQuedan` sobre la unión ampliada) — se arregla en Task 4; no commitear tsc roto sin avisar: el commit de este task incluye solo schema+test y el service se arregla en el commit siguiente inmediato. Si se prefiere atomicidad, ejecutar Task 3 y Task 4 y commitear juntos.

- [ ] **Step 5: Commit (repo server) — junto con Task 4 si tsc falla**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/modules/clientes/clientes.schemas.ts tests/modules/clientes/clientes.schemas.test.ts
git commit -m "feat(clientes): rama INTERNACIONAL en schemas Zod con validación FEX

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `clientes.service.ts` — persistencia y coherencia (server)

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/clientes/clientes.service.ts`
- Test: `/Users/joaquinmorales13a06/Desktop/Reinar/server/tests/modules/clientes/clientes.service.test.ts` (agregar casos)

**Interfaces:**
- Consumes: `CrearClienteDto` unión de 3 miembros (Task 3); campos Prisma `tipoPersona`, `codPais`, `tamanoContribuyente` (Task 1).
- Produces: `crearCliente`/`actualizarCliente` aceptan la variante INTERNACIONAL; los SELECT devuelven los campos nuevos (el frontend los lee en Tasks 8-10).

- [ ] **Step 1: Agregar casos al test existente**

En `tests/modules/clientes/clientes.service.test.ts`, junto a `dtoEmpresa`/`dtoParticular` agregar:

```typescript
const dtoInternacional = {
  tipo: 'INTERNACIONAL' as const,
  tipoPersona: 'JURIDICA' as const,
  razonSocial: 'Constructora Maya S.A.',
  codPais: 'GT',
  complemento: '5a Avenida 12-33, Zona 10',
  actividadEconomica: '41001',
  tipoDocumento: 'OTRO' as const,
  numeroDocumento: 'CF-778899',
  email: 'facturas@maya.gt',
}
```

Y dentro del `describe('crearCliente', ...)` existente (siguiendo el patrón de mocks del archivo — `$transaction` con callback y `tx` mockeado igual que los casos vecinos):

```typescript
it('crea un cliente INTERNACIONAL con días QUEDAN vacíos', async () => {
  ;(prismaMock.cliente.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  ;(prismaMock.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (cb: any) => cb(prismaMock))
  ;(prismaMock.cliente.create as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockCliente, id: 'cli-int', tipo: 'INTERNACIONAL' })

  await crearCliente(dtoInternacional as any, 'user-1')

  const createArgs = (prismaMock.cliente.create as ReturnType<typeof vi.fn>).mock.calls[0][0]
  expect(createArgs.data.diasRecepcionQuedan).toEqual([])
  expect(createArgs.data.codPais).toBe('GT')
  expect(createArgs.data.tipoPersona).toBe('JURIDICA')
})
```

- [ ] **Step 2: Verificar que falla**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx vitest run tests/modules/clientes/clientes.service.test.ts`
Expected: FAIL — error de compilación TS o `diasRecepcionQuedan` undefined (la rama internacional no tiene `manejaQuedan`).

- [ ] **Step 3: Adaptar el service a la unión de 3 miembros**

En `SELECT_CLIENTE_LISTA` (línea ~6) agregar los campos nuevos después de `ncr: true,`:

```typescript
  tipoPersona: true,
  codPais: true,
  tamanoContribuyente: true,
```

En `verificarUnicidadCliente` (línea ~90) el acceso a `dto.ncr` ya no compila — la rama internacional no tiene `ncr`:

```typescript
  // La rama INTERNACIONAL no tiene ncr (un no domiciliado no tiene NRC).
  if ('ncr' in dto && dto.ncr) {
    const dupNcr = await prisma.cliente.findFirst({ where: { ncr: dto.ncr, ...exclude } })
    if (dupNcr) throw new AppError(409, 'CONFLICT', 'El NCR ya está registrado')
  }
```

En `crearCliente` (línea ~100), el `data` del create:

```typescript
    const cliente = await tx.cliente.create({
      // Coherencia: sin manejaQuedan los días de recepción no tienen sentido.
      // INTERNACIONAL no maneja QUEDAN (práctica local de facturación física).
      data: {
        ...dto,
        diasRecepcionQuedan: dto.tipo !== 'INTERNACIONAL' && dto.manejaQuedan ? dto.diasRecepcionQuedan : [],
      } as Prisma.ClienteCreateInput,
      select: SELECT_CLIENTE_DETALLE,
    })
```

En el `camposDespues` del auditLog de `crearCliente` (línea ~112):

```typescript
        camposDespues: dto.tipo === 'EMPRESA'
          ? { tipo: dto.tipo, razonSocial: dto.razonSocial, tipoDocumento: dto.tipoDocumento, numeroDocumento: dto.numeroDocumento }
          : dto.tipo === 'INTERNACIONAL'
            ? { tipo: dto.tipo, tipoPersona: dto.tipoPersona, razonSocial: dto.razonSocial ?? null, nombre: dto.nombre ?? null, codPais: dto.codPais, tipoDocumento: dto.tipoDocumento, numeroDocumento: dto.numeroDocumento }
            : { tipo: dto.tipo, nombre: dto.nombre, tipoDocumento: dto.tipoDocumento, numeroDocumento: dto.numeroDocumento },
```

En `actualizarCliente` (línea ~132), mismo patrón de coherencia:

```typescript
  const { tipo, ...updateData } = {
    ...dto,
    // Coherencia: sin manejaQuedan los días de recepción no tienen sentido.
    diasRecepcionQuedan: dto.tipo !== 'INTERNACIONAL' && dto.manejaQuedan ? dto.diasRecepcionQuedan : [],
  }
```

- [ ] **Step 4: Verificar que pasa todo**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
npx tsc --noEmit && npx vitest run tests/modules/clientes/
```
Expected: tsc limpio; tests de clientes PASS (los pre-existentes + el nuevo).

- [ ] **Step 5: Commit (repo server)**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/modules/clientes/ tests/modules/clientes/
git commit -m "feat(clientes): persistencia de cliente INTERNACIONAL en el service

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Cotizaciones — auto-asignar FEX y rechazar CF/CCF (server)

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/cotizaciones/cotizaciones.service.ts` (funciones `crearCotizacion` ~línea 152 y `actualizarCotizacion` ~línea 330)
- Test: `/Users/joaquinmorales13a06/Desktop/Reinar/server/tests/modules/cotizaciones/cotizaciones.service.test.ts` (agregar casos)

**Interfaces:**
- Consumes: `TipoCliente.INTERNACIONAL` y `TipoDocumentoCotizacion.FEX` (Task 1).
- Produces: cotización de cliente internacional siempre nace/queda con `tipoDocumentoFiscal = 'FEX'`; enviar `CF`/`CCF` para ese cliente → `AppError(422, 'TIPO_DOCUMENTO_INVALIDO', …)`. El schema Zod (`z.enum(['CF','CCF'])`) NO cambia — FEX nunca lo elige el usuario, lo asigna el service.

- [ ] **Step 1: Agregar casos al test de cotizaciones**

Siguiendo el patrón de mocks del archivo existente (mock de `prisma` + `$transaction`), agregar:

```typescript
describe('crearCotizacion — cliente INTERNACIONAL (FEX)', () => {
  it('auto-asigna tipoDocumentoFiscal FEX', async () => {
    ;(prismaMock.cliente.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ tipo: 'INTERNACIONAL' })
    // …mocks de $transaction/generarNumero según el patrón del archivo…
    await crearCotizacion({ clienteId: 'cli-int' } as any, 'user-1')
    const createArgs = (prismaMock.cotizacion.create as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(createArgs.data.tipoDocumentoFiscal).toBe('FEX')
  })

  it('rechaza CF/CCF explícito para cliente internacional', async () => {
    ;(prismaMock.cliente.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ tipo: 'INTERNACIONAL' })
    await expect(
      crearCotizacion({ clienteId: 'cli-int', tipoDocumentoFiscal: 'CCF' } as any, 'user-1'),
    ).rejects.toMatchObject({ statusCode: 422, code: 'TIPO_DOCUMENTO_INVALIDO' })
  })
})
```

Si el archivo de test de cotizaciones no mockea `prisma.cliente`, agregar `cliente: { findUnique: vi.fn() }` al `vi.mock` del prisma.

- [ ] **Step 2: Verificar que fallan**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx vitest run tests/modules/cotizaciones/`
Expected: FAIL — hoy `crearCotizacion` no consulta el cliente ni asigna FEX.

- [ ] **Step 3: Implementar en `crearCotizacion`**

Al inicio de `crearCotizacion` (antes del `$transaction`, ~línea 172):

```typescript
  // Cliente INTERNACIONAL solo admite Factura de Exportación (regla "solo
  // FEX"): el tipo fiscal se asigna automáticamente y CF/CCF se rechaza.
  const clienteDoc = await prisma.cliente.findUnique({
    where: { id: data.clienteId },
    select: { tipo: true },
  })
  if (!clienteDoc) throw new AppError(404, 'NOT_FOUND', 'Cliente no encontrado')
  let tipoDocumentoFiscal = data.tipoDocumentoFiscal
  if (clienteDoc.tipo === 'INTERNACIONAL') {
    if (data.tipoDocumentoFiscal) {
      throw new AppError(422, 'TIPO_DOCUMENTO_INVALIDO', 'Un cliente internacional solo admite Factura de Exportación (FEX); el tipo se asigna automáticamente')
    }
    tipoDocumentoFiscal = 'FEX'
  }
```

Y en el `tx.cotizacion.create` cambiar `tipoDocumentoFiscal: data.tipoDocumentoFiscal,` → `tipoDocumentoFiscal,`.

- [ ] **Step 4: Implementar en `actualizarCotizacion`**

El select existente (~línea 349) pasa a `select: { estado: true, total: true, clienteId: true, tipoDocumentoFiscal: true }`. Antes del `$transaction`:

```typescript
  // El cliente final (nuevo o el ya asociado) manda sobre el tipo fiscal:
  // internacional fuerza FEX; volver a un cliente nacional limpia un FEX previo.
  const clienteFinalId = data.clienteId ?? cotizacion.clienteId
  const clienteFinal = await prisma.cliente.findUnique({
    where: { id: clienteFinalId },
    select: { tipo: true },
  })
  if (!clienteFinal) throw new AppError(404, 'NOT_FOUND', 'Cliente no encontrado')
  let tipoDocumentoFiscal = data.tipoDocumentoFiscal
  if (clienteFinal.tipo === 'INTERNACIONAL') {
    if (data.tipoDocumentoFiscal) {
      throw new AppError(422, 'TIPO_DOCUMENTO_INVALIDO', 'Un cliente internacional solo admite Factura de Exportación (FEX); el tipo se asigna automáticamente')
    }
    tipoDocumentoFiscal = 'FEX'
  } else if (cotizacion.tipoDocumentoFiscal === 'FEX' && !data.tipoDocumentoFiscal) {
    tipoDocumentoFiscal = null as never // Prisma acepta null para limpiar el enum opcional
  }
```

Y en el `tx.cotizacion.update` cambiar `tipoDocumentoFiscal: data.tipoDocumentoFiscal,` → `tipoDocumentoFiscal,`. Nota: `clienteId` en `actualizarCotizacion` requiere agregar `clienteId: true` al select — verificar que el objeto `cotizacion` lo exponga; si el tipo de `tipoDocumentoFiscal` local choca con Prisma, tipar `let tipoDocumentoFiscal: TipoDocumentoCotizacion | null | undefined`.

- [ ] **Step 5: Verificar y commitear**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
npx tsc --noEmit && npx vitest run tests/modules/cotizaciones/
git add src/modules/cotizaciones/ tests/modules/cotizaciones/
git commit -m "feat(cotizaciones): FEX automático para clientes internacionales

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
Expected: tsc limpio; tests PASS (pre-existentes + 2 nuevos).

---

### Task 6: Facturas — generar con FEX y bloquear emisión (server)

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/facturas/facturas.schemas.ts` (línea ~68)
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/facturas/facturas.service.ts` (`emitirDTE` ~línea 261, `generarFacturaDesdeCotizacion` ~línea 466)
- Test: `/Users/joaquinmorales13a06/Desktop/Reinar/server/tests/modules/facturas/facturas.service.test.ts` (agregar casos)

**Interfaces:**
- Consumes: `TipoDTE.FEX` (Task 1).
- Produces: `generarFacturaSchema.tipoDTE: z.enum(['FC','CCF','FEX'])`; coherencia receptor↔FEX en `generarFacturaDesdeCotizacion` (422 `TIPO_DTE_INVALIDO`); `emitirDTE` lanza 422 `FEX_NO_DISPONIBLE` para facturas FEX o clientes internacionales. `emitirDTESchema` queda en `['FC','CCF']`. El frontend (Task 11) envía `tipoDTE: 'FEX'` al generar.

- [ ] **Step 1: Agregar casos al test de facturas**

Siguiendo el patrón de mocks del archivo existente:

```typescript
describe('FEX — fase 1 (emisión no disponible)', () => {
  it('emitirDTE rechaza una factura con tipoDTE FEX', async () => {
    ;(prismaMock.factura.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'fac-1', estado: 'PENDIENTE', estadoDTE: 'PENDIENTE', tipoDTE: 'FEX',
      periodoRentaInicio: new Date(), periodoRentaFin: new Date(),
      cliente: { tipo: 'INTERNACIONAL', ncr: null, actividadEconomica: '41001' },
    })
    await expect(emitirDTE('fac-1', { tipoDTE: 'FC' })).rejects.toMatchObject({
      statusCode: 422, code: 'FEX_NO_DISPONIBLE',
    })
  })

  it('emitirDTE rechaza emitir FC a un cliente internacional aunque la factura no tenga tipo', async () => {
    ;(prismaMock.factura.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'fac-2', estado: 'PENDIENTE', estadoDTE: 'PENDIENTE', tipoDTE: null,
      periodoRentaInicio: new Date(), periodoRentaFin: new Date(),
      cliente: { tipo: 'INTERNACIONAL', ncr: null, actividadEconomica: '41001' },
    })
    await expect(emitirDTE('fac-2', { tipoDTE: 'FC' })).rejects.toMatchObject({
      statusCode: 422, code: 'FEX_NO_DISPONIBLE',
    })
  })
})
```

Para `generarFacturaDesdeCotizacion` (mocks según el patrón del archivo — cotización APROBADA sin factura):

```typescript
  it('generarFactura rechaza FC para receptor internacional', async () => {
    // cotización de cliente internacional, input tipoDTE FC → 422 TIPO_DTE_INVALIDO
    await expect(
      generarFacturaDesdeCotizacion('cot-1', { tipoDTE: 'FC', condicionPago: 'CONTADO', esQuedan: false } as any, 'user-1'),
    ).rejects.toMatchObject({ statusCode: 422, code: 'TIPO_DTE_INVALIDO' })
  })

  it('generarFactura rechaza FEX para receptor nacional', async () => {
    await expect(
      generarFacturaDesdeCotizacion('cot-2', { tipoDTE: 'FEX', condicionPago: 'CONTADO', esQuedan: false } as any, 'user-1'),
    ).rejects.toMatchObject({ statusCode: 422, code: 'TIPO_DTE_INVALIDO' })
  })
```

- [ ] **Step 2: Verificar que fallan**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx vitest run tests/modules/facturas/`
Expected: FAIL — los códigos `FEX_NO_DISPONIBLE`/`TIPO_DTE_INVALIDO` no existen aún.

- [ ] **Step 3: Ampliar `generarFacturaSchema`**

En `facturas.schemas.ts` línea ~68, cambiar el enum y el comentario:

```typescript
// FEX (Factura de Exportación, DTE 11): asignable al generar la factura de un
// cliente INTERNACIONAL — su emisión llega en fase 2 y emitirDTE la bloquea.
export const generarFacturaSchema = z.object({
  tipoDTE:               z.enum(['FC', 'CCF', 'FEX']),
```

(El resto del objeto y el `superRefine` no cambian.)

- [ ] **Step 4: Coherencia receptor↔FEX en `generarFacturaDesdeCotizacion`**

En el `include` de la cotización (~línea 474) ampliar el select del cliente: `cliente: { select: { tipo: true, diasRecepcionQuedan: true } }`. En el bloque del receptor tercero (~línea 490) ampliar su select a `{ id: true, estado: true, tipo: true }` y capturar el tipo. Después de resolver `clienteId` (~línea 497) agregar:

```typescript
    // Regla "solo FEX": un receptor internacional exige FEX y un nacional lo
    // prohíbe — la coherencia se valida contra el receptor real de la factura.
    const tipoReceptor = input.receptorClienteId && input.receptorClienteId !== cotizacion.clienteId
      ? tipoTercero // capturado del select del receptor de arriba
      : cotizacion.cliente.tipo
    if (tipoReceptor === 'INTERNACIONAL' && input.tipoDTE !== 'FEX') {
      throw new AppError(422, 'TIPO_DTE_INVALIDO', 'Un cliente internacional solo admite Factura de Exportación (FEX)')
    }
    if (tipoReceptor !== 'INTERNACIONAL' && input.tipoDTE === 'FEX') {
      throw new AppError(422, 'TIPO_DTE_INVALIDO', 'FEX solo aplica a clientes internacionales')
    }
```

Para capturar `tipoTercero`, declarar `let tipoTercero: TipoCliente | null = null` antes del bloque del receptor y asignar `tipoTercero = receptor.tipo` dentro.

- [ ] **Step 5: Bloqueo en `emitirDTE`**

En `emitirDTE`, inmediatamente después del check de `estadoDTE` (~línea 274) y ANTES del check de CCF:

```typescript
  // Fase 1 FEX: la emisión del DTE 11 aún no está implementada. Un cliente
  // internacional solo admite FEX, así que todo intento de emisión se bloquea
  // hasta la fase 2 — la factura sigue operando (pagos, actas, PDF interno).
  if (factura.tipoDTE === 'FEX' || factura.cliente.tipo === 'INTERNACIONAL') {
    throw new AppError(422, 'FEX_NO_DISPONIBLE', 'La emisión de Factura de Exportación estará disponible próximamente')
  }
```

- [ ] **Step 6: Verificar y commitear**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
npx tsc --noEmit && npx vitest run tests/modules/facturas/
git add src/modules/facturas/ tests/modules/facturas/
git commit -m "feat(facturas): tipoDTE FEX con emisión bloqueada (fase 1)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
Expected: tsc limpio; tests PASS. Correr también la suite completa: `npx vitest run` — éxito = solo los 14 fallos baseline.

---

### Task 7: Catálogo de países en el frontend

**Files:**
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/lib/paises.ts`

**Interfaces:**
- Produces: `PAISES: { value: string; label: string }[]` (249 países, nombres en español, orden alfabético), `PAISES_CODIGOS: ReadonlySet<string>`, `resolverPais(code?: string | null): string`. Consumido por `ClienteForm` (Task 9) y `ClienteDetalle` (Task 10).

- [ ] **Step 1: Crear `lib/paises.ts`**

```typescript
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
  .map((c) => ({ value: c as string, label: nombreRegion.of(c) ?? c }))
  .sort((a, b) => a.label.localeCompare(b.label, 'es'))

export const PAISES_CODIGOS: ReadonlySet<string> = new Set<string>(CODIGOS_PAIS_ISO)

export function resolverPais(code?: string | null): string {
  if (!code) return ''
  return nombreRegion.of(code) ?? code
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit (repo frontend)**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add lib/paises.ts
git commit -m "feat(lib): catálogo de países ISO 3166-1 alpha-2 en español

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Tipos y hooks del frontend

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/types/api.ts` (Cliente ~línea 65, `TipoDocumentoFiscal` línea 747, `TipoDTE` línea 1001, `GenerarFacturaInput.tipoDTE` línea 1190)
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/hooks/use-clientes.ts` (línea 11 y 69)
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/lib/format-documentos.ts`

**Interfaces:**
- Produces: `Cliente.tipo: 'EMPRESA' | 'PARTICULAR' | 'INTERNACIONAL'` con `tipoPersona?/codPais?/tamanoContribuyente?` y `departamento?/municipio?` opcionales; `TipoDTE` incluye `'FEX'`; nuevo `TipoDTEGenerable = 'FC' | 'CCF' | 'FEX'`; `TIPOS_DOCUMENTO_INTERNACIONAL` en format-documentos. Consumidos por Tasks 9-11.

- [ ] **Step 1: Actualizar `types/api.ts`**

En el tipo `Cliente` (línea ~67):

```typescript
  tipo: 'EMPRESA' | 'PARTICULAR' | 'INTERNACIONAL';
```

Después de `ncr?: string;` agregar:

```typescript
  // Datos de exportación (solo tipo INTERNACIONAL) — recipient del FEX.
  tipoPersona?: 'NATURAL' | 'JURIDICA' | null;
  codPais?: string | null;
  tamanoContribuyente?: 'GRANDE' | 'MEDIANO' | 'OTROS' | null;
```

Cambiar `departamento: string;` → `departamento?: string | null;` y `municipio: string;` → `municipio?: string | null;` (un cliente internacional no los tiene).

Línea 747: `export type TipoDocumentoFiscal = 'CF' | 'CCF' | 'SUJETO_EXCLUIDO' | 'FEX';`

Línea 1001-1006:

```typescript
export type TipoDTE = 'FC' | 'CCF' | 'SUJETO_EXCLUIDO' | 'FEX';
// … (comentario existente) …
export type TipoDTEEmitible = 'FC' | 'CCF';
// FEX es asignable al GENERAR la factura de un cliente internacional, pero su
// emisión queda bloqueada hasta la fase 2 — por eso no entra en TipoDTEEmitible.
export type TipoDTEGenerable = 'FC' | 'CCF' | 'FEX';
```

Línea 1190 (`GenerarFacturaInput`): cambiar `tipoDTE: TipoDTEEmitible;` → `tipoDTE: TipoDTEGenerable;`.

- [ ] **Step 2: Actualizar `hooks/use-clientes.ts`**

Línea 11: `tipo?: 'EMPRESA' | 'PARTICULAR' | 'INTERNACIONAL' | null;`

- [ ] **Step 3: Agregar orden de documentos para internacional en `lib/format-documentos.ts`**

Junto a `TIPOS_DOCUMENTO_PARTICULAR`/`TIPOS_DOCUMENTO_EMPRESA`:

```typescript
// INTERNACIONAL acepta los 5 tipos (un receptor de zona franca puede tener NIT
// salvadoreño); PASAPORTE y OTRO primero por ser los más comunes en el exterior.
export const TIPOS_DOCUMENTO_INTERNACIONAL: TipoDocumentoCliente[] = ['PASAPORTE', 'OTRO', 'NIT', 'DUI', 'CARNET_RESIDENTE'];
```

- [ ] **Step 4: Verificar tipos**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit`
Expected: pueden aparecer errores en componentes que asumen `departamento: string` (p. ej. `ClienteDetalle`) — si son solo por el opcional, resolverlos con `?? ''` en el punto de uso y dejarlos anotados para Tasks 9-10. Si tsc queda roto, ejecutar Tasks 8-10 en secuencia y commitear juntos al final de Task 10.

- [ ] **Step 5: Commit (repo frontend; diferir a Task 10 si tsc quedó roto)**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add types/api.ts hooks/use-clientes.ts lib/format-documentos.ts
git commit -m "feat(tipos): cliente INTERNACIONAL y TipoDTE FEX

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: `ClienteForm` — tercera pill y campos de exportación

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/clientes/ClienteForm.tsx`

**Interfaces:**
- Consumes: `PAISES`, `PAISES_CODIGOS` (Task 7); `TIPOS_DOCUMENTO_INTERNACIONAL` (Task 8); backend rama INTERNACIONAL (Task 3).
- Produces: formulario crea/edita clientes internacionales enviando `{ tipo: 'INTERNACIONAL', tipoPersona, codPais, complemento, actividadEconomica, tipoDocumento, numeroDocumento, email, telefono?, tamanoContribuyente?, … }`.

- [ ] **Step 1: Ampliar imports y schema Zod**

Imports nuevos:

```typescript
import { PAISES, PAISES_CODIGOS } from '@/lib/paises';
```

y agregar `TIPOS_DOCUMENTO_INTERNACIONAL` al import de `@/lib/format-documentos`.

En el `z.object` (línea 32): cambiar `tipo: z.enum(['EMPRESA', 'PARTICULAR'])` → `tipo: z.enum(['EMPRESA', 'PARTICULAR', 'INTERNACIONAL'])`; cambiar `departamento: z.string().min(1, …)` → `departamento: z.string().optional()` y `municipio: z.string().min(1)` → `municipio: z.string().optional()` (la obligatoriedad para nacionales se mueve al superRefine); agregar:

```typescript
  tipoPersona: z.enum(['NATURAL', 'JURIDICA']).optional().or(z.literal('')),
  codPais: z.string().optional(),
  tamanoContribuyente: z.enum(['GRANDE', 'MEDIANO', 'OTROS']).optional().or(z.literal('')),
```

Reemplazar el `superRefine` completo (líneas 54-81) por:

```typescript
}).superRefine((d, ctx) => {
  if (d.tipo === 'EMPRESA') {
    if (!d.razonSocial?.trim())
      ctx.addIssue({ code: 'custom', path: ['razonSocial'], message: 'La razón social es obligatoria.' });
    if (d.tipoDocumento && d.tipoDocumento !== 'DUI' && d.tipoDocumento !== 'NIT')
      ctx.addIssue({ code: 'custom', path: ['tipoDocumento'], message: 'EMPRESA solo acepta DUI o NIT.' });
  } else if (d.tipo === 'PARTICULAR') {
    if (!d.nombre?.trim())
      ctx.addIssue({ code: 'custom', path: ['nombre'], message: 'El nombre es obligatorio.' });
  } else {
    // INTERNACIONAL: todos los datos del recipient FEX son obligatorios al crear.
    if (!d.tipoPersona)
      ctx.addIssue({ code: 'custom', path: ['tipoPersona'], message: 'Seleccioná persona natural o jurídica.' });
    if (d.tipoPersona === 'NATURAL' && !d.nombre?.trim())
      ctx.addIssue({ code: 'custom', path: ['nombre'], message: 'El nombre es obligatorio.' });
    if (d.tipoPersona === 'JURIDICA' && !d.razonSocial?.trim())
      ctx.addIssue({ code: 'custom', path: ['razonSocial'], message: 'La razón social es obligatoria.' });
    if (!d.codPais || !PAISES_CODIGOS.has(d.codPais))
      ctx.addIssue({ code: 'custom', path: ['codPais'], message: 'Seleccioná el país.' });
    if (!d.complemento?.trim())
      ctx.addIssue({ code: 'custom', path: ['complemento'], message: 'La dirección es obligatoria.' });
    if ((d.complemento ?? '').length > 300)
      ctx.addIssue({ code: 'custom', path: ['complemento'], message: 'Máximo 300 caracteres.' });
    if (!d.actividadEconomica)
      ctx.addIssue({ code: 'custom', path: ['actividadEconomica'], message: 'La actividad económica es obligatoria.' });
    if (!d.tipoDocumento)
      ctx.addIssue({ code: 'custom', path: ['tipoDocumento'], message: 'El documento es obligatorio.' });
    if (!d.email?.trim())
      ctx.addIssue({ code: 'custom', path: ['email'], message: 'El correo es obligatorio (recibe el DTE).' });
  }
  // Dirección SV: obligatoria solo para clientes nacionales.
  if (d.tipo !== 'INTERNACIONAL') {
    if (!d.departamento?.trim())
      ctx.addIssue({ code: 'custom', path: ['departamento'], message: 'El departamento es obligatorio.' });
    if (!d.municipio?.trim())
      ctx.addIssue({ code: 'custom', path: ['municipio'], message: 'El municipio es obligatorio.' });
  }
  const tipoDocRaw = d.tipoDocumento as string | undefined;
  const tipoDoc = tipoDocRaw && tipoDocRaw !== '' ? d.tipoDocumento : undefined;
  if (tipoDoc && !d.numeroDocumento?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['numeroDocumento'], message: 'Ingresá el número del documento.' });
  }
  if (!tipoDoc && d.numeroDocumento?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['tipoDocumento'], message: 'Seleccioná el tipo de documento.' });
  }
  if (tipoDoc && d.numeroDocumento?.trim() && !validarDocumento(tipoDoc, d.numeroDocumento)) {
    ctx.addIssue({ code: 'custom', path: ['numeroDocumento'], message: MENSAJE_FORMATO_DOCUMENTO[tipoDoc] });
  }
  if (d.ncr && !/^(\d{4}-\d|\d{6}-\d)$/.test(d.ncr))
    ctx.addIssue({ code: 'custom', path: ['ncr'], message: 'Formato: NNNN-N o NNNNNN-N' });
  if (d.telefono && !/^\+\d{6,15}$/.test(d.telefono))
    ctx.addIssue({ code: 'custom', path: ['telefono'], message: 'Número inválido (6–12 dígitos locales).' });
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))
    ctx.addIssue({ code: 'custom', path: ['email'], message: 'Correo inválido.' });
});
```

En `DEFAULTS` (línea 85) agregar: `tipoPersona: '', codPais: '', tamanoContribuyente: '',`.

- [ ] **Step 2: Tercera pill y watch**

Reemplazar la pill de tipo (líneas 240-250):

```tsx
{(['EMPRESA', 'PARTICULAR', 'INTERNACIONAL'] as const).map((t) => (
  <div
    key={t}
    className={`px-4 py-1.5 rounded-md text-sm cursor-pointer select-none transition-all ${
      tipo === t ? 'bg-surface text-tx font-medium shadow-sm' : 'text-tx-2 hover:text-tx'
    }`}
    onClick={() => setValue('tipo', t)}
  >
    {t === 'EMPRESA' ? 'Empresa' : t === 'PARTICULAR' ? 'Particular' : 'Internacional'}
  </div>
))}
```

Agregar tras los `watch` existentes (~línea 121): `const tipoPersona = watch('tipoPersona');`.

- [ ] **Step 3: Rama de campos INTERNACIONAL**

El título de la sección (línea 254) pasa a: `title={tipo === 'EMPRESA' ? 'Datos de la empresa' : tipo === 'PARTICULAR' ? 'Datos personales' : 'Datos del cliente internacional'}`.

El ternario del cuerpo pasa a tres ramas: `{tipo === 'EMPRESA' ? (…existente…) : tipo === 'PARTICULAR' ? (…existente…) : (…nueva rama…)}`. La nueva rama:

```tsx
<>
  <div className="flex flex-col gap-1 sm:col-span-2">
    <label className="text-xs font-medium text-tx-2">Tipo de persona <span className="text-danger">*</span></label>
    <div className="flex p-0.5 rounded-lg border border-bd bg-bg-sunken w-fit">
      {(['NATURAL', 'JURIDICA'] as const).map((p) => (
        <div
          key={p}
          className={`px-4 py-1.5 rounded-md text-sm cursor-pointer select-none transition-all ${
            tipoPersona === p ? 'bg-surface text-tx font-medium shadow-sm' : 'text-tx-2 hover:text-tx'
          }`}
          onClick={() => setValue('tipoPersona', p)}
        >
          {p === 'NATURAL' ? 'Persona natural' : 'Persona jurídica'}
        </div>
      ))}
    </div>
    {errors.tipoPersona && <p className="text-xs text-danger mt-0.5">{errors.tipoPersona.message}</p>}
  </div>

  {tipoPersona === 'JURIDICA' ? (
    <>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className="text-xs font-medium text-tx-2">Razón social <span className="text-danger">*</span></label>
        <input className={errors.razonSocial ? inputErr : inputOk} {...register('razonSocial')} placeholder="Constructora Maya, S.A." />
        {errors.razonSocial && <p className="text-xs text-danger mt-0.5">{errors.razonSocial.message}</p>}
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className="text-xs font-medium text-tx-2">Nombre comercial</label>
        <input className={inputOk} {...register('nombreComercial')} placeholder="Nombre con el que se conoce comúnmente" />
      </div>
    </>
  ) : (
    <>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-tx-2">Nombre <span className="text-danger">*</span></label>
        <input className={errors.nombre ? inputErr : inputOk} {...register('nombre')} placeholder="Carlos Andrés" />
        {errors.nombre && <p className="text-xs text-danger mt-0.5">{errors.nombre.message}</p>}
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-tx-2">Apellido</label>
        <input className={inputOk} {...register('apellido')} placeholder="Reyes Molina" />
      </div>
    </>
  )}

  <div className="flex flex-col gap-1">
    <label className="text-xs font-medium text-tx-2">Tipo de documento <span className="text-danger">*</span></label>
    <select
      className={errors.tipoDocumento ? inputErr : inputOk}
      {...register('tipoDocumento')}
      onChange={(e) => {
        void register('tipoDocumento').onChange(e);
        setValue('numeroDocumento', '');
      }}
    >
      <option value="">— Seleccionar —</option>
      {TIPOS_DOCUMENTO_INTERNACIONAL.map((t) => (
        <option key={t} value={t}>{LABEL_TIPO_DOCUMENTO[t]}</option>
      ))}
    </select>
    {errors.tipoDocumento && <p className="text-xs text-danger mt-0.5">{errors.tipoDocumento.message}</p>}
  </div>
  <div className="flex flex-col gap-1">
    <label className="text-xs font-medium text-tx-2">Número del documento <span className="text-danger">*</span></label>
    <input
      className={`${errors.numeroDocumento ? inputErr : inputOk} ${monoBase}`}
      inputMode={tipoDocumentoValue === 'DUI' || tipoDocumentoValue === 'NIT' ? 'numeric' : 'text'}
      maxLength={tipoDocumentoValue && tipoDocumentoValue !== '' ? MAXLENGTH_POR_TIPO[tipoDocumentoValue as TipoDocumentoCliente] : 25}
      placeholder={tipoDocumentoValue && tipoDocumentoValue !== '' ? PLACEHOLDER_POR_TIPO[tipoDocumentoValue as TipoDocumentoCliente] : 'Seleccioná un tipo primero'}
      disabled={!tipoDocumentoValue}
      {...numeroDocReg}
      onChange={(e) => {
        if (tipoDocumentoValue && tipoDocumentoValue !== '') {
          e.target.value = formatDocumento(tipoDocumentoValue as TipoDocumentoCliente, e.target.value);
        }
        void numeroDocReg.onChange(e);
      }}
    />
    {errors.numeroDocumento && <p className="text-xs text-danger mt-0.5">{errors.numeroDocumento.message}</p>}
  </div>

  <div className="flex flex-col gap-1">
    <label className="text-xs font-medium text-tx-2">Sector</label>
    <select
      className={inputOk}
      {...sectorRest}
      onChange={(e) => {
        onSectorChange(e);
        setValue('actividadEconomica', '');
      }}
    >
      <option value="">— Seleccionar —</option>
      {SECTORES_CAT019.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  </div>
  <div className="flex flex-col gap-1">
    <label className="text-xs font-medium text-tx-2">Actividad económica (CAT-019) <span className="text-danger">*</span></label>
    <select className={errors.actividadEconomica ? inputErr : inputOk} {...register('actividadEconomica')}>
      <option value="">— Seleccionar actividad —</option>
      {sector ? (
        actividadesFiltradas.map((a) => (
          <option key={a.codigo} value={a.codigo}>{a.codigo} — {a.descripcion}</option>
        ))
      ) : (
        SECTORES_CAT019.map((s) => {
          const acts = ACTIVIDADES_ECONOMICAS_SV.filter((a) => a.sector === s);
          if (!acts.length) return null;
          return (
            <optgroup key={s} label={s}>
              {acts.map((a) => (
                <option key={a.codigo} value={a.codigo}>{a.codigo} — {a.descripcion}</option>
              ))}
            </optgroup>
          );
        })
      )}
    </select>
    {errors.actividadEconomica
      ? <p className="text-xs text-danger mt-0.5">{errors.actividadEconomica.message}</p>
      : !sector && <p className="text-xs text-tx-3 mt-0.5">Seleccioná un sector para filtrar las actividades.</p>}
  </div>

  <div className="flex flex-col gap-1">
    <label className="text-xs font-medium text-tx-2">Tamaño de contribuyente</label>
    <select className={inputOk} {...register('tamanoContribuyente')}>
      <option value="">— Sin especificar —</option>
      <option value="GRANDE">Grande</option>
      <option value="MEDIANO">Mediano</option>
      <option value="OTROS">Otros</option>
    </select>
  </div>
</>
```

- [ ] **Step 4: Sección Dirección condicional y ocultar QUEDAN**

La `FormSection title="Facturación"` (QUEDAN, líneas 433-479) se envuelve en `{tipo !== 'INTERNACIONAL' && ( … )}`.

En la `FormSection title="Dirección"`, el grid actual (departamento/municipio/distrito/complemento) queda dentro de `{tipo !== 'INTERNACIONAL' ? ( …grid existente… ) : ( …bloque nuevo… )}`. Bloque nuevo:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
  <div className="flex flex-col gap-1">
    <label className="text-xs font-medium text-tx-2">País <span className="text-danger">*</span></label>
    <select className={errors.codPais ? inputErr : inputOk} {...register('codPais')}>
      <option value="">— Seleccionar país —</option>
      {PAISES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
    </select>
    {errors.codPais && <p className="text-xs text-danger mt-0.5">{errors.codPais.message}</p>}
  </div>
  <div className="flex flex-col gap-1 sm:col-span-2">
    <label className="text-xs font-medium text-tx-2">Dirección <span className="text-danger">*</span></label>
    <textarea
      className={`${errors.complemento ? inputErr : inputOk} resize-y`}
      {...register('complemento')}
      placeholder="Calle, número, ciudad, estado/provincia…"
      rows={2}
      maxLength={300}
    />
    {errors.complemento && <p className="text-xs text-danger mt-0.5">{errors.complemento.message}</p>}
  </div>
</div>
```

En la sección Contacto, el label del email pasa a mostrar asterisco cuando aplica: `Correo electrónico {tipo === 'INTERNACIONAL' && <span className="text-danger">*</span>}` (el DTE se envía a ese correo).

- [ ] **Step 5: Verificar y commitear**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm tsc --noEmit && pnpm lint
git add components/clientes/ClienteForm.tsx
git commit -m "feat(clientes): formulario de cliente internacional con datos FEX

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
Expected: tsc limpio; lint sin warnings nuevos sobre el baseline 12/25.

---

### Task 10: `ClientesList` y `ClienteDetalle`

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/clientes/ClientesList.tsx` (líneas ~19, 44, 76-78, 132-146)
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/clientes/ClienteDetalle.tsx` (líneas ~68, 79-80, 107, 138-140)

**Interfaces:**
- Consumes: `resolverPais` (Task 7); `Cliente` ampliado (Task 8).
- Produces: chip de filtro "Internacionales", badge `kind="accent"`, detalle con país/dirección/persona en lugar de la dirección SV.

- [ ] **Step 1: `ClientesList.tsx`**

Línea 19: `type TipoFilter = 'EMPRESA' | 'PARTICULAR' | 'INTERNACIONAL' | null;`
Línea 44: `function toggleTipo(t: 'EMPRESA' | 'PARTICULAR' | 'INTERNACIONAL') {`
En los chips (líneas 76-78) agregar:

```tsx
{ label: 'Internacionales', active: filterTipo === 'INTERNACIONAL', onToggle: () => toggleTipo('INTERNACIONAL') },
```

En la celda del badge (líneas 132-134):

```tsx
<Badge
  status={c.tipo === 'EMPRESA' ? 'Empresa' : c.tipo === 'PARTICULAR' ? 'Particular' : 'Internacional'}
  kind={c.tipo === 'EMPRESA' ? 'info' : c.tipo === 'PARTICULAR' ? 'neutral' : 'accent'}
/>
```

Donde el nombre se deriva con `c.tipo === 'EMPRESA' ? razonSocial : nombre+apellido` (líneas ~139 y ~146), cambiar el criterio a "razón social si existe" para cubrir jurídicas internacionales:

```tsx
{c.razonSocial ?? [c.nombre, c.apellido].filter(Boolean).join(' ') || '—'}
```

(Aplicarlo en ambos puntos manteniendo el JSX circundante.)

- [ ] **Step 2: `ClienteDetalle.tsx`**

Import: agregar `import { resolverPais } from '@/lib/paises';`
Línea ~68: `const displayName = cliente.razonSocial ?? [cliente.nombre, cliente.apellido].filter(Boolean).join(' ') || '—';` (reemplaza el ternario por tipo).
Badge (líneas 79-80): mismo patrón de 3 ramas que en `ClientesList`.
En el bloque de datos por tipo (línea ~107), agregar la rama internacional que muestra: Tipo de persona (`Natural`/`Jurídica`), Documento (ya existente), Tamaño de contribuyente (si existe). En el bloque de dirección (líneas ~138-140):

```tsx
{cliente.tipo === 'INTERNACIONAL' ? (
  <>
    <DetailRow label="País" value={resolverPais(cliente.codPais)} />
    <DetailRow label="Dirección" value={cliente.complemento ?? '—'} />
  </>
) : (
  <>
    <DetailRow label="Departamento" value={resolverDepartamento(cliente.departamento ?? '')} />
    <DetailRow label="Municipio" value={resolverMunicipio(cliente.municipio ?? '', cliente.departamento ?? '')} />
    <DetailRow label="Distrito" value={resolverDistrito(cliente.distrito, cliente.municipio ?? '', cliente.departamento ?? '')} />
  </>
)}
```

(Ajustar `?? ''` según las firmas reales de los resolvers para que tsc quede limpio.)

- [ ] **Step 3: Verificar y commitear**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm tsc --noEmit && pnpm lint
git add components/clientes/ types/api.ts hooks/use-clientes.ts lib/format-documentos.ts
git commit -m "feat(clientes): listado y detalle con tipo internacional

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
(Este commit absorbe los archivos de Task 8 si quedaron sin commitear.)

---

### Task 11: Flujo de ventas — FEX bloqueado en la UI

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/cotizaciones/GenerarFacturaModal.tsx` (líneas ~44-47, 158-172, 196-215)
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/app/(dashboard)/facturas/[id]/page.tsx` (líneas ~209-217)
- Modify: componentes DTE con labels de tipo (localizar con grep, Step 3)

**Interfaces:**
- Consumes: `TipoDTEGenerable` (Task 8); backend acepta `tipoDTE: 'FEX'` al generar (Task 6).
- Produces: modal genera facturas FEX para clientes internacionales sin ofrecer FC/CCF; el detalle de factura bloquea la emisión de FEX con mensaje.

- [ ] **Step 1: `GenerarFacturaModal.tsx`**

Función de sugerencia (reemplaza los tres puntos donde se calcula el DTE — líneas 44-47, 203 y 214):

```typescript
// FEX es fijo para internacionales (regla "solo FEX"); para nacionales se
// sugiere CCF (empresa) o FC (particular) y el operador puede cambiarlo.
function sugerirDTE(tipo: Cliente['tipo']): 'FC' | 'CCF' | 'FEX' {
  if (tipo === 'INTERNACIONAL') return 'FEX';
  return tipo === 'EMPRESA' ? 'CCF' : 'FC';
}
```

Estado (líneas 44-47): `const [tipoDTE, setTipoDTE] = useState<'FC' | 'CCF' | 'FEX'>(sugerirDTE(cliente.tipo));`
Línea 203: `setTipoDTE(sugerirDTE(tipo));` — línea 214: `setTipoDTE(sugerirDTE(cliente.tipo));`

Selector (líneas 158-172): agregar `const esFex = tipoDTE === 'FEX';` junto a `esContado` y reemplazar el `<select>`:

```tsx
{esFex ? (
  <div className="px-3 py-2 rounded-md border border-bd bg-bg-sunken">
    <span className="text-sm font-medium text-tx font-mono">FEX — Factura de Exportación</span>
    <p className="text-xs text-tx-3 mt-0.5">
      Cliente internacional: solo admite Factura de Exportación. La emisión del
      DTE estará disponible próximamente; la factura se genera sin emitir.
    </p>
  </div>
) : (
  <select
    value={tipoDTE}
    onChange={(e) => setTipoDTE(e.target.value as 'FC' | 'CCF')}
    className={inputBase}
  >
    <option value="FC">FC — Factura de Consumidor Final</option>
    <option value="CCF">CCF — Crédito Fiscal</option>
  </select>
)}
```

- [ ] **Step 2: Detalle de factura `facturas/[id]/page.tsx`**

Antes del `return` agregar:

```typescript
  // FEX (fase 1) y SUJETO_EXCLUIDO histórico no se emiten desde ventas.
  const emisionBloqueada = factura.tipoDTE === 'SUJETO_EXCLUIDO' || factura.tipoDTE === 'FEX';
```

Y en `DteSection` (líneas 209-217) usar la constante:

```tsx
onEmitir={() => {
  if (factura.tipoDTE && !emisionBloqueada) void emitirCon(factura.tipoDTE as TipoDTEEmitible);
}}
onReemitir={() => {
  if (factura.tipoDTE && !emisionBloqueada) void emitirCon(factura.tipoDTE as TipoDTEEmitible);
}}
emisionBloqueada={emisionBloqueada}
```

- [ ] **Step 3: Labels de TipoDTE en componentes DTE**

Localizar dónde se renderiza el nombre del tipo de DTE:

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
grep -rn "SUJETO_EXCLUIDO" components/ --include="*.tsx" -l
```

En cada mapa de labels encontrado (p. ej. en `DteSection` o similar) agregar la entrada `FEX: 'FEX — Factura de Exportación'` siguiendo el formato de las existentes, y revisar que el mensaje de bloqueo (`emisionBloqueada`) sea genérico o contemple FEX — si el texto menciona solo Sujeto Excluido, cambiarlo a: "Este tipo de documento no se puede emitir desde aquí. La Factura de Exportación estará disponible próximamente."

- [ ] **Step 4: Verificar y commitear**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm tsc --noEmit && pnpm lint
git add components/ app/
git commit -m "feat(facturas): flujo de venta con FEX bloqueado para internacionales

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: Verificación integral

**Files:** ninguno nuevo — solo verificación.

- [ ] **Step 1: Suites completas de ambos repos**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx tsc --noEmit && npx vitest run
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit && pnpm lint
```
Expected: server tsc limpio y vitest con SOLO los 14 fallos baseline; frontend tsc limpio y lint sin warnings nuevos (baseline 12/25).

- [ ] **Step 2: Prueba manual end-to-end (backend y frontend corriendo)**

Con `pnpm dev` en ambos repos (backend :3000, frontend :3001):
1. Crear cliente internacional **jurídica** (razón social, GT, dirección, CAT-019, OTRO + número, email) → guarda y aparece en el listado con badge "Internacional".
2. Crear cliente internacional **natural** (nombre, PASAPORTE) → guarda.
3. Intentar guardar sin país o sin email → errores inline.
4. Filtrar el listado por "Internacionales" → solo ellos.
5. Crear cotización para el cliente internacional, aprobarla y generar factura → el modal muestra "FEX — Factura de Exportación" fijo (sin select FC/CCF).
6. En el detalle de la factura: la emisión aparece bloqueada con el mensaje de "disponible próximamente".
7. Verificar que un cliente EMPRESA sigue creando facturas FC/CCF normalmente (sin regresión).
8. Dark mode y viewport 768px en el formulario de cliente internacional.
9. Con usuario VISUALIZADOR: sin botones de crear/editar cliente.

- [ ] **Step 3: Checklist CLAUDE.md pre-PR**

Repasar el checklist del CLAUDE.md del frontend (datos reales, errores inline, VISUALIZADOR, paginación, dark mode, tablet, toasts en mutations, sin CSS vanilla, comentarios "why" en español).
