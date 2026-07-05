# Spec — Condición de pago en factura + QUEDAN con plazo desde entrega (Grupo B)

**Fecha:** 2026-07-05
**Origen:** Retroalimentación del área de ventas de Reinar El Salvador.
**Repos afectados:** `/server` (backend Express + Prisma) y `/frontend` (Next.js). Rama espejo en ambos: `feat/facturas-condicion-pago-quedan`.

## Problema

1. La condición de pago (contado/crédito) hoy se captura en la cotización (`Cotizacion.condicionesPago`, paso Términos del wizard) y el DTE la lee de ahí. Ventas indica que esta decisión pertenece a la **factura**, no a la cotización.
2. No hay reglas de vencimiento: contado debería vencer 24 h después de emitirse; crédito requiere fecha explícita.
3. En facturas QUEDAN, el plazo de pago corre desde el día en que la factura se **entrega físicamente** al cliente, no desde la emisión. Hoy la fecha de vencimiento se fija al crear la factura y no se recalcula al entregar.
4. Los clientes QUEDAN reciben facturas solo ciertos días de la semana; el sistema no lo registra.

## Estado actual (verificado en código)

- `Factura` (schema.prisma:576-622): tiene `fechaEmision`, `fechaVencimiento` (obligatoria), `esQuedan`, `fechaEntregaFactura` (programada), `fechaEntregaReal`. **No** tiene condición de pago ni plazo.
- `Cotizacion.condicionesPago` (schema.prisma:514, enum `CondicionesPago = CONTADO|CREDITO|OTRO`): el payload DTE usa `paymentType: factura.cotizacion.condicionesPago` (facturallama.service.ts:275, 339, 407, 525).
- `Cliente.manejaQuedan` existe (schema.prisma:317); **no** existen días de recepción.
- Generación de factura: `POST /cotizaciones/:id/factura` → `generarFacturaDesdeCotizacion` (facturas.service.ts:369-442); exige cotización APROBADA; input actual: `fechaVencimiento` (obligatoria), `esQuedan`, `fechaEntregaFactura` (si QUEDAN), `contactoFacturacionId`, notas.
- `POST /facturas/:id/marcar-entregada` guarda `fechaEntregaReal` sin tocar el vencimiento.
- Cron `marcarFacturasVencidas.ts` mueve PENDIENTE/PARCIAL con `fechaVencimiento < now` a VENCIDA.
- Frontend: `GenerarFacturaModal.tsx` (fechaVencimiento default +30 días, toggle QUEDAN pre-marcado por `cliente.manejaQuedan`); `Step3Terminos.tsx:92-102` tiene el select de condiciones de pago; `ClienteForm.tsx` tiene el checkbox "Maneja factura QUEDAN".

## Decisiones (confirmadas con el usuario)

1. **La condición de pago se quita del wizard de cotización** y se captura únicamente al generar la factura. La columna `Cotizacion.condicionesPago` se conserva por historial (deprecada).
2. **Contado:** `fechaVencimiento = fechaEmision + 24 horas`, calculada por el servidor. No admite QUEDAN.
3. **Crédito sin QUEDAN:** fecha de vencimiento manual obligatoria.
4. **Crédito con QUEDAN:** se captura `plazoCredito` (días); el vencimiento nace **null** y se calcula al marcar la entrega física: `fechaVencimiento = fechaEntregaReal + plazoCredito` días. QUEDAN solo está disponible con crédito.
5. **Días de recepción de facturas** (`Cliente.diasRecepcionQuedan`): informativos con advertencia no bloqueante; visibles/editables solo cuando `manejaQuedan = true`.
6. Enfoque de modelado: campo propio en `Factura` (no editar la cotización, no crear modelo `TerminoPago`).

## Diseño

### 1. Modelo de datos (Prisma, `/server`)

```prisma
model Factura {
  // nuevos / modificados
  condicionPago    CondicionesPago?   // null solo en históricas; obligatorio al crear
  plazoCredito     Int?               // días; solo cuando esQuedan
  fechaVencimiento DateTime?          // null = QUEDAN aún no entregada
}

model Cliente {
  diasRecepcionQuedan String[] @default([])  // "LUNES".."DOMINGO"
}
```

- Migración con el flujo de BD remota compartida: `prisma migrate diff` offline + `prisma migrate deploy` (no `migrate dev`).
- La migración incluye backfill: `UPDATE "Factura" f SET "condicionPago" = c."condicionesPago" FROM "Cotizacion" c WHERE f."cotizacionId" = c.id AND c."condicionesPago" IS NOT NULL;` (confirmar nombres reales de tablas/columnas según `@@map` del schema al escribir la migración).
- `OTRO` permanece en el enum por las cotizaciones históricas, pero el Zod de factura solo acepta `CONTADO | CREDITO`.

### 2. Reglas de negocio (`/server`)

**`generarFacturaSchema` (facturas.schemas.ts)** — unión discriminada por `condicionPago`:

| Condición | esQuedan | Input requerido | Vencimiento |
|---|---|---|---|
| CONTADO | prohibido (`false`) | — | Servidor: `fechaEmision + 24h`. Rechaza fecha del cliente. |
| CREDITO | `false` | `fechaVencimiento` (≥ hoy) | La provista |
| CREDITO | `true` | `plazoCredito` (entero 1–365) + `fechaEntregaFactura` | `null` al crear |

**`generarFacturaDesdeCotizacion` (facturas.service.ts):**
- Persiste `condicionPago` y `plazoCredito`.
- Advertencia no bloqueante (mismo patrón del `warning` existente en :428-438): si es QUEDAN, `cliente.diasRecepcionQuedan` no está vacío y el día de semana de `fechaEntregaFactura` no está en la lista → `warning: "El cliente recibe facturas los <días>; la fecha programada cae <día>."`

