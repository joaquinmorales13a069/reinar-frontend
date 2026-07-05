# Condición de pago en factura + QUEDAN con plazo desde entrega — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover la condición de pago (contado/crédito) de la cotización a la factura con reglas de vencimiento automáticas, y modelar QUEDAN con plazo en días que corre desde la entrega física, más días de recepción de facturas por cliente.

**Architecture:** Campo propio `condicionPago` + `plazoCredito` en `Factura` (Prisma), `fechaVencimiento` nullable (null = QUEDAN sin entregar), `diasRecepcionQuedan String[]` en `Cliente`. El backend calcula vencimientos (contado = emisión+24h; QUEDAN = entrega real + plazo). El frontend rediseña el modal de generación de factura en torno a la condición de pago y quita el select de la cotización.

**Tech Stack:** Backend: Express + Prisma (PostgreSQL remota compartida) + Zod + vitest en `/Users/joaquinmorales13a06/Desktop/Reinar/server`. Frontend: Next.js App Router + React Query + RHF/Zod + Tailwind en `/Users/joaquinmorales13a06/Desktop/Reinar/frontend`.

**Spec:** `docs/superpowers/specs/2026-07-05-facturas-condicion-pago-quedan-design.md`

## Global Constraints

- **Ramas:** `feat/facturas-condicion-pago-quedan` en AMBOS repos. El frontend ya está en esa rama; el server hay que crearla desde `main` (Task 1).
- **BD remota compartida** (`panel.reinarsa.com`): NUNCA `prisma migrate dev`, `migrate reset` ni `db push --force-reset`. Migraciones: `migrate diff` offline → limpiar ruido del SQL → `migrate deploy`.
- **UI 100% en español.** Comentarios solo "why", en español.
- **Tailwind:** solo clases predefinidas; sin valores arbitrarios (`h-[20px]` prohibido); sin CSS vanilla en `globals.css`.
- **Montos:** strings Decimal — nunca `parseFloat`; usar `decimal.js` + `formatCurrency`.
- **Mutations frontend:** `toast.success` en onSuccess, `toast.error` en onError; errores de validación inline con `setError`, no toast.
- **VISUALIZADOR** no ve botones de escritura.
- **Commits:** mensajes en español estilo `feat(facturas): …`, terminar con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- **Verificación:** server = `pnpm test` + `npx tsc --noEmit`; frontend = `pnpm tsc --noEmit` + `pnpm lint` (no hay suite de tests en frontend).
- Enum Prisma existente `CondicionesPago = CONTADO | CREDITO | OTRO`. `OTRO` se conserva en el enum (histórico) pero las facturas nuevas solo aceptan `CONTADO | CREDITO`.

---

## PARTE 1 — BACKEND (`/Users/joaquinmorales13a06/Desktop/Reinar/server`)

### Task 1: Rama + migración Prisma + fallout de compilación

**Files:**
- Modify: `prisma/schema.prisma:282-321` (Cliente), `prisma/schema.prisma:576-622` (Factura)
- Create: `prisma/migrations/20260705120000_factura_condicion_pago_quedan/migration.sql`
- Modify: `src/modules/pdf/pdf.service.ts:412`
- Modify: `src/modules/correos/correos.service.ts:267`

**Interfaces:**
- Produces: `Factura.condicionPago: CondicionesPago | null`, `Factura.plazoCredito: number | null`, `Factura.fechaVencimiento: Date | null`, `Cliente.diasRecepcionQuedan: string[]` — tipos Prisma que consumen las Tasks 2-7.

- [ ] **Step 1: Crear la rama en el server**

```bash
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server checkout main
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server pull
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server checkout -b feat/facturas-condicion-pago-quedan
```

- [ ] **Step 2: Editar `prisma/schema.prisma`**

En `model Factura`, reemplazar:

```prisma
  estado           EstadoFactura @default(PENDIENTE)
  fechaEmision     DateTime      @default(now())
  fechaVencimiento DateTime
```

por:

```prisma
  estado           EstadoFactura @default(PENDIENTE)
  fechaEmision     DateTime      @default(now())
  // null solo mientras una QUEDAN no se ha entregado — el vencimiento se
  // materializa al registrar la entrega física (fechaEntregaReal + plazoCredito).
  fechaVencimiento DateTime?

  // Condición de pago propia de la factura (feedback ventas jul-2026). CONTADO
  // vence 24h después de la emisión; CREDITO usa fecha manual o plazo QUEDAN.
  // Nullable solo por facturas históricas (backfill desde la cotización).
  condicionPago CondicionesPago?
  // Días de plazo para QUEDAN — el vencimiento corre desde la entrega física.
  plazoCredito  Int?
```

En `model Cliente`, después de la línea `manejaQuedan Boolean @default(false)`:

```prisma
  // Días de la semana en que el cliente recibe facturas físicas (QUEDAN).
  // Valores LUNES..DOMINGO. Solo relevante cuando manejaQuedan = true.
  diasRecepcionQuedan String[] @default([])
```

- [ ] **Step 3: Validar y generar el SQL offline**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
npx prisma validate
git show HEAD:prisma/schema.prisma > /tmp/schema-old.prisma
mkdir -p prisma/migrations/20260705120000_factura_condicion_pago_quedan
npx prisma migrate diff --from-schema /tmp/schema-old.prisma --to-schema prisma/schema.prisma --script > prisma/migrations/20260705120000_factura_condicion_pago_quedan/migration.sql
```

- [ ] **Step 4: Limpiar el SQL y agregar backfill**

Abrir `migration.sql` y **borrar las líneas de ruido de stdout** al inicio (`npm warn …`, `Loaded Prisma config …`) — si quedan, la migración falla al aplicar. El SQL limpio debe verse así (verificar nombres exactos que emita `migrate diff` — los modelos no usan `@@map`, así que las tablas son `"Cliente"`, `"Factura"`, `"Cotizacion"`):

```sql
-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN "diasRecepcionQuedan" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Factura" ADD COLUMN "condicionPago" "CondicionesPago",
ADD COLUMN "plazoCredito" INTEGER,
ALTER COLUMN "fechaVencimiento" DROP NOT NULL;
```

Al final del archivo, **agregar el backfill**:

```sql
-- Backfill: las facturas históricas heredan la condición de pago de su cotización.
UPDATE "Factura" f
SET "condicionPago" = c."condicionesPago"
FROM "Cotizacion" c
WHERE f."cotizacionId" = c."id" AND c."condicionesPago" IS NOT NULL;
```

- [ ] **Step 5: Regenerar el cliente Prisma y ver el fallout de tipos**

```bash
npx prisma generate
npx tsc --noEmit
```

Expected: **exactamente 2 errores** por `fechaVencimiento` ahora `Date | null`:
- `src/modules/pdf/pdf.service.ts:412` (`formatFechaCorta` no acepta null)
- `src/modules/correos/correos.service.ts:267` (`.toLocaleDateString` sobre posible null)

(`src/modules/reportes/reportes.service.ts:190` ya tiene guard ternario — una QUEDAN sin vencimiento cae en el bucket "corriente" con 0 días vencidos, que cumple el requisito del spec de nunca contarla como vencida. `src/jobs/marcarFacturasVencidas.ts` usa `{ lt }` que en SQL excluye NULL — sin cambios en ambos.)

- [ ] **Step 6: Corregir los 2 errores con guards mínimos**

En `src/modules/pdf/pdf.service.ts:412` reemplazar:

```typescript
      fechaVencimiento:    formatFechaCorta(factura.fechaVencimiento),
```

por (el texto final "Al entregar (N días)" se completa en Task 5):

```typescript
      fechaVencimiento:    factura.fechaVencimiento ? formatFechaCorta(factura.fechaVencimiento) : null,
```

En `src/modules/correos/correos.service.ts:267` reemplazar:

```typescript
        fechaVencimiento: fac.fechaVencimiento.toLocaleDateString('es-SV'),
```

por:

```typescript
        fechaVencimiento: fac.fechaVencimiento ? fac.fechaVencimiento.toLocaleDateString('es-SV') : 'Al entregar',
```

- [ ] **Step 7: Verificar compilación y suite completa**

```bash
npx tsc --noEmit && pnpm test
```
Expected: 0 errores TS; todos los tests existentes PASS (los mocks son `as any`, la relajación de tipos no los rompe).

- [ ] **Step 8: Aplicar la migración a la BD remota**

```bash
npx prisma migrate deploy
npx prisma migrate status
```
Expected: `migrate status` reporta "Database schema is up to date!".

- [ ] **Step 9: Commit**

```bash
git add prisma/ src/modules/pdf/pdf.service.ts src/modules/correos/correos.service.ts
git commit -m "feat(facturas): schema — condicionPago y plazoCredito en Factura, diasRecepcionQuedan en Cliente

fechaVencimiento pasa a nullable (QUEDAN sin entregar). Backfill de
condicionPago desde la cotización.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Generación de factura — nuevo schema y cálculo de vencimiento

**Files:**
- Modify: `src/modules/facturas/facturas.schemas.ts:54-70` (generarFacturaSchema)
- Modify: `src/modules/facturas/facturas.service.ts:369-442` (generarFacturaDesdeCotizacion)
- Test: `tests/modules/facturas/facturas.service.test.ts`

**Interfaces:**
- Consumes: campos Prisma de Task 1.
- Produces: `generarFacturaSchema` acepta `{ tipoDTE, contactoFacturacionId?, condicionPago: 'CONTADO'|'CREDITO', fechaVencimiento?, esQuedan, fechaEntregaFactura?, plazoCredito? }`. `generarFacturaDesdeCotizacion` persiste `condicionPago`, `plazoCredito`, calcula `fechaVencimiento` y devuelve `{ factura, warning?: string }` (warning puede concatenar varios avisos separados por espacio). La Task 9 (frontend) consume este contrato.

