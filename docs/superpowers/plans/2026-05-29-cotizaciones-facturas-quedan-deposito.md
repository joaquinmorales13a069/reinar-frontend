# Cotizaciones, facturación manual, QUEDAN y depósito — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar los 8 cambios del spec `2026-05-29-cotizaciones-facturas-quedan-deposito-design.md`: contacto solicitante inline, días por ítem, separar tipo doc fiscal del borrador, nuevo layout PDF, depósito como modelo independiente, facturación manual y soporte para facturas QUEDAN.

**Architecture:** Cambios atómicos por fase: (1) migración Prisma con backfill, (2) backend (depósitos, cotizaciones, facturas, cron QUEDAN), (3) PDF, (4) frontend. Cada fase produce código funcional verificable con `pnpm tsc --noEmit` y prueba manual en `pnpm dev`.

**Tech Stack:** Next.js 19 (App Router) + React Query + Zustand + Tailwind v4. Backend Express + Prisma 7 + Vitest. PostgreSQL. PDFs con Handlebars.

**Rutas absolutas:**
- Frontend: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/`
- Backend: `/Users/joaquinmorales13a06/Desktop/Reinar/server/`

**Verificación entre tareas:**
- Backend: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm tsc --noEmit`
- Frontend: `cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit`
- Tests backend (cuando aplique): `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm test`

**Convenciones del proyecto (de CLAUDE.md):**
- 100% español en UI, comentarios, mensajes.
- Sin valores arbitrarios Tailwind (`h-[20px]` ❌).
- Toasts con `sonner` en mutations (success + error).
- Decimal: usar `decimal.js`; nunca `parseFloat`.
- No frontend tests — verificación con `pnpm tsc --noEmit` + manual.

---

## Fase 1 — Schema y migración

### Task 1.1: Agregar campos al schema de Prisma

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/prisma/schema.prisma`

- [ ] **Step 1: Agregar enum `EstadoDeposito`**

Buscar la sección de enums (después de `EstadoActaItem`, alrededor de la línea 160 — antes de `enum TipoDTE`) e insertar:

```prisma
enum EstadoDeposito {
  PENDIENTE
  RECIBIDO
  DEVUELTO
  RETENIDO_PARCIAL
  RETENIDO_TOTAL
}
```

- [ ] **Step 2: Agregar `manejaQuedan` a `Cliente`**

En el modelo `Cliente` (buscar `model Cliente {`), agregar antes del cierre `}`:

```prisma
  // QUEDAN: clientes que pagan despues del servicio. Pre-selecciona el flag al generar factura.
  manejaQuedan Boolean @default(false)
```

- [ ] **Step 3: Modificar `CotizacionItem` — agregar nuevos campos**

En el modelo `CotizacionItem`, **agregar** (no remover `cantidad` todavía — la migración hace el backfill):

```prisma
  // Reemplazan el polivalente `cantidad`. subtotal = tarifaAplicada * cantidadUnidades * cantidadDias.
  cantidadUnidades Int @default(1)
  cantidadDias     Int @default(1)
```

- [ ] **Step 4: Agregar campos QUEDAN a `Factura`**

En el modelo `Factura`, después de `fechaVencimiento`, agregar:

```prisma
  // QUEDAN: el cliente paga despues del servicio. Vencimiento + entrega tienen fechas propias.
  esQuedan            Boolean   @default(false)
  fechaEntregaFactura DateTime?
  fechaEntregaReal    DateTime?
```

- [ ] **Step 5: Agregar relación `depositoGarantia` a `Cotizacion`**

En el modelo `Cotizacion`, junto a las otras relaciones (cerca del final del modelo, donde están `items`, `factura`, etc.):

```prisma
  depositoGarantia DepositoGarantia?
```

- [ ] **Step 6: Agregar modelo `DepositoGarantia`**

Al final del archivo (antes del último `}` global o después del último model), agregar:

```prisma
model DepositoGarantia {
  id           String     @id @default(cuid())
  cotizacionId String     @unique
  cotizacion   Cotizacion @relation(fields: [cotizacionId], references: [id])

  monto          Decimal        @db.Decimal(10, 2)
  estado         EstadoDeposito @default(PENDIENTE)
  fechaRecibido  DateTime?
  fechaDevuelto  DateTime?
  montoRetenido  Decimal?       @db.Decimal(10, 2)
  razonRetencion String?
  notas          String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 7: Generar la migración**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm db:migrate -- --name quedan_deposito_dias`
Expected: prisma crea `prisma/migrations/<timestamp>_quedan_deposito_dias/migration.sql`.

- [ ] **Step 8: Editar la migración para preservar datos**

Abrir el SQL generado en `prisma/migrations/<timestamp>_quedan_deposito_dias/migration.sql`. Es probable que Prisma intente eliminar columnas o tablas; verificar que **no** elimine `CotizacionItem.cantidad` ni la columna `depositoMonto` de `Cotizacion`.

Si la migración intenta eliminar `cantidad`, removerlo del SQL — `cantidad` se elimina en la Task 1.3 después del backfill.

- [ ] **Step 9: Verificar tipos**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm tsc --noEmit`
Expected: PASS (Prisma Client se regenera por postinstall; ahora hay errores donde `cantidad` no se usa — pero por ahora `cantidad` aún existe).

- [ ] **Step 10: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): nuevos campos para QUEDAN, depósito y días por item

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 1.2: Backfill de `cantidadUnidades` y `cantidadDias`

**Files:**
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/server/scripts/backfill-cantidad-unidades-dias.ts`

- [ ] **Step 1: Crear el script de backfill**

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Tipos con tarifa por periodo: `cantidad` historicamente representaba dias.
  const TIPOS_PERIODO = ['EQUIPO', 'HERRAMIENTA', 'PIEZA_ANDAMIO']
  // Tipos sin tarifa por periodo: `cantidad` representaba unidades.
  const TIPOS_UNIDAD = ['SERVICIO', 'CONSUMIBLE', 'CUSTOM']

  const items = await prisma.$queryRaw<Array<{ id: string; tipo: string; cantidad: number }>>`
    SELECT id, tipo, cantidad FROM "CotizacionItem"
  `

  console.log(`Backfilling ${items.length} items...`)

  for (const item of items) {
    let cantidadUnidades: number
    let cantidadDias: number

    if (TIPOS_PERIODO.includes(item.tipo)) {
      // EQUIPO siempre tiene cantidad=1 historica (regla del servicio).
      // HERRAMIENTA/PIEZA_ANDAMIO usaban cantidad como dias.
      if (item.tipo === 'EQUIPO') {
        cantidadUnidades = 1
        cantidadDias = item.cantidad
      } else {
        // Sin info para separar unidades de dias en el dato historico — asumimos
        // unidades=1, dias=cantidad. Coherente con el PDF actual "1 × 6 Dia".
        cantidadUnidades = 1
        cantidadDias = item.cantidad
      }
    } else if (TIPOS_UNIDAD.includes(item.tipo)) {
      cantidadUnidades = item.cantidad
      cantidadDias = 1
    } else {
      cantidadUnidades = item.cantidad
      cantidadDias = 1
    }

    await prisma.$executeRaw`
      UPDATE "CotizacionItem"
      SET "cantidadUnidades" = ${cantidadUnidades},
          "cantidadDias" = ${cantidadDias}
      WHERE id = ${item.id}
    `
  }

  console.log('Backfill completo.')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Ejecutar el script**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm tsx scripts/backfill-cantidad-unidades-dias.ts`
Expected: "Backfilling N items..." + "Backfill completo."

- [ ] **Step 3: Verificar con query**

Run en `pnpm db:studio` o con psql:
```sql
SELECT id, tipo, cantidad, "cantidadUnidades", "cantidadDias",
       "tarifaAplicada"::numeric * "cantidadUnidades" * "cantidadDias" AS subtotal_calculado,
       subtotal::numeric AS subtotal_almacenado
FROM "CotizacionItem"
LIMIT 20;
```
Expected: `subtotal_calculado = subtotal_almacenado` en todas las filas.

- [ ] **Step 4: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add scripts/backfill-cantidad-unidades-dias.ts
git commit -m "chore(db): script de backfill cantidadUnidades/cantidadDias

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 1.3: Eliminar columna `cantidad` de `CotizacionItem`

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/prisma/schema.prisma`

- [ ] **Step 1: Quitar campo `cantidad` del modelo**

En `CotizacionItem`, eliminar:
```prisma
  cantidad Int
```

- [ ] **Step 2: Generar migración**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm db:migrate -- --name drop_cantidad_cotizacion_item`
Expected: migración que solo dropea la columna.

- [ ] **Step 3: Verificar tipos del backend**

Run: `pnpm tsc --noEmit`
Expected: FAIL en muchos archivos (services, controllers) que referencian `cantidad`. Los iremos arreglando en las siguientes tareas. **No** commitear todavía si no compila.

- [ ] **Step 4: Commit del schema**

Ya que el tsc rompe, esto se commitea junto con los cambios del servicio en Task 2.x. Por ahora dejar la migración en working tree y avanzar.

### Task 1.4: Backfill DepositoGarantia y limpiar Pagos ANTICIPO históricos

**Files:**
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/server/scripts/backfill-depositos.ts`

- [ ] **Step 1: Crear script**

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Cotizaciones APROBADAS con deposito > 0 deben tener DepositoGarantia.
  // Asumimos historico cobrado (RECIBIDO) y fechaRecibido = fechaAprobacion.
  const cotizaciones = await prisma.cotizacion.findMany({
    where: {
      estado: 'APROBADA',
      depositoMonto: { gt: 0 },
      depositoGarantia: null,
    },
    select: { id: true, depositoMonto: true, fechaAprobacion: true, factura: { select: { id: true } } },
  })

  console.log(`Creando ${cotizaciones.length} DepositoGarantia...`)

  for (const c of cotizaciones) {
    await prisma.depositoGarantia.create({
      data: {
        cotizacionId: c.id,
        monto: c.depositoMonto!,
        estado: 'RECIBIDO',
        fechaRecibido: c.fechaAprobacion ?? new Date(),
      },
    })

    // Eliminar Pago tipo ANTICIPO autogenerado y recalcular saldoPendiente de la factura.
    if (c.factura) {
      const pagosAnticipo = await prisma.pago.findMany({
        where: { facturaId: c.factura.id, metodoPago: 'ANTICIPO' },
      })
      for (const p of pagosAnticipo) {
        await prisma.pago.delete({ where: { id: p.id } })
      }
      const factura = await prisma.factura.findUnique({ where: { id: c.factura.id } })
      if (factura) {
        const nuevoMontoPagado = (await prisma.pago.aggregate({
          where: { facturaId: c.factura.id },
          _sum: { monto: true },
        }))._sum.monto ?? 0
        const saldo = Number(factura.total) - Number(nuevoMontoPagado)
        await prisma.factura.update({
          where: { id: c.factura.id },
          data: { montoPagado: nuevoMontoPagado, saldoPendiente: saldo },
        })
      }
    }
  }

  console.log('Backfill depositos completo.')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Ejecutar**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm tsx scripts/backfill-depositos.ts`
