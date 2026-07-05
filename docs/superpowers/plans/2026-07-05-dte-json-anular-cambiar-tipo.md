# Quick wins DTE: botón JSON + anular DTE para cambiar tipo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un botón de descarga del JSON del DTE en la card del detalle de factura, y una acción no destructiva "Anular DTE y cambiar tipo" que invalida el DTE en el MH y deja la factura lista para re-emitir con otro tipo.

**Architecture:** El backend endurece `invalidarDTE` para que un rechazo del MH lance (hoy no lo hace en 422), y reescribe `anularDTE` (DELETE `/:id/dte`) para resetear la factura a estado pre-emisión en vez de dejarla ANULADO. El frontend cablea la descarga JSON (ya existente) y una nueva acción de anular-para-cambiar-tipo en `DteSection`, y renombra el botón destructivo actual a "Anular factura".

**Tech Stack:** Backend Express + Prisma + Zod + vitest en `/Users/joaquinmorales13a06/Desktop/Reinar/server`. Frontend Next.js App Router + TanStack Query + Tailwind en `/Users/joaquinmorales13a06/Desktop/Reinar/frontend`.

**Spec:** `docs/superpowers/specs/2026-07-05-dte-json-anular-cambiar-tipo-design.md`

## Global Constraints

- **Ramas:** `feat/dte-json-anular-cambiar-tipo` en AMBOS repos. El frontend ya está en esa rama (spec commiteado); el server se crea en Task 1.
- **Sin migración de BD** en este grupo.
- **UI 100% en español.** Comentarios solo "why", en español.
- **Tailwind:** solo clases predefinidas; sin valores arbitrarios; sin CSS vanilla.
- **Mutations frontend:** `toast.success`/`toast.error`; errores de red del backend con `extractErrorMessage`. El error del MH al anular se muestra **inline** en la card (no solo toast).
- **Roles:** anular (ambas variantes) = solo ADMIN. Botón JSON = todos los que ven el detalle (igual que el PDF oficial). VISUALIZADOR no ve acciones de escritura.
- **Backend TDD** con vitest (`pnpm test`). **Baseline de fallos pre-existentes en main: 14** (reservas/RESERVADA, `setPeriodosRenta`/`periodos-renta`, pdf `rangoRenta`) — ajenos a este trabajo. Gate = "mis tests pasan + sin fallos NUEVOS más allá de ese set".
- **Frontend sin suite de tests** — verificación = `pnpm tsc --noEmit` + `pnpm lint`.
- **Verificación backend:** `npx tsc --noEmit` + `pnpm test`.
- **Commits** en español estilo `feat(...)`/`fix(...)`, terminando con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

## PARTE 1 — BACKEND (`/Users/joaquinmorales13a06/Desktop/Reinar/server`)

### Task 1: Endurecer `invalidarDTE` para lanzar ante un rechazo del MH

**Files:**
- Modify: `src/modules/facturallama/facturallama.service.ts:569-575` (`invalidarDTE`)
- Test: `tests/modules/facturallama/facturallama.service.test.ts`

**Interfaces:**
- Produces: `invalidarDTE(dteId, motivo)` resuelve solo si el MH devuelve `status === 'INVALIDATED'`; en cualquier otro caso (HTTP 422, o body con `status` distinto de `INVALIDATED`) lanza `AppError(422, 'DTE_INVALIDACION_RECHAZADA', <mensaje MH>)`. Task 2 depende de este comportamiento.

- [ ] **Step 1: Crear la rama en el server**

```bash
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server checkout main
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server pull
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server checkout -b feat/dte-json-anular-cambiar-tipo
```

- [ ] **Step 2: Escribir los tests que fallan**

En `tests/modules/facturallama/facturallama.service.test.ts`, seguir el patrón de mock de `fetch` que ya usa el archivo (leerlo primero — el mock global de `fetch` se configura al tope). Importar `invalidarDTE` del service y agregar:

