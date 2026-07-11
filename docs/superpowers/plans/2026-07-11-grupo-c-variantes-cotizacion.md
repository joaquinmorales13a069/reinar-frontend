# Grupo C — Variantes de cotización con el mismo consecutivo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir variantes de una cotización que comparten el mismo consecutivo (`COT260700007` / `COT260700007-B`), donde al aprobar una las hermanas se auto-descartan, y el cliente siempre ve el número limpio (sin sufijo) en PDFs y correos.

**Architecture:** El sufijo de variante vive dentro del string `numeroCotizacion` (`-B`..`-Z`), así que el `@unique` existente y toda la UI actual funcionan sin cambios estructurales. Se agrega: un helper `numeroComercial()` que quita el sufijo en documentos cliente, un estado terminal `DESCARTADA` (migración aditiva de enum), un endpoint `POST /cotizaciones/:id/variantes` que clona cabecera + ítems, y el paso de auto-descarte de hermanas dentro de la transacción de aprobación.

**Tech Stack:** Backend Express + Prisma 7 + Vitest (`Reinar/server`); frontend Next.js App Router + React Query (`Reinar/frontend`).

**Spec:** `docs/superpowers/specs/2026-07-11-grupo-c-variantes-cotizacion-design.md`

## Global Constraints

- UI 100 % en español; comentarios tipo "why" en español.
- Tailwind estricto: solo clases predefinidas, sin valores arbitrarios, sin CSS vanilla.
- Montos con `Prisma.Decimal` / `decimal.js`; nunca `parseFloat` para dinero.
- Botones de escritura ocultos para rol `VISUALIZADOR`.
- BD remota compartida: NUNCA `migrate dev`/`migrate reset`/`db push`. Migraciones con `migrate diff` offline + `migrate deploy`.
- Suite del server: **14 fallos pre-existentes** — el conteo final debe seguir en 14 (tests nuevos en verde, 0 fallos nuevos).
- Frontend: `pnpm tsc --noEmit` limpio; `pnpm lint` en baseline **12 errores + 24 warnings** (no aumentar).
- Formato del sufijo: regex `/-([B-Z])$/` sobre `numeroCotizacion`. El número base `COTAAMMNNNNN` nunca contiene guiones.
- Ramas: crear `feat/variantes-cotizacion` en AMBOS repos antes de empezar (Tasks 1–3 tocan el server; Tasks 4–5 el frontend).

---

### Task 1: Backend — helper `numeroComercial` + número limpio en PDFs y correos

**Files:**
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/lib/variantes.ts`
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/server/tests/lib/variantes.test.ts`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/pdf/pdf.service.ts:314,424,610,705`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/correos/correos.service.ts:176,199,210`
- Test: `/Users/joaquinmorales13a06/Desktop/Reinar/server/tests/modules/pdf/pdf.service.test.ts`

**Interfaces:**
- Produces: `numeroComercial(numero: string): string` y `SUFIJO_VARIANTE_REGEX: RegExp` y `LETRAS_VARIANTE: readonly string[]` exportados de `src/lib/variantes.ts`. Tasks 2 y 3 los consumen.

- [ ] **Step 1: Escribir los tests del helper (fallan: el módulo no existe)**

Crear `tests/lib/variantes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { numeroComercial } from '../../src/lib/variantes'

describe('numeroComercial', () => {
  it('quita el sufijo de variante -B..-Z', () => {
    expect(numeroComercial('COT260700007-B')).toBe('COT260700007')
    expect(numeroComercial('COT260700007-Z')).toBe('COT260700007')
  })

  it('no toca números sin sufijo', () => {
    expect(numeroComercial('COT260700007')).toBe('COT260700007')
  })

  it('no toca sufijos que no son de variante', () => {
    // -A no se usa (el original va sin sufijo); minúsculas y dígitos tampoco son sufijo
    expect(numeroComercial('COT260700007-A')).toBe('COT260700007-A')
    expect(numeroComercial('COT260700007-b')).toBe('COT260700007-b')
    expect(numeroComercial('COT260700007-1')).toBe('COT260700007-1')
  })

  it('solo quita el sufijo final (una letra)', () => {
    expect(numeroComercial('COT260700007-B-C')).toBe('COT260700007-B')
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm test -- tests/lib/variantes.test.ts`
Expected: FAIL — "Cannot find module '../../src/lib/variantes'".

- [ ] **Step 3: Implementar el helper**

Crear `src/lib/variantes.ts`:

```ts
// Variantes de cotización: el sufijo vive DENTRO del numeroCotizacion
// ("COT260700007-B"). El número base COTAAMMNNNNN nunca contiene guiones,
// así que el sufijo se extrae sin ambigüedad. El original no lleva sufijo
// (conceptualmente es la variante "A"); las variantes usan B..Z.
// Ver docs/superpowers/specs/2026-07-11-grupo-c-variantes-cotizacion-design.md
// (en el repo frontend).

export const SUFIJO_VARIANTE_REGEX = /-([B-Z])$/

export const LETRAS_VARIANTE = 'BCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') as readonly string[]

// Número que ve el cliente en PDFs y correos: sin el sufijo interno.
// También sirve como "número base" para agrupar hermanas.
export function numeroComercial(numero: string): string {
  return numero.replace(SUFIJO_VARIANTE_REGEX, '')
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm test -- tests/lib/variantes.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Test del PDF de cotización con sufijo (falla primero)**

En `tests/modules/pdf/pdf.service.test.ts`, dentro del `describe` de `generarCotizacionPDF` (buscar el fixture `COTIZACION` y sus tests), agregar:

```ts
  it('muestra el número comercial (sin sufijo de variante) en el PDF', async () => {
    mockPrisma.cotizacion.findUniqueOrThrow.mockResolvedValue({
      ...COTIZACION,
      numeroCotizacion: 'COT2605000001-B',
    })
    await generarCotizacionPDF('cot-1')

    const browser = await vi.mocked(getBrowser)()
    const page = await browser.newPage()
    const html = vi.mocked(page.setContent).mock.calls[0][0] as string
    expect(html).toContain('COT2605000001')
    expect(html).not.toContain('COT2605000001-B')
  })