Expected: "Creando N DepositoGarantia..." + "Backfill depositos completo."

- [ ] **Step 3: Verificar con query**

```sql
SELECT count(*) FROM "DepositoGarantia" WHERE estado = 'RECIBIDO';
SELECT count(*) FROM "Pago" WHERE "metodoPago" = 'ANTICIPO';  -- debe ser 0
```

- [ ] **Step 4: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add scripts/backfill-depositos.ts prisma/migrations/
git commit -m "chore(db): backfill DepositoGarantia y limpieza de Pagos ANTICIPO

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Fase 2 — Backend: Cotizaciones (ítems con días, aprobar sin factura)

### Task 2.1: Schemas Zod — cantidadUnidades / cantidadDias

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/cotizaciones/cotizaciones.schemas.ts`

- [ ] **Step 1: Buscar los schemas de items**

Abrir el archivo y buscar `crearItemSchema`, `actualizarItemSchema` y cualquier referencia a `cantidad`.

- [ ] **Step 2: Reemplazar `cantidad` por `cantidadUnidades` y `cantidadDias`**

En cada schema de item (crear y actualizar), reemplazar:
```ts
cantidad: z.number().int().min(1).optional(),
```
por:
```ts
cantidadUnidades: z.number().int().min(1).default(1),
cantidadDias:     z.number().int().min(1).default(1),
```

En `actualizar*` deben ser `.optional()` en lugar de `.default(1)`.

- [ ] **Step 3: Type-check**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm tsc --noEmit`
Expected: aún errores en el service (Task 2.2), pero los schemas compilan.

### Task 2.2: Service — cálculo de subtotal con días

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/cotizaciones/cotizaciones.service.ts`

- [ ] **Step 1: Cambiar firma de creación de item**

Buscar `agregarItem` (alrededor de la línea 309). Reemplazar:
```ts
const cantidad = data.cantidad ?? 1
```
por:
```ts
const cantidadUnidades = data.cantidadUnidades ?? 1
const cantidadDias     = data.cantidadDias ?? 1
```

- [ ] **Step 2: Validar regla por tipo**

Después de obtener `cantidadUnidades` y `cantidadDias`, agregar:
```ts
// EQUIPO siempre 1 unidad por linea (regla existente). SERVICIO/CONSUMIBLE no se rentan por dias.
if (data.tipo === 'EQUIPO' && cantidadUnidades !== 1) {
  throw new AppError(400, 'VALIDACION', 'EQUIPO siempre tiene cantidadUnidades=1')
}
if ((data.tipo === 'SERVICIO' || data.tipo === 'CONSUMIBLE') && cantidadDias !== 1) {
  throw new AppError(400, 'VALIDACION', `${data.tipo} no se renta por dias`)
}
```

- [ ] **Step 3: Calcular subtotal con la fórmula nueva**

Reemplazar:
```ts
const subtotal = tarifaAplicada.mul(cantidad).toDecimalPlaces(2)
```
por:
```ts
const subtotal = tarifaAplicada.mul(cantidadUnidades).mul(cantidadDias).toDecimalPlaces(2)
```

- [ ] **Step 4: Guardar los campos nuevos**

En el `prisma.cotizacionItem.create({ data: { ... }})`, reemplazar:
```ts
cantidad,
```
por:
```ts
cantidadUnidades,
cantidadDias,
```

- [ ] **Step 5: Ajustar la reserva de herramientas**

Buscar `crearReservaHerramienta(tipo.id, cantidad, ...)` y reemplazar `cantidad` por `cantidadUnidades` (las reservas son sobre unidades físicas, no días).

- [ ] **Step 6: Actualizar `actualizarItem`**

Buscar la función `actualizarItem` (~línea 440). Cambiar:
```ts
const cantidadCambia = data.cantidad !== undefined && data.cantidad !== item.cantidad
```
por dos verificaciones:
```ts
const unidadesCambia = data.cantidadUnidades !== undefined && data.cantidadUnidades !== item.cantidadUnidades
const diasCambia     = data.cantidadDias     !== undefined && data.cantidadDias     !== item.cantidadDias
```

- [ ] **Step 7: Validar regla EQUIPO en actualizar**

Reemplazar el bloque que verifica `data.cantidad !== 1` para EQUIPO con:
```ts
if (item.tipo === 'EQUIPO' && data.cantidadUnidades !== undefined && data.cantidadUnidades !== 1) {
  throw new AppError(400, 'VALIDACION_EQUIPO_CANTIDAD',
    'Los items de tipo EQUIPO siempre tienen cantidadUnidades 1.')
}
```

- [ ] **Step 8: Recalcular subtotal en actualizar**

Buscar el cálculo de `subtotal` en `actualizarItem` y reemplazar:
```ts
const subtotal = tarifaAplicada !== undefined || data.cantidad !== undefined
  ? (tarifaAplicada ?? item.tarifaCatalogo).mul(nuevaCantidad).toDecimalPlaces(2)
```
por:
```ts
const nuevasUnidades = data.cantidadUnidades ?? item.cantidadUnidades
const nuevosDias     = data.cantidadDias     ?? item.cantidadDias
const subtotal = tarifaAplicada !== undefined || unidadesCambia || diasCambia
  ? (tarifaAplicada ?? item.tarifaCatalogo).mul(nuevasUnidades).mul(nuevosDias).toDecimalPlaces(2)
```

Y ajustar `data.update` con `cantidadUnidades: nuevasUnidades` y `cantidadDias: nuevosDias`.

- [ ] **Step 9: Type-check**

Run: `pnpm tsc --noEmit`
Expected: errores restantes en `aprobar` (Task 2.3) y PDF (Task 7). Avanzar.

### Task 2.3: Service — aprobar sin generar factura y crear DepositoGarantia

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/cotizaciones/cotizaciones.service.ts`

- [ ] **Step 1: Localizar `aprobarCotizacion`**

Buscar la función exportada que aprueba (busca `APROBADA` cerca de la línea 750-870).

- [ ] **Step 2: Eliminar creación de Factura**

Eliminar el bloque `const factura = await tx.factura.create({...})` (alrededor de la línea 783).

- [ ] **Step 3: Eliminar creación de Pago tipo ANTICIPO**

Eliminar el bloque (línea ~804):
```ts
if (cotizacion.depositoMonto?.greaterThan(0)) {
  const deposito = cotizacion.depositoMonto
  const saldoPendiente = cotizacion.total.minus(deposito)
  await tx.pago.create({ data: { ... monto: deposito, metodoPago: 'ANTICIPO' } })
  await tx.factura.update({ where: { id: factura.id }, data: { montoPagado: deposito, saldoPendiente } })
}
```

- [ ] **Step 4: Crear DepositoGarantia en su lugar**

Después del bloque que confirma reservas y antes del update de estado, agregar:
```ts
// Cotizacion con deposito: crear DepositoGarantia en estado PENDIENTE.
// El cobro/devolucion se gestiona en panel aparte; ya no descuenta saldo de factura.
if (cotizacion.depositoMonto?.greaterThan(0)) {
  await tx.depositoGarantia.create({
    data: {
      cotizacionId: id,
      monto: cotizacion.depositoMonto,
      estado: 'PENDIENTE',
    },
  })
}
```

- [ ] **Step 5: Eliminar validación previa de tipoDocumentoFiscal**

Si en el código de aprobar hay un check tipo `if (!cotizacion.tipoDocumentoFiscal) throw ...`, eliminarlo. La factura ahora pide ese dato en su propio endpoint.

- [ ] **Step 6: Ajustar el mensaje de notificación**

Buscar `"La cotización ${cotizacion.numeroCotizacion} fue aprobada y se generó una factura."` y cambiar a:
```ts
`La cotización ${cotizacion.numeroCotizacion} fue aprobada.`
```

- [ ] **Step 7: Type-check**

Run: `pnpm tsc --noEmit`
Expected: queda solo errores de PDF (Task 7) y posibles llamadas externas a `cotizacion.factura` recién creada que ya no existe.

- [ ] **Step 8: Commit de Fase 2**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add prisma/ src/modules/cotizaciones/
git commit -m "feat(cotizaciones): días por ítem y aprobar sin generar factura

- Reemplaza cantidad por cantidadUnidades + cantidadDias en CotizacionItem.
- Aprobar ya no crea factura ni pago ANTICIPO; crea DepositoGarantia en PENDIENTE.
- Quita validación previa de tipoDocumentoFiscal en aprobar.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Fase 3 — Backend: Módulo depósitos

### Task 3.1: Service de depósitos

**Files:**
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/depositos/depositos.service.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
import { Decimal } from 'decimal.js'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../lib/errors'
import { registrarAuditoria } from '../auditlog/auditlog.service'

export async function obtenerDeposito(cotizacionId: string) {
  return prisma.depositoGarantia.findUnique({ where: { cotizacionId } })
}

export async function recibirDeposito(cotizacionId: string, usuarioId: string) {
  const deposito = await prisma.depositoGarantia.findUnique({ where: { cotizacionId } })
  if (!deposito) throw new AppError(404, 'NOT_FOUND', 'Depósito no encontrado')
  if (deposito.estado !== 'PENDIENTE') {
    throw new AppError(409, 'ESTADO_INVALIDO', `Depósito está en estado ${deposito.estado}, no PENDIENTE`)
  }

  const actualizado = await prisma.depositoGarantia.update({
    where: { id: deposito.id },
    data: { estado: 'RECIBIDO', fechaRecibido: new Date() },
  })

  await registrarAuditoria({
    usuarioId, entidad: 'DepositoGarantia', entidadId: deposito.id, accion: 'RECIBIR',
    camposDespues: { estado: 'RECIBIDO' } as Prisma.InputJsonValue,
  })

  return actualizado
}

type DevolverInput =
  | { tipo: 'TOTAL' }
  | { tipo: 'RETENER_TOTAL'; razonRetencion: string }
  | { tipo: 'PARCIAL'; montoRetenido: number; razonRetencion: string }