```typescript
describe('invalidarDTE', () => {
  it('resuelve cuando el MH devuelve INVALIDATED', async () => {
    mockFetchOnce(200, { status: 'INVALIDATED' })
    await expect(invalidarDTE('dte-1', 'Cambio de tipo a solicitud del cliente')).resolves.toBeUndefined()
  })

  it('lanza cuando el MH responde 422 (p. ej. DTE de más de 3 días)', async () => {
    mockFetchOnce(422, { status: 'REJECTED', mhResponse: { data: { descripcionMsg: 'Fuera del plazo de anulación' } } })
    await expect(invalidarDTE('dte-1', 'motivo suficientemente largo')).rejects.toThrow(
      expect.objectContaining({ code: 'DTE_INVALIDACION_RECHAZADA', statusCode: 422 }),
    )
  })

  it('lanza cuando el body no es INVALIDATED aunque el HTTP sea 200', async () => {
    mockFetchOnce(200, { status: 'REJECTED', message: 'no se pudo anular' })
    await expect(invalidarDTE('dte-1', 'motivo suficientemente largo')).rejects.toThrow(
      expect.objectContaining({ code: 'DTE_INVALIDACION_RECHAZADA' }),
    )
  })
})
```

Adaptá `mockFetchOnce(status, body)` al helper real del archivo (si no existe uno con ese nombre, replicá el patrón que usan los tests de emisión existentes para mockear `fetch` con `{ ok, status, json }`). El `json()` debe devolver `body`.

- [ ] **Step 3: Correr y verificar FAIL**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm test tests/modules/facturallama/facturallama.service.test.ts
```
Expected: los 3 tests nuevos FALLAN (hoy `invalidarDTE` no valida la respuesta y resuelve siempre).

- [ ] **Step 4: Implementar el endurecimiento**

En `facturallama.service.ts`, reemplazar `invalidarDTE` (líneas 569-575) por:

```typescript
export async function invalidarDTE(dteId: string, motivo: string): Promise<void> {
  const payload: PayloadInvalidar = { dteId, reason: motivo }
  // facturaLlamaFetch NO lanza en 422 (las emisiones lo tratan como RECHAZADO),
  // así que validamos explícitamente: la invalidación solo es exitosa si el MH
  // devuelve status INVALIDATED. Cualquier otra cosa (422 por >3 días, REJECTED)
  // debe lanzar para que el llamador NO resetee la factura sobre una anulación fallida.
  const { status, data } = await facturaLlamaFetch<RespuestaEmisionDTE>('/dte/invalidate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (status === 422 || data.status !== 'INVALIDATED') {
    const detalle =
      data.mhResponse?.data?.descripcionMsg ??
      (data as { message?: string }).message ??
      'El Ministerio de Hacienda rechazó la anulación del DTE'
    throw new AppError(422, 'DTE_INVALIDACION_RECHAZADA', String(detalle))
  }
}
```

`RespuestaEmisionDTE` y `AppError` ya están importados en el archivo (los usa `consultarEstadoDTE` y otros). Si `mhResponse` no está tipado con `.data.descripcionMsg`, castear con `(data.mhResponse as any)?.data?.descripcionMsg`.

- [ ] **Step 5: Correr tests y typecheck**

```bash
pnpm test tests/modules/facturallama/facturallama.service.test.ts && npx tsc --noEmit
```
Expected: los 3 tests nuevos PASAN; los demás de la suite siguen igual; tsc limpio.

- [ ] **Step 6: Commit**

```bash
git add src/modules/facturallama/ tests/modules/facturallama/
git commit -m "fix(dte): invalidarDTE lanza si el MH rechaza la anulación (no solo en no-2xx)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Reescribir `anularDTE` — reset a pre-emisión + motivo

**Files:**
- Modify: `src/modules/facturas/facturas.schemas.ts` (nuevo `anularDTESchema`)
- Modify: `src/modules/facturas/facturas.service.ts:331-356` (`anularDTE`)
- Modify: `src/modules/facturas/facturas.controller.ts:65-70` (`anularDTE`)
- Modify: `src/modules/facturas/facturas.routes.ts:37` (validate) y su import de schemas
- Test: `tests/modules/facturas/facturas.service.test.ts` (`describe('anularDTE')`)

