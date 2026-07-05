# Flujo Cotización→Acta→Factura — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir crear un acta de entrega directamente desde una cotización aprobada (Cotización→Acta→Factura), anclando el acta a la cotización y haciendo la factura opcional, sin romper el flujo actual Cotización→Factura→Acta.

**Architecture:** El acta (y la recepción) pasan a anclarse en `cotizacionId` (obligatorio) con `facturaId` opcional. `crearActa`/`registrarRecepcion` se refactorizan para operar por cotización; se agregan rutas bajo `/cotizaciones/:id/...` además de las existentes bajo `/facturas/:id/...`. Al generar la factura se auto-vinculan las actas y, si es QUEDAN con acta entregada, se sella la entrega + vencimiento con un helper compartido.

**Tech Stack:** Backend Express + Prisma (PostgreSQL remota compartida) + Zod + vitest en `/Users/joaquinmorales13a06/Desktop/Reinar/server`. Frontend Next.js App Router + RHF/Zod + Tailwind en `/Users/joaquinmorales13a06/Desktop/Reinar/frontend`.

**Spec:** `docs/superpowers/specs/2026-07-05-flujo-cotizacion-acta-factura-design.md`

## Global Constraints

- **Ramas:** `feat/flujo-cotizacion-acta-factura` en AMBOS repos. El frontend ya está en esa rama (spec commiteado); el server se crea en Task 1. BE base: `main`.
- **BD remota compartida:** NUNCA `prisma migrate dev`/`reset`/`db push --force-reset`. Migración: `migrate diff` offline → limpiar ruido del SQL → backfill → `migrate deploy`.
- **Anclaje:** `ActaEntrega.cotizacionId` y `ActaRecepcion.cotizacionId` obligatorios (backfilleados); `facturaId` de ambos nullable.
- **Gate de creación de acta:** cotización `APROBADA`.
- **Sin cambiar** cuándo se compromete el inventario (sigue al aprobar la cotización).
- **UI 100% español.** Comentarios "why" en español. Tailwind sin valores arbitrarios.
- **Backend TDD** con vitest. **Baseline de fallos pre-existentes en main: 14** (reservas/RESERVADA, setPeriodosRenta, pdf rangoRenta) — ajenos. Gate = "mis tests pasan + sin fallos nuevos".
- **Frontend sin suite de tests** — verificación = `pnpm tsc --noEmit` + `pnpm lint`.
- **Verificación backend:** `npx tsc --noEmit` + `pnpm test`.
- **Commits** en español, terminando con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

## PARTE 1 — BACKEND (`/Users/joaquinmorales13a06/Desktop/Reinar/server`)

### Task 1: Migración — anclar acta/recepción a cotización, factura opcional

**Files:**
- Modify: `prisma/schema.prisma` (models `ActaEntrega`, `ActaRecepcion`, `Cotizacion`)
- Create: `prisma/migrations/20260705130000_acta_anclada_cotizacion/migration.sql`

**Interfaces:**
- Produces: `ActaEntrega.cotizacionId: string` (req) + `cotizacion` rel; `ActaEntrega.facturaId: string | null`; `ActaRecepcion.cotizacionId: string` (req) + rel; `ActaRecepcion.facturaId: string | null`; `Cotizacion.actas`, `Cotizacion.recepciones`. Tasks 2-8 consumen estos campos.

- [ ] **Step 1: Crear la rama en el server**

```bash
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server checkout main
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server pull
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server checkout -b feat/flujo-cotizacion-acta-factura
```

- [ ] **Step 2: Editar `prisma/schema.prisma`**

En `model ActaEntrega` (líneas ~750-792), cambiar el bloque de `facturaId` y agregar `cotizacionId`:

```prisma
  // Anclaje estable: el acta pertenece a la cotización. La factura es opcional
  // (puede crearse el acta antes de facturar: Cotización→Acta→Factura) y se
  // auto-vincula al generar la factura de esa cotización.
  cotizacionId String
  cotizacion   Cotizacion @relation("cotizacionActas", fields: [cotizacionId], references: [id])
  facturaId    String?
  factura      Factura?   @relation(fields: [facturaId], references: [id])
```
(reemplaza las 2 líneas actuales `facturaId String` + `factura Factura @relation(...)`.)

En `model ActaRecepcion` (líneas ~826-848), igual:

```prisma
  cotizacionId String
  cotizacion   Cotizacion @relation("cotizacionRecepciones", fields: [cotizacionId], references: [id])
  facturaId    String?
  factura      Factura?   @relation(fields: [facturaId], references: [id])
```

En `model Cotizacion` (líneas ~490-535), agregar las relaciones inversas (junto a las otras relaciones, ej. tras `factura Factura?`):

```prisma
  actas       ActaEntrega[]   @relation("cotizacionActas")
  recepciones ActaRecepcion[] @relation("cotizacionRecepciones")
```