**`marcarEntregada` (facturas.service.ts):**
- Además de `fechaEntregaReal`, si `esQuedan && plazoCredito && fechaVencimiento == null` → `fechaVencimiento = fechaEntregaReal + plazoCredito` días. Registro en audit log con el vencimiento calculado.

**`PATCH /facturas/:id` (actualizar):**
- `fechaVencimiento` editable solo si `condicionPago = CREDITO` (422 en caso contrario).
- Nuevo campo editable `plazoCredito`, solo en QUEDAN sin `fechaEntregaReal`.

**Cron `marcarFacturasVencidas.ts`:** sin cambios de código — `fechaVencimiento: { lt: now }` excluye null en Prisma. Se verifica explícitamente durante la implementación.

**FacturaLlama (facturallama.service.ts):** los 4 payloads (FC/CCF/FSE/NC) cambian a `paymentType: factura.condicionPago ?? factura.cotizacion.condicionesPago` (fallback para históricas sin backfill posible).

**PDF branded (pdf.service.ts:415 + factura.hbs):** `condicionPago` se lee de la factura. Si QUEDAN sin entregar: vencimiento impreso como `Al entregar (N días de plazo)`.

**Reporte cuentas por cobrar (reportes.service.ts):** tolerar `fechaVencimiento` null — esas facturas se listan como "vence al entregar" y nunca cuentan como vencidas.

**Clientes (clientes.schemas.ts / clientes.service.ts):**
- `diasRecepcionQuedan: z.array(z.enum([...7 días])).max(7)` sin duplicados.
- Regla: solo aceptado si `manejaQuedan = true`; al desactivar `manejaQuedan`, el servicio vacía el array.

### 3. Frontend (`/frontend`)

**`GenerarFacturaModal.tsx`:**
- Bloque "Condición de pago" con radios **Contado / Crédito**, obligatorio y sin valor por defecto (decisión consciente del operador).
- Contado → oculta fecha de vencimiento; nota "Vence 24 horas después de la emisión"; toggle QUEDAN deshabilitado.
- Crédito → toggle QUEDAN (pre-marcado si `cliente.manejaQuedan`):
  - Sin QUEDAN → input fecha de vencimiento obligatorio (se elimina el default +30 días).
  - Con QUEDAN → input "Plazo de crédito (días)" + fecha de entrega programada. Debajo: días de recepción del cliente y advertencia ámbar no bloqueante si la fecha no coincide (cálculo local en el modal; el backend repite la validación en su `warning`).
- Zod + RHF; errores del backend inline con `setError`.

**Detalle de factura:**
- `ClienteFechasCard.tsx`: fila "Condición de pago" (Badge) + vencimiento "Se define al entregar" cuando null.
- `EntregaQuedanCard.tsx`: emisión, entrega programada, entrega real y vencimiento juntos + plazo en días. El toast de "marcar entregada" confirma el vencimiento calculado.

**Listado de facturas:** columna vencimiento tolera null → "Al entregar".

**`ClienteForm.tsx`:** al activar "Maneja factura QUEDAN" aparece selector de días tipo chips (L–D, multi-toggle) → `diasRecepcionQuedan`. El detalle del cliente los muestra en la sección de facturación.

**Wizard cotización:** eliminar el select "Condiciones de pago" de `Step3Terminos.tsx` (quedan IVA/exento y depósito); limpiar referencias en `Step4Resumen.tsx` y el detalle de cotización.

**Tipos y hooks:** `types/api.ts` (`Factura.condicionPago`, `plazoCredito`, `fechaVencimiento: string | null`, `Cliente.diasRecepcionQuedan`), `hooks/use-facturas.ts` (`GenerarFacturaInput` como unión discriminada), `hooks/use-clientes.ts`.

### 4. Edge cases

- **Facturas históricas** sin condición (cotización sin `condicionesPago`): UI y PDF muestran "—".
- **Marcar entregada repetida:** el cálculo de vencimiento solo aplica cuando `fechaVencimiento == null` (primera entrega).
- **VISUALIZADOR:** sin cambios; no ve acciones de escritura.
- **Cliente desactiva `manejaQuedan`:** el array de días se vacía; las facturas QUEDAN existentes no cambian.

### 5. Verificación

- `pnpm tsc --noEmit` + `pnpm lint` en frontend; typecheck del server.
- Prueba manual end-to-end contra backend local de los 3 caminos: contado (vence +24h), crédito (fecha manual), crédito+QUEDAN (nace sin vencimiento → marcar entregada calcula vencimiento correcto).
- Emisión de DTE en sandbox para confirmar `paymentType` desde la factura.
- Confirmar que el cron de vencidas ignora facturas con vencimiento null.
- Advertencia de días de recepción visible al elegir fecha fuera de los días del cliente.

## Fuera de alcance (grupos en cola, specs separados)

- Grupo A: botón JSON del DTE en la card + anular DTE con re-emisión (regla 3 días MH).
- Grupo C: flujo Cotización→Acta→Factura + consecutivo de acta en PDF de factura.
- Grupo D: factura a nombre de tercero.
- Grupo E: DTE Factura de Exportación (FEX) + clientes internacionales.
- Grupo F: notificaciones in-app de factura creada y DTE aprobado por el MH.
- Ya resuelto sin trabajo: reportes de ventas bloqueados para OPERADOR (verificado en `reportes.routes.ts:8-16`); las cotizaciones **sí** envían correo automático al marcarse ENVIADA (`cotizaciones.service.ts:640` → `correos.enviarCotizacion`).