**Interfaces:**
- Consumes: `invalidarDTE` (Task 1) que ahora lanza si el MH rechaza.
- Produces: `anularDTE(id, motivo, usuarioId)` — invalida en el MH y resetea la factura (`estadoDTE→PENDIENTE`, `tipoDTE→null`, `dteId→null`, `dteControlNumber→null`, `dteRespuestaMH→JsonNull`), con auditLog capturando los datos anulados. `DELETE /facturas/:id/dte` valida `{ motivo: string(min 10) }`. Task 4 (frontend) consume este contrato.

- [ ] **Step 1: Actualizar los tests existentes + agregar el de reset (RED)**

En `tests/modules/facturas/facturas.service.test.ts`, en el `describe('anularDTE', …)` (actualmente 3 tests):

1. Los 3 tests llaman `anularDTE(FACTURA_ID, USUARIO_ID)` → cambiar a `anularDTE(FACTURA_ID, 'Cambio de tipo a solicitud del cliente', USUARIO_ID)`.
2. En el primer test ("llama invalidarDTE y actualiza…"), cambiar las aserciones:

```typescript
  it('invalida en el MH con el motivo y resetea la factura a pre-emisión', async () => {
    prismaMock.factura.findUnique.mockResolvedValue({
      id: FACTURA_ID, estadoDTE: 'APROBADO', dteId: 'dte-uuid-1',
      dteControlNumber: 'DTE-CTRL-1', tipoDTE: 'FC',
    } as any)
    facturallaMock.invalidarDTE.mockResolvedValue(undefined as any)
    prismaMock.factura.update.mockResolvedValue({} as any)
    prismaMock.auditLog.create.mockResolvedValue({} as any)

    await anularDTE(FACTURA_ID, 'Cambio de tipo a solicitud del cliente', USUARIO_ID)

    expect(facturallaMock.invalidarDTE).toHaveBeenCalledWith('dte-uuid-1', 'Cambio de tipo a solicitud del cliente')
    expect(prismaMock.factura.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estadoDTE: 'PENDIENTE', tipoDTE: null, dteId: null, dteControlNumber: null,
        }),
      }),
    )
    // audit log captura los datos del DTE anulado
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accion: 'ANULAR_DTE',
          camposDespues: expect.objectContaining({
            motivo: 'Cambio de tipo a solicitud del cliente',
            dteIdAnulado: 'dte-uuid-1',
            tipoDTEAnulado: 'FC',
          }),
        }),
      }),
    )
  })

  it('no resetea la factura si el MH rechaza la invalidación', async () => {
    prismaMock.factura.findUnique.mockResolvedValue({
      id: FACTURA_ID, estadoDTE: 'APROBADO', dteId: 'dte-uuid-1',
      dteControlNumber: 'DTE-CTRL-1', tipoDTE: 'FC',
    } as any)
    facturallaMock.invalidarDTE.mockRejectedValue(
      new AppError(422, 'DTE_INVALIDACION_RECHAZADA', 'Fuera del plazo'),
    )

    await expect(
      anularDTE(FACTURA_ID, 'Cambio de tipo a solicitud del cliente', USUARIO_ID),
    ).rejects.toThrow(expect.objectContaining({ code: 'DTE_INVALIDACION_RECHAZADA' }))
    expect(prismaMock.factura.update).not.toHaveBeenCalled()
  })
```

3. Los otros 2 tests (ESTADO_INVALIDO, NOT_FOUND) solo cambian la llamada para pasar el motivo; sus aserciones se mantienen.

- [ ] **Step 2: Correr y verificar FAIL**

```bash
pnpm test tests/modules/facturas/facturas.service.test.ts
```
Expected: los tests de anularDTE FALLAN (firma vieja / comportamiento viejo). Recordá: los ~8 fallos de `setPeriodosRenta` en este archivo son pre-existentes, no los toques.