Nota: la relación `renovaciones`/`actaEntregaOrigen` existente NO se toca (es otra relación nombrada). Verificá que las relaciones `Factura.actasEntrega`/`Factura.recepciones` sigan compilando con `facturaId` nullable (Prisma lo permite; el lado Factura no cambia de nombre).

- [ ] **Step 3: Generar el SQL offline**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
npx prisma validate
git show HEAD:prisma/schema.prisma > /tmp/schema-old.prisma
mkdir -p prisma/migrations/20260705130000_acta_anclada_cotizacion
npx prisma migrate diff --from-schema /tmp/schema-old.prisma --to-schema prisma/schema.prisma --script > prisma/migrations/20260705130000_acta_anclada_cotizacion/migration.sql
```

- [ ] **Step 4: Limpiar el SQL, ordenar y agregar backfill**

Borrar el ruido de stdout (`npm warn…`, `Loaded Prisma config…`) del inicio. El `migrate diff` generará las columnas como NOT NULL o con FKs en un orden que puede fallar sobre datos existentes; **reescribir** el archivo para que quede exactamente (verificá nombres reales de constraints que emita Prisma y conservá los `ADD CONSTRAINT ... FOREIGN KEY` que genere, solo reordenando):

```sql
-- 1) Columnas nullable primero
ALTER TABLE "ActaEntrega"   ADD COLUMN "cotizacionId" TEXT;
ALTER TABLE "ActaRecepcion" ADD COLUMN "cotizacionId" TEXT;

-- 2) Backfill desde la factura (1-a-1 con cotización)
UPDATE "ActaEntrega"   a SET "cotizacionId" = f."cotizacionId" FROM "Factura" f WHERE a."facturaId" = f."id";
UPDATE "ActaRecepcion" r SET "cotizacionId" = f."cotizacionId" FROM "Factura" f WHERE r."facturaId" = f."id";

-- 3) NOT NULL en cotizacionId + factura opcional
ALTER TABLE "ActaEntrega"   ALTER COLUMN "cotizacionId" SET NOT NULL;
ALTER TABLE "ActaRecepcion" ALTER COLUMN "cotizacionId" SET NOT NULL;
ALTER TABLE "ActaEntrega"   ALTER COLUMN "facturaId" DROP NOT NULL;
ALTER TABLE "ActaRecepcion" ALTER COLUMN "facturaId" DROP NOT NULL;

-- 4) FKs de cotizacionId (usar los nombres que Prisma emita en el diff)
ALTER TABLE "ActaEntrega"   ADD CONSTRAINT "ActaEntrega_cotizacionId_fkey"   FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActaRecepcion" ADD CONSTRAINT "ActaRecepcion_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 5: Regenerar cliente + ver fallout**

```bash
npx prisma generate
npx tsc --noEmit
```
Expected: errores de tipos donde el código asume `facturaId` NOT NULL (ej. `acta.factura.clienteId`, `acta.facturaId` pasado a funciones que esperan string). Anotá la lista — Tasks 2/4/5 los resuelven. NO los arregles todos acá; en esta task solo aseguramos que el schema/migración compilan y que `crearActa`/servicios siguen refiriéndose a campos válidos. Si hay errores que NO son de estas tasks (código no relacionado), resolvelos con guards mínimos.

- [ ] **Step 6: Aplicar la migración a la BD remota**

```bash
npx prisma migrate deploy
npx prisma migrate status
```
Expected: "up to date". Verificar con un probe que `ActaEntrega.cotizacionId` está poblado (no null) para las actas existentes.

- [ ] **Step 7: Commit**

```bash
git add prisma/
git commit -m "feat(actas): schema — acta/recepción ancladas a cotización, factura opcional

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Refactor `crearActa` para anclar en cotización

**Files:**
- Modify: `src/modules/actas/actas.service.ts:249-514` (`crearActa`)
- Modify: `src/modules/actas/actas.controller.ts:5-10` (`crear`)
- Test: `tests/modules/actas/actas.service.test.ts` (o el archivo de tests de actas existente)

**Interfaces:**
- Consumes: campos de Task 1.
- Produces: `crearActa(cotizacionId: string, facturaId: string | null, input: CrearActaInput, usuarioId: string)`. El controller factura-first resuelve `cotizacionId` desde la factura. Task 3 llama con `facturaId = null`.

- [ ] **Step 1: Escribir/ajustar los tests (RED)**

Leé el archivo de tests de actas para el patrón de mocks. Ajustá los tests existentes de `crearActa` a la nueva firma `crearActa(cotizacionId, facturaId, input, usuarioId)` y agregá:
- Un test: `crearActa` con cotización `APROBADA` y `facturaId = null` persiste el acta con `cotizacionId` seteado y `facturaId: null`.
- Un test: cotización con `estado !== 'APROBADA'` → 409 `ESTADO_INVALIDO`.
- Un test: anti-doble-despacho por `cotizacionId` (un ítem ya en otra acta de la misma cotización → 409 CONFLICT).

(Usá los mocks de prisma del archivo; mockeá `cotizacion.findUnique`, `cotizacionItem.findMany`, `actaEntregaItem.findMany`, `bodega.findUnique`, `$transaction`, `actaEntrega.create` según ya se haga.)

- [ ] **Step 2: RED**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm test tests/modules/actas/
```
Expected: FAIL por la firma/gate nuevos.

