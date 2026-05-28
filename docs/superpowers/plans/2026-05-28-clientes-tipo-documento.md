# Cliente: tipo de documento de identidad multi-tipo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir registrar Clientes (PARTICULAR y EMPRESA) con uno de cinco tipos de documento (DUI, NIT, PASAPORTE, CARNET_RESIDENTE, OTRO) y enviar el documento + NRC correctamente al emitir DTE FC/CCF/FSE/NC respetando las reglas del MH El Salvador.

**Architecture:** Reemplazar columnas `dui` y `nit` de `Cliente` por par `tipoDocumento` (enum) + `numeroDocumento` (string), con migración legacy priorizando NIT 14d. Backend valida formato según tipo, restringe CCF a DUI/NIT con NRC, agrega NRC al payload FC solo cuando el tipo es NIT. Frontend reemplaza inputs fijos por dropdown + input dinámico.

**Tech Stack:** Backend Express + Prisma + Vitest. Frontend Next.js 19 + React Hook Form + Zod. PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-05-28-clientes-tipo-documento-design.md`

**Branches activas:**
- `server`: `feat/clientes-tipo-documento` (en `/Users/joaquinmorales13a06/Desktop/Reinar/server`)
- `frontend`: `feat/clientes-tipo-documento` (en `/Users/joaquinmorales13a06/Desktop/Reinar/frontend`)

**Orden de ejecución:** todas las tasks del backend antes de las del frontend; el frontend depende del schema nuevo.

---

## Mapa de archivos

### Backend (`server/`)
- **Crear**: `prisma/migrations/20260528120000_cliente_tipo_documento/migration.sql`
- **Modificar**: `prisma/schema.prisma`
- **Modificar**: `src/modules/clientes/clientes.schemas.ts`
- **Modificar**: `src/modules/clientes/clientes.service.ts`
- **Modificar**: `src/modules/facturallama/facturallama.types.ts`
- **Modificar**: `src/modules/facturallama/facturallama.service.ts`
- **Modificar**: `src/modules/pdf/pdf.service.ts` (registrar helper Handlebars)
- **Modificar**: `src/modules/pdf/templates/factura.hbs`
- **Modificar**: `src/modules/pdf/templates/cotizacion.hbs`
- **Modificar**: `src/modules/pdf/templates/nota-credito.hbs`
- **Modificar tests**: `tests/modules/clientes/clientes.service.test.ts`, `tests/modules/facturallama/facturallama.service.test.ts`

### Frontend (`frontend/`)
- **Modificar**: `lib/format-documentos.ts`
- **Modificar**: `types/api.ts`
- **Modificar**: `components/clientes/ClienteForm.tsx`
- **Modificar**: `components/clientes/ClienteDetalle.tsx`
- **Modificar**: `components/clientes/ClientesList.tsx`
- **Modificar** (lo que detecte `tsc --noEmit`): cualquier consumidor de `cliente.dui` o `cliente.nit`

---

# Backend (server/)

> Todas las tasks del backend se ejecutan con `cwd = /Users/joaquinmorales13a06/Desktop/Reinar/server`.

## Task 1: Agregar enum y columnas al schema Prisma

**Files:**
- Modify: `prisma/schema.prisma` (líneas 13 y 249-282)

- [ ] **Step 1: Agregar el enum `TipoDocumentoCliente`**

Ubicación: junto al enum `TipoCliente` (~línea 11-15). Agregar después de `TipoCliente`:

```prisma
enum TipoDocumentoCliente {
  DUI
  NIT
  PASAPORTE
  CARNET_RESIDENTE
  OTRO
}
```

- [ ] **Step 2: Modificar `model Cliente`**

Reemplazar las líneas que definen `nit`, `ncr`, `dui` y el bloque inmediato. Estado final del bloque relevante:

```prisma
model Cliente {
  id   String      @id @default(cuid())
  tipo TipoCliente

  razonSocial     String?
  nombreComercial String?
  sector          String?

  nombre    String?
  apellido  String?
  ocupacion String?

  tipoDocumento    TipoDocumentoCliente?
  numeroDocumento  String?
  ncr              String? @unique

  departamento       String
  municipio          String
  distrito           String?
  complemento        String
  actividadEconomica String?
  telefono           String?
  email              String?
  estado             EstadoCliente @default(ACTIVO)
  notas              String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  contactos    Contacto[]
  proyectos    Proyecto[]
  cotizaciones Cotizacion[]
  facturas     Factura[]
  retenciones  ComprobanteRetencion[]

  @@unique([tipoDocumento, numeroDocumento])
}
```

Cambios vs estado actual: eliminadas `nit`, `dui`; agregadas `tipoDocumento`, `numeroDocumento`; `ncr` conservado tal cual; agregado `@@unique([tipoDocumento, numeroDocumento])`.

- [ ] **Step 3: Verificar que el schema parsea correctamente**

Run: `pnpm prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Commit del cambio de schema (sin migration aún)**

```bash
git add prisma/schema.prisma
git commit -m "feat(cliente): agregar enum TipoDocumentoCliente y campos tipoDocumento/numeroDocumento

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 2: Crear migración SQL con backfill legacy

**Files:**
- Create: `prisma/migrations/20260528120000_cliente_tipo_documento/migration.sql`

- [ ] **Step 1: Crear el directorio de migración**

```bash
mkdir -p prisma/migrations/20260528120000_cliente_tipo_documento
```

- [ ] **Step 2: Escribir la migración SQL**

Crear `prisma/migrations/20260528120000_cliente_tipo_documento/migration.sql`:

```sql
-- Migracion para cambiar el modelo de identificacion de Cliente:
-- elimina dui/nit y los reemplaza por tipoDocumento + numeroDocumento.
-- El backfill prioriza NIT (14d) cuando existe; en caso contrario usa DUI.

-- 1. Crear el enum nuevo
CREATE TYPE "TipoDocumentoCliente" AS ENUM ('DUI', 'NIT', 'PASAPORTE', 'CARNET_RESIDENTE', 'OTRO');

-- 2. Agregar columnas nuevas (nullable)
ALTER TABLE "Cliente" ADD COLUMN "tipoDocumento" "TipoDocumentoCliente";
ALTER TABLE "Cliente" ADD COLUMN "numeroDocumento" TEXT;

-- 3. Backfill: priorizar NIT 14d; sino DUI; sino NULL
UPDATE "Cliente"
SET
  "tipoDocumento" = CASE
    WHEN "nit" IS NOT NULL THEN 'NIT'::"TipoDocumentoCliente"
    WHEN "dui" IS NOT NULL THEN 'DUI'::"TipoDocumentoCliente"
    ELSE NULL
  END,
  "numeroDocumento" = COALESCE("nit", "dui");

-- 4. Eliminar los indices unicos de las columnas viejas antes de droparlas
DROP INDEX IF EXISTS "Cliente_nit_key";
DROP INDEX IF EXISTS "Cliente_dui_key";

-- 5. Eliminar las columnas viejas
ALTER TABLE "Cliente" DROP COLUMN "nit";
ALTER TABLE "Cliente" DROP COLUMN "dui";

-- 6. Indice unico compuesto sobre el nuevo par. Postgres ignora NULLs en unique
-- por defecto, asi que clientes sin documento (ambos NULL) no chocan entre si.
CREATE UNIQUE INDEX "Cliente_tipoDocumento_numeroDocumento_key"
  ON "Cliente"("tipoDocumento", "numeroDocumento");
```

- [ ] **Step 3: Aplicar la migración a la BD de desarrollo**

Run: `pnpm prisma migrate dev`
Expected: `Applying migration 20260528120000_cliente_tipo_documento` y al final `Your database is now in sync with your schema.`

Si Prisma detecta drift o pide nombre, no hace falta: la migración ya existe con su carpeta. Aceptar la aplicación.

- [ ] **Step 4: Verificar que el cliente Prisma se regeneró**

Run: `pnpm prisma generate`
Expected: `Generated Prisma Client (v...) in...`

- [ ] **Step 5: Commit de la migración**

```bash
git add prisma/migrations/20260528120000_cliente_tipo_documento
git commit -m "feat(cliente): migracion SQL con backfill legacy dui/nit -> tipoDocumento/numeroDocumento

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 3: Actualizar Zod schemas en `clientes.schemas.ts`

**Files:**
- Modify: `src/modules/clientes/clientes.schemas.ts`

- [ ] **Step 1: Reescribir el archivo completo**

Sobrescribir `src/modules/clientes/clientes.schemas.ts` con:

```typescript
import { z } from 'zod'
import { TipoCliente, EstadoCliente, TipoDocumentoCliente } from '@prisma/client'
import { CAT019_CODIGOS } from '../../lib/cat019'

// Convierte '' a undefined para campos únicos — evita que un string vacío viole la constraint @unique
// cuando múltiples clientes no tienen ese campo (Prisma: null permite duplicados, '' no).
const optionalUniqueStr = z.preprocess((v) => (v === '' ? undefined : v), z.string().optional())

// Validacion de formato por tipo de documento. Las reglas reflejan la
// validacion de FacturaLlama: DUI 9d, NIT 14d; el resto son alfanumericos.
const FORMATO_POR_TIPO_DOCUMENTO: Record<TipoDocumentoCliente, RegExp> = {
  DUI: /^\d{8}-\d$/,
  NIT: /^\d{4}-\d{6}-\d{3}-\d$/,
  PASAPORTE: /^[A-Z0-9]{5,20}$/,
  CARNET_RESIDENTE: /^[A-Z0-9-]{5,20}$/,
  OTRO: /^.{2,25}$/,
}

const MENSAJE_FORMATO: Record<TipoDocumentoCliente, string> = {
  DUI: 'Formato DUI inválido (NNNNNNNN-N)',
  NIT: 'Formato NIT inválido (NNNN-NNNNNN-NNN-N)',
  PASAPORTE: 'Pasaporte: 5-20 caracteres alfanuméricos',
  CARNET_RESIDENTE: 'Carnet de residente: 5-20 caracteres alfanuméricos',
  OTRO: 'Documento: 2-25 caracteres',
}

const tipoDocumentoSchema = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.nativeEnum(TipoDocumentoCliente).optional(),
)

const camposCompartidos = {
  departamento: z.string().min(1, 'El departamento es requerido'),
  municipio: z.string().min(1, 'El municipio es requerido'),
  distrito: z.string().optional(),
  complemento: z.string().optional(),
  actividadEconomica: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().refine(c => CAT019_CODIGOS.has(c), 'Código de actividad económica inválido (CAT-019)').optional(),
  ),
  telefono: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  notas: z.string().optional(),
  tipoDocumento: tipoDocumentoSchema,
  numeroDocumento: optionalUniqueStr,
  ncr: optionalUniqueStr,
}

const empresaFields = {
  tipo: z.literal('EMPRESA'),
  razonSocial: z.string().min(1, 'La razón social es requerida'),
  nombreComercial: z.string().optional(),
  sector: z.string().optional(),
  ...camposCompartidos,
}

const particularFields = {
  tipo: z.literal('PARTICULAR'),
  nombre: z.string().min(1, 'El nombre es requerido'),
  apellido: z.string().optional(),
  ocupacion: z.string().optional(),
  ...camposCompartidos,
}

const validarDocumento = (data: { tipoDocumento?: TipoDocumentoCliente; numeroDocumento?: string }, ctx: z.RefinementCtx) => {
  if (!data.tipoDocumento && !data.numeroDocumento) return
  if (data.tipoDocumento && !data.numeroDocumento) {
    ctx.addIssue({ code: 'custom', path: ['numeroDocumento'], message: 'Ingresá el número del documento' })
    return
  }
  if (!data.tipoDocumento && data.numeroDocumento) {
    ctx.addIssue({ code: 'custom', path: ['tipoDocumento'], message: 'Seleccioná el tipo de documento' })
    return
  }
  const regex = FORMATO_POR_TIPO_DOCUMENTO[data.tipoDocumento!]
  if (!regex.test(data.numeroDocumento!)) {
    ctx.addIssue({ code: 'custom', path: ['numeroDocumento'], message: MENSAJE_FORMATO[data.tipoDocumento!] })
  }
}

const validarTipoEmpresa = (data: { tipo: 'EMPRESA'; tipoDocumento?: TipoDocumentoCliente }, ctx: z.RefinementCtx) => {
  if (data.tipoDocumento && data.tipoDocumento !== 'DUI' && data.tipoDocumento !== 'NIT') {
    ctx.addIssue({
      code: 'custom',
      path: ['tipoDocumento'],
      message: 'EMPRESA solo puede identificarse con DUI o NIT',
    })
  }
}

export const crearClienteSchema = z.discriminatedUnion('tipo', [
  z.object(empresaFields).superRefine((d, ctx) => { validarDocumento(d, ctx); validarTipoEmpresa(d, ctx) }),
  z.object(particularFields).superRefine(validarDocumento),
])

export const actualizarClienteSchema = z.discriminatedUnion('tipo', [
  z.object(empresaFields).superRefine((d, ctx) => { validarDocumento(d, ctx); validarTipoEmpresa(d, ctx) }),
  z.object(particularFields).superRefine(validarDocumento),
])

export const filtrosClientesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  busqueda: z.string().min(1).max(255).optional(),
  tipo: z.nativeEnum(TipoCliente).optional(),
  estado: z.nativeEnum(EstadoCliente).optional(),
  sector: z.string().min(1).optional(),
})

export const estadoClienteSchema = z.object({
  estado: z.nativeEnum(EstadoCliente),
})

export type CrearClienteDto = z.infer<typeof crearClienteSchema>
export type ActualizarClienteDto = z.infer<typeof actualizarClienteSchema>
export type FiltrosClientes = z.infer<typeof filtrosClientesSchema>
export type EstadoClienteDto = z.infer<typeof estadoClienteSchema>
```

- [ ] **Step 2: Verificar compilación TS**

Run: `pnpm tsc --noEmit`
Expected: errores SOLO en `clientes.service.ts` (que aún hace referencias a `dui`/`nit`); ningún error dentro de `clientes.schemas.ts` u otros archivos.

- [ ] **Step 3: Commit**

```bash
git add src/modules/clientes/clientes.schemas.ts
git commit -m "feat(cliente): reemplazar dui/nit por tipoDocumento/numeroDocumento en Zod schemas

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 4: Actualizar `clientes.service.ts`

**Files:**
- Modify: `src/modules/clientes/clientes.service.ts`

- [ ] **Step 1: Reemplazar `SELECT_CLIENTE_LISTA`**

Quitar `nit: true` y `dui: true` del select; agregar `tipoDocumento: true` y `numeroDocumento: true`. Estado final:

```typescript
const SELECT_CLIENTE_LISTA = {
  id: true,
  tipo: true,
  razonSocial: true,
  nombreComercial: true,
  tipoDocumento: true,
  numeroDocumento: true,
  ncr: true,
  sector: true,
  nombre: true,
  apellido: true,
  ocupacion: true,
  departamento: true,
  municipio: true,
  distrito: true,
  complemento: true,
  actividadEconomica: true,
  telefono: true,
  email: true,
  estado: true,
  notas: true,
  createdAt: true,
} as const
```

- [ ] **Step 2: Actualizar el bloque de búsqueda en `listarClientes`**

Reemplazar el bloque `if (busqueda)` por:

```typescript
if (busqueda) {
  // Normalizamos el término removiendo guiones para que la búsqueda funcione
  // sin importar cómo el usuario tipeo el documento (con o sin guiones).
  const sinGuiones = busqueda.replace(/-/g, '')
  where.OR = [
    { razonSocial:     { contains: busqueda, mode: 'insensitive' } },
    { nombreComercial: { contains: busqueda, mode: 'insensitive' } },
    { nombre:          { contains: busqueda, mode: 'insensitive' } },
    { apellido:        { contains: busqueda, mode: 'insensitive' } },
    { email:           { contains: busqueda, mode: 'insensitive' } },
    { numeroDocumento: { contains: busqueda, mode: 'insensitive' } },
    { numeroDocumento: { contains: sinGuiones, mode: 'insensitive' } },
    { ncr:             { contains: busqueda, mode: 'insensitive' } },
  ]
}
```

- [ ] **Step 3: Reescribir `verificarUnicidadCliente`**

Reemplazar la función completa por:

```typescript
async function verificarUnicidadCliente(dto: CrearClienteDto | ActualizarClienteDto, excludeId?: string) {
  const exclude = excludeId ? { id: { not: excludeId } } : {}

  if (dto.tipoDocumento && dto.numeroDocumento) {
    const dup = await prisma.cliente.findFirst({
      where: { tipoDocumento: dto.tipoDocumento, numeroDocumento: dto.numeroDocumento, ...exclude },
    })
    if (dup) throw new AppError(409, 'CONFLICT', `El ${dto.tipoDocumento} ya está registrado`)
  }

  if (dto.ncr) {
    const dupNcr = await prisma.cliente.findFirst({ where: { ncr: dto.ncr, ...exclude } })
    if (dupNcr) throw new AppError(409, 'CONFLICT', 'El NCR ya está registrado')
  }
}
```

- [ ] **Step 4: Actualizar el `camposDespues` de auditLog en `crearCliente`**

Reemplazar la línea `camposDespues: ...` dentro de `prisma.$transaction` por:

```typescript
camposDespues: dto.tipo === 'EMPRESA'
  ? { tipo: dto.tipo, razonSocial: dto.razonSocial, tipoDocumento: dto.tipoDocumento, numeroDocumento: dto.numeroDocumento }
  : { tipo: dto.tipo, nombre: dto.nombre, tipoDocumento: dto.tipoDocumento, numeroDocumento: dto.numeroDocumento },