- [ ] **Step 3: Implementar el schema**

En `src/modules/facturas/facturas.schemas.ts`, agregar al final:

```typescript
// ── Anular DTE (solo el documento, para re-emitir con otro tipo) ─────────────────
export const anularDTESchema = z.object({
  motivo: z.string().trim().min(10, 'El motivo debe tener al menos 10 caracteres'),
})
export type AnularDTEInput = z.infer<typeof anularDTESchema>
```

- [ ] **Step 4: Implementar el service**

En `facturas.service.ts`, reemplazar `anularDTE` (líneas 331-356) por:

```typescript
export async function anularDTE(id: string, motivo: string, usuarioId: string): Promise<void> {
  const factura = await prisma.factura.findUnique({
    where: { id },
    select: { id: true, estadoDTE: true, dteId: true, dteControlNumber: true, tipoDTE: true },
  })
  if (!factura) throw new AppError(404, 'NOT_FOUND', 'Factura no encontrada')
  if (factura.estadoDTE !== 'APROBADO') {
    throw new AppError(422, 'ESTADO_INVALIDO', 'Solo se puede anular un DTE aprobado')
  }

  // La invalidación en el MH va fuera de la transacción: si el MH rechaza (p. ej.
  // DTE de más de 3 días), invalidarDTE lanza y la factura queda intacta.
  await facturaLlamaService.invalidarDTE(factura.dteId!, motivo)

  await prisma.$transaction(async (tx) => {
    // Reset a estado pre-emisión: el operador puede re-elegir tipo y emitir de
    // nuevo (caso de uso: cambiar FC↔CCF). Los datos del DTE anulado quedan en el auditLog.
    await tx.factura.update({
      where: { id },
      data: {
        estadoDTE:        'PENDIENTE',
        tipoDTE:          null,
        dteId:            null,
        dteControlNumber: null,
        dteRespuestaMH:   Prisma.JsonNull,
      },
    })
    await tx.auditLog.create({
      data: {
        usuarioId,
        entidad: 'Factura',
        entidadId: id,
        accion: 'ANULAR_DTE',
        camposDespues: {
          motivo,
          dteIdAnulado: factura.dteId,
          controlNumberAnulado: factura.dteControlNumber,
          tipoDTEAnulado: factura.tipoDTE,
        } as Prisma.InputJsonValue,
      },
    })
  })
}
```

(`Prisma` ya está importado al tope del archivo.)

- [ ] **Step 5: Implementar el controller**

En `facturas.controller.ts`, reemplazar `anularDTE` (líneas 65-70) por:

```typescript
export async function anularDTE(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.anularDTE(req.params.id as string, req.body.motivo as string, req.user!.sub)
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
}
```

- [ ] **Step 6: Implementar la ruta**

En `facturas.routes.ts`:
1. Agregar `anularDTESchema` al import desde `'./facturas.schemas'` (líneas 3-10).
2. Reemplazar la línea 37:

```typescript
router.delete('/:id/dte', authenticate, requireRol('ADMIN'), validate(anularDTESchema), ctrl.anularDTE)
```

- [ ] **Step 7: Correr tests y typecheck**

```bash
pnpm test tests/modules/facturas/ && npx tsc --noEmit
```
Expected: los tests de anularDTE PASAN; los ~8 `setPeriodosRenta` siguen rojos (pre-existentes); tsc limpio.

- [ ] **Step 8: Commit**