- [ ] **Step 3: Implementar el refactor de `crearActa`**

En `actas.service.ts`, cambiar la firma y las primeras ~40 líneas. Reemplazar el bloque de carga de factura (líneas 249-255) por carga de cotización:

```typescript
export async function crearActa(cotizacionId: string, facturaId: string | null, input: CrearActaInput, usuarioId: string) {
  const cotizacion = await prisma.cotizacion.findUnique({
    where:  { id: cotizacionId },
    select: { id: true, estado: true, clienteId: true },
  })
  if (!cotizacion) throw new AppError(404, 'NOT_FOUND', 'Cotización no encontrada')
  // Gate: solo se puede crear un acta sobre una cotización APROBADA (inventario ya comprometido).
  if (cotizacion.estado !== 'APROBADA') {
    throw new AppError(409, 'ESTADO_INVALIDO', 'Solo se puede crear un acta sobre una cotización APROBADA')
  }
```

Reemplazar `factura.cotizacionId` por `cotizacionId` en la carga de `cotizacionItem.findMany` (línea 278: `where: { cotizacionId }`).

En el anti-doble-despacho dentro de la transacción (líneas 300-306), cambiar el scope de factura a cotización:

```typescript
    const conflictos = await tx.actaEntregaItem.findMany({
      where: {
        actaEntrega:      { cotizacionId },
        cotizacionItemId: { in: cotizacionItemIds },
      },
      select: { cotizacionItemId: true },
    })
    if (conflictos.length > 0) {
      throw new AppError(409, 'CONFLICT', 'Uno o más ítems ya forman parte de otra acta de esta cotización')
    }
```

En el `tx.actaEntrega.create` (líneas ~484-500), setear `cotizacionId` y `facturaId` (nullable):

```typescript
      data: {
        numeroActa,
        cotizacionId,
        facturaId,             // puede ser null (flujo Cotización→Acta→Factura)
        bodegaOrigenId: input.bodegaOrigenId,
        // … resto de campos logísticos e items existentes SIN cambios …
      },
```

El resto del cuerpo (validación de bodega, ítems, inventario, auditLog) **no cambia** — solo se eliminó la dependencia de `factura`.

- [ ] **Step 4: Actualizar el controller factura-first**

En `actas.controller.ts`, `crear` (líneas 5-10) debe resolver `cotizacionId` desde la factura del path y pasar ambos:

```typescript
export async function crear(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const facturaId = req.params.facturaId as string
    const factura = await service.resolverCotizacionDeFactura(facturaId) // { cotizacionId } o 404/422 si ANULADA
    const acta = await service.crearActa(factura.cotizacionId, facturaId, req.body, req.user!.sub)
    res.status(201).json({ success: true, data: acta })
  } catch (err) { next(err) }
}
```

Agregar en `actas.service.ts` el helper `resolverCotizacionDeFactura(facturaId)`:

```typescript
// Resuelve la cotización de una factura y valida que no esté anulada. Usado por
// la ruta factura-first para mantener el gate histórico (no crear actas sobre
// una factura ANULADA) además del gate de cotización APROBADA.
export async function resolverCotizacionDeFactura(facturaId: string): Promise<{ cotizacionId: string }> {
  const factura = await prisma.factura.findUnique({ where: { id: facturaId }, select: { estado: true, cotizacionId: true } })
  if (!factura) throw new AppError(404, 'NOT_FOUND', 'Factura no encontrada')
  if (factura.estado === 'ANULADA') throw new AppError(422, 'ESTADO_INVALIDO', 'No se pueden crear actas sobre una factura anulada')
  return { cotizacionId: factura.cotizacionId }
}
```

- [ ] **Step 5: GREEN + typecheck**

```bash
pnpm test tests/modules/actas/ && npx tsc --noEmit
```
Expected: los tests de `crearActa` PASAN; tsc limpio (los usos factura-first siguen funcionando vía el controller).

- [ ] **Step 6: Commit**

