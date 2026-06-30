# Grupo A — Apartado, disponibilidad de inventario y bug de equipos · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar el sistema de apartado preventivo, derivar la disponibilidad de inventario de las cotizaciones aprobadas y validar disponibilidad al aprobar — arreglando de paso el bug que impide ingresar equipos a cotizaciones (feedback Reinar items 1, 2, 3).

**Architecture:** Se elimina la capa de reservas (`ReservaEquipo`, `ReservaHerramientaUnidad`, job de expiración, estado `RESERVADA`). El compromiso físico existente no se toca: equipos → `RENTADO` al aprobar y `DISPONIBLE` al recibir; herramientas/piezas/consumibles → comprometidos en el despacho del acta y restaurados en recepción. El gate de "primero aprobado gana" se valida al aprobar: para equipos vía `estado`, para herramientas/piezas vía disponibilidad **derivada** (stock/unidades menos lo comprometido por cotizaciones aprobadas aún no despachadas).

**Tech Stack:** Backend Express + Prisma (`/Users/joaquinmorales13a06/Desktop/Reinar/server`). Frontend Next.js 19 + React Query + Tailwind (`/Users/joaquinmorales13a06/Desktop/Reinar/frontend`). Socket.IO para disponibilidad en tiempo real.

## Global Constraints

- Branch única para todo el feedback: `feat/feedback-reinar` (ya creada en frontend; crear en backend en la Tarea 0).
- Sin suite de tests. Verificación: backend `npx tsc --noEmit` (y `npx prisma validate` / `migrate dev` donde aplique); frontend `pnpm tsc --noEmit`. Más flujos manuales descritos por tarea.
- Montos: strings Decimal; nunca `parseFloat`. (No se calculan montos en este grupo.)
- Idioma 100% español en UI, mensajes y comentarios. Comentarios solo tipo "why".
- Commits frecuentes, uno por tarea. Cada commit debe compilar (`tsc --noEmit` limpio).
- Orden de tareas pensado para que cada commit compile: primero se agrega lo nuevo y se quitan los usos de reservas, y solo al final se borran los modelos Prisma (si se borraran antes, el cliente Prisma regenerado rompería los archivos que aún los referencian).

---

## File Structure

**Backend (`server/`):**
- Create: `src/modules/disponibilidad/disponibilidad.service.ts` — cálculo de disponibilidad derivada (gate de aprobación + historial de rentas).
- Modify: `src/modules/cotizaciones/cotizaciones.service.ts` — quitar reservas de `agregarItem`/`editarItem`/`eliminarItem`/`eliminarCotizacion`; reescribir gate de aprobación en `cambiarEstado`; ajustar emisión socket.
- Modify: `src/modules/equipos/equipos.service.ts` — reescribir `listarHistorialRentas` derivándolo de cotizaciones aprobadas.
- Modify: `src/config/env.ts` — quitar `RESERVA_TTL_MINUTOS`.
- Modify: `src/index.ts` — desmontar rutas de reservas y el cron de limpieza.
- Delete: `src/modules/reservas/` (service, controller, routes) y `src/jobs/limpiarReservasExpiradas.ts`.
- Modify: `prisma/schema.prisma` + nueva migración — eliminar modelos de reserva, enum `EstadoReserva`, valor `RESERVADA`, y relaciones inversas.

**Frontend (`frontend/`):**
- Modify: `types/api.ts` — quitar `RESERVADA` de `EstadoHerramienta`.
- Modify: `components/cotizaciones/wizard/AgregarItemModal/TabEquipo.tsx` — mostrar todos los equipos con badge, permitir agregar cualquiera.
- Modify: `components/cotizaciones/wizard/AgregarItemModal/TabHerramienta.tsx` — permitir agregar aunque exceda lo disponible (gate real es la aprobación).
- Modify: `components/cotizaciones/detalle/AccionesEstado.tsx` — aviso inline de conflicto de disponibilidad; actualizar copy que menciona "reservas".
- Modify: `app/(dashboard)/equipos/[id]/page.tsx` — reemplazar el placeholder de reservas.
- Delete: `components/equipos/EquipoReservaPlaceholder.tsx`.

---

## Tarea 0: Branch de backend

**Files:** ninguno (solo git en `server/`).

- [ ] **Step 1: Crear la branch en el repo de backend**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git checkout -b feat/feedback-reinar
git status
```

Expected: `On branch feat/feedback-reinar`, árbol limpio.

---

## Tarea 1: Servicio de disponibilidad derivada (backend)

Crea el módulo de cálculo de disponibilidad. Es puramente aditivo (no rompe nada). Lo consumen la Tarea 2 (gate de aprobación) y la Tarea 5 (historial de rentas).

**Files:**
- Create: `server/src/modules/disponibilidad/disponibilidad.service.ts`

**Interfaces:**
- Produces:
  - `disponibilidadHerramientaTipo(herramientaTipoId: string, tx: Prisma.TransactionClient): Promise<number>` — unidades realmente disponibles del tipo (DISPONIBLE menos comprometidas por aprobadas-no-despachadas).
  - `disponibilidadPieza(piezaTipoId: string, tx: Prisma.TransactionClient): Promise<number>` — stock disponible de la pieza menos lo comprometido por aprobadas-no-despachadas.
  - `historialRentasEquipo(equipoId: string): Promise<Array<{ cotizacionId: string; numeroCotizacion: string; fechaAprobacion: Date | null; cliente: { id: string; tipo: string; razonSocial: string | null; nombre: string | null; apellido: string | null }; periodo: string; periodoCustomLabel: string | null; fechaServicio: Date | null }>>`

- [ ] **Step 1: Crear el archivo del servicio**

```typescript
// server/src/modules/disponibilidad/disponibilidad.service.ts
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../middleware/error.middleware'

