# Grupo D — Reestructuración FSE (sujeto excluido como proveedor) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El FSE (DTE 14) pasa a ser un documento de COMPRA: nuevo módulo `fse` donde REINAR compra a proveedores no inscritos en IVA, con retención de renta automática (10 % sobre servicios), constancia de retención, alerta de umbral y plantillas; el FSE desaparece del flujo de ventas (históricos intactos).

**Architecture:** Se extiende `Proveedor` con datos fiscales DTE (opcionales); nuevo agregado `FacturaSujetoExcluido` + `FseItem` + `PlantillaFseProveedor` con totales calculados server-side (`fse.utils.ts` puro y testeado); `facturallama.service` gana `emitirFse` (con `retentionRenta`) espejando el patrón de facturas (dteId idempotente, 422→RECHAZADO); la constancia es un PDF Handlebars propio. Frontend: nuevo grupo de nav "Compras" y páginas lista/crear/detalle siguiendo los patrones existentes.

**Tech Stack:** Express + Prisma 7 + Vitest + Puppeteer/Handlebars (server); Next.js App Router + React Query + RHF/Zod (frontend); FacturaLlama API.

**Spec:** `docs/superpowers/specs/2026-07-11-grupo-d-fse-sujeto-excluido-design.md`

## Global Constraints

- UI 100 % español; comentarios "why" en español. Montos con `Prisma.Decimal`/`decimal.js`; nunca `parseFloat` para dinero. Totales SIEMPRE recalculados en el backend.
- Tailwind estricto (solo clases predefinidas). Botones de escritura ocultos para `VISUALIZADOR`.
- BD remota compartida: NUNCA `migrate dev`/`reset`/`db push`; migraciones con `migrate diff` offline + `migrate deploy`. Todas las migraciones de este plan son aditivas.
- Server suite: **14 fallos pre-existentes en otros archivos** — el conteo no debe aumentar. Frontend: tsc limpio; lint baseline **12 errores + 24 warnings**.
- Retención: `reteRenta = round(subtotalServicios × 0.10, 2)`; bienes 0 %; exoneración manual requiere motivo. `totalPagar = totalCompra − reteRenta`. Umbral Art. 28 LIVA: **$5,714.29** (advertencia, no bloqueo).
- SUPUESTO A VALIDAR EN SANDBOX (primera emisión real): FacturaLlama espera `retentionRenta` como MONTO (así está tipado en `facturallama.types.ts:139`). Si fuera porcentaje, solo cambia el valor pasado en `emitirFse`.
- El valor `SUJETO_EXCLUIDO` del enum `TipoDTE` en BD se CONSERVA (facturas históricas); solo se remueve de los INPUTS.
- Roles módulo FSE: escribir `ADMIN/GERENTE/OPERADOR`; leer todos. Anular DTE: solo `ADMIN`.
- Ramas: `feat/fse-sujeto-excluido` en AMBOS repos.

---

### Task 1: Backend — modelos Prisma + secuencia `fse` + migración

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/prisma/schema.prisma` (Proveedor, Usuario, 2 enums, 3 modelos)
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/lib/numeracion.ts`
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/server/prisma/migrations/20260711160000_fse_sujeto_excluido/migration.sql`

**Interfaces:**
- Produces: modelos `FacturaSujetoExcluido`, `FseItem`, `PlantillaFseProveedor`; enums `TipoPersonaProveedor { NATURAL, JURIDICA }`, `TipoItemFse { BIENES, SERVICIOS }`; campos fiscales en `Proveedor`; `generarNumero('fse', tx)` → `FSEAAMMNNNNN`. Todas las tasks backend los consumen.

- [ ] **Step 1: Enums y extensión de Proveedor**

En `schema.prisma`, junto a los otros enums:

```prisma
enum TipoPersonaProveedor {
  NATURAL
  JURIDICA
}

// Compartido por FseItem.tipoItem y Proveedor.giroPredominante.
enum TipoItemFse {
  BIENES
  SERVICIOS
}
```

En el modelo `Proveedor`, después de `notas String?`:

```prisma
  // Datos fiscales para FSE (todos opcionales — los proveedores de inventario
  // no los necesitan). La elegibilidad FSE se DERIVA: sin nrc + documento +
  // actividad + direccion completos. Tener NRC = contribuyente IVA = no aplica.
  tipoDocumento      TipoDocumentoCliente?
  numeroDocumento    String?
  tipoPersona        TipoPersonaProveedor?
  actividadEconomica String?
  departamento       String?
  municipio          String?
  distrito           String?
  complemento        String?
  giroPredominante   TipoItemFse?
```

y al final de sus relaciones:

```prisma
  fses          FacturaSujetoExcluido[]
  plantillasFse PlantillaFseProveedor[]

  @@unique([tipoDocumento, numeroDocumento])
```

- [ ] **Step 2: Modelos nuevos**

Al final de `schema.prisma`:

```prisma
// ─── FSE: Factura de Sujeto Excluido (DTE 14) ─────────────────────────────────
// Documento de COMPRA: Reinar adquiere bienes/servicios de un proveedor no
// inscrito en IVA. La retencion de renta (10% sobre servicios, Art. 156 CT)
// se calcula server-side; totalPagar es lo que se paga al proveedor.