```

Run: `pnpm test -- tests/modules/pdf/pdf.service.test.ts`
Expected: FAIL — el html contiene `COT2605000001-B`.

- [ ] **Step 6: Aplicar `numeroComercial` en los 4 puntos cliente del PDF**

En `src/modules/pdf/pdf.service.ts`, agregar el import junto a los demás de `../../lib/`:

```ts
import { numeroComercial } from '../../lib/variantes'
```

y envolver los 4 usos que ven el cliente:

Línea 314 (PDF de cotización):
```ts
      numero:        numeroComercial(cotizacion.numeroCotizacion),
```

Línea 424 (PDF de factura, referencia a la cotización):
```ts
      numeroCotizacion:    numeroComercial(factura.cotizacion.numeroCotizacion),
```

Líneas 610 y 705 (PDFs de acta, referencia a la cotización):
```ts
      numeroCotizacion:    numeroComercial(acta.cotizacion.numeroCotizacion),
```

- [ ] **Step 7: Aplicar `numeroComercial` en correos al cliente**

En `src/modules/correos/correos.service.ts`, agregar el import (desde `src/modules/correos/` la ruta es `../../lib/`):

```ts
import { numeroComercial } from '../../lib/variantes'
```

Línea 176 (asunto):
```ts
    const asunto = `Cotización ${numeroComercial(cot.numeroCotizacion)} — Reinar S.A. de C.V.`
```

Línea 199 (variable del template):
```ts
        numeroCotizacion: numeroComercial(cot.numeroCotizacion),
```

Línea 210 (nombre del adjunto):
```ts
      adjuntos: [{ filename: `${numeroComercial(cot.numeroCotizacion)}.pdf`, content: pdf }],
```

- [ ] **Step 8: Correr la suite completa y tipos**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm test && npx tsc --noEmit`
Expected: tests nuevos PASS; el conteo de fallos sigue en 14 pre-existentes; tsc limpio.

- [ ] **Step 9: Commit (repo server)**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/lib/variantes.ts tests/lib/variantes.test.ts src/modules/pdf/pdf.service.ts src/modules/correos/correos.service.ts tests/modules/pdf/pdf.service.test.ts
git commit -m "feat(cotizaciones): helper numeroComercial — número sin sufijo de variante en PDFs y correos

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Backend — estado `DESCARTADA` + auto-descarte de hermanas al aprobar

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/prisma/schema.prisma` (enum `EstadoCotizacion`)
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/server/prisma/migrations/20260711140000_estado_cotizacion_descartada/migration.sql`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/cotizaciones/cotizaciones.service.ts:667-812` (bloque APROBADA de `cambiarEstado`)
- Test: `/Users/joaquinmorales13a06/Desktop/Reinar/server/tests/modules/cotizaciones/cotizaciones.service.test.ts`

**Interfaces:**
- Consumes: `numeroComercial` de `src/lib/variantes` (Task 1).
- Produces: valor de enum `DESCARTADA` en `EstadoCotizacion` (Prisma); el bloque APROBADA descarta hermanas activas dentro de la transacción. `TRANSICIONES_VALIDAS` NO cambia (DESCARTADA no tiene transiciones salientes ni se llega manualmente) y `cambiarEstadoSchema` NO se toca (no acepta DESCARTADA).

- [ ] **Step 1: Tests del descarte (fallan primero)**

En `tests/modules/cotizaciones/cotizaciones.service.test.ts`, dentro del `describe('ENVIADA → APROBADA')` (línea ~570), agregar. Seguir los patrones de mock del archivo (`prismaMock.$transaction.mockImplementation((fn: any) => fn(prismaMock))` ya está en el `beforeEach`). El fixture de cotización aprobable del describe existente sirve de base — el punto nuevo es mockear `prismaMock.cotizacion.findMany` (hermanas):

```ts
    it('descarta las variantes hermanas activas al aprobar', async () => {
      prismaMock.cotizacion.findUnique.mockResolvedValue({
        id: 'cot-1', estado: 'ENVIADA', clienteId: 'cli-1',
        creadoPorId: 'usuario-1', numeroCotizacion: 'COT2607000007',
        depositoMonto: null, actaEntregaOrigenId: null,
        items: [],
      } as any)
      prismaMock.cotizacion.findMany.mockResolvedValue([
        { id: 'cot-2', numeroCotizacion: 'COT2607000007-B', estado: 'ENVIADA' },
        { id: 'cot-3', numeroCotizacion: 'COT2607000007-C', estado: 'BORRADOR' },
      ] as any)
      prismaMock.cotizacion.update.mockResolvedValue({} as any)
      prismaMock.auditLog.create.mockResolvedValue({} as any)

      await service.cambiarEstado('cot-1', 'APROBADA', 'user-1')

      // Las hermanas activas pasan a DESCARTADA
      expect(prismaMock.cotizacion.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cot-2' }, data: { estado: 'DESCARTADA' } }),
      )
      expect(prismaMock.cotizacion.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cot-3' }, data: { estado: 'DESCARTADA' } }),
      )
      // La búsqueda de hermanas excluye la propia y filtra solo estados activos
      expect(prismaMock.cotizacion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: 'cot-1' },
            estado: { in: ['BORRADOR', 'ENVIADA'] },
          }),
        }),
      )
      // La propia queda APROBADA
      expect(prismaMock.cotizacion.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cot-1' }, data: expect.objectContaining({ estado: 'APROBADA' }) }),
      )
    })

    it('aprueba sin hermanas: el descarte no encuentra filas y no estorba', async () => {
      prismaMock.cotizacion.findUnique.mockResolvedValue({
        id: 'cot-1', estado: 'ENVIADA', clienteId: 'cli-1',
        creadoPorId: 'usuario-1', numeroCotizacion: 'COT2607000008',
        depositoMonto: null, actaEntregaOrigenId: null,
        items: [],
      } as any)
      prismaMock.cotizacion.findMany.mockResolvedValue([] as any)
      prismaMock.cotizacion.update.mockResolvedValue({} as any)
      prismaMock.auditLog.create.mockResolvedValue({} as any)

      await service.cambiarEstado('cot-1', 'APROBADA', 'user-1')

      // Solo un update: la propia cotización a APROBADA
      const updatesDescartada = prismaMock.cotizacion.update.mock.calls.filter(
        (c: any[]) => c[0]?.data?.estado === 'DESCARTADA',
      )
      expect(updatesDescartada).toHaveLength(0)
    })