export async function devolverDeposito(cotizacionId: string, input: DevolverInput, usuarioId: string) {
  const deposito = await prisma.depositoGarantia.findUnique({ where: { cotizacionId } })
  if (!deposito) throw new AppError(404, 'NOT_FOUND', 'Depósito no encontrado')
  if (deposito.estado !== 'RECIBIDO') {
    throw new AppError(409, 'ESTADO_INVALIDO', `Solo se puede devolver desde RECIBIDO; estado actual: ${deposito.estado}`)
  }

  let data: Prisma.DepositoGarantiaUpdateInput = { fechaDevuelto: new Date() }

  if (input.tipo === 'TOTAL') {
    data.estado = 'DEVUELTO'
  } else if (input.tipo === 'RETENER_TOTAL') {
    data.estado = 'RETENIDO_TOTAL'
    data.montoRetenido = deposito.monto
    data.razonRetencion = input.razonRetencion
  } else {
    // PARCIAL
    const retenido = new Decimal(input.montoRetenido)
    if (retenido.lte(0) || retenido.gte(deposito.monto)) {
      throw new AppError(400, 'VALIDACION', 'montoRetenido debe ser > 0 y < monto del depósito')
    }
    data.estado = 'RETENIDO_PARCIAL'
    data.montoRetenido = retenido
    data.razonRetencion = input.razonRetencion
  }

  const actualizado = await prisma.depositoGarantia.update({ where: { id: deposito.id }, data })

  await registrarAuditoria({
    usuarioId, entidad: 'DepositoGarantia', entidadId: deposito.id, accion: 'DEVOLVER',
    camposDespues: { estado: data.estado, montoRetenido: data.montoRetenido } as Prisma.InputJsonValue,
  })

  return actualizado
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: errores solo si `registrarAuditoria` tiene otra firma o `prisma` se importa distinto. Ajustar según el patrón del proyecto (revisar otros services).

### Task 3.2: Schemas Zod de depósitos

**Files:**
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/depositos/depositos.schemas.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
import { z } from 'zod'

export const devolverDepositoSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('TOTAL') }),
  z.object({
    tipo: z.literal('RETENER_TOTAL'),
    razonRetencion: z.string().min(3, 'Razón requerida'),
  }),
  z.object({
    tipo: z.literal('PARCIAL'),
    montoRetenido: z.number().positive(),
    razonRetencion: z.string().min(3, 'Razón requerida'),
  }),
])

export type DevolverDepositoInput = z.infer<typeof devolverDepositoSchema>
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`

### Task 3.3: Controller de depósitos

**Files:**
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/depositos/depositos.controller.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
import { Request, Response, NextFunction } from 'express'
import * as service from './depositos.service'
import { devolverDepositoSchema } from './depositos.schemas'
import { AppError } from '../../lib/errors'

export async function obtener(req: Request, res: Response, next: NextFunction) {
  try {
    const deposito = await service.obtenerDeposito(req.params.id)
    res.json({ success: true, data: deposito })
  } catch (e) { next(e) }
}

export async function recibir(req: Request, res: Response, next: NextFunction) {
  try {
    const usuarioId = req.user!.id
    const deposito = await service.recibirDeposito(req.params.id, usuarioId)
    res.json({ success: true, data: deposito })
  } catch (e) { next(e) }
}

export async function devolver(req: Request, res: Response, next: NextFunction) {
  try {
    const usuarioId = req.user!.id
    const parsed = devolverDepositoSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(400, 'VALIDACION', 'Datos inválidos', parsed.error.issues)
    }
    const deposito = await service.devolverDeposito(req.params.id, parsed.data, usuarioId)
    res.json({ success: true, data: deposito })
  } catch (e) { next(e) }
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`

### Task 3.4: Routes de depósitos + montaje

**Files:**
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/depositos/depositos.routes.ts`
- Modify: el archivo donde se montan rutas (buscar `cotizaciones.routes` import)

- [ ] **Step 1: Crear routes**

```typescript
import { Router } from 'express'
import * as controller from './depositos.controller'
import { autenticar, autorizar } from '../auth/auth.middleware'

const router = Router({ mergeParams: true })

router.get('/', autenticar, controller.obtener)
router.post('/recibir', autenticar, autorizar(['ADMIN', 'GERENTE', 'OPERADOR']), controller.recibir)
router.post('/devolver', autenticar, autorizar(['ADMIN', 'GERENTE']), controller.devolver)

export default router
```

- [ ] **Step 2: Montar en cotizaciones.routes.ts**

Abrir `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/cotizaciones/cotizaciones.routes.ts` y agregar:

```typescript
import depositosRouter from '../depositos/depositos.routes'

// despues de las otras rutas, antes del export
router.use('/:id/deposito', depositosRouter)
```

- [ ] **Step 3: Type-check + arranque**

```bash
pnpm tsc --noEmit
pnpm dev   # smoke test, Ctrl+C para detener
```

- [ ] **Step 4: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/modules/depositos/ src/modules/cotizaciones/cotizaciones.routes.ts
git commit -m "feat(depositos): módulo CRUD para depósito de garantía

Endpoints: GET/POST recibir/POST devolver en /cotizaciones/:id/deposito.
Reglas: solo ADMIN/GERENTE devuelven; estados terminales son idempotentes.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Fase 4 — Backend: Facturas (generar manual + QUEDAN)

### Task 4.1: Schema Zod para generar factura

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/facturas/facturas.schemas.ts`

- [ ] **Step 1: Agregar schema `generarFacturaSchema`**

Al final del archivo (antes de los exports):

```typescript
export const generarFacturaSchema = z.object({
  tipoDTE:                z.enum(['FC', 'CCF', 'SUJETO_EXCLUIDO']),
  contactoFacturacionId:  z.string().min(1),
  fechaVencimiento:       z.coerce.date(),
  esQuedan:               z.boolean().default(false),
  fechaEntregaFactura:    z.coerce.date().optional(),
}).refine(
  d => !d.esQuedan || d.fechaEntregaFactura !== undefined,
  { message: 'fechaEntregaFactura es requerida cuando esQuedan es true', path: ['fechaEntregaFactura'] },
)

export type GenerarFacturaInput = z.infer<typeof generarFacturaSchema>

export const marcarEntregadaSchema = z.object({
  fechaEntregaReal: z.coerce.date().default(() => new Date()),
})
```

- [ ] **Step 2: Agregar filtros al listado**

En el schema existente de filtros (`listarFacturasSchema` o similar), agregar:
```typescript
esQuedan:           z.coerce.boolean().optional(),
entregaPendiente:   z.coerce.boolean().optional(),
```

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`

### Task 4.2: Service — generar factura desde cotización

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/facturas/facturas.service.ts`

- [ ] **Step 1: Importar tipos**

Agregar al inicio:
```typescript
import { GenerarFacturaInput } from './facturas.schemas'
```

- [ ] **Step 2: Crear `generarFacturaDesdeCotizacion`**

Al final del archivo:

```typescript
export async function generarFacturaDesdeCotizacion(
  cotizacionId: string,
  input: GenerarFacturaInput,
  usuarioId: string,
): Promise<{ factura: Factura; warning?: string }> {
  return prisma.$transaction(async tx => {
    const cotizacion = await tx.cotizacion.findUnique({
      where: { id: cotizacionId },
      include: { factura: true, actasEntrega: true },
    })
    if (!cotizacion) throw new AppError(404, 'NOT_FOUND', 'Cotización no encontrada')
    if (cotizacion.estado !== 'APROBADA') {
      throw new AppError(409, 'ESTADO_INVALIDO', 'Solo se puede facturar una cotización APROBADA')
    }
    if (cotizacion.factura) {
      throw new AppError(409, 'YA_EXISTE_FACTURA', 'Esta cotización ya tiene una factura')
    }

    const numeroFactura = await generarNumeroFactura(tx)

    const factura = await tx.factura.create({
      data: {
        numeroFactura,
        cotizacionId,
        clienteId:            cotizacion.clienteId,
        contactoFacturacionId: input.contactoFacturacionId,
        fechaVencimiento:     input.fechaVencimiento,
        subtotal:             cotizacion.subtotal,
        porcentajeIva:        cotizacion.porcentajeIva,
        montoIva:             cotizacion.montoIva,
        total:                cotizacion.total,
        montoPagado:          0,
        saldoPendiente:       cotizacion.total,
        tipoDTE:              input.tipoDTE,
        esQuedan:             input.esQuedan,
        fechaEntregaFactura:  input.fechaEntregaFactura,
      },
    })

    await registrarAuditoria({
      usuarioId, entidad: 'Factura', entidadId: factura.id, accion: 'CREAR',
      camposDespues: {
        numeroFactura, cotizacionId, esQuedan: input.esQuedan,
      } as Prisma.InputJsonValue,
    })

    // Advertencia (no bloqueante) si QUEDAN se emite con actas pendientes.
    let warning: string | undefined
    if (input.esQuedan) {
      const actas = cotizacion.actasEntrega
      const hayPendientes = actas.length === 0 || actas.some(a => a.estado !== 'DEVUELTO')
      if (hayPendientes) {
        warning = 'Se recomienda emitir QUEDAN después de devuelto el inventario.'
      }
    }

    return { factura, warning }
  })
}
```

(Si `generarNumeroFactura` no existe con ese nombre, buscar la función equivalente en el servicio actual — probablemente similar a `generarNumero` con prefijo "FAC".)

- [ ] **Step 3: Crear `marcarFacturaEntregada`**

```typescript
export async function marcarFacturaEntregada(
  facturaId: string,
  fechaEntregaReal: Date,
  usuarioId: string,
) {
  const factura = await prisma.factura.findUnique({ where: { id: facturaId } })
  if (!factura) throw new AppError(404, 'NOT_FOUND', 'Factura no encontrada')
  if (!factura.esQuedan) throw new AppError(409, 'NO_QUEDAN', 'Solo aplicable a facturas QUEDAN')
  if (factura.fechaEntregaReal) {
    throw new AppError(409, 'YA_ENTREGADA', 'La factura ya fue marcada como entregada')
  }

  const actualizada = await prisma.factura.update({
    where: { id: facturaId },
    data: { fechaEntregaReal },
  })

  await registrarAuditoria({
    usuarioId, entidad: 'Factura', entidadId: facturaId, accion: 'MARCAR_ENTREGADA',
    camposDespues: { fechaEntregaReal } as Prisma.InputJsonValue,
  })

  return actualizada
}
```

- [ ] **Step 4: Filtros en listar**

Buscar la función `listarFacturas` (o similar) y, dentro del `where` de Prisma, agregar:
```typescript
if (filtros.esQuedan !== undefined) where.esQuedan = filtros.esQuedan
if (filtros.entregaPendiente === true) {
  where.esQuedan = true
  where.fechaEntregaReal = null
  where.fechaEntregaFactura = { lte: new Date() }
}
```

- [ ] **Step 5: Type-check**

Run: `pnpm tsc --noEmit`

