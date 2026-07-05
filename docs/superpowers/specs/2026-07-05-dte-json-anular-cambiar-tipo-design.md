# Spec — Quick wins DTE: botón JSON + anular DTE para cambiar tipo

**Fecha:** 2026-07-05
**Origen:** Retroalimentación de ventas de Reinar El Salvador (puntos DTE del feedback general).
**Repos afectados:** `/server` (backend Express + Prisma) y `/frontend` (Next.js). Rama espejo en ambos: `feat/dte-json-anular-cambiar-tipo`.

## Problema

Dos puntos del feedback sobre la card "Documento Tributario Electrónico" del detalle de factura:

1. **Descargar el JSON del DTE desde la card.** Hoy el JSON oficial solo se baja desde el menú de descargas del listado de facturas; falta el botón en la card del detalle.
2. **Anular el DTE para cambiar su tipo.** Caso de uso: el cliente pide cambiar el tipo de documento (ej. FC → CCF) después de que ya se emitió y aprobó un DTE. El MH solo permite anular DTEs de ≤ 3 días.

## Estado actual (verificado en código)

- **Botón JSON:** `components/dte/DteSection.tsx` (bloque APROBADO) tiene "Descargar PDF oficial", "Anular DTE" (ADMIN) y el formulario de envío por correo. **No hay botón JSON.** La función `descargarFacturaJsonDTE(id, numero)` ya existe en `hooks/use-facturas.ts` y el endpoint `GET /facturas/:id/dte/json` ya existe (`facturas.routes.ts`, `obtenerJSONOficialDTE`, requiere DTE APROBADO).
- **"Anular DTE" actual es destructivo:** el botón "Anular DTE" de la card (`DteSection.tsx`, `onAnular`) navega a `app/(dashboard)/facturas/[id]/anular-dte/page.tsx`, que llama `useCambiarEstadoFactura` con `estado: 'ANULADA'` → `PATCH /facturas/:id/estado`. Eso **anula la factura entera** con cascada: factura→ANULADA, cotización→CANCELADA, libera inventario. Es lo opuesto al caso de uso (cambiar tipo sin matar la venta).
- **Endpoint no destructivo disponible pero no cableado:** `DELETE /facturas/:id/dte` → `anularDTE` (facturas.service.ts) invalida solo el DTE en el MH y hoy deja `estadoDTE=ANULADO` (sin tocar la factura). El hook `useAnularDTESoloDTE` existe pero no está conectado a ninguna UI. La llamada al MH (`facturaLlamaService.invalidarDTE`) ocurre **antes** de la transacción, así que un fallo del MH no altera la factura.
- **Re-emisión bloqueada:** `emitirDTE` solo permite emitir si `estadoDTE ∈ {PENDIENTE, RECHAZADO}`. Tras `ANULADO` no se puede re-emitir.
- **Sin fecha de emisión del DTE persistida:** la factura tiene `dteId`, `dteControlNumber`, `dteRespuestaMH` (Json), pero no una columna con la fecha de procesamiento del DTE en el MH. `factura.fechaEmision` es la emisión de la factura, no la del DTE.

## Decisiones (confirmadas con el usuario)

1. **Dos acciones separadas.** Se mantiene el flujo destructivo actual (anular factura entera) y se agrega una acción **nueva y distinta**, "Anular DTE y cambiar tipo" (no destructiva), en la card. Nombres claros para no confundirlas.
2. **Regla de 3 días: sin columna nueva.** No se persiste la fecha del DTE. La acción de anular siempre está disponible; si el MH la rechaza (por antigüedad u otra causa), se muestra el error que devuelve. Sin migración.
3. **Re-emisión = Enfoque 1 (reset a estado pre-emisión).** Anular solo el DTE resetea la factura a nivel DTE para que el operador re-elija tipo y emita con el flujo existente.

## Diseño

### 1. Backend (`/server`, sin migración)

**`anularDTE` (facturas.service.ts):** cambiar la firma a `anularDTE(id, motivo, usuarioId)` y el efecto:
- Precondición sin cambios: `estadoDTE` debe ser APROBADO (422 `ESTADO_INVALIDO` si no).
- `facturaLlamaService.invalidarDTE(dteId, motivo)` **antes** de la transacción (usar el `motivo` del request en vez del literal `'Anulación de DTE'`). Si el MH rechaza, el error se propaga y la factura queda intacta.
- En la transacción, en vez de `{ estadoDTE: 'ANULADO' }`, **resetear a estado pre-emisión**:
  ```ts
  data: {
    estadoDTE:        'PENDIENTE',
    tipoDTE:          null,
    dteId:            null,
    dteControlNumber: null,
    dteRespuestaMH:   Prisma.JsonNull,
  }
  ```
- `auditLog` con `accion: 'ANULAR_DTE'` y `camposDespues` que capture el `dteId`, `dteControlNumber`, `tipoDTE` anulados + el `motivo` (para no perder la trazabilidad del DTE anulado, ya que los campos se limpian).

