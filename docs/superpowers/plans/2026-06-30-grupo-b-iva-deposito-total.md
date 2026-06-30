# Grupo B — IVA exento, depósito y total de cotización · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Soportar cotizaciones exentas de IVA (toggle por cotización → IVA 0 → DTE `EXENTA`), y mostrar el total con depósito en el PDF y en pantalla de cotización con dos líneas claras (sin/con depósito), sin alterar la factura ni el DTE en cuanto al depósito (items 4, 5, 8).

**Architecture:** Se agrega un campo explícito `exentoIva Boolean` a `Cotizacion` y `Factura` (no se reutiliza `porcentajeIva=0`, para distinguir "exenta" de "gravada al 0%" en el DTE). El cálculo de totales pone `montoIva=0` cuando es exenta; el DTE marca los ítems `EXENTA`. El "total con depósito" es display-only (suma `total + depositoMonto`) en PDF y pantalla; el `total` guardado nunca incluye depósito, así la factura lo hereda sin depósito (item 8, ya correcto).

**Tech Stack:** Backend Express + Prisma (`/Users/joaquinmorales13a06/Desktop/Reinar/server`). Frontend Next.js 19 + React Hook Form + Zod + decimal.js + Handlebars PDFs. FacturaLlama para DTE.

## Global Constraints

- Branch única para todo el feedback: `feat/feedback-reinar` (ya creada en ambos repos).
- Sin suite de tests. Verificación: backend `npx tsc --noEmit` (+ `npx prisma validate`); frontend `pnpm tsc --noEmit`. Más flujos manuales por tarea.
- Montos Decimal como strings; operar con `decimal.js` (`new Decimal(...)`), nunca `parseFloat`. Mostrar con `formatCurrency` de `lib/utils.ts`.
- `porcentajeIva` llega al frontend como **number**; `subtotal/montoIva/total/depositoMonto` como **strings Decimal**.
- IVA default 13%. Categoría fiscal del DTE para exentas: `saleType: 'EXENTA'`.
- Idioma 100% español en UI/copy/comentarios. Comentarios solo "why".
- Tailwind: solo clases predefinidas, sin valores arbitrarios.
- Commits frecuentes, uno por tarea; cada commit compila.
- La migración de este grupo es **aditiva** (dos columnas boolean con default `false`); el esquema puede cambiarse primero sin romper el código existente. Aplicación a la BD remota compartida = decisión del usuario (la maneja el controlador en ejecución).

---

## File Structure

**Backend (`server/`):**
- Modify: `prisma/schema.prisma` (+ nueva migración) — `exentoIva` en `Cotizacion` y `Factura`.
- Modify: `src/modules/cotizaciones/cotizaciones.service.ts` — `_recalcularTotales` (IVA 0 si exenta), `crearCotizacion`/`actualizarCotizacion` (persistir + recalcular).
- Modify: `src/modules/cotizaciones/cotizaciones.schemas.ts` — `exentoIva` en Zod base.
- Modify: `src/modules/facturas/facturas.service.ts` — copiar `exentoIva` a la factura.
- Modify: `src/modules/facturallama/facturallama.service.ts` — `buildItems` con `saleType` EXENTA/GRAVADA.
- Modify: `src/modules/pdf/pdf.service.ts` + `templates/cotizacion.hbs` + `templates/factura.hbs` — exento + total con depósito.

**Frontend (`frontend/`):**
- Modify: `types/api.ts` — `exentoIva` en `Cotizacion`, `Factura`, `CrearCotizacionDto`.
- Modify: `lib/schemas/cotizacion.ts` — `exentoIva` en `step3Schema`.
- Modify: `components/cotizaciones/wizard/Step3Terminos.tsx` — toggle + preview.
- Modify: `components/cotizaciones/wizard/Step4Resumen.tsx`, `components/cotizaciones/detalle/ItemsTabla.tsx`, `components/facturas/detalle/ItemsFacturadosCard.tsx` — rótulo exento + línea total con depósito.

