# Grupo D — Renovaciones de renta desde acta de entrega · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir, desde un acta de entrega, generar una renovación de renta (cotización + factura) para el mismo inventario que sigue en obra, sin crear acta nueva, exceptuando del gate de disponibilidad los items que se renuevan (items 10, 13).

**Architecture:** Se agrega `Cotizacion.actaEntregaOrigenId` (FK a `ActaEntrega`) que marca una cotización como renovación. Un endpoint `POST /actas/:id/renovar` crea una cotización BORRADOR clonando los items rentables seleccionados (vía el `agregarItem` existente) y la vincula al acta. El gate de aprobación (Grupo A) y el cálculo de disponibilidad derivada excluyen los items renovados para no chocar ni contar doble. La renovación NO crea acta; su factura es normal.

**Tech Stack:** Backend Express + Prisma. Frontend Next.js 19 + React Query. Reusa el wizard de cotización y la card de período (Grupo C).

## Global Constraints

- Branch única: `feat/feedback-reinar` (ambos repos).
- Sin suite de tests. Verificación: backend `npx tsc --noEmit` (+ `npx prisma validate`); frontend `pnpm tsc --noEmit`. Más flujos manuales.
- Decimal como strings + decimal.js; fechas ISO. Comentarios solo "why", español. Tailwind clases predefinidas.
- Roles: solo VISUALIZADOR no escribe (`user.rol !== 'VISUALIZADOR'`).
- Commits frecuentes, uno por tarea; cada commit compila.
- Migración **aditiva** (una columna nullable + FK); el schema puede cambiarse primero. Aplicación a la BD remota la maneja el controlador en ejecución.
- Nombre del campo: `actaEntregaOrigenId`; relación Prisma nombrada `"renovaciones"`.
- Tipos rentables que se renuevan: `EQUIPO`, `HERRAMIENTA`, `PIEZA_ANDAMIO`. Consumibles/servicios NO.

---

## File Structure

**Backend (`server/`):**
- Modify: `prisma/schema.prisma` (+ migración) — `Cotizacion.actaEntregaOrigenId` + relación bidireccional.
- Modify: `src/modules/cotizaciones/cotizaciones.service.ts` — `crearCotizacion` (aceptar `actaEntregaOrigenId`); gate de `cambiarEstado` (exceptuar renovación); `obtenerCotizacion` (incluir `actaEntregaOrigen`).
- Modify: `src/modules/disponibilidad/disponibilidad.service.ts` — excluir renovaciones del conteo.
- Modify: `src/modules/actas/actas.service.ts` (`renovarRenta` + `obtenerActa` renovaciones), `actas.controller.ts`, `actas.routes.ts`, `actas.schemas.ts`.

**Frontend (`frontend/`):**
- Modify: `types/api.ts` — `Cotizacion.actaEntregaOrigen*`, `Acta.renovaciones`.
- Modify: `hooks/use-actas.ts` — `useRenovarRenta`.
- Create: `components/actas/RenovarRentaModal.tsx`.
- Modify: `components/actas/ActaPanelAccionContextual.tsx` (botón), `app/(dashboard)/cotizaciones/[id]/editar/page.tsx` (`?paso`), `app/(dashboard)/actas/[id]/page.tsx` (sección Renovaciones), `components/cotizaciones/detalle/ResumenLateral.tsx` (badge).

---

## Tarea 1: Schema + migración (backend)

**Files:**
- Modify: `server/prisma/schema.prisma` (`Cotizacion` ~487-527; `ActaEntrega` ~733-774)
- Create: migración bajo `server/prisma/migrations/`

**Interfaces:**
- Produces: `Cotizacion.actaEntregaOrigenId: string | null` + relación `actaEntregaOrigen`; `ActaEntrega.renovaciones: Cotizacion[]`.

- [ ] **Step 1: Editar `schema.prisma`**

En `model Cotizacion`, después de `notasInternas         String?` (antes de `createdAt`), agregar:
```prisma
  // Renovación de renta: vincula esta cotización al acta de entrega original
  // cuyo inventario se renueva sin devolución (Grupo D).
  actaEntregaOrigenId String?
  actaEntregaOrigen   ActaEntrega? @relation("renovaciones", fields: [actaEntregaOrigenId], references: [id])
```

En `model ActaEntrega`, junto a las relaciones inversas (después de `recepciones ActaRecepcion[]`), agregar:
```prisma
  renovaciones Cotizacion[] @relation("renovaciones")
```

