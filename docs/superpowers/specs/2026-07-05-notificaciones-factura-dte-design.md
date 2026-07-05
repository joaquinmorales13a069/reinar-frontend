# Spec — Notificaciones in-app: factura creada + DTE validado/rechazado

**Fecha:** 2026-07-05
**Origen:** Retroalimentación general del sistema (Reinar El Salvador): "Revisar módulo de notificaciones, se debe alertar cuando una nueva factura es creada. Igualmente, cuando un DTE es emitido y validado por el MH de El Salvador."
**Repos afectados:** `/server` (backend Express + Prisma) y `/frontend` (Next.js). Rama espejo en ambos: `feat/notificaciones-factura-dte`.

## Problema

No hay notificaciones in-app cuando:
1. Se **crea una factura**.
2. Un **DTE es aprobado** (validado) por el Ministerio de Hacienda (MH). Hoy la aprobación solo dispara un correo, no una notificación en el panel.

Se agrega además el **DTE rechazado** por el MH (evento más urgente: requiere corregir y re-emitir), decidido en brainstorming.

## Estado actual (verificado en código)

- **Tabla `Notificacion`** (`prisma/schema.prisma`): `id`, `usuarioId`, `tipo String` (texto libre, no enum), `titulo`, `mensaje`, `leida Boolean`, `enlace String?`, `createdAt`. Una fila por usuario destinatario.
- **Servicio** (`notificaciones.service.ts`): `crearNotificacion(usuarioId, tipo, titulo, mensaje, enlace?)` hace un `prisma.notificacion.create`. Listar/marcar leída/eliminar por usuario.
- **Sitios que crean notificaciones hoy:** cotizaciones (aprobada/rechazada, al creador), y 2 crons (`marcarFacturasVencidas` → ADMIN/GERENTE; `notificarQuedanPorEntregar` → ADMIN/GERENTE/OPERADOR). El patrón de fanout por rol (`prisma.usuario.findMany({ where: { rol: { in: [...] }, activo: true } })` + `Promise.allSettled` de `crearNotificacion`) está duplicado en ambos crons.
- **DTE aprobado:** el cron `sincronizarEstadosDTEs.ts` (líneas 41-43) detecta `estado === 'APROBADO'` y llama `enviarDteAprobado(factura.id)` (correo). Su `select` de facturas es mínimo: `{ id: true, dteId: true }`. También procesa notas de crédito en un loop aparte.
- **Factura NO persiste su creador** — solo `Cotizacion` tiene `creadoPorId`/`creadoPor` (Usuario, requerido). El "dueño de la venta" se deriva de `factura.cotizacion.creadoPorId`.
- **Creación de factura:** `generarFacturaDesdeCotizacion` (`facturas.service.ts`) — corre en una `prisma.$transaction` y recibe el `usuarioId` del creador.
- **UI:** dropdown de notificaciones en `components/layout/Topbar.tsx` con **polling cada 10s** (hook `useNotificaciones`, no Socket.IO). `ICONO_POR_TIPO` ya mapea varios tipos, incluidos `DTE_APROBADO: 'check'` y `FACTURA_EMITIDA: 'fileText'`; falta `FACTURA_CREADA` y `DTE_RECHAZADO`. La lista navega vía `n.enlace` con fallback de ícono `'fileText'`.

## Decisiones (confirmadas con el usuario)

1. **Destinatarios:** factura creada → **ADMIN + GERENTE** (excluyendo al creador). DTE aprobado/rechazado → **creador de la cotización + ADMIN/GERENTE** (deduplicado).
2. **Entrega:** mantener el **polling de 10s** (sin Socket.IO). Las nuevas notificaciones aparecen en ≤10s; el evento de DTE llega por cron periódico, así que el realtime no aportaría inmediatez.
3. **Alcance:** notificar en DTE **APROBADO y RECHAZADO**.
4. **Sin migración** — se reutiliza `Notificacion` y `crearNotificacion`; el creador se deriva de la cotización.
5. Notas de crédito quedan **fuera de alcance** (el loop de NC del cron no cambia).

## Diseño

### 1. Backend — helpers genéricos de fanout (`notificaciones.service.ts`)

```typescript
import { RolUsuario } from '@prisma/client'

// IDs de usuarios activos con alguno de los roles dados.
export async function idsUsuariosPorRol(roles: RolUsuario[]): Promise<string[]> {
  const usuarios = await prisma.usuario.findMany({
    where: { rol: { in: roles }, activo: true },
    select: { id: true },
  })
  return usuarios.map((u) => u.id)
}

// Crea una notificación por usuario (deduplicando IDs). Fire-and-forget-safe:
// usa allSettled para que un fallo aislado no aborte el resto.
export async function notificarUsuarios(
  usuarioIds: string[],
  tipo: string,
  titulo: string,
  mensaje: string,
  enlace?: string,
): Promise<void> {
  const unicos = [...new Set(usuarioIds)].filter(Boolean)
  await Promise.allSettled(
    unicos.map((usuarioId) => crearNotificacion(usuarioId, tipo, titulo, mensaje, enlace)),
  )
}
```

### 2. Backend — notificaciones de dominio (`facturas.service.ts`, exportadas y testeables)