```bash
git add src/modules/facturas/ tests/modules/facturas/
git commit -m "feat(facturas): anular DTE resetea la factura para re-emitir con otro tipo

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## PARTE 2 — FRONTEND (`/Users/joaquinmorales13a06/Desktop/Reinar/frontend`, rama ya creada)

### Task 3: `DteSection` — botón JSON, anular-cambiar-tipo, y renombrar el destructivo

**Files:**
- Modify: `components/dte/DteSection.tsx`

**Interfaces:**
- Produces: nuevas props opcionales en `DteSection`: `onDescargarJson?: () => void`, `isDescargandoJson?: boolean`, `onAnularSoloDTE?: (motivo: string) => void`, `isAnulandoSoloDTE?: boolean`, `anularError?: string | null`. El botón "Anular DTE" destructivo (`onAnular`) se renombra a "Anular factura". Task 4 pasa estas props. Las props son opcionales → la card de nota de crédito (que no las pasa) no cambia.

- [ ] **Step 1: Agregar las props al tipo**

En `components/dte/DteSection.tsx`, en el `type Props` (líneas 17-38), agregar tras `onAnular?`:

```typescript
  onAnularSoloDTE?: (motivo: string) => void;
  isAnulandoSoloDTE?: boolean;
  anularError?: string | null;
  onDescargarJson?: () => void;
  isDescargandoJson?: boolean;
```

- [ ] **Step 2: Estado local para el confirm de anular-cambiar-tipo**

En el cuerpo del componente `DteSection` (tras `const [confirmTipo, setConfirmTipo] = useState<TipoDTE | null>(null);`, línea 68), agregar:

```typescript
  // Confirmación inline de "anular DTE y cambiar tipo": pide un motivo (mín. 10)
  // que se manda al MH. Valor por defecto editable.
  const [confirmAnularTipo, setConfirmAnularTipo] = useState(false);
  const [motivoAnular, setMotivoAnular] = useState('Cambio de tipo de documento tributario a solicitud del cliente');
  const motivoAnularValido = motivoAnular.trim().length >= 10;
```

- [ ] **Step 3: Botón JSON + botones de anular en el bloque APROBADO**

En el bloque APROBADO (`{doc.estadoDTE === 'APROBADO' && (…)}`, líneas 233-266), reemplazar el `<div className="flex flex-wrap gap-2 mt-3">…</div>` (líneas 245-263) por:

```tsx
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim disabled:opacity-50"
              onClick={() => props.onDescargarPdf?.()}
              disabled={isDescargandoPdf}
            >
              <Icon name="download" size={14} /> {isDescargandoPdf ? 'Generando…' : 'Descargar PDF oficial'}
            </button>
            {props.onDescargarJson && (
              <button
                type="button"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border border-bd text-tx-2 hover:bg-bg-sunken disabled:opacity-50"
                onClick={() => props.onDescargarJson?.()}
                disabled={props.isDescargandoJson}
              >
                <Icon name="download" size={14} /> {props.isDescargandoJson ? 'Obteniendo…' : 'Descargar JSON'}
              </button>
            )}
            {isAdmin && props.onAnularSoloDTE && (
              <button
                type="button"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border border-bd text-tx-2 hover:bg-bg-sunken"
                onClick={() => setConfirmAnularTipo(true)}
              >
                <Icon name="refresh" size={14} /> Anular DTE y cambiar tipo
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border border-danger text-danger hover:bg-danger-soft"
                onClick={() => props.onAnular?.()}
              >
                <Icon name="trash" size={14} /> Anular factura
              </button>
            )}
          </div>
          {anularErrorBlock}
          {confirmAnularTipoBlock}