- [ ] **Step 1: Escribir los tests que fallan**

En `tests/modules/facturas/facturas.service.test.ts`:

1. Ampliar el mock de prisma (bloque `vi.mock('../../../src/lib/prisma', …)`) agregando dentro del objeto `prisma`:

```typescript
    cotizacion: { findUnique: vi.fn() },
    actaEntrega: { findMany: vi.fn() },
```

y dentro de `factura`: `create: vi.fn(),`

2. Agregar el mock de numeración después de los `vi.mock` existentes:

```typescript
vi.mock('../../../src/lib/numeracion', () => ({
  generarNumero: vi.fn().mockResolvedValue('FAC2607000001'),
}))
```

3. Agregar `generarFacturaDesdeCotizacion` al import de `facturas.service` y `generarFacturaSchema` al import (crear import desde `'../../../src/modules/facturas/facturas.schemas'`).

4. Agregar al final del archivo:

```typescript
// ── generarFacturaSchema ──────────────────────────────────────────────────────

describe('generarFacturaSchema', () => {
  const base = { tipoDTE: 'FC' as const }

  it('CONTADO: rechaza esQuedan y fechaVencimiento manual', () => {
    const conQuedan = generarFacturaSchema.safeParse({ ...base, condicionPago: 'CONTADO', esQuedan: true, fechaEntregaFactura: '2026-07-10', plazoCredito: 30 })
    expect(conQuedan.success).toBe(false)

    const conFecha = generarFacturaSchema.safeParse({ ...base, condicionPago: 'CONTADO', fechaVencimiento: '2026-08-01' })
    expect(conFecha.success).toBe(false)

    const ok = generarFacturaSchema.safeParse({ ...base, condicionPago: 'CONTADO' })
    expect(ok.success).toBe(true)
  })

  it('CREDITO sin QUEDAN: exige fechaVencimiento', () => {
    const sinFecha = generarFacturaSchema.safeParse({ ...base, condicionPago: 'CREDITO' })
    expect(sinFecha.success).toBe(false)

    const ok = generarFacturaSchema.safeParse({ ...base, condicionPago: 'CREDITO', fechaVencimiento: '2026-08-01' })
    expect(ok.success).toBe(true)
  })

  it('CREDITO con QUEDAN: exige plazoCredito y fechaEntregaFactura, rechaza fechaVencimiento', () => {
    const sinPlazo = generarFacturaSchema.safeParse({ ...base, condicionPago: 'CREDITO', esQuedan: true, fechaEntregaFactura: '2026-07-10' })
    expect(sinPlazo.success).toBe(false)

    const conFecha = generarFacturaSchema.safeParse({ ...base, condicionPago: 'CREDITO', esQuedan: true, fechaEntregaFactura: '2026-07-10', plazoCredito: 30, fechaVencimiento: '2026-08-01' })
    expect(conFecha.success).toBe(false)

    const ok = generarFacturaSchema.safeParse({ ...base, condicionPago: 'CREDITO', esQuedan: true, fechaEntregaFactura: '2026-07-10', plazoCredito: 30 })
    expect(ok.success).toBe(true)
  })

  it('rechaza OTRO como condición de pago', () => {
    const r = generarFacturaSchema.safeParse({ ...base, condicionPago: 'OTRO' })
    expect(r.success).toBe(false)
  })
})

// ── generarFacturaDesdeCotizacion ─────────────────────────────────────────────

describe('generarFacturaDesdeCotizacion', () => {
  const COTIZACION_ID = 'clh1234567890abcdefghijk5'
  const cotizacionBase = {
    id: COTIZACION_ID,
    estado: 'APROBADA',
    clienteId: 'clh1234567890abcdefghijk7',
    factura: null,
    subtotal: new Decimal(100), porcentajeIva: new Decimal(13),
    exentoIva: false, montoIva: new Decimal(13), total: new Decimal(113),
    cliente: { diasRecepcionQuedan: [] as string[] },
  }

  beforeEach(() => {
    prismaMock.cotizacion.findUnique.mockResolvedValue(cotizacionBase as any)
    prismaMock.factura.create.mockImplementation((args: any) => Promise.resolve({ id: FACTURA_ID, ...args.data }))
    prismaMock.actaEntrega.findMany.mockResolvedValue([])
  })

  it('CONTADO: calcula vencimiento a +24h y persiste condicionPago', async () => {
    const antes = Date.now()
    const { factura } = await generarFacturaDesdeCotizacion(
      COTIZACION_ID,
      { tipoDTE: 'FC', condicionPago: 'CONTADO', esQuedan: false } as any,
      USUARIO_ID,
    )
    const data = prismaMock.factura.create.mock.calls[0][0].data
    expect(data.condicionPago).toBe('CONTADO')
    expect(data.plazoCredito).toBeNull()
    const delta = data.fechaVencimiento.getTime() - antes
    expect(delta).toBeGreaterThan(23.9 * 60 * 60 * 1000)
    expect(delta).toBeLessThan(24.1 * 60 * 60 * 1000)
    expect(factura.id).toBe(FACTURA_ID)
  })

  it('CREDITO sin QUEDAN: usa la fecha provista', async () => {
    const fecha = new Date('2026-08-15T00:00:00.000Z')
    await generarFacturaDesdeCotizacion(
      COTIZACION_ID,
      { tipoDTE: 'FC', condicionPago: 'CREDITO', esQuedan: false, fechaVencimiento: fecha } as any,
      USUARIO_ID,
    )
    const data = prismaMock.factura.create.mock.calls[0][0].data
    expect(data.fechaVencimiento).toEqual(fecha)
    expect(data.plazoCredito).toBeNull()
  })

  it('CREDITO con QUEDAN: vencimiento null y plazo persistido', async () => {
    await generarFacturaDesdeCotizacion(
      COTIZACION_ID,
      { tipoDTE: 'FC', condicionPago: 'CREDITO', esQuedan: true, plazoCredito: 30, fechaEntregaFactura: new Date('2026-07-08T00:00:00.000Z') } as any,
      USUARIO_ID,
    )
    const data = prismaMock.factura.create.mock.calls[0][0].data
    expect(data.fechaVencimiento).toBeNull()
    expect(data.plazoCredito).toBe(30)
    expect(data.esQuedan).toBe(true)
  })

  it('QUEDAN: advierte si la entrega cae fuera de los días de recepción del cliente', async () => {
    prismaMock.cotizacion.findUnique.mockResolvedValue({
      ...cotizacionBase,
      cliente: { diasRecepcionQuedan: ['MARTES', 'JUEVES'] },
    } as any)
    // 2026-07-08 es miércoles (UTC)
    const { warning } = await generarFacturaDesdeCotizacion(
      COTIZACION_ID,
      { tipoDTE: 'FC', condicionPago: 'CREDITO', esQuedan: true, plazoCredito: 30, fechaEntregaFactura: new Date('2026-07-08T00:00:00.000Z') } as any,
      USUARIO_ID,
    )
    expect(warning).toContain('martes, jueves')
    expect(warning).toContain('miércoles')
  })

  it('QUEDAN: NO advierte por día si la entrega cae en día de recepción', async () => {
    prismaMock.cotizacion.findUnique.mockResolvedValue({
      ...cotizacionBase,
      cliente: { diasRecepcionQuedan: ['MIERCOLES'] },
    } as any)
    const { warning } = await generarFacturaDesdeCotizacion(
      COTIZACION_ID,
      { tipoDTE: 'FC', condicionPago: 'CREDITO', esQuedan: true, plazoCredito: 30, fechaEntregaFactura: new Date('2026-07-08T00:00:00.000Z') } as any,
      USUARIO_ID,
    )
    expect(warning ?? '').not.toContain('recibe facturas')
  })
})
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
pnpm test tests/modules/facturas/facturas.service.test.ts
```
Expected: FAIL — el schema actual no conoce `condicionPago` y el service no lo persiste.

- [ ] **Step 3: Implementar el schema**

En `src/modules/facturas/facturas.schemas.ts`, reemplazar el bloque `generarFacturaSchema` completo (líneas 56-70) por:

```typescript
export const generarFacturaSchema = z.object({
  tipoDTE:               z.enum(['FC', 'CCF', 'SUJETO_EXCLUIDO']),
  // Opcional: el cliente ya tiene sus datos fiscales (NRC/NIT/etc.). El
  // contacto solo es para tracking de a quien dirigir el documento dentro
  // de la empresa cliente.
  contactoFacturacionId: z.string().min(1).optional().nullable(),
  // Solo CONTADO/CREDITO en facturas nuevas — OTRO queda en el enum Prisma
  // únicamente por las cotizaciones históricas.
  condicionPago:         z.enum(['CONTADO', 'CREDITO']),
  fechaVencimiento:      z.coerce.date().optional(),
  esQuedan:              z.boolean().default(false),
  fechaEntregaFactura:   z.coerce.date().optional(),
  plazoCredito:          z.number().int().min(1).max(365).optional(),
}).superRefine((d, ctx) => {
  if (d.condicionPago === 'CONTADO') {
    // Contado vence solo: emisión + 24h. QUEDAN implica plazo desde entrega,
    // incompatible con contado.
    if (d.esQuedan) ctx.addIssue({ code: 'custom', path: ['esQuedan'], message: 'QUEDAN solo está disponible con crédito' })
    if (d.fechaVencimiento) ctx.addIssue({ code: 'custom', path: ['fechaVencimiento'], message: 'Contado vence automáticamente 24 horas después de la emisión' })
    return
  }
  if (!d.esQuedan && !d.fechaVencimiento) {
    ctx.addIssue({ code: 'custom', path: ['fechaVencimiento'], message: 'La fecha de vencimiento es requerida para crédito' })
  }
  if (d.esQuedan) {
    if (d.fechaVencimiento) ctx.addIssue({ code: 'custom', path: ['fechaVencimiento'], message: 'En QUEDAN el vencimiento se calcula al entregar la factura' })
    if (!d.plazoCredito) ctx.addIssue({ code: 'custom', path: ['plazoCredito'], message: 'El plazo de crédito (días) es requerido para QUEDAN' })
    if (!d.fechaEntregaFactura) ctx.addIssue({ code: 'custom', path: ['fechaEntregaFactura'], message: 'fechaEntregaFactura es requerida cuando esQuedan es true' })
  }
})
export type GenerarFacturaInput = z.infer<typeof generarFacturaSchema>
```

