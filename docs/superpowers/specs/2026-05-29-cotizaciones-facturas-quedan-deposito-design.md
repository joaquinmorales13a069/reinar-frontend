# Cotizaciones, facturación manual, QUEDAN y depósito de garantía

Fecha: 2026-05-29
Autor: Joaquin Morales (con Claude)
Estado: Aprobado para plan de implementación

## Resumen

Conjunto de 8 cambios solicitados sobre el flujo cotización → factura. Tocan frontend (Next.js), backend (Express + Prisma) y plantillas PDF. Se agrupan en cuatro ejes:

- **Cotización**: contacto solicitante inline, cantidad de días por ítem, separar `tipoDocumentoFiscal` y "facturar a" del borrador.
- **PDF cotización**: nuevo layout del bloque inferior (datos bancarios + totales), eliminar porcentaje del depósito.
- **Depósito de garantía**: modelo independiente con ciclo recibir / devolver / retener. Deja de descontar el saldo de la factura.
- **Facturación**: emisión manual con fecha de vencimiento manual, soporte de facturas QUEDAN.

## Items originales (referencia)

1. Contacto solicitante: dropdown con contactos del cliente + botón inline para crear nuevo.
2. El período base siempre es "día"; agregar campo "cantidad de días" por ítem y mostrarlo en el PDF.
3. `tipoDocumentoFiscal` y "facturar a" se piden después de aprobar la cotización, no durante el borrador.
4. PDF de cotización: mover datos bancarios al espacio en blanco junto al desglose de totales.
5. PDF de cotización: quitar el porcentaje del depósito requerido, dejar solo el monto.
6. El depósito es un cargo aparte: no descuenta la factura, se devuelve al cliente al recibir el inventario.
7. La factura no se emite automáticamente al aprobar; se genera con un botón y la fecha de vencimiento se define manualmente.
8. Facturas QUEDAN: para clientes que pagan después del servicio; tienen fecha de entrega programada, fecha real de entrega y vencimiento propios.

## Decisiones tomadas en brainstorming

| # | Decisión | Justificación |
|---|----------|---------------|
| 1 | Un único spec/plan que cubre los 8 items | Cambios entrelazados (3 + 7 dependen del mismo workflow) |
| 2 | Reemplazar `CotizacionItem.cantidad` por `cantidadUnidades` + `cantidadDias` | Desambigua el campo polivalente actual |
| 3 | Aprobar la cotización solo cambia el estado; factura se genera en paso separado | Cumple items 3 y 7 con un solo cambio de workflow |
| 4 | QUEDAN se modela como flag (`esQuedan`) + dos fechas en `Factura` | No es un DTE distinto ante MH, es solo condición comercial |
| 5 | `Cliente.manejaQuedan` pre-selecciona el toggle al generar factura | Refleja la realidad: ciertos clientes siempre trabajan QUEDAN |
| 6 | QUEDAN no se bloquea por estado de actas; solo advertencia | Flexibilidad operativa, el usuario sabe lo que hace |
| 7 | Depósito en modelo independiente `DepositoGarantia` con su ciclo de estados | Permite trackear recibir/devolver/retener |
| 8 | Panel de depósito vive en el detalle de la cotización | Contexto natural; sin nueva entrada en navegación |
| 9 | Notificación automática al rol GERENTE/OPERADOR cuando QUEDAN entra en "por entregar" | Usa la infra de notificaciones existente |
| 10 | Fecha de vencimiento siempre manual con default `hoy + 30` | Consistencia (no acoplada a condicionesPago) |
| 11 | Layout PDF dos columnas: datos bancarios izquierda, totales derecha | Usa el espacio en blanco señalado en el screenshot |

## Cambios en la base de datos (`schema.prisma`)

### `CotizacionItem`

```prisma
// antes
cantidad Int

// después
cantidadUnidades Int @default(1)  // cuántas unidades del bien
cantidadDias     Int @default(1)  // cuántos días de renta
// subtotal = tarifaAplicada × cantidadUnidades × cantidadDias
```

