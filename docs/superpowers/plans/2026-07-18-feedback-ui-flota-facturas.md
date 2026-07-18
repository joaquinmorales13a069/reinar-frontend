# Feedback UI REINAR (flota, grid factura, descargas DTE) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar los tres cambios de feedback de REINAR: etiquetas reales en "Utilización de flota", grid de dos columnas en detalle de factura, y botón unificado de descargas en los paneles DTE.

**Architecture:** Tres cambios independientes de frontend puro (sin backend). 1) Corregir el contrato de tipos del dashboard para reflejar que el backend envía nombres de categoría como string libre. 2) Reordenar JSX del grid ya existente en el detalle de factura. 3) Extraer un componente dropdown compartido `DteDescargasMenu` (patrón de `FacturaDescargasMenu`) y usarlo en `DteSection` (facturas + notas de crédito) y `FseDtePanel` (FSE).

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind (solo clases predefinidas).

**Spec:** `docs/superpowers/specs/2026-07-18-feedback-ui-flota-facturas-design.md`

## Global Constraints

- No hay suite de tests en este repo. La verificación por task es: `pnpm tsc --noEmit` (obligatorio) y `pnpm lint` (obligatorio), ambos sin errores.
- Rama de trabajo: `feat/feedback-ui-flota-facturas` (ya creada y activa).
- 100% español en textos de UI; comentarios solo tipo "why", en español.
- Solo clases Tailwind predefinidas — prohibido CSS vanilla y valores arbitrarios (`h-[20px]`).
- Los mensajes de commit terminan con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- No tocar el backend (`/Users/joaquinmorales13a06/Desktop/Reinar/server`).

---

### Task 1: Etiquetas reales en "Utilización de flota"

**Files:**
- Modify: `types/dashboard.ts:1-20`
- Modify: `components/dashboard/FleetWidget.tsx`

**Interfaces:**
- Consumes: nada de otros tasks.
- Produces: `UtilizacionCategoria.categoria: string` (antes era el enum `CategoriaFlota`, que se elimina). Ningún otro archivo consume `CategoriaFlota` (verificado con grep: solo `types/dashboard.ts` y `FleetWidget.tsx`).

**Contexto del bug:** el backend (`server/src/modules/dashboard/dashboard.service.ts:431,444`) envía `categoria` como el **nombre real** de la categoría en BD (ej. `"Compresores"`, más la fila fija `"Piezas de andamio"`). El frontend lo tipa como enum y lo pasa por el diccionario `CATEGORIA_LABEL`, cuyo lookup devuelve `undefined` → todas las filas del card salen sin etiqueta.

- [ ] **Step 1: Cambiar el tipo en `types/dashboard.ts`**

Reemplazar las líneas 1-13 (el tipo `CategoriaFlota` completo y el campo `categoria`). Antes:

```typescript
export type CategoriaFlota =
  | 'COMPRESOR_GENERADOR'
  | 'SANDBLASTING'
  | 'ANDAMIO_PLATAFORMA'
  | 'COMPACTADOR_RODILLO'
  | 'HERRAMIENTA_ESPECIALIZADA'
  | 'OTRO'
  | 'ANDAMIO_PIEZA';

// Una fila por categoría. usoInterno/inactivo se cuentan en `total` pero el
// FleetWidget sólo pinta rentado/mantenimiento/disponible en la barra visual.
export type UtilizacionCategoria = {
  categoria: CategoriaFlota;
```

Después:

```typescript
// Una fila por categoría. usoInterno/inactivo se cuentan en `total` pero el
// FleetWidget sólo pinta rentado/mantenimiento/disponible en la barra visual.
// `categoria` es el nombre real de la categoría en BD (dashboard.service.ts
// envía cat.nombre, más la fila fija "Piezas de andamio") — no un enum.
export type UtilizacionCategoria = {
  categoria: string;
```

El resto del tipo (`rentado`, `mantenimiento`, `disponible`, `usoInterno`, `inactivo`, `total`) queda igual.

- [ ] **Step 2: Renderizar el nombre directo en `FleetWidget.tsx`**

Tres ediciones:

a) Import (línea 4) — antes:

```typescript
import type { CategoriaFlota, UtilizacionCategoria } from '@/types/dashboard';
```

Después:

```typescript
import type { UtilizacionCategoria } from '@/types/dashboard';
```

b) Eliminar completo el diccionario `CATEGORIA_LABEL` (líneas 11-19):