- [ ] **Step 4: Implementar el service**

En `src/modules/facturas/facturas.service.ts`, agregar cerca del tope (después de los imports):

```typescript
const MS_POR_DIA = 24 * 60 * 60 * 1000
// Índice = getUTCDay() (0 = domingo). Las fechas de input llegan como fecha
// pura (00:00Z), por eso se mapea en UTC y no con getDay() local.
const DIAS_SEMANA_UTC = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'] as const
const LABEL_DIA: Record<string, string> = {
  LUNES: 'lunes', MARTES: 'martes', MIERCOLES: 'miércoles', JUEVES: 'jueves',
  VIERNES: 'viernes', SABADO: 'sábado', DOMINGO: 'domingo',
}
```

Reemplazar `generarFacturaDesdeCotizacion` (líneas 369-442) por:

```typescript
export async function generarFacturaDesdeCotizacion(
  cotizacionId: string,
  input: GenerarFacturaInput,
  usuarioId: string,
) {
  return prisma.$transaction(async (tx) => {
    const cotizacion = await tx.cotizacion.findUnique({
      where: { id: cotizacionId },
      include: { factura: true, cliente: { select: { diasRecepcionQuedan: true } } },
    })
    if (!cotizacion) throw new AppError(404, 'NOT_FOUND', 'Cotización no encontrada')
    if (cotizacion.estado !== 'APROBADA') {
      throw new AppError(409, 'ESTADO_INVALIDO', 'Solo se puede facturar una cotización APROBADA')
    }
    if (cotizacion.factura) {
      throw new AppError(409, 'YA_EXISTE_FACTURA', 'Esta cotización ya tiene una factura')
    }

    const numeroFactura = await generarNumero('factura', tx)

    // CONTADO vence 24h después de la emisión; QUEDAN nace sin vencimiento
    // (se materializa al registrar la entrega física); crédito usa la fecha manual.
    const fechaVencimiento =
      input.condicionPago === 'CONTADO' ? new Date(Date.now() + MS_POR_DIA)
      : input.esQuedan ? null
      : input.fechaVencimiento!

    const factura = await tx.factura.create({
      data: {
        numeroFactura,
        cotizacionId,
        clienteId:             cotizacion.clienteId,
        contactoFacturacionId: input.contactoFacturacionId ?? null,
        condicionPago:         input.condicionPago,
        plazoCredito:          input.esQuedan ? input.plazoCredito! : null,
        fechaVencimiento,
        subtotal:              cotizacion.subtotal,
        porcentajeIva:         cotizacion.porcentajeIva,
        exentoIva:             cotizacion.exentoIva,
        montoIva:              cotizacion.montoIva,
        total:                 cotizacion.total,
        montoPagado:           new Decimal(0),
        saldoPendiente:        cotizacion.total,
        tipoDTE:               input.tipoDTE,
        esQuedan:              input.esQuedan,
        fechaEntregaFactura:   input.esQuedan ? input.fechaEntregaFactura : null,
      },
    })

    await tx.auditLog.create({
      data: {
        usuarioId,
        entidad: 'Factura',
        entidadId: factura.id,
        accion: 'CREAR',
        camposDespues: {
          numeroFactura,
          cotizacionId,
          tipoDTE: input.tipoDTE,
          condicionPago: input.condicionPago,
          esQuedan: input.esQuedan,
        } as Prisma.InputJsonValue,
      },
    })

    const warnings: string[] = []
    if (input.esQuedan) {
      // Advertencia no bloqueante si QUEDAN se emite con actas pendientes de devolución.
      const actas = await tx.actaEntrega.findMany({
        where: { factura: { cotizacionId } },
        select: { estado: true },
      })
      const hayPendientes = actas.length === 0 || actas.some((a) => a.estado !== 'DEVUELTO')
      if (hayPendientes) {
        warnings.push('Se recomienda emitir QUEDAN después de devolver el inventario.')
      }

      // Advertencia no bloqueante si la entrega programada cae fuera de los
      // días en que el cliente recibe facturas.
      const dias = cotizacion.cliente.diasRecepcionQuedan
      if (dias.length > 0 && input.fechaEntregaFactura) {
        const diaEntrega = DIAS_SEMANA_UTC[input.fechaEntregaFactura.getUTCDay()]
        if (!dias.includes(diaEntrega)) {
          const listaDias = dias.map((d) => LABEL_DIA[d] ?? d).join(', ')
          warnings.push(`El cliente recibe facturas los ${listaDias}; la fecha programada cae ${LABEL_DIA[diaEntrega]}.`)
        }
      }
    }

    return { factura, warning: warnings.length > 0 ? warnings.join(' ') : undefined }
  })
}
```

- [ ] **Step 5: Correr tests y typecheck**

```bash
pnpm test tests/modules/facturas/ && npx tsc --noEmit
```
Expected: PASS (los tests nuevos y los preexistentes de facturas).

- [ ] **Step 6: Commit**

```bash
git add src/modules/facturas/ tests/modules/facturas/
git commit -m "feat(facturas): condición de pago al generar — contado +24h, crédito manual, QUEDAN con plazo

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: marcarFacturaEntregada materializa el vencimiento QUEDAN

**Files:**
- Modify: `src/modules/facturas/facturas.service.ts:446-478` (marcarFacturaEntregada)
- Test: `tests/modules/facturas/facturas.service.test.ts`

**Interfaces:**
- Consumes: `Factura.plazoCredito`, `Factura.fechaVencimiento` (Task 1).
- Produces: `marcarFacturaEntregada` devuelve la factura actualizada con `fechaVencimiento` calculada (`fechaEntregaReal + plazoCredito` días). El frontend (Task 10) usa `factura.fechaVencimiento` de la respuesta para el toast.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar en `tests/modules/facturas/facturas.service.test.ts` (importar `marcarFacturaEntregada` del service):

```typescript
// ── marcarFacturaEntregada ────────────────────────────────────────────────────

describe('marcarFacturaEntregada', () => {
  beforeEach(() => {
    prismaMock.factura.update.mockImplementation((args: any) =>
      Promise.resolve({ id: FACTURA_ID, ...args.data }),
    )
  })

  it('QUEDAN con plazo: calcula fechaVencimiento = entrega + plazo días', async () => {
    prismaMock.factura.findUnique.mockResolvedValue({
      id: FACTURA_ID, esQuedan: true, fechaEntregaReal: null,
      plazoCredito: 30, fechaVencimiento: null,
    } as any)

    const entrega = new Date('2026-07-10T00:00:00.000Z')
    await marcarFacturaEntregada(FACTURA_ID, entrega, USUARIO_ID)

    const data = prismaMock.factura.update.mock.calls[0][0].data
    expect(data.fechaEntregaReal).toEqual(entrega)
    expect(data.fechaVencimiento).toEqual(new Date('2026-08-09T00:00:00.000Z'))
  })

  it('QUEDAN histórica sin plazo: no toca el vencimiento', async () => {
    prismaMock.factura.findUnique.mockResolvedValue({
      id: FACTURA_ID, esQuedan: true, fechaEntregaReal: null,
      plazoCredito: null, fechaVencimiento: new Date('2026-08-01T00:00:00.000Z'),
    } as any)

    await marcarFacturaEntregada(FACTURA_ID, new Date('2026-07-10T00:00:00.000Z'), USUARIO_ID)

    const data = prismaMock.factura.update.mock.calls[0][0].data
    expect(data.fechaVencimiento).toBeUndefined()
  })

  it('rechaza si no es QUEDAN', async () => {
    prismaMock.factura.findUnique.mockResolvedValue({ id: FACTURA_ID, esQuedan: false } as any)
    await expect(
      marcarFacturaEntregada(FACTURA_ID, new Date(), USUARIO_ID),
    ).rejects.toThrow(expect.objectContaining({ code: 'NO_QUEDAN' }))
  })
})
```

- [ ] **Step 2: Correr y verificar FAIL**

```bash
pnpm test tests/modules/facturas/facturas.service.test.ts
```
Expected: FAIL — el service actual no calcula `fechaVencimiento`.

- [ ] **Step 3: Implementar**

En `marcarFacturaEntregada` (facturas.service.ts), reemplazar el bloque desde `const actualizada = await tx.factura.update…` hasta el `auditLog.create` inclusive por:

```typescript
    // QUEDAN: el plazo corre desde la entrega física — el vencimiento se
    // materializa en esta única transición (fechaEntregaReal ya validado null).
    const fechaVencimiento =
      factura.plazoCredito && !factura.fechaVencimiento
        ? new Date(fechaEntregaReal.getTime() + factura.plazoCredito * 24 * 60 * 60 * 1000)
        : undefined

    const actualizada = await tx.factura.update({
      where: { id: facturaId },
      data: {
        fechaEntregaReal,
        ...(fechaVencimiento && { fechaVencimiento }),
      },
    })

    await tx.auditLog.create({
      data: {
        usuarioId,
        entidad: 'Factura',
        entidadId: facturaId,
        accion: 'MARCAR_ENTREGADA',
        camposDespues: {
          fechaEntregaReal: fechaEntregaReal.toISOString(),
          ...(fechaVencimiento && { fechaVencimiento: fechaVencimiento.toISOString() }),
        } as Prisma.InputJsonValue,
      },
    })