Reglas:
- Para `tipo ∈ {SERVICIO, CONSUMIBLE}`: `cantidadDias` siempre es 1 (validación backend + UI oculta el input).
- Para `tipo = EQUIPO`: `cantidadUnidades` siempre es 1 (regla existente, solo cambia el nombre).
- Para `tipo ∈ {HERRAMIENTA, PIEZA_ANDAMIO}`: ambos campos editables.

### `Cliente`

```prisma
manejaQuedan Boolean @default(false)
```

### `Factura`

```prisma
esQuedan            Boolean   @default(false)
fechaEntregaFactura DateTime? // programada (requerida si esQuedan)
fechaEntregaReal    DateTime? // cuándo se entregó realmente
// fechaVencimiento DateTime ya existe; pasa a ser obligatoria al crear
```

### Nuevo modelo `DepositoGarantia`

```prisma
enum EstadoDeposito {
  PENDIENTE         // cotización aprobada, depósito aún no cobrado
  RECIBIDO          // cliente entregó el depósito
  DEVUELTO          // se devolvió completo al cliente
  RETENIDO_PARCIAL  // se devolvió parcial, se retuvo el resto
  RETENIDO_TOTAL    // se retuvo completo (daño, no devolución, etc.)
}

model DepositoGarantia {
  id             String         @id @default(cuid())
  cotizacionId   String         @unique
  cotizacion     Cotizacion     @relation(fields: [cotizacionId], references: [id])
  monto          Decimal        @db.Decimal(10, 2)
  estado         EstadoDeposito @default(PENDIENTE)
  fechaRecibido  DateTime?
  fechaDevuelto  DateTime?
  montoRetenido  Decimal?       @db.Decimal(10, 2)
  razonRetencion String?
  notas          String?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
}
```

Se crea automáticamente al aprobar la cotización si `Cotizacion.depositoMonto > 0`. Reemplaza la lógica actual de crear `Pago` tipo ANTICIPO en `cotizaciones.service.ts:804-819`.

### Nuevo `TipoNotificacion`

```prisma
QUEDAN_POR_ENTREGAR
```

## Migración de datos existentes

1. **CotizacionItem**: backfill en SQL:
   - `cantidadUnidades = 1`, `cantidadDias = cantidad` para items con `periodo ∈ {DIA, SEMANA, QUINCENA, MES, CUSTOM}`.
   - `cantidadUnidades = cantidad`, `cantidadDias = 1` para items con `tipo ∈ {SERVICIO, CONSUMIBLE}`.
   - Luego eliminar columna `cantidad`.
2. **Script de verificación post-migración**: recalcular `subtotal` y `total` de cada cotización con la fórmula nueva y compararlos contra los valores almacenados; debe haber tolerancia 0.
3. **Cotizaciones APROBADAS con `depositoMonto > 0`**:
   - Crear `DepositoGarantia` con `estado = RECIBIDO` y `fechaRecibido = fechaAprobacion` (asumimos histórico cobrado).
   - Eliminar el `Pago` tipo ANTICIPO asociado a la factura de esa cotización.
   - Recalcular `Factura.montoPagado` y `saldoPendiente` excluyendo ese pago.
4. **Facturas existentes**: `esQuedan = false`, `fechaEntregaFactura = null`, `fechaEntregaReal = null`.
5. **Clientes existentes**: `manejaQuedan = false`.

## Backend

### Cotizaciones

**`POST /cotizaciones/:id/items` y `PATCH /cotizaciones/:id/items/:itemId`**
- Schemas Zod aceptan `cantidadUnidades` (default 1) y `cantidadDias` (default 1).
- Validación condicional por `tipo`.
- `_recalcularTotales` y el cálculo de subtotal por ítem usan `tarifaAplicada × cantidadUnidades × cantidadDias`.

**`POST /cotizaciones/:id/aprobar`** — cambios clave:
- Ya no crea `Factura` ni `Pago` tipo ANTICIPO.
- Cambia estado a APROBADA, confirma reservas, registra auditoría, emite evento socket.
- Si `depositoMonto > 0`, crea `DepositoGarantia` con `estado = PENDIENTE`.
- Quita la validación previa que exigía `tipoDocumentoFiscal` y `contactoFacturacionId`.