```typescript
const CATEGORIA_LABEL: Record<CategoriaFlota, string> = {
  COMPRESOR_GENERADOR:       'Compresores y generadores',
  SANDBLASTING:              'Sandblasting',
  ANDAMIO_PLATAFORMA:        'Andamios y plataformas',
  COMPACTADOR_RODILLO:       'Compactadores y rodillos',
  HERRAMIENTA_ESPECIALIZADA: 'Herramienta especializada',
  OTRO:                      'Otros equipos',
  ANDAMIO_PIEZA:             'Andamios (piezas)',
};
```

c) En la fila (línea 53) — antes:

```tsx
<div className="text-sm text-tx truncate">{CATEGORIA_LABEL[fila.categoria]}</div>
```

Después:

```tsx
<div className="text-sm text-tx truncate">{fila.categoria}</div>
```

- [ ] **Step 3: Verificar**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: ambos sin errores. Si `tsc` reporta usos restantes de `CategoriaFlota`, es un consumidor no detectado — corregirlo a `string` con el mismo criterio.

- [ ] **Step 4: Commit**

```bash
git add types/dashboard.ts components/dashboard/FleetWidget.tsx
git commit -m "fix(dashboard): mostrar el nombre real de categoría en Utilización de flota

El backend envía cat.nombre (string libre), no el enum CategoriaFlota —
el lookup en CATEGORIA_LABEL devolvía undefined y las barras salían sin
etiqueta.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Grid de dos columnas en detalle de factura

**Files:**
- Modify: `app/(dashboard)/facturas/[id]/page.tsx:219-227`

**Interfaces:**
- Consumes: nada de otros tasks (independiente de Task 1).
- Produces: nada que otros tasks consuman. Los componentes movidos no cambian de props.

**Contexto:** la columna derecha del grid (`lg:grid-cols-3`, `items-start`) solo tiene `ProgresoCobroCard`; en pantallas grandes queda un vacío enorme. Se mueven tres cards pequeños a la derecha. En `< lg` el grid ya colapsa a una columna (los cards movidos quedan al final, tras Pagos — aceptable por ser metadatos secundarios).

- [ ] **Step 1: Reordenar el JSX**

En `app/(dashboard)/facturas/[id]/page.tsx`, el bloque actual (líneas 219-227):

```tsx
          <ItemsFacturadosCard factura={factura} />
          <PeriodoFacturaCard factura={factura} />
          <ActaFisicaCard factura={factura} />
          <PagosCard factura={factura} isOperador={isOperador} isAdminOGerente={isAdminOGerente} />
          <ActasVinculadasCard factura={factura} puedeEscribir={!!puedeEscribir} />
        </div>
        <div className="space-y-4">
          <ProgresoCobroCard factura={factura} />
        </div>
```

queda así:

```tsx
          <ItemsFacturadosCard factura={factura} />
          <PagosCard factura={factura} isOperador={isOperador} isAdminOGerente={isAdminOGerente} />
        </div>
        <div className="space-y-4">
          <ProgresoCobroCard factura={factura} />
          <PeriodoFacturaCard factura={factura} />
          <ActaFisicaCard factura={factura} />
          <ActasVinculadasCard factura={factura} puedeEscribir={!!puedeEscribir} />
        </div>
