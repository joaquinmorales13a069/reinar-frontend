# Grupo C — Facturas: periodo, fecha QUEDAN y observaciones · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el periodo de renta por línea por un periodo único a nivel factura (seleccionable y visible en PDF), quitar la columna "Período" del PDF de factura, agregar una casilla de observaciones editable (visible en PDF), y auto-setear la fecha de entrega de la factura QUEDAN desde el acta de entrega (items 6, 7, 9, 11, 12).

**Architecture:** Se agregan `periodoRentaInicio`/`periodoRentaFin` a `Factura` (periodo global de la factura) y se eliminan los homónimos de `CotizacionItem` (periodo por línea), junto con su endpoint, card y columna del PDF. El periodo de factura se edita vía el `actualizarFactura` existente y se muestra en la cabecera del PDF. Las observaciones reutilizan `Factura.notas` (el PDF ya lo muestra) — solo falta la UI. Para QUEDAN, al marcar un acta de entrega `ENTREGADO` se copia su `fechaEntrega` a `Factura.fechaEntregaReal` (primera acta entregada gana), manteniendo el flujo manual como respaldo.

**Tech Stack:** Backend Express + Prisma (`/Users/joaquinmorales13a06/Desktop/Reinar/server`). Frontend Next.js 19 + React Query + decimal.js + Handlebars PDFs.

## Global Constraints

- Branch única: `feat/feedback-reinar` (ambos repos).
- Sin suite de tests. Verificación: backend `npx tsc --noEmit` (+ `npx prisma validate`); frontend `pnpm tsc --noEmit`. Más flujos manuales por tarea.
- Montos Decimal como strings + decimal.js; fechas ISO strings. Comentarios solo "why", en español. Tailwind solo clases predefinidas.
- **Nombre de campo:** el periodo de factura se llama `periodoRentaInicio`/`periodoRentaFin` (consistente con `ActaEntrega` y con los campos que se eliminan de `CotizacionItem`). Supersede la nomenclatura suelta del spec.
- Commits frecuentes, uno por tarea; cada commit compila.
- La migración tiene parte **aditiva** (ADD en Factura) y parte **destructiva** (DROP en CotizacionItem). Orden de tareas pensado para que cada commit compile: primero se quita TODO el código que lee/escribe `CotizacionItem.periodoRentaInicio/Fin`, luego la migración (ADD+DROP) + regen del cliente, y recién después el código que usa los nuevos campos de `Factura`. Aplicación a la BD remota la maneja el controlador en ejecución.

---

## File Structure

**Backend (`server/`):**
- Modify: `src/modules/facturas/facturas.routes.ts` — quitar ruta `periodos-renta`.
- Modify: `src/modules/facturas/facturas.controller.ts` — quitar `setPeriodosRenta`.
- Modify: `src/modules/facturas/facturas.service.ts` — quitar `setPeriodosRenta`; extender `actualizarFactura`.
- Modify: `src/modules/facturas/facturas.schemas.ts` — quitar `periodosRentaSchema`; extender `actualizarFacturaSchema`.
- Modify: `src/modules/pdf/pdf.service.ts` — quitar `rangoRenta`/`formatRangoRenta`; pasar periodo de factura al contexto.
- Modify: `src/modules/pdf/templates/factura.hbs` — quitar columna "Período"; agregar fila "Período de renta" en cabecera.
- Modify: `src/modules/actas/actas.service.ts` — `_entregar` auto-setea `fechaEntregaReal`.
- Modify: `prisma/schema.prisma` + nueva migración — ADD en Factura, DROP en CotizacionItem.

**Frontend (`frontend/`):**
- Modify: `types/api.ts` — quitar `CotizacionItem.periodoRentaInicio/Fin` y `PeriodosRentaDto`; agregar `Factura.periodoRentaInicio/Fin` y a `ActualizarFacturaDto`.
- Modify: `hooks/use-facturas.ts` — quitar `useActualizarPeriodosRenta`.
- Delete: `components/facturas/detalle/PeriodosRentaCard.tsx`.
- Create: `components/facturas/detalle/PeriodoFacturaCard.tsx`, `components/facturas/detalle/ObservacionesCard.tsx`.
- Modify: `app/(dashboard)/facturas/[id]/page.tsx` — quitar PeriodosRentaCard; montar las dos cards nuevas.

