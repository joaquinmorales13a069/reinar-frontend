# Notificaciones in-app: factura creada + DTE validado/rechazado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear notificaciones in-app cuando se genera una factura (a ADMIN/GERENTE) y cuando el MH aprueba o rechaza su DTE (al creador de la cotización + ADMIN/GERENTE), reutilizando la tabla `Notificacion` y el polling existentes.

**Architecture:** Dos helpers genéricos de fanout en el servicio de notificaciones, dos funciones de dominio testeables en el servicio de facturas, y disparadores fire-and-forget en `generarFacturaDesdeCotizacion` (post-commit) y en el cron `sincronizarEstadosDTEs`. El frontend solo mapea dos íconos nuevos.

**Tech Stack:** Backend Express + Prisma + Zod + vitest en `/Users/joaquinmorales13a06/Desktop/Reinar/server`. Frontend Next.js + Tailwind en `/Users/joaquinmorales13a06/Desktop/Reinar/frontend`.

**Spec:** `docs/superpowers/specs/2026-07-05-notificaciones-factura-dte-design.md`

## Global Constraints

- **Ramas:** `feat/notificaciones-factura-dte` en AMBOS repos. El frontend ya está en esa rama (spec commiteado); el server se crea en Task 1. BE base: `main` (89b8f90).
- **Sin migración de BD.** Se reutiliza `Notificacion` y `crearNotificacion`.
- **Destinatarios:** factura creada → ADMIN + GERENTE activos, **excluyendo al creador**. DTE aprobado/rechazado → **creador de la cotización + ADMIN/GERENTE** (deduplicado).
- **Tipos de notificación** (strings): `FACTURA_CREADA`, `DTE_APROBADO`, `DTE_RECHAZADO`. Enlace siempre `/facturas/${facturaId}`.
- **Fire-and-forget:** un fallo al notificar no rompe la creación de factura ni el cron.
- **UI en español.** Comentarios "why" en español.
- **Backend TDD** con vitest. **Baseline de fallos pre-existentes en main: 14** (reservas/RESERVADA, setPeriodosRenta, pdf rangoRenta) — ajenos. Gate = "mis tests pasan + sin fallos nuevos".
- **Frontend sin suite de tests** — verificación = `pnpm tsc --noEmit` + `pnpm lint`.
- **Verificación backend:** `npx tsc --noEmit` + `pnpm test`.
- **Commits** en español `feat(...)`, terminando con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

## PARTE 1 — BACKEND (`/Users/joaquinmorales13a06/Desktop/Reinar/server`)

### Task 1: Helpers de fanout en el servicio de notificaciones

**Files:**
- Modify: `src/modules/notificaciones/notificaciones.service.ts`
- Test: `tests/modules/notificaciones/notificaciones.service.test.ts` (crear si no existe)

**Interfaces:**
- Produces: `idsUsuariosPorRol(roles: RolUsuario[]): Promise<string[]>` (IDs de usuarios activos con esos roles); `notificarUsuarios(usuarioIds: string[], tipo: string, titulo: string, mensaje: string, enlace?: string): Promise<void>` (deduplica y crea una notificación por usuario). Task 2 los consume.

- [ ] **Step 1: Crear la rama en el server**

```bash
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server checkout main
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server pull
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server checkout -b feat/notificaciones-factura-dte
```

- [ ] **Step 2: Escribir los tests que fallan**

Revisar si existe `tests/modules/notificaciones/notificaciones.service.test.ts`. Si no, crearlo con este contenido (sigue el patrón de mock de prisma de los otros tests del repo):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/lib/prisma', () => ({
  prisma: {
    usuario:      { findMany: vi.fn() },
    notificacion: { create: vi.fn() },
  },
}))

import { prisma } from '../../../src/lib/prisma'
import { idsUsuariosPorRol, notificarUsuarios } from '../../../src/modules/notificaciones/notificaciones.service'

const prismaMock = vi.mocked(prisma)

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.notificacion.create.mockResolvedValue({} as any)
})

