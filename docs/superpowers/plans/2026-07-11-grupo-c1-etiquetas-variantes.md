# Grupo C.1 — Etiquetas de variante en correo y archivos PDF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuando una cotización tiene variantes, el cliente distingue las propuestas: el correo lleva "Opción A/B" en asunto y cuerpo, y los PDFs se descargan como `COT…-A.pdf` / `COT…-B.pdf` sin pisarse.

**Architecture:** Un helper `letraOpcion(numero, tieneVariantes)` (backend + espejo frontend) deriva la letra: sufijo real para variantes, `'A'` para la original con variantes, `null` sin variantes (comportamiento actual intacto). Se aplica en `enviarCotizacion` (asunto, template, adjunto) y en `descargarCotizacionPdf` (filename).

**Tech Stack:** Express + Vitest (server); Next.js (frontend).

**Spec:** `docs/superpowers/specs/2026-07-11-grupo-c1-etiquetas-variantes-design.md`

## Global Constraints

- UI/correos 100 % español; comentarios "why" en español.
- Server suite: **14 fallos pre-existentes** en otros archivos — el conteo no debe aumentar.
- Frontend: `pnpm tsc --noEmit` limpio; `pnpm lint` en baseline **12 errores + 24 warnings**.
- El contenido del PDF NO cambia (número limpio) — solo asunto/cuerpo del correo y nombres de archivo.
- Ramas: `feat/etiquetas-variantes` en AMBOS repos.

---

### Task 1: Backend — `letraOpcion` + etiqueta en `enviarCotizacion`

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/lib/variantes.ts`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/correos/correos.service.ts:142-217` (función `enviarCotizacion`)
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/correos/templates/cotizacion-enviada.hbs:33-34`
- Test: `/Users/joaquinmorales13a06/Desktop/Reinar/server/tests/lib/variantes.test.ts` y `/Users/joaquinmorales13a06/Desktop/Reinar/server/tests/modules/correos/correos.service.test.ts`

**Interfaces:**
- Consumes: `numeroComercial`, `SUFIJO_VARIANTE_REGEX` (existentes en `src/lib/variantes.ts`).
- Produces: `letraOpcion(numero: string, tieneVariantes: boolean): string | null` — Task 2 replica la misma firma en el frontend.

- [ ] **Step 1: Tests del helper (RED)**

En `tests/lib/variantes.test.ts`, agregar:

```ts
import { letraOpcion } from '../../src/lib/variantes'

describe('letraOpcion', () => {
  it('devuelve el sufijo para una variante', () => {
    expect(letraOpcion('COT2607000007-B', true)).toBe('B')
    // Una variante implica que existen variantes; el flag no cambia el resultado
    expect(letraOpcion('COT2607000007-C', false)).toBe('C')
  })

  it('devuelve A para la original cuando tiene variantes', () => {
    expect(letraOpcion('COT2607000007', true)).toBe('A')
  })

  it('devuelve null para la original sin variantes', () => {
    expect(letraOpcion('COT2607000007', false)).toBeNull()
  })
})
```

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && npx vitest run tests/lib/variantes.test.ts`
Expected: FAIL — `letraOpcion` no existe.

- [ ] **Step 2: Implementar el helper (GREEN)**

En `src/lib/variantes.ts`, agregar al final:

```ts
// Letra de opción que ve el cliente cuando un número tiene variantes:
// la variante usa su sufijo (B, C…) y la original es la "A". Sin variantes
// devuelve null — correo y archivos se comportan como siempre.
export function letraOpcion(numero: string, tieneVariantes: boolean): string | null {
  const sufijo = SUFIJO_VARIANTE_REGEX.exec(numero)?.[1]
  if (sufijo) return sufijo
  return tieneVariantes ? 'A' : null
}
```

Run: `npx vitest run tests/lib/variantes.test.ts` — Expected: PASS (7/7 del archivo).

- [ ] **Step 3: Aplicar en `enviarCotizacion`**

En `correos.service.ts`:

