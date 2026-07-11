# Grupo A+B — Fixes de feedback + folio de talonario físico — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reparar el envío de DTE por correo y el bug del depósito, precargar periodo de renta y dirección (vía proyectos) en nueva acta, y mostrar el folio del talonario físico (no el consecutivo del sistema) en la factura y su PDF.

**Architecture:** Cambios quirúrgicos en dos repos: el backend Express (`/Users/joaquinmorales13a06/Desktop/Reinar/server`) para el build de templates, el campo `numeroActaFisicoManual` en `Factura` y la lógica del PDF; y el frontend Next.js (`/Users/joaquinmorales13a06/Desktop/Reinar/frontend`) para el schema del depósito, las precargas del formulario de acta y la tarjeta de folio físico en el detalle de factura.

**Tech Stack:** Next.js App Router, React Hook Form + Zod, React Query, Tailwind; Express + Prisma 7 + Vitest en el backend.

**Spec:** `docs/superpowers/specs/2026-07-11-grupo-ab-fixes-y-talonario-design.md`

## Global Constraints

- UI 100 % en español; comentarios tipo "why" en español.
- Tailwind estricto: solo clases predefinidas, sin valores arbitrarios, sin CSS vanilla.
- Montos con `decimal.js` / `Prisma.Decimal`, nunca `parseFloat` para dinero.
- Botones/campos de escritura ocultos para rol `VISUALIZADOR`.
- Verificación frontend: `pnpm tsc --noEmit` (no hay suite de tests). Verificación backend: `pnpm test` (vitest) + `npx tsc --noEmit`.
- BD remota compartida: NUNCA `migrate dev`, `migrate reset` ni `db push`. Migraciones con `migrate diff` offline + `migrate deploy` (ver Task 5).
- Ramas: crear `feat/feedback-julio-fixes-talonario` en AMBOS repos antes de empezar (Task 1 y 5 tocan el server; Tasks 2, 3, 4 y 6 el frontend).

---

### Task 1: Backend — build copia templates de correos + error claro en `compilar()`

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/package.json:9`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/correos/correos.service.ts:89-92`

**Interfaces:**
- Consumes: `AppError` de `src/middleware/error.middleware.ts` (constructor `new AppError(statusCode, code, message)`).
- Produces: nada nuevo — mismo contrato de `compilar(nombre, vars)`, pero con fallo tipado.

**Contexto:** El build solo copia los templates de `pdf`. En producción `dist/modules/correos/templates/` no existe y todo correo muere con `ENOENT` → 500 genérico. `enviarDTEManual` es el único flujo que propaga el error al usuario ("error interno del sistema" que reporta ventas).

- [ ] **Step 1: Extender el script build para copiar los templates de correos**

En `server/package.json`, reemplazar la línea 9:

```json
    "build": "tsc && cp -r src/modules/pdf/templates dist/modules/pdf/templates && cp -r src/modules/correos/templates dist/modules/correos/templates",
```

- [ ] **Step 2: Fallo claro en `compilar()` si falta el template**

En `correos.service.ts`, agregar el import (junto a los imports existentes al inicio del archivo):

```ts
import { AppError } from '../../middleware/error.middleware'
```

y reemplazar la función `compilar` (líneas 89-92):

```ts
function compilar(nombre: string, vars: Record<string, unknown>): string {
  const tplPath = path.join(__dirname, 'templates', nombre)
  // Si el build no copió los templates a dist/, antes esto moría con un
  // ENOENT genérico que el usuario veía como "error interno del sistema".
  if (!fs.existsSync(tplPath)) {
    throw new AppError(500, 'TEMPLATE_NO_ENCONTRADO', `Plantilla de correo no encontrada: ${nombre}`)
  }
  return Handlebars.compile(fs.readFileSync(tplPath, 'utf8'))(vars)
}
```

- [ ] **Step 3: Verificar que el build copia los templates**

Run:
```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm build && ls dist/modules/correos/templates
```
Expected: lista de archivos `.hbs` incluyendo `dte-enviado-manual.hbs` (8 templates).

