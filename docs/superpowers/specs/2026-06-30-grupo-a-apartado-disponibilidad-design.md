# Grupo A — Apartado, disponibilidad de inventario y bug de equipos

**Fecha:** 2026-06-30
**Branch:** `feat/feedback-reinar` (frontend y backend)
**Items del feedback de Reinar cubiertos:** 1, 2, 3

> Este spec es el **Grupo A** de un lote de feedback más grande (4 grupos: A apartado/disponibilidad, B IVA/depósito/total, C facturas, D renovaciones). Cada grupo se diseña, aprueba e implementa de forma secuencial sobre la misma branch. Aquí solo se trata el Grupo A.

---

## Problema

El backend tiene hoy un sistema de **apartado/reserva preventivo** (`ReservaEquipo`, `ReservaHerramientaUnidad`) que bloquea inventario apenas se agrega a una cotización en BORRADOR. Reinar reportó tres problemas relacionados:

1. **No debe haber apartado.** Un cliente puede pedir cotizaciones del mismo inventario con distintas tarifas (ej. un generador cotizado por 15 días, 1 semana y 1 mes). El apartado preventivo lo impide.
2. **El mismo item (incluso con 1 sola unidad) debe poder estar en varias cotizaciones simultáneas.** La **primera cotización en ser aprobada** aparta el inventario; las demás no deben poder aprobarse mientras ese inventario siga comprometido.
3. **Bug: los equipos no se pueden ingresar a cotizaciones.** Causa raíz confirmada: `agregarItem` (`server/src/modules/cotizaciones/cotizaciones.service.ts:370`) llama a `reservasService.crearReserva`, que lanza `409 EQUIPO_RESERVADO` (`server/src/modules/reservas/reservas.service.ts:20-21`) si el equipo ya tiene una reserva `ACTIVA` en otra cotización, o `409 EQUIPO_YA_AGREGADO` si quedó una reserva colgada. Quitar el apartado al agregar resuelve el bug.

## Decisiones tomadas (brainstorming)

- **Alcance:** el modelo aplica a inventario rentable que se devuelve — **equipos, unidades de herramienta, piezas y cuerpos de andamio**. **No** aplica a consumibles (se consumen, manejados por stock que se descuenta) ni servicios (no son inventario).
  - Nota: los cuerpos de andamio se expanden en items `PIEZA_ANDAMIO` (BOM), así que en la práctica el inventario rentable de una cotización es `EQUIPO`, `HERRAMIENTA` (unidades) y `PIEZA_ANDAMIO` (stock).
- **Sin reserva al agregar.** Agregar un item a una cotización no compromete nada. La disponibilidad se valida **solo al aprobar**.
- **El apartado ocurre al aprobar.** La primera cotización aprobada compromete el inventario.
- **Liberación:** el inventario comprometido vuelve a estar disponible **solo al registrarse el acta de recepción** (devolución física). Si la renta se renueva sin devolución (Grupo D), sigue comprometido.
- **Competencia entre cotizaciones:** al aprobar una, las demás **no se cancelan automáticamente**. Quedan vivas; al intentar aprobarlas, si el inventario ya no está disponible, **se bloquea la aprobación con un aviso de conflicto** y el usuario decide (quitar, sustituir o cancelar).
- **Mecanismo técnico:** **disponibilidad derivada** (Enfoque A). No se almacena ningún registro de reserva; la disponibilidad se calcula consultando las cotizaciones APROBADAS sin acta de recepción que las cierre. Una sola fuente de verdad, sin estado denormalizado que se desincronice.

---

## Diseño — Backend (`/Users/joaquinmorales13a06/Desktop/Reinar/server`)

### 1. Eliminar el apartado preventivo
- Quitar de `agregarItem` (`cotizaciones.service.ts`) las llamadas a `crearReserva` (equipo) y `crearReservaHerramienta` (herramienta). Agregar un item ya **no reserva nada**. → **Arregla el item 3.**
- Retirar:
  - Modelos `ReservaEquipo` y `ReservaHerramientaUnidad` (`prisma/schema.prisma`).
  - Estado `RESERVADA` de `HerramientaUnidad` (enum `EstadoHerramienta`).
  - Job `src/jobs/limpiarReservasExpiradas.ts` y su registro en el scheduler.
  - Endpoints de liberar reserva (`reservas.routes.ts`) y el módulo `reservas` salvo lo que se reutilice.
  - Variable de entorno `RESERVA_TTL_MINUTOS` (`config/env`).
  - Eventos socket `equipo:reservado` y emisiones de reserva.
- **Migración Prisma:** dropear las tablas de reservas; normalizar `HerramientaUnidad` en estado `RESERVADA` → `DISPONIBLE`.

### 2. Servicio de disponibilidad derivada (`disponibilidad.service.ts`)
Función(es) central(es) que calculan disponibilidad derivándola de cotizaciones **APROBADAS** cuyo inventario aún no fue cerrado por un acta de recepción:

