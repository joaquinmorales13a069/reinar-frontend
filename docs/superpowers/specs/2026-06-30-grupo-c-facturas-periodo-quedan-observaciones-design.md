# Grupo C — Facturas: periodo, fecha QUEDAN y observaciones

**Fecha:** 2026-06-30
**Branch:** `feat/feedback-reinar` (frontend y backend)
**Items del feedback de Reinar cubiertos:** 6, 7, 9, 11, 12

> Tercer grupo del lote de feedback (A apartado/disponibilidad ✅, B IVA/depósito/total ✅, **C facturas**, D renovaciones). Se diseña, aprueba e implementa de forma secuencial sobre la misma branch. Aquí solo se trata el Grupo C.

---

## Problemas

6. **La fecha de entrega de la factura QUEDAN debe relacionarse con la fecha de entrega del acta de entrega.** Hoy `Factura.fechaEntregaReal` se setea solo manualmente (POST `/facturas/:id/marcar-entregada`). El acta de entrega tiene su propia `fechaEntrega` (sellada al pasar a `ENTREGADO`) y conoce su factura (`facturaId`, relación 1 factura : N actas), pero no hay vínculo entre ambas fechas.
7. **Quitar la columna "Período" del PDF de factura.** Hoy `factura.hbs` tiene una columna "Período" (29%) que muestra el rango de renta por línea o el fallback "N × periodo".
9. **El periodo de la factura debe ser un rango de fechas seleccionable desde el sistema y visible en el PDF** (a nivel factura, no por línea).
11. **Crear una casilla de observaciones en facturas, visible en el PDF.** El campo `Factura.notas` ya existe, el backend ya lo actualiza (`actualizarFactura`) y el PDF ya lo muestra como sección "Observaciones" (`factura.hbs:539`); falta solo la UI para editarlo.
12. **Eliminar el periodo de renta por línea.** Hoy vive en `CotizacionItem.periodoRentaInicio/Fin`, se edita con `PATCH /facturas/:id/periodos-renta` (servicio `setPeriodosRenta`) + `PeriodosRentaCard`, y alimenta la columna "Período" del PDF vía `mapItems`/`rangoRenta`.

## Decisiones tomadas (brainstorming)

- **Fecha QUEDAN ↔ acta (item 6):** **auto-setear** `Factura.fechaEntregaReal` desde `ActaEntrega.fechaEntrega` cuando un acta de entrega de una factura QUEDAN pasa a `ENTREGADO` (la **primera** acta entregada gana; solo si la factura aún no tiene `fechaEntregaReal`). El flujo manual `marcarFacturaEntregada` se mantiene como **respaldo** para QUEDAN sin acta.
- **Periodo de factura (item 9):** campo de **rango de fechas a nivel factura** (`Factura.periodoInicio`/`periodoFin`), editable en el detalle. Se **pre-llena del acta de entrega** vinculada (su `periodoRentaInicio/Fin`) cuando la factura aún no tiene periodo propio; editable y guardable. Visible en el PDF de factura en la cabecera/meta.
- **Periodo por línea (item 12):** se **elimina** completamente — endpoint, card, DTO, columna del PDF, y las **columnas de BD** `CotizacionItem.periodoRentaInicio/Fin` se **dropean** con migración destructiva. Las columnas de periodo de `ActaEntrega` **NO** se tocan.
- **Observaciones (item 11):** se reutiliza `Factura.notas` (es lo que el PDF ya rotula "Observaciones"); solo se agrega la **UI** de edición.

---

## Diseño — Backend (`/Users/joaquinmorales13a06/Desktop/Reinar/server`)

### 1. Modelo de datos (Prisma, una migración)
- **Aditivo:** `periodoInicio DateTime?` y `periodoFin DateTime?` en `model Factura`.
- **Destructivo:** eliminar `periodoRentaInicio` y `periodoRentaFin` de `model CotizacionItem`.
- Migración generada **offline** (`prisma migrate diff`) y aplicada con `prisma migrate deploy` (decisión de cuándo aplicar = del usuario; la maneja el controlador en ejecución). El SQL tendrá `ADD COLUMN` en Factura y `DROP COLUMN` en CotizacionItem.

### 2. Eliminar el periodo por línea (item 12)
- Quitar el endpoint `PATCH /facturas/:id/periodos-renta` (ruta), el controlador `setPeriodosRenta` y el servicio `setPeriodosRenta` (`facturas.service.ts:432-460`), más el schema Zod `PeriodosRentaInput`/`periodosRentaSchema` asociado.
- En `pdf.service.ts`: quitar el campo `rangoRenta` de `mapItems` (regular y cuerpos de andamio) y la función `formatRangoRenta` si queda sin uso. El PDF de **cotización** ya cae al texto "N × periodo" cuando no hay `rangoRenta`; verificar `cotizacion.hbs` para no romper su tabla (debe seguir mostrando "N × periodo" o lo que mostrara antes).

