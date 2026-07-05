# Factura a nombre de tercero + consecutivo de acta en PDF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar el/los número(s) de acta de entrega en el PDF de factura, y permitir emitir la factura (y su DTE) a nombre de un tercero: cualquier Cliente registrado, que pasa a ser el receptor/dueño de la factura.

**Architecture:** Dos features independientes. (A) PDF: agregar `actasEntrega` al include de `generarFacturaPDF` y un bloque en `factura.hbs`. (B) Tercero: `factura.clienteId` deja de copiarse rígido de la cotización y toma un `receptorClienteId` opcional (default = cliente de la cotización); como todo el sistema ya lee `factura.cliente`, el DTE/validación/PDF/AR apuntan al tercero sin más cambios ni migración.

**Tech Stack:** Backend Express + Prisma + Zod + vitest en `/Users/joaquinmorales13a06/Desktop/Reinar/server`. Frontend Next.js + RHF/Zod + Tailwind en `/Users/joaquinmorales13a06/Desktop/Reinar/frontend`.

**Spec:** `docs/superpowers/specs/2026-07-05-factura-tercero-y-acta-pdf-design.md`

## Global Constraints

- **Ramas:** `feat/factura-tercero-y-acta-pdf` en AMBOS repos. El frontend ya está en esa rama (spec commiteado); el server se crea en Task 1. BE base: `main`.
- **Sin migración de BD** (Sección B reutiliza `factura.clienteId`; Sección A no toca schema).
- **Sección B: NO tocar FacturaLlama (`facturallama.service.ts`) ni `emitirDTE`** — ya leen `factura.cliente`, que ahora es el receptor. Cambiarlos sería un error.
- **UI 100% español.** Comentarios "why" en español. Tailwind sin valores arbitrarios.
- **Backend TDD** con vitest. **Baseline de fallos pre-existentes en main: 14** (reservas/RESERVADA, setPeriodosRenta, pdf rangoRenta) — ajenos. Gate = "mis tests pasan + sin fallos nuevos".
- **Frontend sin suite de tests** — verificación = `pnpm tsc --noEmit` + `pnpm lint`.
- **Verificación backend:** `npx tsc --noEmit` + `pnpm test`.
- **Commits** en español, terminando con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

## SECCIÓN A — Consecutivo del acta en el PDF de factura

### Task 1: Actas en el contexto y el template del PDF de factura

**Files:**
- Modify: `src/modules/pdf/pdf.service.ts:372-397` (include), `:405-427` (contexto `factura`)
- Modify: `src/modules/pdf/templates/factura.hbs:450-455` (bloque Cotización origen)
- Test: `tests/modules/pdf/pdf.service.test.ts`

**Interfaces:**
- Produces: `context.factura.numerosActa: string` en `generarFacturaPDF`.

- [ ] **Step 1: Crear la rama en el server**

```bash
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server checkout main
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server pull
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server checkout -b feat/factura-tercero-y-acta-pdf
```

- [ ] **Step 2: Escribir el test que falla**

En `tests/modules/pdf/pdf.service.test.ts` (seguir el patrón de mocks del archivo — mockea `prisma.factura.findUniqueOrThrow` y renderiza el contexto). Si el test del archivo captura el HTML renderizado (`page.setContent`), agregá un caso; si captura el contexto, asertá `numerosActa`. Ejemplo de aserción sobre el fixture (adaptar al patrón real del archivo — el fixture de factura debe incluir `actasEntrega: [{ numeroActa: 'ACT2607000001' }, { numeroActa: 'ACT2607000002' }]`):

```typescript
it('incluye los números de acta en el PDF de factura', async () => {
  // fixture factura con actasEntrega: [{numeroActa:'ACT2607000001'},{numeroActa:'ACT2607000002'}]
  const html = await capturarHtmlFacturaPDF(/* fixture */)
  expect(html).toContain('Acta(s) de entrega')
  expect(html).toContain('ACT2607000001, ACT2607000002')
})
```

Si el archivo no tiene un helper que capture el HTML, seguí el patrón existente de los tests de `generarFacturaPDF` (por ejemplo asertando sobre `page.setContent.mock.calls[0][0]`).

- [ ] **Step 3: Correr y verificar FAIL**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm test tests/modules/pdf/pdf.service.test.ts
```
Expected: FAIL — el include no trae actas y el template no renderiza el bloque.

- [ ] **Step 4: Agregar `actasEntrega` al include**

En `pdf.service.ts`, dentro del `include` de `generarFacturaPDF` (líneas 376-393), agregar tras `pagos: { orderBy: { fecha: 'asc' } },`:

```typescript
        actasEntrega: { select: { numeroActa: true }, orderBy: { numeroActa: 'asc' } },