```

- [ ] **Step 4: Correr tests y typecheck**

```bash
pnpm test tests/modules/facturas/ && npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/facturas/ tests/modules/facturas/
git commit -m "feat(facturas): marcar entregada calcula vencimiento QUEDAN (entrega + plazo)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: actualizarFactura — reglas de edición de vencimiento y plazo

**Files:**
- Modify: `src/modules/facturas/facturas.schemas.ts:21-32` (actualizarFacturaSchema)
- Modify: `src/modules/facturas/facturas.service.ts:115-129` (actualizarFactura)
- Test: `tests/modules/facturas/facturas.service.test.ts`

**Interfaces:**
- Produces: `PATCH /facturas/:id` acepta además `plazoCredito?: number`. Reglas 422: vencimiento no editable en CONTADO ni en QUEDAN sin entregar; plazo solo editable en QUEDAN sin entregar. El frontend (Task 8) refleja `plazoCredito` en `ActualizarFacturaDto`.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar en el `describe('actualizarFactura')` existente de `tests/modules/facturas/facturas.service.test.ts`:

```typescript
  it('rechaza editar fechaVencimiento en factura CONTADO', async () => {
    prismaMock.factura.findUnique.mockResolvedValue({
      id: FACTURA_ID, estado: 'PENDIENTE', condicionPago: 'CONTADO', esQuedan: false, fechaEntregaReal: null,
    } as any)
    await expect(
      actualizarFactura(FACTURA_ID, { fechaVencimiento: '2026-08-01T00:00:00.000Z' }),
    ).rejects.toThrow(expect.objectContaining({ code: 'ESTADO_INVALIDO' }))
  })

  it('rechaza editar fechaVencimiento en QUEDAN sin entregar', async () => {
    prismaMock.factura.findUnique.mockResolvedValue({
      id: FACTURA_ID, estado: 'PENDIENTE', condicionPago: 'CREDITO', esQuedan: true, fechaEntregaReal: null,
    } as any)
    await expect(
      actualizarFactura(FACTURA_ID, { fechaVencimiento: '2026-08-01T00:00:00.000Z' }),
    ).rejects.toThrow(expect.objectContaining({ code: 'ESTADO_INVALIDO' }))
  })

  it('permite editar plazoCredito en QUEDAN sin entregar', async () => {
    prismaMock.factura.findUnique.mockResolvedValue({
      id: FACTURA_ID, estado: 'PENDIENTE', condicionPago: 'CREDITO', esQuedan: true, fechaEntregaReal: null,
    } as any)
    prismaMock.factura.update.mockResolvedValue({ id: FACTURA_ID, plazoCredito: 45 } as any)

    await actualizarFactura(FACTURA_ID, { plazoCredito: 45 })

    expect(prismaMock.factura.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ plazoCredito: 45 }) }),
    )
  })

  it('rechaza plazoCredito si la factura no es QUEDAN o ya fue entregada', async () => {
    prismaMock.factura.findUnique.mockResolvedValue({
      id: FACTURA_ID, estado: 'PENDIENTE', condicionPago: 'CREDITO', esQuedan: false, fechaEntregaReal: null,
    } as any)
    await expect(actualizarFactura(FACTURA_ID, { plazoCredito: 45 })).rejects.toThrow(
      expect.objectContaining({ code: 'ESTADO_INVALIDO' }),
    )

    prismaMock.factura.findUnique.mockResolvedValue({
      id: FACTURA_ID, estado: 'PENDIENTE', condicionPago: 'CREDITO', esQuedan: true, fechaEntregaReal: new Date(),
    } as any)
    await expect(actualizarFactura(FACTURA_ID, { plazoCredito: 45 })).rejects.toThrow(
      expect.objectContaining({ code: 'ESTADO_INVALIDO' }),
    )
  })
```

- [ ] **Step 2: Correr y verificar FAIL**

```bash
pnpm test tests/modules/facturas/facturas.service.test.ts
```

- [ ] **Step 3: Implementar schema y service**

En `facturas.schemas.ts`, dentro de `actualizarFacturaSchema` agregar el campo y sumarlo al refine:

```typescript
export const actualizarFacturaSchema = z.object({
  notas:              z.string().optional(),
  fechaVencimiento:   z.string().datetime().optional(),
  // Solo editable en QUEDAN sin entregar — el service valida el contexto.
  plazoCredito:       z.number().int().min(1).max(365).optional(),
  // null limpia el periodo; string ISO lo setea.
  periodoRentaInicio: z.string().datetime().nullable().optional(),
  periodoRentaFin:    z.string().datetime().nullable().optional(),
}).refine(
  (d) => d.notas !== undefined || d.fechaVencimiento !== undefined || d.plazoCredito !== undefined || d.periodoRentaInicio !== undefined || d.periodoRentaFin !== undefined,
  { message: 'Debe proporcionar al menos un campo para actualizar' },
)
```

En `facturas.service.ts`, reemplazar `actualizarFactura` por:

```typescript
export async function actualizarFactura(id: string, data: ActualizarFacturaInput) {
  const factura = await prisma.factura.findUnique({
    where: { id },
    select: { id: true, estado: true, condicionPago: true, esQuedan: true, fechaEntregaReal: true },
  })
  if (!factura) throw new AppError(404, 'NOT_FOUND', 'Factura no encontrada')
  if (factura.estado === 'ANULADA') throw new AppError(422, 'ESTADO_INVALIDO', 'No se puede editar una factura anulada')

  if (data.fechaVencimiento !== undefined) {
    // Contado vence solo (+24h); en QUEDAN sin entregar el vencimiento aún no
    // existe — se materializa al registrar la entrega física.
    if (factura.condicionPago === 'CONTADO') {
      throw new AppError(422, 'ESTADO_INVALIDO', 'El vencimiento de una factura de contado no es editable')
    }
    if (factura.esQuedan && !factura.fechaEntregaReal) {
      throw new AppError(422, 'ESTADO_INVALIDO', 'El vencimiento QUEDAN se calcula al registrar la entrega física')
    }
  }

  if (data.plazoCredito !== undefined) {
    if (!factura.esQuedan) {
      throw new AppError(422, 'ESTADO_INVALIDO', 'El plazo de crédito solo aplica a facturas QUEDAN')
    }
    if (factura.fechaEntregaReal) {
      throw new AppError(422, 'ESTADO_INVALIDO', 'La factura ya fue entregada; el plazo ya no es editable')
    }
  }

  return prisma.factura.update({
    where: { id },
    data: {
      ...(data.notas !== undefined            && { notas: data.notas }),
      ...(data.fechaVencimiento !== undefined && { fechaVencimiento: new Date(data.fechaVencimiento) }),
      ...(data.plazoCredito !== undefined     && { plazoCredito: data.plazoCredito }),
      ...(data.periodoRentaInicio !== undefined && { periodoRentaInicio: data.periodoRentaInicio ? new Date(data.periodoRentaInicio) : null }),
      ...(data.periodoRentaFin    !== undefined && { periodoRentaFin:    data.periodoRentaFin    ? new Date(data.periodoRentaFin)    : null }),
    },
  })
}
```

Nota: los tests preexistentes de `actualizarFactura` mockean `findUnique` con `{ id, estado }` — siguen pasando porque `condicionPago`/`esQuedan` undefined no disparan las nuevas reglas.

- [ ] **Step 4: Correr tests y typecheck**

```bash
pnpm test tests/modules/facturas/ && npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/facturas/ tests/modules/facturas/
git commit -m "feat(facturas): reglas de edición — vencimiento solo crédito, plazo solo QUEDAN sin entregar

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: DTE paymentType desde la factura + PDF branded

**Files:**
- Modify: `src/modules/facturallama/facturallama.service.ts:275,339,407,525`
- Modify: `src/modules/pdf/pdf.service.ts:405-420`
- Modify: `src/modules/pdf/templates/factura.hbs:420`
- Test: `tests/modules/facturallama/facturallama.service.test.ts`, `tests/modules/pdf/pdf.service.test.ts`

**Interfaces:**
- Consumes: `Factura.condicionPago`, `plazoCredito`, `fechaVencimiento` nullable (Task 1).
- Produces: payloads DTE con `paymentType = factura.condicionPago ?? cotizacion.condicionesPago`; contexto PDF con `factura.vencimientoAlEntregar: string | null`.

- [ ] **Step 1: Escribir el test que falla (facturallama)**

En `tests/modules/facturallama/facturallama.service.test.ts`, el fixture de factura (objeto que resuelve `prisma.factura.findUnique`, cerca de la línea 37) tiene `cotizacion` con `condicionesPago: 'CONTADO'`. Agregar al objeto factura del fixture la propiedad `condicionPago: null,` (nivel factura, no cotización). Luego agregar un test nuevo en el describe de `emitirFC`:

```typescript
  it('paymentType prioriza factura.condicionPago sobre la cotización', async () => {
    // fixture: cotizacion.condicionesPago = 'CONTADO'; la factura dice CREDITO
    mockFactura({ condicionPago: 'CREDITO' })
    mockRespuestaOk()

    await emitirFC(FACTURA_ID)

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.paymentType).toBe('CREDITO')
  })
```

Adaptar `mockFactura`/`mockRespuestaOk`/`fetchMock` a los helpers reales del archivo (leerlo antes de editar: si el fixture se construye inline, clonar el patrón del test de emisión exitosa existente sobreescribiendo `condicionPago`).

- [ ] **Step 2: Correr y verificar FAIL**

```bash
pnpm test tests/modules/facturallama/
```
Expected: el test nuevo FAIL (paymentType sale 'CONTADO' de la cotización).

- [ ] **Step 3: Implementar los 4 payloads**

En `facturallama.service.ts`, en `emitirFC` (línea ~273), `emitirCCF` (~337) y `emitirSujetoExcluido` (~405), reemplazar:

```typescript
    ...(factura.cotizacion.condicionesPago ? { paymentType: factura.cotizacion.condicionesPago } : {}),