```bash
git add src/modules/actas/ tests/modules/actas/
git commit -m "refactor(actas): crearActa ancla en cotización; factura opcional

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Rutas cotización-first para crear/listar actas

**Files:**
- Modify: `src/modules/actas/actas.routes.ts` (nuevo `actasCotizacionSubRouter`)
- Modify: `src/modules/actas/actas.controller.ts` (handler `crearDesdeCotizacion` + variantes que leen `cotizacionId`)
- Modify: `src/modules/cotizaciones/cotizaciones.routes.ts` (montar el subrouter)
- Modify: `src/modules/actas/actas.service.ts` (variantes de `listarItemsDisponiblesDespacho`/`bodegasConItemsDisponibles` por cotización, si hoy reciben facturaId)
- Test: `tests/modules/actas/` (rutas o service)

**Interfaces:**
- Consumes: `crearActa(cotizacionId, null, …)` (Task 2).
- Produces: `POST /cotizaciones/:cotizacionId/actas`, `GET /cotizaciones/:cotizacionId/actas/items-disponibles-despacho`, `GET /cotizaciones/:cotizacionId/actas/bodegas-con-items-disponibles`. Task 7/8 (frontend) los consume.

- [ ] **Step 1: Escribir tests (RED)**

Test de service: los helpers de items/bodegas disponibles resuelven por `cotizacionId`. (Si hoy `listarItemsDisponiblesDespacho(facturaId)` internamente resuelve `factura.cotizacionId`, refactorizar a `listarItemsDisponiblesDespacho(cotizacionId)` y que el controller factura-first resuelva la cotización primero.) Test: dado un cotizacionId, devuelve los ítems no despachados de esa cotización.

- [ ] **Step 2: RED**

```bash
pnpm test tests/modules/actas/
```

- [ ] **Step 3: Implementar el subrouter + controller**

En `actas.routes.ts`, agregar tras `recepcionesSubRouter`:

```typescript
// ── Subrouter montado en /cotizaciones/:cotizacionId/actas ────────────────────
export const actasCotizacionSubRouter = Router({ mergeParams: true })

actasCotizacionSubRouter.post(
  '/', authenticate, requireRol(...escritores), validate(crearActaSchema),
  ctrl.crearDesdeCotizacion,
)
actasCotizacionSubRouter.get(
  '/items-disponibles-despacho', authenticate, requireRol(...todos),
  ctrl.itemsDisponiblesDespachoCotizacion,
)
actasCotizacionSubRouter.get(
  '/bodegas-con-items-disponibles', authenticate, requireRol(...todos),
  ctrl.bodegasConItemsDisponiblesCotizacion,
)
```

En `actas.controller.ts`, agregar los handlers (leen `req.params.cotizacionId`):

```typescript
export async function crearDesdeCotizacion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const acta = await service.crearActa(req.params.cotizacionId as string, null, req.body, req.user!.sub)
    res.status(201).json({ success: true, data: acta })
  } catch (err) { next(err) }
}
export async function itemsDisponiblesDespachoCotizacion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const bodegaId = typeof req.query.bodegaId === 'string' ? req.query.bodegaId : undefined
    const items = await service.listarItemsDisponiblesDespacho(req.params.cotizacionId as string, bodegaId)
    res.json({ success: true, data: items })
  } catch (err) { next(err) }
}
export async function bodegasConItemsDisponiblesCotizacion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const bodegas = await service.bodegasConItemsDisponibles(req.params.cotizacionId as string)
    res.json({ success: true, data: bodegas })
  } catch (err) { next(err) }
}
```

Refactorizar `listarItemsDisponiblesDespacho`/`bodegasConItemsDisponibles` en el service para recibir `cotizacionId` (si hoy reciben `facturaId`, resolvían `factura.cotizacionId` — ahora reciben la cotización directo). Actualizar los handlers factura-first (`itemsDisponiblesDespacho`, `bodegasConItemsDisponibles`) para resolver `cotizacionId` vía `resolverCotizacionDeFactura(req.params.facturaId)` antes de llamar al service. Ajustar `listarActas` análogamente si filtra por facturaId (mantener el filtro factura-first y agregar el filtro por cotización cuando aplique).

- [ ] **Step 4: Montar el subrouter en cotizaciones**

En `src/modules/cotizaciones/cotizaciones.routes.ts`, importar y montar (mirar cómo se montan otros subrouters; seguir el patrón de `facturas.routes.ts` que hace `router.use('/:facturaId/actas', actasSubRouter)`):

```typescript
import { actasCotizacionSubRouter } from '../actas/actas.routes'
// … dentro del router de cotizaciones:
router.use('/:cotizacionId/actas', actasCotizacionSubRouter)
```

- [ ] **Step 5: GREEN + typecheck**

```bash
pnpm test tests/modules/actas/ && npx tsc --noEmit
```
Expected: PASS; tsc limpio.

- [ ] **Step 6: Commit**

```bash
git add src/modules/actas/ src/modules/cotizaciones/ tests/modules/actas/
git commit -m "feat(actas): rutas cotización-first para crear actas y consultar disponibles

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Sellado QUEDAN compartido + auto-vinculación al facturar + entrega sin factura