```

Y justo antes del `return` del bloque APROBADO (o mejor, definí estos dos fragmentos como variables locales antes del `return (` del componente, tras el Step 2), agregá:

```tsx
  const anularErrorBlock = props.anularError ? (
    <div className="mt-2 flex items-start gap-2 bg-danger-soft text-danger rounded-md px-3 py-2 text-sm">
      <Icon name="alertTriangle" size={14} />
      <span>{props.anularError}</span>
    </div>
  ) : null;

  const confirmAnularTipoBlock = confirmAnularTipo ? (
    <div className="mt-3 rounded-md border border-bd bg-bg-sunken p-3 space-y-2">
      <div className="text-sm font-medium text-tx">Anular el DTE para cambiar de tipo</div>
      <p className="text-xs text-tx-3">
        El DTE se anulará ante el Ministerio de Hacienda y la factura volverá a quedar sin tipo, lista para
        emitir de nuevo. El MH solo permite anular DTEs de hasta 3 días.
      </p>
      <textarea
        rows={3}
        value={motivoAnular}
        onChange={(e) => setMotivoAnular(e.target.value)}
        placeholder="Motivo de la anulación (mín. 10 caracteres)…"
        className="w-full px-2 py-1.5 rounded border border-bd bg-bg text-sm"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          className="inline-flex items-center px-3 py-1.5 rounded-md text-sm border border-bd text-tx-2 hover:bg-bg-sunken"
          onClick={() => setConfirmAnularTipo(false)}
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!motivoAnularValido || props.isAnulandoSoloDTE}
          onClick={() => { props.onAnularSoloDTE?.(motivoAnular.trim()); }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim disabled:opacity-50"
        >
          <Icon name="refresh" size={14} /> {props.isAnulandoSoloDTE ? 'Anulando…' : 'Anular y cambiar tipo'}
        </button>
      </div>
    </div>
  ) : null;
```

Nota: definí `anularErrorBlock` y `confirmAnularTipoBlock` como `const` en el cuerpo del componente ANTES del primer `return` (el del estado "sin tipo asignado"), para que estén en scope en el bloque APROBADO. No se usan en el estado "sin tipo", así que no molestan ahí.

- [ ] **Step 4: Typecheck + lint**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm tsc --noEmit
```
Expected: 0 errores (las props nuevas son opcionales; el consumidor actual — detalle de factura y de NC — sigue compilando porque no las pasa todavía). `pnpm lint` sobre el archivo: sin issues nuevos.

- [ ] **Step 5: Commit**

```bash
git add components/dte/DteSection.tsx
git commit -m "feat(dte): card con botón JSON y acción 'Anular DTE y cambiar tipo'

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Cablear en el detalle de factura + hook + renombrar página destructiva

**Files:**
- Modify: `hooks/use-facturas.ts:155-170` (`useAnularDTESoloDTE`)
- Modify: `app/(dashboard)/facturas/[id]/page.tsx`
- Modify: `app/(dashboard)/facturas/[id]/anular-dte/page.tsx` (copys)

**Interfaces:**
- Consumes: `DteSection` props de Task 3; `anularDTESchema` (motivo min 10) del backend Task 2.

- [ ] **Step 1: Actualizar el hook**

Primero confirmá que `useAnularDTESoloDTE` no tiene otros consumidores:
```bash
grep -rn "useAnularDTESoloDTE" app/ components/ hooks/
```
Solo debe aparecer su definición (no está cableado). Reemplazar la función (líneas 155-170) por:

```typescript
export function useAnularDTESoloDTE(id: string) {
  const qc = useQueryClient();
  return useMutation({
    // axios manda el body de un DELETE bajo `data`.
    mutationFn: ({ motivo }: { motivo: string }) =>
      api.delete<ApiResponse<unknown>>(`/facturas/${id}/dte`, { data: { motivo } }).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['factura', id] });
      qc.invalidateQueries({ queryKey: ['facturas'] });
      toast.success('DTE anulado. Asigná un nuevo tipo y emití.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo anular el DTE.'));
    },
  });
}
```

- [ ] **Step 2: Cablear el detalle de factura**

En `app/(dashboard)/facturas/[id]/page.tsx`:

1. Import (líneas 22-29): agregar `useAnularDTESoloDTE` y `descargarFacturaJsonDTE`:

```typescript
import {
  useFactura,
  useEmitirDTE,
  useSincronizarDTE,
  useEnviarDTEPorEmail,
  useAnularDTESoloDTE,
  descargarFacturaPdfOficialDTE,
  descargarFacturaPdfBranded,
  descargarFacturaJsonDTE,
} from '@/hooks/use-facturas';
```

2. Estado + hook (tras `const [descargandoPdfDte, setDescargandoPdfDte] = useState(false);`, línea 45):

```typescript
  const [descargandoJsonDte, setDescargandoJsonDte] = useState(false);
  const [anularError, setAnularError] = useState<string | null>(null);
  const anularSoloDTE = useAnularDTESoloDTE(id);