model FacturaSujetoExcluido {
  id          String    @id @default(cuid())
  numeroFse   String    @unique
  proveedorId String
  proveedor   Proveedor @relation(fields: [proveedorId], references: [id])

  fechaEmision  DateTime         @default(now())
  condicionPago CondicionesPago  @default(CONTADO)

  subtotalBienes    Decimal @db.Decimal(10, 2)
  subtotalServicios Decimal @db.Decimal(10, 2)
  totalCompra       Decimal @db.Decimal(10, 2)
  reteRenta         Decimal @db.Decimal(10, 2)
  totalPagar        Decimal @db.Decimal(10, 2)

  exonerarReteRenta Boolean @default(false)
  motivoExoneracion String?

  estadoDTE        EstadoDTE @default(PENDIENTE)
  dteId            String?   @unique
  dteControlNumber String?
  dteRespuestaMH   Json?

  notas       String?
  creadoPorId String
  creadoPor   Usuario @relation("fsesCreados", fields: [creadoPorId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  items FseItem[]

  @@index([proveedorId])
}

model FseItem {
  id    String                @id @default(cuid())
  fseId String
  fse   FacturaSujetoExcluido @relation(fields: [fseId], references: [id], onDelete: Cascade)

  tipoItem       TipoItemFse
  descripcion    String
  cantidad       Int         @default(1)
  precioUnitario Decimal     @db.Decimal(10, 2)
  subtotal       Decimal     @db.Decimal(10, 2)
  orden          Int
}

// Items recurrentes por proveedor (ej. "servicio de soldadura") — el form de
// FSE los ofrece con un clic para no reescribir lo mismo cada mes.
model PlantillaFseProveedor {
  id             String      @id @default(cuid())
  proveedorId    String
  proveedor      Proveedor   @relation(fields: [proveedorId], references: [id], onDelete: Cascade)
  descripcion    String
  tipoItem       TipoItemFse
  precioUnitario Decimal?    @db.Decimal(10, 2)
  createdAt      DateTime    @default(now())
}
```

En el modelo `Usuario`, agregar la contraparte de la relación: `fsesCreados FacturaSujetoExcluido[] @relation("fsesCreados")`.

NOTA: verificar que el enum `CondicionesPago` existente tiene los valores `CONTADO` y `CREDITO` (lo usa `Factura.condicionPago` y se pasa directo como `paymentType` a FacturaLlama). Si tuviera otros valores, restringir en los schemas Zod de la Task 4, no en Prisma.

- [ ] **Step 3: Secuencia `fse` en numeración**

En `src/lib/numeracion.ts`:

```ts
type TipoDocumento = 'cotizacion' | 'factura' | 'acta' | 'nota-credito' | 'recepcion' | 'fse'
```

y junto al caso de `nota-credito`:

```ts
  // FSE usa prefijo fijo, como NC — no es configurable en ConfiguracionEmpresa.
  if (tipo === 'fse') {
    return `FSE${yy}${mm}${num}`
  }
```

- [ ] **Step 4: Migración (offline — BD compartida)**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
npx prisma validate
git show HEAD:prisma/schema.prisma > /tmp/schema-old-d.prisma
mkdir -p prisma/migrations/20260711160000_fse_sujeto_excluido
npx prisma migrate diff --from-schema /tmp/schema-old-d.prisma --to-schema prisma/schema.prisma --script > prisma/migrations/20260711160000_fse_sujeto_excluido/migration.sql
```

Limpiar el ruido del inicio del `.sql`. Contenido esperado: 2 `CREATE TYPE`, `ALTER TABLE "Proveedor" ADD COLUMN …` (9 columnas) + `CREATE UNIQUE INDEX` compuesto, 3 `CREATE TABLE` + índices/FKs. Luego:

```bash
npx prisma generate && npx prisma migrate deploy && npx prisma migrate status
```

Expected: "Database schema is up to date!". Si algo cuelga o falla: STOP, reportar BLOCKED.

- [ ] **Step 5: Tipos y commit**

Run: `npx tsc --noEmit` — limpio. `pnpm test` — 14 pre-existentes sin cambio.

```bash
git add prisma/schema.prisma prisma/migrations/20260711160000_fse_sujeto_excluido src/lib/numeracion.ts
git commit -m "feat(fse): modelos Prisma — Proveedor fiscal, FacturaSujetoExcluido, items y plantillas

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Backend — `fse.utils.ts`: cálculos y elegibilidad (TDD)

**Files:**
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/fse/fse.utils.ts`
- Test: `/Users/joaquinmorales13a06/Desktop/Reinar/server/tests/modules/fse/fse.utils.test.ts`

**Interfaces:**
- Produces (consumido por Tasks 3–6):
  - `calcularTotalesFse(items, exonerarReteRenta)` → `{ itemsConSubtotal, subtotalBienes, subtotalServicios, totalCompra, reteRenta, totalPagar }` (Decimals).
  - `elegibilidadFse(proveedor)` → `{ elegible: boolean; motivo: string | null }`.
  - `UMBRAL_ART28: Prisma.Decimal` (= 5714.29).

- [ ] **Step 1: Tests (RED)**

Crear `tests/modules/fse/fse.utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import { calcularTotalesFse, elegibilidadFse, UMBRAL_ART28 } from '../../../src/modules/fse/fse.utils'

const D = Prisma.Decimal

describe('calcularTotalesFse', () => {
  it('mixto: retiene 10% solo sobre la porción de servicios', () => {
    const r = calcularTotalesFse(
      [
        { tipoItem: 'BIENES',    cantidad: 2, precioUnitario: 50 },    // 100.00
        { tipoItem: 'SERVICIOS', cantidad: 1, precioUnitario: 300 },   // 300.00
      ],
      false,
    )
    expect(r.subtotalBienes.toFixed(2)).toBe('100.00')
    expect(r.subtotalServicios.toFixed(2)).toBe('300.00')
    expect(r.totalCompra.toFixed(2)).toBe('400.00')
    expect(r.reteRenta.toFixed(2)).toBe('30.00')
    expect(r.totalPagar.toFixed(2)).toBe('370.00')
    expect(r.itemsConSubtotal[1].subtotal.toFixed(2)).toBe('300.00')
  })

  it('solo bienes: retención 0', () => {
    const r = calcularTotalesFse([{ tipoItem: 'BIENES', cantidad: 3, precioUnitario: 10 }], false)
    expect(r.reteRenta.toFixed(2)).toBe('0.00')
    expect(r.totalPagar.toFixed(2)).toBe('30.00')
  })

  it('exonerado: retención 0 aunque haya servicios', () => {
    const r = calcularTotalesFse([{ tipoItem: 'SERVICIOS', cantidad: 1, precioUnitario: 100 }], true)
    expect(r.reteRenta.toFixed(2)).toBe('0.00')
    expect(r.totalPagar.toFixed(2)).toBe('100.00')
  })

  it('redondea a 2 decimales', () => {
    const r = calcularTotalesFse([{ tipoItem: 'SERVICIOS', cantidad: 1, precioUnitario: 33.33 }], false)
    expect(r.reteRenta.toFixed(2)).toBe('3.33') // 3.333 → 3.33
  })
})

describe('elegibilidadFse', () => {
  const completo = {
    nrc: null, tipoDocumento: 'DUI', numeroDocumento: '01234567-8', tipoPersona: 'NATURAL',
    actividadEconomica: '43900', departamento: '06', municipio: '20', complemento: 'Col. X',
  }
  it('elegible con datos completos y sin NRC', () => {
    expect(elegibilidadFse(completo as never)).toEqual({ elegible: true, motivo: null })
  })
  it('bloquea con NRC (contribuyente IVA)', () => {
    expect(elegibilidadFse({ ...completo, nrc: '123456' } as never).elegible).toBe(false)
  })
  it('bloquea sin documento / actividad / dirección / tipoPersona', () => {
    expect(elegibilidadFse({ ...completo, numeroDocumento: null } as never).elegible).toBe(false)
    expect(elegibilidadFse({ ...completo, actividadEconomica: null } as never).elegible).toBe(false)
    expect(elegibilidadFse({ ...completo, complemento: null } as never).elegible).toBe(false)
    expect(elegibilidadFse({ ...completo, tipoPersona: null } as never).elegible).toBe(false)
  })
})

describe('UMBRAL_ART28', () => {
  it('es 5714.29', () => expect(UMBRAL_ART28.toFixed(2)).toBe('5714.29'))
})
```

Run: `npx vitest run tests/modules/fse/fse.utils.test.ts` — Expected: FAIL (módulo no existe).

- [ ] **Step 2: Implementación (GREEN)**

Crear `src/modules/fse/fse.utils.ts`:

```ts
import { Prisma, TipoItemFse, TipoDocumentoCliente, TipoPersonaProveedor } from '@prisma/client'

const Decimal = Prisma.Decimal
type Decimal = Prisma.Decimal

// Umbral de exclusión del Art. 28 LIVA: transferencias < $5,714.29 en 12 meses.
// Superarlo es señal de que el proveedor debería inscribirse en IVA — el
// sistema advierte, no bloquea (la decisión es del contador).
export const UMBRAL_ART28 = new Decimal('5714.29')

export type FseItemInput = {
  tipoItem: TipoItemFse
  cantidad: number
  precioUnitario: Decimal | string | number
}

// Retención de renta (Art. 156 CT): 10% SOLO sobre la porción de servicios.
// Bienes exonerados automáticamente. La exoneración manual (con motivo) pone
// la retención en 0. Nunca se confía en totales del cliente.
export function calcularTotalesFse<T extends FseItemInput>(items: T[], exonerarReteRenta: boolean) {
  let subtotalBienes = new Decimal(0)
  let subtotalServicios = new Decimal(0)
  const itemsConSubtotal = items.map((i) => {
    const subtotal = new Decimal(i.precioUnitario).mul(i.cantidad).toDecimalPlaces(2)
    if (i.tipoItem === 'BIENES') subtotalBienes = subtotalBienes.add(subtotal)
    else subtotalServicios = subtotalServicios.add(subtotal)
    return { ...i, subtotal }
  })
  const totalCompra = subtotalBienes.add(subtotalServicios)
  const reteRenta = exonerarReteRenta
    ? new Decimal(0)
    : subtotalServicios.mul('0.10').toDecimalPlaces(2)
  const totalPagar = totalCompra.sub(reteRenta)
  return { itemsConSubtotal, subtotalBienes, subtotalServicios, totalCompra, reteRenta, totalPagar }
}

export type ProveedorFiscal = {
  nrc: string | null
  tipoDocumento: TipoDocumentoCliente | null
  numeroDocumento: string | null
  tipoPersona: TipoPersonaProveedor | null
  actividadEconomica: string | null
  departamento: string | null
  municipio: string | null
  complemento: string | null
}

// Elegibilidad derivada, nunca almacenada: tener NRC = contribuyente IVA =
// debe emitir CCF/Factura, no recibir FSE (árbol de decisión del spec §2).
export function elegibilidadFse(p: ProveedorFiscal): { elegible: boolean; motivo: string | null } {
  if (p.nrc) return { elegible: false, motivo: 'El proveedor tiene NRC (contribuyente IVA) — no aplica FSE' }
  if (!p.tipoDocumento || !p.numeroDocumento) return { elegible: false, motivo: 'Falta documento de identidad del proveedor' }
  if (!p.tipoPersona) return { elegible: false, motivo: 'Falta el tipo de persona (natural/jurídica)' }
  if (!p.actividadEconomica) return { elegible: false, motivo: 'Falta la actividad económica (CAT-019)' }
  if (!p.departamento || !p.municipio || !p.complemento) return { elegible: false, motivo: 'Falta la dirección completa del proveedor' }
  return { elegible: true, motivo: null }
}
```

Run: `npx vitest run tests/modules/fse/fse.utils.test.ts` — PASS. Luego `pnpm test` (14 pre-existentes) + `npx tsc --noEmit`.

- [ ] **Step 3: Commit**

```bash
git add src/modules/fse/fse.utils.ts tests/modules/fse/fse.utils.test.ts
git commit -m "feat(fse): cálculo de retención de renta (10% servicios) y elegibilidad de proveedor

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Backend — datos fiscales de Proveedor + acumulado 12m + plantillas

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/proveedores/proveedores.schemas.ts`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/proveedores/proveedores.service.ts`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/proveedores/proveedores.controller.ts` y `proveedores.routes.ts`
- Test: `/Users/joaquinmorales13a06/Desktop/Reinar/server/tests/modules/proveedores/proveedores.service.test.ts` (crear si no existe, con el patrón de mock de prisma de los otros tests)

**Interfaces:**
- Consumes: `elegibilidadFse`, `UMBRAL_ART28` (Task 2); formatos de documento espejo de `clientes.schemas.ts`.
- Produces: `crearProveedorSchema`/`actualizarProveedorSchema` aceptan los campos fiscales; `obtenerProveedor(id)` devuelve además `{ elegibilidadFse: { elegible, motivo }, acumuladoFse12m: string }`; CRUD de plantillas `listarPlantillasFse(proveedorId)`, `crearPlantillaFse(proveedorId, dto, usuarioId)`, `eliminarPlantillaFse(proveedorId, plantillaId, usuarioId)`; rutas `GET/POST /proveedores/:id/plantillas-fse` y `DELETE /proveedores/:id/plantillas-fse/:plantillaId`.

- [ ] **Step 1: Schemas fiscales (espejo de clientes)**

En `proveedores.schemas.ts`, replicar las constantes de formato de `src/modules/clientes/clientes.schemas.ts` (líneas 8-30: `FORMATO_POR_TIPO_DOCUMENTO`, `MENSAJE_FORMATO`, `optionalUniqueStr`, `tipoDocumentoSchema`) e importar `CAT019_CODIGOS` de `../../lib/cat019`. Extender `crearProveedorSchema`:

```ts
  // ── Datos fiscales para FSE (opcionales) ──
  tipoDocumento:      tipoDocumentoSchema,
  numeroDocumento:    optionalUniqueStr,
  tipoPersona:        z.preprocess((v) => (v === '' ? undefined : v), z.enum(['NATURAL', 'JURIDICA']).optional()),
  actividadEconomica: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().refine((c) => CAT019_CODIGOS.has(c), 'Código de actividad económica inválido (CAT-019)').optional(),
  ),
  departamento:     z.string().optional(),
  municipio:        z.string().optional(),
  distrito:         z.string().optional(),
  complemento:      z.string().optional(),
  giroPredominante: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['BIENES', 'SERVICIOS']).optional()),
```

más el mismo `superRefine` de formato documento que usa clientes (si `tipoDocumento` y `numeroDocumento` presentes, validar contra `FORMATO_POR_TIPO_DOCUMENTO[tipo]` con `MENSAJE_FORMATO[tipo]`). Y el schema de plantillas:

```ts
export const crearPlantillaFseSchema = z.object({
  descripcion:    z.string().min(1).max(200),
  tipoItem:       z.enum(['BIENES', 'SERVICIOS']),
  precioUnitario: z.number().positive().optional(),
})
export type CrearPlantillaFseDto = z.infer<typeof crearPlantillaFseSchema>
```

- [ ] **Step 2: Service — acumulado + elegibilidad + plantillas**

En `proveedores.service.ts`, importar `{ elegibilidadFse } from '../fse/fse.utils'` y reemplazar `obtenerProveedor`:

```ts
// Compras FSE aprobadas de los últimos 12 meses — señal del umbral Art. 28
// LIVA que el frontend muestra en el detalle y en el form de FSE.
async function acumuladoFse12m(proveedorId: string): Promise<Prisma.Decimal> {
  const hace12m = new Date()
  hace12m.setDate(hace12m.getDate() - 365)
  const agg = await prisma.facturaSujetoExcluido.aggregate({
    where: { proveedorId, estadoDTE: 'APROBADO', fechaEmision: { gte: hace12m } },
    _sum: { totalCompra: true },
  })
  return agg._sum.totalCompra ?? new Prisma.Decimal(0)
}

export async function obtenerProveedor(id: string) {
  const proveedor = await prisma.proveedor.findUnique({ where: { id } })
  if (!proveedor) throw new AppError(404, 'NOT_FOUND', 'Proveedor no encontrado')
  const acumulado = await acumuladoFse12m(id)
  return {
    ...proveedor,
    elegibilidadFse: elegibilidadFse(proveedor),
    acumuladoFse12m: acumulado.toFixed(2),
  }
}
```

y agregar el CRUD de plantillas (con audit log siguiendo el patrón del archivo):

```ts
export async function listarPlantillasFse(proveedorId: string) {
  await obtenerProveedor(proveedorId) // 404 si no existe
  return prisma.plantillaFseProveedor.findMany({ where: { proveedorId }, orderBy: { descripcion: 'asc' } })
}

export async function crearPlantillaFse(proveedorId: string, dto: CrearPlantillaFseDto, usuarioId: string) {
  await obtenerProveedor(proveedorId)
  return prisma.$transaction(async (tx) => {
    const plantilla = await tx.plantillaFseProveedor.create({
      data: { proveedorId, descripcion: dto.descripcion, tipoItem: dto.tipoItem, precioUnitario: dto.precioUnitario },
    })
    await tx.auditLog.create({
      data: { usuarioId, entidad: 'PlantillaFseProveedor', entidadId: plantilla.id, accion: 'CREAR_PLANTILLA_FSE',
        camposDespues: { proveedorId, descripcion: dto.descripcion } as Prisma.InputJsonValue },
    })
    return plantilla
  })
}

export async function eliminarPlantillaFse(proveedorId: string, plantillaId: string, usuarioId: string) {
  const plantilla = await prisma.plantillaFseProveedor.findUnique({ where: { id: plantillaId } })
  if (!plantilla || plantilla.proveedorId !== proveedorId) throw new AppError(404, 'NOT_FOUND', 'Plantilla no encontrada')
  await prisma.$transaction(async (tx) => {
    await tx.plantillaFseProveedor.delete({ where: { id: plantillaId } })
    await tx.auditLog.create({
      data: { usuarioId, entidad: 'PlantillaFseProveedor', entidadId: plantillaId, accion: 'ELIMINAR_PLANTILLA_FSE',
        camposAntes: { descripcion: plantilla.descripcion } as Prisma.InputJsonValue },
    })
  })
}
```

- [ ] **Step 3: Controller + rutas**

Controller: tres handlers estándar (`listarPlantillas`, `crearPlantilla`, `eliminarPlantilla`) con el patrón try/next del archivo. Rutas en `proveedores.routes.ts` (escritura con el grupo `operadores = ['ADMIN','GERENTE','OPERADOR']` — agregarlo; las plantillas son de compras FSE, no de inventario):

```ts
router.get('/:id/plantillas-fse', authenticate, requireRol(...todos), ctrl.listarPlantillas)
router.post('/:id/plantillas-fse', authenticate, requireRol('ADMIN', 'GERENTE', 'OPERADOR'), validate(crearPlantillaFseSchema), ctrl.crearPlantilla)
router.delete('/:id/plantillas-fse/:plantillaId', authenticate, requireRol('ADMIN', 'GERENTE', 'OPERADOR'), ctrl.eliminarPlantilla)
```

- [ ] **Step 4: Tests (TDD sobre el service)**

Crear `tests/modules/proveedores/proveedores.service.test.ts` con el patrón de mock de prisma de los otros archivos (`vi.mock('../../../src/lib/prisma', …)` con `proveedor`, `facturaSujetoExcluido: { aggregate: vi.fn() }`, `plantillaFseProveedor`, `auditLog`, `$transaction` que ejecuta el callback):

```ts
  it('obtenerProveedor deriva elegibilidad y acumulado 12m', async () => {
    prismaMock.proveedor.findUnique.mockResolvedValue({
      id: 'prov-1', nombre: 'Taller X', nrc: null, tipoDocumento: 'DUI', numeroDocumento: '01234567-8',
      tipoPersona: 'NATURAL', actividadEconomica: '43900', departamento: '06', municipio: '20',
      distrito: null, complemento: 'Col. Escalón', giroPredominante: 'SERVICIOS',
    } as any)
    prismaMock.facturaSujetoExcluido.aggregate.mockResolvedValue({ _sum: { totalCompra: new Decimal('1500.50') } } as any)

    const r = await service.obtenerProveedor('prov-1')
    expect(r.elegibilidadFse).toEqual({ elegible: true, motivo: null })
    expect(r.acumuladoFse12m).toBe('1500.50')
  })

  it('proveedor con NRC no es elegible', async () => {
    prismaMock.proveedor.findUnique.mockResolvedValue({ id: 'prov-2', nrc: '123456' } as any)
    prismaMock.facturaSujetoExcluido.aggregate.mockResolvedValue({ _sum: { totalCompra: null } } as any)
    const r = await service.obtenerProveedor('prov-2')
    expect(r.elegibilidadFse.elegible).toBe(false)
    expect(r.acumuladoFse12m).toBe('0.00')
  })
```

Run RED → implementar → GREEN. Suite completa + tsc.

- [ ] **Step 5: Commit**

```bash
git add src/modules/proveedores tests/modules/proveedores
git commit -m "feat(proveedores): datos fiscales FSE, elegibilidad derivada, acumulado 12m y plantillas de ítems

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Backend — módulo `fse`: CRUD con totales server-side (TDD)

**Files:**
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/fse/fse.schemas.ts`, `fse.service.ts`, `fse.controller.ts`, `fse.routes.ts`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/index.ts` (registrar `api.use('/fse', fseRoutes)` junto a los demás)
- Test: `/Users/joaquinmorales13a06/Desktop/Reinar/server/tests/modules/fse/fse.service.test.ts`

**Interfaces:**
- Consumes: `calcularTotalesFse`, `elegibilidadFse` (Task 2); `generarNumero('fse', tx)` (Task 1).
- Produces: `crearFse(dto, usuarioId)`, `listarFse(filtros)`, `obtenerFse(id)` (include proveedor + items ordenados), `actualizarFse(id, dto, usuarioId)` (solo PENDIENTE/RECHAZADO; reemplaza ítems y recalcula), `eliminarFse(id, usuarioId)` (solo PENDIENTE sin dteId). Rutas: `GET/POST /fse`, `GET/PUT/DELETE /fse/:id`. Task 5 agrega las rutas DTE al mismo router.

- [ ] **Step 1: Schemas**

`fse.schemas.ts`:

```ts
import { z } from 'zod'

const itemFseSchema = z.object({
  tipoItem:       z.enum(['BIENES', 'SERVICIOS']),
  descripcion:    z.string().min(1, 'Descripción requerida').max(200),
  cantidad:       z.number().int().min(1),
  precioUnitario: z.number().positive('El precio debe ser mayor a 0'),
})

export const crearFseSchema = z.object({
  proveedorId:       z.string().min(1, 'Selecciona un proveedor'),
  condicionPago:     z.enum(['CONTADO', 'CREDITO']).default('CONTADO'),
  exonerarReteRenta: z.boolean().default(false),
  motivoExoneracion: z.string().max(500).optional(),
  notas:             z.string().max(1000).optional(),
  items:             z.array(itemFseSchema).min(1, 'El FSE debe tener al menos un ítem'),
}).refine(
  (d) => !d.exonerarReteRenta || (d.motivoExoneracion && d.motivoExoneracion.trim().length >= 5),
  { message: 'El motivo de exoneración es obligatorio (mínimo 5 caracteres)', path: ['motivoExoneracion'] },
)

export const actualizarFseSchema = crearFseSchema

export const filtrosFseSchema = z.object({
  page:        z.coerce.number().int().min(1).default(1),
  limit:       z.coerce.number().int().min(1).max(100).default(20),
  proveedorId: z.string().optional(),
  estadoDTE:   z.enum(['PENDIENTE', 'PROCESANDO', 'APROBADO', 'RECHAZADO', 'ANULADO']).optional(),
  fechaDesde:  z.string().optional(),
  fechaHasta:  z.string().optional(),
})

export const anularDteFseSchema = z.object({
  motivo: z.string().min(10, 'El motivo debe tener al menos 10 caracteres'),
})

export type CrearFseDto   = z.infer<typeof crearFseSchema>
export type FiltrosFse    = z.infer<typeof filtrosFseSchema>
```

- [ ] **Step 2: Tests del service (RED)**

`tests/modules/fse/fse.service.test.ts` con el patrón de mock del repo (prisma con `facturaSujetoExcluido`, `fseItem`, `proveedor`, `secuenciaDocumento`, `configuracionEmpresa`, `auditLog`, `$transaction → fn(prismaMock)`; `vi.mock` de `../../../src/lib/numeracion` con `generarNumero: vi.fn()`):

```ts
  it('crearFse calcula totales server-side y persiste items con subtotal', async () => {
    numeracionMock.generarNumero.mockResolvedValue('FSE2607000001')
    prismaMock.proveedor.findUnique.mockResolvedValue({ id: 'prov-1', nrc: null } as any)
    prismaMock.facturaSujetoExcluido.create.mockResolvedValue({ id: 'fse-1' } as any)
    prismaMock.fseItem.createMany.mockResolvedValue({ count: 2 } as any)
    prismaMock.auditLog.create.mockResolvedValue({} as any)
    prismaMock.facturaSujetoExcluido.findUnique.mockResolvedValue({ id: 'fse-1', numeroFse: 'FSE2607000001' } as any)

    await service.crearFse({
      proveedorId: 'prov-1', condicionPago: 'CONTADO', exonerarReteRenta: false,
      items: [
        { tipoItem: 'BIENES', descripcion: 'Material', cantidad: 2, precioUnitario: 50 },
        { tipoItem: 'SERVICIOS', descripcion: 'Soldadura', cantidad: 1, precioUnitario: 300 },
      ],
    } as any, 'user-1')

    expect(prismaMock.facturaSujetoExcluido.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({
        numeroFse: 'FSE2607000001',
        // Decimals — comparar por string
      }) }),
    )
    const data = (prismaMock.facturaSujetoExcluido.create.mock.calls[0][0] as any).data
    expect(data.reteRenta.toFixed(2)).toBe('30.00')
    expect(data.totalPagar.toFixed(2)).toBe('370.00')
    const items = (prismaMock.fseItem.createMany.mock.calls[0][0] as any).data
    expect(items[1].subtotal.toFixed(2)).toBe('300.00')
    expect(items[0].orden).toBe(1)
  })

  it('actualizarFse rechaza si el DTE ya fue APROBADO', async () => {
    prismaMock.facturaSujetoExcluido.findUnique.mockResolvedValue({ id: 'fse-1', estadoDTE: 'APROBADO', dteId: 'x' } as any)
    await expect(service.actualizarFse('fse-1', {} as any, 'user-1')).rejects.toMatchObject({ code: 'ESTADO_INVALIDO' })
  })

  it('eliminarFse rechaza si ya tiene dteId', async () => {
    prismaMock.facturaSujetoExcluido.findUnique.mockResolvedValue({ id: 'fse-1', estadoDTE: 'PENDIENTE', dteId: 'x' } as any)
    await expect(service.eliminarFse('fse-1', 'user-1')).rejects.toMatchObject({ code: 'ESTADO_INVALIDO' })
  })