```

por (declarar la const justo antes del objeto payload):

```typescript
    // La condición de pago vive en la factura desde jul-2026; el fallback
    // cubre facturas históricas anteriores al backfill.
    ...(() => {
      const paymentType = factura.condicionPago ?? factura.cotizacion.condicionesPago
      return paymentType ? { paymentType } : {}
    })(),
```

En `emitirNC` (línea ~525), lo mismo con `nc.factura.condicionPago ?? nc.factura.cotizacion.condicionesPago`.

- [ ] **Step 4: Implementar el PDF**

En `pdf.service.ts` (contexto de `generarFacturaPDF`, líneas 405-420), reemplazar las líneas de `fechaVencimiento` (ya con guard de Task 1) y `condicionPago` por:

```typescript
      fechaVencimiento:    factura.fechaVencimiento ? formatFechaCorta(factura.fechaVencimiento) : null,
      // QUEDAN sin entregar: el vencimiento aún no existe — se comunica el plazo.
      vencimientoAlEntregar: !factura.fechaVencimiento && factura.esQuedan
        ? `Al entregar (${factura.plazoCredito ?? '—'} días de plazo)`
        : null,
      condicionPago: (() => {
        const cp = factura.condicionPago ?? factura.cotizacion.condicionesPago
        return cp ? (CONDICION_PAGO_LABEL[cp] ?? cp) : '—'
      })(),
```

(`CONDICION_PAGO_LABEL` ya existe en el módulo — se usa en el PDF de cotización, pdf.service.ts:317.)

En `templates/factura.hbs:420`, reemplazar:

```hbs
          <span class="date-val">{{factura.fechaVencimiento}}</span>