```typescript
// Notifica a ADMIN/GERENTE (excluyendo al creador, que ya sabe que la creó).
export async function notificarFacturaCreada(
  facturaId: string,
  numeroFactura: string,
  creadorId: string,
): Promise<void> {
  const admins = await idsUsuariosPorRol(['ADMIN', 'GERENTE'])
  const destinatarios = admins.filter((id) => id !== creadorId)
  await notificarUsuarios(
    destinatarios,
    'FACTURA_CREADA',
    'Nueva factura',
    `Se creó la factura ${numeroFactura}.`,
    `/facturas/${facturaId}`,
  )
}

// Notifica al dueño de la venta (creador de la cotización) + ADMIN/GERENTE.
export async function notificarDteResuelto(
  facturaId: string,
  numeroFactura: string,
  estado: 'APROBADO' | 'RECHAZADO',
  creadorCotizacionId: string,
): Promise<void> {
  const admins = await idsUsuariosPorRol(['ADMIN', 'GERENTE'])
  const { tipo, titulo, mensaje } =
    estado === 'APROBADO'
      ? { tipo: 'DTE_APROBADO', titulo: 'DTE aprobado', mensaje: `El DTE de la factura ${numeroFactura} fue aprobado por el MH.` }
      : { tipo: 'DTE_RECHAZADO', titulo: 'DTE rechazado', mensaje: `El MH rechazó el DTE de la factura ${numeroFactura}. Revisá y re-emití.` }
  await notificarUsuarios([creadorCotizacionId, ...admins], tipo, titulo, mensaje, `/facturas/${facturaId}`)
}
```

### 3. Backend — disparadores

- **`generarFacturaDesdeCotizacion` (`facturas.service.ts`):** hoy hace `return prisma.$transaction(async (tx) => { … return { factura, warning } })`. Cambiar a capturar el resultado, disparar la notificación **fuera** de la transacción (para no acoplarla al commit) fire-and-forget, y devolverlo:
  ```typescript
  const resultado = await prisma.$transaction(async (tx) => { … return { factura, warning } })
  // Fire-and-forget: la notificación no bloquea la respuesta ni propaga errores al usuario.
  void notificarFacturaCreada(resultado.factura.id, resultado.factura.numeroFactura, usuarioId)
  return resultado
  ```

- **`sincronizarEstadosDTEs.ts` (cron):** ampliar el `select` de facturas a `{ id: true, dteId: true, numeroFactura: true, cotizacion: { select: { creadoPorId: true } } }`. Cuando `resultado.estado` sea `APROBADO` o `RECHAZADO`, tras el `update`, disparar:
  ```typescript
  if (resultado.estado === 'APROBADO' || resultado.estado === 'RECHAZADO') {
    await notificarDteResuelto(factura.id, factura.numeroFactura, resultado.estado, factura.cotizacion.creadoPorId)
  }
  if (resultado.estado === 'APROBADO') {
    await enviarDteAprobado(factura.id) // correo existente, sin cambios
  }
  ```
  Envuelto en el try/catch existente del loop (un fallo de notificación no corta el cron). El loop de notas de crédito **no** cambia.

### 4. Frontend (`components/layout/Topbar.tsx`)

Agregar al `ICONO_POR_TIPO` los tipos nuevos:
```typescript
  FACTURA_CREADA: 'receipt',
  DTE_RECHAZADO:  'x',
```
(`DTE_APROBADO` ya está mapeado.) No hay más cambios: el polling y el dropdown ya renderizan cualquier notificación y navegan por `enlace`. Verificar que los íconos `receipt` y `x` existen en `components/ui/Icon.tsx` (si `receipt` no existe, usar `fileText`).

### 5. Edge cases

- **Notificaciones fire-and-forget:** un fallo al notificar no rompe la creación de factura (el `void` no propaga) ni el cron (try/catch del loop + `allSettled` en `notificarUsuarios`).
- **Creador que también es ADMIN/GERENTE:** en factura creada se excluye explícitamente; en DTE resuelto la deduplicación de `notificarUsuarios` evita la doble notificación.
- **Sin ADMIN/GERENTE activos:** `destinatarios` queda vacío → `notificarUsuarios` no crea nada (no falla).
- **DTE que pasa a ANULADO por el cron:** no aplica (el cron solo mueve PROCESANDO→APROBADO/RECHAZADO; ANULADO se setea en el flujo de anulación, fuera de este cron).

### 6. Verificación

- Backend: `npx tsc --noEmit` + `pnpm test`. Tests:
  - `notificarUsuarios` deduplica IDs y crea una notificación por usuario único.
  - `notificarFacturaCreada` excluye al creador y notifica a ADMIN/GERENTE.
  - `notificarDteResuelto` incluye creador + ADMIN/GERENTE (deduplicado), con tipo/título/mensaje correctos por estado (APROBADO vs RECHAZADO).
  - El cron `sincronizarEstadosDTEs` invoca `notificarDteResuelto` en APROBADO y RECHAZADO (extender `tests/jobs/sincronizarEstadosDTEs.test.ts`).
- Frontend: `pnpm tsc --noEmit` + `pnpm lint`.
- Manual e2e (stack levantado): crear una factura → ADMIN/GERENTE ven "Nueva factura" en la campana en ≤10s; emitir un DTE y esperar el cron → creador + ADMIN/GERENTE ven "DTE aprobado"/"DTE rechazado"; click navega al detalle de la factura.

## Fuera de alcance (grupos en cola)

- Realtime por Socket.IO para el panel de notificaciones.
- Notificaciones de DTE para notas de crédito.
- Persistir un creador propio en `Factura` (se deriva de la cotización).
- Los demás puntos del feedback: flujo Cotización→Factura→Acta, consecutivo de acta en el PDF, facturas a tercero, DTE de exportación (FEX).