```

Nota: si el `beforeEach` del describe no resetea `cotizacion.findMany`, estos tests deben mockearlo explícitamente como arriba (ya lo hacen).

- [ ] **Step 2: Correr y verificar que fallan**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm test -- tests/modules/cotizaciones/cotizaciones.service.test.ts`
Expected: FAIL — hoy no existe `DESCARTADA` ni el paso de descarte (error de tipos o asserts sin llamadas).

- [ ] **Step 3: Agregar `DESCARTADA` al enum en Prisma**

En `prisma/schema.prisma`, enum `EstadoCotizacion`, después de `CANCELADA` y su comentario:

```prisma
  // DESCARTADA es terminal y solo lo asigna el sistema: cuando se aprueba una
  // variante del mismo consecutivo, las hermanas activas se descartan
  // automaticamente ("el cliente eligio la otra"). Distinto de RECHAZADA para
  // no contaminar reportes de rechazo real.
  DESCARTADA
```

- [ ] **Step 4: Generar y aplicar la migración (flujo offline — BD compartida)**

NUNCA `migrate dev`. Run:

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
npx prisma validate
git show HEAD:prisma/schema.prisma > /tmp/schema-old-c.prisma
mkdir -p prisma/migrations/20260711140000_estado_cotizacion_descartada
npx prisma migrate diff --from-schema /tmp/schema-old-c.prisma --to-schema prisma/schema.prisma --script > prisma/migrations/20260711140000_estado_cotizacion_descartada/migration.sql
```

Limpiar el ruido (`npm warn…`, `Loaded Prisma config…`) del inicio del `.sql`. Contenido final esperado:

```sql
-- AlterEnum
ALTER TYPE "EstadoCotizacion" ADD VALUE 'DESCARTADA';
```

Luego:

```bash
npx prisma generate
npx prisma migrate deploy
npx prisma migrate status
```

Expected: deploy aplica la migración; status = "Database schema is up to date!". Nota: `ADD VALUE` dentro de la transacción de deploy es válido en PostgreSQL 12+ mientras el valor nuevo no se use en la misma transacción (aquí no se usa). Si el deploy fallara con "unsafe use of new value", STOP y reportar BLOCKED.

- [ ] **Step 5: Implementar el descarte en el bloque APROBADA**

En `src/modules/cotizaciones/cotizaciones.service.ts`:

(a) Agregar el import junto a los demás de `../../lib/`:

```ts
import { numeroComercial } from '../../lib/variantes'
```

(b) Dentro de `if (nuevoEstado === 'APROBADA') { ... }`, declarar el acumulador ANTES del `prisma.$transaction` (línea ~698), para poder emitir eventos después de la transacción:

```ts
    // Hermanas descartadas en esta aprobación — se emite el evento socket
    // después del commit, no dentro de la transacción.
    let hermanasDescartadas: { id: string; numeroCotizacion: string; estado: EstadoCotizacion }[] = []
```

(c) Como PRIMER paso dentro del callback de la transacción (antes del bloque de conflictos, línea ~699):

```ts
      // 0. Variantes hermanas activas → DESCARTADA: el cliente eligió esta.
      // Se hace ANTES del gate de disponibilidad para que las hermanas nunca
      // queden compitiendo por el mismo número una vez que hay ganadora.
      const base = numeroComercial(cotizacion.numeroCotizacion)
      hermanasDescartadas = await tx.cotizacion.findMany({
        where: {
          id:     { not: id },
          estado: { in: ['BORRADOR', 'ENVIADA'] },
          OR: [
            { numeroCotizacion: base },
            { numeroCotizacion: { startsWith: `${base}-` } },
          ],
        },
        select: { id: true, numeroCotizacion: true, estado: true },
      })
      for (const h of hermanasDescartadas) {
        await tx.cotizacion.update({ where: { id: h.id }, data: { estado: 'DESCARTADA' } })
        await tx.auditLog.create({
          data: {
            usuarioId,
            entidad:       'Cotizacion',
            entidadId:     h.id,
            accion:        'CAMBIAR_ESTADO_COTIZACION',
            camposDespues: {
              estadoAnterior: h.estado,
              estadoNuevo:    'DESCARTADA',
              motivo:         `Variante ${cotizacion.numeroCotizacion} aprobada`,
            } as Prisma.InputJsonValue,
          },
        })
      }