```

- [ ] **Step 5: Verificar compilación**

Run: `pnpm tsc --noEmit`
Expected: cero errores en `clientes.service.ts`. Pueden persistir errores en `facturallama.service.ts` (siguiente task).

- [ ] **Step 6: Commit**

```bash
git add src/modules/clientes/clientes.service.ts
git commit -m "feat(cliente): adaptar service a tipoDocumento/numeroDocumento y busqueda normalizada

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 5: Actualizar `facturallama.types.ts`

**Files:**
- Modify: `src/modules/facturallama/facturallama.types.ts`

- [ ] **Step 1: Agregar `nrc` y `economicActivity` a `RecipientFC`**

Reemplazar la interface `RecipientFC` por:

```typescript
export interface RecipientFC {
  name: string
  commercialName?: string
  // nrc solo es valido cuando identificationDocument.type === 'NIT'.
  // FacturaLlama rechaza el payload (422) si se incluye con otro tipo.
  nrc?: string
  economicActivity?: string
  email?: string
  phone?: string
  address?: AddressPayload
  identificationDocument?: IdentificationDocumentPayload
}
```

- [ ] **Step 2: Verificar compilación**

Run: `pnpm tsc --noEmit`
Expected: errores en `facturallama.service.ts` (siguiente task); cero errores en `facturallama.types.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/modules/facturallama/facturallama.types.ts
git commit -m "feat(facturallama): agregar nrc y economicActivity opcionales a RecipientFC

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 6: Agregar helper `buildIdentificationDocument` y refactorizar `emitirFC`

**Files:**
- Modify: `src/modules/facturallama/facturallama.service.ts`

- [ ] **Step 1: Agregar el helper**

Insertarlo arriba de `emitirFC()` (cerca de los otros helpers como `soloDigitos`, `telefonoLocalDte`):

```typescript
// Mapea cliente.tipoDocumento + numeroDocumento al payload de FacturaLlama.
// Devuelve undefined si el cliente no tiene documento registrado — valido
// solamente en FC; el resto de DTE deben validar antes de llamar a este helper.
function buildIdentificationDocument(cliente: {
  tipoDocumento: import('@prisma/client').TipoDocumentoCliente | null
  numeroDocumento: string | null
}): IdentificationDocumentPayload | undefined {
  if (!cliente.tipoDocumento || !cliente.numeroDocumento) return undefined
  return { type: cliente.tipoDocumento, number: soloDigitos(cliente.numeroDocumento) }
}
```

(`IdentificationDocumentPayload` ya está importado en el archivo).

- [ ] **Step 2: Reescribir el bloque `recipient` de `emitirFC`**

Localizar el bloque actual (~líneas 203-218):

```typescript
const telefonoLocal = telefonoLocalDte(factura.cliente.telefono)
const comercial = nombreComercialDte(factura.cliente.nombreComercial)
const recipient: RecipientFC = {
  name: `${factura.cliente.nombre ?? ''} ${factura.cliente.apellido ?? ''}`.trim(),
  ...(comercial ? { commercialName: comercial } : {}),
  ...(factura.cliente.email ? { email: factura.cliente.email } : {}),
  ...(telefonoLocal ? { phone: telefonoLocal } : {}),
  address: {
    department:   factura.cliente.departamento,
    municipality: factura.cliente.municipio,
    complement:   factura.cliente.complemento,
  },
  ...(factura.cliente.dui ? {
    identificationDocument: { type: 'DUI', number: soloDigitos(factura.cliente.dui) },
  } : {}),
}
```

Reemplazarlo por:

```typescript
const telefonoLocal = telefonoLocalDte(factura.cliente.telefono)
const comercial = nombreComercialDte(factura.cliente.nombreComercial)
const idDoc = buildIdentificationDocument(factura.cliente)
// NRC solo se acepta en FC cuando identificationDocument.type === 'NIT'
// (regla MH/FacturaLlama). En cualquier otro tipo se omite del payload aunque
// el cliente lo tenga registrado en BD.
const incluyeNrc = idDoc?.type === 'NIT' && factura.cliente.ncr
const nombrePersona = `${factura.cliente.nombre ?? ''} ${factura.cliente.apellido ?? ''}`.trim()
const recipient: RecipientFC = {
  name: nombrePersona || factura.cliente.razonSocial || '',
  ...(comercial ? { commercialName: comercial } : {}),
  ...(incluyeNrc ? { nrc: soloDigitos(factura.cliente.ncr!) } : {}),
  ...(factura.cliente.actividadEconomica ? { economicActivity: factura.cliente.actividadEconomica } : {}),
  ...(factura.cliente.email ? { email: factura.cliente.email } : {}),
  ...(telefonoLocal ? { phone: telefonoLocal } : {}),
  address: {
    department:   factura.cliente.departamento,
    municipality: factura.cliente.municipio,
    complement:   factura.cliente.complemento,
  },
  ...(idDoc ? { identificationDocument: idDoc } : {}),
}
```

- [ ] **Step 3: Verificar compilación**

Run: `pnpm tsc --noEmit`
Expected: persisten errores en `emitirCCF`, `emitirSujetoExcluido`, `emitirNC` (siguientes tasks); `emitirFC` ya compila.

- [ ] **Step 4: Commit**

```bash
git add src/modules/facturallama/facturallama.service.ts
git commit -m "feat(facturallama): helper buildIdentificationDocument y refactor emitirFC con NRC condicional

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 7: Refactorizar `emitirCCF` con nueva validación

**Files:**
- Modify: `src/modules/facturallama/facturallama.service.ts`

- [ ] **Step 1: Agregar validación previa y reemplazar payload identification**

Localizar `emitirCCF()`. Después de la verificación `if (factura.estadoDTE !== 'PENDIENTE') ...` y antes de `const dteId = crypto.randomUUID()`, agregar:

```typescript
  // CCF exige DUI o NIT como tipo de documento y NCR registrado (regla MH).
  // Cualquier otro tipo (PASAPORTE/CARNET_RESIDENTE/OTRO) no es valido para CCF.
  if (!factura.cliente.tipoDocumento || (factura.cliente.tipoDocumento !== 'DUI' && factura.cliente.tipoDocumento !== 'NIT')) {
    throw new AppError(422, 'CLIENTE_INVALIDO_CCF', 'CCF requiere que el cliente tenga DUI o NIT como tipo de documento')
  }
  if (!factura.cliente.numeroDocumento) {
    throw new AppError(422, 'CLIENTE_INVALIDO_CCF', 'CCF requiere que el cliente tenga el numero de documento registrado')
  }
  if (!factura.cliente.ncr) {
    throw new AppError(422, 'CLIENTE_INVALIDO_CCF', 'CCF requiere que el cliente tenga NCR registrado')
  }
```

- [ ] **Step 2: Reemplazar `identificationDocument` hardcoded en el recipient**

Localizar dentro de `emitirCCF()` la línea:

```typescript
    identificationDocument: { type: 'NIT', number: soloDigitos(factura.cliente.nit ?? '') },
```

Reemplazarla por:

```typescript
    identificationDocument: { type: factura.cliente.tipoDocumento, number: soloDigitos(factura.cliente.numeroDocumento) },
```

(`factura.cliente.tipoDocumento` ya está garantizado a `DUI | NIT` por la validación anterior.)

- [ ] **Step 3: Verificar compilación**

Run: `pnpm tsc --noEmit`
Expected: persisten errores en `emitirSujetoExcluido`, `emitirNC`; `emitirCCF` compila.

- [ ] **Step 4: Commit**

```bash
git add src/modules/facturallama/facturallama.service.ts
git commit -m "feat(facturallama): emitirCCF valida tipoDocumento en {DUI,NIT} y NCR antes de emitir

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 8: Refactorizar `emitirSujetoExcluido` (FSE)

**Files:**
- Modify: `src/modules/facturallama/facturallama.service.ts`

- [ ] **Step 1: Reemplazar el bloque que arma `identificationDocument`**

Localizar (~líneas 307-312):

```typescript
  // FSE acepta DUI (persona natural) o NIT (jurídica). Tomamos el que el
  // cliente tenga registrado, priorizando NIT cuando ambos esten presentes
  // (caso de personas naturales con actividad empresarial registrada).
  const identificationDocument = factura.cliente.nit
    ? { type: 'NIT' as const, number: soloDigitos(factura.cliente.nit) }
    : { type: 'DUI' as const, number: soloDigitos(factura.cliente.dui ?? '') }