- [ ] **Step 2: Validar el schema**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid`.

- [ ] **Step 3: Generar la migración offline**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git show HEAD:prisma/schema.prisma > /tmp/schema-old-d.prisma
mkdir -p prisma/migrations/20260630150000_renovacion_renta
npx prisma migrate diff --from-schema /tmp/schema-old-d.prisma --to-schema prisma/schema.prisma --script > prisma/migrations/20260630150000_renovacion_renta/migration.sql
cat prisma/migrations/20260630150000_renovacion_renta/migration.sql
```
Expected: un `ALTER TABLE "Cotizacion" ADD COLUMN "actaEntregaOrigenId" TEXT;` + un `ALTER TABLE "Cotizacion" ADD CONSTRAINT ... FOREIGN KEY ("actaEntregaOrigenId") REFERENCES "ActaEntrega"("id") ...`. Aditivo, sin DROP. Si hay algún `DROP`, DETENER y reportar.

- [ ] **Step 4: Regenerar el cliente offline y compilar**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
npx prisma generate
npx tsc --noEmit
```
Expected: cliente regenerado; tsc sin errores.

- [ ] **Step 5: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add prisma/schema.prisma prisma/migrations/20260630150000_renovacion_renta/
git commit -m "feat(prisma): Cotizacion.actaEntregaOrigenId para renovaciones de renta"
```
(NO aplicar la migración; lo hace el controlador.)

---

## Tarea 2: Endpoint y servicio de renovación (backend)

**Files:**
- Modify: `server/src/modules/cotizaciones/cotizaciones.service.ts` (`crearCotizacion` 132-192)
- Modify: `server/src/modules/actas/actas.service.ts` (nueva `renovarRenta`)
- Modify: `server/src/modules/actas/actas.controller.ts` (nueva `renovar`)
- Modify: `server/src/modules/actas/actas.routes.ts` (nueva ruta)
- Modify: `server/src/modules/actas/actas.schemas.ts` (nuevo `renovarRentaSchema`)

**Interfaces:**
- Consumes: `Cotizacion.actaEntregaOrigenId` (Tarea 1), `agregarItem`, `crearCotizacion`, `obtenerCotizacion`.
- Produces: `renovarRenta(actaId: string, cotizacionItemIds: string[], usuarioId: string): Promise<Cotizacion>`; ruta `POST /actas/:id/renovar`.

- [ ] **Step 1: Extender `crearCotizacion` para aceptar `actaEntregaOrigenId`**

En la firma `data: {...}` de `crearCotizacion`, agregar `actaEntregaOrigenId?: string`. En el `tx.cotizacion.create({ data: {...} })`, agregar:
```typescript
        exentoIva:             data.exentoIva ?? false,
        actaEntregaOrigenId:   data.actaEntregaOrigenId,
```

- [ ] **Step 2: Zod schema de renovación**

En `actas.schemas.ts`, agregar:
```typescript
export const renovarRentaSchema = z.object({
  cotizacionItemIds: z.array(z.string().cuid()).min(1, 'Seleccioná al menos un ítem para renovar'),
})
export type RenovarRentaInput = z.infer<typeof renovarRentaSchema>
```
(Confirmar que `z` ya está importado en el archivo.)

- [ ] **Step 3: Servicio `renovarRenta` en `actas.service.ts`**