---

## Tarea 1: Schema Prisma + migración (backend)

Agrega el campo `exentoIva` a ambos modelos. Aditivo, así que va primero: el resto de las tareas backend leen/escriben el campo.

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: migración bajo `server/prisma/migrations/`

**Interfaces:**
- Produces: `Cotizacion.exentoIva: boolean`, `Factura.exentoIva: boolean` (default `false`) en el cliente Prisma.

- [ ] **Step 1: Editar `schema.prisma`**

En `model Cotizacion`, agregar la línea justo después de `porcentajeIva`:

```prisma
  porcentajeIva      Decimal  @default(13.00) @db.Decimal(5, 2)
  exentoIva          Boolean  @default(false) // venta exenta de IVA (ignora porcentajeIva; montoIva=0)
```

En `model Factura`, agregar la línea justo después de `porcentajeIva`:

```prisma
  porcentajeIva  Decimal @db.Decimal(5, 2)
  exentoIva      Boolean @default(false) // copiado de la cotización; marca el DTE como EXENTA
```

- [ ] **Step 2: Validar el schema**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid`.

- [ ] **Step 3: Generar la migración offline (sin tocar la BD)**

La BD es remota y compartida; NO usar `migrate dev` (necesita shadow DB y se cuelga). Generar el SQL con `migrate diff` desde el schema commiteado al editado:

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git show HEAD:prisma/schema.prisma > /tmp/schema-old-b.prisma
mkdir -p prisma/migrations/20260630130000_exento_iva
npx prisma migrate diff --from-schema /tmp/schema-old-b.prisma --to-schema prisma/schema.prisma --script > prisma/migrations/20260630130000_exento_iva/migration.sql
cat prisma/migrations/20260630130000_exento_iva/migration.sql
```

Expected: dos `ALTER TABLE ... ADD COLUMN "exentoIva" BOOLEAN NOT NULL DEFAULT false;` (Cotizacion y Factura). Si el SQL contiene cualquier `DROP`, DETENER y reportar — debería ser puramente aditivo.

- [ ] **Step 4: Regenerar el cliente Prisma offline y verificar compilación**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
npx prisma generate
npx tsc --noEmit
```
Expected: cliente generado; tsc sin errores (el campo nuevo es opcional para el código existente).

- [ ] **Step 5: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add prisma/schema.prisma prisma/migrations/20260630130000_exento_iva/
git commit -m "feat(prisma): agregar exentoIva a Cotizacion y Factura (migración aditiva)"
```

(La aplicación a la BD remota con `prisma migrate deploy` la maneja el controlador en ejecución; NO la apliques tú.)

---

## Tarea 2: Cálculo de totales y persistencia de exentoIva (backend)

**Files:**
- Modify: `server/src/modules/cotizaciones/cotizaciones.service.ts` (`_recalcularTotales` líneas 46-61; `crearCotizacion` 130-188; `actualizarCotizacion` 192-258)
- Modify: `server/src/modules/cotizaciones/cotizaciones.schemas.ts` (`crearCotizacionBase` líneas 19-33)

**Interfaces:**
- Consumes: `Cotizacion.exentoIva` (Tarea 1).
- Produces: cotización con `montoIva=0` y `total=subtotal` cuando `exentoIva`; campo persistido en crear/actualizar.

- [ ] **Step 1: `_recalcularTotales` — IVA 0 cuando exenta**

Reemplazar el cuerpo (líneas 46-61) por:

```typescript
async function _recalcularTotales(cotizacionId: string, tx: Prisma.TransactionClient): Promise<void> {
  const [items, cotizacion] = await Promise.all([
    tx.cotizacionItem.findMany({ where: { cotizacionId }, select: { subtotal: true } }),
    tx.cotizacion.findUniqueOrThrow({ where: { id: cotizacionId }, select: { porcentajeIva: true, depositoPorcentaje: true, exentoIva: true } }),
  ])

  const subtotal      = items.reduce((acc, i) => acc.add(i.subtotal), new Decimal(0))
  // Venta exenta: IVA en 0 sin importar porcentajeIva (la categoría fiscal va al DTE como EXENTA).
  const montoIva      = cotizacion.exentoIva
    ? new Decimal(0)
    : subtotal.mul(cotizacion.porcentajeIva).div(100).toDecimalPlaces(2)
  const total         = subtotal.add(montoIva)
  const depositoMonto = cotizacion.depositoPorcentaje
    ? total.mul(cotizacion.depositoPorcentaje).div(100).toDecimalPlaces(2)
    : undefined

  await tx.cotizacion.update({ where: { id: cotizacionId }, data: { subtotal, montoIva, total, depositoMonto } })
}
```

- [ ] **Step 2: `crearCotizacion` — aceptar y persistir exentoIva**

En la firma `data: { ... }` de `crearCotizacion` (líneas 131-145), agregar el campo:

```typescript
    porcentajeIva?: number
    exentoIva?: boolean
    fechaVencimiento?: string
```

En el objeto `tx.cotizacion.create({ data: {...} })`, agregar después de `porcentajeIva`:

```typescript
        porcentajeIva:         data.porcentajeIva ?? 13,
        exentoIva:             data.exentoIva ?? false,
```

- [ ] **Step 3: `actualizarCotizacion` — persistir exentoIva y recalcular si cambia IVA**

En la firma `data: { ... }` de `actualizarCotizacion` (líneas 194-208), agregar:

```typescript
    porcentajeIva?: number
    exentoIva?: boolean
    fechaVencimiento?: string
```

En el `tx.cotizacion.update({ data: {...} })`, agregar después de `porcentajeIva`:

```typescript
        porcentajeIva:         data.porcentajeIva,
        exentoIva:             data.exentoIva,
```

Y, dentro de la misma transacción, DESPUÉS del `tx.auditLog.create(...)`, agregar el recálculo cuando cambia algo que afecta el IVA (hoy `actualizarCotizacion` no recalcula totales; el toggle exento no toca ítems, así que sin esto el total quedaría obsoleto):

```typescript
    // Si cambió el IVA o la exención, recalculamos montoIva/total con los ítems
    // actuales (actualizarCotizacion no toca ítems, por eso hay que forzarlo).
    if (data.porcentajeIva !== undefined || data.exentoIva !== undefined) {
      await _recalcularTotales(id, tx)
    }
```

- [ ] **Step 4: Zod schema — agregar exentoIva**

En `cotizaciones.schemas.ts`, en `crearCotizacionBase` (después de `porcentajeIva`, línea 28), agregar:

```typescript
  porcentajeIva:          z.number().min(0).max(100).default(13),
  exentoIva:              z.boolean().optional(),
```

(`actualizarCotizacionSchema` deriva de la base con `.partial()`, así que hereda `exentoIva` automáticamente.)

- [ ] **Step 5: Verificar y commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx tsc --noEmit
```
Expected: sin errores.

```bash
git add src/modules/cotizaciones/cotizaciones.service.ts src/modules/cotizaciones/cotizaciones.schemas.ts
git commit -m "feat(cotizaciones): exentoIva ceroa el IVA y se persiste/recalcula"
```

---

## Tarea 3: Copiar exentoIva a la factura (backend)

**Files:**
- Modify: `server/src/modules/facturas/facturas.service.ts` (`generarFacturaDesdeCotizacion`, bloque create líneas 375-391)

**Interfaces:**
- Consumes: `Cotizacion.exentoIva`.
- Produces: `Factura.exentoIva` poblado al generar la factura.

- [ ] **Step 1: Agregar exentoIva al create de la factura**

En el `tx.factura.create({ data: {...} })`, agregar después de `porcentajeIva: cotizacion.porcentajeIva,`:

```typescript
        porcentajeIva:         cotizacion.porcentajeIva,
        exentoIva:             cotizacion.exentoIva,
        montoIva:              cotizacion.montoIva,