**`PATCH /cotizaciones/:id`**
- En `BORRADOR`: `tipoDocumentoFiscal` y `contactoFacturacionId` siguen siendo escribibles pero opcionales (sin warning).

### Depósitos de garantía (nuevo módulo `server/src/modules/depositos/`)

```
GET    /cotizaciones/:id/deposito                  → leer depósito
POST   /cotizaciones/:id/deposito/recibir          → PENDIENTE → RECIBIDO, fechaRecibido=ahora
POST   /cotizaciones/:id/deposito/devolver
       body: { tipo: 'TOTAL' | 'PARCIAL' | 'RETENER_TOTAL',
               montoRetenido?, razonRetencion? }
       → DEVUELTO | RETENIDO_PARCIAL | RETENIDO_TOTAL, fechaDevuelto=ahora
```

Reglas:
- Solo ADMIN y GERENTE pueden devolver / retener.
- Si `tipo = PARCIAL`: `montoRetenido > 0` y `< monto`; `razonRetencion` requerida.
- Estados terminales (`DEVUELTO`, `RETENIDO_*`) son idempotentes: rechazar mutaciones posteriores.

### Facturas

**`POST /cotizaciones/:id/factura`** — generar factura (reemplaza creación automática):

```ts
body: {
  tipoDTE: 'FC' | 'CCF' | 'SUJETO_EXCLUIDO',
  contactoFacturacionId: string,
  fechaVencimiento: DateTime,
  esQuedan: boolean,
  fechaEntregaFactura?: DateTime,  // requerida si esQuedan
}
```

Validaciones:
- Cotización debe estar APROBADA y sin factura previa.
- Si `esQuedan = true`: `fechaEntregaFactura` requerida.
- Si `esQuedan = true` y la cotización tiene actas no DEVUELTAS: devolver `warning` no bloqueante en la respuesta para que el frontend lo muestre.
- `subtotal`, `montoIva` y `total` se copian de la cotización.
- `montoPagado = 0`, `saldoPendiente = total` (sin descontar depósito).

**`POST /facturas/:id/marcar-entregada`**:

```ts
body: { fechaEntregaReal: DateTime }  // default: ahora
```

- Solo aplica si `esQuedan = true`.
- Solo cuando `fechaEntregaReal` es null.

**`GET /facturas`** — nuevos filtros:
- `esQuedan?: boolean`.
- `entregaPendiente?: boolean` → filtra `esQuedan=true AND fechaEntregaFactura<=hoy AND fechaEntregaReal IS NULL`.

### Notificaciones QUEDAN

Cron diario `00:00` (siguiendo el patrón del proyecto):
- Buscar facturas con `esQuedan = true AND fechaEntregaFactura <= hoy AND fechaEntregaReal IS NULL`.
- Crear notificación tipo `QUEDAN_POR_ENTREGAR` (idempotente por `tipo + entidadId`) dirigida a roles GERENTE y OPERADOR.
- Mensaje: *"Factura QUEDAN [NUM] está pendiente de entrega"*.

### Auditoría

Todas las nuevas mutaciones (`aprobar` sin emisión, `generar factura`, `recibir`, `devolver`, `marcar entregada`) registran entrada en `auditlog` con `entidad`, `accion`, `camposAntes` / `camposDespues`.

## Frontend

### Wizard de cotización

**Step1Cliente — contacto solicitante (item 1)**:
- Dropdown (combobox) con contactos del cliente seleccionado.
- Botón `[+]` a la derecha abre modal `ContactoFormMin` (nombre, cargo, teléfono, email, tipo).
- Al guardar: cierra modal, invalida `['contactos', { clienteId }]`, auto-selecciona el contacto nuevo.
- Dropdown deshabilitado si no hay cliente seleccionado.

**Step2Items — días por ítem (item 2)**:
- Columna **Unidades** (`<NumberInput min=1>`). Disabled en 1 para EQUIPO.
- Columna **Días** (`<NumberInput min=1>`). Oculta/disabled para SERVICIO y CONSUMIBLE.
- Las tabs del modal de agregar (`TabEquipo`, `TabHerramienta`, `TabAndamio`) usan `cantidadUnidades` y `cantidadDias` (default 1).
- Preview de subtotal con `tarifa × unidades × días`.

