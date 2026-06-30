# Grupo D — Renovaciones de renta desde acta de entrega

**Fecha:** 2026-06-30
**Branch:** `feat/feedback-reinar` (frontend y backend)
**Items del feedback de Reinar cubiertos:** 10, 13

> Cuarto y último grupo del lote de feedback (A apartado/disponibilidad ✅, B IVA/depósito/total ✅, C facturas ✅, **D renovaciones**). Se diseña, aprueba e implementa sobre la misma branch. Es una **feature nueva** (no existe nada de renovación hoy).

---

## Problemas

10. **Hay inventario que puede renovar su renta sin haber sido devuelto a REINAR** (sin acta de recepción). Se busca **automatizar** el proceso, en vez de crear una cotización desde cero para el mismo inventario.
13. **Desde un acta de entrega se pueden generar renovaciones de renta** (cotización + factura), **siempre vinculadas al acta de entrega inicial**, ya que no hubo otra entrega del mismo equipo.

## Estado actual (de la exploración)

- No existe ningún concepto de renovación; ninguna relación padre-hijo entre cotizaciones/actas.
- La cadena es `Cotizacion → Factura (1:1) → ActaEntrega (1:N) → ActaEntregaItem`. Cada `ActaEntregaItem` guarda `cotizacionItemId` y un `estado` (`PENDIENTE_DEVOLUCION`/`DEVUELTO`). Los `PENDIENTE_DEVOLUCION` son los que siguen en obra.
- El **gate de aprobación** (Grupo A, `cotizaciones.service.ts` `cambiarEstado → APROBADA`) rechaza equipos cuyo `estado !== 'DISPONIBLE'` y valida disponibilidad **derivada** de piezas/herramientas. Una renovación del mismo equipo (ya `RENTADO`) chocaría con este gate, y las piezas/herramientas se contarían dos veces.

## Decisiones tomadas (brainstorming)

- **Disparador:** botón "Renovar renta" en el detalle del acta (estados `ENTREGADO`/`DEVUELTA_PARCIAL`, solo `puedeEscribir`).
- **Flujo:** crear una cotización **BORRADOR pre-cargada** (clona los items elegidos del acta, mismo cliente/proyecto, vinculada al acta) y llevar al usuario al **wizard** para ajustar período/tarifas/depósito, enviar, aprobar y generar factura. **Con un paso de selección** de cuáles items renovar.
- **Selección:** el modal lista solo **inventario rentable no devuelto** (equipos, unidades de herramienta, piezas) en `PENDIENTE_DEVOLUCION`. Consumibles y servicios se excluyen (no se "renueva renta" de algo consumido/de un servicio puntual).
- **Depósito:** la renovación arranca **sin depósito**; es **opcional, editable** en el Paso Términos del wizard.
- **Vínculo:** la renovación se vincula al **acta de entrega original** vía un campo nuevo en `Cotizacion`.
- **Sin acta nueva:** la renovación NO crea `ActaEntrega`. El inventario físico se sigue rastreando por el acta original; la recepción eventual sobre ella cierra la renta. La factura de la renovación es normal (no QUEDAN).

---

## Diseño — Backend (`/Users/joaquinmorales13a06/Desktop/Reinar/server`)

### 1. Modelo de datos (Prisma, migración aditiva)
- En `model Cotizacion`: agregar `actaEntregaOrigenId String?` + relación `actaEntregaOrigen ActaEntrega? @relation("renovaciones", fields: [actaEntregaOrigenId], references: [id])`.
- En `model ActaEntrega`: agregar la relación inversa `renovaciones Cotizacion[] @relation("renovaciones")`.
- Migración generada **offline** (`prisma migrate diff`), aplicada con `migrate deploy` (la maneja el controlador). Aditiva: una columna nullable + FK.

### 2. Endpoint de renovación + clonado (`actas` module)
- `POST /actas/:id/renovar` con body `{ cotizacionItemIds: string[] }` (Zod). Servicio `renovarRenta(actaId, cotizacionItemIds, usuarioId)`:
  - Carga el acta con `factura.cotizacion` (cliente, proyecto) y sus `items` (`PENDIENTE_DEVOLUCION`).
  - Valida: acta en `ENTREGADO`/`DEVUELTA_PARCIAL`; cada `cotizacionItemId` pertenece a un `ActaEntregaItem` de esta acta en `PENDIENTE_DEVOLUCION` y es de tipo rentable (`EQUIPO`/`HERRAMIENTA`/`PIEZA_ANDAMIO`).
  - Crea una `Cotizacion` BORRADOR: `clienteId`/`proyectoId` desde la cotización original del acta; `actaEntregaOrigenId = acta.id`; sin depósito; `porcentajeIva`/`exentoIva` heredados de la cotización original.
  - **Clona** cada item seleccionado leyendo el `CotizacionItem` original (tipo, equipoId/herramientaTipoId/piezaTipoId, cantidadUnidades, cantidadDias, periodo, periodoCustomLabel, tarifaAplicada/tarifaCustom/esTarifaCustom) y recalcula subtotales (misma lógica que `agregarItem`/`_recalcularTotales`).
  - Devuelve la cotización nueva (`obtenerCotizacion`).
- Montar la ruta en el router de `/actas` (controlador `renovar`).

