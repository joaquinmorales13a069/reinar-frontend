# Observaciones (`comments`) con período de renta en DTE FC/CCF

**Fecha:** 2026-07-18
**Origen:** feedback de REINAR — incluir el período de renta en las observaciones del DTE. El equipo de FacturaLlama confirmó (WhatsApp, Hugo Valencia) que los endpoints de emisión aceptan un campo `comments` de hasta 3000 caracteres para las observaciones, aunque no aparece en la documentación pública (https://docs.facturallama.com/api/dte/create-ccf).

## Contexto

- El límite de 3000 caracteres coincide con `extension.observaciones` del esquema oficial del MH para FC/CCF — `comments` va a **nivel raíz del payload** (junto a `id`, `paymentType`, `recipient`, `items`) y FacturaLlama lo mapea a ese campo del DTE.
- `Factura` ya tiene `periodoRentaInicio`/`periodoRentaFin` (Prisma). El frontend ya los captura en `PeriodoFacturaCard` (detalle de factura): pre-carga desde la primera acta de entrega vinculada o edición manual, y guarda vía `PATCH /facturas/:id`.
- Hoy ningún payload de emisión envía observaciones; el período solo viaja embebido en la `description` de cada ítem (`— N días`).

## Alcance

- **Incluye:** FC y CCF (emisión y reintento tras RECHAZADO).
- **Excluye:** NC y FSE — sin cambios.

## Decisiones

1. **Contenido de `comments`:** período de renta + notas de la factura (si existen), en ese orden.
2. **El período de renta es requisito para emitir:** si la factura no tiene `periodoRentaInicio` y `periodoRentaFin`, la emisión se bloquea (backend 422 + UX preventiva en frontend). El dato se ingresa antes de emitir: importado del acta de entrega si esta se generó primero, o manual.
3. **Formato del comentario** (fechas `dd/mm/yyyy`, notas en línea aparte, truncado a 3000):

   ```
   Período de renta: del 01/07/2026 al 15/07/2026
   <notas de la factura, si existen>
   ```

## Diseño

### Backend — `server/src/modules/facturallama`

- `facturallama.types.ts`: agregar `comments?: string` a `PayloadFC` y `PayloadCCF` (nivel raíz), con comentario "why": campo no documentado públicamente, confirmado por el equipo de FacturaLlama, mapea a `extension.observaciones` del MH (máx. 3000).
- `facturallama.service.ts`: nuevo helper `buildComments()` que recibe `periodoRentaInicio: Date`, `periodoRentaFin: Date` y `notas: string | null` y devuelve el texto con el formato de la decisión 3, con `slice(0, 3000)` como red de seguridad.
- `emitirFC` y `emitirCCF`: incluir `comments: buildComments(...)` en el payload. Defensa en profundidad (mismo patrón que el chequeo de `estadoDTE`): si la factura llega sin período, lanzar `AppError(422, 'PERIODO_RENTA_REQUERIDO', …)` con el mismo código que la validación de `emitirDTE`.

### Backend — `server/src/modules/facturas/facturas.service.ts`

En `emitirDTE`, antes de delegar a `emitirFC`/`emitirCCF` y junto a la validación existente de NCR para CCF:

```
si !factura.periodoRentaInicio || !factura.periodoRentaFin
→ AppError(422, 'PERIODO_RENTA_REQUERIDO',
  'La factura debe tener el período de renta registrado antes de emitir el DTE')
```

Aplica igual al reintento tras RECHAZADO (mismo camino de código).

### Frontend — `DteSection` en el detalle de factura

- Calcular `faltaPeriodo = !factura.periodoRentaInicio || !factura.periodoRentaFin`.
- Con `faltaPeriodo`: deshabilitar los botones de asignar tipo / emitir / reemitir y mostrar el hint *"Registrá el período de renta antes de emitir el DTE"*. El usuario completa el período en el `PeriodoFacturaCard` de la misma página.
- Si el backend devolviera el 422 igualmente, se muestra en el error inline que `DteSection` ya maneja. Sin toasts nuevos.

## Manejo de errores

- Falta de período: 422 `PERIODO_RENTA_REQUERIDO` en backend; en frontend el caso normal es que el botón esté deshabilitado con hint, y el error inline existente cubre el caso residual.
- Rechazo del campo `comments` por FacturaLlama (riesgo por campo no documentado): se detectaría como 400/422 en la emisión de prueba — ver Verificación.

## Verificación

- `pnpm tsc --noEmit` en frontend y backend.
- Verificación empírica del campo no documentado: emitir un DTE de prueba y confirmar en el PDF/JSON oficial descargado que las observaciones aparecen con el período. Si FacturaLlama rechazara el campo, se detecta ahí sin tocar producción.