**Step3Términos**:
- Quitar `tipoDocumentoFiscal` y `contactoFacturacion`.
- Mantener: `condicionesPago`, `fechaVencimiento`, `depositoMonto`, `notas`, `notasInternas`.
- `depositoPorcentaje` sigue en BD para histórico pero la UI solo expone "Depósito requerido ($)".

**Step4Resumen**:
- Cada línea muestra `unidades × días` y subtotal con la fórmula nueva.

### Detalle de cotización (`/cotizaciones/[id]`)

**Encabezado**:
- En estado APROBADA y sin factura previa: botón primario **"Generar factura"**.
- VISUALIZADOR no ve el botón.

**Modal `GenerarFacturaModal`**:
- Tipo documento fiscal: `<Select>` (CF / CCF / SUJETO_EXCLUIDO).
- Facturar a: combobox de contactos del cliente + botón `[+]` (mismo patrón del wizard).
- Fecha de vencimiento: `<DatePicker>` con default `hoy + 30 días`.
- Toggle **"Es factura QUEDAN"**: default = `cliente.manejaQuedan`.
- Si toggle activo: aparece `<DatePicker>` "Fecha programada de entrega" (requerido).
- Si toggle activo y actas no DEVUELTAS: banner amarillo no bloqueante.
- Submit → `POST /cotizaciones/:id/factura` → toast → redirect a `/facturas/:id`.

**Panel "Depósito de garantía"** (visible si `depositoMonto > 0` y estado APROBADA):
- Card con monto + badge de estado.
- Acciones según estado:
  - PENDIENTE → "Marcar como recibido".
  - RECIBIDO → "Devolver completo" / "Devolver parcial" / "Retener completo".
  - DEVUELTO / RETENIDO_* → solo lectura con fechas y razón.
- "Devolver parcial" usa fila inline para pedir `montoRetenido` y `razonRetencion`.
- Toast en cada mutación; invalida `['cotizaciones', id]` y `['depositos', cotizacionId]`.
- Hook nuevo `hooks/use-deposito.ts`.

### Listado y detalle de facturas

**`/facturas` — tabla**:
- Columna **Tipo**: badge `QUEDAN` o `tipoDTE`.
- Columna **Entrega** (visible cuando filtro QUEDAN está activo): muestra `fechaEntregaFactura` o "Entregada el X" si `fechaEntregaReal`; badge "Por entregar" cuando aplica.
- `FacturasFilters`: chip "Solo QUEDAN" + chip "Pendientes de entrega" (este último solo activable junto al primero).

**`/facturas/[id]` — detalle**:
- Si `esQuedan`:
  - Card "Entrega de factura QUEDAN" con fechas.
  - Si `fechaEntregaReal` es null: botón "Marcar como entregada" → `<DatePicker>` (default hoy) → `POST /facturas/:id/marcar-entregada`.
  - VISUALIZADOR no ve el botón.
- Bloque de totales: `montoPagado` ya no incluye el depósito.

### Form de cliente

Sección "Facturación": toggle **"Maneja factura QUEDAN"** con tooltip explicativo.

### Notificaciones

`<BellMenu>` ya consume `use-notificaciones`. Agregar manejo del tipo `QUEDAN_POR_ENTREGAR` con icono y link al detalle de la factura.

### Hooks de React Query

Nuevos / modificados:
- `use-deposito.ts`: `useDeposito(cotizacionId)`, `useRecibirDeposito`, `useDevolverDeposito`.
- `use-facturas.ts`: `useGenerarFactura(cotizacionId)`, `useMarcarFacturaEntregada(facturaId)`; filtros `esQuedan` y `entregaPendiente` en `useFacturas`.
- `use-clientes.ts`: el form agrega `manejaQuedan`.

## PDF

### Cotización (`cotizacion.hbs` + `pdf.service.ts`)

**Tabla de ítems**:
- Header "PERÍODO" → **"DÍAS"**.
- `unidades` viene de `cantidadUnidades`. Celda DÍAS muestra `cantidadDias` (ej: `6`).
- SERVICIO y CONSUMIBLE: celda DÍAS = `—`.