```

- [ ] **Step 2: Verificar y commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx tsc --noEmit
```
Expected: sin errores. (`cotizacion` se carga con `findUnique` sin `select`, así que incluye todos los escalares incluido `exentoIva`.)

```bash
git add src/modules/facturas/facturas.service.ts
git commit -m "feat(facturas): heredar exentoIva de la cotización al generar factura"
```

---

## Tarea 4: DTE — ítems EXENTA cuando la factura es exenta (backend)

**Files:**
- Modify: `server/src/modules/facturallama/facturallama.service.ts` (`buildItems` líneas 133-168; llamadas en 276, 340, 408, 506)

**Interfaces:**
- Consumes: `Factura.exentoIva`.
- Produces: payload DTE con `saleType: 'EXENTA'` por ítem cuando la factura es exenta.

- [ ] **Step 1: Agregar parámetro `exentoIva` a `buildItems`**

Cambiar la firma y el `saleType`. Reemplazar la firma (líneas 133-143) para agregar el parámetro `exentoIva` antes de `documentNumber`:

```typescript
function buildItems(
  items: Array<{
    tipo: string
    descripcion: string
    cantidadUnidades: number
    cantidadDias: number
    periodo: string
    periodoCustomLabel: string | null
    tarifaAplicada: { toString(): string } | string
  }>,
  exentoIva: boolean,
  documentNumber?: string,
): ItemDTEPayload[] {
```

Y dentro del `return { ... }` (línea ~162), cambiar:

```typescript
      saleType: exentoIva ? ('EXENTA' as const) : ('GRAVADA' as const),
```

- [ ] **Step 2: Pasar `exentoIva` en cada llamada**

- Línea 276 (`emitirFC`): `items: buildItems(factura.cotizacion.items, factura.exentoIva),`
- Línea 340 (`emitirCCF`): `items: buildItems(factura.cotizacion.items, factura.exentoIva),`
- Línea 408 (`emitirSujetoExcluido`): `items: buildItems(factura.cotizacion.items, factura.exentoIva),`
- Línea 506 (`emitirNC`): `? buildItems(nc.factura.cotizacion.items, nc.factura.exentoIva, originalDteId)`

- [ ] **Step 3: Confirmar que `factura`/`nc.factura` incluyen `exentoIva`**

Buscar cómo se cargan `factura` y `nc.factura` en este archivo:

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && grep -n "findUnique\|findFirst\|select:\|include:" src/modules/facturallama/facturallama.service.ts | head -40
```

Si la factura se carga con `select`, agregar `exentoIva: true` a ese select. Si se carga con `include` (o sin select de la factura), `exentoIva` ya viene como escalar — no hace falta cambiar nada. Confirmar leyendo las consultas en `emitirFC/CCF/SujetoExcluido/NC`.

- [ ] **Step 4: Verificar y commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx tsc --noEmit
```
Expected: sin errores.

```bash
git add src/modules/facturallama/facturallama.service.ts
git commit -m "feat(dte): marcar ítems como EXENTA cuando la factura es exenta de IVA"
```

---

## Tarea 5: PDFs — exento y total con depósito (backend)

**Files:**
- Modify: `server/src/modules/pdf/pdf.service.ts` (totales cotización 362-369; contexto factura)
- Modify: `server/src/modules/pdf/templates/cotizacion.hbs` (totales 611-618)
- Modify: `server/src/modules/pdf/templates/factura.hbs` (totales 512-536)

**Interfaces:**
- Consumes: `Cotizacion.exentoIva`, `Factura.exentoIva`.

- [ ] **Step 1: pdf.service — datos de cotización (exento + total con depósito)**

