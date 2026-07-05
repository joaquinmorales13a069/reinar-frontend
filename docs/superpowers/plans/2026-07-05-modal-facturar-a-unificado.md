# Unificar "Facturar a" en el modal de generar factura — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar los dos campos "Facturar a" del modal de generar factura por una sola sección "Facturar a" con el receptor (principal) y el contacto de atención (secundario), donde el contacto sigue al receptor y se resetea al cambiarlo.

**Architecture:** Cambio de una sola sección de JSX en `GenerarFacturaModal.tsx`: fusionar el bloque del `ContactoSolicitanteSelect` y el bloque del receptor tercero en una sección con un único encabezado; pasar el `clienteId` del receptor efectivo al selector de contactos y limpiar el contacto cuando el receptor cambia. Sin cambios de estado nuevos, sin backend.

**Tech Stack:** Next.js + React + Tailwind, en `/Users/joaquinmorales13a06/Desktop/Reinar/frontend`.

**Spec:** `docs/superpowers/specs/2026-07-05-modal-facturar-a-unificado-design.md`

## Global Constraints

- **Rama:** `feat/modal-facturar-a-unificado` (frontend; ya creada, spec commiteado). **Sin backend, sin cambios de contrato.**
- **Un solo archivo:** `components/cotizaciones/GenerarFacturaModal.tsx`.
- **UI en español.** Tailwind solo clases predefinidas, sin valores arbitrarios. Comentarios "why" en español.
- **No cambiar** la lógica de submit (`receptorClienteId` solo cuando `esTercero`; `contactoFacturacionId` como hoy) ni otros campos del modal (tipo de documento, condición de pago, QUEDAN).
- **Sin suite de tests en frontend** — verificación = `pnpm tsc --noEmit` + `pnpm lint`.

---

### Task 1: Fusionar los dos "Facturar a" en una sección

**Files:**
- Modify: `components/cotizaciones/GenerarFacturaModal.tsx` (el bloque del contacto ~180-193 y el bloque del receptor ~195-244)

**Contexto de estados existentes (no crear nuevos):** `contactoFacturacionId`/`setContactoFacturacionId`, `receptorClienteId`/`setReceptorClienteId`, `mostrarSelectorReceptor`/`setMostrarSelectorReceptor`, `esTercero = !!receptorClienteId && receptorClienteId !== cliente.id`, `nombreCliente` (de `@/lib/utils`), `tipoDTE`/`setTipoDTE`. `ContactoSolicitanteSelect` props: `{ clienteId, value, onChange, defaultTipo }` (usa `useContactos({ clienteId })` internamente, así que un `clienteId` distinto lista otros contactos).

- [ ] **Step 1: Reemplazar los dos bloques por la sección unificada**

En `GenerarFacturaModal.tsx`, hoy hay DOS `<div className="flex flex-col gap-1">` consecutivos: (1) el del contacto (label "Facturar a", `ContactoSolicitanteSelect` con `clienteId={cliente.id}`, ~líneas 180-193) y (2) el del receptor (label "Facturar a un tercero", resumen colapsable + `SelectorClienteReceptor` + el `{esTercero && (…aviso…)}`, ~líneas 195-244).

Reemplazar **ambos** bloques por UNA sección. Conservar **verbatim** el bloque de aviso `{esTercero && ( … )}` existente (no reescribir su JSX; solo moverlo dentro de la nueva sección, después del receptor). El resultado:

