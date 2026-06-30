# Grupo B — IVA exento, depósito y total de cotización

**Fecha:** 2026-06-30
**Branch:** `feat/feedback-reinar` (frontend y backend)
**Items del feedback de Reinar cubiertos:** 4, 5, 8

> Segundo grupo del lote de feedback (los 4 grupos: A apartado/disponibilidad ✅, **B IVA/depósito/total**, C facturas, D renovaciones). Se diseña, aprueba e implementa de forma secuencial sobre la misma branch. Aquí solo se trata el Grupo B.

---

## Problemas

4. **Hay cotizaciones exentas de IVA** (mayoritariamente proyectos o clientes gubernamentales). Hoy no existe ninguna noción de exención: `porcentajeIva` vive en la cotización (default 13) y el DTE marca **todos** los ítems como `saleType: 'GRAVADA'` (`server/src/modules/facturallama/facturallama.service.ts` `buildItems`). Poner `porcentajeIva = 0` ceroa el IVA en los totales pero seguiría reportando "gravada al 0%" al Ministerio de Hacienda, que es incorrecto para una venta exenta.
5. **El Total del PDF de cotización debe ser Subtotal + IVA + Depósito requerido** (cuando exista depósito). Hoy `cotizacion.total = subtotal + montoIva` (sin depósito) y el PDF muestra el depósito como línea **separada después** del TOTAL (`templates/cotizacion.hbs`).
8. **Los DTE y Facturas NO deben incluir el depósito** como monto extra. El depósito es un cargo aparte (reembolsable o no). Solo el total del PDF de **cotización** cambia cuando hay depósito. — Estado actual: **ya correcto** (la factura copia `total` sin depósito, su saldo y PDF no incluyen depósito, el DTE se arma solo de ítems). Solo requiere confirmación/guarda, no cambios funcionales.

## Decisiones tomadas (brainstorming)

- **Disparador de exención (item 4):** **toggle manual por cotización** ("Exento de IVA" en el Paso 3 del wizard), apagado por defecto. No se agrega flag a Cliente/Proyecto.
- **Categoría fiscal del DTE (item 4):** una cotización exenta reporta sus ítems como **`EXENTA`** en el DTE (FacturaLlama ya soporta ese `saleType`). *(El usuario lo confirmará con su contador antes de emitir en producción.)*
- **Representación de la exención:** campo **`exentoIva Boolean`** explícito en `Cotizacion` y `Factura` — **no** se reutiliza `porcentajeIva = 0` (no permitiría distinguir "exenta" de "gravada al 0%" para el DTE).
- **Total con depósito (item 5):** se ve en **PDF y en pantalla**, con **dos líneas rotuladas explícitamente**: "TOTAL (sin depósito)" y "TOTAL CON DEPÓSITO". Es **display-only**: se calcula `total + depositoMonto`; el `total` guardado NO cambia (así la factura lo hereda sin depósito).

---

## Diseño — Backend (`/Users/joaquinmorales13a06/Desktop/Reinar/server`)

### 1. Modelo de datos (Prisma)
- Agregar `exentoIva Boolean @default(false)` a `model Cotizacion` y a `model Factura`.
- Migración **aditiva** (dos columnas con default `false`). Se aplica con `prisma migrate deploy` contra la BD remota compartida (decisión de cuándo aplicar = del usuario, igual que en Grupo A; riesgo bajo por ser aditiva).

### 2. Cálculo de totales con exención (`cotizaciones.service.ts`)
- En `_recalcularTotales`: si la cotización tiene `exentoIva === true` → `montoIva = 0` y `total = subtotal` (se ignora `porcentajeIva`). Si `false` → comportamiento actual (`subtotal × porcentajeIva / 100`).
- `_recalcularTotales` debe leer `exentoIva` además de `porcentajeIva`/`depositoPorcentaje`.
- En crear/editar cotización: aceptar y persistir `exentoIva` (default `false`). El recálculo de depósito (`total × depositoPorcentaje`) sigue igual, operando sobre el `total` ya sin IVA cuando es exenta.

### 3. Generación de factura (`facturas.service.ts`)
- Al crear la factura desde la cotización, copiar `exentoIva` junto con `subtotal`/`montoIva`/`total` (que ya vienen correctos de la cotización). El depósito sigue **sin** copiarse (item 8, ya correcto).