Reemplazar el objeto `totales` de `generarCotizacionPDF` (líneas 362-369) por:

```typescript
    exentoIva: cotizacion.exentoIva,
    totales: {
      subtotal:        formatMonto(cotizacion.subtotal),
      iva:             formatMonto(cotizacion.montoIva),
      total:           formatMonto(cotizacion.total),
      deposito:        cotizacion.depositoMonto
                         ? formatMonto(cotizacion.depositoMonto)
                         : null,
      totalConDeposito: cotizacion.depositoMonto
                         ? formatMonto(new Decimal(String(cotizacion.total)).add(String(cotizacion.depositoMonto)))
                         : null,
    },
```

(Confirmar que `Decimal` está importado en el archivo — `pdf.service.ts` ya usa `new Decimal(String(factura.saldoPendiente))` en los totales de factura, así que el import existe. `porcentajeIva` ya se pasa al contexto de la plantilla por separado; no se toca.)

- [ ] **Step 2: cotizacion.hbs — línea IVA exento + TOTAL con depósito**

Reemplazar el bloque de totales (líneas 611-618) por:

```handlebars
                <div class="totales-block">
                  <div class="row"><span>Subtotal</span><span class="mono">{{totales.subtotal}}</span></div>
                  <div class="row"><span>{{#if exentoIva}}Exento de IVA{{else}}IVA ({{porcentajeIva}}%){{/if}}</span><span class="mono">{{totales.iva}}</span></div>
                  <div class="row total"><span>TOTAL{{#if totales.deposito}} (sin depósito){{/if}}</span><span class="mono">{{totales.total}}</span></div>
                  {{#if totales.deposito}}
                  <div class="row deposito"><span>Depósito requerido</span><span class="mono">{{totales.deposito}}</span></div>
                  <div class="row total"><span>TOTAL CON DEPÓSITO</span><span class="mono">{{totales.totalConDeposito}}</span></div>
                  {{/if}}
                </div>
```

- [ ] **Step 3: pdf.service — exponer exentoIva en el contexto de factura**