```

(d) Después del cierre de la transacción (tras `}, { timeout: 30000, maxWait: 10000 })`, junto al emit existente de APROBADA):

```ts
    for (const h of hermanasDescartadas) {
      io.to(`cotizacion:${h.id}`).emit('cotizacion:estado_cambiado', { cotizacionId: h.id, estado: 'DESCARTADA', fecha: new Date() })
    }
```

NO tocar `TRANSICIONES_VALIDAS` ni `cambiarEstadoSchema`: `DESCARTADA` no es alcanzable manualmente ni tiene salidas.

- [ ] **Step 6: Correr tests y tipos**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm test && npx tsc --noEmit`
Expected: tests nuevos PASS; fallos totales siguen en 14; tsc limpio.

- [ ] **Step 7: Commit (repo server)**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add prisma/schema.prisma prisma/migrations/20260711140000_estado_cotizacion_descartada src/modules/cotizaciones/cotizaciones.service.ts tests/modules/cotizaciones/cotizaciones.service.test.ts
git commit -m "feat(cotizaciones): estado DESCARTADA — al aprobar una variante se descartan las hermanas

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Backend — endpoint `POST /cotizaciones/:id/variantes` + hermanas en `GET /:id`

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/cotizaciones/cotizaciones.service.ts` (nueva función `crearVariante`; `obtenerCotizacion` agrega `variantes`)
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/cotizaciones/cotizaciones.controller.ts`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/cotizaciones/cotizaciones.routes.ts`
- Test: `/Users/joaquinmorales13a06/Desktop/Reinar/server/tests/modules/cotizaciones/cotizaciones.service.test.ts`

**Interfaces:**
- Consumes: `numeroComercial`, `SUFIJO_VARIANTE_REGEX`, `LETRAS_VARIANTE` de `src/lib/variantes` (Task 1); enum `DESCARTADA` (Task 2, solo indirectamente).
- Produces: `crearVariante(id: string, usuarioId: string)` → devuelve la variante con el shape completo de `obtenerCotizacion`. `obtenerCotizacion` devuelve además `variantes: { id, numeroCotizacion, estado, total }[]` (hermanas, excluyendo la propia, orden por número). Ruta `POST /cotizaciones/:id/variantes` (roles ADMIN/GERENTE/OPERADOR, sin body). Task 4 consume ambos.

- [ ] **Step 1: Tests de `crearVariante` (fallan primero)**

En `tests/modules/cotizaciones/cotizaciones.service.test.ts`, nuevo `describe` al nivel de los existentes. Antes: en el bloque `vi.mock('../../../src/lib/prisma', ...)` agregar `createMany: vi.fn(),` dentro del mock de `cotizacionItem` (hoy no existe).

```ts
describe('crearVariante', () => {
  const ORIGEN = {
    id: 'cot-1', numeroCotizacion: 'COT2607000007', estado: 'ENVIADA',
    clienteId: 'cli-1', proyectoId: null, contactoSolicitanteId: null,
    contactoFacturacionId: null, tipoDocumentoFiscal: null,
    notas: 'nota', notasInternas: null,
    porcentajeIva: new Decimal(13), exentoIva: false,
    fechaVencimiento: new Date('2026-08-01'),
    condicionesPago: null, actaEntregaOrigenId: null,
    depositoMonto: new Decimal(100), depositoPorcentaje: null,
    subtotal: new Decimal(500), montoIva: new Decimal(65), total: new Decimal(565),
    creadoPorId: 'usuario-0',
    items: [
      {
        id: 'item-1', cotizacionId: 'cot-1', tipo: 'EQUIPO',
        equipoId: 'eq-1', servicioId: null, herramientaTipoId: null,
        consumibleId: null, piezaTipoId: null,
        descripcion: 'Equipo X', cantidadUnidades: 1, cantidadDias: 5,
        periodo: 'DIA', periodoCustomLabel: null, fechaServicio: null,
        tecnicoAsignado: null, tarifaCatalogo: new Decimal(100),
        tarifaCustom: null, tarifaAplicada: new Decimal(100),
        subtotal: new Decimal(500), esTarifaCustom: false, orden: 1,
        cuerpoGrupoId: null, cuerpoTipoNombre: null,
      },
    ],
  }

  it('clona cabecera e items con el sufijo -B y estado BORRADOR', async () => {
    prismaMock.cotizacion.findUnique.mockResolvedValueOnce(ORIGEN as any) // origen
    prismaMock.cotizacion.findMany.mockResolvedValueOnce([
      { numeroCotizacion: 'COT2607000007', estado: 'ENVIADA' },
    ] as any) // hermanas
    prismaMock.cotizacion.create.mockResolvedValue({ id: 'cot-var' } as any)
    prismaMock.cotizacionItem.createMany.mockResolvedValue({ count: 1 } as any)
    prismaMock.auditLog.create.mockResolvedValue({} as any)
    // obtenerCotizacion al final: findUnique + findMany (variantes)
    prismaMock.cotizacion.findUnique.mockResolvedValueOnce({ id: 'cot-var', numeroCotizacion: 'COT2607000007-B' } as any)
    prismaMock.cotizacion.findMany.mockResolvedValueOnce([] as any)

    await service.crearVariante('cot-1', 'user-1')

    expect(prismaMock.cotizacion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          numeroCotizacion: 'COT2607000007-B',
          estado:           'BORRADOR',
          clienteId:        'cli-1',
          creadoPorId:      'user-1',
          notas:            'nota',
        }),
      }),
    )
    // Items clonados sin id ni cotizacionId originales
    expect(prismaMock.cotizacionItem.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ cotizacionId: 'cot-var', descripcion: 'Equipo X', orden: 1 })],
      }),
    )
    const itemData = (prismaMock.cotizacionItem.createMany.mock.calls[0][0] as any).data[0]
    expect(itemData.id).toBeUndefined()
  })

  it('asigna la siguiente letra libre (existe -B → crea -C)', async () => {
    prismaMock.cotizacion.findUnique.mockResolvedValueOnce({ ...ORIGEN, numeroCotizacion: 'COT2607000007-B' } as any)
    prismaMock.cotizacion.findMany.mockResolvedValueOnce([
      { numeroCotizacion: 'COT2607000007', estado: 'ENVIADA' },
      { numeroCotizacion: 'COT2607000007-B', estado: 'ENVIADA' },
    ] as any)
    prismaMock.cotizacion.create.mockResolvedValue({ id: 'cot-var2' } as any)
    prismaMock.cotizacionItem.createMany.mockResolvedValue({ count: 1 } as any)
    prismaMock.auditLog.create.mockResolvedValue({} as any)
    prismaMock.cotizacion.findUnique.mockResolvedValueOnce({ id: 'cot-var2' } as any)
    prismaMock.cotizacion.findMany.mockResolvedValueOnce([] as any)

    await service.crearVariante('cot-1', 'user-1')

    expect(prismaMock.cotizacion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ numeroCotizacion: 'COT2607000007-C' }) }),
    )
  })

  it('rechaza origen en estado no válido', async () => {
    prismaMock.cotizacion.findUnique.mockResolvedValueOnce({ ...ORIGEN, estado: 'APROBADA' } as any)
    await expect(service.crearVariante('cot-1', 'user-1')).rejects.toMatchObject({ code: 'ESTADO_INVALIDO' })
  })

  it('rechaza si ya hay una hermana APROBADA', async () => {
    prismaMock.cotizacion.findUnique.mockResolvedValueOnce(ORIGEN as any)
    prismaMock.cotizacion.findMany.mockResolvedValueOnce([
      { numeroCotizacion: 'COT2607000007', estado: 'ENVIADA' },
      { numeroCotizacion: 'COT2607000007-B', estado: 'APROBADA' },
    ] as any)
    await expect(service.crearVariante('cot-1', 'user-1')).rejects.toMatchObject({ code: 'VARIANTE_APROBADA' })
  })

  it('reintenta con la siguiente letra si el sufijo choca (P2002)', async () => {
    prismaMock.cotizacion.findUnique.mockResolvedValueOnce(ORIGEN as any)
    // Primer intento: hermanas sin -B → intenta -B, choca
    prismaMock.cotizacion.findMany.mockResolvedValueOnce([
      { numeroCotizacion: 'COT2607000007', estado: 'ENVIADA' },
    ] as any)
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002', clientVersion: '7',
    } as any)
    prismaMock.cotizacion.create.mockRejectedValueOnce(p2002)
    // Segundo intento: la hermana -B ya existe → intenta -C
    prismaMock.cotizacion.findMany.mockResolvedValueOnce([
      { numeroCotizacion: 'COT2607000007', estado: 'ENVIADA' },
      { numeroCotizacion: 'COT2607000007-B', estado: 'BORRADOR' },
    ] as any)
    prismaMock.cotizacion.create.mockResolvedValueOnce({ id: 'cot-var3' } as any)
    prismaMock.cotizacionItem.createMany.mockResolvedValue({ count: 1 } as any)
    prismaMock.auditLog.create.mockResolvedValue({} as any)
    prismaMock.cotizacion.findUnique.mockResolvedValueOnce({ id: 'cot-var3' } as any)
    prismaMock.cotizacion.findMany.mockResolvedValueOnce([] as any)

    await service.crearVariante('cot-1', 'user-1')

    expect(prismaMock.cotizacion.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ numeroCotizacion: 'COT2607000007-C' }) }),
    )
  })
})
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `pnpm test -- tests/modules/cotizaciones/cotizaciones.service.test.ts`
Expected: FAIL — `service.crearVariante is not a function`.