// Cantidad comprometida de un recurso (pieza o tipo de herramienta) por
// cotizaciones APROBADAS cuyo ítem aún NO fue despachado. Un ítem se considera
// despachado cuando existe un ActaEntregaItem que lo referencia (mismo criterio
// que actas.service.listarItemsDisponiblesDespacho). Los despachados ya están
// reflejados en el stock físico / estado de las unidades, por eso se excluyen
// para no contarlos dos veces.
async function comprometidoNoDespachado(
  tx: Prisma.TransactionClient,
  filtro: { herramientaTipoId: string } | { piezaTipoId: string },
): Promise<number> {
  const itemsDespachados = await tx.actaEntregaItem.findMany({
    select: { cotizacionItemId: true },
  })
  const idsDespachados = itemsDespachados.map((i) => i.cotizacionItemId)

  const agregado = await tx.cotizacionItem.aggregate({
    _sum: { cantidadUnidades: true },
    where: {
      ...filtro,
      cotizacion: { estado: 'APROBADA' },
      id: idsDespachados.length > 0 ? { notIn: idsDespachados } : undefined,
    },
  })
  return agregado._sum.cantidadUnidades ?? 0
}

export async function disponibilidadHerramientaTipo(
  herramientaTipoId: string,
  tx: Prisma.TransactionClient,
): Promise<number> {
  const totalDisponibles = await tx.herramientaUnidad.count({
    where: { herramientaTipoId, estado: 'DISPONIBLE' },
  })
  const comprometido = await comprometidoNoDespachado(tx, { herramientaTipoId })
  return totalDisponibles - comprometido
}

export async function disponibilidadPieza(
  piezaTipoId: string,
  tx: Prisma.TransactionClient,
): Promise<number> {
  const pieza = await tx.piezaTipo.findUnique({
    where: { id: piezaTipoId },
    select: { stockActual: true },
  })
  if (!pieza) return 0
  const comprometido = await comprometidoNoDespachado(tx, { piezaTipoId })
  return pieza.stockActual - comprometido
}