```

No se tocan imports (todos los componentes se siguen usando) ni el resto de la columna izquierda (`AjustarEstadoCard`, `ClienteFechasCard`, `ObservacionesCard`, `EntregaQuedanCard`, `DteSection` quedan igual).

- [ ] **Step 2: Verificar**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: ambos sin errores.

Verificación visual (si el dev server está corriendo en :3001): abrir el detalle de una factura a ancho ≥ 1024px — la columna derecha muestra Progreso de cobro, Período de renta, Acta(s) físicas y Actas de entrega vinculadas en ese orden; a 768px todo apila en una sola columna.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/facturas/[id]/page.tsx"
git commit -m "feat(facturas): aprovechar la columna derecha del detalle con período y actas

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Componente `DteDescargasMenu` + integración en `DteSection`

**Files:**
- Create: `components/dte/DteDescargasMenu.tsx`
- Modify: `components/dte/DteSection.tsx:304-322` (bloque de botones del estado APROBADO) y cabecera de imports

**Interfaces:**
- Consumes: `Icon` e `IconName` de `components/ui/Icon.tsx` (ya existen; `IconName` se exporta en `Icon.tsx:60`).
- Produces: `DteDescargasMenu({ items }: { items: DescargaDteItem[] })` y el tipo exportado `DescargaDteItem = { label: string; loadingLabel: string; icon: IconName; isLoading?: boolean; onClick: () => void }`. Task 4 lo consume con esta firma exacta.

**Comportamiento:**
- 2+ items → botón amarillo "Descargar" con chevron que despliega menú (`role="menu"`, cierre al click fuera). El menú se cierra al elegir una opción, así que el feedback de carga vive en el trigger: si un item tiene `isLoading`, el trigger muestra su `loadingLabel` y se deshabilita.
- 1 item → botón amarillo directo `Descargar {label}`, sin dropdown (caso notas de crédito, que no pasa `onDescargarJson`).
- 0 items → `null`.

- [ ] **Step 1: Crear `components/dte/DteDescargasMenu.tsx`**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';

export type DescargaDteItem = {
  label: string;        // ej. 'PDF oficial' — el trigger de una sola opción antepone "Descargar "
  loadingLabel: string; // ej. 'Generando…'
  icon: IconName;
  isLoading?: boolean;
  onClick: () => void;
};

const triggerCls =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim disabled:opacity-50';

// Botón amarillo unificado de descargas del panel DTE (feedback REINAR).
// Compartido por DteSection (facturas/notas) y FseDtePanel; el patrón de
// dropdown replica FacturaDescargasMenu (open + mousedown fuera + role=menu).
export function DteDescargasMenu({ items }: { items: DescargaDteItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (items.length === 0) return null;

  // Con una sola opción un dropdown no aporta: el botón descarga directo.
  if (items.length === 1) {
    const item = items[0];
    return (
      <button type="button" className={triggerCls} onClick={item.onClick} disabled={item.isLoading}>
        <Icon name="download" size={14} /> {item.isLoading ? item.loadingLabel : `Descargar ${item.label}`}
      </button>
    );
  }

  // El menú se cierra al hacer click en una opción, así que el feedback de
  // progreso tiene que vivir en el trigger.
  const enCurso = items.find((i) => i.isLoading);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        className={triggerCls}
        disabled={!!enCurso}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="download" size={14} />
        {enCurso ? enCurso.loadingLabel : 'Descargar'}
        <Icon name="chevronDown" size={12} />
      </button>

      {open && (
        <div role="menu" className="absolute left-0 z-20 mt-1 w-56 rounded-md border border-bd bg-bg shadow-lg py-1">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.isLoading}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-tx-2 hover:bg-bg-sunken text-left disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => { setOpen(false); item.onClick(); }}
            >
              <Icon name={item.icon} size={14} /> {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Integrar en `DteSection.tsx`**

a) Agregar el import junto a los existentes (tras la línea 8, `import { TipoDteBadge } ...`):

```tsx
import { DteDescargasMenu } from '@/components/dte/DteDescargasMenu';
import type { DescargaDteItem } from '@/components/dte/DteDescargasMenu';
```

b) Dentro del componente `DteSection`, después de la línea `const motivoAnularValido = motivoAnular.trim().length >= 10;` (línea 78), construir los items:

```tsx
  // Items del botón unificado de descargas (estado APROBADO). El item de JSON
  // solo existe si el consumidor pasó onDescargarJson (notas de crédito no).
  const itemsDescarga: DescargaDteItem[] = [
    {
      label: 'PDF oficial',
      loadingLabel: 'Generando…',
      icon: 'fileText',
      isLoading: isDescargandoPdf,
      onClick: () => props.onDescargarPdf?.(),
    },
  ];
  if (props.onDescargarJson) {
    itemsDescarga.push({
      label: 'JSON',
      loadingLabel: 'Obteniendo…',
      icon: 'clipboard',
      isLoading: props.isDescargandoJson,
      onClick: () => props.onDescargarJson?.(),
    });
  }
```

c) En el bloque APROBADO (líneas 304-322), reemplazar los dos botones. Antes:

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
```

Después:

```tsx
          <div className="flex flex-wrap gap-2 mt-3">
            <DteDescargasMenu items={itemsDescarga} />
```

Los botones siguientes del mismo `div` ("Anular DTE y cambiar tipo" y "Anular factura/nota") quedan intactos.

- [ ] **Step 3: Verificar**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: ambos sin errores.

Verificación visual (si el dev server está corriendo): en una factura con DTE APROBADO, el card DTE muestra un solo botón amarillo "Descargar ▾"; al clickearlo se despliegan "PDF oficial" y "JSON" y ambas descargas funcionan. En una nota de crédito con DTE APROBADO, aparece el botón directo "Descargar PDF oficial" sin chevron.