```

Reemplazarlo por:

```typescript
  // FSE acepta los cinco tipos de documento del cliente. Es obligatorio.
  const identificationDocument = buildIdentificationDocument(factura.cliente)
  if (!identificationDocument) {
    throw new AppError(422, 'CLIENTE_INVALIDO_FSE', 'FSE requiere que el cliente tenga documento de identidad registrado')
  }
```

- [ ] **Step 2: Verificar compilación**

Run: `pnpm tsc --noEmit`
Expected: persisten errores en `emitirNC`; `emitirSujetoExcluido` compila.

- [ ] **Step 3: Commit**

```bash
git add src/modules/facturallama/facturallama.service.ts
git commit -m "feat(facturallama): emitirFSE acepta los cinco tipos de documento

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 9: Refactorizar `emitirNC`

**Files:**
- Modify: `src/modules/facturallama/facturallama.service.ts`

- [ ] **Step 1: Reemplazar la rama CCF del NC**

Localizar dentro de `emitirNC()` el bloque `if (nc.factura.tipoDTE === 'CCF') {`. La línea problemática:

```typescript
      identificationDocument: { type: 'NIT', number: soloDigitos(cliente.nit ?? '') },
```

Antes de armar el `recipient`, agregar validación:

```typescript
  if (nc.factura.tipoDTE === 'CCF') {
    if (!cliente.tipoDocumento || (cliente.tipoDocumento !== 'DUI' && cliente.tipoDocumento !== 'NIT') || !cliente.numeroDocumento) {
      throw new AppError(422, 'CLIENTE_INVALIDO_NC_CCF', 'NC contra CCF requiere que el cliente tenga DUI o NIT registrado')
    }
    if (!cliente.ncr) {
      throw new AppError(422, 'CLIENTE_INVALIDO_NC_CCF', 'NC contra CCF requiere que el cliente tenga NCR registrado')
    }
    recipient = {
      name:             cliente.razonSocial ?? '',
      ...(comercialNC ? { commercialName: comercialNC } : {}),
      nrc:              soloDigitos(cliente.ncr),
      economicActivity: cliente.actividadEconomica ?? '',
      ...(cliente.email ? { email: cliente.email } : {}),
      ...(telefonoLocalNC ? { phone: telefonoLocalNC } : {}),
      address: {
        department:   cliente.departamento,
        municipality: cliente.municipio,
        complement:   cliente.complemento,
      },
      identificationDocument: { type: cliente.tipoDocumento, number: soloDigitos(cliente.numeroDocumento) },
    } satisfies RecipientCCF
  }
```

- [ ] **Step 2: Reemplazar la rama FC/FSE del NC**

Localizar el bloque `} else { // FC o FSE: receptor sin NRC. ...`. Reemplazar la lógica del `identificationDocument` por el helper:

```typescript
  } else {
    const nombre =
      cliente.nombreComercial?.trim() ||
      cliente.razonSocial?.trim() ||
      `${cliente.nombre ?? ''} ${cliente.apellido ?? ''}`.trim()
    const identificationDocument = buildIdentificationDocument(cliente)
    if (!identificationDocument) {
      throw new AppError(422, 'CLIENTE_INVALIDO_NC', 'NC contra FC/FSE requiere que el cliente tenga documento de identidad registrado')
    }
    recipient = {
      name: nombre,
      ...(comercialNC ? { commercialName: comercialNC } : {}),
      contributorType: cliente.tipo === 'EMPRESA' ? 'JURIDICA' : 'NATURAL',
      ...(cliente.actividadEconomica ? { economicActivity: cliente.actividadEconomica } : {}),
      ...(cliente.email ? { email: cliente.email } : {}),
      ...(telefonoLocalNC ? { phone: telefonoLocalNC } : {}),
      address: {
        department:   cliente.departamento,
        municipality: cliente.municipio,
        complement:   cliente.complemento,
      },
      identificationDocument,
    } satisfies RecipientFSE
  }
```

- [ ] **Step 3: Verificar compilación completa**

Run: `pnpm tsc --noEmit`
Expected: cero errores en `src/modules/facturallama/`.

- [ ] **Step 4: Commit**

