# Renovación de renta vinculada al acta de entrega — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la factura de una renovación de renta quede vinculada al acta de entrega original y que el sistema solo pida acta nueva cuando la renovación incluye inventario que no estaba en la cotización original.

**Architecture:** Se marca cada ítem clonado con `CotizacionItem.cotizacionItemOrigenId` (FK self-referencial) para distinguir inventario ya en obra de inventario nuevo. El período de renta se captura en el modal de renovación, se persiste en `Cotizacion.periodoRenta*`, extiende `ActaEntrega.periodoRentaFin` al aprobar y se copia a `Factura.periodoRenta*` al facturar. El vínculo factura↔acta original se deriva de `Cotizacion.actaEntregaOrigen`, que ya existe en el schema.

**Tech Stack:** Backend Express + Prisma + PostgreSQL, tests con Vitest (Prisma mockeado con `vi.mock`, sin BD). Frontend Next.js App Router + React Query + Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-07-20-renovacion-renta-vinculo-acta-design.md`

## Global Constraints

- **Repos:** backend en `/Users/joaquinmorales13a06/Desktop/Reinar/server`, frontend en `/Users/joaquinmorales13a06/Desktop/Reinar/frontend`. Rama en ambos: `feat/renovacion-renta-vinculo-acta`.
- **Migraciones Prisma:** la BD es remota y compartida — `prisma migrate dev` se cuelga. Generar SQL con `prisma migrate diff` offline y aplicar con `prisma migrate deploy`. Nombre de carpeta: `YYYYMMDDHHMMSS_snake_case`.
- **Baseline de verificación:** existen **14 fallos de vitest y 12 de 25 archivos con lint** pre-existentes en el server. El criterio de éxito es **cero fallos nuevos**, no cero fallos. Re-medir el baseline antes de empezar (Task 0).
- **Idioma:** 100 % español en UI, mensajes de error y comentarios. Comentarios solo tipo "why".
- **Tailwind:** solo clases predefinidas, sin valores arbitrarios (`h-[20px]` prohibido).
- **Montos:** `decimal.js`, nunca `parseFloat`.
- **Tests del server:** Prisma se mockea con `vi.mock('../../../src/lib/prisma', ...)`. No hay BD de test. Seguir el patrón de `tests/modules/actas/actas.service.test.ts:4-21`.
- **Toasts:** toda mutation nueva del frontend lleva `toast.success` en `onSuccess` y `toast.error` en `onError`.

---

### Task 0: Medir el baseline de verificación

**Files:**
- Ninguno (solo medición)

**Interfaces:**
- Consumes: nada
- Produces: los números de baseline que las tareas siguientes usan para comparar

- [ ] **Step 1: Medir vitest y lint en el server**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm test 2>&1 | tail -20
pnpm lint 2>&1 | tail -20
```

Anotar el número exacto de tests fallando y de archivos con errores de lint. Esperado según el baseline registrado: ~14 fallos de vitest, 12 de 25 archivos con lint. **Si difiere mucho, detenerse y avisar** — significa que el baseline cambió y hay que re-establecerlo antes de seguir.

- [ ] **Step 2: Verificar tipos en ambos repos**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm tsc --noEmit
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit
```

Expected: PASS en ambos (sin salida). Si falla, el baseline de tipos no está limpio — detenerse y avisar.

---

### Task 1: Migración Prisma — cuatro columnas nuevas

**Files:**
- Modify: `server/prisma/schema.prisma` (models `Cotizacion`, `CotizacionItem`, `ActaEntrega`)
- Create: `server/prisma/migrations/20260720120000_renovacion_vinculo_acta/migration.sql`

**Interfaces:**
- Consumes: nada
- Produces: `Cotizacion.periodoRentaInicio: DateTime?`, `Cotizacion.periodoRentaFin: DateTime?`, `CotizacionItem.cotizacionItemOrigenId: String?` (+ relación `cotizacionItemOrigen` / `renovacionesItem`), `ActaEntrega.periodoRentaFinOriginal: DateTime?`

- [ ] **Step 1: Agregar los campos al schema**

En `server/prisma/schema.prisma`, dentro de `model Cotizacion`, justo después del bloque `actaEntregaOrigen` (línea ~544):

```prisma
  // Período de renta pactado en una renovación. La cotización de renovación no
  // genera acta nueva, así que no hay otro lugar donde capturarlo. En
  // cotizaciones normales queda null y el acta sigue siendo la fuente.
  periodoRentaInicio DateTime?
  periodoRentaFin    DateTime?
```

Dentro de `model CotizacionItem`, antes del bloque `@@index` (línea ~594):

```prisma
  // Renovación: el ítem de la cotización anterior que este clon renueva.
  // null = inventario nuevo, requiere despacho y acta propia.
  cotizacionItemOrigenId String?
  cotizacionItemOrigen   CotizacionItem?  @relation("renovacionItem", fields: [cotizacionItemOrigenId], references: [id])
  renovacionesItem       CotizacionItem[] @relation("renovacionItem")
```

y agregar al bloque de índices:

```prisma
  @@index([cotizacionItemOrigenId])
```

Dentro de `model ActaEntrega`, después de `periodoRentaFin` (línea ~812):

```prisma
  // Fin del período tal como se entregó y firmó. Se congela la primera vez que
  // una renovación extiende el acta, para poder recalcular si esa renovación
  // se anula. periodoRentaInicio nunca se toca: marca cuándo empezó la renta
  // del inventario que hay en obra, y renovar no cambia eso.
  periodoRentaFinOriginal DateTime?
```

- [ ] **Step 2: Generar el SQL offline**

**Comparación schema-contra-schema, sin tocar ninguna base de datos.** No usar `--from-migrations` ni `--shadow-database-url`: esa variante necesita una shadow DB para hacer replay de las migraciones y **le hace reset**, así que apuntarla a `DATABASE_URL` destruiría la BD compartida.

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
mkdir -p prisma/migrations/20260720120000_renovacion_vinculo_acta
git show HEAD:prisma/schema.prisma > /tmp/schema-anterior.prisma
pnpm prisma migrate diff \
  --from-schema-datamodel /tmp/schema-anterior.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/20260720120000_renovacion_vinculo_acta/migration.sql
cat prisma/migrations/20260720120000_renovacion_vinculo_acta/migration.sql
```

Expected: un SQL equivalente a esto (si el comando falla por cualquier motivo, escribir el archivo a mano con exactamente este contenido — no intentar variantes que toquen una BD):

```sql
-- AlterTable
ALTER TABLE "Cotizacion" ADD COLUMN     "periodoRentaInicio" TIMESTAMP(3),
ADD COLUMN     "periodoRentaFin" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CotizacionItem" ADD COLUMN     "cotizacionItemOrigenId" TEXT;

-- AlterTable
ALTER TABLE "ActaEntrega" ADD COLUMN     "periodoRentaFinOriginal" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "CotizacionItem_cotizacionItemOrigenId_idx" ON "CotizacionItem"("cotizacionItemOrigenId");

-- AddForeignKey
ALTER TABLE "CotizacionItem" ADD CONSTRAINT "CotizacionItem_cotizacionItemOrigenId_fkey" FOREIGN KEY ("cotizacionItemOrigenId") REFERENCES "CotizacionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 3: Aplicar la migración y regenerar el cliente**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm prisma migrate deploy
pnpm prisma generate
```

Expected: "1 migration applied" y "Generated Prisma Client".