**Files:**
- Modify: `src/modules/actas/actas.service.ts` (`_entregar` ~701-764)
- Modify: `src/modules/facturas/facturas.service.ts` (`generarFacturaDesdeCotizacion`; nuevo helper `sellarEntregaQuedan`)
- Test: `tests/modules/facturas/facturas.service.test.ts`, `tests/modules/actas/`

**Interfaces:**
- Consumes: `Factura.plazoCredito`/`fechaVencimiento` (Grupo B); `ActaEntrega.cotizacionId`/`facturaId` (Task 1).
- Produces: `sellarEntregaQuedan(tx, factura, fechaEntrega)` (setea `fechaEntregaReal` + `fechaVencimiento` si aplica). `generarFacturaDesdeCotizacion` auto-vincula actas/recepciones y sella QUEDAN si hay acta entregada.

- [ ] **Step 1: Escribir tests (RED)**

- `sellarEntregaQuedan`: dado `factura.esQuedan` + `plazoCredito=30` + `fechaEntregaReal=null`, setea `fechaEntregaReal = fechaEntrega` y `fechaVencimiento = fechaEntrega + 30 días`. Si `!esQuedan` o ya hay `fechaEntregaReal`, no hace nada.
- `generarFacturaDesdeCotizacion`: si la cotización tiene un acta `ENTREGADO` con `fechaEntrega`, y la factura es QUEDAN, se llama `sellarEntregaQuedan` con esa fecha; y se hace `actaEntrega.updateMany({ where: { cotizacionId, facturaId: null }, data: { facturaId } })`. (Mockeá `tx.actaEntrega.findFirst`/`updateMany`.)
- `_entregar` (test de actas): cuando el acta tiene factura QUEDAN, sella fechaEntregaReal + vencimiento (no solo la fecha).

- [ ] **Step 2: RED**

```bash
pnpm test tests/modules/facturas/ tests/modules/actas/
```

- [ ] **Step 3: Implementar `sellarEntregaQuedan`**

En `facturas.service.ts` (exportado, para reusar desde actas):

```typescript
const MS_POR_DIA_SELLADO = 24 * 60 * 60 * 1000
// Sella la entrega física de una factura QUEDAN: fija fechaEntregaReal y, si hay
// plazo, calcula el vencimiento (plazo desde la entrega). Idempotente: no hace
// nada si no es QUEDAN o si ya se selló. Unifica el sellado desde el acta
// (_entregar) y desde la creación de factura con acta ya entregada.
export async function sellarEntregaQuedan(
  tx: Prisma.TransactionClient,
  factura: { id: string; esQuedan: boolean; fechaEntregaReal: Date | null; plazoCredito: number | null },
  fechaEntrega: Date,
): Promise<void> {
  if (!factura.esQuedan || factura.fechaEntregaReal) return
  const fechaVencimiento = factura.plazoCredito
    ? new Date(fechaEntrega.getTime() + factura.plazoCredito * MS_POR_DIA_SELLADO)
    : undefined
  await tx.factura.update({
    where: { id: factura.id },
    data: { fechaEntregaReal: fechaEntrega, ...(fechaVencimiento && { fechaVencimiento }) },
  })
}
```

- [ ] **Step 4: Wire en `generarFacturaDesdeCotizacion`**

Dentro del callback de la `$transaction` de `generarFacturaDesdeCotizacion` (facturas.service.ts), tras crear la factura y antes del `return { factura, warning }`:

```typescript
    // Auto-vincular actas/recepciones creadas antes de la factura (flujo Cotización→Acta→Factura).
    await tx.actaEntrega.updateMany({ where: { cotizacionId, facturaId: null }, data: { facturaId: factura.id } })
    await tx.actaRecepcion.updateMany({ where: { cotizacionId, facturaId: null }, data: { facturaId: factura.id } })

    // Si es QUEDAN y ya hay un acta entregada, sellar la entrega + vencimiento desde esa fecha.
    if (factura.esQuedan) {
      const actaEntregada = await tx.actaEntrega.findFirst({
        where: { cotizacionId, estado: 'ENTREGADO', fechaEntrega: { not: null } },
        orderBy: { fechaEntrega: 'asc' },
        select: { fechaEntrega: true },
      })
      if (actaEntregada?.fechaEntrega) {
        await sellarEntregaQuedan(tx, { id: factura.id, esQuedan: true, fechaEntregaReal: null, plazoCredito: factura.plazoCredito }, actaEntregada.fechaEntrega)
      }
    }
```

- [ ] **Step 5: Wire en `_entregar` (entrega sin factura + vencimiento)**

