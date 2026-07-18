# Observaciones (`comments`) con período de renta en DTE FC/CCF — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enviar el período de renta (+ notas de la factura) en el campo `comments` del payload de emisión FC/CCF hacia FacturaLlama, y exigir que el período esté registrado antes de emitir.

**Architecture:** El backend construye el texto de observaciones (`buildComments`) y lo incluye a nivel raíz del payload FC/CCF; `emitirDTE` valida el período con 422 `PERIODO_RENTA_REQUERIDO` y `emitirFC`/`emitirCCF` repiten el chequeo como defensa en profundidad. El frontend deshabilita los botones de emisión en `DteSection` cuando falta el período, con hint que dirige al `PeriodoFacturaCard` de la misma página.

**Tech Stack:** Backend Express + Prisma + vitest en `/Users/joaquinmorales13a06/Desktop/Reinar/server`; frontend Next.js en `/Users/joaquinmorales13a06/Desktop/Reinar/frontend` (sin suite de tests — verificación con `pnpm tsc --noEmit`).

**Spec:** `docs/superpowers/specs/2026-07-18-dte-comments-periodo-renta-design.md`

## Global Constraints

- Todo texto de UI, mensajes de error y comentarios de código en español; comentarios solo tipo "why".
- Alcance: solo FC y CCF. NC y FSE no se tocan.
- `comments` va a **nivel raíz** del payload (junto a `id`, `paymentType`, `recipient`, `items`); máx. 3000 caracteres.
- Formato del comentario: `Período de renta: del dd/mm/yyyy al dd/mm/yyyy` + salto de línea + notas de la factura si existen.
- Código de error de la validación: `AppError(422, 'PERIODO_RENTA_REQUERIDO', 'La factura debe tener el período de renta registrado antes de emitir el DTE')` — idéntico en `emitirDTE` y en la defensa de `emitirFC`/`emitirCCF`.
- Los cambios de backend se commitean en el repo `server`; los de frontend en el repo `frontend` (rama `feat/dte-comments-periodo-renta` en ambos — en `server` hay que crearla desde `main`).
- Tailwind: solo clases predefinidas del proyecto (tokens `text-warn`, `text-xs`, etc.).

---

### Task 1: Backend — `buildComments` + campo `comments` en los tipos de payload

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/facturallama/facturallama.types.ts` (interfaces `PayloadFC` ~línea 102 y `PayloadCCF` ~línea 110)
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/facturallama/facturallama.service.ts` (helpers, después de `nombreComercialDte` ~línea 91)
- Test: `/Users/joaquinmorales13a06/Desktop/Reinar/server/tests/modules/facturallama/facturallama.service.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `buildComments(factura: { periodoRentaInicio: Date; periodoRentaFin: Date; notas: string | null }): string` exportada desde `facturallama.service.ts`; `comments?: string` en `PayloadFC` y `PayloadCCF`. Task 2 depende de ambos.

- [ ] **Step 1: Crear la rama en el repo server**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git checkout main && git pull && git checkout -b feat/dte-comments-periodo-renta
```

- [ ] **Step 2: Escribir los tests que fallan**

En `tests/modules/facturallama/facturallama.service.test.ts`: agregar `buildComments` al import de la línea 29 y este bloque al final del archivo:

```typescript
// ── buildComments ─────────────────────────────────────────────────────────────

describe('buildComments', () => {
  it('formatea el período de renta como dd/mm/yyyy', () => {
    const result = buildComments({
      periodoRentaInicio: new Date('2026-07-01'),
      periodoRentaFin:    new Date('2026-07-15'),
      notas: null,
    })
    expect(result).toBe('Período de renta: del 01/07/2026 al 15/07/2026')
  })

  it('agrega las notas de la factura en línea aparte', () => {
    const result = buildComments({
      periodoRentaInicio: new Date('2026-07-01'),
      periodoRentaFin:    new Date('2026-07-15'),
      notas: 'Entrega en obra San Benito',
    })
    expect(result).toBe('Período de renta: del 01/07/2026 al 15/07/2026\nEntrega en obra San Benito')
  })

  it('ignora notas vacías o de solo espacios', () => {
    const result = buildComments({
      periodoRentaInicio: new Date('2026-07-01'),
      periodoRentaFin:    new Date('2026-07-15'),
      notas: '   ',
    })
    expect(result).toBe('Período de renta: del 01/07/2026 al 15/07/2026')
  })

  it('trunca el resultado a 3000 caracteres', () => {
    const result = buildComments({
      periodoRentaInicio: new Date('2026-07-01'),
      periodoRentaFin:    new Date('2026-07-15'),
      notas: 'x'.repeat(4000),
    })
    expect(result.length).toBe(3000)
  })
})
```

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm vitest run tests/modules/facturallama/facturallama.service.test.ts`
Expected: FAIL — `buildComments` no existe en el módulo.

- [ ] **Step 4: Implementar `buildComments` y el campo `comments`**

En `facturallama.types.ts`, agregar a `PayloadFC` y a `PayloadCCF` (mismo texto en ambas interfaces):

```typescript
  // Observaciones del DTE. No aparece en la doc pública de FacturaLlama pero
  // su equipo lo confirmó (jul-2026): mapea a extension.observaciones del
  // esquema MH, máx. 3000 caracteres. Nivel raíz del payload.
  comments?: string
```

En `facturallama.service.ts`, después de `nombreComercialDte` (~línea 91):

```typescript
// Observaciones del DTE (campo `comments` del payload, máx. 3000 — mapea a
// extension.observaciones del MH). Incluye el período de renta de la factura
// y sus notas si existen. Getters UTC porque el período se persiste como
// medianoche UTC (date input → toISOString); getters locales correrían la
// fecha un día hacia atrás en horarios negativos como El Salvador (UTC-6).
export function buildComments(factura: {
  periodoRentaInicio: Date
  periodoRentaFin: Date
  notas: string | null
}): string {
  const fmt = (d: Date) => {
    const dd = String(d.getUTCDate()).padStart(2, '0')
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    return `${dd}/${mm}/${d.getUTCFullYear()}`
  }
  const periodo = `Período de renta: del ${fmt(factura.periodoRentaInicio)} al ${fmt(factura.periodoRentaFin)}`
  const notas = factura.notas?.trim()
  return (notas ? `${periodo}\n${notas}` : periodo).slice(0, 3000)
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `pnpm vitest run tests/modules/facturallama/facturallama.service.test.ts`
Expected: PASS (los 4 tests nuevos y todos los existentes).

- [ ] **Step 6: Commit**

```bash
git add src/modules/facturallama/facturallama.types.ts src/modules/facturallama/facturallama.service.ts tests/modules/facturallama/facturallama.service.test.ts
git commit -m "feat(facturallama): buildComments con período de renta y campo comments en FC/CCF"
```

---

### Task 2: Backend — `emitirFC`/`emitirCCF` envían `comments` y validan período (defensa)

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/facturallama/facturallama.service.ts` (`emitirFC` ~líneas 230-291, `emitirCCF` ~líneas 293-360)
- Test: `/Users/joaquinmorales13a06/Desktop/Reinar/server/tests/modules/facturallama/facturallama.service.test.ts`

**Interfaces:**
- Consumes: `buildComments` y `comments?: string` de Task 1.
- Produces: payloads FC/CCF con `comments`; `AppError(422, 'PERIODO_RENTA_REQUERIDO', …)` si la factura llega sin período. Task 3 usa el mismo código de error.

- [ ] **Step 1: Actualizar el fixture y escribir los tests que fallan**

En los fixtures `FACTURA_BASE` (~línea 34) y `FACTURA_CCF_BASE` (~línea 223) — son objetos independientes, hay que tocar los dos — agregar:

```typescript
  periodoRentaInicio: new Date('2026-07-01'),
  periodoRentaFin:    new Date('2026-07-15'),
  notas: null,
```

Agregar dentro del `describe('emitirFC', …)` existente:

```typescript
  it('incluye comments con el período de renta en el payload', async () => {
    prismaMock.factura.findUnique.mockResolvedValue(FACTURA_BASE as any)
    prismaMock.factura.update.mockResolvedValue({} as any)
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'dte-uuid-010', controlNumber: null, status: 'APPROVED', mhResponse: {} }),
    } as any)

    await emitirFC('fac-001')

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body.comments).toBe('Período de renta: del 01/07/2026 al 15/07/2026')
  })

  it('lanza PERIODO_RENTA_REQUERIDO si la factura no tiene período de renta', async () => {
    prismaMock.factura.findUnique.mockResolvedValue({
      ...FACTURA_BASE,
      periodoRentaInicio: null,
      periodoRentaFin: null,
    } as any)

    await expect(emitirFC('fac-001')).rejects.toThrow(
      expect.objectContaining({ code: 'PERIODO_RENTA_REQUERIDO', statusCode: 422 })
    )
    expect(fetch).not.toHaveBeenCalled()
  })