Buscar el objeto `factura: { ... }` que `generarFacturaPDF` pasa a la plantilla (donde están `esCCF`, `esQuedan`, etc.):

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && grep -n "esCCF\|esQuedan" src/modules/pdf/pdf.service.ts | head
```

Agregar `exentoIva: factura.exentoIva,` a ese objeto `factura` del contexto (junto a `esCCF`).

- [ ] **Step 4: factura.hbs — línea IVA exento**

Reemplazar la fila de IVA (líneas 517-520) por una con rama exento (Handlebars no soporta `else if`, usar `if` anidado):

```handlebars
      <div class="tot-row {{#unless factura.esCCF}}tot-row--note{{/unless}}">
        <span class="tot-label">{{#if factura.exentoIva}}Exento de IVA{{else}}{{#if factura.esCCF}}IVA (13%){{else}}IVA incluido en el precio{{/if}}{{/if}}</span>
        <span class="tot-val">{{totales.iva}}</span>
      </div>
```

(No se agrega depósito a la factura — item 8, sin cambios.)

- [ ] **Step 5: Verificar y commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx tsc --noEmit
```
Expected: sin errores.

```bash
git add src/modules/pdf/pdf.service.ts src/modules/pdf/templates/cotizacion.hbs src/modules/pdf/templates/factura.hbs
git commit -m "feat(pdf): exento de IVA y total con depósito en cotización; exento en factura"
```

---

## Tarea 6: Tipos frontend (exentoIva)

**Files:**
- Modify: `frontend/types/api.ts` (`Cotizacion` ~808; `Factura` ~1078; `CrearCotizacionDto` ~842-857)

**Interfaces:**
- Produces: `Cotizacion.exentoIva: boolean`, `Factura.exentoIva: boolean`, `CrearCotizacionDto.exentoIva?: boolean`.

- [ ] **Step 1: Agregar `exentoIva` a los tipos**

En `type Cotizacion`, después de `porcentajeIva: number;`:

```typescript
  porcentajeIva: number;
  exentoIva: boolean;
```

En `type Factura`, después de `porcentajeIva: string;`:

```typescript
  porcentajeIva: string;
  exentoIva: boolean;
```

En `type CrearCotizacionDto`, después de `porcentajeIva?: number;`:

```typescript
  porcentajeIva?: number;
  exentoIva?: boolean;
```

(`ActualizarCotizacionDto = Partial<CrearCotizacionDto>` lo hereda.)

- [ ] **Step 2: Verificar y commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit
```
Expected: sin errores.

```bash
git add types/api.ts
git commit -m "feat(types): exentoIva en Cotizacion, Factura y CrearCotizacionDto"
```

---

## Tarea 7: Wizard Paso 3 — toggle "Exento de IVA" (frontend)

**Files:**
- Modify: `frontend/lib/schemas/cotizacion.ts` (`step3Schema` líneas 18-39)
- Modify: `frontend/components/cotizaciones/wizard/Step3Terminos.tsx`

**Interfaces:**
- Consumes: `Cotizacion.exentoIva`, `CrearCotizacionDto.exentoIva`.

- [ ] **Step 1: Agregar `exentoIva` al schema**

En `step3Schema` (después de `porcentajeIva`, línea ~26), agregar:

```typescript
    porcentajeIva: z
      .number({ message: 'IVA debe ser numérico' })
      .min(0)
      .max(100)
      .default(13),
    exentoIva: z.boolean().default(false),
```

- [ ] **Step 2: defaultValues del form**

En `Step3Terminos.tsx`, en `defaultValues` (líneas ~37-44), agregar:

```typescript
      porcentajeIva: cotizacion.porcentajeIva,
      exentoIva: cotizacion.exentoIva,
```

- [ ] **Step 3: Toggle "Exento de IVA" + deshabilitar el input de IVA cuando exento**

Necesitamos `watch('exentoIva')`. Confirmar que `watch` ya se desestructura del `useForm` (línea ~35 lo incluye). Agregar cerca del input de `% IVA` (líneas 99-110). Reemplazar ese bloque por:

```tsx
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-tx mb-1.5 cursor-pointer">
              <input type="checkbox" className="accent-accent" {...register('exentoIva')} />
              Exento de IVA
            </label>
            {!watch('exentoIva') && (
              <>
                <label className="block text-sm font-medium text-tx mb-1.5">% IVA</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx font-mono"
                  {...register('porcentajeIva', { valueAsNumber: true })}
                />
                {errors.porcentajeIva && (
                  <p className="text-xs text-danger mt-1">{errors.porcentajeIva.message}</p>
                )}
              </>
            )}
          </div>
```

- [ ] **Step 4: Preview de total en vivo respeta exento**

Buscar dónde se calcula `ivaPct`/`totalDecimal` para el preview (líneas ~115-129). El preview usa `ivaPct` para calcular el total. Ajustar para que cuando `exentoIva` esté marcado, el IVA del preview sea 0. Localizar la definición de `ivaPct` (un `watch('porcentajeIva')` o similar) y envolver:

```tsx
  const exento = watch('exentoIva');
  const ivaEfectivo = exento ? new Decimal(0) : ivaPct;
```

y usar `ivaEfectivo` en el cálculo de `totalDecimal` (reemplazar `ivaPct` por `ivaEfectivo` en la fórmula `subtotalDecimal.mul(new Decimal(100).plus(ivaEfectivo)).div(100)`). Leer el bloque real y adaptar con precisión; si el nombre de la variable difiere, ajustarlo manteniendo la intención (IVA 0 cuando exento).

- [ ] **Step 5: onSubmit envía exentoIva**

Buscar el `onSubmit` de `Step3Terminos.tsx` (el que arma el payload para `useActualizarCotizacion`):

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && grep -n "porcentajeIva\|mutateAsync\|onSubmit\|handleSubmit" components/cotizaciones/wizard/Step3Terminos.tsx
```

En el objeto que se envía al backend, agregar `exentoIva: data.exentoIva` junto a `porcentajeIva` (y, cuando `exentoIva` sea true, está bien enviar `porcentajeIva` igual — el backend lo ignora). Adaptar al shape real del payload.

- [ ] **Step 6: Verificar y commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit
```
Expected: sin errores.

Verificación manual: en el Paso 3, marcar "Exento de IVA" oculta el input de % IVA y el preview de total pasa a no sumar IVA.

```bash
git add lib/schemas/cotizacion.ts components/cotizaciones/wizard/Step3Terminos.tsx
git commit -m "feat(cotizaciones): toggle Exento de IVA en el Paso 3 del wizard"
```

---

## Tarea 8: Totales en pantalla — exento + total con depósito (frontend)

**Files:**
- Modify: `frontend/components/cotizaciones/wizard/Step4Resumen.tsx` (tfoot 94-113)
- Modify: `frontend/components/cotizaciones/detalle/ItemsTabla.tsx` (tfoot 77-90)
- Modify: `frontend/components/facturas/detalle/ItemsFacturadosCard.tsx` (tfoot 79-103)

**Interfaces:**
- Consumes: `Cotizacion.exentoIva`, `Factura.exentoIva`.

- [ ] **Step 1: Step4Resumen — rótulo exento + total con depósito**

Reemplazar el `<tfoot>` (líneas 94-113) por:

```tsx
          <tfoot className="bg-bg-sunken">
            <tr className="border-t border-bd">
              <td colSpan={3} className="text-right px-3 py-2 text-tx-2">Subtotal</td>
              <td className="text-right px-3 py-2 font-mono">{formatCurrency(cotizacion.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="text-right px-3 py-2 text-tx-2">{cotizacion.exentoIva ? 'Exento de IVA' : `IVA (${cotizacion.porcentajeIva}%)`}</td>
              <td className="text-right px-3 py-2 font-mono">{formatCurrency(cotizacion.montoIva)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="text-right px-3 py-2 font-semibold">{cotizacion.depositoMonto ? 'Total (sin depósito)' : 'Total'}</td>
              <td className="text-right px-3 py-2 font-mono font-bold text-base">{formatCurrency(cotizacion.total)}</td>
            </tr>
            {cotizacion.depositoMonto && (
              <>
                <tr>
                  <td colSpan={3} className="text-right px-3 py-2 text-tx-2">Depósito</td>
                  <td className="text-right px-3 py-2 font-mono">{formatCurrency(cotizacion.depositoMonto)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="text-right px-3 py-2 font-semibold">Total con depósito</td>
                  <td className="text-right px-3 py-2 font-mono font-bold text-base">{formatCurrency(new Decimal(cotizacion.total).add(cotizacion.depositoMonto).toFixed(2))}</td>
                </tr>
              </>
            )}
          </tfoot>
```

Confirmar que `Decimal` está importado en el archivo; si no, agregar `import Decimal from 'decimal.js';` al inicio.

- [ ] **Step 2: ItemsTabla (detalle) — rótulo exento + total con depósito**

`ItemsTabla` desestructura `{ items, subtotal, montoIva, total, porcentajeIva } = cotizacion;` (línea 18). Agregar `exentoIva, depositoMonto` a esa desestructuración. Reemplazar el `<tfoot>` (líneas 77-90) por:

```tsx
        <tfoot className="bg-bg-sunken">
          <tr className="border-t border-bd">
            <td colSpan={4} className="text-right px-3 py-2 text-tx-2">Subtotal</td>
            <td className="text-right px-3 py-2 font-mono">{formatCurrency(subtotal)}</td>
          </tr>
          <tr>
            <td colSpan={4} className="text-right px-3 py-2 text-tx-2">{exentoIva ? 'Exento de IVA' : `IVA (${porcentajeIva}%)`}</td>
            <td className="text-right px-3 py-2 font-mono">{formatCurrency(montoIva)}</td>
          </tr>
          <tr>
            <td colSpan={4} className="text-right px-3 py-2 font-semibold">{depositoMonto ? 'Total (sin depósito)' : 'Total'}</td>
            <td className="text-right px-3 py-2 font-mono font-bold text-base">{formatCurrency(total)}</td>
          </tr>
          {depositoMonto && (
            <>
              <tr>
                <td colSpan={4} className="text-right px-3 py-2 text-tx-2">Depósito</td>
                <td className="text-right px-3 py-2 font-mono">{formatCurrency(depositoMonto)}</td>
              </tr>
              <tr>
                <td colSpan={4} className="text-right px-3 py-2 font-semibold">Total con depósito</td>
                <td className="text-right px-3 py-2 font-mono font-bold text-base">{formatCurrency(new Decimal(total).add(depositoMonto).toFixed(2))}</td>
              </tr>
            </>
          )}
        </tfoot>
```

Agregar `import Decimal from 'decimal.js';` si no está.

- [ ] **Step 3: ItemsFacturadosCard — rótulo exento**

En el `<tfoot>` (líneas 79-103), reemplazar la fila de IVA por una con rótulo exento:

```tsx
          <tr>
            <td colSpan={4} className="text-right text-tx-2 px-4 py-1.5">
              {factura.exentoIva ? 'Exento de IVA' : `IVA (${factura.porcentajeIva}%)`}
            </td>
            <td className="text-right tabular-nums px-4 py-1.5">
              {formatCurrency(factura.montoIva)}
            </td>
          </tr>
```

(No se agrega depósito a la factura — item 8.)

- [ ] **Step 4: Verificar y commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit
```
Expected: sin errores.

```bash
git add components/cotizaciones/wizard/Step4Resumen.tsx components/cotizaciones/detalle/ItemsTabla.tsx components/facturas/detalle/ItemsFacturadosCard.tsx
git commit -m "feat(cotizaciones,facturas): rótulo exento y total con depósito en pantalla"
```

---

## Tarea 9: Verificación final del Grupo B

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Type-check de ambos repos**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx tsc --noEmit
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit
```
Expected: ambos sin errores.

- [ ] **Step 2: Flujo manual (requiere stack corriendo + migración aplicada)**

1. Cotización normal con depósito → Paso 4 / detalle / PDF muestran "IVA (13%)", "Total (sin depósito)", "Depósito" y "Total con depósito"; la factura generada NO muestra depósito.
2. Cotización exenta (toggle ON) → input de % IVA oculto; IVA "$0.00 / Exento de IVA"; total = subtotal. La factura hereda `exentoIva`; al emitir DTE, los ítems van `EXENTA`.
3. Cotización exenta + depósito → total (sin depósito) = subtotal; total con depósito = subtotal + depósito.
4. PDF de factura de cualquier caso → sin línea de depósito (item 8).

---

## Cobertura del spec (self-review)

- **Item 4 (IVA exento):** Tarea 1 (campo), Tarea 2 (cálculo + persistencia + Zod), Tarea 3 (factura), Tarea 4 (DTE EXENTA), Tarea 5 (PDFs), Tareas 6-7 (tipos + toggle), Tarea 8 (display).
- **Item 5 (total con depósito en cotización, PDF + pantalla):** Tarea 5 (PDF cotización), Tarea 8 (Step4 + ItemsTabla).
- **Item 8 (factura/DTE sin depósito):** sin cambios funcionales; confirmado por construcción (la factura copia `total` sin depósito; su PDF/saldo no incluyen depósito; el DTE se arma de ítems). Tareas 3/5/8 no agregan depósito a la factura.