- [ ] **Step 4: Correr la suite del backend**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm test`
Expected: PASS (sin regresiones).

- [ ] **Step 5: Commit (repo server)**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add package.json src/modules/correos/correos.service.ts
git commit -m "fix(correos): copiar templates de correos al build; error claro si falta template

El build solo copiaba los templates de pdf — en producción todo correo
fallaba con ENOENT y el envío manual de DTE devolvía 500 'Error interno'.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Frontend — fix bug del depósito en el wizard de cotización

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/lib/schemas/cotizacion.ts:27,31-39`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/cotizaciones/wizard/Step3Terminos.tsx:29,140-158,168`

**Interfaces:**
- Consumes: `step3Schema` (existente).
- Produces: `step3Schema` con `depositoMonto: z.number().nullable().optional()` (sin `.positive()` en la base — la exigencia vive solo en el `superRefine`). `Step3Form = z.input<typeof step3Schema>` no cambia de shape.

**Causa raíz:** `valueAsNumber: true` produce `NaN` con el input vacío; al volver a "Sin depósito" el input se desmonta pero RHF retiene el `NaN`; la validación base `z.number().positive()` lo rechaza incondicionalmente y el mensaje solo se renderiza en modo `MONTO` → botón bloqueado sin error visible.

- [ ] **Step 1: Relajar la validación base del schema**

En `lib/schemas/cotizacion.ts`, reemplazar la línea 27:

```ts
    // Sin .positive() en la base: el monto solo importa en modo MONTO y se
    // exige en el superRefine. Así un residuo saneado (null) en modo NINGUNO
    // nunca bloquea el submit.
    depositoMonto: z.number().nullable().optional(),
```

y reemplazar el `superRefine` completo (líneas 31-39):

```ts
  .superRefine((data, ctx) => {
    if (data.depositoModo === 'MONTO' && (data.depositoMonto == null || data.depositoMonto <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['depositoMonto'],
        message: 'Ingresa un monto mayor a 0',
      });
    }
  });