---

## Tarea 1: Quitar el periodo por línea del backend (código)

Elimina todo lo que lee/escribe `CotizacionItem.periodoRentaInicio/Fin`, dejando el camino libre para dropear esas columnas en la Tarea 2. Incluye quitar la columna "Período" del PDF de factura (item 7).

**Files:**
- Modify: `server/src/modules/facturas/facturas.routes.ts` (línea 25)
- Modify: `server/src/modules/facturas/facturas.controller.ts` (`setPeriodosRenta`, líneas 128-133)
- Modify: `server/src/modules/facturas/facturas.service.ts` (`setPeriodosRenta`, líneas 432-460)
- Modify: `server/src/modules/facturas/facturas.schemas.ts` (`periodosRentaSchema`, líneas 85-95)
- Modify: `server/src/modules/pdf/pdf.service.ts` (`formatRangoRenta` 195-198; `mapItems` 200-245)
- Modify: `server/src/modules/pdf/templates/factura.hbs` (tabla de ítems 457-508)

- [ ] **Step 1: Quitar la ruta `periodos-renta`**

En `facturas.routes.ts`, eliminar la línea 25:
```typescript
router.patch('/:id/periodos-renta', authenticate, requireRol(...operadores), validate(periodosRentaSchema), ctrl.setPeriodosRenta)
```
Si `periodosRentaSchema` quedaba importado solo para esta ruta, quitar también ese import del archivo de rutas.

- [ ] **Step 2: Quitar el controlador `setPeriodosRenta`**

En `facturas.controller.ts`, eliminar la función `setPeriodosRenta` (líneas 128-133).

- [ ] **Step 3: Quitar el servicio `setPeriodosRenta`**

En `facturas.service.ts`, eliminar la función `setPeriodosRenta` completa (líneas 432-460) y, si `PeriodosRentaInput` quedaba importado solo para ella, quitar ese import.

- [ ] **Step 4: Quitar `periodosRentaSchema`**

En `facturas.schemas.ts`, eliminar `periodosRentaSchema` (líneas 85-95) y su export. Si exporta un tipo `PeriodosRentaInput` derivado (`z.infer`), eliminarlo también.

- [ ] **Step 5: Quitar `rangoRenta` de `mapItems` y `formatRangoRenta`**

En `pdf.service.ts`:
- En `mapItems`, eliminar la propiedad `rangoRenta: formatRangoRenta(...)` tanto del objeto `regular.push({...})` (línea ~218) como del objeto de `andamioGroups` (línea ~238).
- Eliminar la función `formatRangoRenta` (líneas 195-198) ya que queda sin uso.
- (El PDF de cotización usa una columna "Días" estática y NO referencia `rangoRenta`, así que no se rompe. El de factura pierde la columna en el Step 6.)

- [ ] **Step 6: Quitar la columna "Período" del PDF de factura (item 7)**

En `factura.hbs`, en la tabla de ítems (líneas 457-508):
- En el `<thead>`, eliminar `<th style="width:29%">Período</th>` y reajustar anchos: `Descripción` → `width:67%`, `Cant.` → `width:8%`, `Subtotal` → `width:25%`.
- En la fila regular, eliminar la `<td>` de período: `<td>{{#if this.rangoRenta}}{{this.rangoRenta}}{{else}}{{this.unidades}} × {{this.periodo}}{{/if}}</td>`.
- En la fila padre de cuerpo de andamio, eliminar la `<td>` análoga de período.
- En la fila hija de pieza, eliminar la `<td style="...">piezas</td>` (era la celda de la columna Período).