### 3. Quitar la columna "Período" del PDF de factura (item 7)
- En `templates/factura.hbs` (tabla de ítems, líneas 456-508): eliminar el `<th style="width:29%">Período</th>` y la `<td>` de período en la fila regular y en la fila padre de cuerpos de andamio (la fila hija usaba la columna para "piezas" — ajustarla también). Reajustar los anchos: p. ej. Descripción 65%, Cant. 8%, Subtotal 27% (ajustar a gusto manteniendo suma ~100%). Tabla final: **Descripción | Cant. | Subtotal**.

### 4. Periodo a nivel factura (item 9)
- Extender `actualizarFactura` (`facturas.service.ts:116-128`) y `ActualizarFacturaInput`/Zod para aceptar `periodoInicio`/`periodoFin` (ISO date strings → `new Date(...)`; permitir `null` para limpiar). Mismo guard de factura ANULADA.
- En `pdf.service.ts` `generarFacturaPDF`: pasar al contexto `factura.periodoInicio`/`periodoFin` formateados con `formatFechaCorta` (o `null`).
- En `factura.hbs`: agregar en la cabecera/meta (junto a emisión/vencimiento) una fila condicional **"Período de renta: {{factura.periodoInicio}} — {{factura.periodoFin}}"** cuando exista `periodoInicio`.

### 5. Auto-setear fecha QUEDAN desde el acta (item 6)
- En `_entregar` (`actas.service.ts:699-740`): luego del `tx.actaEntrega.update({ ... fechaEntrega: new Date() ... })`, cargar la factura del acta (`acta.facturaId`); si `factura.esQuedan && factura.fechaEntregaReal == null`, hacer `tx.factura.update({ where: { id: acta.facturaId }, data: { fechaEntregaReal: <la fechaEntrega recién seteada> } })` + audit log. Usar la misma `Date` que se asignó a `fechaEntrega` para que ambas coincidan.
- `marcarFacturaEntregada` (`facturas.service.ts:464-496`) se mantiene sin cambios (respaldo manual).

---

## Diseño — Frontend (`/Users/joaquinmorales13a06/Desktop/Reinar/frontend`)

### 1. Tipos (`types/api.ts`)
- `type Factura`: agregar `periodoInicio: string | null;` y `periodoFin: string | null;`. Quitar nada de Factura salvo lo necesario.
- `type CotizacionItem`: **quitar** `periodoRentaInicio?` y `periodoRentaFin?`.
- `ActualizarFacturaDto`: agregar `periodoInicio?: string | null;` y `periodoFin?: string | null;`.
- Eliminar `type PeriodosRentaDto`.

### 2. Eliminar periodo por línea (item 12)
- Borrar `components/facturas/detalle/PeriodosRentaCard.tsx`.
- Quitar `useActualizarPeriodosRenta` de `hooks/use-facturas.ts`.
- Quitar el render de `PeriodosRentaCard` en `app/(dashboard)/facturas/[id]/page.tsx`.

### 3. Periodo a nivel factura (item 9)
- Nueva `components/facturas/detalle/PeriodoFacturaCard.tsx`: dos inputs `type="date"` (inicio/fin) que guardan `factura.periodoInicio`/`periodoFin` vía `useActualizarFactura`. Validación inline: si uno lleno, el otro requerido; inicio ≤ fin. **Pre-llenado:** si `factura.periodoInicio` es null y existe un acta de entrega vinculada con `periodoRentaInicio/Fin`, usar ese rango como valor inicial del input (editable). Solo lectura para VISUALIZADOR / factura anulada.
- Montar `PeriodoFacturaCard` en el detalle (donde estaba `PeriodosRentaCard`).
- Nota: el acta vinculada y su periodo deben estar disponibles en el detalle. `factura.actasEntrega` existe como `ActaResumen[]`; si no trae el periodo, se obtiene del detalle de actas o se extiende el resumen. Verificar al implementar y, de ser necesario, incluir `periodoRentaInicio/Fin` en el resumen de actas que llega al detalle de factura.

### 4. Observaciones (item 11)
- Nueva `components/facturas/detalle/ObservacionesCard.tsx`: `textarea` para `factura.notas`, guardable vía `useActualizarFactura` (`{ notas }`). Solo lectura para VISUALIZADOR / factura anulada. Montar en el detalle de factura (p. ej. tras `ClienteFechasCard`).

---

## Verificación
- `pnpm tsc --noEmit` (frontend) y `npx tsc --noEmit` (backend).
- Migración generada offline (ADD en Factura, DROP en CotizacionItem), aplicada con `migrate deploy`, columnas verificadas.
- Flujos manuales:
  1. Editar observaciones en el detalle → aparece en el PDF de factura como "Observaciones".
  2. Setear periodo de factura → "Período de renta: X — Y" en el PDF; la tabla de ítems ya **no** tiene columna "Período".
  3. QUEDAN con acta de entrega → al marcar el acta `ENTREGADO`, la factura toma esa fecha como `fechaEntregaReal` automáticamente.
  4. QUEDAN sin acta → el botón manual "Marcar como entregada" sigue funcionando.

## Fuera de alcance (otros grupos)
- Apartado/disponibilidad (Grupo A ✅).
- IVA exento / depósito / total de cotización (Grupo B ✅).
- Renovaciones de renta desde acta de entrega (Grupo D — items 10, 13).