(a) Ampliar el import existente de variantes:

```ts
import { numeroComercial, letraOpcion } from '../../lib/variantes'
```

(b) Después del `if (!cot) return` (línea ~173), calcular la letra:

```ts
    // Con variantes, el cliente recibe varias propuestas con el mismo número;
    // la "Opción A/B" en asunto/cuerpo/adjunto le permite distinguirlas.
    const base = numeroComercial(cot.numeroCotizacion)
    const hermanas = await prisma.cotizacion.count({
      where: {
        numeroCotizacion: { not: cot.numeroCotizacion },
        OR: [
          { numeroCotizacion: base },
          { numeroCotizacion: { startsWith: `${base}-` } },
        ],
      },
    })
    const letra = letraOpcion(cot.numeroCotizacion, hermanas > 0)
    const etiquetaOpcion = letra ? ` (Opción ${letra})` : ''
```

(c) Reemplazar la línea del asunto (~177):

```ts
    const asunto = `Cotización ${base}${etiquetaOpcion} — Reinar S.A. de C.V.`
```

(d) En el `compilar('cotizacion-enviada.hbs', { ... })`, la var `numeroCotizacion` pasa a usar `base` (equivalente a lo actual) y se agrega la letra:

```ts
        numeroCotizacion: base,
        letraOpcion: letra,
```

(e) Reemplazar el filename del adjunto (~211):

```ts
      adjuntos: [{ filename: `${base}${letra ? `-${letra}` : ''}.pdf`, content: pdf }],
```

- [ ] **Step 4: Línea condicional en el template**

En `templates/cotizacion-enviada.hbs`, después de la línea 33 (`<p>Estimado/a <strong>{{clienteNombre}}</strong>,</p>`):

```hbs
      {{#if letraOpcion}}
      <p><strong>Esta es la Opción {{letraOpcion}}</strong> de su cotización {{numeroCotizacion}}.</p>
      {{/if}}
```

- [ ] **Step 5: Test de `enviarCotizacion` con variantes**

En `tests/modules/correos/correos.service.test.ts` (el archivo ya existe — REUTILIZAR su setup de mocks de prisma/mailer/PDF tal cual está; leerlo antes de escribir), agregar un test al describe de `enviarCotizacion` (o crear uno si no existe):

```ts
  it('etiqueta Opción B en asunto y filename cuando el número tiene variantes', async () => {
    // Arrange siguiendo el patrón de mocks del archivo: cotización '-B' con
    // cliente/email/items mínimos, PDF mockeado, y count de hermanas = 1.
    // (cotizacion.findUnique → fixture con numeroCotizacion 'COT2607000007-B';
    //  cotizacion.count → 1)
    await correosService.enviarCotizacion('cot-1')

    const llamada = vi.mocked(mailerSendReference).mock.calls[0][0]
    expect(llamada.subject).toContain('Cotización COT2607000007 (Opción B)')
    expect(llamada.attachments[0].filename).toBe('COT2607000007-B.pdf')
  })

  it('sin variantes: asunto y filename sin etiqueta', async () => {
    // cotizacion.findUnique → 'COT2607000008' sin sufijo; cotizacion.count → 0
    await correosService.enviarCotizacion('cot-2')

    const llamada = vi.mocked(mailerSendReference).mock.calls.at(-1)![0]
    expect(llamada.subject).toBe('Cotización COT2607000008 — Reinar S.A. de C.V.')
    expect(llamada.attachments[0].filename).toBe('COT2607000008.pdf')
  })
```

Nota: `mailerSendReference` es el mock que el archivo ya usa para `mailer.sendMail` (o el spy sobre `send` interno) — adaptar los nombres del arrange al setup real del archivo; las ASERCIONES (subject y filename esperados) son las de arriba, literales. Si `cotizacion.count` no está en el mock de prisma del archivo, agregar `count: vi.fn()` al bloque del mock.