- [ ] **Step 7: Verificar y commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx tsc --noEmit
grep -rn "periodoRentaInicio\|periodoRentaFin\|setPeriodosRenta\|periodos-renta\|rangoRenta" src/ | grep -v "actaEntrega\|ActaEntrega\|acta"
```
Expected: tsc sin errores. El grep no debe mostrar referencias a periodo por línea de factura/cotización (las de ActaEntrega/acta son de otro feature y se mantienen). `CotizacionItem.periodoRentaInicio/Fin` ya no se referencia en código.

```bash
git add src/modules/facturas/ src/modules/pdf/
git commit -m "refactor(facturas): quitar periodo de renta por línea (endpoint, mapItems, columna PDF)"
```

---

## Tarea 2: Migración — ADD en Factura, DROP en CotizacionItem (backend)

**Files:**
- Modify: `server/prisma/schema.prisma` (`Factura` ~593; `CotizacionItem` 554-557)
- Create: migración bajo `server/prisma/migrations/`

**Interfaces:**
- Produces: `Factura.periodoRentaInicio: Date | null`, `Factura.periodoRentaFin: Date | null`. Elimina `CotizacionItem.periodoRentaInicio/Fin`.

- [ ] **Step 1: Editar `schema.prisma`**

En `model Factura`, después de `fechaEntregaReal    DateTime?` (línea ~593), agregar:
```prisma
  fechaEntregaReal    DateTime?
  // Periodo de renta a nivel factura (rango global mostrado en el PDF de factura).
  periodoRentaInicio  DateTime?
  periodoRentaFin     DateTime?
```

En `model CotizacionItem`, eliminar las líneas 554-557 (el comentario de 2 líneas + los dos campos):
```prisma
  // Rango de renta por linea, mostrado en el PDF de factura. Se puebla via
  // PATCH /facturas/:id/periodos-renta; null = el PDF cae al texto "N x Periodo".
  periodoRentaInicio DateTime?
  periodoRentaFin    DateTime?
```

- [ ] **Step 2: Validar el schema**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx prisma validate
```
Expected: `The schema at prisma/schema.prisma is valid`.

- [ ] **Step 3: Generar la migración offline**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git show HEAD:prisma/schema.prisma > /tmp/schema-old-c.prisma
mkdir -p prisma/migrations/20260630140000_factura_periodo_renta
npx prisma migrate diff --from-schema /tmp/schema-old-c.prisma --to-schema prisma/schema.prisma --script > prisma/migrations/20260630140000_factura_periodo_renta/migration.sql
cat prisma/migrations/20260630140000_factura_periodo_renta/migration.sql
```
Expected: dos `ALTER TABLE "Factura" ADD COLUMN ...` (periodoRentaInicio/Fin) y `ALTER TABLE "CotizacionItem" DROP COLUMN "periodoRentaInicio"` + `DROP COLUMN "periodoRentaFin"`. Si la dirección del diff sale invertida (ADD en CotizacionItem / DROP en Factura), revisar que `--from-schema` sea el viejo (de git) y `--to-schema` el editado.

- [ ] **Step 4: Regenerar el cliente offline y verificar compilación**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
npx prisma generate
npx tsc --noEmit
```
Expected: cliente regenerado; tsc sin errores (confirma que ningún código referencia los campos eliminados de CotizacionItem).

- [ ] **Step 5: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add prisma/schema.prisma prisma/migrations/20260630140000_factura_periodo_renta/
git commit -m "feat(prisma): periodo de renta a nivel Factura; eliminar el de CotizacionItem"
```
(La aplicación con `prisma migrate deploy` la maneja el controlador en ejecución; NO la apliques tú.)

---

## Tarea 3: Periodo de factura editable + visible en PDF (backend)

**Files:**
- Modify: `server/src/modules/facturas/facturas.schemas.ts` (`actualizarFacturaSchema` 21-27)
- Modify: `server/src/modules/facturas/facturas.service.ts` (`actualizarFactura` 116-128)
- Modify: `server/src/modules/pdf/pdf.service.ts` (`generarFacturaPDF` contexto factura ~408-430)
- Modify: `server/src/modules/pdf/templates/factura.hbs` (cabecera doc-dates ~411-426)

**Interfaces:**
- Consumes: `Factura.periodoRentaInicio/Fin` (Tarea 2).

- [ ] **Step 1: Extender `actualizarFacturaSchema`**

Reemplazar `actualizarFacturaSchema` (líneas 21-27) por:
```typescript
export const actualizarFacturaSchema = z.object({
  notas:              z.string().optional(),
  fechaVencimiento:   z.string().datetime().optional(),
  // null limpia el periodo; string ISO lo setea.
  periodoRentaInicio: z.string().datetime().nullable().optional(),
  periodoRentaFin:    z.string().datetime().nullable().optional(),
}).refine(
  (d) => d.notas !== undefined || d.fechaVencimiento !== undefined || d.periodoRentaInicio !== undefined || d.periodoRentaFin !== undefined,
  { message: 'Debe proporcionar al menos un campo para actualizar' },
)
```

- [ ] **Step 2: Extender `actualizarFactura`**

En `facturas.service.ts`, reemplazar el `prisma.factura.update({ data: {...} })` de `actualizarFactura` (líneas ~121-127) por:
```typescript
  return prisma.factura.update({
    where: { id },
    data: {
      ...(data.notas !== undefined            && { notas: data.notas }),
      ...(data.fechaVencimiento !== undefined && { fechaVencimiento: new Date(data.fechaVencimiento) }),
      ...(data.periodoRentaInicio !== undefined && { periodoRentaInicio: data.periodoRentaInicio ? new Date(data.periodoRentaInicio) : null }),
      ...(data.periodoRentaFin    !== undefined && { periodoRentaFin:    data.periodoRentaFin    ? new Date(data.periodoRentaFin)    : null }),
    },
  })