### 4. DTE / FacturaLlama (`facturallama.service.ts`)
- `buildItems` debe recibir el flag de exención de la factura y setear, por ítem, `saleType: factura.exentoIva ? 'EXENTA' : 'GRAVADA'`. El resto del payload no cambia; FacturaLlama recalcula los totales (venta exenta, IVA 0) a partir del `saleType`.
- Verificar el punto donde se invoca `buildItems` (emisión del DTE) para pasarle el `exentoIva` de la factura.

### 5. PDFs (`pdf.service.ts` + plantillas)
- **`cotizacion.hbs` + datos en `pdf.service`:** pasar `exentoIva`, `porcentajeIva`, `total` (sin depósito), `deposito`, y `totalConDeposito` (= `total + depositoMonto`, solo si hay depósito). La plantilla:
  - línea de IVA: muestra "Exento de IVA" + `$0.00` cuando `exentoIva`, si no "IVA ({{porcentajeIva}}%)".
  - mantiene "TOTAL (sin depósito)".
  - cuando hay depósito: muestra "Depósito requerido" y agrega "TOTAL CON DEPÓSITO".
- **`factura.hbs` + datos:** en la sección de totales, agregar rama: si `factura.exentoIva` → rótulo "Exento de IVA" y monto `$0.00` (en lugar de "IVA (13%)"/"IVA incluido en el precio"). **Sin** línea de depósito (item 8, sin cambios; dejar comentario "why" de que es intencional).

---

## Diseño — Frontend (`/Users/joaquinmorales13a06/Desktop/Reinar/frontend`)

### 1. Tipos (`types/api.ts`)
- Agregar `exentoIva: boolean` a `Cotizacion` y a `Factura`. Agregar `exentoIva` al DTO de crear/editar cotización.

### 2. Wizard — Paso 3 (`Step3Terminos.tsx` + `lib/schemas/cotizacion.ts`)
- Agregar `exentoIva` (boolean, default `false`) al `step3Schema`.
- Toggle "Exento de IVA" (apagado por defecto). Cuando está encendido: ocultar/deshabilitar el input de `porcentajeIva` y rotular "Exento de IVA". Enviar `exentoIva` en el submit.
- El preview de total en vivo: cuando exento, IVA = 0 (total = subtotal); además mostrar la línea "Total con depósito" cuando haya depósito.

### 3. Componentes de totales (display)
- `Step4Resumen.tsx` y `ItemsTabla.tsx` (detalle): en el `tfoot` de totales:
  - línea IVA: "Exento de IVA" cuando `cotizacion.exentoIva`, si no "IVA ({{porcentajeIva}}%)".
  - rótulo del total existente → "Total (sin depósito)".
  - cuando `depositoMonto` existe: agregar línea "Total con depósito" = `new Decimal(total).add(depositoMonto)` (mostrar con `formatCurrency`).
- Todo derivado del backend; el front solo suma `total + depositoMonto` para la línea display.

### 4. Factura (display, opcional pero consistente)
- Donde la UI de factura muestra el IVA (p. ej. `ItemsFacturadosCard`), reflejar "Exento de IVA" cuando `factura.exentoIva`. (El total de factura ya no incluye depósito — sin cambios.)

---

## Verificación
- `pnpm tsc --noEmit` (frontend) y `npx tsc --noEmit` (backend).
- Flujos manuales:
  1. Cotización normal con depósito → pantalla y PDF muestran "IVA (13%)", "Total (sin depósito)" y "Total con depósito"; la factura generada **no** muestra depósito.
  2. Cotización exenta → IVA "$0.00 / Exento de IVA", total = subtotal; su factura hereda `exentoIva`; el DTE emite ítems `EXENTA`.
  3. Cotización exenta + depósito → total (sin depósito) = subtotal; total con depósito = subtotal + depósito.
  4. Factura de cualquier caso → PDF y saldo sin depósito (item 8).

## Fuera de alcance (otros grupos)
- Apartado/disponibilidad de inventario (Grupo A ✅).
- Facturas: fechas QUEDAN, periodo, columnas PDF, observaciones (Grupo C).
- Renovaciones de renta desde acta de entrega (Grupo D).