En `actas.service.ts` `_entregar`: la firma recibe `acta` — asegurate de que traiga `cotizacionId`, `facturaId` y la cotización cliente. Cambiar la validación del receptor a la cotización, y el sellado QUEDAN a `sellarEntregaQuedan`:

```typescript
  // Validar receptor contra el cliente de la cotización (idéntico a la factura cuando existe).
  if (input.contactoReceptorId) {
    const contacto = await tx.contacto.findUnique({ where: { id: input.contactoReceptorId }, select: { clienteId: true } })
    if (!contacto || contacto.clienteId !== acta.cotizacion.clienteId) {
      throw new AppError(422, 'VALIDATION_ERROR', 'El contacto receptor no pertenece al cliente')
    }
  }
```
Y reemplazar el bloque de sellado QUEDAN (líneas ~736-753) por: solo si `acta.facturaId` no es null, cargar la factura con `{ id, esQuedan, fechaEntregaReal, plazoCredito }` y llamar `await sellarEntregaQuedan(tx, factura, fechaEntrega)`. El `auditLog MARCAR_ENTREGADA_AUTO` se mantiene dentro de ese `if`.

Asegurate de que la carga del `acta` que alimenta `_entregar` incluya `cotizacion: { select: { clienteId: true } }` y `facturaId`.

- [ ] **Step 6: GREEN + typecheck**

```bash
pnpm test tests/modules/facturas/ tests/modules/actas/ && npx tsc --noEmit
```
Expected: PASS; tsc limpio.

- [ ] **Step 7: Commit**

```bash
git add src/modules/facturas/ src/modules/actas/ tests/modules/
git commit -m "feat(actas): sellado QUEDAN compartido, auto-vínculo al facturar, entrega sin factura

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: `registrarRecepcion` por cotización (devolución sin factura)

**Files:**
- Modify: `src/modules/actas/actas.service.ts` (`registrarRecepcion` ~818+)
- Modify: `src/modules/actas/actas.controller.ts` (`crearRecepcion` + variante cotización)
- Modify: `src/modules/actas/actas.routes.ts` (subrouter recepciones cotización) + `cotizaciones.routes.ts`
- Test: `tests/modules/actas/`

**Interfaces:**
- Consumes: `ActaRecepcion.cotizacionId`/`facturaId` nullable (Task 1).
- Produces: `registrarRecepcion(cotizacionId, facturaId | null, input, usuarioId)`; `POST /cotizaciones/:cotizacionId/recepciones`.

- [ ] **Step 1: Escribir tests (RED)**

Test: `registrarRecepcion(cotizacionId, null, …)` filtra los ítems por `actaEntrega: { cotizacionId }`, crea `ActaRecepcion` con `cotizacionId` y `facturaId: null`, reintegra stock/equipos. Ajustar los tests existentes a la nueva firma.

- [ ] **Step 2: RED**

```bash
pnpm test tests/modules/actas/
```

- [ ] **Step 3: Implementar**

Cambiar la firma a `registrarRecepcion(cotizacionId: string, facturaId: string | null, input, usuarioId)`. En el `findMany` de ítems (línea ~831-834) cambiar `actaEntrega: { facturaId }` por `actaEntrega: { cotizacionId }`. En la creación de `ActaRecepcion` setear `cotizacionId` y `facturaId` (nullable). El resto (reintegro de stock/equipos, recálculo de estado) no cambia.

Controller: `crearRecepcion` (factura-first) resuelve `cotizacionId` vía `resolverCotizacionDeFactura(req.params.facturaId)` y pasa `(cotizacionId, facturaId, …)`. Nuevo `crearRecepcionDesdeCotizacion` pasa `(req.params.cotizacionId, null, …)`.

Rutas: nuevo `recepcionesCotizacionSubRouter` con `POST /` → `ctrl.crearRecepcionDesdeCotizacion`; montar en `cotizaciones.routes.ts` como `/:cotizacionId/recepciones`.

- [ ] **Step 4: GREEN + typecheck**

```bash
pnpm test tests/modules/actas/ && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/actas/ src/modules/cotizaciones/ tests/modules/actas/
git commit -m "feat(actas): registrarRecepcion por cotización; devolución sin factura

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Bloquear anulación de factura con actas en curso

**Files:**
- Modify: `src/modules/facturas/facturas.service.ts` (`cambiarEstado`, rama ANULADA)
- Test: `tests/modules/facturas/facturas.service.test.ts`

**Interfaces:**
- Consumes: `Cotizacion.actas` (Task 1).

- [ ] **Step 1: Escribir tests (RED)**

- Anular una factura cuya cotización tiene un acta `DESPACHADO`/`ENTREGADO`/`DEVUELTA_PARCIAL` → 409 `ACTA_EN_CURSO`; `invalidarDTE`/update no se llaman.
- Anular una factura cuya cotización solo tiene actas `PENDIENTE` (o ninguna) → procede normal.