```
Asegurar que el tipo `ActualizarFacturaInput` (el `z.infer` del schema) incluya los nuevos campos (al derivar del schema actualizado, se incluyen automáticamente; si está tipeado a mano, agregarlos).

- [ ] **Step 3: Pasar el periodo de factura al contexto del PDF**

En `pdf.service.ts` `generarFacturaPDF`, dentro del objeto `factura: {...}` del contexto (junto a `fechaEmision`/`fechaVencimiento`, ~líneas 419-428), agregar:
```typescript
      fechaVencimiento:    formatFechaCorta(factura.fechaVencimiento),
      periodoRentaInicio:  factura.periodoRentaInicio ? formatFechaCorta(factura.periodoRentaInicio) : null,
      periodoRentaFin:     factura.periodoRentaFin    ? formatFechaCorta(factura.periodoRentaFin)    : null,
```

- [ ] **Step 4: Mostrar el periodo en la cabecera del PDF (item 9)**

En `factura.hbs`, en el bloque `doc-dates` (después de la fila "Vence:", líneas ~415-418, antes del bloque QUEDAN), agregar:
```handlebars
      {{#if factura.periodoRentaInicio}}
      <div class="date-row">
        <span class="date-key">Período de renta:</span>
        <span class="date-val">{{factura.periodoRentaInicio}} — {{factura.periodoRentaFin}}</span>
      </div>
      {{/if}}
```

- [ ] **Step 5: Verificar y commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx tsc --noEmit
```
Expected: sin errores.

```bash
git add src/modules/facturas/ src/modules/pdf/
git commit -m "feat(facturas): periodo de renta editable a nivel factura, visible en PDF"
```

---

## Tarea 4: Auto-setear fecha QUEDAN desde el acta (backend, item 6)

**Files:**
- Modify: `server/src/modules/actas/actas.service.ts` (`_entregar`, líneas 699-740)

- [ ] **Step 1: Auto-setear `fechaEntregaReal` en `_entregar`**

En `_entregar`, después del `await tx.actaEntrega.update({ ... fechaEntrega: ... })` y antes (o después) del `auditLog.create`, agregar el bloque que copia la fecha de entrega a la factura QUEDAN. Como el objeto `acta` recibido NO trae `factura.esQuedan`/`fechaEntregaReal`, se consulta dentro de la transacción. Usar la MISMA `Date` que se asignó a `fechaEntrega` para que ambas coincidan — extraerla a una constante:

```typescript
  const fechaEntrega = new Date()

  await tx.actaEntrega.update({
    where: { id: acta.id },
    data: {
      estado:             'ENTREGADO',
      fechaEntrega,
      horaEntrega:        input.horaEntrega,
      contactoReceptorId: input.contactoReceptorId,
      receptorNombre:     input.receptorNombre,
      receptorDocumento:  input.receptorDocumento,
      receptorEmail:      input.contactoReceptorId ? null : (input.receptorEmail || null),
    },
  })

  // QUEDAN: la fecha de entrega de la factura se toma de la primera acta entregada.
  const factura = await tx.factura.findUnique({
    where:  { id: acta.facturaId },
    select: { esQuedan: true, fechaEntregaReal: true },
  })
  if (factura?.esQuedan && !factura.fechaEntregaReal) {
    await tx.factura.update({ where: { id: acta.facturaId }, data: { fechaEntregaReal: fechaEntrega } })
  }
```

(Reemplazar el `fechaEntrega: new Date()` inline original por la constante `fechaEntrega`.)

- [ ] **Step 2: Verificar y commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx tsc --noEmit
```
Expected: sin errores.

```bash
git add src/modules/actas/actas.service.ts
git commit -m "feat(actas): al entregar, sellar la fecha de entrega en la factura QUEDAN"
```

---

## Tarea 5: Quitar el periodo por línea del frontend (tipos, hook, card)

**Files:**
- Modify: `frontend/types/api.ts` (`CotizacionItem` 771-773; `Factura` 1069-1108; `ActualizarFacturaDto` 1125-1128; `PeriodosRentaDto` 1130-1132)
- Modify: `frontend/hooks/use-facturas.ts` (`useActualizarPeriodosRenta` 93-110; import `PeriodosRentaDto` línea 15)
- Delete: `frontend/components/facturas/detalle/PeriodosRentaCard.tsx`
- Modify: `frontend/app/(dashboard)/facturas/[id]/page.tsx` (import línea 19; render línea 168)

**Interfaces:**
- Produces: `Factura.periodoRentaInicio: string | null`, `Factura.periodoRentaFin: string | null`, `ActualizarFacturaDto.periodoRentaInicio?/periodoRentaFin?`.

- [ ] **Step 1: Tipos en `types/api.ts`**

- En `type CotizacionItem`, eliminar las líneas 771-773 (el comentario + `periodoRentaInicio?`/`periodoRentaFin?`).
- En `type Factura`, después de `fechaEntregaReal: string | null;` (línea 1096), agregar:
  ```typescript
  fechaEntregaReal: string | null;
  periodoRentaInicio: string | null;
  periodoRentaFin: string | null;
  ```
- En `type ActualizarFacturaDto` (líneas 1125-1128), agregar:
  ```typescript
  export type ActualizarFacturaDto = {
    notas?: string;
    fechaVencimiento?: string;
    periodoRentaInicio?: string | null;
    periodoRentaFin?: string | null;
  };
  ```
- Eliminar `type PeriodosRentaDto` (líneas 1130-1132).

- [ ] **Step 2: Quitar `useActualizarPeriodosRenta`**

En `hooks/use-facturas.ts`: eliminar la función `useActualizarPeriodosRenta` (líneas 93-110) y quitar `PeriodosRentaDto` del import de tipos (línea 15).

- [ ] **Step 3: Borrar PeriodosRentaCard y su uso**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git rm components/facturas/detalle/PeriodosRentaCard.tsx
```
En `app/(dashboard)/facturas/[id]/page.tsx`: eliminar el import de `PeriodosRentaCard` (línea 19) y la línea de render (línea 168):
```typescript
<PeriodosRentaCard key={factura.updatedAt ?? factura.id} factura={factura} />
```

- [ ] **Step 4: Verificar residuos y compilar**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
grep -rn "periodoRentaInicio\|periodoRentaFin\|PeriodosRenta\|useActualizarPeriodosRenta" app components hooks types | grep -v "Factura\|factura"
pnpm tsc --noEmit
```
Expected: el grep no muestra usos de periodo por línea de CotizacionItem ni de PeriodosRentaCard (las referencias a `factura.periodoRentaInicio/Fin` SON válidas y esperadas). tsc sin errores.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(facturas): quitar periodo de renta por línea del frontend"
```

---

## Tarea 6: ObservacionesCard (frontend, item 11)

**Files:**
- Create: `frontend/components/facturas/detalle/ObservacionesCard.tsx`
- Modify: `frontend/app/(dashboard)/facturas/[id]/page.tsx` (import + render)

**Interfaces:**
- Consumes: `useActualizarFactura` (existente), `Factura.notas`.

- [ ] **Step 1: Crear `ObservacionesCard.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useActualizarFactura } from '@/hooks/use-facturas';
import type { Factura } from '@/types/api';

// Edita factura.notas — el PDF de factura ya lo muestra como sección "Observaciones".
export function ObservacionesCard({ factura, puedeEscribir }: { factura: Factura; puedeEscribir: boolean }) {
  const anulada = factura.estado === 'ANULADA';
  const soloLectura = !puedeEscribir || anulada;
  const [notas, setNotas] = useState(factura.notas ?? '');
  const actualizar = useActualizarFactura();

  async function guardar() {
    await actualizar.mutateAsync({ id: factura.id, data: { notas } });
  }

  return (
    <div className={`bg-bg border border-bd rounded-md p-4 ${anulada ? 'opacity-60' : ''}`}>
      <h3 className="text-sm font-medium text-tx mb-3">Observaciones</h3>
      {soloLectura ? (
        <p className="text-sm text-tx whitespace-pre-wrap">{factura.notas || '—'}</p>
      ) : (
        <>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Notas que aparecerán en el PDF de la factura…"
            className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors"
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={actualizar.isPending || notas === (factura.notas ?? '')}
              onClick={() => { void guardar(); }}
              className="px-4 py-2 text-sm rounded-md bg-accent text-navy font-medium hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              {actualizar.isPending ? 'Guardando…' : 'Guardar observaciones'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Montar en el detalle**

En `app/(dashboard)/facturas/[id]/page.tsx`: agregar el import junto a los otros (`import { ObservacionesCard } from '@/components/facturas/detalle/ObservacionesCard';`) y renderizarla en la columna principal, después de `<ClienteFechasCard factura={factura} />` (línea 144):
```tsx
          <ClienteFechasCard factura={factura} />
          <ObservacionesCard factura={factura} puedeEscribir={!!puedeEscribir} />
```

- [ ] **Step 3: Verificar y commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit
```
Expected: sin errores.

```bash
git add components/facturas/detalle/ObservacionesCard.tsx "app/(dashboard)/facturas/[id]/page.tsx"
git commit -m "feat(facturas): casilla de observaciones en el detalle (aparece en el PDF)"
```

---

## Tarea 7: PeriodoFacturaCard (frontend, item 9)

**Files:**
- Create: `frontend/components/facturas/detalle/PeriodoFacturaCard.tsx`
- Modify: `frontend/app/(dashboard)/facturas/[id]/page.tsx` (import + render donde estaba PeriodosRentaCard)

**Interfaces:**
- Consumes: `useActualizarFactura`, `useActasDeFactura` (de `hooks/use-actas.ts`), `Factura.periodoRentaInicio/Fin`.

- [ ] **Step 1: Confirmar el hook y tipo de actas**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
grep -n "useActasDeFactura" hooks/use-actas.ts
grep -n "periodoRentaInicio\|periodoRentaFin" types/api.ts
```
Expected: `useActasDeFactura(facturaId)` existe y devuelve actas con `periodoRentaInicio/Fin` (en el tipo `Acta`). Si el hook devuelve `{ data }` con un array de actas, usar `data?.[...]`. Adaptar el acceso según la firma real (ver el tipo de retorno).

- [ ] **Step 2: Crear `PeriodoFacturaCard.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useActualizarFactura } from '@/hooks/use-facturas';
import { useActasDeFactura } from '@/hooks/use-actas';
import type { Factura } from '@/types/api';

const inputCls =
  'w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent transition-colors';

function toDateInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : '';
}