Agregar (importa `agregarItem`, `crearCotizacion`, `obtenerCotizacion` desde `'../cotizaciones/cotizaciones.service'` — usar el patrón de imports existente del archivo):
```typescript
import * as cotizacionesService from '../cotizaciones/cotizaciones.service'

const TIPOS_RENTABLES = new Set(['EQUIPO', 'HERRAMIENTA', 'PIEZA_ANDAMIO'])

// Renovación de renta: clona los ítems rentables seleccionados (que siguen en
// obra, PENDIENTE_DEVOLUCION) en una nueva cotización BORRADOR vinculada al acta
// original. No crea acta nueva: el inventario lo sigue rastreando el acta inicial.
export async function renovarRenta(actaId: string, cotizacionItemIds: string[], usuarioId: string) {
  const acta = await prisma.actaEntrega.findUnique({
    where:  { id: actaId },
    select: {
      id: true,
      estado: true,
      factura: { select: { cotizacion: { select: { id: true, clienteId: true, proyectoId: true, porcentajeIva: true, exentoIva: true } } } },
      items:   { where: { estado: 'PENDIENTE_DEVOLUCION' }, select: { cotizacionItemId: true } },
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

  // Items originales a clonar (solo rentables).
  const originales = await prisma.cotizacionItem.findMany({
    where:  { id: { in: cotizacionItemIds } },
    select: {
      tipo: true, equipoId: true, herramientaTipoId: true, piezaTipoId: true,
      cantidadUnidades: true, cantidadDias: true, periodo: true, periodoCustomLabel: true,
      tarifaCustom: true, esTarifaCustom: true, descripcion: true,
    },
  })
  const clonables = originales.filter((o) => TIPOS_RENTABLES.has(o.tipo))
  if (clonables.length === 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'No hay ítems rentables (equipo/herramienta/pieza) para renovar')
  }

  const cotOrig = acta.factura.cotizacion
  const nueva = await cotizacionesService.crearCotizacion({
    clienteId:           cotOrig.clienteId,
    proyectoId:          cotOrig.proyectoId ?? undefined,
    porcentajeIva:       Number(cotOrig.porcentajeIva),
    exentoIva:           cotOrig.exentoIva,
    actaEntregaOrigenId: acta.id,
  }, usuarioId)

  // Clona cada ítem reutilizando agregarItem (recalcula tarifas/subtotales).
  // Si el original tenía tarifa custom, se preserva; si no, se recalcula del catálogo.
  for (const o of clonables) {
    const tarifaCustom = o.esTarifaCustom && o.tarifaCustom ? o.tarifaCustom.toString() : undefined
    if (o.tipo === 'EQUIPO' && o.equipoId) {
      await cotizacionesService.agregarItem(nueva.id, { tipo: 'EQUIPO', equipoId: o.equipoId, cantidadDias: o.cantidadDias, periodo: o.periodo, periodoCustomLabel: o.periodoCustomLabel ?? undefined, tarifaCustom, descripcion: o.descripcion }, usuarioId)
    } else if (o.tipo === 'HERRAMIENTA' && o.herramientaTipoId) {
      await cotizacionesService.agregarItem(nueva.id, { tipo: 'HERRAMIENTA', herramientaTipoId: o.herramientaTipoId, cantidadUnidades: o.cantidadUnidades, cantidadDias: o.cantidadDias, periodo: o.periodo, periodoCustomLabel: o.periodoCustomLabel ?? undefined, tarifaCustom, descripcion: o.descripcion }, usuarioId)
    } else if (o.tipo === 'PIEZA_ANDAMIO' && o.piezaTipoId) {
      await cotizacionesService.agregarItem(nueva.id, { tipo: 'PIEZA_ANDAMIO', piezaTipoId: o.piezaTipoId, cantidadUnidades: o.cantidadUnidades, cantidadDias: o.cantidadDias, periodo: o.periodo, periodoCustomLabel: o.periodoCustomLabel ?? undefined, tarifaCustom, descripcion: o.descripcion }, usuarioId)
    }
  }

  await prisma.auditLog.create({
    data: {
      usuarioId,
      entidad: 'Cotizacion',
      entidadId: nueva.id,
      accion: 'RENOVAR_RENTA',
      camposDespues: { actaEntregaOrigenId: acta.id, items: cotizacionItemIds } as Prisma.InputJsonValue,
    },
  })

  return cotizacionesService.obtenerCotizacion(nueva.id)
}
```
(Confirmar que `prisma`, `AppError`, `Prisma` ya están importados en `actas.service.ts` — lo están, se usan en el archivo. La firma de `agregarItem`'s DTO es la unión `AgregarItemInput`; los campos usados existen en cada variante.)

Nota de limitación conocida: las piezas de un cuerpo de andamio se clonan como ítems `PIEZA_ANDAMIO` individuales (se pierde el agrupado `cuerpoGrupoId` en el PDF de la renovación). Aceptable para v1.

- [ ] **Step 4: Controlador `renovar`**

En `actas.controller.ts`, agregar:
```typescript
export async function renovar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cotizacion = await service.renovarRenta(req.params.id as string, req.body.cotizacionItemIds, req.user!.sub)
    res.json({ success: true, data: cotizacion })
  } catch (err) { next(err) }
}
```

- [ ] **Step 5: Ruta**

En `actas.routes.ts`, en el `actasRouter` (router independiente montado en `/actas`), después de `actasRouter.patch('/:id/estado', ...)`, agregar:
```typescript
actasRouter.post('/:id/renovar', authenticate, requireRol(...escritores), validate(renovarRentaSchema), ctrl.renovar)
```
(Usar el mismo grupo de roles `...escritores` que usa `patch('/:id/estado')`, e importar `renovarRentaSchema` del schemas.)

- [ ] **Step 6: Verificar y commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx tsc --noEmit
```
Expected: sin errores.

```bash
git add src/modules/cotizaciones/cotizaciones.service.ts src/modules/actas/
git commit -m "feat(actas): endpoint POST /actas/:id/renovar — clona items en cotización vinculada"
```

---

## Tarea 3: Exceptuar la renovación del gate y del conteo (backend)

**Files:**
- Modify: `server/src/modules/cotizaciones/cotizaciones.service.ts` (`cambiarEstado` APROBADA, 668-791)
- Modify: `server/src/modules/disponibilidad/disponibilidad.service.ts` (`comprometidoNoDespachado`)

**Interfaces:**
- Consumes: `Cotizacion.actaEntregaOrigenId`.

- [ ] **Step 1: Excluir renovaciones del conteo derivado**

En `disponibilidad.service.ts`, en `comprometidoNoDespachado`, cambiar el `where` del `cotizacionItem.aggregate`:
```typescript
    where: {
      ...filtro,
      // Excluye renovaciones: su inventario ya está en obra (contado por la renta
      // original, que ya fue despachada). Sin esto se contaría dos veces.
      cotizacion: { estado: 'APROBADA', actaEntregaOrigenId: null },
      id: idsDespachados.length > 0 ? { notIn: idsDespachados } : undefined,
    },
```

- [ ] **Step 2: Cargar el set de inventario renovado al inicio del bloque APROBADA**

En `cambiarEstado`, dentro de `if (nuevoEstado === 'APROBADA')`, ANTES del `await prisma.$transaction(...)`, agregar (usa `cotizacion.actaEntregaOrigenId`, disponible porque el `findUnique` usa `include` y trae todos los escalares):
```typescript
    // Renovación: el inventario de estos ítems ya está comprometido por la renta
    // original (no devuelto). Se exceptúa del gate y no se re-marca/re-compromete.
    const renovEquipos = new Set<string>()
    const renovHerr    = new Set<string>()
    const renovPiezas  = new Set<string>()
    if (cotizacion.actaEntregaOrigenId) {
      const actaItems = await prisma.actaEntregaItem.findMany({
        where:  { actaEntregaId: cotizacion.actaEntregaOrigenId, estado: 'PENDIENTE_DEVOLUCION' },
        select: { equipoId: true, piezaTipoId: true, herramientaUnidad: { select: { herramientaTipoId: true } } },
      })
      for (const ai of actaItems) {
        if (ai.equipoId) renovEquipos.add(ai.equipoId)
        if (ai.piezaTipoId) renovPiezas.add(ai.piezaTipoId)
        if (ai.herramientaUnidad?.herramientaTipoId) renovHerr.add(ai.herramientaUnidad.herramientaTipoId)
      }
    }
```

- [ ] **Step 3: Saltear los ítems renovados en las 4 verificaciones**

En el bloque de verificación, agregar guardas de skip:
- Equipos (loop `for (const item of itemsEquipo)`): después de `if (!item.equipoId) continue`, agregar `if (renovEquipos.has(item.equipoId)) continue`.
- Piezas: al armar `piezasSolicitadas`, saltear las renovadas: dentro del loop, después de `if (!item.piezaTipoId) continue`, agregar `if (renovPiezas.has(item.piezaTipoId)) continue`.
- Herramientas: al armar `herrSolicitadas`, después de `if (!item.herramientaTipoId) continue`, agregar `if (renovHerr.has(item.herramientaTipoId)) continue`.
- (Consumibles no aplican a renovación.)

- [ ] **Step 4: No re-marcar equipos renovados a RENTADO**

En el loop "5. Equipos → RENTADO", después de `if (!item.equipoId) continue`, agregar:
```typescript
        if (renovEquipos.has(item.equipoId)) continue // ya está RENTADO por la renta original
```

- [ ] **Step 5: Verificar y commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx tsc --noEmit
```
Expected: sin errores.

```bash
git add src/modules/cotizaciones/cotizaciones.service.ts src/modules/disponibilidad/disponibilidad.service.ts
git commit -m "feat(cotizaciones): exceptuar renovaciones del gate de disponibilidad y del conteo derivado"
```

---

## Tarea 4: Trazabilidad backend (obtenerActa + obtenerCotizacion)

**Files:**
- Modify: `server/src/modules/actas/actas.service.ts` (`obtenerActa` 545-565)
- Modify: `server/src/modules/cotizaciones/cotizaciones.service.ts` (`obtenerCotizacion` 112-128)

- [ ] **Step 1: `obtenerActa` incluye renovaciones**

En el `include` de `obtenerActa`, agregar:
```typescript
      factura:           { select: { id: true, numeroFactura: true, clienteId: true } },
      renovaciones:      { select: { id: true, numeroCotizacion: true, estado: true, factura: { select: { id: true, numeroFactura: true } } }, orderBy: { createdAt: 'desc' } },
```

- [ ] **Step 2: `obtenerCotizacion` incluye actaEntregaOrigen**

En el `include` de `obtenerCotizacion`, agregar:
```typescript
      factura:              { select: { id: true, numeroFactura: true, estado: true } },
      actaEntregaOrigen:    { select: { id: true, numeroActa: true } },
```

- [ ] **Step 3: Verificar y commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx tsc --noEmit
```
Expected: sin errores.

```bash
git add src/modules/actas/actas.service.ts src/modules/cotizaciones/cotizaciones.service.ts
git commit -m "feat(renovaciones): trazabilidad acta↔cotización en obtenerActa/obtenerCotizacion"
```

---

## Tarea 5: Tipos frontend

**Files:**
- Modify: `frontend/types/api.ts` (`Cotizacion` 795-838; `Acta` 1244-1269)

- [ ] **Step 1: Agregar campos a los tipos**

En `type Cotizacion`, después de `factura: { id: string; numeroFactura: string; estado: string } | null;`, agregar:
```typescript
  actaEntregaOrigenId: string | null;
  actaEntregaOrigen?: { id: string; numeroActa: string } | null;
```

En `type Acta`, después de `items: ActaItem[];`, agregar:
```typescript
  renovaciones?: { id: string; numeroCotizacion: string; estado: EstadoCotizacion; factura: { id: string; numeroFactura: string } | null }[];
```
(`EstadoCotizacion` ya está definido en el archivo, línea ~730.)

- [ ] **Step 2: Verificar y commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit
```
Expected: sin errores.

```bash
git add types/api.ts
git commit -m "feat(types): renovación — actaEntregaOrigen en Cotizacion y renovaciones en Acta"
```

---

## Tarea 6: Modal de renovación + botón + redirect (frontend)

**Files:**
- Modify: `frontend/hooks/use-actas.ts` (`useRenovarRenta`)
- Create: `frontend/components/actas/RenovarRentaModal.tsx`
- Modify: `frontend/components/actas/ActaPanelAccionContextual.tsx` (botón + modal)
- Modify: `frontend/app/(dashboard)/cotizaciones/[id]/editar/page.tsx` (soporte `?paso`)

**Interfaces:**
- Consumes: `Acta`, `Cotizacion`, `useRenovarRenta`.

- [ ] **Step 1: Hook `useRenovarRenta`**

En `hooks/use-actas.ts`, agregar (importar `Cotizacion` al import de tipos):
```typescript
export function useRenovarRenta(actaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cotizacionItemIds: string[]) =>
      api.post<ApiResponse<Cotizacion>>(`/actas/${actaId}/renovar`, { cotizacionItemIds }).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['acta', actaId] });
      qc.invalidateQueries({ queryKey: ['cotizaciones'] });
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear la renovación.'));
    },
  });
}
```
(Confirmar que `extractErrorMessage` se importa/usa en el archivo, como en los otros hooks.)

- [ ] **Step 2: Crear `RenovarRentaModal.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useRenovarRenta } from '@/hooks/use-actas';
import type { Acta } from '@/types/api';

// Solo se renuevan ítems rentables que siguen en obra.
const TIPOS_RENTABLES = (it: Acta['items'][number]) =>
  !!it.equipo || !!it.herramientaUnidad || !!it.piezaTipo;

export function RenovarRentaModal({ acta, onClose }: { acta: Acta; onClose: () => void }) {
  const router = useRouter();
  const renovar = useRenovarRenta(acta.id);

  const renovables = acta.items.filter((it) => it.estado === 'PENDIENTE_DEVOLUCION' && TIPOS_RENTABLES(it));
  const [seleccion, setSeleccion] = useState<Record<string, boolean>>(
    () => Object.fromEntries(renovables.map((it) => [it.cotizacionItemId, true])),
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ids = Object.entries(seleccion).filter(([, v]) => v).map(([k]) => k);

  function nombre(it: Acta['items'][number]): string {
    return it.equipo?.nombre ?? it.herramientaUnidad?.herramientaTipo.nombre ?? it.piezaTipo?.nombre ?? 'Ítem';
  }

  function confirmar() {
    if (ids.length === 0) return;
    renovar.mutate(ids, {
      onSuccess: (cot) => { router.push(`/cotizaciones/${cot.id}/editar?paso=1`); },
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-lg border border-bd bg-surface shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
          <div>
            <h3 className="text-sm font-semibold text-tx">Renovar renta</h3>
            <p className="text-xs text-tx-3 mt-0.5">Elegí el inventario a renovar. Se creará una cotización vinculada a esta acta.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-tx-3 hover:text-tx"><Icon name="x" size={16} /></button>
        </div>
        <div className="px-4 py-4 space-y-2 max-h-80 overflow-y-auto">
          {renovables.length === 0 ? (
            <p className="text-sm text-tx-3">No hay inventario rentable pendiente de devolución en esta acta.</p>
          ) : renovables.map((it) => (
            <label key={it.cotizacionItemId} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="accent-accent" checked={!!seleccion[it.cotizacionItemId]} onChange={(e) => setSeleccion((s) => ({ ...s, [it.cotizacionItemId]: e.target.checked }))} />
              {nombre(it)}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-bd">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md border border-bd text-tx-2 text-sm hover:bg-bg-sunken">Cancelar</button>
          <button type="button" disabled={ids.length === 0 || renovar.isPending} onClick={confirmar} className="px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim disabled:opacity-50">
            {renovar.isPending ? 'Creando…' : 'Crear renovación'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Botón "Renovar renta" en `ActaPanelAccionContextual.tsx`**

En el bloque `ENTREGADO`/`DEVUELTA_PARCIAL`, dentro de `{puedeEscribir && (<div className="mt-3 flex flex-wrap gap-2">...)`, después del `<Link>` "Registrar devolución", agregar un botón que abre el modal. Agregar `import { useState } from 'react'` y `import { RenovarRentaModal } from './RenovarRentaModal'`; un estado `const [renovarOpen, setRenovarOpen] = useState(false)`; el botón:
```tsx
                <button
                  type="button"
                  onClick={() => setRenovarOpen(true)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 text-xs font-semibold hover:bg-bg-sunken transition-colors"
                >
                  <Icon name="refresh" size={14} /> Renovar renta
                </button>
```
y, fuera del `<div>` de acciones (antes del cierre del bloque), renderizar el modal:
```tsx
        {renovarOpen && <RenovarRentaModal acta={acta} onClose={() => setRenovarOpen(false)} />}
```
(Confirmar que el componente recibe `acta` completo con `items`; si solo recibe campos parciales, ajustar para pasar el `acta` con items — el detalle ya lo tiene.)

- [ ] **Step 4: Soporte `?paso` en la página de editar**

En `app/(dashboard)/cotizaciones/[id]/editar/page.tsx`, leer el query `paso` y pasarlo como `initialStep`:
```tsx
'use client';
import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import { CotizacionWizard } from '@/components/cotizaciones/wizard/CotizacionWizard';

export default function EditarCotizacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const sp = useSearchParams();
  const paso = Number(sp.get('paso'));
  const initialStep = paso === 1 || paso === 2 || paso === 3 ? (paso as 1 | 2 | 3) : 0;
  return <CotizacionWizard cotizacionId={id} initialStep={initialStep} />;
}
```
(Confirmar el tipo `StepId` que acepta `CotizacionWizard.initialStep`; ajustar el cast si difiere.)

- [ ] **Step 5: Verificar y commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit
```
Expected: sin errores.

```bash
git add hooks/use-actas.ts components/actas/RenovarRentaModal.tsx components/actas/ActaPanelAccionContextual.tsx "app/(dashboard)/cotizaciones/[id]/editar/page.tsx"
git commit -m "feat(actas): botón y modal Renovar renta; redirige al wizard pre-cargado"
```

---

## Tarea 7: Trazabilidad en la UI (acta + cotización)

**Files:**
- Modify: `frontend/app/(dashboard)/actas/[id]/page.tsx` (sección Renovaciones)
- Modify: `frontend/components/cotizaciones/detalle/ResumenLateral.tsx` (badge acta origen)

- [ ] **Step 1: Sección "Renovaciones" en el detalle de acta**

En `app/(dashboard)/actas/[id]/page.tsx`, en la columna derecha (junto a "Datos generales"), agregar un card condicional cuando `acta.renovaciones?.length`:
```tsx
        {acta.renovaciones && acta.renovaciones.length > 0 && (
          <div className="rounded-lg border border-bd bg-surface p-4">
            <h3 className="text-sm font-semibold text-tx mb-3">Renovaciones</h3>
            <ul className="space-y-2">
              {acta.renovaciones.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link href={`/cotizaciones/${r.id}`} className="font-mono text-accent hover:underline">{r.numeroCotizacion}</Link>
                  <span className="text-xs text-tx-3">{r.estado}{r.factura ? ` · ${r.factura.numeroFactura}` : ''}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
```
(Confirmar que `Link` está importado en la página; lo está, se usa para la factura.)

- [ ] **Step 2: Badge "Renovación del acta" en el detalle de cotización**

En `components/cotizaciones/detalle/ResumenLateral.tsx`, después del card "Factura generada" (línea ~113), agregar un card condicional cuando `cotizacion.actaEntregaOrigen`:
```tsx
      {cotizacion.actaEntregaOrigen && (
        <div className={CARD_CLS}>
          <h3 className="text-sm font-medium text-tx mb-2">Renovación de renta</h3>
          <Link href={`/actas/${cotizacion.actaEntregaOrigen.id}`} className="inline-flex items-center gap-2 text-sm font-mono text-info hover:underline">
            Acta {cotizacion.actaEntregaOrigen.numeroActa}
            <Icon name="arrowRight" size={12} />
          </Link>
        </div>
      )}
```
(Usar el mismo `CARD_CLS` e `Icon`/`Link` que ya usa el archivo.)

- [ ] **Step 3: Verificar y commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit
```
Expected: sin errores.

```bash
git add "app/(dashboard)/actas/[id]/page.tsx" components/cotizaciones/detalle/ResumenLateral.tsx
git commit -m "feat(renovaciones): trazabilidad en UI — renovaciones en acta y acta origen en cotización"
```

---

## Tarea 8: Verificación final del Grupo D

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Type-check de ambos repos**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx tsc --noEmit
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit
```
Expected: ambos sin errores.

- [ ] **Step 2: Flujo manual (requiere stack corriendo + migración aplicada)**

1. Desde un acta `ENTREGADO`, "Renovar renta" → modal con los items rentables no devueltos → seleccionar equipos/piezas → "Crear renovación" → redirige al wizard de la cotización nueva (pre-cargada, vinculada al acta).
2. Ajustar período/tarifas (y opcional depósito en Términos) → enviar → **aprobar sin `CONFLICTO_DISPONIBILIDAD`** (el equipo ya está RENTADO pero se exceptúa) → generar factura → fijar período de la factura (card de Grupo C).
3. Verificar que la disponibilidad derivada de piezas/herramientas **no** se descuenta dos veces por la renovación (aprobar otra cotización del mismo tipo de pieza no debe ver stock fantasma).
4. Trazabilidad: el detalle del acta muestra la sección "Renovaciones"; el detalle de la cotización de renovación muestra "Renovación de renta → Acta N°".
5. La renovación **no** crea un acta de entrega nueva; la recepción posterior sobre el acta original sigue funcionando.

---

## Cobertura del spec (self-review)

- **Item 10** (renovar sin devolución, automatizado): Tareas 2 (endpoint+clonado), 3 (gate exceptuado), 6 (UI un-paso desde el acta).
- **Item 13** (desde acta, cotización+factura vinculada al acta inicial, sin nueva entrega): Tareas 1 (`actaEntregaOrigenId`), 2 (crea cotización vinculada, no acta), 4+7 (trazabilidad). La factura se genera con el flujo normal desde la cotización aprobada; no se crea acta nueva.