- [ ] **Step 6: Suite completa + tipos**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm test && npx tsc --noEmit`
Expected: tests nuevos PASS, fallos totales = 14 pre-existentes, tsc limpio.

- [ ] **Step 7: Commit (repo server)**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/lib/variantes.ts src/modules/correos/correos.service.ts src/modules/correos/templates/cotizacion-enviada.hbs tests/lib/variantes.test.ts tests/modules/correos/correos.service.test.ts
git commit -m "feat(correos): etiqueta 'Opción A/B' en correo de cotización con variantes; adjunto con sufijo

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Frontend — letra de opción en el nombre del PDF descargado

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/lib/utils.ts` (junto a `numeroComercial`)
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/hooks/use-cotizaciones.ts` (función `descargarCotizacionPdf`)
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/cotizaciones/detalle/AccionesEstado.tsx:145`

**Interfaces:**
- Consumes: `Cotizacion.variantes` (existente); `numeroComercial` de `lib/utils.ts`.
- Produces: `letraOpcion(numero: string, tieneVariantes: boolean): string | null` en `lib/utils.ts`; `descargarCotizacionPdf(id: string, numero: string, letra?: string | null)`.

- [ ] **Step 1: Helper espejo en `lib/utils.ts`**

Agregar después de `numeroComercial`:

```ts
// Letra de opción cuando el número tiene variantes: sufijo para variantes,
// 'A' para la original con variantes, null sin variantes. Espejo del helper
// del backend (server/src/lib/variantes.ts).
export function letraOpcion(numero: string, tieneVariantes: boolean): string | null {
  const sufijo = /-([B-Z])$/.exec(numero)?.[1];
  if (sufijo) return sufijo;
  return tieneVariantes ? 'A' : null;
}
```

- [ ] **Step 2: Firma nueva de `descargarCotizacionPdf`**

En `hooks/use-cotizaciones.ts`, cambiar la firma y el filename:

```ts
export async function descargarCotizacionPdf(id: string, numero: string, letra?: string | null) {
```

y la línea del download:

```ts
    a.download = `${numeroComercial(numero)}${letra ? `-${letra}` : ''}.pdf`;
```

(El parámetro es opcional: el caller de la tabla — que no tiene `variantes` a mano — no lo pasa y conserva el comportamiento actual.)

- [ ] **Step 3: El detalle pasa la letra**

En `AccionesEstado.tsx` línea ~145, reemplazar el onClick de descarga:

```tsx
        onClick={() =>
          void descargarCotizacionPdf(
            cotizacion.id,
            cotizacion.numeroCotizacion,
            letraOpcion(cotizacion.numeroCotizacion, (cotizacion.variantes ?? []).length > 0),
          )
        }
```

e importar `letraOpcion` desde `@/lib/utils` (junto a los imports existentes).

`CotizacionesTabla.tsx` NO cambia (no tiene `variantes`; pasa sin letra).

- [ ] **Step 4: Verificar tipos y lint**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit && pnpm lint 2>&1 | tail -1`
Expected: tsc limpio; `✖ 36 problems (12 errors, 24 warnings)`.

- [ ] **Step 5: Verificación manual**

Con el stack corriendo: en una cotización CON variantes, descargar el PDF desde el detalle de la original (archivo `COT…-A.pdf`) y de una variante (`COT…-B.pdf`); en una cotización sin variantes, archivo sin sufijo.

- [ ] **Step 6: Commit (repo frontend)**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add lib/utils.ts hooks/use-cotizaciones.ts components/cotizaciones/detalle/AccionesEstado.tsx
git commit -m "feat(cotizaciones): letra de opción (-A/-B) en el nombre del PDF descargado con variantes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Verificación final

- [ ] Server: `pnpm test` (14 pre-existentes) + `npx tsc --noEmit`.
- [ ] Frontend: tsc + lint baseline.
- [ ] Manual: enviar cotización original y variante por correo → asuntos "(Opción A)"/"(Opción B)", cuerpos con la línea, adjuntos `-A.pdf`/`-B.pdf`; cotización sin variantes → correo idéntico al actual.