- [ ] **Step 3: Implementar `crearVariante` y `variantes` en `obtenerCotizacion`**

En `src/modules/cotizaciones/cotizaciones.service.ts`:

(a) Ajustar el import de Task 2 para traer también las constantes:

```ts
import { numeroComercial, SUFIJO_VARIANTE_REGEX, LETRAS_VARIANTE } from '../../lib/variantes'
```

(b) En `obtenerCotizacion` (línea ~112), después del `if (!cotizacion) throw ...` y antes del `return`:

```ts
  // Hermanas del mismo consecutivo (variantes) — alimenta la tarjeta
  // "Variantes" del detalle. Excluye la propia; para la mayoría de
  // cotizaciones esto devuelve [].
  const base = numeroComercial(cotizacion.numeroCotizacion)
  const variantes = await prisma.cotizacion.findMany({
    where: {
      id: { not: id },
      OR: [
        { numeroCotizacion: base },
        { numeroCotizacion: { startsWith: `${base}-` } },
      ],
    },
    orderBy: { numeroCotizacion: 'asc' },
    select: { id: true, numeroCotizacion: true, estado: true, total: true },
  })

  return { ...cotizacion, variantes }
```

(y borrar el `return cotizacion` original).

(c) Nueva función exportada, después de `crearCotizacion`:

```ts
// ── Crear variante ─────────────────────────────────────────────────────────────

// Clona la cotización (cabecera + items) reutilizando el mismo consecutivo con
// un sufijo -B..-Z. Las variantes compiten: al aprobar una, cambiarEstado
// descarta a las hermanas. El número de secuencia NO se incrementa — ese es
// justamente el objetivo (ventas no quiere gastar consecutivos en propuestas
// alternativas del mismo trabajo).
export async function crearVariante(id: string, usuarioId: string) {
  const origen = await prisma.cotizacion.findUnique({
    where: { id },
    include: { items: true },
  })
  if (!origen) throw new AppError(404, 'NOT_FOUND', 'Cotización no encontrada')
  if (origen.estado !== 'BORRADOR' && origen.estado !== 'ENVIADA') {
    throw new AppError(422, 'ESTADO_INVALIDO', 'Solo se puede crear una variante desde una cotización en BORRADOR o ENVIADA')
  }

  const base = numeroComercial(origen.numeroCotizacion)

  // Reintento acotado: dos usuarios creando variantes del mismo número a la
  // vez chocan en el @unique (P2002); el perdedor recalcula la letra.
  for (let intento = 0; intento < 3; intento++) {
    const hermanas = await prisma.cotizacion.findMany({
      where: {
        OR: [
          { numeroCotizacion: base },
          { numeroCotizacion: { startsWith: `${base}-` } },
        ],
      },
      select: { numeroCotizacion: true, estado: true },
    })
    if (hermanas.some((h) => h.estado === 'APROBADA')) {
      throw new AppError(422, 'VARIANTE_APROBADA', 'Ya existe una variante aprobada de este número')
    }
    const usadas = new Set(
      hermanas
        .map((h) => SUFIJO_VARIANTE_REGEX.exec(h.numeroCotizacion)?.[1])
        .filter((s): s is string => !!s),
    )
    const letra = LETRAS_VARIANTE.find((l) => !usadas.has(l))
    if (!letra) {
      throw new AppError(422, 'LIMITE_VARIANTES', 'Se alcanzó el límite de variantes para este número')
    }

    try {
      const creada = await prisma.$transaction(async (tx) => {
        const nueva = await tx.cotizacion.create({
          data: {
            numeroCotizacion:      `${base}-${letra}`,
            estado:                'BORRADOR',
            clienteId:             origen.clienteId,
            proyectoId:            origen.proyectoId,
            contactoSolicitanteId: origen.contactoSolicitanteId,
            contactoFacturacionId: origen.contactoFacturacionId,
            tipoDocumentoFiscal:   origen.tipoDocumentoFiscal,
            condicionesPago:       origen.condicionesPago,
            notas:                 origen.notas,
            notasInternas:         origen.notasInternas,
            porcentajeIva:         origen.porcentajeIva,
            exentoIva:             origen.exentoIva,
            fechaVencimiento:      origen.fechaVencimiento,
            // La variante de una renovación sigue siendo renovación del mismo
            // acta: sin este vínculo, aprobar la variante fallaría el gate de
            // disponibilidad (los ítems siguen en obra por la renta original).
            actaEntregaOrigenId:   origen.actaEntregaOrigenId,
            depositoMonto:         origen.depositoMonto,
            depositoPorcentaje:    origen.depositoPorcentaje,
            // Totales copiados tal cual: los items son idénticos al clonar.
            subtotal:              origen.subtotal,
            montoIva:              origen.montoIva,
            total:                 origen.total,
            creadoPorId:           usuarioId,
          },
        })
        if (origen.items.length > 0) {
          await tx.cotizacionItem.createMany({
            data: origen.items.map(({ id: _id, cotizacionId: _cotId, ...item }) => ({
              ...item,
              cotizacionId: nueva.id,
            })),
          })
        }
        await tx.auditLog.create({
          data: {
            usuarioId,
            entidad:       'Cotizacion',
            entidadId:     nueva.id,
            accion:        'CREAR_VARIANTE_COTIZACION',
            camposDespues: { origenId: id, numeroCotizacion: `${base}-${letra}` } as Prisma.InputJsonValue,
          },
        })
        return nueva
      })
      return obtenerCotizacion(creada.id)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue
      throw err
    }
  }
  throw new AppError(409, 'CONFLICTO_VARIANTE', 'No se pudo asignar un sufijo de variante; intentá de nuevo')
}
```

- [ ] **Step 4: Controller y ruta**

En `cotizaciones.controller.ts`, después de `crear`:

```ts
export async function crearVariante(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const variante = await service.crearVariante(req.params.id as string, req.user!.sub)
    res.status(201).json({ success: true, data: variante })
  } catch (err) { next(err) }
}
```

En `cotizaciones.routes.ts`, después del bloque `POST /:id/factura` (línea ~93):

```ts
// Variante: clona la cotización reutilizando el mismo consecutivo con sufijo
// interno (-B..-Z). Sin body — todo se copia del origen.
router.post(
  "/:id/variantes",
  authenticate,
  requireRol(...operadores),
  ctrl.crearVariante,
);
```