```bash
git add src/modules/facturallama/facturallama.service.ts
git commit -m "feat(facturallama): emitirNC adapta validacion segun tipoDTE original con nuevo modelo

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 10: Helper Handlebars `labelTipoDoc` y plantillas PDF

**Files:**
- Modify: `src/modules/pdf/pdf.service.ts`
- Modify: `src/modules/pdf/templates/factura.hbs`
- Modify: `src/modules/pdf/templates/cotizacion.hbs`
- Modify: `src/modules/pdf/templates/nota-credito.hbs`

- [ ] **Step 1: Localizar el bloque de registro de Handlebars helpers en `pdf.service.ts`**

Run: `grep -n "Handlebars.registerHelper" src/modules/pdf/pdf.service.ts`
Identificar el bloque donde se registran los helpers existentes.

- [ ] **Step 2: Registrar el helper `labelTipoDoc`**

Agregar al bloque de helpers (donde estén los otros `Handlebars.registerHelper(...)`):

```typescript
// Etiqueta legible del tipo de documento para mostrar en PDFs.
Handlebars.registerHelper('labelTipoDoc', (tipo: string | null | undefined): string => {
  switch (tipo) {
    case 'DUI': return 'DUI'
    case 'NIT': return 'NIT'
    case 'PASAPORTE': return 'Pasaporte'
    case 'CARNET_RESIDENTE': return 'Carnet de residente'
    case 'OTRO': return 'Documento'
    default: return ''
  }
})
```

- [ ] **Step 3: Actualizar `factura.hbs`**

Run: `grep -n "cliente.dui\|cliente.nit" src/modules/pdf/templates/factura.hbs`

Reemplazar cualquier bloque del tipo:
```handlebars
{{#if cliente.dui}}DUI: {{cliente.dui}}<br>{{/if}}
{{#if cliente.nit}}NIT: {{cliente.nit}}<br>{{/if}}
```

Por:
```handlebars
{{#if cliente.tipoDocumento}}{{labelTipoDoc cliente.tipoDocumento}}: {{cliente.numeroDocumento}}<br>{{/if}}
{{#if cliente.ncr}}NCR: {{cliente.ncr}}<br>{{/if}}
```

(Si NCR ya tiene su propio bloque, no duplicarlo.)

- [ ] **Step 4: Actualizar `cotizacion.hbs`**

Misma lógica que Step 3 — `grep -n "cliente.dui\|cliente.nit" src/modules/pdf/templates/cotizacion.hbs` y reemplazar.

- [ ] **Step 5: Actualizar `nota-credito.hbs`**

Misma lógica — `grep -n "cliente.dui\|cliente.nit" src/modules/pdf/templates/nota-credito.hbs` y reemplazar.

- [ ] **Step 6: Verificar que ningún template referencia `dui` o `nit` directamente**

Run: `grep -rn "cliente\.dui\|cliente\.nit" src/modules/pdf/templates/`
Expected: sin resultados.

- [ ] **Step 7: Verificar compilación**

Run: `pnpm tsc --noEmit`
Expected: cero errores.

- [ ] **Step 8: Commit**

```bash
git add src/modules/pdf
git commit -m "feat(pdf): helper labelTipoDoc y plantillas usan tipoDocumento/numeroDocumento

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 11: Actualizar tests de `clientes.service`

**Files:**
- Modify: `tests/modules/clientes/clientes.service.test.ts`

- [ ] **Step 1: Actualizar `mockCliente` y DTOs base**

Localizar `mockCliente` (~líneas 31-53). Reemplazar el bloque por:

```typescript
const mockCliente = {
  id: 'cli-1',
  tipo: 'EMPRESA' as const,
  razonSocial: 'Reinar S.A.',
  nombreComercial: 'Reinar',
  tipoDocumento: 'NIT' as const,
  numeroDocumento: '0614-123456-001-0',
  ncr: '123456',
  sector: 'Construcción',
  nombre: null,
  apellido: null,
  ocupacion: null,
  departamento: '06',
  municipio: '14',
  complemento: 'Calle Principal 123',
  actividadEconomica: null,
  telefono: '2222-3333',
  email: 'info@reinar.com',
  estado: 'ACTIVO' as const,
  notas: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

const dtoEmpresa = {
  tipo: 'EMPRESA' as const,
  razonSocial: 'Reinar S.A.',
  tipoDocumento: 'NIT' as const,
  numeroDocumento: '0614-123456-001-0',
  ncr: '123456',
  nombreComercial: 'Reinar',
  departamento: '06',
  municipio: '14',
  complemento: 'Calle Principal 123',
}

const dtoParticular = {
  tipo: 'PARTICULAR' as const,
  nombre: 'Juan',
  departamento: '06',
  municipio: '14',
  complemento: 'Col. San Benito 45',
}
```

- [ ] **Step 2: Eliminar el import de `crearClienteEmpresaSchema`**

Localizar y eliminar `import { crearClienteEmpresaSchema } from '../../../src/modules/clientes/clientes.schemas'` (no existe en el archivo y no se usa).

- [ ] **Step 3: Run tests existentes para detectar fallos**

Run: `pnpm vitest run tests/modules/clientes/clientes.service.test.ts`
Expected: pueden fallar tests que esperaban mensajes con "DUI" o "NIT"; actualizar mensajes a "El NIT ya está registrado" → "El NIT ya está registrado" (sin cambio si dto.tipoDocumento === 'NIT') o "El DUI ya está registrado".

- [ ] **Step 4: Agregar test para cada tipo de documento PARTICULAR**

Agregar al final del describe `crearCliente` (o como describe nuevo):

```typescript
describe('crearCliente con cada tipo de documento', () => {
  const tipos = ['DUI', 'NIT', 'PASAPORTE', 'CARNET_RESIDENTE', 'OTRO'] as const
  const numeros: Record<typeof tipos[number], string> = {
    DUI: '12345678-9',
    NIT: '0614-140346-001-7',
    PASAPORTE: 'AB1234567',
    CARNET_RESIDENTE: 'CR12345678',
    OTRO: 'DOC-001',
  }

  for (const tipo of tipos) {
    it(`acepta PARTICULAR con tipoDocumento=${tipo}`, async () => {
      ;(prismaMock.cliente.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
      ;(prismaMock.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: any) => fn({
        cliente: { create: vi.fn().mockResolvedValue({ ...mockCliente, tipo: 'PARTICULAR', tipoDocumento: tipo, numeroDocumento: numeros[tipo] }) },
        auditLog: { create: vi.fn() },
      }))
      const res = await crearCliente(
        { ...dtoParticular, tipoDocumento: tipo, numeroDocumento: numeros[tipo] } as any,
        'user-1',
      )
      expect(res.tipoDocumento).toBe(tipo)
    })
  }
})
```

- [ ] **Step 5: Agregar test que rechaza EMPRESA con tipo distinto a DUI/NIT**

Agregar:

```typescript
describe('crearClienteSchema (validacion)', () => {
  it('rechaza EMPRESA con tipoDocumento=PASAPORTE', () => {
    const result = (require('../../../src/modules/clientes/clientes.schemas') as typeof import('../../../src/modules/clientes/clientes.schemas')).crearClienteSchema.safeParse({
      ...dtoEmpresa,
      tipoDocumento: 'PASAPORTE',
      numeroDocumento: 'AB1234567',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('tipoDocumento'))).toBe(true)
    }
  })

  it('rechaza numeroDocumento con formato invalido para DUI', () => {
    const result = (require('../../../src/modules/clientes/clientes.schemas') as typeof import('../../../src/modules/clientes/clientes.schemas')).crearClienteSchema.safeParse({
      ...dtoParticular,
      tipoDocumento: 'DUI',
      numeroDocumento: '123',
    })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 6: Run tests del módulo y asegurar verde**

Run: `pnpm vitest run tests/modules/clientes/clientes.service.test.ts`
Expected: todos los tests pasan.

- [ ] **Step 7: Commit**

```bash
git add tests/modules/clientes/clientes.service.test.ts
git commit -m "test(clientes): cubrir nuevos campos tipoDocumento/numeroDocumento y reglas por tipo

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 12: Actualizar tests de `facturallama.service`

**Files:**
- Modify: `tests/modules/facturallama/facturallama.service.test.ts`

- [ ] **Step 1: Actualizar `FACTURA_BASE.cliente`**

Reemplazar el bloque `cliente: { ... }` por:

```typescript
  cliente: {
    tipo: 'PARTICULAR',
    nombre: 'Juan',
    apellido: 'Pérez',
    email: 'juan@email.com',
    telefono: '78001234',
    departamento: '06',
    municipio: '0601',
    complemento: 'Col. Escalón',
    tipoDocumento: 'DUI',
    numeroDocumento: '01234567-8',
    ncr: null,
    actividadEconomica: null,
    razonSocial: null,
    nombreComercial: null,
  },
```

- [ ] **Step 2: Agregar tests del helper `buildIdentificationDocument`**

Si el helper no está exportado, exportarlo desde `facturallama.service.ts` (`export function buildIdentificationDocument`).

Agregar al final del archivo de test:

```typescript
import { buildIdentificationDocument } from '../../../src/modules/facturallama/facturallama.service'

describe('buildIdentificationDocument', () => {
  it('mapea DUI removiendo guiones', () => {
    const r = buildIdentificationDocument({ tipoDocumento: 'DUI', numeroDocumento: '12345678-9' })
    expect(r).toEqual({ type: 'DUI', number: '123456789' })
  })

  it('mapea NIT removiendo guiones', () => {
    const r = buildIdentificationDocument({ tipoDocumento: 'NIT', numeroDocumento: '0614-140346-001-7' })
    expect(r).toEqual({ type: 'NIT', number: '06141403460017' })
  })

  it('mapea PASAPORTE sin transformar', () => {
    const r = buildIdentificationDocument({ tipoDocumento: 'PASAPORTE', numeroDocumento: 'AB1234567' })
    expect(r).toEqual({ type: 'PASAPORTE', number: 'AB1234567' })
  })

  it('devuelve undefined cuando falta tipoDocumento o numeroDocumento', () => {
    expect(buildIdentificationDocument({ tipoDocumento: null, numeroDocumento: null })).toBeUndefined()
    expect(buildIdentificationDocument({ tipoDocumento: 'DUI', numeroDocumento: null })).toBeUndefined()
    expect(buildIdentificationDocument({ tipoDocumento: null, numeroDocumento: '12345' })).toBeUndefined()
  })
})
```

- [ ] **Step 3: Agregar test de NRC condicional en FC**

Agregar dentro del `describe('emitirFC', ...)`:

```typescript
it('incluye nrc en el payload cuando tipoDocumento=NIT y cliente tiene NCR', async () => {
  const factura = {
    ...FACTURA_BASE,
    cliente: { ...FACTURA_BASE.cliente, tipoDocumento: 'NIT', numeroDocumento: '0614-140346-001-7', ncr: '9166-9' },
  }
  prismaMock.factura.findUnique.mockResolvedValue(factura as any)
  prismaMock.factura.update.mockResolvedValue({} as any)
  const mockResponse = {
    ok: true,
    status: 200,
    json: async () => ({ id: 'dte-001', controlNumber: 'CN', status: 'APPROVED', mhResponse: {} }),
  }
  ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

  await emitirFC('fac-001')

  const fetchArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
  const body = JSON.parse((fetchArgs[1] as { body: string }).body)
  expect(body.recipient.nrc).toBe('91669')
  expect(body.recipient.identificationDocument).toEqual({ type: 'NIT', number: '06141403460017' })
})

it('omite nrc en el payload cuando tipoDocumento=DUI aunque el cliente tenga NCR', async () => {
  const factura = {
    ...FACTURA_BASE,
    cliente: { ...FACTURA_BASE.cliente, tipoDocumento: 'DUI', numeroDocumento: '12345678-9', ncr: '9166-9' },
  }
  prismaMock.factura.findUnique.mockResolvedValue(factura as any)
  prismaMock.factura.update.mockResolvedValue({} as any)
  const mockResponse = {
    ok: true,
    status: 200,
    json: async () => ({ id: 'dte-001', controlNumber: 'CN', status: 'APPROVED', mhResponse: {} }),
  }
  ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

  await emitirFC('fac-001')

  const fetchArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
  const body = JSON.parse((fetchArgs[1] as { body: string }).body)
  expect(body.recipient.nrc).toBeUndefined()
  expect(body.recipient.identificationDocument).toEqual({ type: 'DUI', number: '123456789' })
})
```

- [ ] **Step 4: Agregar test de validación en CCF**

```typescript
describe('emitirCCF validaciones', () => {
  it('rechaza con 422 cuando tipoDocumento es PASAPORTE', async () => {
    const factura = {
      ...FACTURA_BASE,
      cliente: { ...FACTURA_BASE.cliente, tipoDocumento: 'PASAPORTE', numeroDocumento: 'AB1234567', ncr: '9166-9' },
    }
    prismaMock.factura.findUnique.mockResolvedValue(factura as any)
    prismaMock.factura.update.mockResolvedValue({} as any)
    await expect(emitirCCF('fac-001')).rejects.toThrow(AppError)
    await expect(emitirCCF('fac-001')).rejects.toMatchObject({ statusCode: 422 })
  })

  it('rechaza con 422 cuando falta NCR', async () => {
    const factura = {
      ...FACTURA_BASE,
      cliente: { ...FACTURA_BASE.cliente, tipoDocumento: 'NIT', numeroDocumento: '0614-140346-001-7', ncr: null },
    }
    prismaMock.factura.findUnique.mockResolvedValue(factura as any)
    prismaMock.factura.update.mockResolvedValue({} as any)
    await expect(emitirCCF('fac-001')).rejects.toThrow(AppError)
  })
})
```

- [ ] **Step 5: Run tests del módulo**

Run: `pnpm vitest run tests/modules/facturallama/facturallama.service.test.ts`
Expected: todos los tests pasan.

- [ ] **Step 6: Commit**

```bash
git add tests/modules/facturallama/facturallama.service.test.ts src/modules/facturallama/facturallama.service.ts
git commit -m "test(facturallama): cubrir buildIdentificationDocument, NRC condicional en FC y validaciones CCF

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 13: Run completo de la suite de tests del backend

- [ ] **Step 1: Run all tests**

Run: `pnpm vitest run`
Expected: toda la suite pasa. Si fallan tests en otros módulos (cotizaciones, facturas, etc.) por consumo indirecto de `cliente.dui` / `cliente.nit`, actualizarlos en su lugar siguiendo el mismo patrón (reemplazar mocks).

- [ ] **Step 2: tsc --noEmit final**

Run: `pnpm tsc --noEmit`
Expected: cero errores.

- [ ] **Step 3: Commit de cualquier fix incidental**

```bash
git add <archivos modificados>
git commit -m "test: actualizar mocks afectados por cambio dui/nit -> tipoDocumento/numeroDocumento

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

# Frontend (frontend/)

> Todas las tasks del frontend se ejecutan con `cwd = /Users/joaquinmorales13a06/Desktop/Reinar/frontend`.

## Task 14: Extender `lib/format-documentos.ts`

**Files:**
- Modify: `lib/format-documentos.ts`

- [ ] **Step 1: Agregar tipos, labels y helpers nuevos**

Agregar al final del archivo:

```typescript
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
```

- [ ] **Step 2: Verificar compilación**

Run: `pnpm tsc --noEmit`
Expected: cero errores en `lib/format-documentos.ts`. (Aún pueden existir errores en componentes — tasks siguientes.)

- [ ] **Step 3: Commit**

```bash
git add lib/format-documentos.ts
git commit -m "feat(lib): helpers para tipoDocumento multi-tipo (formato, validacion, labels)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 15: Actualizar `types/api.ts`

**Files:**
- Modify: `types/api.ts`

- [ ] **Step 1: Localizar el tipo `Cliente`**

Run: `grep -n "dui\|nit" types/api.ts`

- [ ] **Step 2: Actualizar el tipo `Cliente`**

Reemplazar las propiedades `dui?: string | null` y `nit?: string | null` por:

```typescript
tipoDocumento?: 'DUI' | 'NIT' | 'PASAPORTE' | 'CARNET_RESIDENTE' | 'OTRO' | null;
numeroDocumento?: string | null;
```

- [ ] **Step 3: Verificar compilación — detectar consumidores**

Run: `pnpm tsc --noEmit 2>&1 | head -50`
Expected: errores listando todos los archivos que aún usan `cliente.dui` o `cliente.nit`. Tomar nota de la lista para resolver en tasks siguientes.

- [ ] **Step 4: Commit**

```bash
git add types/api.ts
git commit -m "types(cliente): reemplazar dui y nit por tipoDocumento y numeroDocumento

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 16: Reescribir el formulario `ClienteForm.tsx`

**Files:**
- Modify: `components/clientes/ClienteForm.tsx`

- [ ] **Step 1: Actualizar imports y agregar nuevos**

Reemplazar la línea de import desde `format-documentos`:

```typescript
import {
  formatDocumento,
  validarDocumento,
  TIPOS_DOCUMENTO_PARTICULAR,
  TIPOS_DOCUMENTO_EMPRESA,
  LABEL_TIPO_DOCUMENTO,
  PLACEHOLDER_POR_TIPO,
  MAXLENGTH_POR_TIPO,
  MENSAJE_FORMATO_DOCUMENTO,
  formatNCR,
  type TipoDocumentoCliente,
} from '@/lib/format-documentos';
```

(Eliminar `formatNIT, formatDUI, formatNitFlexible` del import si no se usan en otra parte del archivo — confirmar tras los reemplazos.)

- [ ] **Step 2: Reemplazar el schema Zod completo**

Sustituir el `const schema = z.object({...}).superRefine(...)` por:

```typescript
const schema = z.object({
  tipo: z.enum(['EMPRESA', 'PARTICULAR']),
  razonSocial: z.string().optional(),
  nombreComercial: z.string().optional(),
  sector: z.string().optional(),
  actividadEconomica: z.string().optional(),
  nombre: z.string().optional(),
  apellido: z.string().optional(),
  ocupacion: z.string().optional(),
  tipoDocumento: z.enum(['DUI', 'NIT', 'PASAPORTE', 'CARNET_RESIDENTE', 'OTRO']).optional().or(z.literal('')),
  numeroDocumento: z.string().optional(),
  ncr: z.string().optional(),
  departamento: z.string().min(1, 'El departamento es obligatorio.'),
  municipio: z.string().min(1),
  distrito: z.string().optional(),
  complemento: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().optional(),
  notas: z.string().optional(),
  estado: z.enum(['ACTIVO', 'INACTIVO', 'PROSPECTO']),
}).superRefine((d, ctx) => {
  if (d.tipo === 'EMPRESA') {
    if (!d.razonSocial?.trim())
      ctx.addIssue({ code: 'custom', path: ['razonSocial'], message: 'La razón social es obligatoria.' });
    if (d.tipoDocumento && d.tipoDocumento !== 'DUI' && d.tipoDocumento !== 'NIT')
      ctx.addIssue({ code: 'custom', path: ['tipoDocumento'], message: 'EMPRESA solo acepta DUI o NIT.' });
  } else {
    if (!d.nombre?.trim())
      ctx.addIssue({ code: 'custom', path: ['nombre'], message: 'El nombre es obligatorio.' });
  }
  // Validación del par tipoDocumento + numeroDocumento
  const tipoDoc = d.tipoDocumento && d.tipoDocumento !== '' ? d.tipoDocumento : undefined;
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

- [ ] **Step 3: Actualizar `DEFAULTS`**

Reemplazar el objeto `DEFAULTS`:

```typescript
const DEFAULTS: FormData = {
  tipo: 'EMPRESA',
  razonSocial: '', nombreComercial: '', sector: '', actividadEconomica: '',
  nombre: '', apellido: '', ocupacion: '',
  tipoDocumento: '', numeroDocumento: '', ncr: '',
  departamento: '', municipio: '', distrito: '',
  complemento: '', telefono: '', email: '', notas: '',
  estado: 'ACTIVO',
};
```

- [ ] **Step 4: Eliminar el toggle `nitDistintoDelDui` y su lógica**

Eliminar:
1. La línea `const [nitDistintoDelDui, setNitDistintoDelDui] = useState(false);` (y su comentario superior).
2. El bloque dentro del `useEffect(() => { if (existing) { ... } })` que setea `setNitDistintoDelDui(true|false)`.
3. La línea `const duiReg = register('dui');`.
4. La línea `const nitReg = register('nit');`.
5. El bloque en `onSubmit` que rellena `data.nit = data.dui` cuando `!nitDistintoDelDui`.

- [ ] **Step 5: Agregar registers para los campos nuevos**

Reemplazar la línea eliminada de `nitReg`/`duiReg` por:

```typescript
const tipoDocumentoValue = watch('tipoDocumento');
const numeroDocReg = register('numeroDocumento');
```

- [ ] **Step 6: Reemplazar la sección PARTICULAR del formulario**

Localizar el bloque `{tipo === 'EMPRESA' ? (...) : (<>...</>)}` dentro de `<FormSection title="Datos personales">`. La rama `else` actual (PARTICULAR, ~líneas 332-413) se reemplaza por:

```tsx
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">Nombre <span className="text-danger">*</span></label>
                  <input className={errors.nombre ? inputErr : inputOk} {...register('nombre')} placeholder="Juan Carlos" />
                  {errors.nombre && <p className="text-xs text-danger mt-0.5">{errors.nombre.message}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">Apellido</label>
                  <input className={inputOk} {...register('apellido')} placeholder="Hernández Pérez" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">Tipo de documento</label>
                  <select
                    className={errors.tipoDocumento ? inputErr : inputOk}
                    {...register('tipoDocumento')}
                    onChange={(e) => {
                      register('tipoDocumento').onChange(e);
                      setValue('numeroDocumento', '');
                    }}
                  >
                    <option value="">— Seleccionar —</option>
                    {TIPOS_DOCUMENTO_PARTICULAR.map((t) => (
                      <option key={t} value={t}>{LABEL_TIPO_DOCUMENTO[t]}</option>
                    ))}
                  </select>
                  {errors.tipoDocumento && <p className="text-xs text-danger mt-0.5">{errors.tipoDocumento.message}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">Número del documento</label>
                  <input
                    className={`${errors.numeroDocumento ? inputErr : inputOk} ${monoBase}`}
                    inputMode={tipoDocumentoValue === 'DUI' || tipoDocumentoValue === 'NIT' ? 'numeric' : 'text'}
                    maxLength={tipoDocumentoValue ? MAXLENGTH_POR_TIPO[tipoDocumentoValue as TipoDocumentoCliente] : 25}
                    placeholder={tipoDocumentoValue ? PLACEHOLDER_POR_TIPO[tipoDocumentoValue as TipoDocumentoCliente] : 'Seleccioná un tipo primero'}
                    disabled={!tipoDocumentoValue}
                    {...numeroDocReg}
                    onChange={(e) => {
                      if (tipoDocumentoValue) {
                        e.target.value = formatDocumento(tipoDocumentoValue as TipoDocumentoCliente, e.target.value);
                      }
                      void numeroDocReg.onChange(e);
                    }}
                  />
                  {errors.numeroDocumento && <p className="text-xs text-danger mt-0.5">{errors.numeroDocumento.message}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">Ocupación</label>
                  <input className={inputOk} {...register('ocupacion')} placeholder="Ej. Arquitecto independiente" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">NCR (opcional)</label>
                  <input
                    className={`${errors.ncr ? inputErr : inputOk} ${monoBase}`}
                    inputMode="numeric"
                    maxLength={8}
                    {...register('ncr')}
                    onChange={(e) => {
                      e.target.value = formatNCR(e.target.value);
                      void register('ncr').onChange(e);
                    }}
                    placeholder="9166-9 o 183456-7"
                  />
                  <p className="text-xs text-tx-3 mt-0.5">
                    El NCR solo se incluye en CCF o en FC cuando el documento es NIT.
                  </p>
                  {errors.ncr && <p className="text-xs text-danger mt-0.5">{errors.ncr.message}</p>}
                </div>
              </>
```

- [ ] **Step 7: Reemplazar la sección EMPRESA del formulario**

Localizar la rama `if` (EMPRESA, ~líneas 247-330). Reemplazar el bloque NIT/NCR por el patrón uniforme con dropdown:

Justo después del input de "Razón social" (`<div className="flex flex-col gap-1 sm:col-span-2">...razonSocial...</div>`), reemplazar los siguientes bloques (NIT, NCR) por:

```tsx
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">Tipo de documento</label>
                  <select
                    className={errors.tipoDocumento ? inputErr : inputOk}
                    {...register('tipoDocumento')}
                    onChange={(e) => {
                      register('tipoDocumento').onChange(e);
                      setValue('numeroDocumento', '');
                    }}
                  >
                    <option value="">— Seleccionar —</option>
                    {TIPOS_DOCUMENTO_EMPRESA.map((t) => (
                      <option key={t} value={t}>{LABEL_TIPO_DOCUMENTO[t]}</option>
                    ))}
                  </select>
                  {errors.tipoDocumento && <p className="text-xs text-danger mt-0.5">{errors.tipoDocumento.message}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">Número del documento</label>
                  <input
                    className={`${errors.numeroDocumento ? inputErr : inputOk} ${monoBase}`}
                    inputMode="numeric"
                    maxLength={tipoDocumentoValue ? MAXLENGTH_POR_TIPO[tipoDocumentoValue as TipoDocumentoCliente] : 17}
                    placeholder={tipoDocumentoValue ? PLACEHOLDER_POR_TIPO[tipoDocumentoValue as TipoDocumentoCliente] : 'Seleccioná un tipo primero'}
                    disabled={!tipoDocumentoValue}
                    {...numeroDocReg}
                    onChange={(e) => {
                      if (tipoDocumentoValue) {
                        e.target.value = formatDocumento(tipoDocumentoValue as TipoDocumentoCliente, e.target.value);
                      }
                      void numeroDocReg.onChange(e);
                    }}
                  />
                  {errors.numeroDocumento && <p className="text-xs text-danger mt-0.5">{errors.numeroDocumento.message}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tx-2">NCR</label>
                  <input
                    className={`${errors.ncr ? inputErr : inputOk} ${monoBase}`}
                    inputMode="numeric"
                    maxLength={8}
                    {...register('ncr')}
                    onChange={(e) => {
                      e.target.value = formatNCR(e.target.value);
                      void register('ncr').onChange(e);
                    }}
                    placeholder="9166-9 o 183456-7"
                  />
                  {errors.ncr && <p className="text-xs text-danger mt-0.5">{errors.ncr.message}</p>}
                </div>
```

(El resto de la sección EMPRESA — nombre comercial, sector, actividad económica — se mantiene sin cambios.)

- [ ] **Step 8: Verificar compilación**

Run: `pnpm tsc --noEmit 2>&1 | grep ClienteForm`
Expected: cero errores específicos a `ClienteForm.tsx`.

- [ ] **Step 9: Commit**

```bash
git add components/clientes/ClienteForm.tsx
git commit -m "feat(cliente): reemplazar inputs DUI/NIT por dropdown tipoDocumento + input numeroDocumento

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 17: Actualizar `ClienteDetalle.tsx`

**Files:**
- Modify: `components/clientes/ClienteDetalle.tsx`

- [ ] **Step 1: Localizar usos de dui y nit**

Run: `grep -n "cliente.dui\|cliente.nit" components/clientes/ClienteDetalle.tsx`

- [ ] **Step 2: Agregar import del label**

Agregar al top del archivo (si no está):

```typescript
import { LABEL_TIPO_DOCUMENTO } from '@/lib/format-documentos';
```

- [ ] **Step 3: Reemplazar render de DUI/NIT**

Reemplazar bloques como `{cliente.dui && <div>DUI: {cliente.dui}</div>}` y `{cliente.nit && <div>NIT: {cliente.nit}</div>}` por una sola línea:

```tsx
{cliente.tipoDocumento && cliente.numeroDocumento && (
  <div>{LABEL_TIPO_DOCUMENTO[cliente.tipoDocumento]}: <span className="font-mono">{cliente.numeroDocumento}</span></div>
)}
```

(Mantener el wrapper y el styling del bloque previo — el contenido es lo que cambia.)

- [ ] **Step 4: Verificar compilación**

Run: `pnpm tsc --noEmit 2>&1 | grep ClienteDetalle`
Expected: cero errores.

- [ ] **Step 5: Commit**

```bash
git add components/clientes/ClienteDetalle.tsx
git commit -m "feat(cliente): detalle muestra etiqueta + numero del documento

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 18: Actualizar `ClientesList.tsx`

**Files:**
- Modify: `components/clientes/ClientesList.tsx`

- [ ] **Step 1: Localizar usos**

Run: `grep -n "\.dui\|\.nit" components/clientes/ClientesList.tsx`

- [ ] **Step 2: Reemplazar columna/celda**

Si hay una columna que muestra DUI o NIT, reemplazarla por una columna "Documento" que renderiza `{LABEL_TIPO_DOCUMENTO[cliente.tipoDocumento]}: {cliente.numeroDocumento}`. Importar `LABEL_TIPO_DOCUMENTO` desde `@/lib/format-documentos`.

Patrón:
```tsx
{c.tipoDocumento && c.numeroDocumento ? (
  <span className="font-mono text-xs">
    {LABEL_TIPO_DOCUMENTO[c.tipoDocumento]}: {c.numeroDocumento}
  </span>
) : (
  <span className="text-tx-3">—</span>
)}
```

- [ ] **Step 3: Verificar compilación**

Run: `pnpm tsc --noEmit 2>&1 | grep ClientesList`
Expected: cero errores.

- [ ] **Step 4: Commit**

```bash
git add components/clientes/ClientesList.tsx
git commit -m "feat(cliente): listado muestra tipo + numero del documento en columna unificada

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 19: Auditar consumidores restantes vía `tsc --noEmit`

- [ ] **Step 1: Run completo de TypeScript**

Run: `pnpm tsc --noEmit 2>&1 | tee /tmp/tsc-errors.log`
Expected: cualquier error pendiente apunta a un consumidor que aún lee `cliente.dui` o `cliente.nit`.

- [ ] **Step 2: Procesar errores uno por uno**

Para cada archivo con error:
1. Abrir el archivo
2. Reemplazar `cliente.dui` por la lógica que corresponda (lo más común: mostrar `{cliente.tipoDocumento}: {cliente.numeroDocumento}` con `LABEL_TIPO_DOCUMENTO`)
3. Reemplazar `cliente.nit` por la misma lógica
4. Si el contexto era buscar específicamente por DUI/NIT (ej. filtros): adaptarlo a `tipoDocumento === 'DUI'` o `tipoDocumento === 'NIT'`

Archivos a revisar (lista no exhaustiva — el tsc decide):
- `components/cotizaciones/CotizacionForm.tsx` (probable: muestra datos del cliente o selecciona tipoDocumentoFiscal)
- `components/facturas/*`
- Cualquier vista que muestre identificación del cliente

- [ ] **Step 3: Verificar 0 errores TypeScript**

Run: `pnpm tsc --noEmit`
Expected: cero errores.

- [ ] **Step 4: Run lint**

Run: `pnpm lint`
Expected: cero errores ESLint.

- [ ] **Step 5: Commit (si hubo cambios)**

```bash
git add <archivos modificados>
git commit -m "refactor: actualizar consumidores restantes de cliente.dui/nit al nuevo modelo

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 20: Verificación E2E manual

Backend `pnpm dev` corriendo en `:3000`, frontend `pnpm dev` en `:3001`.

- [ ] **Step 1: Verificar listado de clientes (datos migrados)**

Visitar `http://localhost:3001/clientes`. Confirmar:
- Cada cliente migrado muestra su tipo + número (los que tenían NIT antes muestran "NIT: XXXX-..."; los que solo tenían DUI muestran "DUI: ...")
- Búsqueda por número (con guiones) encuentra al cliente
- Búsqueda por número (sin guiones) encuentra al cliente

- [ ] **Step 2: Crear PARTICULAR con cada tipo de documento**

Para cada tipo en `[DUI, NIT, PASAPORTE, CARNET_RESIDENTE, OTRO]`:
1. Visitar `/clientes/nuevo`
2. Tipo: Particular
3. Tipo de documento: <el tipo>
4. Número del documento: usar un valor válido para el formato (ej. `AB1234567` para PASAPORTE)
5. Llenar departamento/municipio
6. Guardar → verificar que aparece en el listado con la etiqueta correcta

- [ ] **Step 3: Validar errores de formato**

En `/clientes/nuevo`, tipo Particular:
1. Tipo de documento: DUI
2. Número: `123` (inválido)
3. Submit → debe mostrar "Formato: NNNNNNNN-N"
4. Cambiar tipo a PASAPORTE, número: `xx` (muy corto) → debe mostrar mensaje de pasaporte

- [ ] **Step 4: EMPRESA con NIT y con DUI**

1. Crear EMPRESA con tipoDocumento=NIT, número 14d
2. Crear otra EMPRESA con tipoDocumento=DUI, número 9d
3. Confirmar que el dropdown EMPRESA solo muestra NIT y DUI (no Pasaporte/Carnet/Otro)

- [ ] **Step 5: Editar cliente legacy migrado**

1. Abrir un cliente que existía antes de la migración
2. Verificar que el dropdown carga el tipo correcto y el número aparece
3. Cambiar el tipo y guardar — confirmar que el cambio se persiste

- [ ] **Step 6: Generar PDF de factura con cliente PASAPORTE**

1. Crear cliente PARTICULAR con tipoDocumento=PASAPORTE
2. Crear cotización y factura para ese cliente
3. Generar PDF → confirmar que muestra "Pasaporte: AB1234567" (o lo que sea)

- [ ] **Step 7: Intentar emitir CCF para cliente PASAPORTE**

1. Crear factura con tipoDocumentoFiscal=CCF para un cliente con tipoDocumento=PASAPORTE
2. Emitir → debe fallar con error 422 y mensaje claro ("CCF requiere DUI o NIT")

- [ ] **Step 8: Reportar resultados al usuario**

Si todo pasa, listar lo verificado.
Si algo falla, identificar el componente y abrir una task de fix.

## Task 21: Crear los PRs

- [ ] **Step 1: Push del branch del servidor**

Run desde `/Users/joaquinmorales13a06/Desktop/Reinar/server`:
```bash
git push -u origin feat/clientes-tipo-documento
```

- [ ] **Step 2: Crear PR del servidor**

```bash
gh pr create --title "feat(cliente): tipo de documento multi-tipo (DUI/NIT/PASAPORTE/CARNET_RESIDENTE/OTRO)" --body "$(cat <<'EOF'
## Summary
- Reemplaza columnas `dui` y `nit` por par `tipoDocumento` (enum) + `numeroDocumento` en `Cliente`
- Migración SQL con backfill legacy: prioriza NIT 14d, fallback a DUI
- Emisión DTE adaptada: CCF restringido a DUI/NIT con NRC; FC incluye NRC solo cuando type=NIT; FSE acepta los 5 tipos
- Plantillas PDF y búsqueda actualizadas

## Test plan
- [ ] `pnpm vitest run` pasa completo
- [ ] `pnpm tsc --noEmit` sin errores
- [ ] Migración aplicada sin pérdida de datos en clientes existentes
- [ ] Emitir CCF para cliente con PASAPORTE devuelve 422
- [ ] Emitir FC con cliente NIT + NCR incluye `nrc` en payload

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Push del branch del frontend**

Run desde `/Users/joaquinmorales13a06/Desktop/Reinar/frontend`:
```bash
git push -u origin feat/clientes-tipo-documento
```

- [ ] **Step 4: Crear PR del frontend**

```bash
gh pr create --title "feat(cliente): dropdown de tipo de documento + input numeroDocumento" --body "$(cat <<'EOF'
## Summary
- Reemplaza inputs fijos DUI/NIT por dropdown de tipo de documento (5 opciones para PARTICULAR, 2 para EMPRESA)
- Input de número con formato dinámico, maxLength y placeholder según tipo
- Elimina toggle "Tiene NIT distinto al DUI" (innecesario con el modelo nuevo)
- Detalle y listado muestran etiqueta + número
- Depende del PR del backend (server `feat/clientes-tipo-documento`)

## Test plan
- [ ] `pnpm tsc --noEmit && pnpm lint` sin errores
- [ ] Crear PARTICULAR con cada uno de los 5 tipos de documento
- [ ] Crear EMPRESA con DUI y con NIT
- [ ] Búsqueda en listado funciona con y sin guiones
- [ ] PDF de factura muestra etiqueta correcta del documento

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Reportar URLs de los PRs al usuario**

---

## Self-Review

### Spec coverage

| Sección del spec | Task(s) que la implementan |
|---|---|
| 1. Modelo de datos (Prisma) | Task 1, 2 |
| 2. Validación de formato por tipo | Task 3 (backend), Task 14 (frontend) |
| 3. Backend: emisión DTE | Task 5, 6, 7, 8, 9 |
| 4. Backend: schemas Zod | Task 3 |
| 5. Backend: búsqueda | Task 4 |
| 6. Frontend: formulario | Task 16 |
| 7. Frontend: helpers nuevos | Task 14 |
| 8. Frontend: cambios cross-cutting | Task 15, 17, 18, 19 |
| 9. Plantillas PDF | Task 10 |
| Plan de rollout | Task 21 |
| Tests backend | Task 11, 12, 13 |
| Verificación manual frontend | Task 20 |

### Notas de implementación

- **Migración irreversible** del schema. Si el branch se cierra sin merge, ejecutar `pnpm prisma migrate resolve --rolled-back 20260528120000_cliente_tipo_documento` y restaurar el schema.
- **Orden estricto**: backend (server) primero, frontend después. Si frontend se compila con tipos viejos antes del merge del backend, los tipos `tipoDocumento`/`numeroDocumento` no existirán en la API real.
- **Tests del backend** son la red de seguridad principal. El frontend no tiene suite — se verifica manualmente.