describe('idsUsuariosPorRol', () => {
  it('devuelve los IDs de usuarios activos con los roles dados', async () => {
    prismaMock.usuario.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }] as any)

    const ids = await idsUsuariosPorRol(['ADMIN', 'GERENTE'])

    expect(ids).toEqual(['u1', 'u2'])
    expect(prismaMock.usuario.findMany).toHaveBeenCalledWith({
      where: { rol: { in: ['ADMIN', 'GERENTE'] }, activo: true },
      select: { id: true },
    })
  })
})

describe('notificarUsuarios', () => {
  it('crea una notificación por usuario único (deduplica)', async () => {
    await notificarUsuarios(['u1', 'u2', 'u1'], 'TIPO', 'Título', 'Mensaje', '/facturas/f1')

    expect(prismaMock.notificacion.create).toHaveBeenCalledTimes(2)
    expect(prismaMock.notificacion.create).toHaveBeenCalledWith({
      data: { usuarioId: 'u1', tipo: 'TIPO', titulo: 'Título', mensaje: 'Mensaje', enlace: '/facturas/f1' },
    })
  })

  it('no crea nada si la lista queda vacía', async () => {
    await notificarUsuarios([], 'TIPO', 'T', 'M')
    expect(prismaMock.notificacion.create).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Correr y verificar FAIL**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm test tests/modules/notificaciones/notificaciones.service.test.ts
```
Expected: FAIL — `idsUsuariosPorRol`/`notificarUsuarios` no existen aún.

- [ ] **Step 4: Implementar los helpers**

En `src/modules/notificaciones/notificaciones.service.ts`, agregar el import del enum y las dos funciones (después de `crearNotificacion`):

```typescript
import { Prisma, RolUsuario } from '@prisma/client'
```
(el archivo ya importa `Prisma`; agregá `RolUsuario` a ese import existente en la línea 1).

```typescript
// IDs de usuarios activos con alguno de los roles dados. Base para el fanout
// de notificaciones a roles responsables (gerencia, operación).
export async function idsUsuariosPorRol(roles: RolUsuario[]): Promise<string[]> {
  const usuarios = await prisma.usuario.findMany({
    where: { rol: { in: roles }, activo: true },
    select: { id: true },
  })
  return usuarios.map((u) => u.id)
}

// Crea una notificación por usuario, deduplicando IDs. Usa allSettled para que
// un fallo aislado no aborte el resto (las notificaciones son fire-and-forget).
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

- [ ] **Step 5: Correr tests y typecheck**

```bash
pnpm test tests/modules/notificaciones/ && npx tsc --noEmit
```
Expected: los 3 tests nuevos PASAN; tsc limpio.

- [ ] **Step 6: Commit**

```bash
git add src/modules/notificaciones/ tests/modules/notificaciones/
git commit -m "feat(notificaciones): helpers de fanout idsUsuariosPorRol y notificarUsuarios

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Notificaciones de dominio + disparo de factura creada

**Files:**
- Modify: `src/modules/facturas/facturas.service.ts` (agregar 2 funciones + disparar en `generarFacturaDesdeCotizacion`)
- Test: `tests/modules/facturas/facturas.service.test.ts`

**Interfaces:**
- Consumes: `idsUsuariosPorRol`, `notificarUsuarios` (Task 1).
- Produces: `notificarFacturaCreada(facturaId, numeroFactura, creadorId): Promise<void>`; `notificarDteResuelto(facturaId, numeroFactura, estado: 'APROBADO'|'RECHAZADO', creadorCotizacionId): Promise<void>`. Task 3 (cron) consume `notificarDteResuelto`.

- [ ] **Step 1: Escribir los tests que fallan**

En `tests/modules/facturas/facturas.service.test.ts`:

1. Al tope, agregar el mock del servicio de notificaciones (para que las funciones de dominio usen stubs y `generarFacturaDesdeCotizacion` no toque prisma.usuario):

```typescript
vi.mock('../../../src/modules/notificaciones/notificaciones.service', () => ({
  idsUsuariosPorRol: vi.fn().mockResolvedValue(['admin1', 'gerente1']),
  notificarUsuarios: vi.fn().mockResolvedValue(undefined),
}))
```

2. Importar los mocks y las funciones nuevas:

```typescript
import { idsUsuariosPorRol, notificarUsuarios } from '../../../src/modules/notificaciones/notificaciones.service'
import { notificarFacturaCreada, notificarDteResuelto } from '../../../src/modules/facturas/facturas.service'
const notifMock = { idsUsuariosPorRol: vi.mocked(idsUsuariosPorRol), notificarUsuarios: vi.mocked(notificarUsuarios) }
```

3. Agregar los tests:

```typescript
describe('notificarFacturaCreada', () => {
  it('notifica a ADMIN/GERENTE excluyendo al creador', async () => {
    notifMock.idsUsuariosPorRol.mockResolvedValue(['admin1', 'gerente1', 'creador1'])

    await notificarFacturaCreada('fac1', 'FAC-001', 'creador1')

    expect(notifMock.idsUsuariosPorRol).toHaveBeenCalledWith(['ADMIN', 'GERENTE'])
    expect(notifMock.notificarUsuarios).toHaveBeenCalledWith(
      ['admin1', 'gerente1'], // creador1 excluido
      'FACTURA_CREADA', 'Nueva factura', 'Se creó la factura FAC-001.', '/facturas/fac1',
    )
  })
})

describe('notificarDteResuelto', () => {
  it('APROBADO: notifica al creador + ADMIN/GERENTE con tipo DTE_APROBADO', async () => {
    notifMock.idsUsuariosPorRol.mockResolvedValue(['admin1', 'gerente1'])

    await notificarDteResuelto('fac1', 'FAC-001', 'APROBADO', 'creador1')

    expect(notifMock.notificarUsuarios).toHaveBeenCalledWith(
      ['creador1', 'admin1', 'gerente1'],
      'DTE_APROBADO', 'DTE aprobado', 'El DTE de la factura FAC-001 fue aprobado por el MH.', '/facturas/fac1',
    )
  })

  it('RECHAZADO: usa tipo DTE_RECHAZADO y mensaje de re-emisión', async () => {
    notifMock.idsUsuariosPorRol.mockResolvedValue(['admin1'])

    await notificarDteResuelto('fac1', 'FAC-001', 'RECHAZADO', 'creador1')

    expect(notifMock.notificarUsuarios).toHaveBeenCalledWith(
      ['creador1', 'admin1'],
      'DTE_RECHAZADO', 'DTE rechazado', 'El MH rechazó el DTE de la factura FAC-001. Revisá y re-emití.', '/facturas/fac1',
    )
  })
})
```

- [ ] **Step 2: Correr y verificar FAIL**

```bash
pnpm test tests/modules/facturas/facturas.service.test.ts
```
Expected: FAIL — `notificarFacturaCreada`/`notificarDteResuelto` no existen. (Los ~8 fallos de `setPeriodosRenta` son pre-existentes, ignorar.)

- [ ] **Step 3: Implementar las funciones de dominio**

En `src/modules/facturas/facturas.service.ts`, agregar el import (junto a los imports existentes del tope):

```typescript
import { idsUsuariosPorRol, notificarUsuarios } from '../notificaciones/notificaciones.service'
```

Y las dos funciones (por ejemplo, cerca de `generarFacturaDesdeCotizacion`):

```typescript
// Notifica a ADMIN/GERENTE que se creó una factura, excluyendo al creador
// (que ya sabe que la creó). Fire-and-forget.
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

// Notifica al dueño de la venta (creador de la cotización) + ADMIN/GERENTE
// cuando el MH resuelve el DTE. notificarUsuarios deduplica si el creador
// también es admin. Fire-and-forget.
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

- [ ] **Step 4: Disparar en `generarFacturaDesdeCotizacion`**

En `generarFacturaDesdeCotizacion` (facturas.service.ts), hoy la función hace `return prisma.$transaction(async (tx) => { … return { factura, warning } })`. Cambiar a capturar el resultado, notificar fuera de la transacción (fire-and-forget), y devolverlo:

```typescript
  const resultado = await prisma.$transaction(async (tx) => {
    // … cuerpo existente sin cambios …
    return { factura, warning }
  })

  // Fire-and-forget: notificar a gerencia no bloquea la respuesta. El .catch
  // evita una promesa rechazada sin manejar si la notificación falla (BD caída).
  void notificarFacturaCreada(resultado.factura.id, resultado.factura.numeroFactura, usuarioId)
    .catch((e) => console.error('[notificarFacturaCreada]', e))

  return resultado
}
```

(Reemplazá el `return prisma.$transaction(...)` por `const resultado = await prisma.$transaction(...)` + las líneas finales. El cuerpo del callback de la transacción no cambia.)

- [ ] **Step 5: Correr tests y typecheck**

```bash
pnpm test tests/modules/facturas/ && npx tsc --noEmit
```
Expected: los tests nuevos PASAN; los tests existentes de `generarFacturaDesdeCotizacion` siguen pasando (el mock de notificaciones evita tocar prisma.usuario); solo los ~8 `setPeriodosRenta` pre-existentes rojos; tsc limpio.

- [ ] **Step 6: Commit**

```bash
git add src/modules/facturas/ tests/modules/facturas/
git commit -m "feat(facturas): notificar a gerencia al crear factura; helpers de notificación de DTE

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Disparar notificación de DTE en el cron

**Files:**
- Modify: `src/jobs/sincronizarEstadosDTEs.ts`
- Test: `tests/jobs/sincronizarEstadosDTEs.test.ts`

**Interfaces:**
- Consumes: `notificarDteResuelto` (Task 2).

- [ ] **Step 1: Escribir/actualizar los tests que fallan**

En `tests/jobs/sincronizarEstadosDTEs.test.ts`:

1. Agregar el mock del servicio de facturas (solo la función que el cron usa):

```typescript
vi.mock('../../src/modules/facturas/facturas.service', () => ({
  notificarDteResuelto: vi.fn().mockResolvedValue(undefined),
}))
```

2. Importar el mock:

```typescript
import { notificarDteResuelto } from '../../src/modules/facturas/facturas.service'
const notifMock = vi.mocked(notificarDteResuelto)
```

3. En el test existente "actualiza Factura a APROBADO…", cambiar el mock de `factura.findMany` para incluir los campos nuevos y agregar la aserción:

```typescript
    prismaMock.factura.findMany.mockResolvedValue([
      { id: 'fac-001', dteId: 'dte-uuid-001', numeroFactura: 'FAC-001', cotizacion: { creadoPorId: 'creador1' } },
    ] as any)
    // … (resto del test existente) …
    // al final:
    expect(notifMock).toHaveBeenCalledWith('fac-001', 'FAC-001', 'APROBADO', 'creador1')
```

4. Agregar un test nuevo para RECHAZADO:

```typescript
  it('notifica al resolver un DTE como RECHAZADO', async () => {
    prismaMock.factura.findMany.mockResolvedValue([
      { id: 'fac-002', dteId: 'dte-uuid-002', numeroFactura: 'FAC-002', cotizacion: { creadoPorId: 'creador2' } },
    ] as any)
    flMock.consultarEstadoDTE.mockResolvedValue({
      dteId: 'dte-uuid-002', estado: 'RECHAZADO', controlNumber: undefined, mhResponse: {},
    })
    prismaMock.factura.update.mockResolvedValue({} as any)

    await sincronizarEstadosDTEs()

    expect(notifMock).toHaveBeenCalledWith('fac-002', 'FAC-002', 'RECHAZADO', 'creador2')
    expect(correosMock.enviarDteAprobado).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Correr y verificar FAIL**

```bash
pnpm test tests/jobs/sincronizarEstadosDTEs.test.ts
```
Expected: FAIL — el cron aún no importa/llama `notificarDteResuelto` ni trae los campos nuevos.

- [ ] **Step 3: Implementar en el cron**

En `src/jobs/sincronizarEstadosDTEs.ts`:

1. Agregar el import:

```typescript
import { notificarDteResuelto } from '../modules/facturas/facturas.service'
```

2. Ampliar el tipo de `facturas` y el `select` de facturas (el `findMany` de facturas cerca de la línea 12) para traer `numeroFactura` y `cotizacion.creadoPorId`:

```typescript
  let facturas: { id: string; dteId: string | null; numeroFactura: string; cotizacion: { creadoPorId: string } }[]
```
```typescript
      prisma.factura.findMany({
        where: { estadoDTE: 'PROCESANDO', dteId: { not: null } },
        select: { id: true, dteId: true, numeroFactura: true, cotizacion: { select: { creadoPorId: true } } },
      }),
```

3. En el loop de facturas, tras el `update`, notificar en APROBADO o RECHAZADO (antes del bloque `enviarDteAprobado`):

```typescript
      if (resultado.estado === 'APROBADO' || resultado.estado === 'RECHAZADO') {
        await notificarDteResuelto(factura.id, factura.numeroFactura, resultado.estado, factura.cotizacion.creadoPorId)
      }

      if (resultado.estado === 'APROBADO') {
        // Solo facturas reciben correo de aprobación; notas de crédito no tienen destinatario de facturación propio
        await enviarDteAprobado(factura.id)
      }
```

(El loop de notas de crédito NO cambia. El try/catch existente del loop cubre un fallo de notificación.)

- [ ] **Step 4: Correr tests y typecheck**

```bash
pnpm test tests/jobs/ && npx tsc --noEmit
```
Expected: los tests del cron (incluido el nuevo de RECHAZADO) PASAN; tsc limpio.

- [ ] **Step 5: Correr la suite completa**

```bash
pnpm test
```
Expected: sin fallos nuevos más allá del baseline de 14 pre-existentes.

- [ ] **Step 6: Commit**

```bash
git add src/jobs/ tests/jobs/
git commit -m "feat(dte): notificar aprobación/rechazo del DTE al sincronizar con el MH

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## PARTE 2 — FRONTEND (`/Users/joaquinmorales13a06/Desktop/Reinar/frontend`, rama ya creada)

### Task 4: Íconos de los tipos nuevos en el Topbar

**Files:**
- Modify: `components/layout/Topbar.tsx:19-31` (`ICONO_POR_TIPO`)

**Interfaces:**
- Consumes: los tipos `FACTURA_CREADA` y `DTE_RECHAZADO` que el backend ahora emite.

- [ ] **Step 1: Agregar los mapeos**

En `components/layout/Topbar.tsx`, en el objeto `ICONO_POR_TIPO` (líneas 19-31), agregar dos entradas (los íconos `receipt` y `x` ya existen en `components/ui/Icon.tsx`; `DTE_APROBADO` ya está mapeado):

```typescript
  FACTURA_CREADA: 'receipt',
  DTE_RECHAZADO:  'x',
```

- [ ] **Step 2: Typecheck + lint**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm tsc --noEmit && pnpm lint
```
Expected: 0 errores de tsc; lint sin issues nuevos.

- [ ] **Step 3: Commit**

```bash
git add components/layout/Topbar.tsx
git commit -m "feat(notificaciones): íconos para FACTURA_CREADA y DTE_RECHAZADO en la campana

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Verificación end-to-end, push y PRs

**Files:** ninguno nuevo.

- [ ] **Step 1: Verificación estática final**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm test && npx tsc --noEmit
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit && pnpm lint
```
Expected: server tsc limpio; server `pnpm test` sin fallos nuevos más allá del baseline de 14; frontend tsc 0 errores, lint sin issues nuevos.

- [ ] **Step 2: Prueba manual end-to-end (backend :3000, frontend :3001)**

1. Con sesión ADMIN/GERENTE, generar una factura desde una cotización aprobada → en ≤10s aparece "Nueva factura" en la campana; click navega al detalle. (El operador creador NO la recibe si no es ADMIN/GERENTE.)
2. Emitir el DTE de una factura y esperar a que el cron lo resuelva (o forzar sincronización) → el creador de la cotización + ADMIN/GERENTE reciben "DTE aprobado" (o "DTE rechazado" si el MH rechaza); click navega al detalle.
3. Verificar que el correo de aprobación del DTE sigue llegando (sin regresión).

- [ ] **Step 3: Push y PRs**

```bash
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server push -u origin feat/notificaciones-factura-dte
git -C /Users/joaquinmorales13a06/Desktop/Reinar/frontend push -u origin feat/notificaciones-factura-dte
```

Crear los PRs con `gh pr create` en cada repo (título: `feat(notificaciones): factura creada + DTE validado/rechazado`), cuerpo con resumen del spec y checklist, terminando con:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

**Orden de merge:** server primero, luego frontend.