### 3. Gate de aprobación: exceptuar renovaciones (`cotizaciones.service.ts` `cambiarEstado → APROBADA`)
- Al inicio del bloque `APROBADA`, cargar `cotizacion.actaEntregaOrigenId` y, si está, el set de inventario no devuelto del acta original (equipoIds, herramientaTipoIds, piezaTipoIds en `PENDIENTE_DEVOLUCION`).
- En las verificaciones de disponibilidad (equipos/herramientas/piezas), **saltear** los items cuyo recurso esté en ese set (son inventario ya comprometido que se renueva, no una nueva toma). Items que NO estén en el set pasan por el gate normal.
- En el marcado de equipos a `RENTADO`: para items renovados (en el set), **no** re-marcar (ya está `RENTADO`); para items nuevos fuera del set, comportamiento normal.

### 4. Disponibilidad derivada: evitar doble conteo (`disponibilidad.service.ts`)
- En `comprometidoNoDespachado`, agregar al `where` del `cotizacionItem.aggregate` la condición `cotizacion: { ..., actaEntregaOrigenId: null }` para **excluir** los items de cotizaciones de renovación. Así las piezas/herramientas en obra (ya contadas por la renta original, que está despachada y por ende fuera de `comprometidoNoDespachado`) no se cuentan de nuevo por la renovación (que no se despacha).

### 5. Traza en `obtenerActa` y `obtenerCotizacion`
- `actas.service.obtenerActa`: incluir `renovaciones` (cotizaciones con `actaEntregaOrigenId = acta.id`: `id`, `numeroCotizacion`, `estado`, `factura: { id, numeroFactura }`).
- `cotizaciones.service.obtenerCotizacion`: incluir `actaEntregaOrigen` (`id`, `numeroActa`) cuando exista.

---

## Diseño — Frontend (`/Users/joaquinmorales13a06/Desktop/Reinar/frontend`)

### 1. Tipos (`types/api.ts`)
- `Cotizacion`: agregar `actaEntregaOrigenId: string | null` y `actaEntregaOrigen?: { id: string; numeroActa: string } | null`.
- `Acta`: agregar `renovaciones?: { id: string; numeroCotizacion: string; estado: EstadoCotizacion; factura: { id: string; numeroFactura: string } | null }[]`.

### 2. Disparador + modal de selección
- En `components/actas/ActaPanelAccionContextual.tsx`, bloque `ENTREGADO`/`DEVUELTA_PARCIAL` (solo `puedeEscribir`): botón **"Renovar renta"** que abre un modal.
- Nuevo `components/actas/RenovarRentaModal.tsx`: lista los items del acta rentables y `PENDIENTE_DEVOLUCION` (equipo/herramienta/pieza) con checkboxes; valida al menos uno; al confirmar llama `useRenovarRenta` y, en éxito, redirige a `/cotizaciones/<id>/editar` (wizard).

### 3. Hook
- `hooks/use-actas.ts`: `useRenovarRenta()` → `POST /actas/:id/renovar` con `{ cotizacionItemIds }`; `onSuccess` invalida `['cotizaciones']` y `['acta', id]`, devuelve la cotización para redirigir. El resto del flujo usa `useCambiarEstadoCotizacion`/`useGenerarFactura` existentes.

### 4. Trazabilidad en la UI
- **Detalle de acta** (`app/(dashboard)/actas/[id]/page.tsx`): sección **"Renovaciones"** que lista `acta.renovaciones` con link a cada cotización (y su factura si existe).
- **Detalle de cotización** (`app/(dashboard)/cotizaciones/[id]/page.tsx`) y/o su factura: cuando `actaEntregaOrigen` existe, mostrar una línea/badge **"Renovación del acta [numeroActa]"** con link a `/actas/<id>`.

---

## Verificación
- `pnpm tsc --noEmit` (frontend) y `npx tsc --noEmit` (backend).
- Migración aditiva (`actaEntregaOrigenId` + relación) generada offline y aplicada con `migrate deploy`; columna verificada.
- Flujos manuales:
  1. Desde un acta `ENTREGADO`, "Renovar renta" → seleccionar equipos/piezas → se crea una cotización BORRADOR vinculada (mismo cliente/proyecto, items clonados) y redirige al wizard.
  2. Ajustar período/tarifas (Paso Ítems/Términos), opcional depósito → enviar → **aprobar sin `CONFLICTO_DISPONIBILIDAD`** (gate exceptuado) → generar factura → fijar período de la factura (card de Grupo C).
  3. La disponibilidad derivada de piezas/herramientas **no** se descuenta dos veces por la renovación.
  4. Trazabilidad: el acta muestra sus renovaciones; la cotización/factura de renovación enlaza al acta original.
  5. La renovación **no** crea un acta de entrega nueva; la recepción posterior sobre el acta original sigue funcionando.

## Fuera de alcance (otros grupos)
- Apartado/disponibilidad (Grupo A ✅), IVA/depósito/total (Grupo B ✅), facturas periodo/QUEDAN/observaciones (Grupo C ✅).
- Renovar una renovación (cadena de N renovaciones): el modelo lo soporta (cada renovación vincula a un acta), pero el flujo de "renovar desde una renovación" requiere que la renovación tenga su propia acta — fuera de alcance por ahora (la renovación no crea acta). Si se necesita en el futuro, se evalúa por separado.