export function PeriodoFacturaCard({ factura }: { factura: Factura }) {
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeEscribir = rol === 'ADMIN' || rol === 'GERENTE' || rol === 'OPERADOR';
  const anulada = factura.estado === 'ANULADA';
  const soloLectura = !puedeEscribir || anulada;

  const actas = useActasDeFactura(factura.id);
  // Pre-carga: si la factura aún no tiene periodo propio, usar el del primer acta con periodo.
  const actaConPeriodo = actas.data?.find((a) => a.periodoRentaInicio && a.periodoRentaFin);

  const [inicio, setInicio] = useState(
    toDateInput(factura.periodoRentaInicio) || toDateInput(actaConPeriodo?.periodoRentaInicio),
  );
  const [fin, setFin] = useState(
    toDateInput(factura.periodoRentaFin) || toDateInput(actaConPeriodo?.periodoRentaFin),
  );
  const [error, setError] = useState<string | null>(null);

  const actualizar = useActualizarFactura();

  async function guardar() {
    setError(null);
    if ((inicio && !fin) || (!inicio && fin)) { setError('Completá inicio y fin'); return; }
    if (inicio && fin && inicio > fin) { setError('La fecha de inicio debe ser anterior o igual al fin'); return; }
    await actualizar.mutateAsync({
      id: factura.id,
      data: {
        periodoRentaInicio: inicio ? new Date(inicio).toISOString() : null,
        periodoRentaFin:    fin    ? new Date(fin).toISOString()    : null,
      },
    });
  }

  return (
    <div className={`bg-bg border border-bd rounded-md p-4 ${anulada ? 'opacity-60' : ''}`}>
      <h3 className="text-sm font-medium text-tx mb-3">Período de renta</h3>
      {soloLectura ? (
        <p className="text-sm text-tx">
          {factura.periodoRentaInicio && factura.periodoRentaFin
            ? `${toDateInput(factura.periodoRentaInicio)} — ${toDateInput(factura.periodoRentaFin)}`
            : '—'}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-tx-2 mb-1">Inicio</label>
              <input type="date" className={inputCls} value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-tx-2 mb-1">Fin</label>
              <input type="date" className={inputCls} value={fin} onChange={(e) => setFin(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-xs text-danger mt-2">{error}</p>}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={actualizar.isPending}
              onClick={() => { void guardar(); }}
              className="px-4 py-2 text-sm rounded-md bg-accent text-navy font-medium hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              {actualizar.isPending ? 'Guardando…' : 'Guardar período'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Montar en el detalle (donde estaba PeriodosRentaCard)**

En `app/(dashboard)/facturas/[id]/page.tsx`: agregar el import (`import { PeriodoFacturaCard } from '@/components/facturas/detalle/PeriodoFacturaCard';`) y renderizar después de `<ItemsFacturadosCard factura={factura} />` (donde estaba la PeriodosRentaCard):
```tsx
          <ItemsFacturadosCard factura={factura} />
          <PeriodoFacturaCard factura={factura} />
```

- [ ] **Step 4: Verificar y commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit
```
Expected: sin errores. Si `useActasDeFactura` o el tipo `Acta` no exponen `periodoRentaInicio/Fin` con esos nombres, ajustar el acceso (Step 1 lo confirma) — la pre-carga es best-effort; el campo manual siempre funciona.

```bash
git add components/facturas/detalle/PeriodoFacturaCard.tsx "app/(dashboard)/facturas/[id]/page.tsx"
git commit -m "feat(facturas): card de período de renta a nivel factura (pre-carga del acta)"
```

---

## Tarea 8: Verificación final del Grupo C

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Type-check de ambos repos**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx tsc --noEmit
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit
```
Expected: ambos sin errores.

- [ ] **Step 2: Flujo manual (requiere stack corriendo + migración aplicada)**

1. Editar observaciones en el detalle de factura → guardar → el PDF de factura las muestra como "Observaciones".
2. Setear el período de renta en el detalle → guardar → el PDF muestra "Período de renta: X — Y" en la cabecera; la tabla de ítems ya **no** tiene columna "Período".
3. QUEDAN con acta de entrega → marcar el acta `ENTREGADO` → la factura toma esa `fechaEntrega` como `fechaEntregaReal` (visible en EntregaQuedanCard).
4. QUEDAN sin acta → el botón manual "Marcar como entregada" sigue funcionando.
5. Crear una factura cuya cotización tenga un acta con período → abrir el detalle → la PeriodoFacturaCard aparece pre-cargada con el período del acta.

---

## Cobertura del spec (self-review)

- **Item 6** (fecha QUEDAN ↔ acta): Tarea 4 (`_entregar` auto-setea `fechaEntregaReal`).
- **Item 7** (quitar columna Período del PDF de factura): Tarea 1 Step 5-6.
- **Item 9** (periodo a nivel factura, visible en PDF): Tarea 2 (campos), Tarea 3 (editar + PDF), Tarea 7 (UI).
- **Item 11** (observaciones, visible en PDF): backend/PDF ya existen; Tarea 6 (UI).
- **Item 12** (eliminar periodo por línea): Tareas 1 (backend código), 2 (drop columnas), 5 (frontend tipos/hook/card).