```

- [ ] **Step 5: Mapear al contexto**

En el objeto `context.factura` (líneas 405-427), agregar tras `numeroCotizacion: factura.cotizacion.numeroCotizacion,`:

```typescript
      // Consecutivo(s) de acta de entrega (folio interno) — puede haber varias por factura.
      numerosActa: factura.actasEntrega.map((a) => a.numeroActa).join(', '),
```

- [ ] **Step 6: Agregar el bloque en `factura.hbs`**

En `templates/factura.hbs`, tras el `{{#if factura.numeroCotizacion}}…{{/if}}` de "Cotización origen" (líneas 450-455), agregar un `cond-item` para las actas:

```hbs
      {{#if factura.numerosActa}}
      <div class="cond-item">
        <div class="party-label">Acta(s) de entrega</div>
        <div class="cond-val mono">{{factura.numerosActa}}</div>
      </div>
      {{/if}}
```

- [ ] **Step 7: GREEN + typecheck**

```bash
pnpm test tests/modules/pdf/ && npx tsc --noEmit
```
Expected: PASS; tsc limpio. Si el fixture de `pdf.service.test.ts` de otros tests no tenía `actasEntrega`, agregá `actasEntrega: []` a esos fixtures para que `.map` no falle.

- [ ] **Step 8: Commit**

```bash
git add src/modules/pdf/ tests/modules/pdf/
git commit -m "feat(pdf): consecutivo del acta de entrega en el PDF de factura

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## SECCIÓN B — Factura a nombre de un tercero

### Task 2: Receptor override en la generación de factura (backend)

**Files:**
- Modify: `src/modules/facturas/facturas.schemas.ts` (`generarFacturaSchema`)
- Modify: `src/modules/facturas/facturas.service.ts:463-510` (`generarFacturaDesdeCotizacion`)
- Test: `tests/modules/facturas/facturas.service.test.ts`

**Interfaces:**
- Produces: `generarFacturaSchema` acepta `receptorClienteId?: string (cuid)`. `generarFacturaDesdeCotizacion` usa `input.receptorClienteId ?? cotizacion.clienteId` como `clienteId` de la factura, validando que el receptor exista y esté ACTIVO. Task 3 (frontend) consume este contrato.

- [ ] **Step 1: Escribir los tests que fallan**

En `tests/modules/facturas/facturas.service.test.ts`, en el `describe('generarFacturaDesdeCotizacion')` (ampliar los mocks: agregar `cliente: { findUnique: vi.fn() }` al mock de prisma si no está):

```typescript
  it('usa el cliente de la cotización cuando no se pasa receptorClienteId', async () => {
    // cotizacion.findUnique → { estado:'APROBADA', clienteId:'cli-cot', factura:null, cliente:{diasRecepcionQuedan:[]}, subtotal/… }
    await generarFacturaDesdeCotizacion(COT_ID, { tipoDTE:'FC', condicionPago:'CONTADO', esQuedan:false } as any, USUARIO_ID)
    const data = prismaMock.factura.create.mock.calls[0][0].data
    expect(data.clienteId).toBe('cli-cot')
  })

  it('usa el receptor (tercero) cuando se pasa receptorClienteId ACTIVO', async () => {
    prismaMock.cliente.findUnique.mockResolvedValue({ id: 'cli-tercero', estado: 'ACTIVO' } as any)
    await generarFacturaDesdeCotizacion(COT_ID, { tipoDTE:'FC', condicionPago:'CONTADO', esQuedan:false, receptorClienteId:'cli-tercero' } as any, USUARIO_ID)
    const data = prismaMock.factura.create.mock.calls[0][0].data
    expect(data.clienteId).toBe('cli-tercero')
  })

  it('rechaza receptorClienteId inexistente', async () => {
    prismaMock.cliente.findUnique.mockResolvedValue(null)
    await expect(
      generarFacturaDesdeCotizacion(COT_ID, { tipoDTE:'FC', condicionPago:'CONTADO', esQuedan:false, receptorClienteId:'no-existe' } as any, USUARIO_ID),
    ).rejects.toThrow(expect.objectContaining({ code: 'NOT_FOUND' }))
  })

  it('rechaza receptorClienteId INACTIVO', async () => {
    prismaMock.cliente.findUnique.mockResolvedValue({ id: 'cli-x', estado: 'INACTIVO' } as any)
    await expect(
      generarFacturaDesdeCotizacion(COT_ID, { tipoDTE:'FC', condicionPago:'CONTADO', esQuedan:false, receptorClienteId:'cli-x' } as any, USUARIO_ID),
    ).rejects.toThrow(expect.objectContaining({ code: 'ESTADO_INVALIDO' }))
  })
```

(Reutilizá los fixtures/constantes de cotización ya presentes en el `describe`; el mock de `cotizacion.findUnique` debe traer `clienteId`.)

- [ ] **Step 2: RED**

```bash
pnpm test tests/modules/facturas/facturas.service.test.ts
```
Expected: FAIL — el schema no conoce `receptorClienteId` y el service siempre usa `cotizacion.clienteId`.

- [ ] **Step 3: Schema**

En `facturas.schemas.ts`, dentro de `generarFacturaSchema` (el `z.object`), agregar el campo (junto a `contactoFacturacionId`):

```typescript
  // Receptor fiscal de la factura. Si se omite, es el cliente de la cotización.
  // Permite facturar a un tercero (otro Cliente registrado).
  receptorClienteId:     z.string().cuid().optional(),
```

- [ ] **Step 4: Service**

En `generarFacturaDesdeCotizacion` (facturas.service.ts), tras las validaciones de la cotización (después del `if (cotizacion.factura) …`, línea 479) y antes de `generarNumero`:

```typescript
    // Receptor de la factura: por defecto el cliente de la cotización, pero puede
    // ser un tercero (otro Cliente registrado y ACTIVO). Todo el sistema (DTE,
    // validación, PDF, cuentas por cobrar) ya lee factura.cliente, así que con
    // setear clienteId al receptor basta.
    let clienteId = cotizacion.clienteId
    if (input.receptorClienteId && input.receptorClienteId !== cotizacion.clienteId) {
      const receptor = await tx.cliente.findUnique({
        where: { id: input.receptorClienteId },
        select: { id: true, estado: true },
      })
      if (!receptor) throw new AppError(404, 'NOT_FOUND', 'El cliente receptor no existe')
      if (receptor.estado !== 'ACTIVO') throw new AppError(422, 'ESTADO_INVALIDO', 'El cliente receptor no está activo')
      clienteId = receptor.id
    }
```

Reemplazar `clienteId: cotizacion.clienteId,` (línea 494) por `clienteId,`.

En el `auditLog.create` `camposDespues` (líneas 518-524), agregar para trazabilidad cuando difiere:

```typescript
          ...(clienteId !== cotizacion.clienteId && { facturadoATercero: clienteId }),
```

Además, para que el detalle pueda mostrar el solicitante (Task 3), ampliar el `include` de `obtenerFactura` (`facturas.service.ts:100-117`): la `cotizacion` ya se incluye con `items`; agregarle `cliente: { select: { id: true, tipo: true, razonSocial: true, nombre: true, apellido: true } }`. Verificá con un test o inspección que `obtenerFactura` devuelve `factura.cotizacion.cliente`.

- [ ] **Step 5: GREEN + typecheck**

```bash
pnpm test tests/modules/facturas/ && npx tsc --noEmit
```
Expected: los 4 tests nuevos PASAN; los preexistentes de `generarFacturaDesdeCotizacion` siguen pasando; tsc limpio. (No se toca `facturallama.service.ts` ni `emitirDTE`.)

- [ ] **Step 6: Commit**

```bash
git add src/modules/facturas/ tests/modules/facturas/
git commit -m "feat(facturas): permitir facturar a un tercero (receptor = otro cliente)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Selector de tercero en el modal + solicitante en el detalle (frontend)

**Files:**
- Modify: `hooks/use-facturas.ts` (`GenerarFacturaInput`)
- Modify: `components/cotizaciones/GenerarFacturaModal.tsx`
- Modify: `components/facturas/detalle/ClienteFechasCard.tsx`
- Create (si hace falta): `components/facturas/SelectorClienteReceptor.tsx` (o reusar un typeahead de clientes existente)

**Interfaces:**
- Consumes: `generarFacturaSchema.receptorClienteId` (Task 2); `factura.cotizacion.cliente` (ya en el tipo `Factura`).

- [ ] **Step 1: Tipo del input**

En `hooks/use-facturas.ts`, en `GenerarFacturaInput`, agregar:

```typescript
  // Receptor fiscal de la factura; se envía solo cuando difiere del cliente de la cotización.
  receptorClienteId?: string;
```

- [ ] **Step 2: Selector de cliente receptor**

Crear `components/facturas/SelectorClienteReceptor.tsx` — un typeahead sobre `useClientes({ estado: 'ACTIVO', limit: 100 })`, espejando `components/actas-recepciones/SelectorCotizacion.tsx` (mismo patrón: input de búsqueda por nombre/documento, lista filtrada client-side, `value`/`onChange(clienteId)`). Muestra el nombre según `tipo` (EMPRESA → razonSocial; PARTICULAR → nombre+apellido).

- [ ] **Step 3: Integrar en `GenerarFacturaModal`**

En `components/cotizaciones/GenerarFacturaModal.tsx`:
- Estado: `const [receptorClienteId, setReceptorClienteId] = useState<string | null>(null);` (null = usar el cliente de la cotización).
- Un bloque opcional "Facturar a un tercero (opcional)": por defecto un texto "Se factura a: <cliente de la cotización>" con un toggle/botón "Cambiar receptor" que muestra el `<SelectorClienteReceptor>`. Cuando se elige un cliente distinto, mostrar un aviso: "El DTE y las cuentas por cobrar se emitirán a nombre de este tercero."
- En el submit (`generar.mutate({...})`), incluir `receptorClienteId` **solo cuando** `receptorClienteId && receptorClienteId !== cliente.id`.
- Tailwind sin arbitrarios; comentarios "why" en español.

(La prop `cliente` del modal es el cliente de la cotización — sirve como default y para el texto.)

- [ ] **Step 4: Detalle — mostrar solicitante cuando difiere**

El backend `obtenerFactura` ya devuelve `factura.cotizacion.cliente` (agregado en Task 2). Ampliar el tipo `Factura.cotizacion` en `types/api.ts` para incluir `cliente: { id: string; tipo: 'EMPRESA' | 'PARTICULAR'; razonSocial: string | null; nombre: string | null; apellido: string | null }`. En `components/facturas/detalle/ClienteFechasCard.tsx`: el "Cliente" actual es `factura.cliente` (el receptor). Cuando `factura.clienteId !== factura.cotizacion.cliente.id`, agregar una fila "Cotización solicitada por" con el nombre del cliente de la cotización (link a `/clientes/<id>`).

- [ ] **Step 5: Typecheck + lint**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm tsc --noEmit && pnpm lint
```
Expected: 0 errores de tsc; lint sin issues nuevos.

- [ ] **Step 6: Commit**

```bash
git add hooks/use-facturas.ts components/ types/api.ts
git commit -m "feat(facturas): selector de tercero al generar factura; solicitante en el detalle

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(Si tocaste el backend `obtenerFactura` para incluir `cotizacion.cliente`, commitealo en el repo server por separado con un mensaje `feat(facturas): incluir cliente de la cotización en el detalle`.)

---

### Task 4: Verificación end-to-end, push y PRs

**Files:** ninguno nuevo.

- [ ] **Step 1: Verificación estática final**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm test && npx tsc --noEmit
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit && pnpm lint
```
Expected: server tsc limpio; `pnpm test` sin fallos nuevos más allá del baseline de 14; frontend tsc 0, lint sin issues nuevos.

- [ ] **Step 2: Prueba manual end-to-end (backend :3000, frontend :3001)**

1. **Consecutivo de acta:** una factura con actas vinculadas → su PDF muestra "Acta(s) de entrega" con el/los número(s) junto a "Cotización origen".
2. **Factura a tercero:** aprobar una cotización → generar factura eligiendo OTRO cliente como receptor → verificar: el detalle muestra "Facturada a: <tercero>" y "Cotización solicitada por: <cliente cotización>"; el PDF ("Facturar a") y el DTE (emitir en sandbox) usan los datos del tercero; la factura aparece en el listado/cuentas por cobrar bajo el tercero.
3. **Regresión:** generar una factura sin elegir tercero → todo idéntico a hoy (receptor = cliente de la cotización).
4. **Validación:** intentar un receptor INACTIVO → error claro.

- [ ] **Step 3: Push y PRs**

```bash
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server push -u origin feat/factura-tercero-y-acta-pdf
git -C /Users/joaquinmorales13a06/Desktop/Reinar/frontend push -u origin feat/factura-tercero-y-acta-pdf
```

Crear los PRs con `gh pr create` (título: `feat(facturas): factura a nombre de tercero + consecutivo de acta en PDF`), cuerpo con resumen del spec (las dos secciones) y checklist, terminando con:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

**Orden de merge:** server primero, luego frontend.