- [ ] **Step 5: Correr tests y tipos**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm test && npx tsc --noEmit`
Expected: los 5 tests nuevos PASS; fallos totales siguen en 14; tsc limpio. Ojo: si tests existentes de `obtenerCotizacion`/`crearCotizacion` fallan porque ahora `obtenerCotizacion` hace un `findMany` extra, agregarles `prismaMock.cotizacion.findMany.mockResolvedValue([] as any)` en su arrange.

- [ ] **Step 6: Commit (repo server)**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/modules/cotizaciones tests/modules/cotizaciones/cotizaciones.service.test.ts
git commit -m "feat(cotizaciones): POST /:id/variantes clona con el mismo consecutivo; hermanas en GET /:id

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Frontend — tipos, hook `useCrearVariante` y número comercial en descargas

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/types/api.ts:734` (EstadoCotizacion) y tipo `Cotizacion`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/lib/utils.ts` (helper `numeroComercial`)
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/hooks/use-cotizaciones.ts` (hook nuevo + filename de descarga)

**Interfaces:**
- Consumes: endpoint `POST /cotizaciones/:id/variantes` y campo `variantes` de `GET /cotizaciones/:id` (Task 3).
- Produces: `EstadoCotizacion` incluye `'DESCARTADA'`; `Cotizacion.variantes: { id: string; numeroCotizacion: string; estado: EstadoCotizacion; total: string }[]`; `numeroComercial(numero: string): string` en `lib/utils.ts`; `useCrearVariante()` (mutation `(id: string) => Cotizacion`). Task 5 consume los tres.

- [ ] **Step 1: Tipos**

En `types/api.ts`:

(a) Línea 734:

```ts
export type EstadoCotizacion = 'BORRADOR' | 'ENVIADA' | 'APROBADA' | 'RECHAZADA' | 'CANCELADA' | 'DESCARTADA';
```

(b) En el tipo `Cotizacion` (forma completa de GET /:id), agregar al final de sus campos:

```ts
  // Hermanas del mismo consecutivo (variantes con sufijo -B..-Z). El backend
  // siempre lo devuelve ([] cuando no hay variantes).
  variantes: { id: string; numeroCotizacion: string; estado: EstadoCotizacion; total: string }[];
```

- [ ] **Step 2: Helper `numeroComercial` en `lib/utils.ts`**

Agregar al final de `lib/utils.ts`:

```ts
// Número que ve el cliente: sin el sufijo interno de variante (-B..-Z) que
// distingue cotizaciones hermanas del mismo consecutivo. Espejo del helper
// homónimo del backend (server/src/lib/variantes.ts).
export function numeroComercial(numero: string): string {
  return numero.replace(/-[B-Z]$/, '');
}
```

- [ ] **Step 3: Hook `useCrearVariante` + filename de descarga limpio**

En `hooks/use-cotizaciones.ts`:

(a) Agregar `numeroComercial` al import existente de `@/lib/utils` (o crear el import si el archivo no importa de ahí).

(b) Después de `useCrearCotizacion`:

```ts
export function useCrearVariante() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<ApiResponse<Cotizacion>>(`/cotizaciones/${id}/variantes`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (variante) => {
      qc.invalidateQueries({ queryKey: ['cotizaciones'] });
      // Prefijo 'cotizacion' invalida también el detalle del origen, cuya
      // tarjeta de variantes debe refrescarse.
      qc.invalidateQueries({ queryKey: ['cotizacion'] });
      toast.success(`Variante ${variante.numeroCotizacion} creada.`);
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear la variante.'));
    },
  });
}
```

(c) En `descargarCotizacionPdf` (línea ~253), el archivo descargado va al cliente — limpiar el sufijo:

```ts
    a.download = `${numeroComercial(numero)}.pdf`;
```

- [ ] **Step 4: Verificar tipos**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit`
Expected: limpio. (Si algún componente construye objetos `Cotizacion` literales en fixtures/mocks, agregarles `variantes: []`.)

- [ ] **Step 5: Commit (repo frontend)**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add types/api.ts lib/utils.ts hooks/use-cotizaciones.ts
git commit -m "feat(cotizaciones): tipos y hook para variantes; filename de PDF sin sufijo

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Frontend — botón "Crear variante", tarjeta de variantes y estado DESCARTADA en la UI

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/cotizaciones/CotizacionStatusBadge.tsx`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/app/(dashboard)/cotizaciones/page.tsx:28` (chips)
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/cotizaciones/detalle/AccionesEstado.tsx`
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/cotizaciones/detalle/VariantesCard.tsx`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/app/(dashboard)/cotizaciones/[id]/page.tsx`

**Interfaces:**
- Consumes: `useCrearVariante()`, `Cotizacion.variantes`, `EstadoCotizacion` con `'DESCARTADA'` (Task 4).
- Produces: `VariantesCard({ cotizacion }: { cotizacion: Cotizacion })`.

- [ ] **Step 1: Badge DESCARTADA**

En `CotizacionStatusBadge.tsx`, agregar al `META`:

```ts
  // DESCARTADA es neutral: no es un rechazo del cliente sino que eligió otra
  // variante del mismo número.
  DESCARTADA: { label: 'Descartada', kind: 'neutral' },
```

- [ ] **Step 2: Chip de filtro en la tabla**

En `app/(dashboard)/cotizaciones/page.tsx` línea 28:

```ts
  const chips = (['BORRADOR', 'ENVIADA', 'APROBADA', 'RECHAZADA', 'DESCARTADA'] as const).map((e) => ({
```

El pipeline NO cambia: sus columnas son una lista explícita (BORRADOR/ENVIADA/APROBADA/RECHAZADA) y DESCARTADA simplemente no aparece, igual que CANCELADA hoy.

- [ ] **Step 3: Botón "Crear variante" en `AccionesEstado`**

En `components/cotizaciones/detalle/AccionesEstado.tsx`:

(a) Agregar `useCrearVariante` al import de `@/hooks/use-cotizaciones`.