```tsx
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-tx-2">Facturar a</span>

            {/* Receptor (principal): a qué cliente se factura. Por defecto el de la
                cotización; se puede cambiar a un tercero (otro Cliente registrado). */}
            {!mostrarSelectorReceptor ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-bd bg-bg-sunken">
                <span className="text-sm text-tx">
                  Se factura a: <span className="font-medium">{nombreCliente(cliente)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setMostrarSelectorReceptor(true)}
                  className="text-xs font-medium text-accent hover:underline shrink-0"
                >
                  Cambiar receptor
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <SelectorClienteReceptor
                  value={receptorClienteId}
                  onChange={(clienteId, tipo) => {
                    setReceptorClienteId(clienteId);
                    // El contacto del cliente anterior no aplica al nuevo receptor.
                    setContactoFacturacionId(null);
                    // El tercero puede tener un tipo distinto al de la cotización — se
                    // re-sugiere el DTE según el tercero. Sigue siendo editable.
                    setTipoDTE(tipo === 'EMPRESA' ? 'CCF' : 'FC');
                  }}
                  filter={(c) => c.id !== cliente.id}
                />
                <button
                  type="button"
                  onClick={() => {
                    setMostrarSelectorReceptor(false);
                    setReceptorClienteId(null);
                    // Volver al cliente de la cotización: resetear contacto y re-sugerir DTE.
                    setContactoFacturacionId(null);
                    setTipoDTE(cliente.tipo === 'EMPRESA' ? 'CCF' : 'FC');
                  }}
                  className="self-start text-xs text-tx-3 hover:text-tx transition-colors"
                >
                  Volver al cliente de la cotización
                </button>
              </div>
            )}

            {/* CONSERVAR el bloque de aviso existente `{esTercero && ( … )}` tal cual,
                moviéndolo acá (después del receptor). No reescribir su JSX. */}

            {/* Atención / contacto (secundario, opcional): persona de la empresa a la
                que se dirige el documento — NO cambia a quién se factura. */}
            <div className="flex flex-col gap-1 mt-1">
              <label className="text-xs font-medium text-tx-2">
                Atención (contacto) <span className="text-tx-3 text-2xs">(opcional)</span>
              </label>
              <ContactoSolicitanteSelect
                clienteId={receptorClienteId ?? cliente.id}
                value={contactoFacturacionId}
                onChange={setContactoFacturacionId}
                defaultTipo="FACTURACION"
              />
              <p className="text-xs text-tx-3 mt-0.5">
                Persona de la empresa a la que se dirige el documento. No cambia a quién se factura.
              </p>
            </div>
          </div>
```

Puntos clave del cambio:
- Un solo encabezado "Facturar a" (se elimina el label duplicado y el "Facturar a un tercero").
- `ContactoSolicitanteSelect` recibe `clienteId={receptorClienteId ?? cliente.id}` (el receptor efectivo), no `cliente.id`.
- En AMBOS handlers que cambian el receptor (el `onChange` del `SelectorClienteReceptor` y el botón "Volver…"), se agrega `setContactoFacturacionId(null)` para limpiar el contacto del cliente anterior.
- El bloque de aviso `{esTercero && (…)}` se conserva verbatim, ubicado dentro de la sección tras el receptor.

- [ ] **Step 2: Typecheck + lint**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm tsc --noEmit && pnpm lint
```
Expected: 0 errores de tsc; `pnpm lint` sin issues nuevos en el archivo cambiado.

- [ ] **Step 3: Revisión visual (self-review)**

Confirmar por lectura del JSX: (a) hay un único encabezado "Facturar a"; (b) el `ContactoSolicitanteSelect` usa el receptor efectivo; (c) ambos handlers de cambio de receptor resetean el contacto; (d) el aviso `esTercero` quedó dentro de la sección; (e) el submit (`onSubmit`) no se tocó; (f) no se introdujeron valores arbitrarios de Tailwind ni texto en inglés.

- [ ] **Step 4: Commit**

```bash
git add components/cotizaciones/GenerarFacturaModal.tsx
git commit -m "feat(facturas): unificar 'Facturar a' — receptor + contacto de atención en una sección

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Verificación, push y PR

**Files:** ninguno nuevo.

- [ ] **Step 1: Verificación final**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm tsc --noEmit && pnpm lint
```
Expected: tsc 0; lint sin issues nuevos.

- [ ] **Step 2: Prueba manual (frontend :3001)**

Abrir el modal de generar factura desde una cotización aprobada: verificar que hay una sola sección "Facturar a"; que "Cambiar receptor" abre el selector de terceros; que al elegir un tercero, los contactos de "Atención (contacto)" pasan a ser del tercero (y cualquier contacto previo se limpió); que "Volver al cliente de la cotización" restaura el receptor y limpia el contacto; y que generar la factura con y sin tercero funciona igual que hoy.

- [ ] **Step 3: Push y PR**

```bash
git -C /Users/joaquinmorales13a06/Desktop/Reinar/frontend push -u origin feat/modal-facturar-a-unificado
```

Crear el PR con `gh pr create` (título: `feat(facturas): unificar 'Facturar a' en el modal de generar factura`), cuerpo con el resumen del spec y checklist, terminando con:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Es solo frontend (no hay PR de backend).