**Bloque inferior (items 4 y 5)**:

```
┌───────────────────────────────────┬─────────────────────┐
│ DATOS PARA TRANSFERENCIA          │  Subtotal  $151.80  │
│                                   │  IVA (13%)  $19.73  │
│ Banco:    [Banco X]               │  ─────────────────  │
│ Titular:  Reinar S.A. de C.V.     │  TOTAL    $171.53   │
│ Cuenta:   [número]                │  ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│ Tipo:     [Corriente/Ahorro]      │  Depósito requerido │
│                                   │              $300.00│
└───────────────────────────────────┴─────────────────────┘
```

- Datos bancarios vienen de `Configuracion`. Si no existen los campos, agregar `datosBancarios: Json` con `banco`, `titular`, `numeroCuenta`, `tipoCuenta`.
- Se elimina el porcentaje del depósito; solo se muestra el monto.
- Si `depositoMonto` es null, no se renderiza esa fila.

### Factura (`factura.hbs`)

- Si `esQuedan = true`: badge "QUEDAN" en el encabezado junto al número.
- Sección "Fecha de entrega programada" debajo de "Fecha de emisión" cuando `esQuedan`.
- Bloque de totales: no descuenta depósito.

## Testing manual

No hay suite automatizada. Verificar en `pnpm dev`:

**Cotización**:
1. Crear cotización con contacto solicitante existente.
2. Crear cotización y agregar contacto solicitante inline.
3. Ítem EQUIPO: unidades disabled en 1, días editable, subtotal correcto.
4. Ítem SERVICIO: días oculto/disabled, subtotal correcto.
5. Aprobar cotización con depósito → `DepositoGarantia` en PENDIENTE; no se crea factura.
6. PDF de cotización: datos bancarios a la izquierda, totales a la derecha, sin % de depósito.

**Depósito**:
7. Recibir → estado RECIBIDO.
8. Devolver completo / parcial / retener completo → estados correctos.
9. Estados terminales no permiten más mutaciones.

**Factura**:
10. Generar factura desde APROBADA: tipo doc + facturar a + venc. Toast + redirect.
11. Factura no-QUEDAN: `saldoPendiente = total` (sin restar depósito).
12. Cliente con `manejaQuedan = true`: modal pre-marca el toggle.
13. Generar factura QUEDAN con actas no devueltas: banner pero permite continuar.
14. Marcar QUEDAN como entregada: `fechaEntregaReal` se setea.
15. Filtros "Solo QUEDAN" y "Pendientes de entrega" funcionan.

**Migración**:
16. Script: recalcular `total` por cotización con la fórmula nueva y comparar con el almacenado; tolerancia 0.
17. Facturas históricas con pago tipo ANTICIPO: el script eliminó esos pagos y restauró `saldoPendiente`.

**Roles**:
18. VISUALIZADOR no ve "Generar factura", "Marcar entregada" ni acciones de depósito.

## Entregables sugeridos

Un PR principal con cuatro commits lógicos:

1. **Migración Prisma + script de backfill** (`prisma/migrations/X_quedan_deposito_dias/`).
2. **Backend**: módulo `depositos`, cambios en `cotizaciones` y `facturas`, cron de notificaciones QUEDAN.
3. **Frontend**: wizard, modal "Generar factura", panel de depósito, listado/detalle de facturas, toggle `manejaQuedan` en cliente.
4. **PDF**: templates `cotizacion.hbs` y `factura.hbs`.

Si el diff crece demasiado, dividir en dos PRs: (1) migración + backend y (2) frontend + PDF.

## Checklist final (del CLAUDE.md)

- [ ] `pnpm tsc --noEmit` sin errores.
- [ ] Botones de escritura ocultos para VISUALIZADOR.
- [ ] Toasts en todas las mutaciones.
- [ ] PDF correctamente formateado en print.
- [ ] Sin valores arbitrarios Tailwind.
- [ ] Mensajes 100% en español.
- [ ] Comentarios tipo "why" en español en decisiones no obvias.