- [ ] **Step 2: RED**

```bash
pnpm test tests/modules/facturas/facturas.service.test.ts
```

- [ ] **Step 3: Implementar**

En `cambiarEstado` (facturas.service.ts), en la rama `nuevoEstado === 'ANULADA'` (antes de invalidar el DTE y de la transacción de cascada), agregar:

```typescript
    // No se puede anular la factura si ya salió mercadería: hay que registrar
    // la devolución primero. Solo actas PENDIENTE no bloquean.
    const actaEnCurso = await prisma.actaEntrega.findFirst({
      where: {
        factura: { id },
        estado: { in: ['DESPACHADO', 'ENTREGADO', 'DEVUELTA_PARCIAL'] },
      },
      select: { id: true, numeroActa: true },
    })
    if (actaEnCurso) {
      throw new AppError(409, 'ACTA_EN_CURSO', `No se puede anular: el acta ${actaEnCurso.numeroActa} ya tiene mercadería despachada/entregada. Registrá primero la devolución.`)
    }
```
(Usar `factura: { id }` o `facturaId: id` según cómo esté disponible; el acta ahora tiene `facturaId` nullable, así que filtrar por `facturaId: id` es correcto para actas ya vinculadas.)

- [ ] **Step 4: GREEN + typecheck**

```bash
pnpm test tests/modules/facturas/ && npx tsc --noEmit
```

- [ ] **Step 5: Correr suite completa**

```bash
pnpm test
```
Expected: sin fallos nuevos más allá del baseline de 14.

- [ ] **Step 6: Commit**

```bash
git add src/modules/facturas/ tests/modules/facturas/
git commit -m "feat(facturas): bloquear anulación si hay actas con mercadería en curso

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## PARTE 2 — FRONTEND (`/Users/joaquinmorales13a06/Desktop/Reinar/frontend`, rama ya creada)

### Task 7: Tipos, hooks y `SelectorCotizacion`

**Files:**
- Modify: `types/api.ts` (tipo `Acta`: `cotizacionId`, `facturaId: string | null`)
- Modify: `hooks/use-actas.ts` (hooks por cotización)
- Create: `components/actas-recepciones/SelectorCotizacion.tsx`

**Interfaces:**
- Consumes: rutas `/cotizaciones/:id/actas...` (Tasks 3/5).
- Produces: `useCrearActaDesdeCotizacion`, `useItemsDisponiblesDespachoCotizacion`, `useBodegasConItemsDisponiblesCotizacion`, `<SelectorCotizacion>`. Task 8 los consume.

- [ ] **Step 1: Tipos**

En `types/api.ts`, en el tipo `Acta` (y `ActaListItem` si aplica): `facturaId: string | null;` y agregar `cotizacionId: string;`. Donde el acta embebe la factura, hacerla opcional (`factura?: {...} | null`) y agregar `cotizacion: { id: string; numeroCotizacion: string }`.

- [ ] **Step 2: Hooks**

En `hooks/use-actas.ts`, agregar (siguiendo el patrón de los hooks factura-first existentes):

```typescript
export function useCrearActaDesdeCotizacion(cotizacionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CrearActaDto) =>
      api.post<ApiResponse<Acta>>(`/cotizaciones/${cotizacionId}/actas`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['actas'] });
      qc.invalidateQueries({ queryKey: ['cotizaciones', cotizacionId] });
      toast.success('Acta de entrega creada.');
    },
    onError: (err) => { toast.error(extractErrorMessage(err, 'No se pudo crear el acta.')); },
  });
}

export function useItemsDisponiblesDespachoCotizacion(cotizacionId: string | null, bodegaId?: string) {
  return useQuery({
    queryKey: ['items-disponibles-despacho-cotizacion', cotizacionId, bodegaId],
    queryFn: () => api.get(`/cotizaciones/${cotizacionId}/actas/items-disponibles-despacho`, { params: bodegaId ? { bodegaId } : {} }).then((r) => r.data.data),
    enabled: !!cotizacionId,
  });
}

export function useBodegasConItemsDisponiblesCotizacion(cotizacionId: string | null) {
  return useQuery({
    queryKey: ['bodegas-con-items-cotizacion', cotizacionId],
    queryFn: () => api.get(`/cotizaciones/${cotizacionId}/actas/bodegas-con-items-disponibles`).then((r) => r.data.data),
    enabled: !!cotizacionId,
  });
}
```
(Adaptar tipos de retorno a los que ya usan los hooks factura-first equivalentes.)

- [ ] **Step 3: `SelectorCotizacion`**

Crear `components/actas-recepciones/SelectorCotizacion.tsx` espejando `SelectorFactura.tsx` pero sobre `useCotizaciones({ estado: 'APROBADA', limit: 100 })` (typeahead por número/cliente). Props: `value`, `onChange(cotizacionId)`, opcional `filter`.

- [ ] **Step 4: Typecheck + lint**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm tsc --noEmit && pnpm lint
```
Expected: puede haber errores en `actas/nueva` (consume estos hooks) que Task 8 cierra; 0 errores en los archivos de esta task.