- [ ] **Step 4: Verificar que los tipos compilan**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add prisma/schema.prisma prisma/migrations/20260720120000_renovacion_vinculo_acta
git commit -m "feat(db): columnas para vincular renovaciones al acta de entrega origen"
```

---

### Task 2: `renovarRenta` captura período, marca ítems y descuenta devoluciones parciales

**Files:**
- Modify: `server/src/modules/actas/actas.schemas.ts:203-208`
- Modify: `server/src/modules/actas/actas.service.ts:1107-1178` (`renovarRenta`)
- Modify: `server/src/modules/actas/actas.controller.ts:185-190` (`renovar`)
- Modify: `server/src/modules/cotizaciones/cotizaciones.service.ts:158-211` (`crearCotizacion`), `:412-456` (`agregarItem`)
- Test: `server/tests/modules/actas/actas.service.test.ts`

**Interfaces:**
- Consumes: columnas de Task 1
- Produces: `renovarRenta(actaId: string, input: RenovarRentaInput, usuarioId: string)` — **cambia la firma**: antes recibía `cotizacionItemIds: string[]` como segundo parámetro, ahora recibe el objeto completo `{ cotizacionItemIds, periodoRentaInicio, periodoRentaFin }`. `crearCotizacion` acepta `periodoRentaInicio?: string` y `periodoRentaFin?: string`. `agregarItem` acepta `cotizacionItemOrigenId?: string`.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `server/tests/modules/actas/actas.service.test.ts`. Primero extender el mock de Prisma del encabezado (línea 4-21) para que `cotizacionItem` tenga `findUnique` y `actaEntregaItem` tenga lo necesario — reemplazar esas dos líneas por:

```typescript
    actaEntregaItem:   { findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
    cotizacionItem:    { findMany: vi.fn(), findUnique: vi.fn() },
```

y agregar el mock del servicio de cotizaciones junto a los otros `vi.mock` (después de la línea 38):

```typescript
vi.mock('../../../src/modules/cotizaciones/cotizaciones.service', () => ({
  crearCotizacion:    vi.fn(),
  agregarItem:        vi.fn(),
  obtenerCotizacion:  vi.fn(),
}))
```

y su import junto a los otros (después de la línea 42):

```typescript
import * as cotizacionesService from '../../../src/modules/cotizaciones/cotizaciones.service'
```

Ahora los tests:

```typescript
// ── renovarRenta ─────────────────────────────────────────────────────────────

describe('renovarRenta', () => {
  const ACTA_ID = 'clhacta00000000000000001'
  const NUEVA_COT_ID = 'clhcotnueva000000000001'

  function mockActaBase(items: any[]) {
    mockPrisma.actaEntrega.findUnique.mockResolvedValue({
      id:         ACTA_ID,
      estado:     'ENTREGADO',
      periodoRentaFin: new Date('2026-06-30T00:00:00.000Z'),
      cotizacion: { id: COT_ID, clienteId: 'cli-1', proyectoId: null, porcentajeIva: 13, exentoIva: false },
      items,
    } as any)
    vi.mocked(cotizacionesService.crearCotizacion).mockResolvedValue({ id: NUEVA_COT_ID } as any)
    vi.mocked(cotizacionesService.obtenerCotizacion).mockResolvedValue({ id: NUEVA_COT_ID } as any)
    mockPrisma.auditLog.create.mockResolvedValue({} as any)
  }

  const INPUT = {
    cotizacionItemIds:  ['ci-1'],
    periodoRentaInicio: '2026-07-01',
    periodoRentaFin:    '2026-07-31',
  }

  it('persiste el período de renta en la cotización nueva', async () => {
    mockActaBase([{ cotizacionItemId: 'ci-1', piezaTipoId: null, herramientaUnidadId: null, equipoId: 'eq-1', cantidadRecibida: null, recepcionItems: [] }])
    mockPrisma.cotizacionItem.findMany.mockResolvedValue([
      { id: 'ci-1', tipo: 'EQUIPO', equipoId: 'eq-1', herramientaTipoId: null, piezaTipoId: null,
        cantidadUnidades: 1, cantidadDias: 30, periodo: 'MES', periodoCustomLabel: null,
        tarifaCustom: null, esTarifaCustom: false, descripcion: 'Compactadora' },
    ] as any)

    await service.renovarRenta(ACTA_ID, INPUT, 'user-1')

    expect(cotizacionesService.crearCotizacion).toHaveBeenCalledWith(
      expect.objectContaining({
        actaEntregaOrigenId: ACTA_ID,
        periodoRentaInicio:  '2026-07-01',
        periodoRentaFin:     '2026-07-31',
      }),
      'user-1',
    )
  })

  it('marca cada ítem clonado con cotizacionItemOrigenId', async () => {
    mockActaBase([{ cotizacionItemId: 'ci-1', piezaTipoId: null, herramientaUnidadId: null, equipoId: 'eq-1', cantidadRecibida: null, recepcionItems: [] }])
    mockPrisma.cotizacionItem.findMany.mockResolvedValue([
      { id: 'ci-1', tipo: 'EQUIPO', equipoId: 'eq-1', herramientaTipoId: null, piezaTipoId: null,
        cantidadUnidades: 1, cantidadDias: 30, periodo: 'MES', periodoCustomLabel: null,
        tarifaCustom: null, esTarifaCustom: false, descripcion: 'Compactadora' },
    ] as any)

    await service.renovarRenta(ACTA_ID, INPUT, 'user-1')

    expect(cotizacionesService.agregarItem).toHaveBeenCalledWith(
      NUEVA_COT_ID,
      expect.objectContaining({ cotizacionItemOrigenId: 'ci-1' }),
      'user-1',
    )
  })

  it('descuenta devoluciones parciales de piezas al calcular la cantidad', async () => {
    // 20 crucetas entregadas, 5 devueltas → renueva 15.
    mockActaBase([
      { cotizacionItemId: 'ci-p', piezaTipoId: 'pz-1', herramientaUnidadId: null, equipoId: null,
        cantidadRecibida: 20, recepcionItems: [{ cantidadDevuelta: 3 }, { cantidadDevuelta: 2 }] },
    ])
    mockPrisma.cotizacionItem.findMany.mockResolvedValue([
      { id: 'ci-p', tipo: 'PIEZA_ANDAMIO', equipoId: null, herramientaTipoId: null, piezaTipoId: 'pz-1',
        cantidadUnidades: 20, cantidadDias: 30, periodo: 'MES', periodoCustomLabel: null,
        tarifaCustom: null, esTarifaCustom: false, descripcion: 'Cruceta' },
    ] as any)

    await service.renovarRenta(ACTA_ID, { ...INPUT, cotizacionItemIds: ['ci-p'] }, 'user-1')

    expect(cotizacionesService.agregarItem).toHaveBeenCalledWith(
      NUEVA_COT_ID,
      expect.objectContaining({ piezaTipoId: 'pz-1', cantidadUnidades: 15 }),
      'user-1',
    )
  })

  it('cuenta unidades pendientes para herramientas', async () => {
    // 3 unidades despachadas, 1 ya devuelta (no aparece como PENDIENTE) → renueva 2.
    mockActaBase([
      { cotizacionItemId: 'ci-h', piezaTipoId: null, herramientaUnidadId: 'hu-1', equipoId: null, cantidadRecibida: null, recepcionItems: [] },
      { cotizacionItemId: 'ci-h', piezaTipoId: null, herramientaUnidadId: 'hu-2', equipoId: null, cantidadRecibida: null, recepcionItems: [] },
    ])
    mockPrisma.cotizacionItem.findMany.mockResolvedValue([
      { id: 'ci-h', tipo: 'HERRAMIENTA', equipoId: null, herramientaTipoId: 'ht-1', piezaTipoId: null,
        cantidadUnidades: 3, cantidadDias: 30, periodo: 'MES', periodoCustomLabel: null,
        tarifaCustom: null, esTarifaCustom: false, descripcion: 'Andamio' },
    ] as any)

    await service.renovarRenta(ACTA_ID, { ...INPUT, cotizacionItemIds: ['ci-h'] }, 'user-1')

    expect(cotizacionesService.agregarItem).toHaveBeenCalledWith(
      NUEVA_COT_ID,
      expect.objectContaining({ herramientaTipoId: 'ht-1', cantidadUnidades: 2 }),
      'user-1',
    )
  })

  it('omite ítems cuya cantidad renovable es 0', async () => {
    mockActaBase([
      { cotizacionItemId: 'ci-p', piezaTipoId: 'pz-1', herramientaUnidadId: null, equipoId: null,
        cantidadRecibida: 10, recepcionItems: [{ cantidadDevuelta: 10 }] },
    ])
    mockPrisma.cotizacionItem.findMany.mockResolvedValue([
      { id: 'ci-p', tipo: 'PIEZA_ANDAMIO', equipoId: null, herramientaTipoId: null, piezaTipoId: 'pz-1',
        cantidadUnidades: 10, cantidadDias: 30, periodo: 'MES', periodoCustomLabel: null,
        tarifaCustom: null, esTarifaCustom: false, descripcion: 'Cruceta' },
    ] as any)

    await expect(service.renovarRenta(ACTA_ID, { ...INPUT, cotizacionItemIds: ['ci-p'] }, 'user-1'))
      .rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' })
    expect(cotizacionesService.agregarItem).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm vitest run tests/modules/actas/actas.service.test.ts -t "renovarRenta"
```

Expected: FAIL — los 5 tests fallan (la firma actual recibe `string[]`, no el objeto).

- [ ] **Step 3: Extender el schema Zod**

En `server/src/modules/actas/actas.schemas.ts`, reemplazar el bloque `:205-208`:

```typescript
export const renovarRentaSchema = z.object({
  cotizacionItemIds:  z.array(z.string().cuid()).min(1, 'Seleccioná al menos un ítem para renovar'),
  periodoRentaInicio: z.string().date('Fecha de inicio inválida'),
  periodoRentaFin:    z.string().date('Fecha de fin inválida'),
}).refine((d) => d.periodoRentaInicio <= d.periodoRentaFin, {
  message: 'La fecha de inicio debe ser anterior o igual al fin',
  path:    ['periodoRentaFin'],
})
export type RenovarRentaInput = z.infer<typeof renovarRentaSchema>
```

- [ ] **Step 4: Aceptar el período en `crearCotizacion`**

En `server/src/modules/cotizaciones/cotizaciones.service.ts`, agregar al tipo del parámetro `data` (después de `actaEntregaOrigenId?: string`, línea 165):

```typescript
    periodoRentaInicio?: string
    periodoRentaFin?: string
```

y al `tx.cotizacion.create` (después de `actaEntregaOrigenId`, línea 202):

```typescript
        periodoRentaInicio:    data.periodoRentaInicio ? new Date(data.periodoRentaInicio) : undefined,
        periodoRentaFin:       data.periodoRentaFin    ? new Date(data.periodoRentaFin)    : undefined,
```

- [ ] **Step 5: Aceptar la marca en `agregarItem`**

En el mismo archivo, agregar `cotizacionItemOrigenId` al `itemBase` (después de `orden`, línea 449):

```typescript
      cotizacionItemOrigenId: ('cotizacionItemOrigenId' in data ? data.cotizacionItemOrigenId : undefined),
```

y agregar el campo al tipo del parámetro `data` de `agregarItem` (unión de tipos por `tipo`; agregarlo como campo común opcional):

```typescript
    cotizacionItemOrigenId?: string
```

- [ ] **Step 6: Reescribir `renovarRenta`**

Reemplazar `server/src/modules/actas/actas.service.ts:1107-1178` completo:

```typescript
// Cantidad todavía en obra de un CotizacionItem, según sus ActaEntregaItem
// pendientes. Piezas: cantidadRecibida menos lo ya devuelto (devolución parcial
// acumulativa). Herramientas: una unidad por ActaEntregaItem pendiente.
// Equipos: siempre 1 (unidad física única).
function cantidadEnObra(
  tipo: string,
  itemsDelCotizacionItem: Array<{ cantidadRecibida: number | null; recepcionItems: Array<{ cantidadDevuelta: number | null }> }>,
): number {
  if (tipo === 'EQUIPO') return 1
  if (tipo === 'HERRAMIENTA') return itemsDelCotizacionItem.length
  // PIEZA_ANDAMIO
  return itemsDelCotizacionItem.reduce((acc, ai) => {
    const devuelto = ai.recepcionItems.reduce((s, r) => s + (r.cantidadDevuelta ?? 0), 0)
    return acc + Math.max(0, (ai.cantidadRecibida ?? 0) - devuelto)
  }, 0)
}

// Renovación de renta: clona los ítems rentables seleccionados (que siguen en
// obra, PENDIENTE_DEVOLUCION) en una nueva cotización BORRADOR vinculada al acta
// original. No crea acta nueva: el inventario lo sigue rastreando el acta inicial.
// Cada clon guarda cotizacionItemOrigenId para que el resto del sistema sepa que
// ese inventario ya está despachado y no lo vuelva a pedir en un acta.
export async function renovarRenta(actaId: string, input: RenovarRentaInput, usuarioId: string) {
  const { cotizacionItemIds, periodoRentaInicio, periodoRentaFin } = input

  const acta = await prisma.actaEntrega.findUnique({
    where:  { id: actaId },
    select: {
      id: true,
      estado: true,
      // El acta ancla en la cotización (no en la factura, que puede ser null en el
      // flujo Cotización→Acta→Factura) — se consulta directo.
      cotizacion: { select: { id: true, clienteId: true, proyectoId: true, porcentajeIva: true, exentoIva: true } },
      items:      {
        where:  { estado: 'PENDIENTE_DEVOLUCION' },
        select: {
          cotizacionItemId: true,
          cantidadRecibida: true,
          recepcionItems:   { select: { cantidadDevuelta: true } },
        },
      },
    },
  })
  if (!acta) throw new AppError(404, 'NOT_FOUND', 'Acta no encontrada')
  if (acta.estado !== 'ENTREGADO' && acta.estado !== 'DEVUELTA_PARCIAL') {
    throw new AppError(422, 'ESTADO_INVALIDO', 'Solo se puede renovar desde un acta entregada (no devuelta del todo)')
  }

  const idsPendientes = new Set(acta.items.map((i) => i.cotizacionItemId))
  for (const itemId of cotizacionItemIds) {
    if (!idsPendientes.has(itemId)) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Uno o más ítems no están pendientes de devolución en esta acta')
    }
  }

  // Agrupa los ActaEntregaItem por CotizacionItem para calcular cuánto queda en obra.
  const porCotizacionItem = new Map<string, typeof acta.items>()
  for (const ai of acta.items) {
    const lista = porCotizacionItem.get(ai.cotizacionItemId) ?? []
    lista.push(ai)
    porCotizacionItem.set(ai.cotizacionItemId, lista)
  }

  // Items originales a clonar (solo rentables).
  const originales = await prisma.cotizacionItem.findMany({
    where:  { id: { in: cotizacionItemIds } },
    select: {
      id: true, tipo: true, equipoId: true, herramientaTipoId: true, piezaTipoId: true,
      cantidadUnidades: true, cantidadDias: true, periodo: true, periodoCustomLabel: true,
      tarifaCustom: true, esTarifaCustom: true, descripcion: true,
    },
  })
  // La cantidad renovable sale de lo que sigue en obra, no de la cotización
  // original: si hubo devolución parcial, renovar la cantidad original
  // sobre-factura al cliente.
  const clonables = originales
    .filter((o) => TIPOS_RENTABLES.has(o.tipo))
    .map((o) => ({ ...o, cantidadRenovable: cantidadEnObra(o.tipo, porCotizacionItem.get(o.id) ?? []) }))
    .filter((o) => o.cantidadRenovable > 0)

  if (clonables.length === 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'No hay ítems rentables con inventario en obra para renovar')
  }

  const cotOrig = acta.cotizacion
  const nueva = await cotizacionesService.crearCotizacion({
    clienteId:           cotOrig.clienteId,
    proyectoId:          cotOrig.proyectoId ?? undefined,
    porcentajeIva:       Number(cotOrig.porcentajeIva),
    exentoIva:           cotOrig.exentoIva,
    actaEntregaOrigenId: acta.id,
    periodoRentaInicio,
    periodoRentaFin,
  }, usuarioId)

  // Clona cada ítem reutilizando agregarItem (recalcula tarifas/subtotales).
  // Si el original tenía tarifa custom, se preserva; si no, se recalcula del catálogo.
  for (const o of clonables) {
    const tarifaCustom = o.esTarifaCustom && o.tarifaCustom ? o.tarifaCustom.toString() : undefined
    const comun = {
      cantidadDias:           o.cantidadDias,
      periodo:                o.periodo,
      periodoCustomLabel:     o.periodoCustomLabel ?? undefined,
      tarifaCustom,
      descripcion:            o.descripcion,
      orden:                  0,
      cotizacionItemOrigenId: o.id,
    }
    if (o.tipo === 'EQUIPO' && o.equipoId) {
      await cotizacionesService.agregarItem(nueva.id, { tipo: 'EQUIPO', equipoId: o.equipoId, cantidadUnidades: 1, ...comun }, usuarioId)
    } else if (o.tipo === 'HERRAMIENTA' && o.herramientaTipoId) {
      await cotizacionesService.agregarItem(nueva.id, { tipo: 'HERRAMIENTA', herramientaTipoId: o.herramientaTipoId, cantidadUnidades: o.cantidadRenovable, ...comun }, usuarioId)
    } else if (o.tipo === 'PIEZA_ANDAMIO' && o.piezaTipoId) {
      await cotizacionesService.agregarItem(nueva.id, { tipo: 'PIEZA_ANDAMIO', piezaTipoId: o.piezaTipoId, cantidadUnidades: o.cantidadRenovable, ...comun }, usuarioId)
    }
  }

  await prisma.auditLog.create({
    data: {
      usuarioId,
      entidad: 'Cotizacion',
      entidadId: nueva.id,
      accion: 'RENOVAR_RENTA',
      camposDespues: { actaEntregaOrigenId: acta.id, items: cotizacionItemIds, periodoRentaInicio, periodoRentaFin } as Prisma.InputJsonValue,
    },
  })

  return cotizacionesService.obtenerCotizacion(nueva.id)
}
```

Agregar `RenovarRentaInput` al import de schemas al tope del archivo si no está.

- [ ] **Step 7: Actualizar el controller**

En `server/src/modules/actas/actas.controller.ts:185-190`, cambiar la llamada:

```typescript
    const cotizacion = await service.renovarRenta(req.params.id as string, req.body, req.user!.sub)
```

- [ ] **Step 8: Correr los tests**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm vitest run tests/modules/actas/actas.service.test.ts -t "renovarRenta"
pnpm tsc --noEmit
```

Expected: los 5 tests PASS, tsc sin errores.

- [ ] **Step 9: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/modules/actas/actas.schemas.ts src/modules/actas/actas.service.ts src/modules/actas/actas.controller.ts src/modules/cotizaciones/cotizaciones.service.ts tests/modules/actas/actas.service.test.ts
git commit -m "feat(actas): renovarRenta captura período, marca ítems origen y descuenta devoluciones parciales"
```

---

### Task 2b: Devolución parcial de piezas de andamio en `registrarRecepcion`

**Por qué existe esta tarea:** se agregó durante la ejecución, tras el review de Task 2. El spec asumía que las devoluciones parciales de piezas se acumulaban en `ActaRecepcionItem.cantidadDevuelta`, pero eso **solo vale para consumibles**. Hoy cualquier recepción de piezas cae en la rama `else` de `actas.service.ts:924-926` (`{ devuelta: null, cerrarItem: true }`), lo que cierra el ítem completo y restaura **toda** `cantidadRecibida` al stock (`:989-998`) sin importar cuánto volvió físicamente. Consecuencias: (a) devolver 5 de 20 crucetas infla el stock en 15 piezas que siguen en obra, y (b) el `cantidadEnObra` de Task 2 opera sobre un estado inalcanzable, así que la renovación de andamios no puede descontar devoluciones. El schema Zod ya acepta `cantidadDevuelta` y `cerrar` para cualquier ítem (`actas.schemas.ts:143-155`) — la restricción es puramente del servicio.

**Files:**
- Modify: `server/src/modules/actas/actas.service.ts:904-927` (plan por ítem), `:989-998` (restauración de stock de piezas)
- Modify: `server/src/modules/actas/actas.schemas.ts:149-153` (comentario)
- Modify: `server/prisma/schema.prisma:908-910` (comentario — no genera migración)
- Test: `server/tests/modules/actas/actas.service.test.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores
- Produces: `registrarRecepcion` acepta devoluciones parciales de `PIEZA_ANDAMIO`; el `ActaEntregaItem` queda `PENDIENTE_DEVOLUCION` con `cantidadDevuelta` acumulada hasta completar. Esto vuelve alcanzable el input que `cantidadEnObra` (Task 2) ya sabe procesar.

**Semántica de `cerrar` en piezas:** para consumibles, `cerrar: true` con `devuelta < pendiente` significa "el remanente se consumió". Una pieza no se consume: cerrar con remanente significa que esas piezas **no van a volver** (pérdida o daño), así que no se restauran al stock. El comportamiento del código es el mismo; lo que cambia es qué documenta el comentario.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `server/tests/modules/actas/actas.service.test.ts`, dentro del `describe('registrarRecepcion')` existente (`:177`):

```typescript
  it('devuelve piezas parcialmente: el ítem sigue abierto y solo se restaura lo devuelto', async () => {
    const item = {
      id: 'aei-p', piezaTipoId: 'pz-1', cantidadRecibida: 20,
      equipoId: null, herramientaUnidadId: null, consumibleId: null, cantidadConsumible: null,
      actaEntrega: { id: 'acta-1', bodegaOrigenId: 'bod-1', cotizacionId: COT_ID, facturaId: null },
    }
    mockRecepcionBase([item])
    mockPrisma.actaRecepcionItem.aggregate.mockResolvedValue({ _sum: { cantidadDevuelta: 0 } } as any)

    await service.registrarRecepcion(COT_ID, null, {
      items: [{ actaEntregaItemId: 'aei-p', cantidadDevuelta: 5 }],
    } as any, 'user-1')

    // No se cierra: quedan 15 en obra.
    expect(mockPrisma.actaEntregaItem.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { estado: 'DEVUELTO' } }),
    )
    // Solo vuelven 5 al stock, no las 20 despachadas.
    expect(mockPrisma.piezaTipo.update).toHaveBeenCalledWith({
      where: { id: 'pz-1' },
      data:  { stockActual: { increment: 5 } },
    })
  })

  it('cierra la pieza cuando la devolución acumulada completa lo despachado', async () => {
    const item = {
      id: 'aei-p', piezaTipoId: 'pz-1', cantidadRecibida: 20,
      equipoId: null, herramientaUnidadId: null, consumibleId: null, cantidadConsumible: null,
      actaEntrega: { id: 'acta-1', bodegaOrigenId: 'bod-1', cotizacionId: COT_ID, facturaId: null },
    }
    mockRecepcionBase([item])
    // Ya se devolvieron 5 en una recepción anterior.
    mockPrisma.actaRecepcionItem.aggregate.mockResolvedValue({ _sum: { cantidadDevuelta: 5 } } as any)

    await service.registrarRecepcion(COT_ID, null, {
      items: [{ actaEntregaItemId: 'aei-p', cantidadDevuelta: 15 }],
    } as any, 'user-1')

    expect(mockPrisma.actaEntregaItem.update).toHaveBeenCalledWith({
      where: { id: 'aei-p' }, data: { estado: 'DEVUELTO' },
    })
    expect(mockPrisma.piezaTipo.update).toHaveBeenCalledWith({
      where: { id: 'pz-1' }, data: { stockActual: { increment: 15 } },
    })
  })

  it('rechaza devolver más piezas de las pendientes', async () => {
    const item = {
      id: 'aei-p', piezaTipoId: 'pz-1', cantidadRecibida: 20,
      equipoId: null, herramientaUnidadId: null, consumibleId: null, cantidadConsumible: null,
      actaEntrega: { id: 'acta-1', bodegaOrigenId: 'bod-1', cotizacionId: COT_ID, facturaId: null },
    }
    mockRecepcionBase([item])
    mockPrisma.actaRecepcionItem.aggregate.mockResolvedValue({ _sum: { cantidadDevuelta: 5 } } as any)

    await expect(service.registrarRecepcion(COT_ID, null, {
      items: [{ actaEntregaItemId: 'aei-p', cantidadDevuelta: 16 }],
    } as any, 'user-1')).rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' })
  })

  it('cerrar con remanente da las piezas por no retornadas: no se restauran al stock', async () => {
    const item = {
      id: 'aei-p', piezaTipoId: 'pz-1', cantidadRecibida: 20,
      equipoId: null, herramientaUnidadId: null, consumibleId: null, cantidadConsumible: null,
      actaEntrega: { id: 'acta-1', bodegaOrigenId: 'bod-1', cotizacionId: COT_ID, facturaId: null },
    }
    mockRecepcionBase([item])
    mockPrisma.actaRecepcionItem.aggregate.mockResolvedValue({ _sum: { cantidadDevuelta: 0 } } as any)

    await service.registrarRecepcion(COT_ID, null, {
      items: [{ actaEntregaItemId: 'aei-p', cantidadDevuelta: 5, cerrar: true }],
    } as any, 'user-1')

    expect(mockPrisma.actaEntregaItem.update).toHaveBeenCalledWith({
      where: { id: 'aei-p' }, data: { estado: 'DEVUELTO' },
    })
    expect(mockPrisma.piezaTipo.update).toHaveBeenCalledWith({
      where: { id: 'pz-1' }, data: { stockActual: { increment: 5 } },
    })
  })

  it('equipos y unidades de herramienta siguen cerrando en una sola recepción', async () => {
    const item = {
      id: 'aei-e', equipoId: 'eq-1', piezaTipoId: null, cantidadRecibida: null,
      herramientaUnidadId: null, consumibleId: null, cantidadConsumible: null,
      actaEntrega: { id: 'acta-1', bodegaOrigenId: 'bod-1', cotizacionId: COT_ID, facturaId: null },
    }
    mockRecepcionBase([item])

    await service.registrarRecepcion(COT_ID, null, {
      items: [{ actaEntregaItemId: 'aei-e' }],
    } as any, 'user-1')

    expect(mockPrisma.actaEntregaItem.update).toHaveBeenCalledWith({
      where: { id: 'aei-e' }, data: { estado: 'DEVUELTO' },
    })
    expect(mockPrisma.equipo.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'eq-1' } }),
    )
  })
```

`mockRecepcionBase(items)` es un helper a escribir siguiendo el patrón de los tests existentes de `registrarRecepcion` en ese `describe` — debe montar `actaEntregaItem.findMany` con los ítems, `$transaction` pasando `mockPrisma`, `generarNumero`, y los mocks de `actaRecepcion.create` / `actaRecepcionItem.createMany`. Reutilizar el setup que ya usan los tests vecinos en vez de inventar uno nuevo. Agregar `aggregate: vi.fn()` al mock de `actaRecepcionItem` en el encabezado del archivo si no está.

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm vitest run tests/modules/actas/actas.service.test.ts -t "piezas"
```

Expected: FAIL — hoy las piezas siempre cierran y restauran `cantidadRecibida` completo.

- [ ] **Step 3: Generalizar el plan por ítem**

En `server/src/modules/actas/actas.service.ts`, reemplazar el bloque `:904-927`:

```typescript
    // Plan por item: cuanto se devuelve y si se cierra. Consumibles y piezas de
    // andamio se devuelven por cantidad, así que admiten devolución parcial
    // acumulativa (varias recepciones sobre el mismo ítem). Equipos y unidades
    // de herramienta son indivisibles: se cierran en una sola recepción total.
    const plan = new Map<string, { devuelta: number | null; cerrarItem: boolean }>()
    for (const item of items) {
      const retorno = retornoMap.get(item.id)!
      const totalDespachado =
        item.consumibleId && item.cantidadConsumible != null ? item.cantidadConsumible
        : item.piezaTipoId && item.cantidadRecibida != null  ? item.cantidadRecibida
        : null
      if (totalDespachado != null) {
        const prev = await tx.actaRecepcionItem.aggregate({
          where: { actaEntregaItemId: item.id },
          _sum:  { cantidadDevuelta: true },
        })
        const yaDevuelto = prev._sum.cantidadDevuelta ?? 0
        const pendiente  = totalDespachado - yaDevuelto
        const devuelta   = retorno.cantidadDevuelta ?? pendiente
        if (devuelta > pendiente) {
          throw new AppError(422, 'VALIDATION_ERROR', `La cantidad devuelta (${devuelta}) excede lo pendiente (${pendiente})`)
        }
        // Cierra si se cubrió todo el pendiente, o si se marca cerrar: en
        // consumibles el remanente se dio por consumido, en piezas por no retornado.
        const cerrarItem = retorno.cerrar === true || devuelta === pendiente
        plan.set(item.id, { devuelta, cerrarItem })
      } else {
        plan.set(item.id, { devuelta: null, cerrarItem: true })
      }
    }
```

- [ ] **Step 4: Restaurar al stock solo lo devuelto**

Reemplazar la rama de piezas de `:989-998`:

```typescript
      } else if (item.piezaTipoId && devuelta != null && devuelta > 0) {
        // Solo vuelve al stock lo realmente devuelto: las piezas que siguen en
        // obra (o que se dieron por no retornadas) no están en bodega.
        await tx.stockBodega.upsert({
          where:  { piezaTipoId_bodegaId: { piezaTipoId: item.piezaTipoId, bodegaId: bodegaDestinoId } },
          create: { piezaTipoId: item.piezaTipoId, bodegaId: bodegaDestinoId, cantidad: devuelta },
          update: { cantidad: { increment: devuelta } },
        })
        await tx.piezaTipo.update({
          where: { id: item.piezaTipoId },
          data:  { stockActual: { increment: devuelta } },
        })
      }
```

- [ ] **Step 5: Actualizar los comentarios que documentaban la limitación**

En `server/src/modules/actas/actas.schemas.ts:149-153`:

```typescript
  // Devolución parcial de consumibles y piezas de andamio: cantidad realmente
  // devuelta en esta recepción. Si se omite, se devuelve el pendiente completo.
  // 0 = no devuelve nada cuando se combina con cerrar. `cerrar` cierra el ítem
  // dando el remanente por consumido (consumibles) o por no retornado (piezas).
```

En `server/prisma/schema.prisma`, el comentario de `ActaRecepcionItem.cantidadDevuelta` (`:908-910`):

```prisma
  // Cantidad realmente devuelta en esta recepcion (consumibles y piezas de
  // andamio). null para equipos/unidades de herramienta, que son indivisibles
  // y se reciben de una sola vez. Permite devolucion parcial acumulativa:
  // varias ActaRecepcionItem por ActaEntregaItem.
```

Verificar con `pnpm prisma migrate status` que cambiar un comentario no generó drift (no debería: los comentarios `//` de Prisma no son parte del DDL).

- [ ] **Step 6: Correr los tests**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm vitest run tests/modules/actas/actas.service.test.ts
pnpm tsc --noEmit
```

Expected: los 5 tests nuevos PASS, los tests de `registrarRecepcion` y `renovarRenta` existentes siguen en verde, sin fallos nuevos respecto al baseline.

- [ ] **Step 7: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/modules/actas/actas.service.ts src/modules/actas/actas.schemas.ts prisma/schema.prisma tests/modules/actas/actas.service.test.ts
git commit -m "fix(actas): devolución parcial de piezas de andamio — el stock solo recupera lo que volvió"
```

---

### Task 3: Excluir ítems renovados del despacho

**Files:**
- Modify: `server/src/modules/actas/actas.service.ts:40-121` (`listarItemsDisponiblesDespacho`), `:325-334` (`crearActa`)
- Test: `server/tests/modules/actas/actas.service.test.ts`

**Interfaces:**
- Consumes: `CotizacionItem.cotizacionItemOrigenId` (Task 1)
- Produces: `listarItemsDisponiblesDespacho` deja de devolver ítems renovados; `crearActa` lanza `AppError(422, 'ITEM_YA_EN_OBRA', ...)`

- [ ] **Step 1: Escribir los tests que fallan**

Agregar dentro del `describe('listarItemsDisponiblesDespacho')` existente (`tests/modules/actas/actas.service.test.ts:57`):

```typescript
  it('excluye ítems renovados: solo devuelve inventario nuevo', async () => {
    mockPrisma.cotizacion.findUnique.mockResolvedValue({ id: COT_ID } as any)
    mockPrisma.actaEntregaItem.findMany.mockResolvedValue([] as any)
    // El where del query ya filtra cotizacionItemOrigenId: null — verificamos
    // que se pida así, porque es lo que evita el doble descuento de stock.
    mockPrisma.cotizacionItem.findMany.mockResolvedValue([
      { id: 'ci-nuevo', piezaTipoId: 'pz-1', equipoId: null, equipo: null, herramientaTipo: null, consumible: null, piezaTipo: { id: 'pz-1', nombre: 'Cruceta' } },
    ] as any)

    const res = await service.listarItemsDisponiblesDespacho(COT_ID)

    expect(mockPrisma.cotizacionItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ cotizacionItemOrigenId: null }),
      }),
    )
    expect(res).toHaveLength(1)
  })
```

y un `describe` nuevo al final del archivo:

```typescript
describe('crearActa — guard de ítems ya en obra', () => {
  it('rechaza despachar un ítem renovado', async () => {
    mockPrisma.cotizacion.findUnique.mockResolvedValue({
      id: COT_ID, estado: 'APROBADA', factura: null,
    } as any)
    mockPrisma.bodega.findUnique.mockResolvedValue({
      id: 'bod-1', activa: true, parentId: null, tipo: 'PRINCIPAL',
    } as any)
    mockPrisma.cotizacionItem.findMany.mockResolvedValue([
      { id: 'ci-renovado', cotizacionItemOrigenId: 'ci-orig' },
    ] as any)

    await expect(service.crearActa(COT_ID, null, {
      bodegaOrigenId: 'bod-1',
      items: [{ cotizacionItemId: 'ci-renovado' }],
    } as any, 'user-1')).rejects.toMatchObject({ statusCode: 422, code: 'ITEM_YA_EN_OBRA' })
  })
})
```

- [ ] **Step 2: Correr para verificar que fallan**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm vitest run tests/modules/actas/actas.service.test.ts -t "renovados"
pnpm vitest run tests/modules/actas/actas.service.test.ts -t "ya en obra"
```

Expected: FAIL.

- [ ] **Step 3: Filtrar en `listarItemsDisponiblesDespacho`**

En `server/src/modules/actas/actas.service.ts`, dentro del `where` de `todosLosItems` (línea 59-67), agregar el filtro y actualizar el comentario de arriba:

```typescript
  // Solo items físicos (equipo/herramienta/consumible/pieza) son despachables.
  // Excluimos servicios y cualquier otro tipo que no sea inventario físico.
  // Los ítems renovados (cotizacionItemOrigenId != null) ya están en obra bajo
  // el acta original: despacharlos de nuevo descontaría stock que nunca volvió.
  const todosLosItems = await prisma.cotizacionItem.findMany({
    where: {
      cotizacionId,
      cotizacionItemOrigenId: null,
      OR: [
        { equipoId:          { not: null } },
        { herramientaTipoId: { not: null } },
        { consumibleId:      { not: null } },
        { piezaTipoId:       { not: null } },
      ],
    },
```

- [ ] **Step 4: Agregar el guard en `crearActa`**

En `server/src/modules/actas/actas.service.ts`, justo antes del chequeo de exclusividad de `:325-334`, agregar:

```typescript
  // Defensa en profundidad: la UI no ofrece ítems renovados, pero la API no
  // puede confiar en eso. Despacharlos descontaría stock que sigue en obra.
  const renovadosSolicitados = await prisma.cotizacionItem.findMany({
    where:  { id: { in: input.items.map((i) => i.cotizacionItemId) }, cotizacionItemOrigenId: { not: null } },
    select: { id: true },
  })
  if (renovadosSolicitados.length > 0) {
    throw new AppError(
      422,
      'ITEM_YA_EN_OBRA',
      'Uno o más ítems son una renovación: ese inventario ya está entregado bajo el acta original y no requiere acta nueva.',
    )
  }
```

- [ ] **Step 5: Correr los tests**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm vitest run tests/modules/actas/actas.service.test.ts
pnpm tsc --noEmit
```

Expected: PASS (todos los tests del archivo, sin fallos nuevos respecto al baseline).

- [ ] **Step 6: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/modules/actas/actas.service.ts tests/modules/actas/actas.service.test.ts
git commit -m "fix(actas): excluir ítems renovados del despacho — evita doble descuento de stock"
```

---

### Task 4: Aprobación — gate por ítem y extensión del acta

**Files:**
- Modify: `server/src/modules/cotizaciones/cotizaciones.service.ts:788-940` (`cambiarEstado`, rama `APROBADA`)
- Test: `server/tests/modules/cotizaciones/cotizaciones.service.test.ts`

**Interfaces:**
- Consumes: `CotizacionItem.cotizacionItemOrigenId`, `ActaEntrega.periodoRentaFinOriginal`, `Cotizacion.periodoRentaFin` (Task 1)
- Produces: al aprobar una renovación, `ActaEntrega.periodoRentaFin` extendido y `periodoRentaFinOriginal` congelado

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `server/tests/modules/cotizaciones/cotizaciones.service.test.ts`. Revisar primero el encabezado del archivo para reutilizar su mock de Prisma; si `actaEntrega` no está en el mock, agregarlo con `{ findUnique: vi.fn(), update: vi.fn() }`.

```typescript
describe('cambiarEstado APROBADA — renovaciones', () => {
  const ACTA_ID = 'clhacta00000000000000001'

  it('extiende periodoRentaFin del acta y congela el original la primera vez', async () => {
    const acta = { id: ACTA_ID, periodoRentaFin: new Date('2026-06-30T00:00:00.000Z'), periodoRentaFinOriginal: null }
    const tx = crearTxMock({ actaEntrega: acta })

    await aplicarExtensionActa(tx as any, {
      actaEntregaOrigenId: ACTA_ID,
      periodoRentaFin:     new Date('2026-07-31T00:00:00.000Z'),
    })

    expect(tx.actaEntrega.update).toHaveBeenCalledWith({
      where: { id: ACTA_ID },
      data:  {
        periodoRentaFin:         new Date('2026-07-31T00:00:00.000Z'),
        periodoRentaFinOriginal: new Date('2026-06-30T00:00:00.000Z'),
      },
    })
  })

  it('no acorta el acta si la renovación termina antes que el período vigente', async () => {
    const acta = { id: ACTA_ID, periodoRentaFin: new Date('2026-09-30T00:00:00.000Z'), periodoRentaFinOriginal: new Date('2026-06-30T00:00:00.000Z') }
    const tx = crearTxMock({ actaEntrega: acta })

    await aplicarExtensionActa(tx as any, {
      actaEntregaOrigenId: ACTA_ID,
      periodoRentaFin:     new Date('2026-07-31T00:00:00.000Z'),
    })

    expect(tx.actaEntrega.update).not.toHaveBeenCalled()
  })

  it('no vuelve a congelar el original en la segunda renovación', async () => {
    const acta = { id: ACTA_ID, periodoRentaFin: new Date('2026-07-31T00:00:00.000Z'), periodoRentaFinOriginal: new Date('2026-06-30T00:00:00.000Z') }
    const tx = crearTxMock({ actaEntrega: acta })

    await aplicarExtensionActa(tx as any, {
      actaEntregaOrigenId: ACTA_ID,
      periodoRentaFin:     new Date('2026-08-31T00:00:00.000Z'),
    })

    expect(tx.actaEntrega.update).toHaveBeenCalledWith({
      where: { id: ACTA_ID },
      data:  { periodoRentaFin: new Date('2026-08-31T00:00:00.000Z') },
    })
  })
})
```

Con este helper al tope del `describe` (o junto a los otros helpers del archivo):

```typescript
function crearTxMock({ actaEntrega }: { actaEntrega: any }) {
  return {
    actaEntrega: {
      findUnique: vi.fn().mockResolvedValue(actaEntrega),
      update:     vi.fn().mockResolvedValue({}),
    },
  }
}
```

y el import de la función nueva junto a los otros imports del archivo:

```typescript
import { aplicarExtensionActa } from '../../../src/modules/cotizaciones/cotizaciones.service'
```

- [ ] **Step 2: Correr para verificar que falla**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm vitest run tests/modules/cotizaciones/cotizaciones.service.test.ts -t "renovaciones"
```

Expected: FAIL con "aplicarExtensionActa is not a function" o error de import.

- [ ] **Step 3: Escribir `aplicarExtensionActa`**

En `server/src/modules/cotizaciones/cotizaciones.service.ts`, agregar antes de `cambiarEstado` (exportada para poder testearla aislada del resto de la transacción "fat"):

```typescript
// El acta de entrega es un registro vivo: su periodoRentaFin refleja hasta
// cuándo está cubierto el inventario que hay en obra. Cada renovación aprobada
// lo extiende, nunca lo acorta. periodoRentaFinOriginal congela el valor de
// entrega la primera vez, para poder recalcular si la renovación se anula.
// periodoRentaInicio no se toca: marca cuándo empezó la renta del inventario.
export async function aplicarExtensionActa(
  tx: Prisma.TransactionClient,
  cotizacion: { actaEntregaOrigenId: string; periodoRentaFin: Date | null },
): Promise<void> {
  if (!cotizacion.periodoRentaFin) return

  const acta = await tx.actaEntrega.findUnique({
    where:  { id: cotizacion.actaEntregaOrigenId },
    select: { id: true, periodoRentaFin: true, periodoRentaFinOriginal: true },
  })
  if (!acta) return
  if (acta.periodoRentaFin && acta.periodoRentaFin >= cotizacion.periodoRentaFin) return

  await tx.actaEntrega.update({
    where: { id: acta.id },
    data:  {
      periodoRentaFin: cotizacion.periodoRentaFin,
      ...(acta.periodoRentaFinOriginal === null && acta.periodoRentaFin
        ? { periodoRentaFinOriginal: acta.periodoRentaFin }
        : {}),
    },
  })
}
```

- [ ] **Step 4: Reemplazar el gate por tipo con el gate por ítem**

En el mismo archivo, borrar el bloque `:794-809` completo (los tres `Set` y la consulta a `actaEntregaItem`) y reemplazar los tres usos:

- Línea ~861: `if (renovEquipos.has(item.equipoId)) continue` → `if (item.cotizacionItemOrigenId) continue // ya está RENTADO por la renta original`
- Línea ~887: `if (renovPiezas.has(item.piezaTipoId)) continue` → `if (item.cotizacionItemOrigenId) continue // ya está en obra por la renta original`
- Línea ~902: `if (renovHerr.has(item.herramientaTipoId)) continue` → `if (item.cotizacionItemOrigenId) continue // ya está en obra por la renta original`
- Línea ~933: `if (renovEquipos.has(item.equipoId)) continue` → `if (item.cotizacionItemOrigenId) continue // ya está RENTADO por la renta original`

Agregar un comentario donde estaba el bloque borrado:

```typescript
    // Renovación: el inventario de un ítem con cotizacionItemOrigenId ya está
    // comprometido por la renta original (no devuelto). Se exceptúa del gate y
    // no se re-marca. El chequeo es por ítem, no por tipo: en una cotización
    // mixta un ítem NUEVO del mismo piezaTipo sí debe validarse.
```

Asegurar que el `select` de `cotizacion.items` en la consulta que alimenta `cambiarEstado` incluya `cotizacionItemOrigenId: true`. Buscar el `findUnique` de la cotización al inicio de `cambiarEstado` y agregarlo al select de items.

- [ ] **Step 5: Llamar a `aplicarExtensionActa` dentro de la transacción**

Dentro del `prisma.$transaction` de la rama `APROBADA` (después del gate de disponibilidad y antes del `auditLog.create` final), agregar:

```typescript
      if (cotizacion.actaEntregaOrigenId) {
        await aplicarExtensionActa(tx, {
          actaEntregaOrigenId: cotizacion.actaEntregaOrigenId,
          periodoRentaFin:     cotizacion.periodoRentaFin,
        })
      }
```

Asegurar que el `select` de la cotización incluya `periodoRentaFin: true` y `actaEntregaOrigenId: true`.

- [ ] **Step 6: Correr los tests**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm vitest run tests/modules/cotizaciones/cotizaciones.service.test.ts
pnpm tsc --noEmit
```

Expected: los 3 tests nuevos PASS, sin fallos nuevos en el resto.

- [ ] **Step 7: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/modules/cotizaciones/cotizaciones.service.ts tests/modules/cotizaciones/cotizaciones.service.test.ts
git commit -m "feat(cotizaciones): gate de disponibilidad por ítem y extensión del acta al aprobar renovación"
```

---

### Task 5: `editarItem` rechaza superar la cantidad del ítem origen

**Files:**
- Modify: `server/src/modules/cotizaciones/cotizaciones.service.ts:561+` (`editarItem`)
- Test: `server/tests/modules/cotizaciones/cotizaciones.service.test.ts`

**Interfaces:**
- Consumes: `CotizacionItem.cotizacionItemOrigenId` (Task 1)
- Produces: `AppError(422, 'CANTIDAD_EXCEDE_ORIGEN', ...)`

- [ ] **Step 1: Escribir el test que falla**

```typescript
describe('editarItem — cantidad de ítems renovados', () => {
  it('rechaza subir la cantidad de un ítem renovado por encima del origen', async () => {
    mockPrisma.cotizacion.findUnique.mockResolvedValue({ estado: 'BORRADOR' } as any)
    mockPrisma.cotizacionItem.findUnique
      .mockResolvedValueOnce({
        id: 'ci-renov', cotizacionId: COT_ID, tipo: 'PIEZA_ANDAMIO',
        cantidadUnidades: 20, cantidadDias: 30, periodo: 'MES',
        tarifaCatalogo: new Decimal(1), esTarifaCustom: false,
        herramientaTipoId: null, equipoId: null, piezaTipoId: 'pz-1',
        cotizacionItemOrigenId: 'ci-orig',
      } as any)
      .mockResolvedValueOnce({ cantidadUnidades: 20 } as any)

    await expect(service.editarItem(COT_ID, 'ci-renov', { cantidadUnidades: 30 } as any, 'user-1'))
      .rejects.toMatchObject({ statusCode: 422, code: 'CANTIDAD_EXCEDE_ORIGEN' })
  })

  it('permite bajar la cantidad de un ítem renovado', async () => {
    mockPrisma.cotizacion.findUnique.mockResolvedValue({ estado: 'BORRADOR' } as any)
    mockPrisma.cotizacionItem.findUnique
      .mockResolvedValueOnce({
        id: 'ci-renov', cotizacionId: COT_ID, tipo: 'PIEZA_ANDAMIO',
        cantidadUnidades: 20, cantidadDias: 30, periodo: 'MES',
        tarifaCatalogo: new Decimal(1), esTarifaCustom: false,
        herramientaTipoId: null, equipoId: null, piezaTipoId: 'pz-1',
        cotizacionItemOrigenId: 'ci-orig',
      } as any)
      .mockResolvedValueOnce({ cantidadUnidades: 20 } as any)
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma))

    await expect(service.editarItem(COT_ID, 'ci-renov', { cantidadUnidades: 10 } as any, 'user-1'))
      .resolves.not.toThrow()
  })
})
```

- [ ] **Step 2: Correr para verificar que falla**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm vitest run tests/modules/cotizaciones/cotizaciones.service.test.ts -t "CANTIDAD_EXCEDE_ORIGEN"
```

Expected: FAIL — no se lanza el error.

- [ ] **Step 3: Agregar `cotizacionItemOrigenId` al select y la validación**

En `server/src/modules/cotizaciones/cotizaciones.service.ts`, agregar al select de `item` (línea ~565):

```typescript
        herramientaTipoId: true, equipoId: true, piezaTipoId: true,
        cotizacionItemOrigenId: true,
```

y después del guard de `SERVICIO`/`CONSUMIBLE` (línea ~586), antes de calcular `unidadesCambia`:

```typescript
  // Un ítem renovado representa inventario que ya está en obra. Subir su
  // cantidad metería unidades nuevas dentro de una línea marcada como renovada,
  // que nunca se despacharía ni descontaría stock.
  if (item.cotizacionItemOrigenId && data.cantidadUnidades !== undefined) {
    const origen = await prisma.cotizacionItem.findUnique({
      where:  { id: item.cotizacionItemOrigenId },
      select: { cantidadUnidades: true },
    })
    if (origen && data.cantidadUnidades > origen.cantidadUnidades) {
      throw new AppError(
        422,
        'CANTIDAD_EXCEDE_ORIGEN',
        `Este ítem renueva inventario ya entregado (máximo ${origen.cantidadUnidades}). Para sumar unidades, agregá un ítem nuevo.`,
      )
    }
  }
```

- [ ] **Step 4: Correr los tests**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm vitest run tests/modules/cotizaciones/cotizaciones.service.test.ts
pnpm tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/modules/cotizaciones/cotizaciones.service.ts tests/modules/cotizaciones/cotizaciones.service.test.ts
git commit -m "feat(cotizaciones): un ítem renovado no puede superar la cantidad de su ítem origen"
```

---

### Task 6: Recalcular el acta al anular o descartar una renovación aprobada

**Files:**
- Modify: `server/src/modules/cotizaciones/cotizaciones.service.ts` (`cambiarEstado`, ramas `ANULADA`/`DESCARTADA`)
- Test: `server/tests/modules/cotizaciones/cotizaciones.service.test.ts`

**Interfaces:**
- Consumes: `aplicarExtensionActa` (Task 4)
- Produces: `recalcularPeriodoActa(tx, actaEntregaOrigenId)` — recalcula `periodoRentaFin` al máximo entre `periodoRentaFinOriginal` y las renovaciones que sigan APROBADAS

- [ ] **Step 1: Escribir el test que falla**

```typescript
describe('recalcularPeriodoActa', () => {
  const ACTA_ID = 'clhacta00000000000000001'

  it('vuelve al período original cuando no quedan renovaciones aprobadas', async () => {
    const tx = {
      actaEntrega: {
        findUnique: vi.fn().mockResolvedValue({ id: ACTA_ID, periodoRentaFinOriginal: new Date('2026-06-30T00:00:00.000Z') }),
        update:     vi.fn().mockResolvedValue({}),
      },
      cotizacion: { findMany: vi.fn().mockResolvedValue([]) },
    }

    await recalcularPeriodoActa(tx as any, ACTA_ID)

    expect(tx.actaEntrega.update).toHaveBeenCalledWith({
      where: { id: ACTA_ID },
      data:  { periodoRentaFin: new Date('2026-06-30T00:00:00.000Z') },
    })
  })

  it('usa el máximo de las renovaciones que siguen aprobadas', async () => {
    const tx = {
      actaEntrega: {
        findUnique: vi.fn().mockResolvedValue({ id: ACTA_ID, periodoRentaFinOriginal: new Date('2026-06-30T00:00:00.000Z') }),
        update:     vi.fn().mockResolvedValue({}),
      },
      cotizacion: {
        findMany: vi.fn().mockResolvedValue([
          { periodoRentaFin: new Date('2026-07-31T00:00:00.000Z') },
          { periodoRentaFin: new Date('2026-08-31T00:00:00.000Z') },
        ]),
      },
    }

    await recalcularPeriodoActa(tx as any, ACTA_ID)

    expect(tx.actaEntrega.update).toHaveBeenCalledWith({
      where: { id: ACTA_ID },
      data:  { periodoRentaFin: new Date('2026-08-31T00:00:00.000Z') },
    })
  })

  it('no hace nada si el acta nunca fue extendida', async () => {
    const tx = {
      actaEntrega: {
        findUnique: vi.fn().mockResolvedValue({ id: ACTA_ID, periodoRentaFinOriginal: null }),
        update:     vi.fn().mockResolvedValue({}),
      },
      cotizacion: { findMany: vi.fn() },
    }

    await recalcularPeriodoActa(tx as any, ACTA_ID)

    expect(tx.actaEntrega.update).not.toHaveBeenCalled()
  })
})
```

Agregar `recalcularPeriodoActa` al import del servicio en el archivo de test.

- [ ] **Step 2: Correr para verificar que falla**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm vitest run tests/modules/cotizaciones/cotizaciones.service.test.ts -t "recalcularPeriodoActa"
```

Expected: FAIL con error de import.

- [ ] **Step 3: Escribir `recalcularPeriodoActa`**

En `server/src/modules/cotizaciones/cotizaciones.service.ts`, junto a `aplicarExtensionActa`:

```typescript
// Único punto donde el acta se acorta: al anular o descartar una renovación
// aprobada, el período vuelve al máximo entre lo entregado originalmente y las
// renovaciones que sigan vigentes. Si periodoRentaFinOriginal es null el acta
// nunca fue extendida, así que no hay nada que revertir.
export async function recalcularPeriodoActa(
  tx: Prisma.TransactionClient,
  actaEntregaOrigenId: string,
): Promise<void> {
  const acta = await tx.actaEntrega.findUnique({
    where:  { id: actaEntregaOrigenId },
    select: { id: true, periodoRentaFinOriginal: true },
  })
  if (!acta?.periodoRentaFinOriginal) return

  const vigentes = await tx.cotizacion.findMany({
    where:  { actaEntregaOrigenId, estado: 'APROBADA', periodoRentaFin: { not: null } },
    select: { periodoRentaFin: true },
  })

  const fechas = [acta.periodoRentaFinOriginal, ...vigentes.map((c) => c.periodoRentaFin!)]
  const maximo = fechas.reduce((a, b) => (b > a ? b : a))

  await tx.actaEntrega.update({
    where: { id: acta.id },
    data:  { periodoRentaFin: maximo },
  })
}
```

- [ ] **Step 4: Llamarla al anular o descartar**

Dentro de `cambiarEstado`, en las ramas que llevan a `ANULADA` y `DESCARTADA`, dentro de la transacción correspondiente:

```typescript
      if (cotizacion.actaEntregaOrigenId) {
        await recalcularPeriodoActa(tx, cotizacion.actaEntregaOrigenId)
      }
```

Aplicar también en el bucle de hermanas descartadas (`:838-853`) si la hermana descartada era una renovación aprobada — en la práctica una hermana en `BORRADOR`/`ENVIADA` nunca extendió el acta, así que **no** hace falta ahí. Documentarlo con un comentario en el bucle:

```typescript
        // Las hermanas descartadas están en BORRADOR/ENVIADA, así que nunca
        // extendieron el acta: no hay período que recalcular.
```

- [ ] **Step 5: Correr los tests**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm vitest run tests/modules/cotizaciones/cotizaciones.service.test.ts
pnpm tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/modules/cotizaciones/cotizaciones.service.ts tests/modules/cotizaciones/cotizaciones.service.test.ts
git commit -m "feat(cotizaciones): recalcular el período del acta al anular una renovación"
```

---

### Task 7: Facturas heredan el período y exponen el acta origen

**Files:**
- Modify: `server/src/modules/facturas/facturas.service.ts:100-120` (`obtenerFactura`), `:461-600` (`generarFacturaDesdeCotizacion`), `:543-556` (warning QUEDAN)
- Test: `server/tests/modules/facturas/facturas.service.test.ts`

**Interfaces:**
- Consumes: `Cotizacion.periodoRenta*` (Task 1)
- Produces: `Factura.periodoRentaInicio/Fin` poblados al facturar una renovación; `obtenerFactura` devuelve `cotizacion.actaEntregaOrigen: { id, numeroActa, numeroActaFisico, estado, fechaEntrega } | null` y `actasEntrega[].numeroActaFisico`

- [ ] **Step 1: Escribir el test que falla**

Agregar a `server/tests/modules/facturas/facturas.service.test.ts`. El mock de Prisma del encabezado (`:5-27`) ya incluye `factura.create`, `cotizacion.findUnique`, `actaEntrega.findMany/findFirst/updateMany` y `$transaction` — no hace falta ampliarlo. `Decimal` ya está importado como `Prisma.Decimal` en `:2-3`.

```typescript
describe('generarFacturaDesdeCotizacion — renovaciones', () => {
  it('copia el período de renta de la cotización a la factura', async () => {
    const inicio = new Date('2026-07-01T00:00:00.000Z')
    const fin    = new Date('2026-07-31T00:00:00.000Z')
    mockPrisma.cotizacion.findUnique.mockResolvedValue({
      id: COT_ID, estado: 'APROBADA', factura: null, clienteId: 'cli-1',
      actaEntregaOrigenId: 'acta-1',
      periodoRentaInicio: inicio, periodoRentaFin: fin,
      porcentajeIva: new Decimal(13), exentoIva: false,
      subtotal: new Decimal(100), montoIva: new Decimal(13), total: new Decimal(113),
      items: [], contactoFacturacionId: null,
    } as any)
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma))
    mockPrisma.factura.create.mockResolvedValue({ id: 'fac-1' } as any)

    await service.generarFacturaDesdeCotizacion(COT_ID, { tipoDTE: 'FC', condicionPago: 'CONTADO' } as any, 'user-1')

    expect(mockPrisma.factura.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ periodoRentaInicio: inicio, periodoRentaFin: fin }),
      }),
    )
  })
})
```

Ajustar los campos del mock de cotización a los que realmente lee `generarFacturaDesdeCotizacion` — leer `facturas.service.ts:461-520` y completar los que falten para que la función llegue al `factura.create`.

- [ ] **Step 2: Correr para verificar que falla**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm vitest run tests/modules/facturas/facturas.service.test.ts -t "período de renta"
```

Expected: FAIL — `periodoRentaInicio` no está en el `data` del create.

- [ ] **Step 3: Copiar el período al crear la factura**

En `server/src/modules/facturas/facturas.service.ts`, agregar `periodoRentaInicio: true, periodoRentaFin: true, actaEntregaOrigenId: true` al select de la cotización en `generarFacturaDesdeCotizacion`, y al `data` del `tx.factura.create`:

```typescript
        // Una renovación no genera acta nueva, así que el período viene pactado
        // en la cotización. Sin esto la factura nace sin período y la emisión
        // del DTE se bloquea con PERIODO_RENTA_REQUERIDO.
        periodoRentaInicio: cotizacion.periodoRentaInicio,
        periodoRentaFin:    cotizacion.periodoRentaFin,
```

- [ ] **Step 4: Exceptuar el warning QUEDAN para renovaciones**

En el bloque `:543-556`, cambiar la condición:

```typescript
      // Una renovación sin ítems nuevos no tiene actas propias, y eso es lo
      // correcto: el inventario ya está en obra bajo el acta original.
      const hayPendientes = cotizacion.actaEntregaOrigenId
        ? actas.some((a) => a.estado !== 'DEVUELTO')
        : actas.length === 0 || actas.some((a) => a.estado !== 'DEVUELTO')
```

- [ ] **Step 5: Exponer el acta origen en `obtenerFactura`**

En `obtenerFactura` (`:100-120`), cambiar el select de `actasEntrega` y agregar la cotización:

```typescript
      actasEntrega: { select: { id: true, numeroActa: true, estado: true, numeroActaFisico: true } },
      cotizacion:   {
        select: {
          id: true, numeroCotizacion: true,
          // Renovación: la factura no tiene actas propias, pero el acta origen
          // es la que respalda el inventario que hay en obra.
          actaEntregaOrigen: {
            select: { id: true, numeroActa: true, numeroActaFisico: true, estado: true, fechaEntrega: true },
          },
        },
      },
```

Si `cotizacion` ya está en el select, agregarle solo `actaEntregaOrigen` sin pisar los campos existentes.

- [ ] **Step 6: Correr los tests**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm vitest run tests/modules/facturas/facturas.service.test.ts
pnpm tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/modules/facturas/facturas.service.ts tests/modules/facturas/facturas.service.test.ts
git commit -m "feat(facturas): heredar el período de renta de la renovación y exponer el acta origen"
```

---

### Task 8: `obtenerActa` expone los campos nuevos y `crearVariante` propaga el período

**Files:**
- Modify: `server/src/modules/actas/actas.service.ts:573-600` (`obtenerActa`)
- Modify: `server/src/modules/cotizaciones/cotizaciones.service.ts:258-286` (`crearVariante`)

**Interfaces:**
- Consumes: columnas de Task 1
- Produces: `obtenerActa` devuelve `periodoRentaFinOriginal`, `items[].cotizacionItem: { periodo, cantidadDias }` y `renovaciones[].periodoRentaInicio/Fin`

- [ ] **Step 1: Ampliar el select de `obtenerActa`**

En `server/src/modules/actas/actas.service.ts`, dentro del select de `obtenerActa`:

- agregar `periodoRentaFinOriginal: true` junto a `periodoRentaFin`
- en el select de `items`, agregar:

```typescript
          // El modal de renovación calcula el período sugerido a partir del
          // periodo/cantidadDias del ítem cotizado.
          cotizacionItem: { select: { periodo: true, cantidadDias: true } },
```

**Nota:** `ActaEntregaItem.cotizacionItemId` es un `String` sin relación declarada en el schema. Si Prisma no permite el `include`, declarar la relación en `schema.prisma` como parte de esta tarea:

```prisma
model ActaEntregaItem {
  cotizacionItemId String
  cotizacionItem   CotizacionItem @relation(fields: [cotizacionItemId], references: [id])
}
```

y en `CotizacionItem` el reverso: `actaEntregaItems ActaEntregaItem[]`. Eso requiere una migración adicional que solo agrega la FK (los datos ya son consistentes). Generarla con el mismo procedimiento de Task 1, carpeta `20260720130000_acta_item_relacion_cotizacion_item`.

- en el select de `renovaciones` (`:592`), agregar los campos de período:

```typescript
      renovaciones: { select: { id: true, numeroCotizacion: true, estado: true, periodoRentaInicio: true, periodoRentaFin: true, factura: { select: { id: true, numeroFactura: true } } }, orderBy: { createdAt: 'desc' } },
```

- [ ] **Step 2: Propagar el período en `crearVariante`**

En `server/src/modules/cotizaciones/cotizaciones.service.ts`, dentro del `tx.cotizacion.create` de `crearVariante`, después de `actaEntregaOrigenId` (línea 277):

```typescript
            // La variante hereda el período pactado: sigue siendo la misma
            // renovación del mismo acta.
            periodoRentaInicio:    origen.periodoRentaInicio,
            periodoRentaFin:       origen.periodoRentaFin,
```

Agregar `periodoRentaInicio: true, periodoRentaFin: true` al select de `origen`.

**No** hace falta tocar el clonado de ítems: `createMany` con spread (`:289`) ya propaga `cotizacionItemOrigenId` automáticamente.

- [ ] **Step 3: Verificar tipos y tests**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm tsc --noEmit
pnpm test 2>&1 | tail -20
```

Expected: tsc PASS, sin fallos nuevos respecto al baseline de Task 0.

- [ ] **Step 4: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/modules/actas/actas.service.ts src/modules/cotizaciones/cotizaciones.service.ts prisma/
git commit -m "feat(actas): exponer período original y datos del ítem cotizado; variantes heredan el período"
```

---

### Task 9: El PDF de factura muestra el folio del acta origen

**Files:**
- Modify: `server/src/modules/pdf/pdf.service.ts:390-435`
- Test: `server/tests/modules/pdf/pdf.service.test.ts`

**Interfaces:**
- Consumes: `Cotizacion.actaEntregaOrigen` (Task 1 / Task 7)
- Produces: `numerosActa` incluye el folio del acta origen cuando la cotización es renovación

- [ ] **Step 1: Escribir el test que falla**

En el archivo de tests de `pdf.service`, agregar:

```typescript
describe('numerosActa — renovaciones', () => {
  it('usa el folio del acta origen cuando la factura no tiene actas propias', async () => {
    mockPrisma.factura.findUnique.mockResolvedValue({
      ...facturaBase,
      actasEntrega: [],
      numeroActaFisicoManual: null,
      cotizacion: { actaEntregaOrigen: { numeroActaFisico: 'ACT-F-0123' } },
    } as any)

    const datos = await construirDatosFactura(FAC_ID)

    expect(datos.numerosActa).toBe('ACT-F-0123')
  })

  it('combina el folio del acta origen con el de las actas nuevas', async () => {
    mockPrisma.factura.findUnique.mockResolvedValue({
      ...facturaBase,
      actasEntrega: [{ numeroActaFisico: 'ACT-F-0456' }],
      numeroActaFisicoManual: null,
      cotizacion: { actaEntregaOrigen: { numeroActaFisico: 'ACT-F-0123' } },
    } as any)

    const datos = await construirDatosFactura(FAC_ID)

    expect(datos.numerosActa).toBe('ACT-F-0123, ACT-F-0456')
  })
})
```

Adaptar `facturaBase` y el nombre de la función al patrón real del archivo (leer `pdf.service.ts:390-435` y el test existente). Si la lógica de folios está inline dentro de una función grande, extraerla a un helper exportado `construirNumerosActa(factura)` y testear ese helper.

- [ ] **Step 2: Correr para verificar que falla**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm vitest run tests/modules/pdf -t "numerosActa"
```

Expected: FAIL.

- [ ] **Step 3: Incluir el acta origen en el select y en el cálculo**

En `server/src/modules/pdf/pdf.service.ts`, agregar al select de la factura (junto a `actasEntrega`, línea ~395):

```typescript
      cotizacion: { select: { actaEntregaOrigen: { select: { numeroActaFisico: true } } } },
```

y reemplazar el cálculo de `numerosActa` (`:429-434`):

```typescript
    numerosActa: (() => {
      // En una renovación la mercadería sigue respaldada por el acta original:
      // su folio físico va primero, seguido de las actas nuevas si la
      // renovación incluyó inventario que no estaba en obra.
      const folioOrigen = factura.cotizacion?.actaEntregaOrigen?.numeroActaFisico
      const folios = [
        ...(folioOrigen ? [folioOrigen] : []),
        ...factura.actasEntrega.map((a) => a.numeroActaFisico).filter((f): f is string => !!f),
      ]
      const unicos = [...new Set(folios)]
      return unicos.length > 0 ? unicos.join(', ') : (factura.numeroActaFisicoManual ?? '')
    })(),
```

- [ ] **Step 4: Correr los tests**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm vitest run tests/modules/pdf
pnpm tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/modules/pdf/pdf.service.ts tests/modules/pdf
git commit -m "feat(pdf): el PDF de una renovación muestra el folio del acta de entrega original"
```

---

### Task 10: Backfill de renovaciones históricas

**Files:**
- Create: `server/prisma/migrations/20260720140000_backfill_renovacion_item_origen/migration.sql`

**Interfaces:**
- Consumes: columnas de Task 1
- Produces: `cotizacionItemOrigenId` poblado en las renovaciones ya existentes

- [ ] **Step 1: Inspeccionar cuántas renovaciones históricas hay**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm prisma db execute --stdin <<'SQL'
SELECT COUNT(*) AS renovaciones FROM "Cotizacion" WHERE "actaEntregaOrigenId" IS NOT NULL;
SQL
```

Anotar el número. Si es 0, el backfill es un no-op pero se crea igual para dejar el sistema consistente hacia adelante.

- [ ] **Step 2: Escribir la migración de backfill**

Crear `server/prisma/migrations/20260720140000_backfill_renovacion_item_origen/migration.sql`:

```sql
-- Backfill: marca los ítems de renovaciones históricas con su ítem origen.
-- El matching es por tipo (equipo/herramientaTipo/piezaTipo) contra los
-- ActaEntregaItem del acta origen. Es seguro acá aunque se haya descartado
-- para el diseño general: hasta esta migración el sistema no permitía mezclar
-- inventario nuevo en una cotización de renovación, así que no hay ambigüedad.
UPDATE "CotizacionItem" ci
SET "cotizacionItemOrigenId" = origen.id
FROM "Cotizacion" c
JOIN "ActaEntregaItem" aei ON aei."actaEntregaId" = c."actaEntregaOrigenId"
JOIN "CotizacionItem" origen ON origen.id = aei."cotizacionItemId"
LEFT JOIN "HerramientaUnidad" hu ON hu.id = aei."herramientaUnidadId"
WHERE ci."cotizacionId" = c.id
  AND c."actaEntregaOrigenId" IS NOT NULL
  AND ci."cotizacionItemOrigenId" IS NULL
  AND (
        (ci."equipoId"          IS NOT NULL AND ci."equipoId"          = aei."equipoId")
     OR (ci."piezaTipoId"       IS NOT NULL AND ci."piezaTipoId"       = aei."piezaTipoId")
     OR (ci."herramientaTipoId" IS NOT NULL AND ci."herramientaTipoId" = hu."herramientaTipoId")
  );
```

- [ ] **Step 3: Aplicar y verificar**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm prisma migrate deploy
pnpm prisma db execute --stdin <<'SQL'
SELECT c."numeroCotizacion",
       COUNT(ci.id) AS items,
       COUNT(ci."cotizacionItemOrigenId") AS marcados
FROM "Cotizacion" c
JOIN "CotizacionItem" ci ON ci."cotizacionId" = c.id
WHERE c."actaEntregaOrigenId" IS NOT NULL
GROUP BY c."numeroCotizacion";
SQL
```

Expected: en cada renovación histórica, `marcados` = `items`. Si alguna fila tiene `marcados < items`, revisar manualmente esa cotización antes de continuar — puede ser un ítem que ya fue devuelto o un tipo no rentable.

- [ ] **Step 4: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add prisma/migrations/20260720140000_backfill_renovacion_item_origen
git commit -m "chore(db): backfill de cotizacionItemOrigenId en renovaciones históricas"
```

---

### Task 11: Tipos del frontend

**Files:**
- Modify: `frontend/types/api.ts` (`Cotizacion` ~línea 848, `CotizacionItem`, `Acta` ~línea 1326, `Factura`)

**Interfaces:**
- Consumes: la forma de respuesta del backend (Tasks 7 y 8)
- Produces: `Cotizacion.periodoRentaInicio/Fin`, `CotizacionItem.cotizacionItemOrigenId`, `Acta.periodoRentaFinOriginal`, `Acta.items[].cotizacionItem`, `Acta.renovaciones[].periodoRenta*`, `Factura.cotizacion.actaEntregaOrigen`

- [ ] **Step 1: Agregar los campos**

En `frontend/types/api.ts`, en `Cotizacion` (junto a `actaEntregaOrigen`, línea ~849):

```typescript
  periodoRentaInicio: string | null;
  periodoRentaFin: string | null;
```

En `CotizacionItem`:

```typescript
  /** Renovación: ítem de la cotización anterior que este renueva. null = inventario nuevo. */
  cotizacionItemOrigenId: string | null;
```

En `Acta`:

```typescript
  periodoRentaFinOriginal: string | null;
```

En el tipo de `Acta['items'][number]`:

```typescript
  cotizacionItem: { periodo: PeriodoItem; cantidadDias: number } | null;
```

En `Acta['renovaciones'][number]`, agregar:

```typescript
  periodoRentaInicio: string | null;
  periodoRentaFin: string | null;
```

En `Factura`, agregar `numeroActaFisico` al tipo de `actasEntrega[]` y la cotización con el acta origen:

```typescript
  cotizacion?: {
    id: string;
    numeroCotizacion: string;
    actaEntregaOrigen: {
      id: string;
      numeroActa: string;
      numeroActaFisico: string | null;
      estado: EstadoActa;
      fechaEntrega: string | null;
    } | null;
  } | null;
```

Usar los nombres de tipo que ya existan en el archivo para `PeriodoItem` y `EstadoActa`; si no existen, usar los literales correspondientes.

- [ ] **Step 2: Verificar tipos**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add types/api.ts
git commit -m "feat(types): campos de período y vínculo de renovación"
```

---

### Task 12: El modal de renovación captura el período

**Files:**
- Modify: `frontend/components/actas/RenovarRentaModal.tsx`
- Modify: `frontend/hooks/use-actas.ts:314-330` (`useRenovarRenta`)

**Interfaces:**
- Consumes: `Acta.periodoRentaFin`, `Acta.items[].cotizacionItem` (Tasks 8, 11)
- Produces: `useRenovarRenta` muta con `{ cotizacionItemIds, periodoRentaInicio, periodoRentaFin }`

- [ ] **Step 1: Cambiar la firma del hook**

En `frontend/hooks/use-actas.ts`, reemplazar `useRenovarRenta` (`:314-330`):

```typescript
type RenovarRentaVars = {
  cotizacionItemIds: string[];
  periodoRentaInicio: string;
  periodoRentaFin: string;
};

export function useRenovarRenta(actaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: RenovarRentaVars) =>
      api.post<ApiResponse<Cotizacion>>(`/actas/${actaId}/renovar`, vars).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['acta', actaId] });
      qc.invalidateQueries({ queryKey: ['cotizaciones'] });
      toast.success('Renovación creada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear la renovación.'));
    },
  });
}
```

- [ ] **Step 2: Agregar el cálculo del período sugerido al modal**

En `frontend/components/actas/RenovarRentaModal.tsx`, agregar después del `TIPOS_RENTABLES` (línea 11):

```typescript
// Duración en días de un ítem según su período de tarifa. Refleja
// calcularSubtotal del backend: cantidadDias solo multiplica en DIA/CUSTOM;
// SEMANA/QUINCENA/MES son bloques planos.
const DIAS_POR_PERIODO: Record<string, number> = { SEMANA: 7, QUINCENA: 15, MES: 30 };

function duracionDias(it: Acta['items'][number]): number {
  const ci = it.cotizacionItem;
  if (!ci) return 30;
  return DIAS_POR_PERIODO[ci.periodo] ?? ci.cantidadDias;
}

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// El período sugerido arranca el día siguiente al fin vigente del acta. Si el
// acta no tiene fin o ya venció, arranca hoy: renovar una renta vencida es un
// caso real y no debe proponer fechas en el pasado.
function periodoSugerido(acta: Acta, seleccionados: Acta['items']): { inicio: string; fin: string } {
  const hoy = new Date();
  hoy.setUTCHours(0, 0, 0, 0);
  const finActa = acta.periodoRentaFin ? new Date(acta.periodoRentaFin) : null;
  const base = finActa && finActa >= hoy ? new Date(finActa.getTime() + 86400000) : hoy;

  const dias = seleccionados.length > 0 ? Math.max(...seleccionados.map(duracionDias)) : 30;
  const fin = new Date(base.getTime() + (dias - 1) * 86400000);
  return { inicio: toDateInput(base), fin: toDateInput(fin) };
}
```

- [ ] **Step 3: Cablear el estado de las fechas**

Dentro del componente, después del `useState` de `seleccion` (línea 18-20):

```typescript
  const seleccionados = renovables.filter((it) => seleccion[it.cotizacionItemId]);
  const sugerido = periodoSugerido(acta, seleccionados);

  const [inicio, setInicio] = useState(sugerido.inicio);
  const [fin, setFin] = useState(sugerido.fin);
  // El usuario manda: una vez que edita las fechas, cambiar la selección de
  // ítems ya no las pisa.
  const [editadoManual, setEditadoManual] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editadoManual) return;
    setInicio(sugerido.inicio);
    setFin(sugerido.fin);
  }, [sugerido.inicio, sugerido.fin, editadoManual]);
```

- [ ] **Step 4: Renderizar los campos y validar**

Reemplazar el `confirmar()` (línea 34-39):

```typescript
  function confirmar() {
    if (ids.length === 0) return;
    if (!inicio || !fin) { setError('Completá el período de renta'); return; }
    if (inicio > fin) { setError('La fecha de inicio debe ser anterior o igual al fin'); return; }
    setError(null);
    renovar.mutate(
      { cotizacionItemIds: ids, periodoRentaInicio: inicio, periodoRentaFin: fin },
      { onSuccess: (cot) => { router.push(`/cotizaciones/${cot.id}/editar?paso=1`); } },
    );
  }
```

Cambiar el subtítulo (línea 47):

```tsx
            <p className="text-xs text-tx-3 mt-0.5">Elegí el inventario a renovar y el período. Se creará una cotización vinculada a esta acta — el inventario ya entregado no requiere acta nueva.</p>
```

Y agregar el bloque de fechas justo después del `</div>` que cierra la lista de ítems (línea 60), antes del footer:

```tsx
        <div className="px-4 pb-4 pt-1 border-t border-bd space-y-2">
          <p className="text-xs font-medium text-tx-2">Período de renta</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs text-tx-3">Desde</span>
              <input
                type="date"
                value={inicio}
                onChange={(e) => { setInicio(e.target.value); setEditadoManual(true); }}
                className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent transition-colors"
              />
            </label>
            <label className="block">
              <span className="text-xs text-tx-3">Hasta</span>
              <input
                type="date"
                value={fin}
                onChange={(e) => { setFin(e.target.value); setEditadoManual(true); }}
                className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent transition-colors"
              />
            </label>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
```

- [ ] **Step 5: Verificar tipos y probar a mano**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit && pnpm lint
```

Expected: PASS. Luego con `pnpm dev` y el backend corriendo: abrir un acta ENTREGADO, clic en "Renovar renta", verificar que las fechas vienen pre-llenadas, que cambiar la selección las recalcula, y que editarlas a mano las congela.

- [ ] **Step 6: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add components/actas/RenovarRentaModal.tsx hooks/use-actas.ts
git commit -m "feat(actas): el modal de renovación captura el período de renta con default sugerido"
```

---

### Task 13: El detalle de factura distingue renovaciones

**Files:**
- Modify: `frontend/components/facturas/detalle/ActasVinculadasCard.tsx`
- Modify: `frontend/app/(dashboard)/facturas/[id]/page.tsx`
- Modify: `frontend/components/facturas/detalle/PeriodoFacturaCard.tsx`

**Interfaces:**
- Consumes: `Factura.cotizacion.actaEntregaOrigen` (Task 11), `useItemsDisponiblesDespachoCotizacion` (`hooks/use-actas.ts:133`)
- Produces: UI que no ofrece crear acta cuando no hay inventario nuevo

- [ ] **Step 1: Reescribir `ActasVinculadasCard`**

Reemplazar `frontend/components/facturas/detalle/ActasVinculadasCard.tsx` completo:

```tsx
'use client';

import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { useItemsDisponiblesDespachoCotizacion } from '@/hooks/use-actas';
import { formatDate } from '@/lib/utils';
import type { Factura } from '@/types/api';

type Props = {
  factura: Factura;
  puedeEscribir: boolean;
};

export function ActasVinculadasCard({ factura, puedeEscribir }: Props) {
  const actas = factura.actasEntrega ?? [];
  const actaOrigen = factura.cotizacion?.actaEntregaOrigen ?? null;
  const cotizacionId = factura.cotizacion?.id ?? null;

  // El botón de crear acta solo tiene sentido si queda inventario sin despachar.
  // En una renovación pura no queda ninguno: la mercadería ya está en obra.
  const disponibles = useItemsDisponiblesDespachoCotizacion(cotizacionId);
  const hayInventarioNuevo = (disponibles.data?.length ?? 0) > 0;
  const mostrarBoton = puedeEscribir && hayInventarioNuevo;

  const total = actas.length + (actaOrigen ? 1 : 0);

  return (
    <div className="bg-bg border border-bd rounded-md">
      <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
        <h3 className="text-sm font-medium text-tx">Actas de entrega vinculadas ({total})</h3>
        {mostrarBoton && (
          <Link
            href={`/actas/nueva?facturaId=${factura.id}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors"
          >
            <Icon name="plus" size={12} /> Nueva acta
          </Link>
        )}
      </div>

      {total === 0 ? (
        <div className="py-6">
          <EmptyState icon="clipboard" title="Sin actas" message="Aún no se han creado actas de entrega para esta factura." />
        </div>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {actaOrigen && (
              <tr className="border-t border-bd hover:bg-bg-sunken">
                <td className="px-4 py-2.5 font-mono w-40">
                  <Link href={`/actas/${actaOrigen.id}`} className="hover:underline">{actaOrigen.numeroActa}</Link>
                </td>
                <td className="px-4 py-2.5">
                  <Badge status={actaOrigen.estado} />
                  <span className="ml-2 text-xs text-tx-3">Renovada</span>
                </td>
                <td className="px-4 py-2.5 text-xs text-tx-3 text-right">
                  {actaOrigen.numeroActaFisico && <span className="font-mono">{actaOrigen.numeroActaFisico}</span>}
                  {actaOrigen.fechaEntrega && <span className="ml-2">Entregada {formatDate(actaOrigen.fechaEntrega)}</span>}
                </td>
              </tr>
            )}
            {actas.map((a) => (
              <tr key={a.id} className="border-t border-bd hover:bg-bg-sunken">
                <td className="px-4 py-2.5 font-mono w-40">
                  <Link href={`/actas/${a.id}`} className="hover:underline">{a.numeroActa}</Link>
                </td>
                <td className="px-4 py-2.5">
                  <Badge status={a.estado} />
                  {actaOrigen && <span className="ml-2 text-xs text-tx-3">Nueva entrega</span>}
                </td>
                <td className="px-4 py-2.5 text-xs text-tx-3 text-right font-mono">
                  {a.numeroActaFisico ?? ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {actaOrigen && !hayInventarioNuevo && (
        <div className="px-4 py-2 border-t border-bd text-xs text-tx-3">
          Esta renovación no requiere acta nueva — el inventario sigue en obra bajo el acta{' '}
          <Link href={`/actas/${actaOrigen.id}`} className="text-accent hover:underline font-mono">{actaOrigen.numeroActa}</Link>.
        </div>
      )}

      <div className="px-4 py-2 border-t border-bd text-xs text-tx-3">
        Ver{' '}
        <Link href={`/actas?busqueda=${factura.numeroFactura}`} className="text-accent hover:underline">actas de esta factura</Link>
        {' · '}
        <Link href={`/recepciones?busqueda=${factura.numeroFactura}`} className="text-accent hover:underline">recepciones</Link>
      </div>
    </div>
  );
}
```

Verificar la firma real de `useItemsDisponiblesDespachoCotizacion` en `hooks/use-actas.ts:133` — si no acepta `null`, envolver con un `enabled` o pasar cadena vacía según el patrón del hook.

- [ ] **Step 2: Badge de renovación en el detalle de factura**

En `frontend/app/(dashboard)/facturas/[id]/page.tsx`, junto al número de factura en el `PageHeader`, agregar:

```tsx
{factura.cotizacion?.actaEntregaOrigen && (
  <Link
    href={`/actas/${factura.cotizacion.actaEntregaOrigen.id}`}
    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent-soft text-accent text-xs font-medium hover:underline"
  >
    <Icon name="refresh" size={11} /> Renovación de {factura.cotizacion.actaEntregaOrigen.numeroActa}
  </Link>
)}
```

Verificar que `accent-soft` exista como utilidad en `globals.css`; si no, usar la que se use para chips de acento en el resto del proyecto.

- [ ] **Step 3: Nota de origen en `PeriodoFacturaCard`**

En `frontend/components/facturas/detalle/PeriodoFacturaCard.tsx`, después del bloque de inputs, agregar:

```tsx
{factura.cotizacion?.actaEntregaOrigen && (
  <p className="text-xs text-tx-3 mt-2">
    Heredado de la renovación · extiende el acta{' '}
    <span className="font-mono">{factura.cotizacion.actaEntregaOrigen.numeroActa}</span>
  </p>
)}
```

- [ ] **Step 4: Verificar**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit && pnpm lint
```

Expected: PASS. Manual: abrir la factura de una renovación y confirmar que aparece el acta origen etiquetada «Renovada», que **no** aparece el botón "Nueva acta", y que la línea explicativa se muestra. Probar también en dark mode y a 768 px.

- [ ] **Step 5: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add components/facturas/detalle/ActasVinculadasCard.tsx components/facturas/detalle/PeriodoFacturaCard.tsx "app/(dashboard)/facturas/[id]/page.tsx"
git commit -m "feat(facturas): el detalle distingue renovaciones y no ofrece acta nueva sin inventario nuevo"
```

---

### Task 14: El detalle del acta muestra el período vigente y las renovaciones

**Files:**
- Modify: `frontend/app/(dashboard)/actas/[id]/page.tsx` (card de período y card "Renovaciones" `:113-125`)

**Interfaces:**
- Consumes: `Acta.periodoRentaFinOriginal`, `Acta.renovaciones[].periodoRenta*` (Task 11)
- Produces: nada que otras tareas consuman

- [ ] **Step 1: Mostrar entregado vs vigente**

En el card donde se muestra el período del acta, reemplazar la línea del período por:

```tsx
{acta.periodoRentaFinOriginal ? (
  <>
    <span>Entregado hasta {formatDate(acta.periodoRentaFinOriginal)}</span>
    <span className="text-tx-3"> · vigente hasta {formatDate(acta.periodoRentaFin)}</span>
  </>
) : (
  acta.periodoRentaFin && <span>Hasta {formatDate(acta.periodoRentaFin)}</span>
)}
```

- [ ] **Step 2: Agregar el período a la card de renovaciones**

En el bloque `:113-125`, dentro del map de `acta.renovaciones`, agregar debajo del número de cotización:

```tsx
{r.periodoRentaInicio && r.periodoRentaFin && (
  <span className="text-xs text-tx-3">
    {formatDate(r.periodoRentaInicio)} – {formatDate(r.periodoRentaFin)}
  </span>
)}
```

- [ ] **Step 3: Verificar**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit && pnpm lint
```

Expected: PASS. Manual: abrir un acta con renovaciones y confirmar ambos valores.

- [ ] **Step 4: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add "app/(dashboard)/actas/[id]/page.tsx"
git commit -m "feat(actas): el detalle muestra período entregado vs vigente y el período de cada renovación"
```

---

### Task 15: El wizard de cotización marca los ítems renovados

**Files:**
- Modify: `frontend/components/cotizaciones/wizard/Step2Items.tsx` (filas editables de ítems del wizard)
- Modify: `frontend/components/cotizaciones/detalle/ItemsTabla.tsx` (tabla de solo lectura del detalle)

**Interfaces:**
- Consumes: `CotizacionItem.cotizacionItemOrigenId` (Task 11), error `CANTIDAD_EXCEDE_ORIGEN` (Task 5)
- Produces: nada que otras tareas consuman

- [ ] **Step 1: Agregar el chip «Renovado»**

En `Step2Items.tsx` y en `ItemsTabla.tsx`, junto a la descripción de cada fila:

```tsx
{item.cotizacionItemOrigenId && (
  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-bg-sunken text-tx-3">
    <Icon name="refresh" size={10} /> Renovado
  </span>
)}
```

En `Step2Items.tsx`, además, ocultar el selector de bodega de esas filas — el ítem no se despacha.

- [ ] **Step 2: Mostrar el error del backend inline**

En el handler de edición de cantidad, capturar el error y mostrarlo bajo el input en vez de toast (los errores de validación de formulario van inline, por convención del proyecto):

```tsx
{errorCantidad && <p className="text-xs text-danger mt-1">{errorCantidad}</p>}
```

poblando `errorCantidad` desde `extractErrorMessage(err, '')` en el `onError` de la mutation de editar ítem, solo cuando el código sea `CANTIDAD_EXCEDE_ORIGEN`. Para el resto de errores mantener el `toast.error` actual.

- [ ] **Step 3: Verificar**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit && pnpm lint
```

Expected: PASS. Manual: abrir la cotización de una renovación, confirmar el chip, y subir la cantidad de un ítem renovado para ver el error inline.

- [ ] **Step 4: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add components/cotizaciones/
git commit -m "feat(cotizaciones): marcar ítems renovados en el wizard y mostrar el límite de cantidad inline"
```

---

### Task 16: `/actas/nueva` pre-llena el período desde la cotización

**Files:**
- Modify: `frontend/app/(dashboard)/actas/nueva/page.tsx:248-259` (useEffect de precarga del período)

**Interfaces:**
- Consumes: `Cotizacion.periodoRentaInicio/Fin` (Task 11)
- Produces: nada que otras tareas consuman

- [ ] **Step 1: Extender el useEffect de precarga existente**

La página usa React Hook Form (`form.setValue`) y **ya tiene** un `useEffect` que precarga el período desde la factura en modo `'factura'` (`:248-259`). Se le agrega la rama de modo `'cotizacion'`. Reemplazar ese bloque completo:

```tsx
  // Precarga el periodo de renta desde la factura (feedback ventas jul-2026) o
  // desde la cotización cuando el acta nace de una renovación con inventario
  // nuevo: ese inventario cubre el mismo lapso que la renovación.
  // Solo si el campo está vacío, para no pisar lo que el usuario ya tipeó.
  useEffect(() => {
    const origen =
      modo === 'factura'
        ? facturaInicial
        : cotizacionSeleccionada;
    if (!origen) return;
    const { periodoRentaInicio, periodoRentaFin } = form.getValues();
    if (!periodoRentaInicio && origen.periodoRentaInicio) {
      form.setValue('periodoRentaInicio', origen.periodoRentaInicio.slice(0, 10));
    }
    if (!periodoRentaFin && origen.periodoRentaFin) {
      form.setValue('periodoRentaFin', origen.periodoRentaFin.slice(0, 10));
    }
  }, [modo, facturaInicial, cotizacionSeleccionada, form]);
```

Verificar que `cotizacionSeleccionada` esté definida en ese punto del componente (se usa en `:262`); si el objeto que expone no trae `periodoRenta*`, usar el hook de detalle de cotización que ya se consuma en la página.

- [ ] **Step 2: Verificar**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit && pnpm lint
```

Expected: PASS. Manual: en una renovación mixta, ir a crear el acta del inventario nuevo y confirmar que el período viene pre-llenado.

- [ ] **Step 3: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add "app/(dashboard)/actas/nueva/page.tsx"
git commit -m "feat(actas): pre-llenar el período del acta nueva desde la cotización de renovación"
```

---

### Task 17: Verificación integral del flujo

**Files:**
- Ninguno (verificación)

**Interfaces:**
- Consumes: todo lo anterior
- Produces: confirmación de que el flujo end-to-end funciona

- [ ] **Step 1: Suite completa en el server**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm tsc --noEmit
pnpm test 2>&1 | tail -25
pnpm lint 2>&1 | tail -25
```

Expected: tsc PASS. Vitest y lint: **exactamente los mismos fallos que en Task 0, ni uno más**. Si aparece un fallo nuevo, arreglarlo antes de continuar — no marcar esta tarea como completa con fallos nuevos.

- [ ] **Step 2: Tipos y lint del frontend**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm tsc --noEmit
pnpm lint
```

Expected: PASS.

- [ ] **Step 3: Flujo manual — renovación pura**

Con el backend en `:3000` y `pnpm dev` en `:3001`:

1. Abrir un acta en estado ENTREGADO con ítems `PENDIENTE_DEVOLUCION`.
2. "Renovar renta" → verificar el período pre-llenado → crear.
3. En el wizard, confirmar el chip «Renovado» en cada ítem.
4. Aprobar la cotización.
5. Volver al acta: confirmar "Entregado hasta X · vigente hasta Y".
6. Generar la factura.
7. En el detalle de la factura confirmar: badge «Renovación», acta origen etiquetada «Renovada», **sin** botón "Nueva acta", período de renta ya cargado.
8. Emitir el DTE: debe emitir sin pedir período.
9. Descargar el PDF de la factura: debe mostrar el folio físico del acta original.

- [ ] **Step 4: Flujo manual — renovación mixta**

1. Renovar desde un acta y, en el wizard, **agregar un ítem nuevo** del mismo tipo de pieza que uno renovado.
2. Aprobar: el ítem nuevo debe validar disponibilidad (si no hay stock, debe fallar el gate).
3. Facturar y crear el acta nueva: el wizard debe ofrecer **solo** el ítem nuevo.
4. Confirmar que el stock se descontó una sola vez (comparar `PiezaTipo.stockActual` antes y después).
5. En el detalle de la factura: dos actas, una «Renovada» y otra «Nueva entrega».

- [ ] **Step 5: Flujo manual — devolución parcial**

1. Sobre un acta con piezas, registrar una recepción parcial (devolver una parte).
2. Renovar: la cantidad propuesta debe ser la que queda en obra, no la original.

- [ ] **Step 6: Commit final y push**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && git push -u origin feat/renovacion-renta-vinculo-acta
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && git push -u origin feat/renovacion-renta-vinculo-acta
```

---

## Notas de implementación

**Orden de dependencias:** Tasks 1 → 2 → (3, 4, 5, 6, 7, 8, 9) → 10 → 11 → (12, 13, 14, 15, 16) → 17. Las tareas 3-9 son independientes entre sí una vez que existe Task 2, y 12-16 lo son una vez que existe Task 11.

**Repos separados:** Tasks 0-10 son del server, 11-16 del frontend, 17 de ambos. Cada repo tiene su propia rama `feat/renovacion-renta-vinculo-acta` y sus propios commits.

**Sobre los tests:** el server no tiene BD de test — Prisma se mockea. Eso significa que los tests verifican **la forma de las llamadas a Prisma**, no el resultado en la BD. Por eso Task 17 incluye verificación manual del flujo real: es la única forma de confirmar que el stock no se descuenta dos veces.