- [ ] **Step 4: Commit**

```bash
git add components/dte/DteDescargasMenu.tsx components/dte/DteSection.tsx
git commit -m "feat(dte): unificar descargas de PDF oficial y JSON en un botón con menú

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Botón unificado en `FseDtePanel` (FSE)

**Files:**
- Modify: `components/fse/FseDtePanel.tsx:146-152` y cabecera de imports

**Interfaces:**
- Consumes: `DteDescargasMenu` y `DescargaDteItem` de Task 3, con la firma exacta `DteDescargasMenu({ items: DescargaDteItem[] })` donde `DescargaDteItem = { label: string; loadingLabel: string; icon: IconName; isLoading?: boolean; onClick: () => void }`.
- Produces: nada que otros tasks consuman.

**Contexto:** FSE no usa `DteSection`; su panel espejo `FseDtePanel` tiene botones propios. Se reemplazan solo "Descargar PDF oficial" y "Descargar JSON"; el botón "Descargar constancia de retención" (documento legal distinto, visible cuando `reteRenta > 0`) **se queda como está**.

- [ ] **Step 1: Integrar el menú**

a) Agregar el import junto a los existentes (tras la línea 7, `import { EstadoDteBadge } ...`):

```tsx
import { DteDescargasMenu } from '@/components/dte/DteDescargasMenu';
```

b) En el bloque APROBADO, reemplazar los dos primeros botones (líneas 146-152). Antes:

```tsx
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" className={btnPrimary} onClick={() => props.onDescargarPdf?.()} disabled={props.isDescargandoPdf}>
              <Icon name="download" size={14} /> {props.isDescargandoPdf ? 'Generando…' : 'Descargar PDF oficial'}
            </button>
            <button type="button" className={btnSecondary} onClick={() => props.onDescargarJson?.()} disabled={props.isDescargandoJson}>
              <Icon name="download" size={14} /> {props.isDescargandoJson ? 'Obteniendo…' : 'Descargar JSON'}
            </button>
```

Después:

```tsx
          <div className="flex flex-wrap gap-2 mt-3">
            <DteDescargasMenu
              items={[
                {
                  label: 'PDF oficial',
                  loadingLabel: 'Generando…',
                  icon: 'fileText',
                  isLoading: props.isDescargandoPdf,
                  onClick: () => props.onDescargarPdf?.(),
                },
                {
                  label: 'JSON',
                  loadingLabel: 'Obteniendo…',
                  icon: 'clipboard',
                  isLoading: props.isDescargandoJson,
                  onClick: () => props.onDescargarJson?.(),
                },
              ]}
            />
```

Los botones siguientes ("Descargar constancia de retención" condicional y "Anular DTE") quedan intactos. Nota: el array inline se tipa por contexto contra `DescargaDteItem[]`; si `tsc` ensancha `icon` a `string`, extraer el array a una constante `const itemsDescarga: DescargaDteItem[] = [...]` antes del `return` e importar el tipo:

```tsx
import type { DescargaDteItem } from '@/components/dte/DteDescargasMenu';
```

- [ ] **Step 2: Verificar**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: ambos sin errores.

Verificación visual (si el dev server está corriendo): en un FSE con DTE APROBADO, el panel muestra "Descargar ▾" (menú con PDF oficial y JSON) y, si tiene retención, el botón separado "Descargar constancia de retención".

- [ ] **Step 3: Commit**

```bash
git add components/fse/FseDtePanel.tsx
git commit -m "feat(fse): usar el botón unificado de descargas del DTE en el panel FSE

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Verificación final (checklist del spec)

- [ ] `pnpm tsc --noEmit` y `pnpm lint` sin errores.
- [ ] Dashboard: las barras de "Utilización de flota" muestran el nombre de cada categoría real de la BD.
- [ ] Detalle de factura ≥ `lg`: columna derecha = Progreso de cobro + Período de renta + Acta(s) físicas + Actas vinculadas. A 768px apila en una columna sin romperse.
- [ ] Card DTE de factura aprobada: "Descargar ▾" con PDF oficial y JSON. Nota de crédito: botón directo sin menú. FSE: menú + constancia aparte.
- [ ] Dark mode sin regresiones (los cambios solo usan tokens existentes: `bg-accent`, `text-navy`, `bg-bg`, `border-bd`, `bg-bg-sunken`).