```

Agregar dentro del `describe('emitirCCF', …)` existente (~línea 254), usando el fixture `FACTURA_CCF_BASE` ya actualizado:

```typescript
  it('incluye comments con el período de renta en el payload', async () => {
    prismaMock.factura.findUnique.mockResolvedValue(FACTURA_CCF_BASE as any)
    prismaMock.factura.update.mockResolvedValue({} as any)
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'dte-uuid-011', controlNumber: null, status: 'APPROVED', mhResponse: {} }),
    } as any)

    await emitirCCF('fac-ccf-001')

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body.comments).toBe('Período de renta: del 01/07/2026 al 15/07/2026')
  })

  it('lanza PERIODO_RENTA_REQUERIDO si la factura no tiene período de renta', async () => {
    prismaMock.factura.findUnique.mockResolvedValue({
      ...FACTURA_CCF_BASE,
      periodoRentaInicio: null,
      periodoRentaFin: null,
    } as any)

    await expect(emitirCCF('fac-ccf-001')).rejects.toThrow(
      expect.objectContaining({ code: 'PERIODO_RENTA_REQUERIDO', statusCode: 422 })
    )
    expect(fetch).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `pnpm vitest run tests/modules/facturallama/facturallama.service.test.ts`
Expected: FAIL — los 4 tests nuevos (payload sin `comments`; la emisión sin período no lanza).

- [ ] **Step 3: Implementar en `emitirFC` y `emitirCCF`**

En ambas funciones, inmediatamente **antes** de `const dteId = crypto.randomUUID()`. En `emitirCCF` esto queda después de los chequeos de cliente existentes (DUI/NIT, número de documento, NCR — líneas ~307-315), a propósito: los tests de `emitirCCF validaciones` (~línea 632) mockean facturas sin período para probar esos errores de cliente y deben seguir recibiendo su error original.

```typescript
  // El período de renta viaja en comments — requisito del DTE. emitirDTE ya lo
  // valida con mensaje amigable; esto es defensa en profundidad.
  if (!factura.periodoRentaInicio || !factura.periodoRentaFin) {
    throw new AppError(422, 'PERIODO_RENTA_REQUERIDO', 'La factura debe tener el período de renta registrado antes de emitir el DTE')
  }
```

En el objeto `payload` de `emitirFC` (~línea 273) y de `emitirCCF` (~línea 342), agregar tras `items`:

```typescript
    comments: buildComments({
      periodoRentaInicio: factura.periodoRentaInicio,
      periodoRentaFin:    factura.periodoRentaFin,
      notas:              factura.notas,
    }),
```

(El guard anterior estrecha los tipos a `Date`, no hace falta `!`.)

- [ ] **Step 4: Correr la suite completa del backend**

Run: `pnpm vitest run`
Expected: PASS completo. Si algún test existente de `emitirFC`/`emitirCCF` falla por falta de período en su mock propio (no basado en `FACTURA_BASE`), agregarle `periodoRentaInicio`/`periodoRentaFin`/`notas` como en el Step 1.

- [ ] **Step 5: Commit**

```bash
git add src/modules/facturallama/facturallama.service.ts tests/modules/facturallama/facturallama.service.test.ts
git commit -m "feat(facturallama): enviar comments en FC/CCF y exigir período de renta"
```

---

### Task 3: Backend — validación de período en `emitirDTE`

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/facturas/facturas.service.ts` (`emitirDTE` ~líneas 256-294)
- Test: `/Users/joaquinmorales13a06/Desktop/Reinar/server/tests/modules/facturas/facturas.service.test.ts` (`describe('emitirDTE')` ~línea 347)

**Interfaces:**
- Consumes: mismo código de error `PERIODO_RENTA_REQUERIDO` definido en Task 2 (sin dependencia de código — solo consistencia).
- Produces: `emitirDTE` rechaza con 422 `PERIODO_RENTA_REQUERIDO` cuando `periodoRentaInicio`/`periodoRentaFin` son null. El frontend (Task 4) muestra ese mensaje inline como caso residual.

- [ ] **Step 1: Escribir el test que falla y actualizar mocks existentes**

En `describe('emitirDTE')`, agregar:

```typescript
  it('lanza PERIODO_RENTA_REQUERIDO si la factura no tiene período de renta', async () => {
    prismaMock.factura.findUnique.mockResolvedValue({
      id: FACTURA_ID, estado: 'PENDIENTE', estadoDTE: 'PENDIENTE',
      periodoRentaInicio: null, periodoRentaFin: null,
      cliente: { ncr: null, actividadEconomica: null },
    } as any)

    await expect(emitirDTE(FACTURA_ID, { tipoDTE: 'FC' })).rejects.toThrow(
      expect.objectContaining({ code: 'PERIODO_RENTA_REQUERIDO', statusCode: 422 })
    )
    expect(facturallaMock.emitirFC).not.toHaveBeenCalled()
  })
```

Y en el test existente `'llama emitirFC para tipoDTE FC'` (~línea 348), agregar al mock de factura:

```typescript
      periodoRentaInicio: new Date('2026-07-01'), periodoRentaFin: new Date('2026-07-15'),
```

(Los demás tests de `emitirDTE` fallan antes por estado o por NCR — no necesitan período; ver Step 3.)

- [ ] **Step 2: Correr los tests y verificar que el nuevo falla**

Run: `pnpm vitest run tests/modules/facturas/facturas.service.test.ts`
Expected: FAIL solo el test nuevo (`emitirDTE` no lanza y llama a `emitirFC`).

- [ ] **Step 3: Implementar la validación**

En `emitirDTE` (`facturas.service.ts`), después del bloque `if (input.tipoDTE === 'CCF') {…}` (~línea 288) y antes del despacho a `emitirFC`/`emitirCCF` — después del chequeo CCF para no cambiar el error que reciben los casos ya testeados de CCF sin datos fiscales:

```typescript
  // El período de renta viaja en las observaciones (comments) del DTE — sin él
  // no se emite. Se importa del acta de entrega o se registra manualmente en
  // el card "Período de renta" del detalle de factura.
  if (!factura.periodoRentaInicio || !factura.periodoRentaFin) {
    throw new AppError(422, 'PERIODO_RENTA_REQUERIDO', 'La factura debe tener el período de renta registrado antes de emitir el DTE')
  }
```

- [ ] **Step 4: Correr la suite completa y el typecheck del backend**

Run: `pnpm vitest run && pnpm tsc --noEmit`
Expected: PASS ambos.

- [ ] **Step 5: Commit**

```bash
git add src/modules/facturas/facturas.service.ts tests/modules/facturas/facturas.service.test.ts
git commit -m "feat(facturas): exigir período de renta registrado para emitir el DTE"
```

---

### Task 4: Frontend — `DteSection` bloquea la emisión sin período

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/dte/DteSection.tsx`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/app/(dashboard)/facturas/[id]/page.tsx` (~línea 188, props de `<DteSection>`)

**Interfaces:**
- Consumes: `factura.periodoRentaInicio` / `factura.periodoRentaFin` (ya existen en `types/api.ts`).
- Produces: prop nueva `faltaPeriodo?: boolean` en `DteSection`. La página de notas de crédito no la pasa (opcional) y no cambia.

- [ ] **Step 1: Agregar la prop y el hint en `DteSection.tsx`**

En `Props` (tras `emisionBloqueada?: boolean;`):

```typescript
  // La factura necesita período de renta registrado para emitir (viaja en las
  // observaciones del DTE). Con true se deshabilitan asignar tipo / emitir /
  // reemitir y se muestra el hint que dirige al card de período. Solo aplica
  // a kind 'factura'.
  faltaPeriodo?: boolean;
```

Dentro de `DteSection`, junto a los otros bloques derivados (después de `anularErrorBlock`):

```tsx
  const hintPeriodo = props.faltaPeriodo ? (
    <p className="mt-3 text-xs text-warn">
      Registrá el período de renta antes de emitir el DTE — usá el card «Período de renta» de esta página.
    </p>
  ) : null;
```

Aplicar en los tres puntos de emisión:

1. **Sección A (sin tipo asignado):** en el botón de tipo, cambiar `disabled={deshabilitado || !isOperador}` por `disabled={deshabilitado || !isOperador || props.faltaPeriodo}`, y renderizar `{hintPeriodo}` inmediatamente después del `<div className="grid …">` de los dos tipos.
2. **Bloque PENDIENTE:** en el botón «Emitir DTE», cambiar `disabled={isEmitiendo}` por `disabled={isEmitiendo || props.faltaPeriodo}`, y renderizar `{hintPeriodo}` justo después del banner de advertencia (`<div className="flex items-center gap-2 bg-warn-soft …">…</div>`).
3. **Bloque RECHAZADO:** en el botón «Corregir y re-emitir», cambiar `disabled={isEmitiendo}` por `disabled={isEmitiendo || props.faltaPeriodo}`, y renderizar `{hintPeriodo}` antes del botón.

- [ ] **Step 2: Pasar la prop desde el detalle de factura**

En `app/(dashboard)/facturas/[id]/page.tsx`, junto a los otros flags derivados (~línea 74):

```typescript
  // Sin período de renta el backend rechaza la emisión (422) — bloqueamos antes.
  const faltaPeriodo = !factura.periodoRentaInicio || !factura.periodoRentaFin;
```

Y en `<DteSection …>` (~línea 188), junto a `emisionBloqueada`:

```tsx
            faltaPeriodo={faltaPeriodo}
```

- [ ] **Step 3: Verificar typecheck y lint del frontend**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit && pnpm lint`
Expected: sin errores.

- [ ] **Step 4: Verificación manual en el navegador**

Con backend (`:3000`) y frontend (`pnpm dev`, `:3001`) corriendo:
1. Abrir una factura **sin** período de renta y estadoDTE PENDIENTE → los botones de tipo/emitir se ven deshabilitados y aparece el hint.
2. Guardar el período en el card «Período de renta» → los botones se habilitan y el hint desaparece.
Expected: ambos comportamientos, también en dark mode.

- [ ] **Step 5: Commit**

```bash
git add components/dte/DteSection.tsx "app/(dashboard)/facturas/[id]/page.tsx"
git commit -m "feat(facturas): bloquear emisión de DTE sin período de renta registrado"
```

---

### Task 5: Verificación final de ambos repos

**Files:** ninguno nuevo — solo verificación.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: ramas listas para PR en ambos repos.

- [ ] **Step 1: Suite y typecheck del backend**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm vitest run && pnpm tsc --noEmit`
Expected: PASS completo.

- [ ] **Step 2: Typecheck del frontend**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Verificación empírica del campo `comments` (manual, con el usuario)**

El campo no está en la doc pública — la prueba real es emitir un DTE de prueba (FC o CCF) contra FacturaLlama y descargar el PDF/JSON oficial: las observaciones deben mostrar `Período de renta: del … al …`. Si FacturaLlama rechazara el campo (400/422), reportarlo antes de mergear. Este paso lo coordina el usuario (necesita el ambiente de pruebas de FacturaLlama).

- [ ] **Step 4: Estado final de git**

Run: `git status` en ambos repos.
Expected: working tree limpio; ramas `feat/dte-comments-periodo-renta` con los commits de las tasks 1-4 (server) y del spec/plan + task 4 (frontend).