(b) Dentro del componente, junto a los otros hooks:

```tsx
  const crearVariante = useCrearVariante();
  // El backend revalida; esto solo evita el round-trip con un hint claro.
  const varianteAprobada = (cotizacion.variantes ?? []).some((v) => v.estado === 'APROBADA');

  async function nuevaVariante() {
    try {
      const v = await crearVariante.mutateAsync(cotizacion.id);
      router.push(`/cotizaciones/${v.id}`);
    } catch {
      // el hook ya muestra el toast de error
    }
  }
```

(c) El botón, agregado a los bloques de botones de `BORRADOR` **y** de `ENVIADA` (en ambos, como primer botón secundario):

```tsx
        <button
          type="button"
          disabled={crearVariante.isPending || varianteAprobada}
          title={varianteAprobada ? 'Ya existe una variante aprobada de este número' : undefined}
          className={`${btnBase} border border-bd text-tx-2 hover:bg-bg-sunken disabled:opacity-50`}
          onClick={() => { void nuevaVariante(); }}
        >
          <Icon name="copy" size={14} /> {crearVariante.isPending ? 'Creando…' : 'Crear variante'}
        </button>
```

- [ ] **Step 4: Tarjeta de variantes**

Crear `components/cotizaciones/detalle/VariantesCard.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { CotizacionStatusBadge } from '@/components/cotizaciones/CotizacionStatusBadge';
import { formatCurrency } from '@/lib/utils';
import type { Cotizacion } from '@/types/api';

// Hermanas de esta cotización: mismo consecutivo, sufijo interno distinto.
// Solo se renderiza cuando existen — la mayoría de cotizaciones no tiene.
export function VariantesCard({ cotizacion }: { cotizacion: Cotizacion }) {
  if (!cotizacion.variantes || cotizacion.variantes.length === 0) return null;

  return (
    <div className="bg-bg border border-bd rounded-md p-4">
      <h3 className="text-sm font-medium text-tx mb-2">Variantes de este número</h3>
      <p className="text-xs text-tx-3 mb-3">
        Comparten el consecutivo; al aprobar una, las demás se descartan. El cliente ve el número sin sufijo.
      </p>
      <div className="divide-y divide-bd">
        {cotizacion.variantes.map((v) => (
          <Link
            key={v.id}
            href={`/cotizaciones/${v.id}`}
            className="flex items-center justify-between gap-3 py-2 px-1 rounded hover:bg-bg-sunken transition-colors"
          >
            <span className="text-sm font-mono font-medium text-tx">{v.numeroCotizacion}</span>
            <span className="flex items-center gap-3">
              <CotizacionStatusBadge estado={v.estado} />
              <span className="text-sm font-mono text-tx-2">{formatCurrency(v.total)}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Renderizar la tarjeta en el detalle**

En `app/(dashboard)/cotizaciones/[id]/page.tsx`:

(a) Import junto a los otros de `detalle/`:

```tsx
import { VariantesCard } from '@/components/cotizaciones/detalle/VariantesCard';
```

(b) Dentro del `<div className="lg:col-span-2 space-y-4">` (columna izquierda, línea ~66), como **último hijo** del div:

```tsx
          <VariantesCard cotizacion={cot} />
```

- [ ] **Step 6: Verificar tipos y lint**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit && pnpm lint 2>&1 | tail -1`
Expected: tsc limpio; lint `✖ 36 problems (12 errors, 24 warnings)` (baseline, sin aumento).

- [ ] **Step 7: Verificación manual end-to-end**

Con backend y frontend corriendo:
1. Cotización en ENVIADA → botón "Crear variante" → crea `…-B`, redirige a su detalle en BORRADOR; la tarjeta "Variantes" aparece en ambas.
2. Editar la variante (quitar/agregar ítem de envío), enviarla y aprobarla → la hermana original pasa a DESCARTADA (badge neutral) y aparece en el filtro DESCARTADA de la tabla.
3. Intentar "Crear variante" desde la descartada → botón deshabilitado/error del backend.
4. Descargar el PDF de la variante aprobada → el archivo se llama `COT…007.pdf` y el documento muestra el número sin `-B`.
5. Generar factura desde la variante aprobada → PDF de factura muestra el número de cotización sin sufijo.

- [ ] **Step 8: Commit (repo frontend)**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add components/cotizaciones/CotizacionStatusBadge.tsx "app/(dashboard)/cotizaciones/page.tsx" components/cotizaciones/detalle/AccionesEstado.tsx components/cotizaciones/detalle/VariantesCard.tsx "app/(dashboard)/cotizaciones/[id]/page.tsx"
git commit -m "feat(cotizaciones): UI de variantes — crear variante, tarjeta de hermanas y estado DESCARTADA

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Verificación final del grupo

- [ ] Backend: `pnpm test` (fallos = 14 pre-existentes, tests nuevos verdes) y `npx tsc --noEmit` limpio.
- [ ] Frontend: `pnpm tsc --noEmit` + `pnpm lint` (12/24 baseline).
- [ ] Flujo manual completo del Step 7 de la Task 5.
- [ ] Checklist estándar pre-PR (dark mode, tablet, roles, toasts).

## Nota de desviación consciente respecto al spec

El spec no lista `actaEntregaOrigenId` ni `condicionesPago` entre los campos clonados. Se clonan ambos deliberadamente: `condicionesPago` es parte de la cabecera comercial, y sin `actaEntregaOrigenId` la variante de una renovación fallaría el gate de disponibilidad al aprobarse (los ítems siguen en obra por la renta original). Señalado aquí para el reviewer.