### Task 4.3: Controller — generar factura + marcar entregada

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/facturas/facturas.controller.ts`

- [ ] **Step 1: Importar schemas**

```typescript
import { generarFacturaSchema, marcarEntregadaSchema } from './facturas.schemas'
```

- [ ] **Step 2: Agregar handler `generarDesdeCotizacion`**

```typescript
export async function generarDesdeCotizacion(req: Request, res: Response, next: NextFunction) {
  try {
    const usuarioId = req.user!.id
    const parsed = generarFacturaSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(400, 'VALIDACION', 'Datos inválidos', parsed.error.issues)
    }
    const result = await service.generarFacturaDesdeCotizacion(req.params.id, parsed.data, usuarioId)
    res.status(201).json({ success: true, data: result.factura, warning: result.warning })
  } catch (e) { next(e) }
}
```

- [ ] **Step 3: Agregar handler `marcarEntregada`**

```typescript
export async function marcarEntregada(req: Request, res: Response, next: NextFunction) {
  try {
    const usuarioId = req.user!.id
    const parsed = marcarEntregadaSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(400, 'VALIDACION', 'Datos inválidos', parsed.error.issues)
    }
    const factura = await service.marcarFacturaEntregada(
      req.params.id, parsed.data.fechaEntregaReal, usuarioId,
    )
    res.json({ success: true, data: factura })
  } catch (e) { next(e) }
}
```

- [ ] **Step 4: Type-check**

Run: `pnpm tsc --noEmit`

### Task 4.4: Routes

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/facturas/facturas.routes.ts`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/cotizaciones/cotizaciones.routes.ts`

- [ ] **Step 1: En `cotizaciones.routes.ts`, montar el endpoint de generar factura**

```typescript
import * as facturasController from '../facturas/facturas.controller'

router.post(
  '/:id/factura',
  autenticar,
  autorizar(['ADMIN', 'GERENTE', 'OPERADOR']),
  facturasController.generarDesdeCotizacion,
)
```

- [ ] **Step 2: En `facturas.routes.ts`, montar marcar-entregada**

```typescript
router.post(
  '/:id/marcar-entregada',
  autenticar,
  autorizar(['ADMIN', 'GERENTE', 'OPERADOR']),
  controller.marcarEntregada,
)
```

- [ ] **Step 3: Smoke test**

```bash
pnpm tsc --noEmit
pnpm dev   # verifica que arranque sin errores
```

- [ ] **Step 4: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/modules/facturas/ src/modules/cotizaciones/cotizaciones.routes.ts
git commit -m "feat(facturas): generación manual desde cotización + soporte QUEDAN

- POST /cotizaciones/:id/factura: emite factura con tipoDTE, contacto,
  vencimiento manual; opcional esQuedan + fechaEntregaFactura.
- POST /facturas/:id/marcar-entregada: registra fechaEntregaReal.
- Filtros esQuedan y entregaPendiente en listado.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Fase 5 — Backend: Cliente.manejaQuedan + Cron QUEDAN

### Task 5.1: Cliente.manejaQuedan

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/clientes/clientes.schemas.ts`

- [ ] **Step 1: Agregar al schema**

En `crearClienteSchema` y `actualizarClienteSchema`, agregar:
```typescript
manejaQuedan: z.boolean().default(false),  // o .optional() en actualizar
```

- [ ] **Step 2: Verificar service**

Abrir `clientes.service.ts` y verificar que el spread del body incluya `manejaQuedan` (probablemente ya lo hace si usa spread).

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`

### Task 5.2: Job — notificar QUEDAN por entregar

**Files:**
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/jobs/notificarQuedanPorEntregar.ts`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/index.ts`

- [ ] **Step 1: Crear el job**

```typescript
import { prisma } from '../lib/prisma'
import { crearNotificacion } from '../modules/notificaciones/notificaciones.service'

const TIPO = 'QUEDAN_POR_ENTREGAR'

export async function notificarQuedanPorEntregar() {
  const hoy = new Date()

  const facturas = await prisma.factura.findMany({
    where: {
      esQuedan: true,
      fechaEntregaReal: null,
      fechaEntregaFactura: { lte: hoy },
    },
    select: { id: true, numeroFactura: true },
  })

  if (facturas.length === 0) return

  // Notificar a roles GERENTE y OPERADOR (ADMIN va incluido como super-rol implícito).
  const usuarios = await prisma.usuario.findMany({
    where: { rol: { in: ['ADMIN', 'GERENTE', 'OPERADOR'] }, activo: true },
    select: { id: true },
  })

  for (const factura of facturas) {
    for (const usuario of usuarios) {
      const yaExiste = await prisma.notificacion.findFirst({
        where: { usuarioId: usuario.id, tipo: TIPO, enlace: `/facturas/${factura.id}` },
      })
      if (yaExiste) continue

      await crearNotificacion(
        usuario.id,
        TIPO,
        'Factura QUEDAN por entregar',
        `La factura ${factura.numeroFactura} está pendiente de entrega al cliente.`,
        `/facturas/${factura.id}`,
      )
    }
  }
}
```

- [ ] **Step 2: Test del job (vitest)**

Crear `/Users/joaquinmorales13a06/Desktop/Reinar/server/tests/jobs/notificarQuedanPorEntregar.test.ts` siguiendo el patrón de `marcarFacturasVencidas.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    factura: { findMany: vi.fn() },
    usuario: { findMany: vi.fn() },
    notificacion: { findFirst: vi.fn() },
  },
}))
vi.mock('../../src/modules/notificaciones/notificaciones.service', () => ({
  crearNotificacion: vi.fn(),
}))

import { prisma } from '../../src/lib/prisma'
import { crearNotificacion } from '../../src/modules/notificaciones/notificaciones.service'
import { notificarQuedanPorEntregar } from '../../src/jobs/notificarQuedanPorEntregar'