**Controller (`facturas.controller.ts`):** `anularDTE` lee `req.body.motivo` y lo pasa al service.

**Validación (`facturas.schemas.ts`):** nuevo `anularDTESchema = z.object({ motivo: z.string().min(10, '...') })`. La ruta `DELETE /facturas/:id/dte` (ya solo-ADMIN) agrega `validate(anularDTESchema)`.

**Nota de re-emisión:** no requiere cambios en `emitirDTE` — tras el reset `estadoDTE=PENDIENTE` y `tipoDTE=null`, el flujo de asignar tipo + emitir ya funciona tal cual.

### 2. Frontend (`/frontend`)

**`hooks/use-facturas.ts`:**
- `useAnularDTESoloDTE(id)` pasa a recibir `{ motivo }` y enviarlo en el body del `DELETE`. Invalida `['factura', id]` y `['facturas']` (ya lo hace). Toast de éxito: "DTE anulado. Asigná un nuevo tipo y emití."
- `descargarFacturaJsonDTE` ya existe; sin cambios.

**`components/dte/DteSection.tsx`:**
- Nueva prop `onDescargarJson?: () => void` (+ `isDescargandoJson?`). En el bloque APROBADO, botón "Descargar JSON" junto a "Descargar PDF oficial" (mismo nivel de acceso que el PDF: visible para todos los que ven el detalle). Se renderiza solo si `onDescargarJson` está presente.
- Nueva prop `onAnularSoloDTE?: (motivo: string) => void` (+ `isAnulandoSoloDTE?`). En el bloque APROBADO, solo ADMIN, botón "Anular DTE y cambiar tipo" que abre un `ConfirmRow` inline con un `<textarea>` de motivo (mín. 10 caracteres, valor por defecto "Cambio de tipo de documento tributario a solicitud del cliente"). Confirmar llama `onAnularSoloDTE(motivo)`. Error del MH se muestra inline (nueva prop `anularError?: string | null`).
- **Renombrar** el botón destructivo existente `onAnular` de "Anular DTE" a **"Anular factura"** (sigue navegando a la página destructiva).
- Ambos botones de anular y el nuevo flujo solo aparecen para facturas (la card de NC no recibe `onAnularSoloDTE`/`onDescargarJson`).

**`app/(dashboard)/facturas/[id]/page.tsx`:**
- Cablear `onDescargarJson` → `descargarFacturaJsonDTE(id, factura.numeroFactura)` (con estado local `isDescargandoJson`).
- Cablear `onAnularSoloDTE(motivo)` → `useAnularDTESoloDTE(id).mutateAsync({ motivo })`, capturando el error para `anularError` (inline en la card).
- `onAnular` (destructivo) sin cambios (sigue navegando a `/facturas/:id/anular-dte`).

**`app/(dashboard)/facturas/[id]/anular-dte/page.tsx`:** actualizar el título/copys de "Anular DTE" a **"Anular factura"** para que coincida con el nombre del botón (cambio de texto, sin cambio de comportamiento).

### 3. Edge cases

- **MH rechaza la anulación** (>3 días u otra causa): el error se muestra inline en la card; la factura queda intacta (el reset solo corre tras el éxito del MH, que ocurre antes de la transacción).
- **Roles:** ambas acciones de anular son solo ADMIN (igual que hoy). El botón JSON, como el PDF, es visible para todos los que ven el detalle. VISUALIZADOR no ve acciones de escritura (sin cambios).
- **Disponibilidad:** JSON y "cambiar tipo" solo con `estadoDTE === 'APROBADO'`.
- **Nota de crédito:** `DteSection` se reutiliza para NC; al no pasarle `onDescargarJson`/`onAnularSoloDTE`, no muestra esos botones.
- **Tras anular y NO re-emitir:** la factura queda con `estadoDTE=PENDIENTE` sin tipo — es coherente (a nivel DTE está sin emitir); la card muestra el selector de tipo.

### 4. Verificación

- Backend: `npx tsc --noEmit` + `pnpm test`. Tests de `anularDTE`: resetea los campos correctos (estadoDTE PENDIENTE, tipoDTE/dteId/control/respuesta null), audit log con los datos anulados; fallo del MH deja la factura intacta; 422 si el DTE no está APROBADO.
- Frontend: `pnpm tsc --noEmit` + `pnpm lint`.
- Manual e2e (stack levantado): emitir FC → "Anular DTE y cambiar tipo" (motivo) → la card vuelve al selector → elegir CCF → emitir; descargar el JSON desde la card.

## Fuera de alcance (grupos en cola)

- Flujo Cotización→Factura→Acta + consecutivo de acta en el PDF de factura.
- Factura a nombre de tercero.
- DTE de exportación (FEX) + clientes internacionales.
- Notificaciones in-app (factura creada, DTE validado por el MH).
- Persistir la fecha de emisión del DTE y bloquear la anulación >3 días de forma proactiva (se decidió no hacerlo ahora; se surface el error del MH).