```

3. Handlers (tras `descargarPdfOficial`, línea 93):

```typescript
  async function descargarJsonOficial() {
    setDescargandoJsonDte(true);
    try {
      await descargarFacturaJsonDTE(id, factura!.numeroFactura);
    } finally {
      setDescargandoJsonDte(false);
    }
  }

  async function anularParaCambiarTipo(motivo: string) {
    setAnularError(null);
    try {
      await anularSoloDTE.mutateAsync({ motivo });
    } catch (err) {
      const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
      setAnularError(anyErr?.response?.data?.error?.message ?? 'No se pudo anular el DTE.');
    }
  }
```

4. En el `<DteSection …>` (líneas 163-181), agregar las props nuevas (mantener las existentes; `onAnular` sigue navegando a la página destructiva):

```tsx
            onAnular={() => router.push(`/facturas/${id}/anular-dte`)}
            onAnularSoloDTE={(motivo) => { void anularParaCambiarTipo(motivo); }}
            isAnulandoSoloDTE={anularSoloDTE.isPending}
            anularError={anularError}
            onDescargarPdf={() => { void descargarPdfOficial(); }}
            onDescargarJson={() => { void descargarJsonOficial(); }}
            isDescargandoJson={descargandoJsonDte}
```

- [ ] **Step 3: Renombrar la página destructiva**

En `app/(dashboard)/facturas/[id]/anular-dte/page.tsx`, cambiar los copys de "Anular DTE" a "Anular factura" para que coincida con el botón:
- Línea 60 (guard title): `title="Anular DTE"` → `title="Anular factura"`.
- Línea 113 (`PageHeader title`): `` title={`Anular DTE — ${factura.numeroFactura}`} `` → `` title={`Anular factura — ${factura.numeroFactura}`} ``.
- Línea 69 (mensaje EmptyState): "Solo los administradores pueden anular un DTE." → "Solo los administradores pueden anular una factura."

No cambiar la lógica (sigue usando `useCambiarEstadoFactura` con `estado: 'ANULADA'`).

- [ ] **Step 4: Typecheck + lint**

```bash
pnpm tsc --noEmit && pnpm lint
```
Expected: 0 errores de tsc; lint sin issues nuevos en los archivos tocados.

- [ ] **Step 5: Commit**

```bash
git add hooks/use-facturas.ts "app/(dashboard)/facturas/[id]/page.tsx" "app/(dashboard)/facturas/[id]/anular-dte/page.tsx"
git commit -m "feat(facturas): botón JSON y anular-DTE-cambiar-tipo en el detalle; renombra anular factura

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

1. En una factura con DTE **APROBADO**: la card muestra "Descargar PDF oficial", "Descargar JSON", "Anular DTE y cambiar tipo" (ADMIN) y "Anular factura" (ADMIN).
2. "Descargar JSON" baja el `.json` del DTE.
3. "Anular DTE y cambiar tipo" → escribir motivo (≥10) → confirmar → toast "DTE anulado…"; la card vuelve al selector de tipo → elegir un tipo distinto → emitir → DTE nuevo en PROCESANDO/APROBADO.
4. Simular rechazo del MH (o revisar con un DTE viejo si el sandbox lo permite): el error del MH se muestra inline y la factura NO se resetea.
5. "Anular factura" sigue llevando al flujo destructivo (título "Anular factura").
6. En una nota de crédito con DTE: la card NO muestra los botones JSON ni "cambiar tipo".

- [ ] **Step 3: Push y PRs**

```bash
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server push -u origin feat/dte-json-anular-cambiar-tipo
git -C /Users/joaquinmorales13a06/Desktop/Reinar/frontend push -u origin feat/dte-json-anular-cambiar-tipo
```

Crear los PRs con `gh pr create` en cada repo (título: `feat(dte): botón JSON + anular DTE para cambiar tipo`), cuerpo con resumen del spec y checklist, terminando con:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

**Orden de merge:** server primero, luego frontend (el frontend consume el contrato del `DELETE /:id/dte` con motivo).