// Historial de rentas de un equipo: cotizaciones APROBADAS que tienen al menos
// un ítem con este equipo. Reemplaza la consulta anterior basada en
// ReservaEquipo CONVERTIDA (la capa de reservas se elimina).
export async function historialRentasEquipo(equipoId: string) {
  const equipo = await prisma.equipo.findUnique({ where: { id: equipoId }, select: { id: true } })
  if (!equipo) throw new AppError(404, 'NOT_FOUND', 'Equipo no encontrado')

  const items = await prisma.cotizacionItem.findMany({
    where: { equipoId, tipo: 'EQUIPO', cotizacion: { estado: 'APROBADA' } },
    select: {
      periodo: true,
      periodoCustomLabel: true,
      fechaServicio: true,
      cotizacion: {
        select: {
          id: true,
          numeroCotizacion: true,
          fechaAprobacion: true,
          cliente: { select: { id: true, tipo: true, razonSocial: true, nombre: true, apellido: true } },
        },
      },
    },
  })

  return items
    .map((it) => ({
      cotizacionId:       it.cotizacion.id,
      numeroCotizacion:   it.cotizacion.numeroCotizacion,
      fechaAprobacion:    it.cotizacion.fechaAprobacion,
      cliente:            it.cotizacion.cliente,
      periodo:            it.periodo,
      periodoCustomLabel: it.periodoCustomLabel,
      fechaServicio:      it.fechaServicio,
    }))
    .sort((a, b) => (b.fechaAprobacion?.getTime() ?? 0) - (a.fechaAprobacion?.getTime() ?? 0))
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx tsc --noEmit`
Expected: sin errores nuevos (los modelos Prisma `actaEntregaItem`, `cotizacionItem`, `herramientaUnidad`, `piezaTipo` aún existen, así que compila).

- [ ] **Step 3: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/modules/disponibilidad/disponibilidad.service.ts
git commit -m "feat(disponibilidad): servicio de disponibilidad derivada de inventario"
```

---

## Tarea 2: Gate de aprobación derivado en `cambiarEstado` (backend)

Reescribe los caminos `APROBADA` y `RECHAZADA` de `cambiarEstado` para no depender de reservas y para validar disponibilidad derivada.

**Files:**
- Modify: `server/src/modules/cotizaciones/cotizaciones.service.ts` (`cambiarEstado`, líneas ~672-875)

**Interfaces:**
- Consumes: `disponibilidadHerramientaTipo`, `disponibilidadPieza` de la Tarea 1.

- [ ] **Step 1: Importar el servicio de disponibilidad**

Agregar junto a los imports existentes del archivo (cerca de `import * as reservasService from '../reservas/reservas.service'`, que se eliminará en la Tarea 6):

```typescript
import * as disponibilidadService from '../disponibilidad/disponibilidad.service'
```

- [ ] **Step 2: Reemplazar el bloque `ENVIADA → RECHAZADA`**

Buscar el bloque actual (líneas ~722-768, el `if (nuevoEstado === 'RECHAZADA') { ... }`) y reemplazar TODO su cuerpo por una versión sin reservas:

```typescript
  // ── ENVIADA → RECHAZADA ─────────────────────────────────────────────────────
  if (nuevoEstado === 'RECHAZADA') {
    await prisma.$transaction(async (tx) => {
      await tx.cotizacion.update({ where: { id }, data: { estado: 'RECHAZADA' } })
      await tx.auditLog.create({
        data: {
          usuarioId,
          entidad:       'Cotizacion',
          entidadId:     id,
          accion:        'CAMBIAR_ESTADO_COTIZACION',
          camposDespues: { estadoAnterior: 'ENVIADA', estadoNuevo: 'RECHAZADA' } as Prisma.InputJsonValue,
        },
      })
    })
    io.to(`cotizacion:${id}`).emit('cotizacion:estado_cambiado', { cotizacionId: id, estado: 'RECHAZADA', fecha: new Date() })
    void crearNotificacion(
      cotizacion.creadoPorId,
      'COTIZACION_RECHAZADA',
      'Cotización rechazada',
      `La cotización ${cotizacion.numeroCotizacion} fue rechazada.`,
      `/cotizaciones/${id}`,
    )
    return
  }
```

(Rechazar ya no libera nada: agregar ítems nunca reservó inventario.)

- [ ] **Step 3: Reescribir la verificación dentro del bloque `ENVIADA → APROBADA`**

Dentro de `if (nuevoEstado === 'APROBADA')`, reemplazar los pasos **1, 2 y 3** (las tres verificaciones actuales de equipos/consumibles/andamio) por la versión derivada. El nuevo bloque junta todos los conflictos en un solo mensaje legible:

```typescript
    const itemsEquipo       = cotizacion.items.filter(i => i.tipo === 'EQUIPO')
    const itemsConsumible   = cotizacion.items.filter(i => i.tipo === 'CONSUMIBLE')
    const itemsAndamio      = cotizacion.items.filter(i => i.tipo === 'PIEZA_ANDAMIO')
    const itemsHerramienta  = cotizacion.items.filter(i => i.tipo === 'HERRAMIENTA')

    await prisma.$transaction(async (tx) => {
      const conflictos: string[] = []

      // 1. Equipos: el primero aprobado gana. equipo.estado === RENTADO
      //    significa que otra cotización aprobada ya lo tomó (se libera en recepción).
      for (const item of itemsEquipo) {
        if (!item.equipoId) continue
        const equipo = await tx.equipo.findUnique({
          where: { id: item.equipoId },
          select: { nombre: true, estado: true },
        })
        if (!equipo || equipo.estado !== 'DISPONIBLE') {
          conflictos.push(`Equipo ${equipo?.nombre ?? item.equipoId} no disponible (${equipo?.estado ?? 'inexistente'})`)
        }
      }

      // 2. Consumibles: stock físico actual (no se renta, se consume).
      for (const item of itemsConsumible) {
        if (!item.consumibleId) continue
        const consumible = await tx.consumible.findUnique({
          where: { id: item.consumibleId },
          select: { stockActual: true, nombre: true },
        })
        if (!consumible || consumible.stockActual < item.cantidadUnidades) {
          conflictos.push(`Consumible ${consumible?.nombre ?? item.consumibleId}: stock insuficiente`)
        }
      }

      // 3. Piezas de andamio (agrupadas por tipo): disponibilidad derivada.
      const piezasSolicitadas = new Map<string, number>()
      for (const item of itemsAndamio) {
        if (!item.piezaTipoId) continue
        piezasSolicitadas.set(item.piezaTipoId, (piezasSolicitadas.get(item.piezaTipoId) ?? 0) + item.cantidadUnidades)
      }
      for (const [piezaTipoId, solicitado] of piezasSolicitadas) {
        const disponible = await disponibilidadService.disponibilidadPieza(piezaTipoId, tx)
        if (disponible < solicitado) {
          const pieza = await tx.piezaTipo.findUnique({ where: { id: piezaTipoId }, select: { nombre: true } })
          conflictos.push(`Pieza ${pieza?.nombre ?? piezaTipoId}: solicitadas ${solicitado}, disponibles ${Math.max(disponible, 0)}`)
        }
      }

      // 4. Herramientas (agrupadas por tipo): disponibilidad derivada.
      const herrSolicitadas = new Map<string, number>()
      for (const item of itemsHerramienta) {
        if (!item.herramientaTipoId) continue
        herrSolicitadas.set(item.herramientaTipoId, (herrSolicitadas.get(item.herramientaTipoId) ?? 0) + item.cantidadUnidades)
      }
      for (const [herramientaTipoId, solicitado] of herrSolicitadas) {
        const disponible = await disponibilidadService.disponibilidadHerramientaTipo(herramientaTipoId, tx)
        if (disponible < solicitado) {
          const tipo = await tx.herramientaTipo.findUnique({ where: { id: herramientaTipoId }, select: { nombre: true } })
          conflictos.push(`Herramienta ${tipo?.nombre ?? herramientaTipoId}: solicitadas ${solicitado}, disponibles ${Math.max(disponible, 0)}`)
        }
      }

      if (conflictos.length > 0) {
        throw new AppError(409, 'CONFLICTO_DISPONIBILIDAD', `No se pudo aprobar: ${conflictos.join('; ')}`, conflictos)
      }
```

Nota: el `cotizacion.items` debe incluir `herramientaTipoId`. Verificar el `select` del `findUnique` al inicio de `cambiarEstado` (líneas ~677-685) e **incluir `herramientaTipoId: true` y `piezaTipoId: true`** en el select de `items` (ya incluye `equipoId`, `consumibleId`, `piezaTipoId`, `cantidadUnidades`, `cantidadDias`; agregar `herramientaTipoId: true` si falta).

- [ ] **Step 4: Quitar la conversión de reservas a CONVERTIDA y el marcado de herramientas (paso 6)**

Dentro del mismo bloque `APROBADA`, en el paso **5** (equipos → RENTADO) eliminar el `tx.reservaEquipo.updateMany(... CONVERTIDA ...)` y cambiar la emisión socket. Reemplazar el `for` de equipos por:

```typescript
      // 5. Equipos → RENTADO (el primero aprobado los aparta hasta recepción).
      for (const item of itemsEquipo) {
        if (!item.equipoId) continue
        await tx.equipo.update({ where: { id: item.equipoId }, data: { estado: 'RENTADO' } })
        io.to('equipos').emit('equipo:disponibilidad', { equipoId: item.equipoId, estado: 'RENTADO', updatedAt: new Date() })
      }
```

Eliminar por completo el paso **6** (el bloque `const reservasHerramienta = await tx.reservaHerramientaUnidad.findMany(...)` y su `for`). Las unidades de herramienta se comprometen físicamente en el despacho del acta, no aquí.

- [ ] **Step 5: Verificar que compila**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx tsc --noEmit`
Expected: sin errores nuevos. (`reservasService` sigue importado y usado en `agregarItem`/`editarItem`/`eliminarItem` — se limpia en Tareas 3-4-6.)

- [ ] **Step 6: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/modules/cotizaciones/cotizaciones.service.ts
git commit -m "feat(cotizaciones): gate de disponibilidad derivada al aprobar; sin reservas"
```

---

## Tarea 3: Quitar reservas de `agregarItem` (backend) — arregla el bug de equipos

**Files:**
- Modify: `server/src/modules/cotizaciones/cotizaciones.service.ts` (`agregarItem`, casos `EQUIPO` y `HERRAMIENTA`)

- [ ] **Step 1: Eliminar la creación de reserva de equipo**

En el `case 'EQUIPO':` (línea ~370) eliminar la línea:

```typescript
        await reservasService.crearReserva(equipo.id, cotizacionId, usuarioId, tx)
```

- [ ] **Step 2: Eliminar la creación de reserva de herramienta**

En el `case 'HERRAMIENTA':` (línea ~382) eliminar la línea:

```typescript
        await reservasService.crearReservaHerramienta(tipo.id, cantidadUnidades, cotizacionId, usuarioId, tx)
```

- [ ] **Step 3: Verificar que compila**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 4: Verificación manual del bug (item 3)**

Con backend y frontend corriendo: crear dos cotizaciones BORRADOR y agregar el MISMO equipo a ambas. Antes fallaba con `409 EQUIPO_RESERVADO`; ahora ambas deben aceptarlo.

- [ ] **Step 5: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/modules/cotizaciones/cotizaciones.service.ts
git commit -m "fix(cotizaciones): agregar ítem ya no reserva inventario (arregla ingreso de equipos)"
```

---

## Tarea 4: Quitar reservas de `editarItem`, `eliminarItem` y `eliminarCotizacion` (backend)

**Files:**
- Modify: `server/src/modules/cotizaciones/cotizaciones.service.ts`

- [ ] **Step 1: Limpiar `editarItem`**

Dentro de `editarItem`, eliminar TODO el bloque que maneja reservas (líneas ~497-533): el `if (item.tipo === 'EQUIPO') { const reserva = ... renovarReserva ... }` y el `if (item.tipo === 'HERRAMIENTA') { ... crearReservaHerramienta / renovarReservaHerramienta ... }`. Editar un ítem ya no toca disponibilidad. El resto de `editarItem` (cálculo de tarifa/subtotal y `_recalcularTotales`) permanece igual.

- [ ] **Step 2: Limpiar `eliminarItem`**

Dentro de `eliminarItem` (línea ~638), eliminar los dos bloques de reservas: el `if (item.tipo === 'EQUIPO' && item.equipoId) { ... reservaEquipo ... emit equipo:disponibilidad ... }` y el `if (item.tipo === 'HERRAMIENTA') { ... reservaHerramientaUnidad ... }`. El cuerpo de la transacción queda:

```typescript
  await prisma.$transaction(async (tx) => {
    await tx.cotizacionItem.delete({ where: { id: itemId } })
    await _recalcularTotales(cotizacionId, tx)
  })
```

Si tras quitar el uso de `io` queda la variable `const io = getIO()` sin usar en `eliminarItem`, eliminar también esa línea para no romper el lint/tsc (`noUnusedLocals`).

- [ ] **Step 3: Limpiar `eliminarCotizacion`**

Dentro de `eliminarCotizacion` (líneas ~262-306), eliminar toda la recolección y borrado de reservas y la restauración de unidades de herramienta. El cuerpo de la transacción queda:

```typescript
  await prisma.$transaction(async (tx) => {
    await tx.cotizacionItem.deleteMany({ where: { cotizacionId: id } })
    await tx.cotizacion.delete({ where: { id } })
  })
```

Eliminar también el `const io = getIO()` de `eliminarCotizacion` si queda sin uso.

- [ ] **Step 4: Limpiar `cancelarCotizacionPorAnulacionFactura`**

Esta función (líneas ~899-965) cancela una cotización APROBADA cuando se anula su factura, y hoy libera reservas. Bajo el nuevo modelo: los equipos comprometidos vuelven a `DISPONIBLE` (se mantiene), pero ya no hay reservas que liberar y las herramientas no se comprometen a nivel de cotización (se gestionan en el flujo de acta/recepción). Reemplazar los pasos 1 y 2 de la función:

- En el `for (const item of itemsEquipo)` (paso 1), eliminar el bloque `await tx.reservaEquipo.updateMany({ ... CONVERTIDA -> LIBERADA ... })`, dejando solo:

```typescript
  for (const item of itemsEquipo) {
    if (!item.equipoId) continue
    await tx.equipo.update({ where: { id: item.equipoId }, data: { estado: 'DISPONIBLE' } })
    eventosEquipo.push(item.equipoId)
  }
```

- Eliminar por completo el paso 2 (el `const reservasHerramienta = await tx.reservaHerramientaUnidad.findMany({ ... CONVERTIDA ... })` y su `for`). El resto de la función (cotización → CANCELADA, audit, `return`) permanece igual.

- [ ] **Step 5: Verificar que compila**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx tsc --noEmit`
Expected: sin errores nuevos. (`reservasService` puede quedar sin uso ahora; si `noUnusedLocals` se queja del import, se elimina en la Tarea 6 junto con el módulo — si tsc falla aquí por el import sin uso, quitar el import `import * as reservasService ...` en este commit.)

- [ ] **Step 6: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/modules/cotizaciones/cotizaciones.service.ts
git commit -m "refactor(cotizaciones): editar/eliminar/cancelar sin lógica de reservas"
```

---

## Tarea 5: Reescribir `listarHistorialRentas` (backend)

**Files:**
- Modify: `server/src/modules/equipos/equipos.service.ts` (`listarHistorialRentas`, líneas ~371-416)

**Interfaces:**
- Consumes: `historialRentasEquipo` de la Tarea 1.

- [ ] **Step 1: Reemplazar el cuerpo de la función por una delegación al servicio de disponibilidad**

```typescript
import * as disponibilidadService from '../disponibilidad/disponibilidad.service'

// ...

export async function listarHistorialRentas(equipoId: string) {
  return disponibilidadService.historialRentasEquipo(equipoId)
}
```

(La nueva función ya valida que el equipo exista y deriva el historial de cotizaciones APROBADAS, devolviendo la misma forma `{ cotizacionId, numeroCotizacion, fechaAprobacion, cliente, periodo, periodoCustomLabel, fechaServicio }` que consumía el controlador antes.)

- [ ] **Step 2: Reescribir `listarHistorialRentasUnidad` (herramientas.service.ts)**

`server/src/modules/herramientas/herramientas.service.ts` tiene la función análoga para unidades de herramienta (líneas ~308-358), que hoy usa `prisma.reservaHerramientaUnidad` con estado `CONVERTIDA`. Bajo el nuevo modelo, la unidad física se asigna en el **despacho** del acta, no en la cotización, así que el historial se deriva de `ActaEntregaItem` (donde `herramientaUnidadId` quedó registrado). Reemplazar todo el cuerpo de la función — desde el comentario que la precede (`// Historial de rentas de una unidad...`) hasta el `}` de cierre — por:

```typescript
// Historial de rentas de una unidad: actas de entrega donde la unidad física
// fue despachada (la unidad se asigna en el despacho, no en la cotización).
// Derivado de ActaEntregaItem → ActaEntrega → Factura → Cotización.
export async function listarHistorialRentasUnidad(unidadId: string) {
  const unidad = await prisma.herramientaUnidad.findUnique({
    where: { id: unidadId },
    select: { id: true },
  })
  if (!unidad) throw new AppError(404, 'NOT_FOUND', 'Unidad de herramienta no encontrada')

  const actaItems = await prisma.actaEntregaItem.findMany({
    where: { herramientaUnidadId: unidadId },
    select: {
      cotizacionItemId: true,
      actaEntrega: {
        select: {
          factura: {
            select: {
              cotizacion: {
                select: {
                  id:               true,
                  numeroCotizacion: true,
                  fechaAprobacion:  true,
                  cliente: { select: { id: true, tipo: true, razonSocial: true, nombre: true, apellido: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  // periodo/fechaServicio viven en el CotizacionItem original (ActaEntregaItem
  // guarda cotizacionItemId como string plano, sin relación). Lo cruzamos aparte.
  const cotItems = await prisma.cotizacionItem.findMany({
    where: { id: { in: actaItems.map((a) => a.cotizacionItemId) } },
    select: { id: true, periodo: true, periodoCustomLabel: true, fechaServicio: true },
  })
  const cotItemMap = new Map(cotItems.map((ci) => [ci.id, ci]))

  return actaItems
    .map((a) => {
      const cot = a.actaEntrega.factura.cotizacion
      const ci  = cotItemMap.get(a.cotizacionItemId)
      return {
        cotizacionId:       cot.id,
        numeroCotizacion:   cot.numeroCotizacion,
        fechaAprobacion:    cot.fechaAprobacion,
        cliente:            cot.cliente,
        periodo:            ci?.periodo            ?? null,
        periodoCustomLabel: ci?.periodoCustomLabel ?? null,
        fechaServicio:      ci?.fechaServicio      ?? null,
      }
    })
    .sort((a, b) => (b.fechaAprobacion?.getTime() ?? 0) - (a.fechaAprobacion?.getTime() ?? 0))
}
```

Mantiene la misma forma de retorno que antes, así que el controlador no cambia.

- [ ] **Step 3: Verificar que compila**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 4: Verificación manual**

Aprobar una cotización con un equipo y abrir el detalle del equipo → su historial de rentas debe listar esa cotización. Para herramientas, el historial de una unidad lista los despachos (actas) de esa unidad.

- [ ] **Step 5: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/modules/equipos/equipos.service.ts
git commit -m "refactor(equipos): historial de rentas derivado de cotizaciones aprobadas"
```

---

## Tarea 6: Eliminar el módulo de reservas, el job y la env (backend)

Ahora que ningún archivo usa reservas, se borra la infraestructura. Este commit deja el árbol sin referencias a reservas (excepto el schema Prisma, que se limpia en la Tarea 7).

**Files:**
- Delete: `server/src/modules/reservas/reservas.service.ts`, `reservas.controller.ts`, `reservas.routes.ts`
- Delete: `server/src/jobs/limpiarReservasExpiradas.ts`
- Modify: `server/src/index.ts`, `server/src/config/env.ts`, `server/src/modules/cotizaciones/cotizaciones.service.ts`

- [ ] **Step 1: Quitar el import de `reservasService` en cotizaciones (si aún está)**

En `cotizaciones.service.ts` eliminar (si no se quitó en la Tarea 4):

```typescript
import * as reservasService from '../reservas/reservas.service'
```

- [ ] **Step 2: Desmontar rutas y cron en `index.ts`**

Eliminar estas líneas de `server/src/index.ts`:
- Línea ~24: `import reservasRoutes from './modules/reservas/reservas.routes'`
- Línea ~40: `import { limpiarReservasExpiradas } from './jobs/limpiarReservasExpiradas'`
- Línea ~88: `api.use('/reservas', reservasRoutes)`
- Línea ~112: `let cronLimpiarReservas:  ReturnType<typeof setInterval>`
- Línea ~123: `cronLimpiarReservas  = setInterval(limpiarReservasExpiradas, 60_000)`
- Línea ~132: `clearInterval(cronLimpiarReservas)`

- [ ] **Step 3: Quitar `RESERVA_TTL_MINUTOS` de la config**

En `server/src/config/env.ts` eliminar la línea (~23):

```typescript
RESERVA_TTL_MINUTOS: z.coerce.number().default(30),
```

- [ ] **Step 4: Borrar los archivos del módulo de reservas y el job**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git rm src/modules/reservas/reservas.service.ts src/modules/reservas/reservas.controller.ts src/modules/reservas/reservas.routes.ts
git rm src/jobs/limpiarReservasExpiradas.ts
```

- [ ] **Step 5: Quitar las comparaciones contra `'RESERVADA'`**

Al eliminar `RESERVADA` del enum `EstadoHerramienta` (Tarea 7), cualquier comparación `estado === 'RESERVADA'` deja de compilar. Quitarlas ahora:

- `src/modules/herramientas/herramientas.service.ts` línea ~249 (en mover bodega): cambiar
  ```typescript
  if (unidad.estado === 'RENTADA' || unidad.estado === 'RESERVADA') {
    throw new AppError(422, 'ESTADO_INVALIDO', `No se puede mover una unidad ${unidad.estado}`)
  }
  ```
  por:
  ```typescript
  if (unidad.estado === 'RENTADA') {
    throw new AppError(422, 'ESTADO_INVALIDO', `No se puede mover una unidad ${unidad.estado}`)
  }
  ```
- `src/modules/herramientas/herramientas.service.ts` líneas ~287-290 (en cambiar estado de unidad): cambiar el comentario y la condición:
  ```typescript
  // RENTADA es gestionada por actas, no editable manualmente
  if (unidad.estado === 'RENTADA') {
    throw new AppError(422, 'ESTADO_INVALIDO', `No se puede cambiar el estado de una unidad ${unidad.estado} manualmente`)
  }
  ```
- `src/modules/mantenimientos/mantenimientos.service.ts` línea ~99: cambiar
  ```typescript
  if (unidad.estado === 'RENTADA' || unidad.estado === 'RESERVADA')
  ```
  por:
  ```typescript
  if (unidad.estado === 'RENTADA')
  ```
- `src/modules/herramientas/herramientas.schemas.ts` línea ~40: actualizar el comentario para que no mencione `RESERVADA` (p. ej. "RENTADA no se permite aquí — la gestiona automáticamente la capa de actas").
- `src/modules/disponibilidad/disponibilidad.service.ts` (comentario ~línea 57 de `historialRentasEquipo`): reformular el comentario para que no nombre el modelo eliminado `ReservaEquipo` (p. ej. "deriva de las cotizaciones APROBADAS que referencian el equipo").

- [ ] **Step 6: Verificar que compila**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx tsc --noEmit`
Expected: sin errores. Si tsc reporta uso de `RESERVA_TTL_MINUTOS` o `reservasService` en algún archivo no contemplado, hacer grep y limpiarlo:

```bash
grep -rn "reservasService\|RESERVA_TTL_MINUTOS\|limpiarReservasExpiradas\|reservas.routes\|reservas.service\|'RESERVADA'" src/
```

Expected: sin resultados (las comparaciones `'RESERVADA'` quedaron eliminadas en el Step 5).

- [ ] **Step 7: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add -A
git commit -m "chore(reservas): eliminar módulo/job/env y comparaciones a estado RESERVADA"
```

---

## Tarea 7: Migración Prisma — eliminar modelos y estado de reserva (backend)

Último paso de backend: limpiar el schema y migrar la BD. Se hace al final porque al regenerar el cliente Prisma desaparecen los tipos `reservaEquipo`/`reservaHerramientaUnidad`/`EstadoReserva`/`RESERVADA`, y para entonces ningún archivo debe referenciarlos.

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: nueva migración bajo `server/prisma/migrations/`

- [ ] **Step 1: Editar `schema.prisma`**

- Eliminar el modelo `ReservaEquipo` (líneas ~866-883) y `ReservaHerramientaUnidad` (líneas ~885-902).
- Eliminar el `enum EstadoReserva` (líneas ~113-118).
- En `enum EstadoHerramienta` (líneas ~198-205), eliminar la línea `RESERVADA`.
- En `model Equipo`, eliminar la relación inversa `reservas        ReservaEquipo[]`.
- En `model HerramientaUnidad`, eliminar la relación inversa `reservas       ReservaHerramientaUnidad[]`.
- En `model Cotizacion`, eliminar `reservas            ReservaEquipo[]` y `reservasHerramienta ReservaHerramientaUnidad[]`.
- En `model Usuario`, eliminar cualquier relación inversa a `ReservaEquipo`/`ReservaHerramientaUnidad` (buscar `Reserva` en el modelo Usuario).

- [ ] **Step 2: Verificar el schema y buscar referencias colgantes**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
npx prisma validate
grep -n "Reserva\|RESERVADA" prisma/schema.prisma
```

Expected: `prisma validate` OK; el grep no devuelve nada.

- [ ] **Step 3: Crear la migración (normalizando datos antes de borrar)**

Antes de migrar, las unidades de herramienta en estado `RESERVADA` deben pasar a `DISPONIBLE` (si no, falla el `ALTER TYPE`). Generar la migración sin aplicarla aún para editar el SQL:

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
npx prisma migrate dev --name quitar_reservas_inventario --create-only
```

Editar el SQL generado para que, **antes** del `DROP`/`ALTER TYPE` del enum, normalice las unidades:

```sql
-- Normalizar unidades reservadas antes de eliminar el valor del enum
UPDATE "HerramientaUnidad" SET "estado" = 'DISPONIBLE' WHERE "estado" = 'RESERVADA';
```

(El resto del SQL autogenerado dropea las tablas `ReservaEquipo`, `ReservaHerramientaUnidad`, el enum `EstadoReserva` y recrea `EstadoHerramienta` sin `RESERVADA`.)

- [ ] **Step 4: Aplicar la migración y regenerar el cliente**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
npx prisma migrate dev
```

Expected: migración aplicada, cliente Prisma regenerado.

- [ ] **Step 5: Verificar que compila contra el cliente regenerado**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx tsc --noEmit`
Expected: sin errores (confirma que ningún archivo referencia los modelos/estado eliminados).

- [ ] **Step 6: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add prisma/
git commit -m "feat(prisma): eliminar modelos de reserva y estado RESERVADA de herramienta"
```

---

## Tarea 8: Frontend — quitar `RESERVADA` del tipo `EstadoHerramienta`

**Files:**
- Modify: `frontend/types/api.ts` (líneas ~325-331)

- [ ] **Step 1: Editar el tipo**

Eliminar la línea `| 'RESERVADA'` (y su comentario) del union `EstadoHerramienta`:

```typescript
export type EstadoHerramienta =
  | 'DISPONIBLE'
  | 'RENTADA'       // gestionado por actas
  | 'MANTENIMIENTO' // gestionado por el módulo de mantenimientos
  | 'USO_INTERNO'
  | 'INACTIVO';
```

- [ ] **Step 2: Buscar usos de `'RESERVADA'` en el frontend**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
grep -rn "RESERVADA" app components hooks lib types
```

Expected: sin resultados (o solo en el badge map de `Badge.tsx`, que es inofensivo; si aparece, dejarlo — no rompe tipos). Si algún componente comparaba contra `'RESERVADA'`, ajustarlo.

- [ ] **Step 3: Verificar que compila**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add types/api.ts
git commit -m "refactor(types): quitar estado RESERVADA de herramienta"
```

---

## Tarea 9: Frontend — selector de equipos muestra todos con badge

**Files:**
- Modify: `frontend/components/cotizaciones/wizard/AgregarItemModal/TabEquipo.tsx`

- [ ] **Step 1: Quitar el filtro `estado: 'DISPONIBLE'`**

Cambiar la query (línea ~28) para listar todos los equipos:

```typescript
  // Sin apartado: cualquier equipo puede agregarse a varias cotizaciones; la
  // disponibilidad real se valida al aprobar. Mostramos su estado como indicador.
  const equiposQ = useEquipos({ search: search || undefined, limit: 20 });
```

- [ ] **Step 2: Mostrar el estado real como badge**

Reemplazar el badge fijo `<Badge status="Disponible" kind="ok" />` (línea ~75) por uno derivado del estado del equipo de esa fila. Usar el `estado` del equipo iterado (la variable del `.map`, p. ej. `eq`):

```tsx
            <Badge status={eq.estado === 'DISPONIBLE' ? 'Disponible' : eq.estado} />
```

(El componente `Badge` ya deriva el color: `DISPONIBLE`→ok, `RENTADO`→info, `MANTENIMIENTO`→warn, `INACTIVO`→danger.)

- [ ] **Step 3: Confirmar que `confirmar()` no bloquea por estado**

La función `confirmar()` (líneas ~30-40) ya no debe condicionar al estado del equipo: agrega el ítem sin importar disponibilidad. Verificar que no haya guardas tipo `if (selected.estado !== 'DISPONIBLE') return`.

- [ ] **Step 4: Verificar que compila**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Verificación manual**

En el wizard de cotización, abrir "Agregar ítem" → tab Equipo: deben aparecer también equipos `RENTADO`/`MANTENIMIENTO` con su badge, y poder agregar uno `RENTADO` a un borrador.

- [ ] **Step 6: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add components/cotizaciones/wizard/AgregarItemModal/TabEquipo.tsx
git commit -m "feat(cotizaciones): selector de equipos muestra todos con badge de estado"
```

---

## Tarea 10: Frontend — permitir agregar herramientas aunque excedan lo disponible

**Files:**
- Modify: `frontend/components/cotizaciones/wizard/AgregarItemModal/TabHerramienta.tsx`

- [ ] **Step 1: Relajar la guarda de cantidad**

La función `confirmar()` (líneas ~33-46) hoy bloquea con `if (!selected || cantidadUnidades > max) return`. Cambiar a permitir agregar (el gate real es la aprobación), manteniendo solo la validación de cantidad positiva:

```typescript
  async function confirmar() {
    if (!selected || cantidadUnidades < 1) return;
    await agregar.mutateAsync({
      id: cotizacionId,
      data: {
        tipo: 'HERRAMIENTA',
        herramientaTipoId: selected.id,
        cantidadUnidades,
        cantidadDias,
        periodo,
      },
    });
    onAdded();
  }
```

Mantener el badge `${disp}/${total} disp.` como indicador informativo (no bloquea).

- [ ] **Step 2: Verificar que compila**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit`
Expected: sin errores. Si `max` queda sin uso y tsc se queja, eliminar la línea `const max = ...`.

- [ ] **Step 3: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add components/cotizaciones/wizard/AgregarItemModal/TabHerramienta.tsx
git commit -m "feat(cotizaciones): permitir agregar herramientas sin tope de disponibilidad"
```

---

## Tarea 11: Frontend — aviso de conflicto al aprobar + copy sin "reservas"

**Files:**
- Modify: `frontend/components/cotizaciones/detalle/AccionesEstado.tsx`

- [ ] **Step 1: Capturar el error de conflicto y mostrarlo inline**

Agregar estado para el mensaje de conflicto y poblarlo en el `catch` de `aplicar`. Reemplazar la función `aplicar` (líneas ~28-35) y agregar el estado:

```tsx
  const [conflicto, setConflicto] = useState<string | null>(null);

  async function aplicar(estado: 'ENVIADA' | 'APROBADA' | 'RECHAZADA') {
    setConflicto(null);
    try {
      await cambiar.mutateAsync({ id: cotizacion.id, estado });
      setConfirm(null);
    } catch (err) {
      // El toast lo maneja el hook. Para conflictos de disponibilidad al aprobar
      // mostramos además un detalle inline accionable (qué ítems faltan).
      const e = err as { response?: { data?: { error?: { code?: string; message?: string } } } };
      if (e?.response?.data?.error?.code === 'CONFLICTO_DISPONIBILIDAD') {
        setConflicto(e.response.data.error.message ?? 'Inventario no disponible para aprobar.');
      }
      // Dejamos el ConfirmRow abierto para reintentar.
    }
  }
```

- [ ] **Step 2: Renderizar el aviso inline**

Insertar, justo antes del bloque `{confirm && (` (línea ~111), un panel de alerta cuando haya conflicto:

```tsx
      {conflicto && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-50 rounded-lg border border-danger-soft bg-danger-soft p-3 shadow-xl">
          <div className="flex items-start gap-2">
            <span className="text-danger mt-0.5 shrink-0"><Icon name="x" size={16} /></span>
            <div className="text-sm text-tx">
              <p className="font-medium">No se pudo aprobar</p>
              <p className="text-xs mt-0.5 text-tx-2">{conflicto}</p>
            </div>
            <button type="button" className="ml-auto text-tx-3 hover:text-tx" onClick={() => setConflicto(null)}>
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>
      )}
```

- [ ] **Step 3: Actualizar el copy que menciona "reservas"**

Reemplazar los textos de los `ConfirmRow` que aún hablan de reservas:
- Línea ~115: `message={`Eliminar el borrador ${cotizacion.numeroCotizacion}?`}` (quitar "Las reservas de equipos se liberan.").
- Línea ~132: `message="Aprobar la cotización? Se rentean los equipos disponibles."` (quitar mención a reservas/factura automática — la factura ya no se genera al aprobar).
- Línea ~141: `message="Rechazar la cotización? No se podrá reabrir."` (quitar "Las reservas se liberan").

- [ ] **Step 4: Verificar que compila**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Verificación manual (flujo completo del grupo)**

1. Equipo X en dos cotizaciones BORRADOR → enviar ambas.
2. Aprobar la primera → OK, equipo queda RENTADO.
3. Aprobar la segunda → aparece el aviso inline "No se pudo aprobar: Equipo X no disponible (RENTADO)".
4. Registrar acta de entrega + recepción de la primera → equipo vuelve a DISPONIBLE.
5. Aprobar la segunda → OK.

- [ ] **Step 6: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add components/cotizaciones/detalle/AccionesEstado.tsx
git commit -m "feat(cotizaciones): aviso inline de conflicto de disponibilidad al aprobar"
```

---

## Tarea 12: Frontend — reemplazar el placeholder de reservas en el detalle de equipo

**Files:**
- Modify: `frontend/app/(dashboard)/equipos/[id]/page.tsx` (línea ~182)
- Delete: `frontend/components/equipos/EquipoReservaPlaceholder.tsx`

- [ ] **Step 1: Quitar el render del placeholder**

En `equipos/[id]/page.tsx` eliminar la línea (~182):

```tsx
{equipo.estado === 'DISPONIBLE' && <EquipoReservaPlaceholder />}
```

y su import correspondiente al inicio del archivo (`import { EquipoReservaPlaceholder } ...`).

(El estado de disponibilidad ya se comunica con el badge de `equipo.estado` que el detalle muestra en su encabezado; el historial de rentas — Tarea 5 — cubre la trazabilidad. No se requiere un panel nuevo.)

- [ ] **Step 2: Borrar el componente placeholder**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git rm components/equipos/EquipoReservaPlaceholder.tsx
```

- [ ] **Step 3: Verificar que compila**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit`
Expected: sin errores. Confirmar que no quede ningún import del componente:

```bash
grep -rn "EquipoReservaPlaceholder" app components
```

Expected: sin resultados.

- [ ] **Step 4: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add -A
git commit -m "chore(equipos): eliminar placeholder de reservas del detalle de equipo"
```

---

## Tarea 13: Verificación final del Grupo A

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Type-check de ambos repos**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx tsc --noEmit
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit
```

Expected: ambos sin errores.

- [ ] **Step 2: Grep de residuos de reservas**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && grep -rn "Reserva\|RESERVADA\|reservasService\|RESERVA_TTL" src/ prisma/schema.prisma
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && grep -rn "RESERVADA\|EquipoReservaPlaceholder\|equipo:reservado" app components hooks lib types
```

Expected: sin resultados relevantes (el `equipo:reservado` ya no se emite ni se escucha).

- [ ] **Step 3: Flujo manual end-to-end**

Repetir el flujo de la Tarea 11 Step 5 con un equipo, y además uno con una **pieza de andamio** de stock limitado: aprobar dos cotizaciones que juntas excedan el stock debe bloquear la segunda con el detalle de cantidades. Verificar también que agregar el mismo equipo a 3 cotizaciones con tarifas distintas (item 1: 15 días, 1 semana, 1 mes) funciona sin bloqueos hasta la aprobación.

- [ ] **Step 4: (Opcional) Levantar el backend para confirmar que arranca sin el cron**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm dev
```

Expected: arranca sin errores ni referencias a `limpiarReservasExpiradas`.

---

## Cobertura del spec (self-review)

- **Item 1 y 2** (sin apartado, multi-cotización, primero aprobado gana): Tareas 1-4 (quitar reservas), Tarea 2 (gate de aprobación derivado), Tarea 9-10 (selector permite agregar cualquiera).
- **Item 3** (bug equipos): Tarea 3 (quitar `crearReserva` de `agregarItem`).
- **Liberación en recepción**: sin cambios — el flujo existente de recepción ya devuelve equipos/unidades a `DISPONIBLE` y restaura stock; la disponibilidad derivada lo respeta (Tarea 1, `comprometidoNoDespachado` + estado físico).
- **Bloqueo con aviso de conflicto**: Tarea 2 (`409 CONFLICTO_DISPONIBILIDAD`) + Tarea 11 (aviso inline).
- **Limpieza de infra de reservas**: Tareas 6 y 7 (módulo, job, env, schema), Tarea 8 y 12 (tipos y UI frontend).