```

por:

```hbs
          <span class="date-val">{{#if factura.fechaVencimiento}}{{factura.fechaVencimiento}}{{else}}{{factura.vencimientoAlEntregar}}{{/if}}</span>
```

- [ ] **Step 5: Correr suites afectadas y typecheck**

```bash
pnpm test tests/modules/facturallama/ tests/modules/pdf/ && npx tsc --noEmit
```
Expected: PASS. Si los fixtures de `pdf.service.test.ts` fallan por campos faltantes, agregar `condicionPago: null, plazoCredito: null,` al objeto factura del fixture.

- [ ] **Step 6: Commit**

```bash
git add src/modules/facturallama/ src/modules/pdf/ tests/modules/facturallama/ tests/modules/pdf/
git commit -m "feat(dte): paymentType desde la factura; PDF muestra 'Al entregar (N días)' en QUEDAN

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Clientes — diasRecepcionQuedan

**Files:**
- Modify: `src/modules/clientes/clientes.schemas.ts:32-50` (camposCompartidos)
- Modify: `src/modules/clientes/clientes.service.ts:6-29` (SELECT), `:95-117` (crear), `:119-149` (actualizar)
- Test: `tests/modules/clientes/clientes.service.test.ts`

**Interfaces:**
- Produces: `POST/PUT /clientes` aceptan `diasRecepcionQuedan?: ('LUNES'|…|'DOMINGO')[]`; el service lo vacía si `manejaQuedan = false`. `GET /clientes/:id` y el cliente embebido en `GET /cotizaciones/:id` (usa `cliente: true`) devuelven el array. Task 9/11 (frontend) lo consumen.

- [ ] **Step 1: Escribir los tests que fallan**

En `tests/modules/clientes/clientes.service.test.ts` (seguir el patrón de mocks del archivo — mockea `prisma.cliente` y `$transaction` igual que facturas):

```typescript
// ── diasRecepcionQuedan ───────────────────────────────────────────────────────

describe('crearCliente — diasRecepcionQuedan', () => {
  it('persiste los días cuando manejaQuedan es true', async () => {
    prismaMock.cliente.findFirst.mockResolvedValue(null)
    prismaMock.cliente.create.mockResolvedValue({ id: CLIENTE_ID } as any)

    await crearCliente({
      tipo: 'EMPRESA', razonSocial: 'ACME', departamento: '06', municipio: '23',
      manejaQuedan: true, diasRecepcionQuedan: ['MARTES', 'JUEVES'],
    } as any, USUARIO_ID)

    expect(prismaMock.cliente.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ diasRecepcionQuedan: ['MARTES', 'JUEVES'] }),
      }),
    )
  })

  it('vacía los días cuando manejaQuedan es false', async () => {
    prismaMock.cliente.findFirst.mockResolvedValue(null)
    prismaMock.cliente.create.mockResolvedValue({ id: CLIENTE_ID } as any)

    await crearCliente({
      tipo: 'EMPRESA', razonSocial: 'ACME', departamento: '06', municipio: '23',
      manejaQuedan: false, diasRecepcionQuedan: ['MARTES'],
    } as any, USUARIO_ID)

    expect(prismaMock.cliente.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ diasRecepcionQuedan: [] }),
      }),
    )
  })
})
```

(Reusar las constantes `CLIENTE_ID`/`USUARIO_ID` del archivo o declararlas como cuids de 25 chars al estilo de facturas. Para `actualizarCliente` agregar un test análogo al segundo, mockeando `findUnique` con `{ id: CLIENTE_ID, tipo: 'EMPRESA' }`.)

También validar el schema (mismo archivo o `clientes.routes.test.ts`, donde viven los tests de schemas de clientes):

```typescript
describe('crearClienteSchema — diasRecepcionQuedan', () => {
  const base = { tipo: 'EMPRESA', razonSocial: 'ACME', departamento: '06', municipio: '23' }

  it('acepta días válidos y aplica default []', () => {
    const r = crearClienteSchema.safeParse({ ...base, manejaQuedan: true, diasRecepcionQuedan: ['LUNES', 'VIERNES'] })
    expect(r.success).toBe(true)

    const sinCampo = crearClienteSchema.safeParse(base)
    expect(sinCampo.success).toBe(true)
    if (sinCampo.success) expect(sinCampo.data.diasRecepcionQuedan).toEqual([])
  })

  it('rechaza días inválidos y duplicados', () => {
    expect(crearClienteSchema.safeParse({ ...base, diasRecepcionQuedan: ['FERIADO'] }).success).toBe(false)
    expect(crearClienteSchema.safeParse({ ...base, diasRecepcionQuedan: ['LUNES', 'LUNES'] }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Correr y verificar FAIL**

```bash
pnpm test tests/modules/clientes/
```

- [ ] **Step 3: Implementar schema**

En `clientes.schemas.ts`, antes de `camposCompartidos`:

```typescript
export const DIAS_SEMANA = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'] as const
```

Dentro de `camposCompartidos`, después de `manejaQuedan`:

```typescript
  // Días en que el cliente recibe facturas físicas (QUEDAN). El service los
  // vacía cuando manejaQuedan = false — así el dato nunca queda huérfano.
  diasRecepcionQuedan: z.array(z.enum(DIAS_SEMANA)).max(7)
    .refine((arr) => new Set(arr).size === arr.length, 'Días duplicados')
    .optional()
    .default([]),
```

- [ ] **Step 4: Implementar service**

En `clientes.service.ts`:

1. Agregar `diasRecepcionQuedan: true,` a `SELECT_CLIENTE_LISTA` (después de `manejaQuedan: true,`).
2. En `crearCliente`, reemplazar la línea `data: dto as Prisma.ClienteCreateInput,` por:

```typescript
      // Coherencia: sin manejaQuedan los días de recepción no tienen sentido.
      data: { ...dto, diasRecepcionQuedan: dto.manejaQuedan ? dto.diasRecepcionQuedan : [] } as Prisma.ClienteCreateInput,
```

3. En `actualizarCliente`, reemplazar `const { tipo, ...updateData } = dto` por:

```typescript
  const { tipo, ...updateData } = {
    ...dto,
    diasRecepcionQuedan: dto.manejaQuedan ? dto.diasRecepcionQuedan : [],
  }
```

- [ ] **Step 5: Correr tests y typecheck**

```bash
pnpm test tests/modules/clientes/ && npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/clientes/ tests/modules/clientes/
git commit -m "feat(clientes): días de recepción de facturas QUEDAN por cliente

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Cotizaciones — deprecar condicionesPago en creación/edición

**Files:**
- Modify: `src/modules/cotizaciones/cotizaciones.schemas.ts:23`
- Modify: `src/modules/cotizaciones/cotizaciones.service.ts:138,170,205,238`
- Test: `tests/modules/cotizaciones/cotizaciones.routes.test.ts:225-245`

**Interfaces:**
- Produces: `POST/PATCH /cotizaciones` ignoran `condicionesPago` (Zod lo descarta como clave desconocida). La columna y el valor histórico siguen saliendo en `GET /cotizaciones/:id` (para el fallback DTE de Task 5).

- [ ] **Step 1: Actualizar los tests (rojo primero)**

En `tests/modules/cotizaciones/cotizaciones.routes.test.ts`, reemplazar el `describe('crearCotizacionSchema — condicionesPago', …)` (línea ~225) por:

```typescript
describe('crearCotizacionSchema — condicionesPago (deprecado)', () => {
  it('descarta condicionesPago si viene en el payload — ahora vive en la factura', () => {
    const r = crearCotizacionSchema.safeParse({
      clienteId: 'clh1234567890abcdefghijk7',
      condicionesPago: 'CONTADO',
    })
    expect(r.success).toBe(true)
    if (r.success) expect('condicionesPago' in r.data).toBe(false)
  })
})
```

```bash
pnpm test tests/modules/cotizaciones/cotizaciones.routes.test.ts
```
Expected: FAIL — el schema actual conserva la clave.

- [ ] **Step 2: Implementar**

1. En `cotizaciones.schemas.ts:23`, eliminar la línea `condicionesPago: z.enum(['CONTADO', 'CREDITO', 'OTRO']).optional(),`.
2. En `cotizaciones.service.ts`: eliminar `condicionesPago?: 'CONTADO' | 'CREDITO' | 'OTRO'` de los dos tipos inline (líneas ~138 y ~205) y eliminar las dos líneas `condicionesPago: data.condicionesPago,` (líneas ~170 y ~238).

- [ ] **Step 3: Correr la suite completa del server**

```bash
pnpm test && npx tsc --noEmit
```
Expected: PASS total. Si algún otro test de cotizaciones enviaba `condicionesPago` en payloads, quitarle el campo (ya no afecta el resultado).

- [ ] **Step 4: Commit**

```bash
git add src/modules/cotizaciones/ tests/modules/cotizaciones/
git commit -m "refactor(cotizaciones): deprecar condicionesPago — la condición de pago vive en la factura

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## PARTE 2 — FRONTEND (`/Users/joaquinmorales13a06/Desktop/Reinar/frontend`, rama ya creada)

### Task 8: Tipos, catálogo de días y hooks

**Files:**
- Create: `lib/dias-semana.ts`
- Modify: `types/api.ts:62-92` (Cliente), `:819-832` (Cotizacion.cliente), `:842-857` (CrearCotizacionDto), `:1021-1046` (FacturaListItem), `:1068-1111` (Factura), `:1126-1131` (ActualizarFacturaDto)
- Modify: `hooks/use-facturas.ts:176-236` (GenerarFacturaInput, useMarcarFacturaEntregada)

**Interfaces:**
- Produces: `DiaSemana`, `DIAS_SEMANA`, `LABEL_DIA`, `LABEL_DIA_CORTO`, `DIAS_UTC` (lib/dias-semana.ts); `Factura.condicionPago/plazoCredito/fechaVencimiento` actualizados; `GenerarFacturaInput` con `condicionPago`. Tasks 9-12 consumen todo esto.

- [ ] **Step 1: Crear `lib/dias-semana.ts`**

```typescript
// Catálogo de días de la semana para diasRecepcionQuedan (espeja el enum
// implícito del backend en clientes.schemas.ts).
export const DIAS_SEMANA = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'] as const;
export type DiaSemana = (typeof DIAS_SEMANA)[number];

export const LABEL_DIA: Record<DiaSemana, string> = {
  LUNES: 'lunes', MARTES: 'martes', MIERCOLES: 'miércoles', JUEVES: 'jueves',
  VIERNES: 'viernes', SABADO: 'sábado', DOMINGO: 'domingo',
};

export const LABEL_DIA_CORTO: Record<DiaSemana, string> = {
  LUNES: 'Lun', MARTES: 'Mar', MIERCOLES: 'Mié', JUEVES: 'Jue',
  VIERNES: 'Vie', SABADO: 'Sáb', DOMINGO: 'Dom',
};

// Índice = getUTCDay() (0 = domingo). Las fechas 'YYYY-MM-DD' se parsean como
// 00:00Z — mapear en UTC evita el corrimiento de día en TZ negativas (SV = UTC-6).
export const DIAS_UTC: DiaSemana[] = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
```

- [ ] **Step 2: Actualizar `types/api.ts`**

1. Al inicio de la sección de clientes, importar el tipo:

```typescript
import type { DiaSemana } from '@/lib/dias-semana';
```

2. En `Cliente` (línea ~91), después de `manejaQuedan: boolean;`:

```typescript
  // Días en que recibe facturas físicas (QUEDAN). Vacío si manejaQuedan = false.
  diasRecepcionQuedan: DiaSemana[];
```

3. En `Cotizacion.cliente` (línea ~831), después de `manejaQuedan: boolean;`:

```typescript
    diasRecepcionQuedan: DiaSemana[];
```

4. En `CrearCotizacionDto` (línea ~846): eliminar la línea `condicionesPago?: CondicionesPago;` (el tipo `CondicionesPago` y `Cotizacion.condicionesPago` se conservan — el backend sigue devolviendo el valor histórico).

5. Nuevo tipo junto a `CondicionesPago` (línea ~744):

```typescript
// Condición de pago de FACTURA — facturas nuevas solo aceptan estos dos;
// OTRO puede aparecer en históricas backfilleadas desde la cotización.
export type CondicionPagoFactura = 'CONTADO' | 'CREDITO' | 'OTRO';
```

6. En `FacturaListItem` (línea ~1031): `fechaVencimiento: string | null;`

7. En `Factura` (líneas ~1076): `fechaVencimiento: string | null;` y después de `estado: EstadoFactura;` agregar:

```typescript
  condicionPago: CondicionPagoFactura | null;
  // Días de plazo QUEDAN; el vencimiento corre desde la entrega física.
  plazoCredito: number | null;
```

8. En `ActualizarFacturaDto` (línea ~1126), agregar `plazoCredito?: number;`

- [ ] **Step 3: Actualizar `hooks/use-facturas.ts`**

1. Reemplazar el tipo `GenerarFacturaInput` (líneas 176-183) por:

```typescript
// El tipoDTE para cotizacion->factura excluye NC (las notas de credito se
// crean contra una factura existente, no contra una cotizacion).
export type GenerarFacturaInput = {
  tipoDTE: 'FC' | 'CCF' | 'SUJETO_EXCLUIDO';
  contactoFacturacionId?: string;
  condicionPago: 'CONTADO' | 'CREDITO';
  // Requerida solo para CREDITO sin QUEDAN; CONTADO vence solo (+24h) y en
  // QUEDAN el vencimiento se calcula al entregar. El backend valida.
  fechaVencimiento?: string;
  esQuedan: boolean;
  fechaEntregaFactura?: string;
  plazoCredito?: number;
};
```

2. En `useMarcarFacturaEntregada`, importar `formatDate` desde `@/lib/utils` y reemplazar el `toast.success('Factura marcada como entregada.');` por:

```typescript
      // En QUEDAN el backend acaba de materializar el vencimiento — lo confirmamos.
      toast.success(
        factura.fechaVencimiento
          ? `Factura entregada. Vence el ${formatDate(factura.fechaVencimiento)}.`
          : 'Factura marcada como entregada.',
      );
```

- [ ] **Step 4: Typecheck (se esperan errores en consumidores)**

```bash
pnpm tsc --noEmit
```
Expected: errores SOLO en `GenerarFacturaModal.tsx` (llamada a `generar.mutate` sin `condicionPago`) y posiblemente en componentes que asumen `fechaVencimiento: string`. Se corrigen en Tasks 9-10. Anotar la lista exacta para verificar que Tasks 9-12 la agoten.

- [ ] **Step 5: Commit**

```bash
git add lib/dias-semana.ts types/api.ts hooks/use-facturas.ts
git commit -m "feat(types): condición de pago de factura, plazo QUEDAN y días de recepción

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: GenerarFacturaModal — rediseño en torno a la condición de pago

**Files:**
- Modify: `components/cotizaciones/GenerarFacturaModal.tsx` (reescritura del form)
- Modify: `components/cotizaciones/detalle/AccionesEstado.tsx` (prop cliente — verificar Pick)

**Interfaces:**
- Consumes: `GenerarFacturaInput` (Task 8), `cliente.diasRecepcionQuedan` (llega en `GET /cotizaciones/:id` porque el backend usa `cliente: true`).
- Produces: el modal envía `{ condicionPago, esQuedan, fechaVencimiento?, plazoCredito?, fechaEntregaFactura? }` según las reglas del spec.

- [ ] **Step 1: Reescribir el modal**

Reemplazar el contenido de `components/cotizaciones/GenerarFacturaModal.tsx` por:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGenerarFactura } from '@/hooks/use-facturas';
import { ContactoSolicitanteSelect } from '@/components/cotizaciones/ContactoSolicitanteSelect';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { DIAS_UTC, LABEL_DIA } from '@/lib/dias-semana';
import type { Cliente } from '@/types/api';

interface Props {
  cotizacionId: string;
  cliente: Pick<Cliente, 'id' | 'tipo' | 'manejaQuedan' | 'diasRecepcionQuedan'>;
  // Informativo: si las actas relacionadas a la cotizacion ya devolvieron todo
  // el inventario, no mostramos el banner recomendando esperar.
  actasTodasDevueltas: boolean;
  onClose: () => void;
}

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors border-bd';

export function GenerarFacturaModal({
  cotizacionId,
  cliente,
  actasTodasDevueltas,
  onClose,
}: Props) {
  const router = useRouter();
  const generar = useGenerarFactura(cotizacionId);

  // Pre-seleccion: las EMPRESAS suelen requerir CCF (credito fiscal) para
  // reclamar IVA; PARTICULAR cobra como consumidor final (FC). El operador
  // puede cambiarlo si el caso lo amerita.
  const [tipoDTE, setTipoDTE] =
    useState<'FC' | 'CCF' | 'SUJETO_EXCLUIDO'>(
      cliente.tipo === 'EMPRESA' ? 'CCF' : 'FC',
    );
  const [contactoFacturacionId, setContactoFacturacionId] = useState<
    string | null
  >(null);
  // Sin default: la condición de pago es una decisión consciente del operador.
  const [condicionPago, setCondicionPago] = useState<'CONTADO' | 'CREDITO' | null>(null);
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [esQuedan, setEsQuedan] = useState(cliente.manejaQuedan);
  const [plazoCredito, setPlazoCredito] = useState('');
  const [fechaEntregaFactura, setFechaEntregaFactura] = useState('');

  // Cerrar con Escape para consistencia con otros modales del modulo.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const esContado = condicionPago === 'CONTADO';
  const esCredito = condicionPago === 'CREDITO';
  // QUEDAN solo aplica con crédito: el plazo corre desde la entrega física.
  const quedanActivo = esCredito && esQuedan;

  const plazoValido = Number(plazoCredito) >= 1 && Number(plazoCredito) <= 365;
  const puedeSubmit =
    !!condicionPago &&
    (esContado ||
      (quedanActivo
        ? plazoValido && !!fechaEntregaFactura
        : !!fechaVencimiento));

  const diasCliente = cliente.diasRecepcionQuedan ?? [];
  // Advertencia local (el backend repite la validación en su warning): la
  // entrega programada cae en un día en que el cliente no recibe facturas.
  let advertenciaDia: string | null = null;
  if (quedanActivo && fechaEntregaFactura && diasCliente.length > 0) {
    const dia = DIAS_UTC[new Date(fechaEntregaFactura).getUTCDay()];
    if (!diasCliente.includes(dia)) {
      advertenciaDia = `Este cliente recibe facturas los ${diasCliente
        .map((d) => LABEL_DIA[d])
        .join(', ')}; la fecha elegida cae ${LABEL_DIA[dia]}.`;
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!puedeSubmit || !condicionPago) return;
    generar.mutate(
      {
        tipoDTE,
        contactoFacturacionId: contactoFacturacionId ?? undefined,
        condicionPago,
        esQuedan: quedanActivo,
        ...(esCredito && !quedanActivo ? { fechaVencimiento } : {}),
        ...(quedanActivo
          ? { plazoCredito: Number(plazoCredito), fechaEntregaFactura }
          : {}),
      },
      {
        onSuccess: ({ factura }) => {
          router.push(`/facturas/${factura.id}`);
        },
      },
    );
  }

  const isPending = generar.isPending;
  const mostrarBannerActas = quedanActivo && !actasTodasDevueltas;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-lg border border-bd bg-surface shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
          <div>
            <h3 className="text-sm font-semibold text-tx">Generar factura</h3>
            <p className="text-xs text-tx-3 mt-0.5">
              La factura se creará en estado BORRADOR. Podrás emitir el DTE
              después desde su detalle.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-tx-3 hover:text-tx hover:bg-bg-sunken transition-colors"
            aria-label="Cerrar"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="px-4 py-4 space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-tx-2">
              Tipo de documento fiscal <span className="text-danger">*</span>
            </label>
            <select
              value={tipoDTE}
              onChange={(e) =>
                setTipoDTE(
                  e.target.value as 'FC' | 'CCF' | 'SUJETO_EXCLUIDO',
                )
              }
              className={inputBase}
            >
              <option value="FC">FC — Factura de Consumidor Final</option>
              <option value="CCF">CCF — Crédito Fiscal</option>
              <option value="SUJETO_EXCLUIDO">FSE — Sujeto Excluido</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-tx-2">
              Facturar a <span className="text-tx-3 text-2xs">(opcional)</span>
            </label>
            <ContactoSolicitanteSelect
              clienteId={cliente.id}
              value={contactoFacturacionId}
              onChange={setContactoFacturacionId}
              defaultTipo="FACTURACION"
            />
            <p className="text-xs text-tx-3 mt-0.5">
              Contacto de facturación del cliente.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-tx-2">
              Condición de pago <span className="text-danger">*</span>
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: 'CONTADO', label: 'Contado', hint: 'Vence 24 h después de la emisión' },
                  { value: 'CREDITO', label: 'Crédito', hint: 'Con fecha de vencimiento o plazo QUEDAN' },
                ] as const
              ).map((op) => (
                <label
                  key={op.value}
                  className={
                    condicionPago === op.value
                      ? 'flex items-start gap-2 p-3 rounded-md border border-accent bg-bg-sunken cursor-pointer'
                      : 'flex items-start gap-2 p-3 rounded-md border border-bd cursor-pointer hover:bg-bg-sunken transition-colors'
                  }
                >
                  <input
                    type="radio"
                    name="condicionPago"
                    checked={condicionPago === op.value}
                    onChange={() => setCondicionPago(op.value)}
                    className="mt-0.5 accent-accent"
                  />
                  <span>
                    <span className="block text-sm font-medium text-tx">{op.label}</span>
                    <span className="block text-xs text-tx-3 mt-0.5">{op.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {esCredito && (
            <div className="flex items-start gap-3 p-3 rounded-md border border-bd bg-bg-sunken">
              <input
                id="esQuedan"
                type="checkbox"
                checked={esQuedan}
                onChange={(e) => setEsQuedan(e.target.checked)}
                className="mt-0.5 accent-[var(--yellow)]"
              />
              <div className="flex-1">
                <label
                  htmlFor="esQuedan"
                  className="text-sm font-medium text-tx cursor-pointer"
                >
                  Es factura QUEDAN
                </label>
                <p className="text-xs text-tx-3 mt-0.5">
                  La factura se entrega físicamente al cliente en una fecha
                  posterior; el plazo de crédito empieza a contar desde ese día.
                </p>
              </div>
            </div>
          )}

          {esCredito && !quedanActivo && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-tx-2">
                Fecha de vencimiento <span className="text-danger">*</span>
              </label>
              <input
                type="date"
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                className={inputBase}
              />
            </div>
          )}

          {quedanActivo && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-tx-2">
                  Plazo de crédito (días) <span className="text-danger">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={plazoCredito}
                  onChange={(e) => setPlazoCredito(e.target.value)}
                  className={inputBase}
                  placeholder="30"
                />
                <p className="text-xs text-tx-3 mt-0.5">
                  El vencimiento se calcula al registrar la entrega física.
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-tx-2">
                  Fecha de entrega de la factura{' '}
                  <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  value={fechaEntregaFactura}
                  onChange={(e) => setFechaEntregaFactura(e.target.value)}
                  className={inputBase}
                />
                {diasCliente.length > 0 && (
                  <p className="text-xs text-tx-3 mt-0.5">
                    Este cliente recibe facturas:{' '}
                    {diasCliente.map((d) => LABEL_DIA[d]).join(', ')}.
                  </p>
                )}
              </div>
            </div>
          )}

          {esContado && (
            <p className="flex items-center gap-1.5 text-xs text-tx-2">
              <Icon name="check" size={12} className="text-accent" />
              Vence automáticamente 24 horas después de la emisión.
            </p>
          )}

          {advertenciaDia && (
            <div className="flex items-start gap-2 p-3 rounded-md border border-warn-soft bg-warn-soft text-warn text-xs">
              <Icon name="alertTriangle" size={14} />
              <span>{advertenciaDia}</span>
            </div>
          )}

          {mostrarBannerActas && (
            <div className="flex items-start gap-2 p-3 rounded-md border border-warn-soft bg-warn-soft text-warn text-xs">
              <Icon name="alertTriangle" size={14} />
              <span>
                Recomendado: emitir QUEDAN después de devolver el inventario.
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-bd">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm text-tx-2 border border-bd hover:bg-bg-sunken transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!puedeSubmit || isPending}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Spinner /> Generando…
                </>
              ) : (
                <>
                  <Icon name="receipt" size={14} /> Generar factura
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar el caller**

En `components/cotizaciones/detalle/AccionesEstado.tsx` (líneas 84-95) revisar qué se pasa como `cliente`. Si pasa `cotizacion.cliente` directo, compila sin cambios (el tipo de `Cotizacion.cliente` ya incluye `diasRecepcionQuedan` por Task 8). Si construye un objeto manual `{ id, tipo, manejaQuedan }`, agregar `diasRecepcionQuedan: cotizacion.cliente.diasRecepcionQuedan`.

- [ ] **Step 3: Typecheck**

```bash
pnpm tsc --noEmit
```
Expected: desaparecen los errores de `GenerarFacturaModal`; pueden quedar los de Task 10 (cards del detalle) si `fechaVencimiento` null aún no se maneja ahí.

- [ ] **Step 4: Commit**

```bash
git add components/cotizaciones/
git commit -m "feat(facturas): modal de generación con condición de pago y plazo QUEDAN

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Detalle de factura — condición de pago y 3 fechas QUEDAN

**Files:**
- Modify: `components/facturas/detalle/ClienteFechasCard.tsx`
- Modify: `components/facturas/detalle/EntregaQuedanCard.tsx`

**Interfaces:**
- Consumes: `Factura.condicionPago`, `plazoCredito`, `fechaVencimiento: string | null` (Task 8).

- [ ] **Step 1: ClienteFechasCard**

En `components/facturas/detalle/ClienteFechasCard.tsx`, agregar `import { Badge } from '@/components/ui/Badge';` y reemplazar el par Vencimiento (líneas 30-31) por:

```tsx
        <dt className="text-tx-3">Condición de pago</dt>
        <dd>
          {factura.condicionPago ? (
            <Badge
              status={factura.condicionPago === 'CONTADO' ? 'Contado' : factura.condicionPago === 'CREDITO' ? 'Crédito' : 'Otro'}
              kind={factura.condicionPago === 'CONTADO' ? 'info' : 'accent'}
            />
          ) : (
            '—'
          )}
        </dd>
        <dt className="text-tx-3">Vencimiento</dt>
        <dd className="font-mono text-xs">
          {factura.fechaVencimiento
            ? formatDate(factura.fechaVencimiento)
            : 'Se define al entregar'}
        </dd>
```

- [ ] **Step 2: EntregaQuedanCard**

En `components/facturas/detalle/EntregaQuedanCard.tsx`, dentro del `<dl>` (después del bloque `Programada` y antes del bloque `yaEntregada`), agregar:

```tsx
        {factura.plazoCredito != null && (
          <>
            <dt className="text-tx-3">Plazo de crédito</dt>
            <dd className="font-mono text-xs text-tx">{factura.plazoCredito} días</dd>
          </>
        )}
        <dt className="text-tx-3">Vencimiento</dt>
        <dd className="font-mono text-xs text-tx">
          {factura.fechaVencimiento
            ? formatDate(factura.fechaVencimiento)
            : 'Se define al entregar'}
        </dd>
```

- [ ] **Step 3: Typecheck completo del frontend**

```bash
pnpm tsc --noEmit
```
Expected: 0 errores. Si queda alguno por `fechaVencimiento` null en otro componente (buscar con `grep -rn "fechaVencimiento" components/ app/ | grep -i factura`), aplicar el mismo patrón `factura.fechaVencimiento ? formatDate(…) : 'Al entregar'`.

- [ ] **Step 4: Commit**

```bash
git add components/facturas/
git commit -m "feat(facturas): detalle muestra condición de pago, plazo y vencimiento QUEDAN

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: ClienteForm chips de días + ClienteDetalle

**Files:**
- Modify: `components/clientes/ClienteForm.tsx:31-92` (schema/DEFAULTS), `:419-434` (FormSection Facturación)
- Modify: `components/clientes/ClienteDetalle.tsx:102-140` (nueva Card)

**Interfaces:**
- Consumes: `DIAS_SEMANA`, `LABEL_DIA`, `LABEL_DIA_CORTO`, `DiaSemana` (Task 8); backend Task 6.

- [ ] **Step 1: Schema y defaults del form**

En `components/clientes/ClienteForm.tsx`:

1. Importar: `import { DIAS_SEMANA, LABEL_DIA_CORTO, type DiaSemana } from '@/lib/dias-semana';`
2. En el objeto `schema` de Zod, después de `manejaQuedan: z.boolean(),`:

```typescript
  diasRecepcionQuedan: z.array(z.enum(DIAS_SEMANA)),
```

3. En `DEFAULTS`, después de `manejaQuedan: false,`:

```typescript
  diasRecepcionQuedan: [],
```

4. El efecto de hidratación (línea ~153) mapea `null → ''` — el array llega como `[]` desde el backend (default Prisma), así que no lo rompe. No tocar.

- [ ] **Step 2: Chips en la sección Facturación**

Declarar dentro del componente (junto a los otros `watch`):

```typescript
  const manejaQuedan = watch('manejaQuedan');
  const diasSeleccionados = watch('diasRecepcionQuedan');

  function toggleDia(dia: DiaSemana) {
    const actual = diasSeleccionados ?? [];
    setValue(
      'diasRecepcionQuedan',
      actual.includes(dia) ? actual.filter((d) => d !== dia) : [...actual, dia],
      { shouldDirty: true },
    );
  }
```

Reemplazar la `<FormSection title="Facturación">` (líneas 419-434) por:

```tsx
        <FormSection title="Facturación">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              {...register('manejaQuedan')}
              className="h-4 w-4 rounded border-bd accent-accent cursor-pointer"
            />
            <span className="text-tx">Maneja factura QUEDAN</span>
            <span
              className="text-xs text-tx-3"
              title="Pre-marca el toggle QUEDAN al generar facturas para este cliente"
            >
              (?)
            </span>
          </label>

          {manejaQuedan && (
            <div className="mt-3">
              <span className="block text-xs font-medium text-tx-2 mb-1.5">
                Días en que recibe facturas
              </span>
              <div className="flex flex-wrap gap-1.5">
                {DIAS_SEMANA.map((dia) => {
                  const activo = (diasSeleccionados ?? []).includes(dia);
                  return (
                    <button
                      key={dia}
                      type="button"
                      onClick={() => toggleDia(dia)}
                      aria-pressed={activo}
                      className={
                        activo
                          ? 'px-3 py-1.5 rounded-full text-xs font-semibold bg-accent text-navy transition-colors'
                          : 'px-3 py-1.5 rounded-full text-xs font-medium border border-bd text-tx-2 hover:bg-bg-sunken transition-colors'
                      }
                    >
                      {LABEL_DIA_CORTO[dia]}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-tx-3 mt-1.5">
                Se usa para advertir al programar la entrega de facturas QUEDAN.
              </p>
            </div>
          )}
        </FormSection>
```

- [ ] **Step 3: Card en ClienteDetalle**

En `components/clientes/ClienteDetalle.tsx`, importar `import { LABEL_DIA } from '@/lib/dias-semana';` y agregar después de la `<Card title="Dirección">…</Card>` (dentro de la misma columna):

```tsx
          <Card title="Facturación">
            <dl className="m-0">
              <DetailRow label="Factura QUEDAN" value={cliente.manejaQuedan ? 'Sí' : 'No'} />
              {cliente.manejaQuedan && (
                <DetailRow
                  label="Días de recepción"
                  value={
                    (cliente.diasRecepcionQuedan ?? []).length > 0
                      ? cliente.diasRecepcionQuedan.map((d) => LABEL_DIA[d]).join(', ')
                      : <span className="text-tx-muted">—</span>
                  }
                />
              )}
            </dl>
          </Card>
```

- [ ] **Step 4: Typecheck**

```bash
pnpm tsc --noEmit
```
Expected: 0 errores.

- [ ] **Step 5: Commit**

```bash
git add components/clientes/
git commit -m "feat(clientes): selector de días de recepción de facturas QUEDAN

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: Quitar condiciones de pago del wizard de cotización

**Files:**
- Modify: `components/cotizaciones/wizard/Step3Terminos.tsx:12,20-24,38,76,90-102`
- Modify: `lib/schemas/cotizacion.ts:20`
- Modify: `app/(dashboard)/cotizaciones/[id]/page.tsx:75-78`
- Modify: `types/api.ts` (ya hecho en Task 8 — verificar)

**Interfaces:**
- Consumes: backend Task 7 (el campo ya se ignora en POST/PATCH).

- [ ] **Step 1: Step3Terminos**

En `components/cotizaciones/wizard/Step3Terminos.tsx`:
1. Import (línea 12): quitar `CondicionesPago` → `import type { Cotizacion } from '@/types/api';`
2. Eliminar la constante `CONDICIONES` (líneas 20-24).
3. En `defaultValues` (línea 38): eliminar `condicionesPago: cotizacion.condicionesPago ?? null,`.
4. En `onSubmit` (línea 76): eliminar `condicionesPago: values.condicionesPago || undefined,` y su comentario asociado (líneas 74-75).
5. Eliminar el `<div>` del select "Condiciones de pago" (líneas 91-102). El grid `md:grid-cols-2` queda con solo la celda de IVA — cambiar el contenedor a `grid grid-cols-1 gap-4 md:max-w-md` para que el bloque de IVA no quede estirado.

- [ ] **Step 2: step3Schema**

En `lib/schemas/cotizacion.ts:20`, eliminar la línea:

```typescript
    condicionesPago: z.enum(['CONTADO', 'CREDITO', 'OTRO']).optional().nullable(),
```

- [ ] **Step 3: Detalle de cotización**

En `app/(dashboard)/cotizaciones/[id]/page.tsx:75-78`, eliminar el bloque condicional `{cot.condicionesPago && ( … )}` completo (el `<div>` que muestra "Condiciones de pago" con `<p>{cot.condicionesPago}</p>`).

- [ ] **Step 4: Verificar residuos y typecheck**

```bash
grep -rn "condicionesPago" components/ app/ lib/ hooks/
pnpm tsc --noEmit && pnpm lint
```
Expected: las únicas apariciones restantes de `condicionesPago` están en `types/api.ts` (campo de lectura de `Cotizacion` + tipo `CondicionesPago`). 0 errores de TS y lint.

- [ ] **Step 5: Commit**

```bash
git add components/cotizaciones/ lib/schemas/ "app/(dashboard)/cotizaciones/"
git commit -m "refactor(cotizaciones): quitar condiciones de pago del wizard — se decide al facturar

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 13: Verificación end-to-end y cierre

**Files:** ninguno nuevo — verificación y push.

- [ ] **Step 1: Verificación estática final en ambos repos**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm test && npx tsc --noEmit
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit && pnpm lint
```
Expected: todo PASS / 0 errores.

- [ ] **Step 2: Prueba manual end-to-end (backend `pnpm dev` en :3000, frontend en :3001)**

Recorrer los 3 caminos del spec:

1. **Contado:** crear cotización → aprobar → generar factura CONTADO. Verificar: el modal no pide fecha; el detalle muestra Badge "Contado" y vencimiento ≈ mañana; el PDF branded muestra "Contado".
2. **Crédito:** generar factura CREDITO con fecha manual. Verificar detalle y PDF.
3. **Crédito + QUEDAN:** cliente con `manejaQuedan` y días (ej. martes/jueves) → generar factura QUEDAN con plazo 30 y entrega en miércoles → verificar advertencia de día (local y toast del backend) → detalle muestra "Se define al entregar" → marcar entregada → toast confirma vencimiento = entrega + 30 días; PDF antes de entregar muestra "Al entregar (30 días de plazo)".
4. **Edición:** en factura CONTADO intentar editar vencimiento (debe fallar 422 con mensaje claro); en QUEDAN sin entregar editar plazo (debe funcionar).
5. **Wizard cotización:** el Paso 3 ya no muestra condiciones de pago.
6. **Cliente:** chips de días solo visibles con "Maneja QUEDAN" activo; se guardan y se ven en el detalle.
7. **DTE (sandbox):** emitir un DTE de la factura de contado y verificar en la respuesta/JSON que `paymentType = CONTADO`.
8. **Cron:** verificar en BD que una QUEDAN sin entregar tiene `fechaVencimiento IS NULL` y que tras correr el job de vencidas sigue PENDIENTE.

- [ ] **Step 3: Push y PRs**

```bash
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server push -u origin feat/facturas-condicion-pago-quedan
git -C /Users/joaquinmorales13a06/Desktop/Reinar/frontend push -u origin feat/facturas-condicion-pago-quedan
```

Crear los PRs con `gh pr create` en cada repo (título: `feat(facturas): condición de pago en factura + QUEDAN con plazo desde entrega`), cuerpo con resumen del spec y checklist de verificación, terminando con:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

**Orden de merge:** primero el PR del server (la migración ya está aplicada en la BD remota desde Task 1), después el del frontend.