```

- [ ] **Step 2: Sanear el input y limpiar el residuo al cambiar de modo**

En `Step3Terminos.tsx`:

(a) Destructurar `setValue` del `useForm` (línea 29):

```tsx
  const { register, handleSubmit, control, watch, setValue, formState: { errors, isSubmitting } } = useForm<Step3Form>({
```

(b) En el radio de `depositoModo` (línea 150), reemplazar el `onChange`:

```tsx
                    onChange={() => {
                      field.onChange(m);
                      // Limpia el residuo del monto al volver a "Sin depósito":
                      // un NaN retenido por RHF bloqueaba el submit con el
                      // error oculto (solo se renderiza en modo MONTO).
                      if (m === 'NINGUNO') setValue('depositoMonto', null);
                    }}
```

(c) En el `register` del monto (línea 168), reemplazar `{ valueAsNumber: true }`:

```tsx
              {...register('depositoMonto', {
                // Input vacío → null (valueAsNumber daba NaN, que Zod rechaza).
                setValueAs: (v) => {
                  const n = typeof v === 'number' ? v : parseFloat(v);
                  return Number.isNaN(n) ? null : n;
                },
              })}
```

- [ ] **Step 3: Verificar tipos**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Verificación manual del flujo**

Con `pnpm dev` y el backend corriendo: crear/editar una cotización → Paso 3 → seleccionar "Monto fijo" → escribir un monto y borrarlo → volver a "Sin depósito" → "Siguiente".
Expected: avanza al paso 4. Además: en "Monto fijo" con campo vacío, "Siguiente" muestra "Ingresa un monto mayor a 0" inline.

- [ ] **Step 5: Commit (repo frontend)**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add lib/schemas/cotizacion.ts components/cotizaciones/wizard/Step3Terminos.tsx
git commit -m "fix(cotizaciones): depósito NaN residual bloqueaba el paso 3 en modo 'Sin depósito'

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Frontend — precargar periodo de renta de la factura en nueva acta

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/app/(dashboard)/actas/nueva/page.tsx:170,232-234,334-341`

**Interfaces:**
- Consumes: `useFactura(id)` (existente) — el tipo `Factura` ya expone `periodoRentaInicio/Fin: string | null` (ISO).
- Produces: nada nuevo — solo precarga de los campos `periodoRentaInicio`/`periodoRentaFin` del form existente.

- [ ] **Step 1: Resolver la factura completa también cuando se elige en el selector**

Hoy `useFactura` solo se llama con el id del query param. Reemplazar la línea 170:

```tsx
  // Resolvemos la factura completa tanto si viene por ?facturaId= como si el
  // usuario la elige en <SelectorFactura> (el list item no trae el periodo).
  const { data: facturaInicial } = useFactura(
    modo === 'factura' ? (facturaSeleccionada?.id ?? facturaIdInicial) || null : null,
  );
```

- [ ] **Step 2: Efecto de precarga del periodo**

Reemplazar el comentario obsoleto de las líneas 232-234 (`// La cotización no expone periodoInicio/periodoFin…`) por este efecto:

```tsx
  // Precarga el periodo de renta desde la factura (feedback ventas jul-2026).
  // Solo si el campo está vacío, para no pisar lo que el usuario ya tipeó.
  useEffect(() => {
    if (modo !== 'factura' || !facturaInicial) return;
    const { periodoRentaInicio, periodoRentaFin } = form.getValues();
    if (!periodoRentaInicio && facturaInicial.periodoRentaInicio) {
      form.setValue('periodoRentaInicio', facturaInicial.periodoRentaInicio.slice(0, 10));
    }
    if (!periodoRentaFin && facturaInicial.periodoRentaFin) {
      form.setValue('periodoRentaFin', facturaInicial.periodoRentaFin.slice(0, 10));
    }
  }, [modo, facturaInicial, form]);
```

- [ ] **Step 3: Limpiar el periodo al cambiar de factura**

En `handleCambiarFactura` (líneas 334-341), agregar después de `form.setValue('bodegaOrigenId', '');`:

```tsx
    // El periodo precargado pertenece a la factura anterior.
    form.setValue('periodoRentaInicio', '');
    form.setValue('periodoRentaFin', '');
```

- [ ] **Step 4: Verificar tipos**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Verificación manual**

Ir al detalle de una factura con periodo de renta guardado → "Nueva acta" (llega con `?facturaId=`).
Expected: los campos "Período renta — inicio/fin" llegan precargados con las fechas de la factura y siguen editables. Con una factura sin periodo, quedan vacíos.

- [ ] **Step 6: Commit (repo frontend)**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add "app/(dashboard)/actas/nueva/page.tsx"
git commit -m "feat(actas): precargar periodo de renta desde la factura en nueva acta

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Frontend — desplegable de proyectos + detalles adicionales en Dirección de entrega

**Files:**
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/lib/direccion-entrega.ts`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/lib/schemas/acta.ts` (crearActaFormSchema)
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/app/(dashboard)/actas/nueva/page.tsx` (sección Dirección de entrega, defaults, submit, handlers de cambio de origen)

**Interfaces:**
- Consumes: `useProyectosCliente(clienteId: string)` de `hooks/use-proyectos.ts` (devuelve `Proyecto[]`; `enabled: !!clienteId`); `Proyecto.ubicacion: string` con formato `"detalle, distrito, departamento"`; catálogos `DEPARTAMENTOS_SV`, `MUNICIPIOS_SV`, `getDistritosByDept` de `lib/sv-geo`.
- Produces: `ubicacionProyectoADireccionEntrega(ubicacion: string): string` y `anexarDetalleExtra(direccion: string, extra: string): string` en `lib/direccion-entrega.ts`; campo nuevo `direccionDetalleExtra?: string` en `crearActaFormSchema`.

- [ ] **Step 1: Crear el helper de conversión de direcciones**

Crear `lib/direccion-entrega.ts`:

```ts
import { DEPARTAMENTOS_SV, MUNICIPIOS_SV, getDistritosByDept } from '@/lib/sv-geo';

const SEP = ', ';

// La ubicación de un Proyecto es "detalle, distrito, departamento" (3 niveles,
// compuesta por UbicacionInput — sin municipio). La dirección de entrega del
// acta usa 4 niveles ("calle, distrito, municipio, departamento", el formato
// de DireccionCompleta). Convertimos best-effort resolviendo el municipio a
// partir del distrito; si algo no matchea los catálogos MH devolvemos el
// string original, que DireccionCompleta deja completo en el campo de calle.
export function ubicacionProyectoADireccionEntrega(ubicacion: string): string {
  const tokens = ubicacion.split(SEP).map((t) => t.trim()).filter(Boolean);
  if (tokens.length < 3) return ubicacion;

  const deptLabel = tokens[tokens.length - 1];
  const distLabel = tokens[tokens.length - 2];
  const detalle = tokens.slice(0, -2).join(SEP);

  const dept = DEPARTAMENTOS_SV.find((d) => d.label === deptLabel);
  if (!dept || !detalle) return ubicacion;

  const dist = getDistritosByDept(dept.value).find((d) => d.label === distLabel);
  if (!dist) return ubicacion;

  const muni = MUNICIPIOS_SV.find(
    (m) => m.value === dist.municipality && m.department === dept.value,
  );
  if (!muni) return ubicacion;

  return `${detalle}${SEP}${dist.label}${SEP}${muni.label}${SEP}${dept.label}`;
}

// Anexa los detalles extra DENTRO de la porción de calle (no al final del
// string) para que el formato de 4 niveles siga siendo parseable por
// DireccionCompleta al editar el acta después.
export function anexarDetalleExtra(direccion: string, extra: string): string {
  const extraTrim = extra.trim();
  if (!extraTrim) return direccion;
  if (!direccion) return extraTrim;

  const tokens = direccion.split(SEP);
  if (tokens.length < 4) return `${direccion} — ${extraTrim}`;

  const calle = tokens.slice(0, -3).join(SEP);
  return [`${calle} — ${extraTrim}`, ...tokens.slice(-3)].join(SEP);
}
```

- [ ] **Step 2: Agregar `direccionDetalleExtra` al schema del form**

En `lib/schemas/acta.ts`, dentro de `crearActaFormSchema`, después de `direccionEntrega: z.string().optional(),`:

```ts
  // Referencias extra de entrega — se anexan a la porción de calle del string
  // direccionEntrega al enviar; no viaja como campo propio al backend.
  direccionDetalleExtra: z.string().optional(),
```

- [ ] **Step 3: Integrar selector de proyecto y campo de detalles en la página**

En `app/(dashboard)/actas/nueva/page.tsx`:

(a) Imports nuevos:

```tsx
import { useProyectosCliente } from '@/hooks/use-proyectos';
import { ubicacionProyectoADireccionEntrega, anexarDetalleExtra } from '@/lib/direccion-entrega';
```

(b) Después de la declaración de `const { data: cotizacionActiva } = useCotizacion(...)` (línea ~194), agregar:

```tsx
  // Proyectos del cliente del origen — pobla el desplegable que autorellena
  // la dirección de entrega. clienteId vacío desactiva el query (enabled).
  const clienteId =
    modo === 'factura'
      ? facturaInicial?.cliente?.id ?? ''
      : cotizacionActiva?.cliente?.id ?? '';
  const { data: proyectos } = useProyectosCliente(clienteId);
  const [proyectoDireccionId, setProyectoDireccionId] = useState('');
```

(c) En `defaultValues` del `useForm` (líneas 140-148), agregar:

```tsx
      direccionDetalleExtra: '',
```

(d) En la sección "Dirección de entrega" (líneas 519-533), reemplazar el bloque completo por:

```tsx
      {/* ── Dirección de entrega ─────────────────────────────────────── */}
      <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
        <h3 className="text-sm font-semibold text-tx mb-3">Dirección de entrega</h3>
        <div className="mb-3">
          <label className={labelCls}>Proyecto (opcional)</label>
          <select
            className={inputBase}
            value={proyectoDireccionId}
            disabled={!clienteId || (proyectos ?? []).length === 0}
            onChange={(e) => {
              const id = e.target.value;
              setProyectoDireccionId(id);
              const proyecto = (proyectos ?? []).find((p) => p.id === id);
              if (proyecto) {
                form.setValue(
                  'direccionEntrega',
                  ubicacionProyectoADireccionEntrega(proyecto.ubicacion),
                );
              }
            }}
          >
            <option value="">
              {!clienteId
                ? 'Seleccioná primero la cotización o factura'
                : (proyectos ?? []).length === 0
                  ? 'El cliente no tiene proyectos'
                  : '— Rellenar desde un proyecto —'}
            </option>
            {(proyectos ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <p className="text-xs text-tx-3 mt-1">
            Rellena la dirección con la ubicación del proyecto; podés editarla abajo.
          </p>
        </div>
        <Controller
          control={form.control}
          name="direccionEntrega"
          render={({ field }) => (
            <DireccionCompleta
              value={field.value ?? ''}
              onChange={field.onChange}
              error={form.formState.errors.direccionEntrega?.message}
            />
          )}
        />
        <div className="mt-3">
          <label className={labelCls}>Detalles adicionales (opcional)</label>
          <input
            className={inputBase}
            placeholder="Portón 2, entregar en bodega trasera…"
            {...form.register('direccionDetalleExtra')}
          />
        </div>
      </div>
```

(e) En el `onSubmit` (construcción del `dto`, línea ~294), reemplazar la línea de `direccionEntrega`:

```tsx
        direccionEntrega:
          anexarDetalleExtra(data.direccionEntrega ?? '', data.direccionDetalleExtra ?? '') ||
          undefined,
```

(f) En `handleCambiarFactura` y `handleCambiarCotizacion`, agregar en ambos:

```tsx
    setProyectoDireccionId('');
```

- [ ] **Step 4: Verificar tipos**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Verificación manual**

En nueva acta: (1) sin origen seleccionado, el select de proyecto está deshabilitado con hint; (2) al elegir cotización de un cliente con proyectos, el select se habilita; (3) al elegir un proyecto, los selects de departamento/municipio/distrito y la calle se rellenan (si la ubicación matchea los catálogos) y siguen editables; (4) con "Detalles adicionales" escrito, crear el acta y confirmar en su detalle que la dirección incluye el texto extra dentro de la porción de calle.

- [ ] **Step 6: Commit (repo frontend)**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add lib/direccion-entrega.ts lib/schemas/acta.ts "app/(dashboard)/actas/nueva/page.tsx"
git commit -m "feat(actas): desplegable de proyectos que autorellena la dirección de entrega + detalles extra

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Backend — campo `numeroActaFisicoManual` + folios físicos en el PDF de factura

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/prisma/schema.prisma` (modelo Factura, tras `periodoRentaFin`)
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/server/prisma/migrations/20260711120000_factura_folio_acta_fisico_manual/migration.sql`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/facturas/facturas.schemas.ts:21-32`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/facturas/facturas.service.ts:152-161`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/pdf/pdf.service.ts:393,425-426`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/actas/actas.service.ts:558` (select de `listarActas`)
- Test: `/Users/joaquinmorales13a06/Desktop/Reinar/server/tests/modules/pdf/pdf.service.test.ts`

**Interfaces:**
- Consumes: modelo `Factura` y `ActaEntrega.numeroActaFisico String?` existentes; fixture `FACTURA` del test de PDF.
- Produces: `Factura.numeroActaFisicoManual String?` (Prisma); `actualizarFacturaSchema` acepta `numeroActaFisicoManual?: string | null` (max 50, null limpia); `listarActas` (GET `/facturas/:id/actas`) devuelve `numeroActaFisico` en cada item — Task 6 depende de ambos.

- [ ] **Step 1: Escribir los tests que definen la nueva lógica del PDF**

En `tests/modules/pdf/pdf.service.test.ts`:

(a) En el fixture `FACTURA` (línea 184), agregar tras `notas: null,`:

```ts
  numeroActaFisicoManual: null,
```

(b) Reemplazar el test `'incluye los números de acta en el PDF de factura'` (líneas 257-269) por estos tres:

```ts
  it('muestra los folios físicos del talonario, no el consecutivo del sistema', async () => {
    mockPrisma.factura.findUniqueOrThrow.mockResolvedValue({
      ...FACTURA,
      actasEntrega: [{ numeroActaFisico: 'REI-0451' }, { numeroActaFisico: 'REI-0452' }],
    })
    await generarFacturaPDF('fac-1')

    const browser = await vi.mocked(getBrowser)()
    const page = await browser.newPage()
    const html = vi.mocked(page.setContent).mock.calls[0][0] as string
    expect(html).toContain('Acta(s) de entrega')
    expect(html).toContain('REI-0451, REI-0452')
  })

  it('usa el folio manual cuando ninguna acta vinculada tiene folio físico', async () => {
    mockPrisma.factura.findUniqueOrThrow.mockResolvedValue({
      ...FACTURA,
      actasEntrega: [{ numeroActaFisico: null }],
      numeroActaFisicoManual: 'REI-0999',
    })
    await generarFacturaPDF('fac-1')

    const browser = await vi.mocked(getBrowser)()
    const page = await browser.newPage()
    const html = vi.mocked(page.setContent).mock.calls[0][0] as string
    expect(html).toContain('Acta(s) de entrega')
    expect(html).toContain('REI-0999')
  })

  it('no muestra el bloque de actas con actas sin folio y sin folio manual', async () => {
    mockPrisma.factura.findUniqueOrThrow.mockResolvedValue({
      ...FACTURA,
      actasEntrega: [{ numeroActaFisico: null }],
    })
    await generarFacturaPDF('fac-1')

    const browser = await vi.mocked(getBrowser)()
    const page = await browser.newPage()
    const html = vi.mocked(page.setContent).mock.calls[0][0] as string
    expect(html).not.toContain('Acta(s) de entrega')
  })
```

El test existente `'no muestra el bloque de actas cuando la factura no tiene actas asociadas'` se conserva sin cambios.

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm test -- tests/modules/pdf/pdf.service.test.ts`
Expected: FAIL — los tests nuevos esperan folios físicos pero el código actual usa `numeroActa`.

- [ ] **Step 3: Agregar el campo al modelo Prisma**

En `schema.prisma`, modelo `Factura`, después de `periodoRentaFin DateTime?` (línea ~611):

```prisma
  // Folio del talonario físico de actas ingresado a mano — respaldo para el
  // PDF cuando la factura no tiene actas vinculadas con folio físico todavía.
  numeroActaFisicoManual String?
```

- [ ] **Step 4: Generar y aplicar la migración (flujo offline — BD remota compartida)**

NUNCA `migrate dev` (se cuelga contra esta BD). Run:

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
npx prisma validate
git show HEAD:prisma/schema.prisma > /tmp/schema-old.prisma
mkdir -p prisma/migrations/20260711120000_factura_folio_acta_fisico_manual
npx prisma migrate diff --from-schema /tmp/schema-old.prisma --to-schema prisma/schema.prisma --script > prisma/migrations/20260711120000_factura_folio_acta_fisico_manual/migration.sql
```

Abrir la `migration.sql` y **borrar cualquier línea de ruido** al inicio (`npm warn …`, `Loaded Prisma config …`). El contenido final esperado:

```sql
ALTER TABLE "Factura" ADD COLUMN "numeroActaFisicoManual" TEXT;
```

Luego:

```bash
npx prisma generate
npx prisma migrate deploy
npx prisma migrate status
```

Expected: `migrate deploy` aplica `20260711120000_factura_folio_acta_fisico_manual`; `migrate status` reporta "Database schema is up to date!".

- [ ] **Step 5: Aceptar el campo en el schema de actualización**

En `facturas.schemas.ts`, dentro de `actualizarFacturaSchema` (tras la línea 28):

```ts
  // Folio del talonario físico manual; null lo limpia.
  numeroActaFisicoManual: z.string().trim().max(50).nullable().optional(),
```

y extender el `.refine` (línea 30) agregando la condición:

```ts
  (d) => d.notas !== undefined || d.fechaVencimiento !== undefined || d.plazoCredito !== undefined || d.periodoRentaInicio !== undefined || d.periodoRentaFin !== undefined || d.numeroActaFisicoManual !== undefined,
```

- [ ] **Step 6: Persistir el campo en el servicio**

En `facturas.service.ts`, dentro del `prisma.factura.update` de `actualizarFactura` (tras la línea 159):

```ts
      ...(data.numeroActaFisicoManual !== undefined && { numeroActaFisicoManual: data.numeroActaFisicoManual || null }),
```

- [ ] **Step 7: Cambiar la lógica del PDF a folios físicos**

En `pdf.service.ts`:

(a) Reemplazar el include de la línea 393:

```ts
        actasEntrega: { select: { numeroActaFisico: true }, orderBy: { numeroActa: 'asc' } },
```

(b) Reemplazar las líneas 425-426 (comentario + `numerosActa`):

```ts
      // Folio(s) del talonario físico Reinar — ventas exige el folio físico,
      // no el consecutivo del sistema. Fallback: folio manual de la factura.
      numerosActa: (() => {
        const folios = factura.actasEntrega
          .map((a) => a.numeroActaFisico)
          .filter((f): f is string => !!f)
        return folios.length > 0 ? folios.join(', ') : (factura.numeroActaFisicoManual ?? '')
      })(),
```

El template `factura.hbs` no cambia — su `{{#if factura.numerosActa}}` ya oculta el bloque con string vacío.

- [ ] **Step 8: Exponer `numeroActaFisico` en el listado de actas de una factura**

En `actas.service.ts`, función `listarActas`, dentro del `select` (línea ~558), agregar tras `id: true, numeroActa: true, estado: true,`:

```ts
        numeroActaFisico: true,
```

(Lo consume la tarjeta de folio físico del frontend — Task 6.)

- [ ] **Step 9: Correr los tests y verificar tipos**

Run:
```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server && pnpm test && npx tsc --noEmit
```
Expected: PASS (incluidos los 3 tests nuevos) y sin errores de tipos.

- [ ] **Step 10: Commit (repo server)**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add prisma/schema.prisma prisma/migrations/20260711120000_factura_folio_acta_fisico_manual src/modules/facturas/facturas.schemas.ts src/modules/facturas/facturas.service.ts src/modules/pdf/pdf.service.ts src/modules/actas/actas.service.ts tests/modules/pdf/pdf.service.test.ts
git commit -m "feat(facturas): folio del talonario físico en el PDF; campo manual de respaldo

El PDF de factura mostraba el consecutivo del sistema (numeroActa); ahora
muestra los folios físicos de las actas despachadas y, si no hay ninguno,
el numeroActaFisicoManual editable en la factura.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Frontend — tipos + tarjeta de folio físico en el detalle de factura

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/types/api.ts` (tipos `Factura`, `ActualizarFacturaDto`, `ActaListItem`)
- Create: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/facturas/detalle/ActaFisicaCard.tsx`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/app/(dashboard)/facturas/[id]/page.tsx:17-18,212`

**Interfaces:**
- Consumes: `numeroActaFisicoManual` del backend (Task 5); `useActasDeFactura(facturaId)` que ahora devuelve `numeroActaFisico` por item; `useActualizarFactura()` (existente, ya maneja toasts e invalidación).
- Produces: componente `ActaFisicaCard({ factura }: { factura: Factura })`.

- [ ] **Step 1: Actualizar tipos**

En `types/api.ts`:

(a) En el tipo `Factura`, después de `periodoRentaFin: string | null;`:

```ts
  // Folio del talonario físico manual — respaldo del PDF cuando no hay actas
  // despachadas con folio.
  numeroActaFisicoManual: string | null;
```

(b) En `ActualizarFacturaDto`, después de `periodoRentaFin?: string | null;`:

```ts
  numeroActaFisicoManual?: string | null;
```

(c) En `ActaListItem`, después de `numeroActa: string;`:

```ts
  numeroActaFisico: string | null;
```

- [ ] **Step 2: Crear el componente `ActaFisicaCard`**

Crear `components/facturas/detalle/ActaFisicaCard.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useActualizarFactura } from '@/hooks/use-facturas';
import { useActasDeFactura } from '@/hooks/use-actas';
import type { Factura } from '@/types/api';

const inputCls =
  'w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent transition-colors';

// Folio del talonario físico de actas Reinar que se imprime en el PDF de la
// factura. Prioridad: folios reales de las actas despachadas; si no hay
// ninguno, el folio manual guardado en la factura (editable acá).
export function ActaFisicaCard({ factura }: { factura: Factura }) {
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeEscribir = rol !== undefined && rol !== 'VISUALIZADOR';
  const anulada = factura.estado === 'ANULADA';
  const soloLectura = !puedeEscribir || anulada;

  const actas = useActasDeFactura(factura.id);
  const folios = (actas.data?.data ?? [])
    .map((a) => a.numeroActaFisico)
    .filter((f): f is string => !!f);

  const [manual, setManual] = useState(factura.numeroActaFisicoManual ?? '');
  // Sincroniza tras guardar/refetch sin pisar el tipeo en curso (solo cambia
  // cuando cambia el valor persistido).
  useEffect(() => {
    setManual(factura.numeroActaFisicoManual ?? '');
  }, [factura.numeroActaFisicoManual]);

  const actualizar = useActualizarFactura();

  return (
    <div className={`bg-bg border border-bd rounded-md p-4 ${anulada ? 'opacity-60' : ''}`}>
      <h3 className="text-sm font-medium text-tx mb-3">Acta(s) físicas</h3>
      {folios.length > 0 ? (
        <p className="text-sm font-mono text-tx">{folios.join(', ')}</p>
      ) : soloLectura ? (
        <p className="text-sm font-mono text-tx">{factura.numeroActaFisicoManual ?? '—'}</p>
      ) : (
        <>
          <label className="block text-xs font-medium text-tx-2 mb-1">
            Folio del talonario (manual)
          </label>
          <input
            className={`${inputCls} font-mono`}
            placeholder="Ej. 0451"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
          <p className="text-xs text-tx-3 mt-2">
            Se muestra en el PDF mientras la factura no tenga actas despachadas con folio físico.
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={actualizar.isPending}
              onClick={() => {
                void actualizar.mutateAsync({
                  id: factura.id,
                  data: { numeroActaFisicoManual: manual.trim() || null },
                });
              }}
              className="px-4 py-2 text-sm rounded-md bg-accent text-navy font-medium hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              {actualizar.isPending ? 'Guardando…' : 'Guardar folio'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Renderizar la tarjeta en el detalle de factura**

En `app/(dashboard)/facturas/[id]/page.tsx`:

(a) Import junto a los otros de `detalle/` (líneas 17-18):

```tsx
import { ActaFisicaCard } from '@/components/facturas/detalle/ActaFisicaCard';
```

(b) Después de `<PeriodoFacturaCard factura={factura} />` (línea 212):

```tsx
          <ActaFisicaCard factura={factura} />
```

- [ ] **Step 4: Verificar tipos y lint**

Run: `cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend && pnpm tsc --noEmit && pnpm lint`
Expected: sin errores.

- [ ] **Step 5: Verificación manual end-to-end**

Con backend (Task 5 desplegado localmente) y frontend corriendo:
1. Factura sin actas → la tarjeta "Acta(s) físicas" muestra el input manual → guardar "0451" → descargar el PDF → muestra "Acta(s) de entrega: 0451".
2. Factura con acta despachada (folio físico real) → la tarjeta muestra el folio en solo-lectura y el PDF muestra ese folio, no el manual ni el consecutivo `ACT…`.
3. Como VISUALIZADOR (o factura ANULADA) → sin input, solo lectura.

- [ ] **Step 6: Commit (repo frontend)**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add types/api.ts components/facturas/detalle/ActaFisicaCard.tsx "app/(dashboard)/facturas/[id]/page.tsx"
git commit -m "feat(facturas): tarjeta de folio del talonario físico en el detalle de factura

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Verificación final del grupo

- [ ] Frontend: `pnpm tsc --noEmit && pnpm lint` limpios.
- [ ] Backend: `pnpm test` y `npx tsc --noEmit` limpios; `pnpm build` deja los templates de `correos` y `pdf` en `dist/`.
- [ ] Probar el envío de DTE por correo real en desarrollo (flujo completo del bug #1).
- [ ] Checklist estándar pre-PR del proyecto (dark mode, tablet 768px, roles, toasts).