- **Equipos / unidades de herramienta** (unidad única):
  - `COMPROMETIDO` si pertenece a una cotización APROBADA cuya entrega aún no fue recibida (sin acta de recepción que lo cierre).
  - Si no, `DISPONIBLE` — salvo que `Equipo.estado`/`HerramientaUnidad.estado` sea `MANTENIMIENTO`, `USO_INTERNO` o `INACTIVO`, que tienen prioridad.
- **Piezas** (stock): `cantidadComprometida` = suma de cantidades en cotizaciones aprobadas no devueltas; `disponible = stockActual − cantidadComprometida`.
- Devuelve contexto para el badge del frontend: cantidad de cotizaciones BORRADOR/ENVIADA en que aparece, y fecha fin de renta estimada si está comprometido ("rentado hasta …").

Criterio de "cerrado por recepción": un item de cotización aprobada deja de contar como comprometido cuando existe el acta de recepción correspondiente que lo marca devuelto (alineado con la lógica actual de `actas.service.ts` que al recibir vuelve el equipo a `DISPONIBLE` y restaura stock).

### 3. Validación al aprobar (commit)
- En `cambiarEstado` de cotización (`BORRADOR`/`ENVIADA` → `APROBADA`): por cada item rentable, consultar `disponibilidad.service`.
- Si algún item no tiene disponibilidad, **bloquear** con `409 CONFLICTO_DISPONIBILIDAD` y un `details[]` accionable que liste exactamente qué falta y por qué:
  - equipo/unidad: "Equipo \<nombre\> comprometido por cotización \<numero\>".
  - pieza: "Pieza \<nombre\>: solicitadas \<n\>, disponibles \<m\>".
- Si pasa la validación, la aprobación se registra; **a partir de ahí** ese inventario cuenta como comprometido (derivado, sin escribir reservas). El equipo se marca `RENTADO` recién en el despacho (acta de entrega), igual que hoy.

### 4. Exponer disponibilidad
- Incluir el estado de disponibilidad derivada en el listado/detalle de equipos y en los endpoints que alimentan el selector de cotización (equipos, herramientas, piezas).
- Recablear el socket `equipo:disponibilidad` para emitir en los dos momentos que cambian la disponibilidad real: **al aprobar** una cotización y **al registrar recepción**. Quitar emisiones atadas a reservar/liberar.

---

## Diseño — Frontend (`/Users/joaquinmorales13a06/Desktop/Reinar/frontend`)

### 1. Selector de items en el wizard de cotización
- `AgregarItemModal` / `TabEquipo`: quitar el filtro `estado: 'DISPONIBLE'`. Mostrar **todos** los equipos con un **badge de disponibilidad** derivado del backend:
  - `Disponible` · `En N cotización(es)` · `Rentado hasta <fecha>` · `Mantenimiento`.
- Permitir agregar **cualquier** item sin bloqueo (incluido uno que ya esté en otras cotizaciones borrador). Mismo criterio en los tabs de herramienta, pieza y cuerpo de andamio.
- Quitar el manejo de errores `EQUIPO_RESERVADO` / `EQUIPO_YA_AGREGADO` (ya no se producen).

### 2. Aprobación con conflicto
- En `useCambiarEstadoCotizacion` (cambio a `APROBADA`): manejar el nuevo `409 CONFLICTO_DISPONIBILIDAD`. Mostrar un **aviso inline accionable** en la pantalla de la cotización con la lista de items en conflicto (qué item y contra qué cotización), no un toast genérico, para que el usuario quite/sustituya y reintente.

### 3. Indicadores de disponibilidad en inventario
- Reemplazar `EquipoReservaPlaceholder` ("Reservas — Próximamente") por el estado de disponibilidad **real** en el detalle del equipo (disponible / comprometido hasta fecha / en N cotizaciones borrador).
- Actualizar `hooks/use-equipos-realtime.ts` para reaccionar al `equipo:disponibilidad` recableado; quitar listeners de `equipo:reservado`.

### 4. Limpieza de tipos y UI muertos
- Quitar de `types/api.ts` el estado `RESERVADA` de herramienta y cualquier tipo relacionado a reservas.
- Quitar referencias UI a reservas/liberar que queden huérfanas.

---

## Verificación
- `pnpm tsc --noEmit` en frontend; type-check/build del backend.
- Flujos manuales:
  1. Agregar el mismo equipo a 2 cotizaciones BORRADOR → **permitido** (valida item 1, 2 y 3).
  2. Aprobar la primera → ok; el equipo queda comprometido.
  3. Intentar aprobar la segunda → **bloqueo** con aviso de conflicto.
  4. Registrar acta de recepción de la primera → el equipo vuelve a estar `DISPONIBLE` y la segunda ya se puede aprobar.
  5. Repetir (1)–(3) con una pieza de andamio (stock) verificando el conteo por cantidad.

## Fuera de alcance (otros grupos)
- IVA / exención / depósito / total de cotización (Grupo B).
- Facturas: fechas QUEDAN, periodo, columnas PDF, observaciones (Grupo C).
- Renovaciones de renta desde acta de entrega (Grupo D).