describe('notificarQuedanPorEntregar', () => {
  beforeEach(() => vi.clearAllMocks())

  it('no notifica si no hay facturas pendientes', async () => {
    ;(prisma.factura.findMany as any).mockResolvedValue([])
    await notificarQuedanPorEntregar()
    expect(crearNotificacion).not.toHaveBeenCalled()
  })

  it('crea notificación para cada usuario por cada factura pendiente', async () => {
    ;(prisma.factura.findMany as any).mockResolvedValue([
      { id: 'f1', numeroFactura: 'FAC-2026-001' },
    ])
    ;(prisma.usuario.findMany as any).mockResolvedValue([{ id: 'u1' }, { id: 'u2' }])
    ;(prisma.notificacion.findFirst as any).mockResolvedValue(null)

    await notificarQuedanPorEntregar()

    expect(crearNotificacion).toHaveBeenCalledTimes(2)
  })

  it('es idempotente: no crea notificación duplicada', async () => {
    ;(prisma.factura.findMany as any).mockResolvedValue([
      { id: 'f1', numeroFactura: 'FAC-2026-001' },
    ])
    ;(prisma.usuario.findMany as any).mockResolvedValue([{ id: 'u1' }])
    ;(prisma.notificacion.findFirst as any).mockResolvedValue({ id: 'existing' })

    await notificarQuedanPorEntregar()

    expect(crearNotificacion).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Correr el test**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm test tests/jobs/notificarQuedanPorEntregar.test.ts`
Expected: 3 passed.

- [ ] **Step 4: Registrar el job en `index.ts`**

Abrir `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/index.ts` y, junto a los otros cronos (línea ~99), agregar:

```typescript
import { notificarQuedanPorEntregar } from './jobs/notificarQuedanPorEntregar'
// ... arriba con los otros imports

let cronQuedanPorEntregar: ReturnType<typeof setInterval>
// ... junto a los otros let

// En el bloque de inicio:
cronQuedanPorEntregar = setInterval(notificarQuedanPorEntregar, 24 * 60 * 60 * 1_000)  // diario
// Tambien correr una vez al arrancar para no esperar 24h en dev
notificarQuedanPorEntregar().catch(e => console.error('notificarQuedanPorEntregar:', e))

// En el bloque de cleanup:
clearInterval(cronQuedanPorEntregar)
```

- [ ] **Step 5: Type-check + smoke test**

```bash
pnpm tsc --noEmit
pnpm dev   # observa logs al arrancar
```

- [ ] **Step 6: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/modules/clientes/ src/jobs/ src/index.ts tests/jobs/
git commit -m "feat: Cliente.manejaQuedan + cron notificación QUEDAN por entregar

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Fase 6 — Backend: PDF

### Task 6.1: pdf.service.ts — pasar nuevos campos a la plantilla de cotización

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/pdf/pdf.service.ts`

- [ ] **Step 1: Localizar el mapeo de items**

Buscar la función que genera el PDF de cotización (~línea 200) donde se mapean items con `unidades`, `periodo`, `tarifa`.

- [ ] **Step 2: Reemplazar `unidades` por `cantidadUnidades`**

Cambiar:
```typescript
unidades: isConsumible ? 1 : item.cantidad,
```
por:
```typescript
unidades:     item.cantidadUnidades,
dias:         item.cantidadDias,
```

Y para el bloque agrupado de andamios, reemplazar `first.cantidad` por `first.cantidadUnidades` y agregar `dias: first.cantidadDias`.

- [ ] **Step 3: Cargar datos bancarios desde Configuracion**

Buscar la función que arma el contexto del PDF de cotización. Antes del `compile()`, agregar:

```typescript
const config = await prisma.configuracionEmpresa.findUnique({ where: { id: 'singleton' } })
const datosBancarios = config?.datosBancarios as
  | { banco?: string; titular?: string; numeroCuenta?: string; tipoCuenta?: string }
  | undefined
```

Y pasar al contexto: `datosBancarios`.

- [ ] **Step 4: Quitar porcentaje de depósito del contexto**

Si el contexto envía `depositoPorcentaje`, eliminarlo. Solo enviar `depositoMonto` formateado.

- [ ] **Step 5: Type-check**

Run: `pnpm tsc --noEmit`

### Task 6.2: cotizacion.hbs — header DÍAS y layout dos columnas

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/pdf/templates/cotizacion.hbs`

- [ ] **Step 1: Cambiar header "PERÍODO" por "DÍAS"**

Buscar `<th>` con texto "PERÍODO" (puede aparecer 2 veces, en encabezados de la tabla principal y la tabla de grupos andamio). Cambiar a "DÍAS".

- [ ] **Step 2: Cambiar contenido de la celda**

Reemplazar:
```hbs
<td>{{this.unidades}} × {{this.periodo}}</td>
```
por:
```hbs
<td class="r mono">{{#if this.dias}}{{this.dias}}{{else}}—{{/if}}</td>
```

Hacer este cambio en las dos tablas (ítems normales + grupos andamio).

- [ ] **Step 3: Reemplazar bloque inferior con layout dos columnas**

Buscar el bloque que muestra `Subtotal`, `IVA`, `TOTAL`, `Depósito requerido`. Envolverlo en una tabla de dos columnas:

```hbs
<table class="footer-grid" style="width:100%;border-collapse:collapse;margin-top:24px">
  <tr>
    <td style="width:55%;vertical-align:top;padding-right:24px">
      {{#if datosBancarios}}
      <div class="bank-block">
        <div class="bank-title">DATOS PARA TRANSFERENCIA</div>
        {{#if datosBancarios.banco}}<div><b>Banco:</b> {{datosBancarios.banco}}</div>{{/if}}
        {{#if datosBancarios.titular}}<div><b>Titular:</b> {{datosBancarios.titular}}</div>{{/if}}
        {{#if datosBancarios.numeroCuenta}}<div><b>Cuenta:</b> {{datosBancarios.numeroCuenta}}</div>{{/if}}
        {{#if datosBancarios.tipoCuenta}}<div><b>Tipo:</b> {{datosBancarios.tipoCuenta}}</div>{{/if}}
      </div>
      {{/if}}
    </td>
    <td style="width:45%;vertical-align:top">
      <div class="totales-block">
        <div class="row"><span>Subtotal</span><span class="mono">{{subtotal}}</span></div>
        <div class="row"><span>IVA ({{porcentajeIva}}%)</span><span class="mono">{{montoIva}}</span></div>
        <div class="row total"><span>TOTAL</span><span class="mono">{{total}}</span></div>
        {{#if depositoMonto}}
        <div class="row deposito"><span>Depósito requerido</span><span class="mono">{{depositoMonto}}</span></div>
        {{/if}}
      </div>
    </td>
  </tr>
</table>
```

- [ ] **Step 4: Agregar estilos para el footer-grid**

En el `<style>` del template (o el bloque CSS existente), agregar:

```css
.footer-grid .bank-title { font-weight:700; letter-spacing:0.05em; font-size:0.85em; margin-bottom:6px }
.footer-grid .bank-block div { margin:2px 0; font-size:0.9em }
.footer-grid .totales-block .row { display:flex; justify-content:space-between; padding:4px 0 }
.footer-grid .totales-block .row.total { border-top:2px solid #000; font-weight:700; font-size:1.1em }
.footer-grid .totales-block .row.deposito { border-top:1px dashed #999; margin-top:6px; padding-top:8px }
```

- [ ] **Step 5: Eliminar referencia a `depositoPorcentaje`**

Si existe en el template (ej. `{{depositoPorcentaje}}%`), eliminarlo.

- [ ] **Step 6: Probar generación de PDF**

Iniciar el server con `pnpm dev` y desde el frontend (o curl) descargar el PDF de una cotización con depósito. Verificar:
- Header "DÍAS" en lugar de "PERÍODO".
- Datos bancarios a la izquierda, totales a la derecha.
- Sin porcentaje de depósito (solo monto).

### Task 6.3: factura.hbs — badge QUEDAN + fecha de entrega

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/pdf/templates/factura.hbs`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/pdf/pdf.service.ts`

- [ ] **Step 1: Pasar campos QUEDAN al contexto**

En `pdf.service.ts`, en la función que arma el contexto de la factura, agregar:
```typescript
esQuedan:            factura.esQuedan,
fechaEntregaFactura: factura.fechaEntregaFactura ? formatFechaCorta(factura.fechaEntregaFactura) : null,
```

- [ ] **Step 2: Badge en el header de la plantilla**

En `factura.hbs`, junto al número de factura del header, agregar:
```hbs
{{#if esQuedan}}<span class="badge-quedan">QUEDAN</span>{{/if}}
```

Y en el `<style>`:
```css
.badge-quedan { display:inline-block; padding:2px 8px; border:1.5px solid #b45309;
                color:#b45309; font-weight:700; letter-spacing:0.06em; font-size:0.75em;
                border-radius:4px; margin-left:8px }
```

- [ ] **Step 3: Fila "Fecha programada de entrega"**

Donde se muestra "Fecha de emisión", agregar debajo:
```hbs
{{#if esQuedan}}
<div><b>Fecha programada de entrega:</b> {{fechaEntregaFactura}}</div>
{{/if}}
```

- [ ] **Step 4: Verificar generación**

Generar un PDF de una factura `esQuedan=true` y verificar badge + fecha.

- [ ] **Step 5: Commit Fase 6**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/modules/pdf/
git commit -m "feat(pdf): nuevo layout cotización + badge QUEDAN en factura

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Fase 7 — Frontend: tipos y hooks compartidos

### Task 7.1: Actualizar tipos compartidos

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/types/api.ts`

- [ ] **Step 1: Agregar tipo DepositoGarantia**

Al final del archivo:

```typescript
export type EstadoDeposito = 'PENDIENTE' | 'RECIBIDO' | 'DEVUELTO' | 'RETENIDO_PARCIAL' | 'RETENIDO_TOTAL';

export interface DepositoGarantia {
  id: string;
  cotizacionId: string;
  monto: string;
  estado: EstadoDeposito;
  fechaRecibido: string | null;
  fechaDevuelto: string | null;
  montoRetenido: string | null;
  razonRetencion: string | null;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Actualizar tipo Cliente con manejaQuedan**

Buscar `interface Cliente` y agregar:
```typescript
manejaQuedan: boolean;
```

- [ ] **Step 3: Actualizar tipo Factura**

Buscar `interface Factura` y agregar:
```typescript
esQuedan: boolean;
fechaEntregaFactura: string | null;
fechaEntregaReal: string | null;
```

- [ ] **Step 4: Actualizar tipo CotizacionItem**

Reemplazar `cantidad: number;` por:
```typescript
cantidadUnidades: number;
cantidadDias: number;
```

- [ ] **Step 5: Type-check**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit`
Expected: errores en todos los componentes que usan `cantidad` — los iremos arreglando.

### Task 7.2: Hook use-deposito

**Files:**
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/hooks/use-deposito.ts`

- [ ] **Step 1: Crear el hook**

```typescript
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { ApiResponse, DepositoGarantia } from '@/types/api';

const qkDeposito = (cotizacionId: string) => ['deposito', cotizacionId] as const;

export function useDeposito(cotizacionId: string, enabled = true) {
  return useQuery({
    queryKey: qkDeposito(cotizacionId),
    queryFn: async () => {
      const res = await api.get<ApiResponse<DepositoGarantia | null>>(
        `/cotizaciones/${cotizacionId}/deposito`,
      );
      return res.data.data;
    },
    enabled,
  });
}

export function useRecibirDeposito(cotizacionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse<DepositoGarantia>>(
        `/cotizaciones/${cotizacionId}/deposito/recibir`,
      );
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Depósito marcado como recibido');
      qc.invalidateQueries({ queryKey: qkDeposito(cotizacionId) });
      qc.invalidateQueries({ queryKey: ['cotizaciones', cotizacionId] });
    },
    onError: (e: Error) => toast.error(e.message ?? 'Error al recibir el depósito'),
  });
}

type DevolverInput =
  | { tipo: 'TOTAL' }
  | { tipo: 'RETENER_TOTAL'; razonRetencion: string }
  | { tipo: 'PARCIAL'; montoRetenido: number; razonRetencion: string };

export function useDevolverDeposito(cotizacionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DevolverInput) => {
      const res = await api.post<ApiResponse<DepositoGarantia>>(
        `/cotizaciones/${cotizacionId}/deposito/devolver`,
        input,
      );
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Depósito actualizado');
      qc.invalidateQueries({ queryKey: qkDeposito(cotizacionId) });
      qc.invalidateQueries({ queryKey: ['cotizaciones', cotizacionId] });
    },
    onError: (e: Error) => toast.error(e.message ?? 'Error al devolver el depósito'),
  });
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`

### Task 7.3: Extender use-facturas con nuevos hooks

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/hooks/use-facturas.ts`

- [ ] **Step 1: Agregar `useGenerarFactura`**

Al final del archivo (antes del último export):

```typescript
type GenerarFacturaInput = {
  tipoDTE: 'FC' | 'CCF' | 'SUJETO_EXCLUIDO';
  contactoFacturacionId: string;
  fechaVencimiento: string;
  esQuedan: boolean;
  fechaEntregaFactura?: string;
};

export function useGenerarFactura(cotizacionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: GenerarFacturaInput) => {
      const res = await api.post<ApiResponse<Factura> & { warning?: string }>(
        `/cotizaciones/${cotizacionId}/factura`,
        input,
      );
      return { factura: res.data.data, warning: res.data.warning };
    },
    onSuccess: ({ warning }) => {
      if (warning) toast.info(warning);
      else toast.success('Factura generada');
      qc.invalidateQueries({ queryKey: ['cotizaciones', cotizacionId] });
      qc.invalidateQueries({ queryKey: ['facturas'] });
    },
    onError: (e: Error) => toast.error(e.message ?? 'Error al generar la factura'),
  });
}

export function useMarcarFacturaEntregada(facturaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fechaEntregaReal: string) => {
      const res = await api.post<ApiResponse<Factura>>(
        `/facturas/${facturaId}/marcar-entregada`,
        { fechaEntregaReal },
      );
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Factura marcada como entregada');
      qc.invalidateQueries({ queryKey: ['facturas', facturaId] });
      qc.invalidateQueries({ queryKey: ['facturas'] });
    },
    onError: (e: Error) => toast.error(e.message ?? 'Error al marcar la factura'),
  });
}
```

- [ ] **Step 2: Agregar filtros `esQuedan` y `entregaPendiente`**

Buscar `useFacturas` y extender el tipo de filtros + propagación a `params`:

```typescript
// En el tipo Filtros:
esQuedan?: boolean;
entregaPendiente?: boolean;

// En la función:
if (filtros.esQuedan !== undefined) params.esQuedan = filtros.esQuedan;
if (filtros.entregaPendiente !== undefined) params.entregaPendiente = filtros.entregaPendiente;
```

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`

- [ ] **Step 4: Commit Fase 7**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add types/ hooks/
git commit -m "feat(types,hooks): nuevos tipos y hooks para QUEDAN, depósito y días

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Fase 8 — Frontend: Contacto solicitante inline + modal

### Task 8.1: Modal mínimo para crear contacto

**Files:**
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/contactos/ContactoFormMinModal.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { ApiResponse, Contacto, TipoContacto } from '@/types/api';
import { PhoneInputField } from '@/components/ui/PhoneInputField';
import { Icon } from '@/components/ui/Icon';

const schema = z.object({
  nombre:    z.string().min(2, 'Nombre requerido'),
  cargo:     z.string().optional(),
  telefono:  z.string().optional(),
  email:     z.string().email('Email inválido').optional().or(z.literal('')),
  tipo:      z.enum(['SOLICITANTE', 'FACTURACION', 'TECNICO', 'GENERAL']),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  clienteId: string;
  defaultTipo?: TipoContacto;
  onClose: () => void;
  onCreated: (contacto: Contacto) => void;
}

export function ContactoFormMinModal({ clienteId, defaultTipo = 'SOLICITANTE', onClose, onCreated }: Props) {
  const qc = useQueryClient();
  const { register, handleSubmit, control, formState: { errors }, setError } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: defaultTipo },
  });

  const crear = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await api.post<ApiResponse<Contacto>>(`/clientes/${clienteId}/contactos`, values);
      return res.data.data;
    },
    onSuccess: (contacto) => {
      toast.success('Contacto creado');
      qc.invalidateQueries({ queryKey: ['contactos', { clienteId }] });
      onCreated(contacto);
      onClose();
    },
    onError: (e: any) => {
      const issues = e?.response?.data?.error?.details as Array<{ path: string[]; message: string }> | undefined;
      if (issues) {
        for (const i of issues) setError(i.path[0] as any, { message: i.message });
      } else {
        toast.error(e?.message ?? 'Error al crear contacto');
      }
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Nuevo contacto</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-900">
            <Icon name="x" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(values => crear.mutate(values))} className="space-y-3">
          <div>
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Nombre</label>
            <input {...register('nombre')} className="input-base" />
            {errors.nombre && <p className="text-xs text-red-600 mt-1">{errors.nombre.message}</p>}
          </div>

          <div>
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Cargo</label>
            <input {...register('cargo')} className="input-base" />
          </div>

          <div>
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Teléfono</label>
            <PhoneInputField control={control} name="telefono" placeholder="Teléfono" />
          </div>

          <div>
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Email</label>
            <input {...register('email')} type="email" className="input-base" />
            {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Tipo</label>
            <select {...register('tipo')} className="input-base">
              <option value="SOLICITANTE">Solicitante</option>
              <option value="FACTURACION">Facturación</option>
              <option value="TECNICO">Técnico</option>
              <option value="GENERAL">General</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={crear.isPending} className="btn-primary">
              {crear.isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

(Si las clases utilitarias `input-base`, `btn-primary`, `btn-secondary` no existen, replicar el patrón de otros forms del proyecto; revisar `globals.css` o un form existente.)

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`

### Task 8.2: Combobox de contacto solicitante

**Files:**
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/cotizaciones/ContactoSolicitanteSelect.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
'use client';

import { useState } from 'react';
import { useContactos } from '@/hooks/use-contactos';
import { ContactoFormMinModal } from '@/components/contactos/ContactoFormMinModal';
import { Icon } from '@/components/ui/Icon';
import type { Contacto } from '@/types/api';

interface Props {
  clienteId: string | null;
  value: string | null;
  onChange: (contactoId: string | null) => void;
}

export function ContactoSolicitanteSelect({ clienteId, value, onChange }: Props) {
  const [showModal, setShowModal] = useState(false);
  const { data: contactos = [] } = useContactos(
    { clienteId: clienteId ?? '' },
    { enabled: !!clienteId },
  );

  return (
    <>
      <div className="flex items-center gap-2">
        <select
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
          disabled={!clienteId}
          className="input-base flex-1"
        >
          <option value="">— Seleccionar contacto —</option>
          {contactos.map(c => (
            <option key={c.id} value={c.id}>
              {c.nombre}{c.cargo ? ` — ${c.cargo}` : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          disabled={!clienteId}
          className="btn-secondary !p-2"
          title="Nuevo contacto"
        >
          <Icon name="check" size={16} />  {/* usar 'plus' si existe en Icon */}
        </button>
      </div>

      {showModal && clienteId && (
        <ContactoFormMinModal
          clienteId={clienteId}
          defaultTipo="SOLICITANTE"
          onClose={() => setShowModal(false)}
          onCreated={(contacto: Contacto) => onChange(contacto.id)}
        />
      )}
    </>
  );
}
```

(Revisar `components/ui/Icon.tsx` por el nombre disponible para "+"; si no existe, agregarlo siguiendo el patrón del archivo.)

- [ ] **Step 2: Verificar que `useContactos` acepte `{ clienteId }`**

Abrir `hooks/use-contactos.ts` y confirmar la firma. Si no acepta filtro por cliente, agregar parámetro:

```typescript
export function useContactos(filtros: { clienteId?: string } = {}, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['contactos', filtros],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Contacto[]>>(
        filtros.clienteId ? `/clientes/${filtros.clienteId}/contactos` : '/contactos',
      );
      return res.data.data;
    },
    enabled: opts?.enabled ?? true,
  });
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`

### Task 8.3: Integrar en Step1Cliente del wizard

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/cotizaciones/wizard/Step1Cliente.tsx`

- [ ] **Step 1: Importar el componente**

```typescript
import { ContactoSolicitanteSelect } from '@/components/cotizaciones/ContactoSolicitanteSelect';
```

- [ ] **Step 2: Reemplazar el dropdown existente (o agregar el bloque)**

Donde está el campo de contacto solicitante (o donde corresponde), reemplazar con:

```tsx
<div>
  <label className="text-sm text-zinc-600 dark:text-zinc-400">Contacto solicitante</label>
  <ContactoSolicitanteSelect
    clienteId={clienteId}
    value={contactoSolicitanteId}
    onChange={setContactoSolicitanteId}
  />
</div>
```

Ajustar nombres a las variables existentes del componente (`watch('clienteId')`, etc. si usa RHF).

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`

- [ ] **Step 4: Smoke test manual**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm dev
```
- Crear cotización nueva.
- Verificar dropdown se llena con contactos del cliente seleccionado.
- Click en botón `+` → modal se abre.
- Crear contacto → se cierra modal, dropdown se actualiza, contacto queda seleccionado.

- [ ] **Step 5: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add components/contactos/ components/cotizaciones/ hooks/use-contactos.ts
git commit -m "feat(cotizaciones): contacto solicitante con botón inline para crear

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Fase 9 — Frontend: Días por ítem en wizard

### Task 9.1: Step2Items — columna Días

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/cotizaciones/wizard/Step2Items.tsx`

- [ ] **Step 1: Reemplazar referencias a `cantidad` en cada fila**

Buscar todos los `it.cantidad` y reemplazar por `it.cantidadUnidades` (mostrar) y `it.cantidadDias` donde corresponda.

- [ ] **Step 2: Agregar columna Días**

Antes o después de la columna de "cantidad/unidades", agregar (mostrar solo si el tipo permite días):

```tsx
{(it.tipo === 'EQUIPO' || it.tipo === 'HERRAMIENTA' || it.tipo === 'PIEZA_ANDAMIO') && (
  <td className="w-20">
    <input
      type="number"
      min={1}
      defaultValue={it.cantidadDias}
      onBlur={(e) => {
        const dias = Math.max(1, parseInt(e.target.value, 10) || 1);
        if (dias !== it.cantidadDias) patch(it, { cantidadDias: dias });
      }}
      className="input-base mono text-right"
    />
  </td>
)}
{(it.tipo === 'SERVICIO' || it.tipo === 'CONSUMIBLE' || it.tipo === 'CUSTOM') && (
  <td className="text-center text-zinc-400">—</td>
)}
```

- [ ] **Step 3: Habilitar edición de unidades para HERRAMIENTA/CONSUMIBLE/PIEZA_ANDAMIO/SERVICIO**

EQUIPO mantiene disabled en 1. Los demás:
```tsx
<input
  type="number"
  min={1}
  defaultValue={it.cantidadUnidades}
  disabled={it.tipo === 'EQUIPO'}
  onBlur={(e) => {
    const u = Math.max(1, parseInt(e.target.value, 10) || 1);
    if (u !== it.cantidadUnidades) patch(it, { cantidadUnidades: u });
  }}
  className="input-base mono text-right"
/>
```

- [ ] **Step 4: Agregar header "Días" a la tabla**

Buscar el `<thead>` y agregar columna después de "Cant.": `<th>Días</th>`.

- [ ] **Step 5: Type-check**

Run: `pnpm tsc --noEmit`

### Task 9.2: AgregarItemModal — campos en tabs

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/cotizaciones/wizard/AgregarItemModal/TabEquipo.tsx`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/cotizaciones/wizard/AgregarItemModal/TabHerramienta.tsx`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/cotizaciones/wizard/AgregarItemModal/TabAndamio.tsx`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/cotizaciones/wizard/AgregarItemModal/TabServicio.tsx` (si existe)
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/cotizaciones/wizard/AgregarItemModal/TabConsumible.tsx` (si existe)

- [ ] **Step 1: TabEquipo — agregar input días**

Reemplazar `cantidad` (que es 1 fijo) por `cantidadUnidades` (siempre 1) y agregar estado `cantidadDias`:

```typescript
const [cantidadDias, setCantidadDias] = useState(1);
```

En el render, agregar input:
```tsx
<div>
  <label className="text-sm">Días</label>
  <input
    type="number"
    min={1}
    value={cantidadDias}
    onChange={e => setCantidadDias(Math.max(1, parseInt(e.target.value, 10) || 1))}
    className="input-base mono"
  />
</div>
```

En el submit:
```typescript
data: { tipo: 'EQUIPO', equipoId: selected.id, periodo, cantidadDias }
```

Y el preview de tarifa: mostrar `tarifa × cantidadDias`.

- [ ] **Step 2: TabHerramienta — agregar inputs**

Igual: estado `cantidadDias` + input + pasar en `data`. `cantidadUnidades` ya está como `cantidad` en el componente; renombrar el estado a `cantidadUnidades` y enviarlo.

- [ ] **Step 3: TabAndamio — igual**

Mismo patrón.

- [ ] **Step 4: TabServicio / TabConsumible**

Solo enviar `cantidadUnidades` (sin `cantidadDias`); el backend impone que sea 1.

- [ ] **Step 5: Type-check**

Run: `pnpm tsc --noEmit`

### Task 9.3: Step4Resumen — mostrar unidades × días

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/cotizaciones/wizard/Step4Resumen.tsx`

- [ ] **Step 1: Reemplazar `cantidad`**

Cambiar `it.cantidad` a `it.cantidadUnidades`. En cada línea agregar `{it.cantidadDias > 1 ? ` × ${it.cantidadDias} días` : ''}`.

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`

### Task 9.4: Step3Terminos — quitar tipo doc + facturar a

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/cotizaciones/wizard/Step3Terminos.tsx`

- [ ] **Step 1: Eliminar campos**

Borrar los inputs/selects de `tipoDocumentoFiscal` y `contactoFacturacionId`. Eliminar también del schema Zod local (si lo hay) y del defaultValues.

- [ ] **Step 2: Eliminar `depositoPorcentaje` del input (mantener solo `depositoMonto`)**

Borrar el input de porcentaje. Si existe lógica que derive el monto del porcentaje al cambiar el total, eliminarla.

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`

- [ ] **Step 4: Smoke test del wizard completo**

```bash
pnpm dev
```
- Crear cotización; agregar equipo (verificar input días), herramienta, servicio.
- Validar que el subtotal de los ítems se actualice con la fórmula nueva (`tarifa × unidades × días`).
- Verificar que Step3 no muestre tipo doc fiscal ni "facturar a".
- Guardar como borrador y revisar en BD que `cantidadUnidades` y `cantidadDias` queden correctos.

- [ ] **Step 5: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add components/cotizaciones/wizard/
git commit -m "feat(wizard): días por ítem y separar tipo doc fiscal del borrador

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Fase 10 — Frontend: Detalle de cotización (depósito + generar factura)

### Task 10.1: Panel de depósito

**Files:**
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/cotizaciones/DepositoPanel.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
'use client';

import { useState } from 'react';
import { useDeposito, useRecibirDeposito, useDevolverDeposito } from '@/hooks/use-deposito';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Props {
  cotizacionId: string;
  cotizacionEstado: string;
  depositoMontoCotizacion: string | null;
}

export function DepositoPanel({ cotizacionId, cotizacionEstado, depositoMontoCotizacion }: Props) {
  const visible = cotizacionEstado === 'APROBADA' && depositoMontoCotizacion && Number(depositoMontoCotizacion) > 0;
  const { data: deposito } = useDeposito(cotizacionId, !!visible);
  const recibir = useRecibirDeposito(cotizacionId);
  const devolver = useDevolverDeposito(cotizacionId);

  const [modo, setModo] = useState<null | 'PARCIAL' | 'RETENER_TOTAL'>(null);
  const [montoRetenido, setMontoRetenido] = useState('');
  const [razon, setRazon] = useState('');

  if (!visible || !deposito) return null;

  const estado = deposito.estado;

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Depósito de garantía</h3>
        <Badge status={estado} />
      </div>

      <div className="text-sm space-y-1">
        <div><span className="text-zinc-500">Monto:</span> <span className="mono">{formatCurrency(deposito.monto)}</span></div>
        {deposito.fechaRecibido && (
          <div><span className="text-zinc-500">Recibido:</span> {formatDate(deposito.fechaRecibido)}</div>
        )}
        {deposito.fechaDevuelto && (
          <div><span className="text-zinc-500">Devuelto:</span> {formatDate(deposito.fechaDevuelto)}</div>
        )}
        {deposito.montoRetenido && (
          <div><span className="text-zinc-500">Retenido:</span> <span className="mono">{formatCurrency(deposito.montoRetenido)}</span></div>
        )}
        {deposito.razonRetencion && (
          <div><span className="text-zinc-500">Razón:</span> {deposito.razonRetencion}</div>
        )}
      </div>

      {estado === 'PENDIENTE' && (
        <div className="mt-3">
          <button
            onClick={() => recibir.mutate()}
            disabled={recibir.isPending}
            className="btn-primary"
          >
            Marcar como recibido
          </button>
        </div>
      )}

      {estado === 'RECIBIDO' && modo === null && (
        <div className="mt-3 flex gap-2 flex-wrap">
          <button onClick={() => devolver.mutate({ tipo: 'TOTAL' })} disabled={devolver.isPending} className="btn-primary">
            Devolver completo
          </button>
          <button onClick={() => setModo('PARCIAL')} className="btn-secondary">Devolver parcial</button>
          <button onClick={() => setModo('RETENER_TOTAL')} className="btn-secondary">Retener completo</button>
        </div>
      )}

      {estado === 'RECIBIDO' && modo === 'PARCIAL' && (
        <div className="mt-3 space-y-2">
          <div>
            <label className="text-sm text-zinc-500">Monto a retener</label>
            <input
              type="number" step="0.01" min="0.01"
              value={montoRetenido}
              onChange={e => setMontoRetenido(e.target.value)}
              className="input-base mono"
            />
          </div>
          <div>
            <label className="text-sm text-zinc-500">Razón</label>
            <textarea value={razon} onChange={e => setRazon(e.target.value)} className="input-base" rows={2} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => devolver.mutate(
                { tipo: 'PARCIAL', montoRetenido: parseFloat(montoRetenido), razonRetencion: razon },
                { onSuccess: () => { setModo(null); setMontoRetenido(''); setRazon(''); } },
              )}
              disabled={devolver.isPending || !razon || !montoRetenido}
              className="btn-primary"
            >
              Confirmar devolución parcial
            </button>
            <button onClick={() => setModo(null)} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      )}

      {estado === 'RECIBIDO' && modo === 'RETENER_TOTAL' && (
        <div className="mt-3 space-y-2">
          <label className="text-sm text-zinc-500">Razón de retención total</label>
          <textarea value={razon} onChange={e => setRazon(e.target.value)} className="input-base" rows={2} />
          <div className="flex gap-2">
            <button
              onClick={() => devolver.mutate(
                { tipo: 'RETENER_TOTAL', razonRetencion: razon },
                { onSuccess: () => { setModo(null); setRazon(''); } },
              )}
              disabled={devolver.isPending || !razon}
              className="btn-primary"
            >
              Confirmar retención
            </button>
            <button onClick={() => setModo(null)} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`

### Task 10.2: Modal "Generar factura"

**Files:**
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/cotizaciones/GenerarFacturaModal.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGenerarFactura } from '@/hooks/use-facturas';
import { ContactoSolicitanteSelect } from './ContactoSolicitanteSelect';
import { Icon } from '@/components/ui/Icon';
import type { Cliente } from '@/types/api';

interface Props {
  cotizacionId: string;
  cliente: Pick<Cliente, 'id' | 'manejaQuedan'>;
  actasTodasDevueltas: boolean;
  onClose: () => void;
}

function fechaPlus30(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export function GenerarFacturaModal({ cotizacionId, cliente, actasTodasDevueltas, onClose }: Props) {
  const router = useRouter();
  const generar = useGenerarFactura(cotizacionId);

  const [tipoDTE, setTipoDTE] = useState<'FC' | 'CCF' | 'SUJETO_EXCLUIDO'>('FC');
  const [contactoFacturacionId, setContactoFacturacionId] = useState<string | null>(null);
  const [fechaVencimiento, setFechaVencimiento] = useState(fechaPlus30());
  const [esQuedan, setEsQuedan] = useState(cliente.manejaQuedan);
  const [fechaEntregaFactura, setFechaEntregaFactura] = useState('');

  const puedeSubmit = !!contactoFacturacionId && !!fechaVencimiento && (!esQuedan || !!fechaEntregaFactura);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg w-full max-w-lg p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Generar factura</h2>
          <button onClick={onClose}><Icon name="x" size={18} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-zinc-500">Tipo de documento fiscal</label>
            <select value={tipoDTE} onChange={e => setTipoDTE(e.target.value as any)} className="input-base">
              <option value="FC">Factura de Consumidor (FC)</option>
              <option value="CCF">Comprobante de Crédito Fiscal (CCF)</option>
              <option value="SUJETO_EXCLUIDO">Sujeto Excluido</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-zinc-500">Facturar a</label>
            <ContactoSolicitanteSelect
              clienteId={cliente.id}
              value={contactoFacturacionId}
              onChange={setContactoFacturacionId}
            />
          </div>

          <div>
            <label className="text-sm text-zinc-500">Fecha de vencimiento</label>
            <input
              type="date"
              value={fechaVencimiento}
              onChange={e => setFechaVencimiento(e.target.value)}
              className="input-base"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={esQuedan} onChange={e => setEsQuedan(e.target.checked)} />
            <span className="text-sm">Es factura QUEDAN</span>
          </label>

          {esQuedan && (
            <>
              <div>
                <label className="text-sm text-zinc-500">Fecha programada de entrega</label>
                <input
                  type="date"
                  value={fechaEntregaFactura}
                  onChange={e => setFechaEntregaFactura(e.target.value)}
                  className="input-base"
                />
              </div>
              {!actasTodasDevueltas && (
                <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-2 text-sm text-amber-800 dark:text-amber-300">
                  Recomendado: emitir QUEDAN después de devolver el inventario.
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            disabled={!puedeSubmit || generar.isPending}
            onClick={() => {
              generar.mutate(
                {
                  tipoDTE,
                  contactoFacturacionId: contactoFacturacionId!,
                  fechaVencimiento,
                  esQuedan,
                  fechaEntregaFactura: esQuedan ? fechaEntregaFactura : undefined,
                },
                { onSuccess: ({ factura }) => router.push(`/facturas/${factura.id}`) },
              );
            }}
            className="btn-primary"
          >
            {generar.isPending ? 'Generando…' : 'Generar factura'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`

### Task 10.3: Integrar panel + botón en el detalle

**Files:**
- Modify: detalle de cotización (buscar `app/(dashboard)/cotizaciones/[id]/page.tsx` y/o `components/cotizaciones/detalle/*`)

- [ ] **Step 1: Detectar el componente principal del detalle**

```bash
ls /Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/cotizaciones/detalle/
```

- [ ] **Step 2: En el encabezado del detalle, agregar botón "Generar factura"**

Donde están las acciones del encabezado, agregar (asumiendo `cotizacion` ya disponible):

```tsx
import { useState } from 'react';
import { GenerarFacturaModal } from '@/components/cotizaciones/GenerarFacturaModal';
import { useAuth } from '@/hooks/use-auth';

// ...
const [showGenerar, setShowGenerar] = useState(false);
const { user } = useAuth();
const puedeFacturar = user?.rol !== 'VISUALIZADOR' && cotizacion.estado === 'APROBADA' && !cotizacion.factura;
const actasTodasDevueltas = (cotizacion.actasEntrega ?? []).every(a => a.estado === 'DEVUELTO')
                            && (cotizacion.actasEntrega ?? []).length > 0;
// ...

{puedeFacturar && (
  <button onClick={() => setShowGenerar(true)} className="btn-primary">
    Generar factura
  </button>
)}
{showGenerar && (
  <GenerarFacturaModal
    cotizacionId={cotizacion.id}
    cliente={cotizacion.cliente}
    actasTodasDevueltas={actasTodasDevueltas}
    onClose={() => setShowGenerar(false)}
  />
)}
```

- [ ] **Step 3: Agregar el panel de depósito**

En el contenido del detalle:

```tsx
import { DepositoPanel } from '@/components/cotizaciones/DepositoPanel';

<DepositoPanel
  cotizacionId={cotizacion.id}
  cotizacionEstado={cotizacion.estado}
  depositoMontoCotizacion={cotizacion.depositoMonto}
/>
```

- [ ] **Step 4: Type-check**

Run: `pnpm tsc --noEmit`

- [ ] **Step 5: Smoke test**

```bash
pnpm dev
```
- Aprobar una cotización con depósito.
- Verificar panel "Depósito de garantía" en estado PENDIENTE.
- Click "Marcar como recibido" → estado RECIBIDO.
- Click "Devolver parcial" → form inline; ingresar monto + razón; confirmar → RETENIDO_PARCIAL.
- Click "Generar factura" → modal; llenar campos; verificar redirect a `/facturas/:id`.

- [ ] **Step 6: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add components/cotizaciones/
git commit -m "feat(cotizaciones): panel de depósito + modal generar factura

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Fase 11 — Frontend: Listado y detalle de facturas

### Task 11.1: Filtros — chips QUEDAN

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/facturas/FacturasFilters.tsx`

- [ ] **Step 1: Extender tipo de filtros y props**

Agregar `esQuedan` y `entregaPendiente` (boolean opcionales). Reflejar en la UI con dos toggles tipo chip; "Pendientes de entrega" solo activable cuando "Solo QUEDAN" está activo.

```tsx
<button
  onClick={() => setEsQuedan(v => !v)}
  className={`chip ${esQuedan ? 'chip-active' : ''}`}
>
  Solo QUEDAN
</button>
<button
  onClick={() => setEntregaPendiente(v => !v)}
  disabled={!esQuedan}
  className={`chip ${entregaPendiente ? 'chip-active' : ''}`}
>
  Pendientes de entrega
</button>
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`

### Task 11.2: Tabla — columnas Tipo y Entrega

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/facturas/FacturasTabla.tsx`

- [ ] **Step 1: Columna Tipo**

Donde se renderizan las columnas, agregar:
```tsx
<td>
  {factura.esQuedan
    ? <span className="badge badge-warn">QUEDAN</span>
    : <span className="badge">{factura.tipoDTE ?? '—'}</span>}
</td>
```

- [ ] **Step 2: Columna Entrega (condicional al filtro)**

Recibir prop `mostrarColumnaEntrega: boolean` desde el padre (true cuando el filtro esQuedan está activo). En su caso:
```tsx
{mostrarColumnaEntrega && (
  <td>
    {factura.fechaEntregaReal
      ? `Entregada el ${formatDate(factura.fechaEntregaReal)}`
      : factura.fechaEntregaFactura
        ? (new Date(factura.fechaEntregaFactura) <= new Date()
            ? <span className="badge badge-warn">Por entregar</span>
            : formatDate(factura.fechaEntregaFactura))
        : '—'}
  </td>
)}
```

- [ ] **Step 3: Header correspondiente**

Agregar `<th>Tipo</th>` y, condicional, `<th>Entrega</th>`.

- [ ] **Step 4: Type-check**

Run: `pnpm tsc --noEmit`

### Task 11.3: Detalle — card QUEDAN + marcar entregada

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/facturas/detalle/*` o `app/(dashboard)/facturas/[id]/page.tsx`

- [ ] **Step 1: Localizar el componente principal del detalle**

```bash
ls /Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/facturas/detalle/
```

- [ ] **Step 2: Agregar card "Entrega QUEDAN" (si esQuedan)**

```tsx
import { useMarcarFacturaEntregada } from '@/hooks/use-facturas';
import { useAuth } from '@/hooks/use-auth';
import { formatDate } from '@/lib/utils';

// dentro del componente:
const { user } = useAuth();
const marcar = useMarcarFacturaEntregada(factura.id);
const [fechaReal, setFechaReal] = useState(new Date().toISOString().slice(0, 10));
const puedeMarcar = user?.rol !== 'VISUALIZADOR' && factura.esQuedan && !factura.fechaEntregaReal;

{factura.esQuedan && (
  <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/10 p-4 mt-4">
    <h3 className="font-semibold mb-2">Entrega de factura QUEDAN</h3>
    <div className="text-sm space-y-1">
      {factura.fechaEntregaFactura && (
        <div><span className="text-zinc-500">Programada:</span> {formatDate(factura.fechaEntregaFactura)}</div>
      )}
      {factura.fechaEntregaReal
        ? <div><span className="text-zinc-500">Entregada:</span> {formatDate(factura.fechaEntregaReal)}</div>
        : puedeMarcar && (
          <div className="mt-2 flex items-end gap-2">
            <div>
              <label className="text-xs text-zinc-500">Fecha</label>
              <input type="date" value={fechaReal} onChange={e => setFechaReal(e.target.value)} className="input-base" />
            </div>
            <button
              onClick={() => marcar.mutate(fechaReal)}
              disabled={marcar.isPending}
              className="btn-primary"
            >
              Marcar como entregada
            </button>
          </div>
        )}
    </div>
  </div>
)}
```

- [ ] **Step 3: Type-check + smoke test**

```bash
pnpm tsc --noEmit
pnpm dev
```
- Listar facturas; activar "Solo QUEDAN"; verificar columna "Entrega" aparece.
- Abrir una factura QUEDAN: ver card; marcar entregada; verificar `fechaEntregaReal` se setea.

- [ ] **Step 4: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add components/facturas/ app/\(dashboard\)/facturas/
git commit -m "feat(facturas): listado y detalle con soporte QUEDAN

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Fase 12 — Frontend: Cliente.manejaQuedan toggle

### Task 12.1: Toggle en form de cliente

**Files:**
- Modify: form de cliente (buscar `components/clientes/` y la página de crear/editar cliente)

- [ ] **Step 1: Localizar el form**

```bash
ls /Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/clientes/
```

- [ ] **Step 2: Agregar toggle en la sección "Facturación"**

```tsx
<label className="flex items-center gap-2 cursor-pointer">
  <input
    type="checkbox"
    {...register('manejaQuedan')}
  />
  <span className="text-sm">Maneja factura QUEDAN</span>
  <span className="text-xs text-zinc-500" title="Pre-marca el flag QUEDAN al generar facturas para este cliente">
    (?)
  </span>
</label>
```

- [ ] **Step 3: Agregar al schema Zod del form**

```typescript
manejaQuedan: z.boolean().default(false),
```

- [ ] **Step 4: Type-check**

Run: `pnpm tsc --noEmit`

- [ ] **Step 5: Smoke test**

- Crear un cliente con `manejaQuedan = true`.
- Aprobar una cotización para ese cliente.
- Abrir modal "Generar factura": verificar que el toggle QUEDAN aparece marcado por default.

- [ ] **Step 6: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add components/clientes/ app/\(dashboard\)/clientes/
git commit -m "feat(clientes): toggle manejaQuedan en form

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Fase 13 — Validación integral

### Task 13.1: Type-check final

- [ ] **Step 1: Backend**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm tsc --noEmit
```
Expected: PASS.

- [ ] **Step 2: Frontend**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit
```
Expected: PASS.

- [ ] **Step 3: Tests backend**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm test
```
Expected: todos pasan, incluido el nuevo `notificarQuedanPorEntregar.test.ts`.

### Task 13.2: Pruebas manuales del checklist del spec

- [ ] **Step 1: Cotización end-to-end**

1. Crear cotización con contacto solicitante existente.
2. Crear cotización agregando contacto solicitante inline.
3. Ítem EQUIPO: unidades disabled en 1, días editable, subtotal correcto.
4. Ítem SERVICIO: días `—`, subtotal correcto.
5. Aprobar con depósito → DepositoGarantia en PENDIENTE; **no** se crea factura.
6. PDF de cotización: datos bancarios a la izquierda, totales a la derecha, sin % depósito, columna DÍAS visible.

- [ ] **Step 2: Depósito**

7. Recibir → RECIBIDO.
8. Devolver completo / parcial / retener completo.
9. Estados terminales no permiten más mutaciones (botones desaparecen).

- [ ] **Step 3: Factura**

10. Generar desde APROBADA: tipo doc + facturar a + venc; toast + redirect.
11. No-QUEDAN: `saldoPendiente = total`.
12. Cliente con `manejaQuedan=true`: modal pre-marca el toggle.
13. QUEDAN con actas no devueltas: banner pero permite continuar.
14. Marcar QUEDAN como entregada: `fechaEntregaReal` se setea.
15. Filtros "Solo QUEDAN" y "Pendientes de entrega" funcionan.

- [ ] **Step 4: Roles**

16. Login como VISUALIZADOR: no ve "Generar factura", "Marcar entregada", ni acciones de depósito.

- [ ] **Step 5: Notificaciones cron**

17. Insertar en BD una factura QUEDAN con `fechaEntregaFactura` en el pasado y `fechaEntregaReal=null`.
18. Reiniciar server (`pnpm dev`); el cron corre al arrancar.
19. Verificar que se crea una `Notificacion` por cada usuario GERENTE/OPERADOR.

### Task 13.3: PR final

- [ ] **Step 1: Push de ramas**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && git push -u origin <branch-backend>
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && git push -u origin <branch-frontend>
```

- [ ] **Step 2: PRs**

Crear un PR por repo siguiendo el patrón de `gh pr create` del CLAUDE.md, con el cuerpo:

```markdown
## Summary
- Cotización: contacto solicitante inline, días por ítem, tipo doc fiscal fuera del borrador.
- PDF cotización: nuevo layout dos columnas; sin % de depósito.
- Depósito: modelo independiente con ciclo recibir/devolver/retener.
- Facturación: emisión manual; soporte QUEDAN con fechas + notificación.

## Test plan
- [ ] `pnpm tsc --noEmit` PASS en ambos repos.
- [ ] `pnpm test` PASS en server.
- [ ] Pruebas manuales del checklist del spec (sección 13.2).
- [ ] VISUALIZADOR no ve botones de escritura.
```

---

## Resumen del orden de ejecución

1. **Fase 1 (3 commits)**: schema + backfill.
2. **Fase 2 (1 commit)**: backend cotizaciones (días + aprobar sin factura).
3. **Fase 3 (1 commit)**: módulo depósitos.
4. **Fase 4 (1 commit)**: facturas (generar + QUEDAN).
5. **Fase 5 (1 commit)**: manejaQuedan + cron QUEDAN.
6. **Fase 6 (1 commit)**: PDF cotización + factura.
7. **Fase 7 (1 commit)**: tipos + hooks frontend.
8. **Fase 8 (1 commit)**: contacto solicitante inline.
9. **Fase 9 (1 commit)**: días en wizard.
10. **Fase 10 (1 commit)**: detalle cotización (depósito + generar factura).
11. **Fase 11 (1 commit)**: facturas listado + detalle.
12. **Fase 12 (1 commit)**: manejaQuedan en cliente.
13. **Fase 13**: validación integral + PR.

Total: ~14 commits, divisible en 2 PRs (backend / frontend).