- [ ] **Step 5: Commit**

```bash
git add types/api.ts hooks/use-actas.ts components/actas-recepciones/SelectorCotizacion.tsx
git commit -m "feat(actas): tipos, hooks y SelectorCotizacion para el flujo cotización-first

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: `actas/nueva` desde cotización + botón en detalle + detalle/PDF tolerante

**Files:**
- Modify: `app/(dashboard)/actas/nueva/page.tsx`
- Modify: `lib/schemas/acta.ts` (facturaId XOR cotizacionId)
- Modify: `components/cotizaciones/detalle/AccionesEstado.tsx` (botón "Crear acta de entrega")
- Modify: `components/actas/...` detalle (mostrar cotización siempre, factura si existe)

**Interfaces:**
- Consumes: hooks/selector de Task 7.

- [ ] **Step 1: Schema XOR**

En `lib/schemas/acta.ts`, cambiar el schema para aceptar `facturaId` **o** `cotizacionId` (uno de los dos, no ambos requeridos): quitar el `min(1)` obligatorio de `facturaId`, agregar `cotizacionId` opcional, y un `.refine` que exija exactamente uno.

- [ ] **Step 2: `actas/nueva`**

En `app/(dashboard)/actas/nueva/page.tsx`: leer `?cotizacionId=` además de `?facturaId=`. Si viene `cotizacionId` (o no viene factura), usar `<SelectorCotizacion>` y los hooks `…Cotizacion`, y `useCrearActaDesdeCotizacion` en el submit. Si viene `facturaId`, el flujo actual intacto. La sección logística (bodegas/ítems disponibles) usa la variante por cotización cuando corresponde. Mostrar en el encabezado si el acta se crea "desde cotización (sin factura aún)".

- [ ] **Step 3: Botón en el detalle de cotización**

En `components/cotizaciones/detalle/AccionesEstado.tsx`, cuando `cotizacion.estado === 'APROBADA'` y el rol no es VISUALIZADOR, agregar botón "Crear acta de entrega" → `router.push('/actas/nueva?cotizacionId=' + cotizacion.id)`. (Ubicarlo junto a los botones de acción existentes.)

- [ ] **Step 4: Detalle/PDF del acta tolerante a factura nula**

En el componente de detalle del acta (y donde se arme el contexto del PDF), mostrar la **cotización origen** siempre; la factura solo si `acta.factura`/`acta.facturaId` existe (si no, "Aún sin factura"). Revisar `components/facturas/detalle/ActasVinculadasCard.tsx` y el detalle del acta para no romper cuando `facturaId` es null.

- [ ] **Step 5: Typecheck + lint**

```bash
pnpm tsc --noEmit && pnpm lint
```
Expected: 0 errores de tsc; lint sin issues nuevos.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/actas/" lib/schemas/acta.ts components/
git commit -m "feat(actas): crear acta desde cotización aprobada; UI tolerante a factura opcional

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Verificación end-to-end, push y PRs

**Files:** ninguno nuevo.

- [ ] **Step 1: Verificación estática final**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm test && npx tsc --noEmit
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit && pnpm lint
```
Expected: server tsc limpio; `pnpm test` sin fallos nuevos más allá del baseline de 14; frontend tsc 0, lint sin issues nuevos.

- [ ] **Step 2: Prueba manual end-to-end (backend :3000, frontend :3001)**

1. **Cotización→Acta→Factura:** aprobar una cotización → "Crear acta de entrega" desde su detalle → crear acta (sin factura) → despachar → entregar (receptor validado por cliente de la cotización) → generar la factura de esa cotización → verificar que el acta quedó auto-vinculada (facturaId poblado) y, si es QUEDAN, que el vencimiento se calculó desde la entrega del acta.
2. **Cotización→Factura→Acta (regresión):** el flujo actual (crear acta desde el detalle de factura) sigue funcionando igual.
3. **Devolución sin factura:** registrar una recepción sobre un acta entregada sin factura.
4. **Anulación bloqueada:** intentar anular una factura con un acta ya despachada → 409 con mensaje claro.

- [ ] **Step 3: Push y PRs**

```bash
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server push -u origin feat/flujo-cotizacion-acta-factura
git -C /Users/joaquinmorales13a06/Desktop/Reinar/frontend push -u origin feat/flujo-cotizacion-acta-factura
```

Crear los PRs con `gh pr create` (título: `feat(actas): flujo Cotización→Acta→Factura`), cuerpo con resumen del spec y checklist, terminando con:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

**Orden de merge:** server primero (la migración ya está aplicada), luego frontend.