```

Run RED.

- [ ] **Step 3: Service (GREEN)**

`fse.service.ts` (imports: prisma, Prisma, AppError, generarNumero, calcularTotalesFse, CrearFseDto/FiltrosFse):

```ts
export async function listarFse(filtros: FiltrosFse) {
  const { page, limit, proveedorId, estadoDTE, fechaDesde, fechaHasta } = filtros
  const skip = (page - 1) * limit
  const where: Prisma.FacturaSujetoExcluidoWhereInput = {
    ...(proveedorId && { proveedorId }),
    ...(estadoDTE && { estadoDTE }),
    ...(fechaDesde && { fechaEmision: { gte: new Date(fechaDesde) } }),
    ...(fechaHasta && { fechaEmision: { ...(fechaDesde ? { gte: new Date(fechaDesde) } : {}), lte: new Date(fechaHasta) } }),
  }
  const [data, total] = await Promise.all([
    prisma.facturaSujetoExcluido.findMany({
      where, skip, take: limit, orderBy: { fechaEmision: 'desc' },
      select: {
        id: true, numeroFse: true, fechaEmision: true, estadoDTE: true,
        totalCompra: true, reteRenta: true, totalPagar: true,
        proveedor: { select: { id: true, nombre: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.facturaSujetoExcluido.count({ where }),
  ])
  return { data, meta: { page, limit, total } }
}

export async function obtenerFse(id: string) {
  const fse = await prisma.facturaSujetoExcluido.findUnique({
    where: { id },
    include: {
      proveedor: true,
      items: { orderBy: { orden: 'asc' } },
      creadoPor: { select: { id: true, nombre: true, apellido: true } },
    },
  })
  if (!fse) throw new AppError(404, 'NOT_FOUND', 'FSE no encontrado')
  return fse
}

export async function crearFse(dto: CrearFseDto, usuarioId: string) {
  const proveedor = await prisma.proveedor.findUnique({ where: { id: dto.proveedorId } })
  if (!proveedor) throw new AppError(404, 'NOT_FOUND', 'Proveedor no encontrado')

  const t = calcularTotalesFse(dto.items, dto.exonerarReteRenta)
  const creado = await prisma.$transaction(async (tx) => {
    const numeroFse = await generarNumero('fse', tx)
    const fse = await tx.facturaSujetoExcluido.create({
      data: {
        numeroFse,
        proveedorId:       dto.proveedorId,
        condicionPago:     dto.condicionPago,
        exonerarReteRenta: dto.exonerarReteRenta,
        motivoExoneracion: dto.exonerarReteRenta ? dto.motivoExoneracion : null,
        notas:             dto.notas,
        subtotalBienes:    t.subtotalBienes,
        subtotalServicios: t.subtotalServicios,
        totalCompra:       t.totalCompra,
        reteRenta:         t.reteRenta,
        totalPagar:        t.totalPagar,
        creadoPorId:       usuarioId,
      },
    })
    await tx.fseItem.createMany({
      data: t.itemsConSubtotal.map((i, idx) => ({
        fseId: fse.id, tipoItem: i.tipoItem, descripcion: (i as never as { descripcion: string }).descripcion,
        cantidad: i.cantidad, precioUnitario: new Prisma.Decimal(i.precioUnitario), subtotal: i.subtotal, orden: idx + 1,
      })),
    })
    await tx.auditLog.create({
      data: { usuarioId, entidad: 'FacturaSujetoExcluido', entidadId: fse.id, accion: 'CREAR_FSE',
        camposDespues: { numeroFse, proveedorId: dto.proveedorId, totalCompra: t.totalCompra.toFixed(2), reteRenta: t.reteRenta.toFixed(2) } as Prisma.InputJsonValue },
    })
    return fse
  })
  return obtenerFse(creado.id)
}

export async function actualizarFse(id: string, dto: CrearFseDto, usuarioId: string) {
  const fse = await prisma.facturaSujetoExcluido.findUnique({ where: { id }, select: { id: true, estadoDTE: true } })
  if (!fse) throw new AppError(404, 'NOT_FOUND', 'FSE no encontrado')
  if (fse.estadoDTE !== 'PENDIENTE' && fse.estadoDTE !== 'RECHAZADO') {
    throw new AppError(422, 'ESTADO_INVALIDO', `Solo se puede editar un FSE con DTE pendiente o rechazado (estado: ${fse.estadoDTE})`)
  }
  const t = calcularTotalesFse(dto.items, dto.exonerarReteRenta)
  await prisma.$transaction(async (tx) => {
    await tx.fseItem.deleteMany({ where: { fseId: id } })
    await tx.facturaSujetoExcluido.update({
      where: { id },
      data: {
        proveedorId: dto.proveedorId, condicionPago: dto.condicionPago,
        exonerarReteRenta: dto.exonerarReteRenta,
        motivoExoneracion: dto.exonerarReteRenta ? dto.motivoExoneracion : null,
        notas: dto.notas,
        subtotalBienes: t.subtotalBienes, subtotalServicios: t.subtotalServicios,
        totalCompra: t.totalCompra, reteRenta: t.reteRenta, totalPagar: t.totalPagar,
      },
    })
    await tx.fseItem.createMany({
      data: t.itemsConSubtotal.map((i, idx) => ({
        fseId: id, tipoItem: i.tipoItem, descripcion: (i as never as { descripcion: string }).descripcion,
        cantidad: i.cantidad, precioUnitario: new Prisma.Decimal(i.precioUnitario), subtotal: i.subtotal, orden: idx + 1,
      })),
    })
    await tx.auditLog.create({
      data: { usuarioId, entidad: 'FacturaSujetoExcluido', entidadId: id, accion: 'ACTUALIZAR_FSE',
        camposDespues: { totalCompra: t.totalCompra.toFixed(2), reteRenta: t.reteRenta.toFixed(2) } as Prisma.InputJsonValue },
    })
  })
  return obtenerFse(id)
}

export async function eliminarFse(id: string, usuarioId: string) {
  const fse = await prisma.facturaSujetoExcluido.findUnique({ where: { id }, select: { estadoDTE: true, dteId: true, numeroFse: true } })
  if (!fse) throw new AppError(404, 'NOT_FOUND', 'FSE no encontrado')
  if (fse.estadoDTE !== 'PENDIENTE' || fse.dteId) {
    throw new AppError(422, 'ESTADO_INVALIDO', 'Solo se puede eliminar un FSE sin DTE emitido')
  }
  await prisma.$transaction(async (tx) => {
    await tx.facturaSujetoExcluido.delete({ where: { id } })
    await tx.auditLog.create({
      data: { usuarioId, entidad: 'FacturaSujetoExcluido', entidadId: id, accion: 'ELIMINAR_FSE',
        camposAntes: { numeroFse: fse.numeroFse } as Prisma.InputJsonValue },
    })
  })
}
```

Nota sobre `(i as never as { descripcion: string })`: `calcularTotalesFse` es genérico (`<T extends FseItemInput>`) y preserva los campos extra del ítem — si TypeScript infiere bien el genérico, el cast sobra; escribir `i.descripcion` directo y solo castear si tsc se queja.

- [ ] **Step 4: Controller + rutas + registro**

`fse.controller.ts`: handlers estándar try/next (`listar`, `obtener`, `crear` → 201, `actualizar`, `eliminar`). `fse.routes.ts`:

```ts
const todos      = ['ADMIN', 'GERENTE', 'OPERADOR', 'LOGISTICA', 'VISUALIZADOR'] as const
const operadores = ['ADMIN', 'GERENTE', 'OPERADOR'] as const

router.get('/', authenticate, requireRol(...todos), validateQuery(filtrosFseSchema), ctrl.listar)
router.post('/', authenticate, requireRol(...operadores), validate(crearFseSchema), ctrl.crear)
router.get('/:id', authenticate, requireRol(...todos), ctrl.obtener)
router.put('/:id', authenticate, requireRol(...operadores), validate(actualizarFseSchema), ctrl.actualizar)
router.delete('/:id', authenticate, requireRol(...operadores), ctrl.eliminar)
```

En `src/index.ts`: `import fseRoutes from './modules/fse/fse.routes'` + `api.use('/fse', fseRoutes)` (junto a los otros `api.use`).

- [ ] **Step 5: GREEN + commit**

Run: `npx vitest run tests/modules/fse/` → PASS; `pnpm test` (14 pre-existentes); `npx tsc --noEmit`.

```bash
git add src/modules/fse src/index.ts tests/modules/fse
git commit -m "feat(fse): módulo de compras FSE — CRUD con totales y retención server-side

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Backend — emisión DTE del FSE vía FacturaLlama (TDD)

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/facturallama/facturallama.service.ts` (nuevas `emitirFse`, `persistirResultadoFse`, `sincronizarFse`)
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/fse/fse.service.ts` (`emitirDteFse`, `anularDteFse`, `sincronizarDteFse`), `fse.controller.ts`, `fse.routes.ts`
- Test: `/Users/joaquinmorales13a06/Desktop/Reinar/server/tests/modules/fse/fse.service.test.ts` (+ `tests/modules/facturallama/…` si el repo ya testea builders ahí — seguir su patrón)

**Interfaces:**
- Consumes: `elegibilidadFse` (Task 2); helpers existentes `buildIdentificationDocument`, `telefonoLocalDte`, `facturaLlamaFetch`, `mapearEstado`, `invalidarDTE`, tipos `RecipientFSE`/`PayloadFSE`.
- Produces: `facturaLlamaService.emitirFse(fseId): Promise<void>`; rutas `PATCH /fse/:id/dte` (emitir/re-emitir), `DELETE /fse/:id/dte` (anular, ADMIN), `PATCH /fse/:id/dte/sincronizar`, `GET /fse/:id/pdf` y `GET /fse/:id/json` (oficiales por dteId, reutilizando `descargarPDFOficial`/`descargarJSONOficial`).

- [ ] **Step 1: Tests de emisión (RED)** — en `tests/modules/fse/fse.service.test.ts`, mockeando `../../../src/modules/facturallama/facturallama.service`:

```ts
  it('emitirDteFse bloquea si el proveedor no es elegible (tiene NRC)', async () => {
    prismaMock.facturaSujetoExcluido.findUnique.mockResolvedValue({
      id: 'fse-1', estadoDTE: 'PENDIENTE', dteId: null,
      proveedor: { nrc: '123', tipoDocumento: 'DUI', numeroDocumento: '01234567-8', tipoPersona: 'NATURAL',
        actividadEconomica: '43900', departamento: '06', municipio: '20', complemento: 'X' },
      items: [{}],
    } as any)
    await expect(service.emitirDteFse('fse-1')).rejects.toMatchObject({ code: 'PROVEEDOR_NO_ELEGIBLE' })
    expect(facturaLlamaMock.emitirFse).not.toHaveBeenCalled()
  })

  it('emitirDteFse re-emite tras RECHAZADO limpiando el intento anterior', async () => {
    prismaMock.facturaSujetoExcluido.findUnique.mockResolvedValue({
      id: 'fse-1', estadoDTE: 'RECHAZADO', dteId: 'viejo',
      proveedor: { nrc: null, tipoDocumento: 'DUI', numeroDocumento: '01234567-8', tipoPersona: 'NATURAL',
        actividadEconomica: '43900', departamento: '06', municipio: '20', complemento: 'X' },
      items: [{}],
    } as any)
    prismaMock.facturaSujetoExcluido.update.mockResolvedValue({} as any)
    facturaLlamaMock.emitirFse.mockResolvedValue(undefined)

    await service.emitirDteFse('fse-1')
    expect(prismaMock.facturaSujetoExcluido.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estadoDTE: 'PENDIENTE', dteId: null, dteControlNumber: null }) }),
    )
    expect(facturaLlamaMock.emitirFse).toHaveBeenCalledWith('fse-1')
  })
```

- [ ] **Step 2: `emitirFse` en facturallama.service (GREEN, parte 1)**

Después de `emitirSujetoExcluido` (que la Task 7 eliminará):

```ts
// FSE como COMPRA: Reinar es el adquirente; el "recipient" del payload es el
// PROVEEDOR sujeto excluido. retentionRenta viaja como MONTO calculado
// (10% de la porción de servicios) — la pieza que el flujo viejo nunca envió.
export async function emitirFse(fseId: string): Promise<void> {
  const fse = await prisma.facturaSujetoExcluido.findUnique({
    where: { id: fseId },
    include: { proveedor: true, items: { orderBy: { orden: 'asc' } } },
  })
  if (!fse) throw new AppError(404, 'NOT_FOUND', 'FSE no encontrado')
  if (fse.estadoDTE !== 'PENDIENTE') throw new AppError(422, 'ESTADO_INVALIDO', `El DTE ya fue procesado (estado: ${fse.estadoDTE})`)

  const dteId = crypto.randomUUID()
  // Persistir dteId antes del request — idempotencia si el proceso muere entre pasos.
  await prisma.facturaSujetoExcluido.update({ where: { id: fseId }, data: { dteId } })

  const identificationDocument = buildIdentificationDocument(fse.proveedor)
  if (!identificationDocument) throw new AppError(422, 'PROVEEDOR_NO_ELEGIBLE', 'El proveedor no tiene documento de identidad registrado')

  const telefono = telefonoLocalDte(fse.proveedor.telefono)
  const recipient: RecipientFSE = {
    name: fse.proveedor.nombre,
    contributorType: fse.proveedor.tipoPersona ?? 'NATURAL',
    ...(fse.proveedor.actividadEconomica ? { economicActivity: fse.proveedor.actividadEconomica } : {}),
    ...(fse.proveedor.email ? { email: fse.proveedor.email } : {}),
    ...(telefono ? { phone: telefono } : {}),
    address: {
      department:   fse.proveedor.departamento!,
      municipality: fse.proveedor.municipio!,
      complement:   fse.proveedor.complemento!,
    },
    identificationDocument,
  }

  const payload: PayloadFSE = {
    id: dteId,
    paymentType: fse.condicionPago,
    recipient,
    items: fse.items.map((i) => ({
      type: i.tipoItem,
      description: i.descripcion,
      quantity: i.cantidad,
      unitPrice: Number(i.precioUnitario),
      saleType: 'GRAVADA' as const,
    })),
    ...(fse.reteRenta.greaterThan(0) ? { retentionRenta: Number(fse.reteRenta) } : {}),
  }

  const { status, data } = await facturaLlamaFetch<RespuestaEmisionDTE>('/dte/fse', { method: 'POST', body: JSON.stringify(payload) })
  await persistirResultadoFse(fseId, status, data)
}

// Espejo de persistirResultadoFactura sobre FacturaSujetoExcluido.
async function persistirResultadoFse(fseId: string, httpStatus: number, respuesta: RespuestaEmisionDTE): Promise<void> {
  if (httpStatus === 422) {
    await prisma.facturaSujetoExcluido.update({
      where: { id: fseId },
      data: { estadoDTE: 'RECHAZADO', dteRespuestaMH: respuesta as unknown as Prisma.InputJsonValue },
    })
    return
  }
  const estadoDTE = mapearEstado(respuesta.status)
  await prisma.facturaSujetoExcluido.update({
    where: { id: fseId },
    data: {
      estadoDTE,
      ...(respuesta.controlNumber ? { dteControlNumber: respuesta.controlNumber } : {}),
      dteRespuestaMH: respuesta as unknown as Prisma.InputJsonValue,
    },
  })
}

// Consulta el estado actual del DTE en FacturaLlama (para PROCESANDO colgados).
export async function sincronizarFse(fseId: string): Promise<void> {
  const fse = await prisma.facturaSujetoExcluido.findUnique({ where: { id: fseId }, select: { dteId: true } })
  if (!fse?.dteId) throw new AppError(422, 'ESTADO_INVALIDO', 'El FSE no tiene DTE emitido')
  const { status, data } = await facturaLlamaFetch<RespuestaEmisionDTE>(`/dte/${fse.dteId}`, { method: 'GET' })
  await persistirResultadoFse(fseId, status, data)
}
```

NOTA: antes de escribir `sincronizarFse`, leer cómo facturas implementa su sincronización (buscar `sincronizar` en `facturas.service.ts`/`facturallama.service.ts`) y espejar el shape exacto de la respuesta del `GET /dte/:id`; si difiere de `RespuestaEmisionDTE`, usar el tipo que use facturas.

- [ ] **Step 3: `fse.service` — emitir/anular/sincronizar (GREEN, parte 2)**

```ts
export async function emitirDteFse(id: string) {
  const fse = await prisma.facturaSujetoExcluido.findUnique({ where: { id }, include: { proveedor: true, items: true } })
  if (!fse) throw new AppError(404, 'NOT_FOUND', 'FSE no encontrado')
  if (fse.estadoDTE !== 'PENDIENTE' && fse.estadoDTE !== 'RECHAZADO') {
    throw new AppError(422, 'ESTADO_INVALIDO', `El DTE ya fue procesado (estado: ${fse.estadoDTE})`)
  }
  const eleg = elegibilidadFse(fse.proveedor)
  if (!eleg.elegible) throw new AppError(422, 'PROVEEDOR_NO_ELEGIBLE', eleg.motivo!)
  if (fse.items.length === 0) throw new AppError(422, 'FSE_SIN_ITEMS', 'El FSE debe tener al menos un ítem')

  if (fse.estadoDTE === 'RECHAZADO') {
    await prisma.facturaSujetoExcluido.update({
      where: { id },
      data: { estadoDTE: 'PENDIENTE', dteId: null, dteControlNumber: null },
    })
  }
  await facturaLlamaService.emitirFse(id)
  return prisma.facturaSujetoExcluido.findUnique({
    where: { id },
    select: { id: true, estadoDTE: true, dteId: true, dteControlNumber: true, dteRespuestaMH: true },
  })
}

export async function anularDteFse(id: string, motivo: string, usuarioId: string) {
  const fse = await prisma.facturaSujetoExcluido.findUnique({ where: { id }, select: { estadoDTE: true, dteId: true, numeroFse: true } })
  if (!fse) throw new AppError(404, 'NOT_FOUND', 'FSE no encontrado')
  if (fse.estadoDTE !== 'APROBADO' || !fse.dteId) {
    throw new AppError(422, 'ESTADO_INVALIDO', 'Solo se puede anular un DTE aprobado')
  }
  await facturaLlamaService.invalidarDTE(fse.dteId, motivo)
  await prisma.$transaction(async (tx) => {
    await tx.facturaSujetoExcluido.update({ where: { id }, data: { estadoDTE: 'ANULADO' } })
    await tx.auditLog.create({
      data: { usuarioId, entidad: 'FacturaSujetoExcluido', entidadId: id, accion: 'ANULAR_DTE_FSE',
        camposDespues: { motivo, numeroFse: fse.numeroFse } as Prisma.InputJsonValue },
    })
  })
}

export async function sincronizarDteFse(id: string) {
  await facturaLlamaService.sincronizarFse(id)
  return prisma.facturaSujetoExcluido.findUnique({ where: { id }, select: { id: true, estadoDTE: true, dteControlNumber: true } })
}
```

(Verificar la firma real de `invalidarDTE` — si recibe `(dteId, motivo)` u objeto — y ajustar la llamada.)

- [ ] **Step 4: Rutas DTE + descargas**

En `fse.routes.ts`:

```ts
router.patch('/:id/dte', authenticate, requireRol(...operadores), ctrl.emitirDte)
router.patch('/:id/dte/sincronizar', authenticate, requireRol(...operadores), ctrl.sincronizarDte)
router.delete('/:id/dte', authenticate, requireRol('ADMIN'), validate(anularDteFseSchema), ctrl.anularDte)
router.get('/:id/pdf', authenticate, requireRol(...todos), ctrl.pdfOficial)
router.get('/:id/json', authenticate, requireRol(...todos), ctrl.jsonOficial)
```

`pdfOficial`/`jsonOficial` en el controller: obtener el FSE, exigir `dteId`, delegar en `facturaLlamaService.descargarPDFOficial(dteId)`/`descargarJSONOficial(dteId)` y responder con los headers que usa el equivalente de facturas (leer su controller para espejar `Content-Type`/`Content-Disposition`).

- [ ] **Step 5: GREEN + commit**

Suite + tsc como siempre.

```bash
git add src/modules/fse src/modules/facturallama tests/modules/fse
git commit -m "feat(fse): emisión de DTE 14 vía FacturaLlama con retentionRenta; anular y sincronizar

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Backend — constancia de retención PDF

**Files:**
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/pdf/templates/constancia-retencion.hbs`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/pdf/pdf.service.ts` (nueva `generarConstanciaRetencionPDF`)
- Modify: `fse.routes.ts`/`fse.controller.ts` (`GET /fse/:id/constancia`)
- Test: `/Users/joaquinmorales13a06/Desktop/Reinar/server/tests/modules/pdf/pdf.service.test.ts`

**Interfaces:**
- Consumes: pipeline PDF existente (`getBrowser`, `fontsCss`, `getLogoDataUri`, `buildEmpresaContext`, `formatFechaCorta`, `labelTipoDoc` helper).
- Produces: `generarConstanciaRetencionPDF(fseId: string): Promise<Buffer>`; ruta `GET /fse/:id/constancia` (todos leen; 422 si `reteRenta = 0` o `estadoDTE !== 'APROBADO'`).

- [ ] **Step 1: Test (RED)** — en `pdf.service.test.ts`, siguiendo el patrón de mocks del archivo (`mockPrisma.facturaSujetoExcluido.findUniqueOrThrow` — agregar el modelo al mock de prisma del archivo):

```ts
describe('generarConstanciaRetencionPDF', () => {
  const FSE = {
    id: 'fse-1', numeroFse: 'FSE2607000001', dteControlNumber: 'DTE-14-XXXX', fechaEmision: new Date('2026-07-10'),
    subtotalServicios: new Decimal(300), totalCompra: new Decimal(400),
    reteRenta: new Decimal(30), totalPagar: new Decimal(370), estadoDTE: 'APROBADO',
    proveedor: { nombre: 'Taller X', tipoDocumento: 'DUI', numeroDocumento: '01234567-8' },
  }
  it('incluye monto retenido, proveedor y base legal', async () => {
    mockPrisma.facturaSujetoExcluido.findUniqueOrThrow.mockResolvedValue(FSE as any)
    await generarConstanciaRetencionPDF('fse-1')
    const browser = await vi.mocked(getBrowser)()
    const page = await browser.newPage()
    const html = vi.mocked(page.setContent).mock.calls[0][0] as string
    expect(html).toContain('Constancia de Retención')
    expect(html).toContain('FSE2607000001')
    expect(html).toContain('Taller X')
    expect(html).toContain('30.00')
    expect(html).toContain('Art. 156')
  })
})
```

- [ ] **Step 2: Template + generador (GREEN)**

`constancia-retencion.hbs`: documento A4 sencillo con el estilo de los templates existentes (copiar `<head>` con `{{{fontsCss}}}` y clases base de `factura.hbs`): encabezado con logo + datos de REINAR (agente de retención), título "Constancia de Retención de Impuesto sobre la Renta", bloque del proveedor (nombre, `{{labelTipoDoc proveedor.tipoDocumento}}` + número), tabla: documento FSE (`{{fse.numeroFse}}` / `{{fse.dteControlNumber}}`), fecha, total de la compra, porción de servicios, **monto retenido (10 %)** destacado, total pagado; pie con la base legal: *"Retención efectuada conforme al Art. 156 del Código Tributario de El Salvador (10 % sobre prestación de servicios sin dependencia laboral)."*

`generarConstanciaRetencionPDF` en `pdf.service.ts` (mismo esqueleto que los demás generadores del archivo):

```ts
export async function generarConstanciaRetencionPDF(fseId: string): Promise<Buffer> {
  const [fse, empresa, logo] = await Promise.all([
    prisma.facturaSujetoExcluido.findUniqueOrThrow({
      where: { id: fseId },
      include: { proveedor: { select: { nombre: true, tipoDocumento: true, numeroDocumento: true } } },
    }),
    prisma.configuracionEmpresa.findUnique({ where: { id: 'singleton' } }),
    getLogoDataUri(),
  ])

  const context = {
    fontsCss,
    logoDataUri: logo,
    empresa: buildEmpresaContext(empresa, 'facturas'),
    proveedor: fse.proveedor,
    fse: {
      numero:            fse.numeroFse,
      controlNumber:     fse.dteControlNumber,
      fecha:             formatFechaCorta(fse.fechaEmision),
      totalCompra:       fse.totalCompra.toFixed(2),
      subtotalServicios: fse.subtotalServicios.toFixed(2),
      reteRenta:         fse.reteRenta.toFixed(2),
      totalPagar:        fse.totalPagar.toFixed(2),
    },
  }
  // …compilar template + render con getBrowser() exactamente como los demás
  // generadores del archivo (leer generarCotizacionPDF para el esqueleto).
}
```

- [ ] **Step 3: Endpoint** — en `fse.controller.ts`, validar en el service: `reteRenta > 0` y `estadoDTE === 'APROBADO'`, si no → `AppError(422, 'CONSTANCIA_NO_DISPONIBLE', 'La constancia solo aplica a FSE aprobados con retención')`. Ruta: `router.get('/:id/constancia', authenticate, requireRol(...todos), ctrl.constancia)`.

- [ ] **Step 4: GREEN + commit**

```bash
git add src/modules/pdf src/modules/fse tests/modules/pdf
git commit -m "feat(fse): constancia de retención de renta en PDF

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Backend — remover FSE del flujo de ventas

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/facturas/facturas.schemas.ts:53-61`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/facturas/facturas.service.ts:283-313` (validaciones FSE + dispatch)
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/facturallama/facturallama.service.ts:362-433` (eliminar `emitirSujetoExcluido`)
- Test: tests de facturas que referencien SUJETO_EXCLUIDO como input

- [ ] **Step 1: Schemas** — en `facturas.schemas.ts`, ambos enums pasan a `z.enum(['FC', 'CCF'])` (en `emitirDTESchema` y `generarFacturaSchema`), con comentario:

```ts
// SUJETO_EXCLUIDO ya no es emitible desde ventas: la FSE es un documento de
// COMPRA y vive en el módulo fse. El valor queda en el enum TipoDTE de Prisma
// solo por las facturas históricas.
```

- [ ] **Step 2: Service** — en `facturas.service.ts` `emitirDTE`: eliminar el bloque completo `if (input.tipoDTE === 'SUJETO_EXCLUIDO') { … }` de validaciones y simplificar el dispatch:

```ts
  if (input.tipoDTE === 'FC') {
    await facturaLlamaService.emitirFC(id)
  } else {
    await facturaLlamaService.emitirCCF(id)
  }
```

- [ ] **Step 3: FacturaLlama** — eliminar la función `emitirSujetoExcluido` completa (la reemplaza `emitirFse` de la Task 5). NO tocar `RecipientFSE`/`PayloadFSE` (los usa `emitirFse` y `emitirNC`) ni el soporte de NC contra FSE históricos.

- [ ] **Step 4: Tests** — buscar en `tests/` referencias a `SUJETO_EXCLUIDO` como INPUT de emisión/generación (`grep -rn "SUJETO_EXCLUIDO" tests/`): eliminar/ajustar los tests que emitían FSE desde facturas; conservar los que muestran FSE como dato histórico (ej. el PDF de factura con `tipoDTE: 'SUJETO_EXCLUIDO'` en fixtures — sigue siendo válido).

- [ ] **Step 5: Suite + tsc + commit**

```bash
git add src/modules/facturas src/modules/facturallama tests
git commit -m "feat(facturas)!: remover FSE del flujo de ventas — la FSE ahora es documento de compra (módulo fse)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Frontend — tipos, hooks `use-fse` y nav "Compras"

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/types/api.ts` (Proveedor ext + tipos FSE)
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/hooks/use-fse.ts`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/lib/nav.ts`

**Interfaces:**
- Consumes: API del backend (Tasks 3-6).
- Produces (Tasks 9-11 consumen): tipos `TipoItemFse`, `TipoPersonaProveedor`, `FseListItem`, `Fse`, `FseItem`, `PlantillaFse`, `CrearFseDto`; `Proveedor` extendido con los campos fiscales + `elegibilidadFse` + `acumuladoFse12m` (solo en detalle); hooks `useFses(filtros)`, `useFse(id)`, `useCrearFse()`, `useActualizarFse()`, `useEliminarFse()`, `useEmitirDteFse(id)`, `useAnularDteFse(id)`, `useSincronizarDteFse(id)`, `usePlantillasFse(proveedorId)`, `useCrearPlantillaFse(proveedorId)`, `useEliminarPlantillaFse(proveedorId)`, `descargarFsePdf(id, numero)`, `descargarConstanciaRetencion(id, numero)`.

- [ ] **Step 1: Tipos** — en `types/api.ts`:

```ts
// ─── FSE: compras a sujetos excluidos ─────────────────────────────────
export type TipoItemFse = 'BIENES' | 'SERVICIOS';
export type TipoPersonaProveedor = 'NATURAL' | 'JURIDICA';

export type FseItem = {
  id: string;
  tipoItem: TipoItemFse;
  descripcion: string;
  cantidad: number;
  precioUnitario: string;
  subtotal: string;
  orden: number;
};

export type FseListItem = {
  id: string;
  numeroFse: string;
  fechaEmision: string;
  estadoDTE: EstadoDTE;
  totalCompra: string;
  reteRenta: string;
  totalPagar: string;
  proveedor: { id: string; nombre: string };
  _count: { items: number };
};

export type Fse = {
  id: string;
  numeroFse: string;
  proveedorId: string;
  proveedor: Proveedor;
  fechaEmision: string;
  condicionPago: 'CONTADO' | 'CREDITO';
  subtotalBienes: string;
  subtotalServicios: string;
  totalCompra: string;
  reteRenta: string;
  totalPagar: string;
  exonerarReteRenta: boolean;
  motivoExoneracion: string | null;
  estadoDTE: EstadoDTE;
  dteId: string | null;
  dteControlNumber: string | null;
  dteRespuestaMH: DteRespuestaMH;
  notas: string | null;
  creadoPor: { id: string; nombre: string; apellido: string };
  items: FseItem[];
  createdAt: string;
  updatedAt: string;
};

export type CrearFseItemDto = { tipoItem: TipoItemFse; descripcion: string; cantidad: number; precioUnitario: number };
export type CrearFseDto = {
  proveedorId: string;
  condicionPago: 'CONTADO' | 'CREDITO';
  exonerarReteRenta: boolean;
  motivoExoneracion?: string;
  notas?: string;
  items: CrearFseItemDto[];
};

export type PlantillaFse = { id: string; proveedorId: string; descripcion: string; tipoItem: TipoItemFse; precioUnitario: string | null; createdAt: string };
```

y extender `Proveedor` con los campos fiscales opcionales (`tipoDocumento?: TipoDocumentoCliente | null; numeroDocumento?: string | null; tipoPersona?: TipoPersonaProveedor | null; actividadEconomica?: string | null; departamento?/municipio?/distrito?/complemento?: string | null; giroPredominante?: TipoItemFse | null; elegibilidadFse?: { elegible: boolean; motivo: string | null }; acumuladoFse12m?: string;`).

- [ ] **Step 2: `hooks/use-fse.ts`** — seguir el patrón exacto de `use-facturas.ts`/`use-cotizaciones.ts` (helper `extractErrorMessage` local, `ApiResponse`/`PaginatedResponse`, invalidaciones `['fses']`/`['fse', id]`, toasts en español según la tabla de CLAUDE.md; `descargarFsePdf`/`descargarConstanciaRetencion` con el patrón blob + `toast.loading`, filenames `${numeroFse}.pdf` y `constancia-${numeroFse}.pdf`).

- [ ] **Step 3: Nav grupo Compras** — en `lib/nav.ts`, insertar entre "Ventas" e "Inventario":

```ts
  {
    label: 'Compras',
    items: [
      { id: 'fse',                 label: 'FSE — Sujeto Excluido',   href: '/fse',                 icon: 'receipt' },
      { id: 'proveedores',         label: 'Proveedores',             href: '/proveedores',         icon: 'building' },
      { id: 'ingresos-inventario', label: 'Ingresos de inventario',  href: '/ingresos-inventario', icon: 'download' },
    ],
  },
```

y QUITAR `proveedores` e `ingresos-inventario` del grupo Inventario. Revisar `BOTTOM_NAV_ITEMS` (líneas ~97-141): si lista esos ids bajo Inventario, moverlos igual.

- [ ] **Step 4: tsc/lint + commit**

```bash
git add types/api.ts hooks/use-fse.ts lib/nav.ts
git commit -m "feat(fse): tipos, hooks y grupo de navegación Compras

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Frontend — datos fiscales en Proveedores + plantillas

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/proveedores/ProveedorForm.tsx`
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/proveedores/PlantillasFseCard.tsx`
- Modify: página de detalle de proveedor (`app/(dashboard)/proveedores/[id]/page.tsx`)
- Modify: `types/api.ts` DTOs de proveedor (campos fiscales en crear/actualizar)

**Interfaces:**
- Consumes: hooks de plantillas (Task 8); catálogos `DEPARTAMENTOS_SV`/`getMunicipiosByDept`/`getDistritosByMuniDept` de `@/lib/sv-geo`; `SECTORES`/CAT-019 como lo haga el form de clientes (leer `components/clientes/` para replicar el input de actividad económica).
- Produces: sección "Datos fiscales (para FSE)" en el form (todos los campos opcionales: tipo/número de documento con placeholder de formato, tipo de persona, actividad económica validada CAT-019, dirección con selects MH en cascada, giro predominante); badge de elegibilidad + acumulado en el detalle; `PlantillasFseCard` (lista + agregar + eliminar con `ConfirmRow`).

- [ ] **Step 1:** Leer `ProveedorForm.tsx` y el form de clientes (para el patrón de dirección/actividad), extender el schema Zod local del form y el JSX con la nueva `<FormSection title="Datos fiscales (para FSE)">`. Los errores 409 de documento duplicado se muestran inline con `setError`.
- [ ] **Step 2:** `PlantillasFseCard` — tarjeta con lista (descripción, tipo, precio opcional `font-mono`), input inline para agregar, `ConfirmRow` para eliminar; oculta escritura a VISUALIZADOR.
- [ ] **Step 3:** Detalle del proveedor: badge (`<Badge status="Elegible FSE" kind="ok" />` / `kind="warn"` con el motivo como texto al lado) + fila "Compras FSE últimos 12 meses: `formatCurrency(acumuladoFse12m)`" + `<PlantillasFseCard proveedorId=… />`.
- [ ] **Step 4:** tsc + lint baseline + commit `feat(proveedores): datos fiscales FSE, elegibilidad y plantillas en la UI`.

---

### Task 10: Frontend — páginas `/fse` (lista) y `/fse/nuevo`

**Files:**
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/app/(dashboard)/fse/page.tsx`
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/app/(dashboard)/fse/nuevo/page.tsx`
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/fse/FseResumenTotales.tsx` (reusado por nuevo/detalle)

**Interfaces:**
- Consumes: hooks Task 8; `EstadoDteBadge` existente (`components/facturas/` o `components/dte/` — localizarlo con grep); `FilterBar`, `Pagination`, `EmptyState`, `PageHeader`, `FormSection`; `useProveedores` (hook existente del módulo proveedores) y `usePlantillasFse`.
- Produces: `FseResumenTotales({ items, exonerar }: { items: CrearFseItemDto[]; exonerar: boolean })` — réplica frontend del cálculo con `decimal.js` (subtotales por tipo, retención, total a pagar) SOLO para preview; el backend recalcula.

- [ ] **Step 1: Lista** — patrón de las páginas de listado existentes (leer `app/(dashboard)/facturas/page.tsx` como referencia): tabla con `numeroFse` (mono), proveedor, fecha (`formatDate`), totalCompra/reteRenta/totalPagar (`formatCurrency`), `EstadoDteBadge`; chips de estadoDTE; botón "Nuevo FSE" (oculto VISUALIZADOR) → `/fse/nuevo`; filas → `/fse/[id]`.
- [ ] **Step 2: FseResumenTotales** — cálculo espejo con `decimal.js`:

```tsx
const subtotalServicios = items.filter(i => i.tipoItem === 'SERVICIOS')
  .reduce((a, i) => a.add(new Decimal(i.precioUnitario || 0).mul(i.cantidad || 0)), new Decimal(0));
// …idem bienes; reteRenta = exonerar ? 0 : servicios.mul(0.1).toDecimalPlaces(2)
```

filas: Subtotal bienes / Subtotal servicios / Total compra / "Retención renta (10 % servicios)" en rojo suave / **Total a pagar** destacado.

- [ ] **Step 3: /fse/nuevo** — RHF para cabecera (proveedorId, condicionPago, exonerar+motivo, notas) + `useState` para el array de ítems (patrón de `actas/nueva`):
  - Selector de proveedor (select de `useProveedores({ activo: true, limit: 100 })`); al elegir, `useProveedor(id)` trae `elegibilidadFse` + `acumuladoFse12m`: si no elegible → banner `kind=danger` con motivo y link `/proveedores/[id]`; banner umbral cuando `new Decimal(acumulado).add(totalCompra) >= 5714.29` (texto: "Este proveedor supera el umbral del Art. 28 LIVA ($5,714.29) en 12 meses — debería inscribirse en IVA").
  - Ítems: filas con select tipo (default = `giroPredominante` del proveedor), descripción, cantidad, precio; botón "+ Ítem"; botón "Desde plantilla" (dropdown de `usePlantillasFse`).
  - `FseResumenTotales` en vivo; submit → `useCrearFse` → redirect `/fse/[id]`. Botón deshabilitado si proveedor no elegible o sin ítems.
- [ ] **Step 4:** tsc + lint + commit `feat(fse): páginas de listado y creación de FSE`.

---

### Task 11: Frontend — detalle `/fse/[id]` con panel DTE y descargas

**Files:**
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/app/(dashboard)/fse/[id]/page.tsx`
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/fse/FseDtePanel.tsx`
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/app/(dashboard)/fse/[id]/editar/page.tsx` (mismo form de nuevo, precargado; solo PENDIENTE/RECHAZADO)

**Interfaces:**
- Consumes: `useFse(id)`, mutations DTE (Task 8), `descargarFsePdf`/`descargarConstanciaRetencion`.
- Produces: `FseDtePanel({ fse })` — espejo visual de `DteSection` (leerla como referencia) SIN selector de tipo (el FSE es siempre DTE 14): estado + `dteControlNumber` mono, botón Emitir (PENDIENTE), "Corregir y re-emitir" (RECHAZADO, muestra `dteRespuestaMH` como en facturas), Sincronizar (PROCESANDO), Anular con motivo (APROBADO, solo ADMIN, `ConfirmRow` + textarea), descargas PDF/JSON oficiales y **Constancia de retención** (solo APROBADO y `reteRenta > 0`).

- [ ] **Step 1:** Página de detalle: cabecera (`PageHeader` con numeroFse + `EstadoDteBadge`), grid: proveedor (nombre, documento, link), ítems (tabla con tipo/descripción/cantidad/precio/subtotal), `FseResumenTotales` en modo lectura (o los totales persistidos directamente), exoneración visible con motivo si aplica, notas; `FseDtePanel`; acciones editar/eliminar según estado (ocultas VISUALIZADOR; eliminar con `ConfirmRow`).
- [ ] **Step 2:** `FseDtePanel` según Produces.
- [ ] **Step 3:** `/fse/[id]/editar`: reusar el form de nuevo (extraer a `components/fse/FseForm.tsx` si al hacerlo el archivo de página queda más claro — decisión del implementer), precargar de `useFse`, submit → `useActualizarFse`.
- [ ] **Step 4:** tsc + lint + verificación manual del flujo completo contra el sandbox de FacturaLlama (crear proveedor fiscal → FSE mixto → emitir → constancia → anular). Commit `feat(fse): detalle de FSE con panel DTE, constancia y edición`.

---

### Task 12: Frontend — remover FSE del flujo de ventas

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/cotizaciones/GenerarFacturaModal.tsx`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/dte/DteSection.tsx`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/types/api.ts`

- [ ] **Step 1: Tipos** — en `types/api.ts`: nuevo `export type TipoDTEEmitible = 'FC' | 'CCF';` — `TipoDTE` (lectura) conserva `SUJETO_EXCLUIDO` para históricos. `GenerarFacturaInput.tipoDTE` y `EmitirDTEDto.tipoDTE` pasan a `TipoDTEEmitible`.
- [ ] **Step 2: GenerarFacturaModal** — quitar `<option value="SUJETO_EXCLUIDO">`, el estado local pasa a `'FC' | 'CCF'`, y la re-sugerencia por tipo de cliente queda igual (EMPRESA→CCF, PARTICULAR→FC).
- [ ] **Step 3: DteSection** — el grid de selección itera `(['FC', 'CCF'] as const)`; `TIPO_INFO` CONSERVA la entrada `SUJETO_EXCLUIDO` (el Record es exhaustivo sobre `TipoDTE` y el label se usa para mostrar facturas históricas); eliminar la rama `SUJETO_EXCLUIDO` de `motivoBloqueo`. `TipoDteBadge` no cambia.
- [ ] **Step 4:** tsc + lint + manual: generar factura y re-emitir tras anular solo ofrecen FC/CCF; una factura FSE histórica sigue mostrando su badge y detalle. Commit `feat(facturas): remover FSE del flujo de ventas en la UI (históricos intactos)`.

---

## Verificación final del grupo

- [ ] Backend: `pnpm test` (14 pre-existentes, todos los tests nuevos verdes) + `npx tsc --noEmit`.
- [ ] Frontend: `pnpm tsc --noEmit` + `pnpm lint` (12/24 baseline).
- [ ] Flujo manual E2E contra sandbox FacturaLlama (Task 11 Step 4) — incluye validar el supuesto de `retentionRenta` como monto.
- [ ] Checklist estándar pre-PR (dark mode, tablet 768px, roles, toasts).
