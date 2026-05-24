# Spec — Rama 7 `feat/andamios`

**Fecha:** 2026-05-24
**Branch:** `feat/andamios`
**Rama del plan:** 7 (de `docs/plan-trabajo-frontend.md`)
**Estado:** aprobado por el usuario, pendiente de implementación

---

## 1. Objetivo

Implementar el módulo de Andamios del ERP de Reinar, que gestiona dos entidades:

- **Pieza** (`PiezaTipo`): unidades individuales con inventario (`stockActual`, `stockMinimo`) y tres tarifas de renta (día, semana, mes).
- **Cuerpo** (`CuerpoTipo`): configuración tipo BOM — combinación de piezas con cantidades. El backend computa `stockCuerposDisponibles` como el mínimo entre `pieza.stockActual / componente.cantidad` para todos los componentes activos.

El módulo permite CRUD de ambas entidades, activación/desactivación, ajuste de stock auditado de piezas, simulación de expansión de cuerpos (vista previa que devuelve desglose de piezas y tarifa, sin mutar stock) y cross-references (qué cuerpos usan una pieza, qué piezas componen un cuerpo).

## 2. Alcance

### Incluye (esta rama)

- Cambio retrocompatible al backend de andamios: query param `?incluirInactivos=true` en `GET /piezas` y `GET /cuerpos`.
- Rutas frontend completas para piezas y cuerpos (lista, crear, detalle, editar).
- Inventario visible: stock actual con alerta visual cuando `stockActual ≤ stockMinimo`.
- Ajuste de stock inline con motivo obligatorio (ADMIN/GERENTE/LOGISTICA).
- Simulación de "Expandir cuerpo" (POST `/cuerpos/:id/expandir`) inline en detalle de cuerpo.
- Activar / desactivar piezas y cuerpos (ADMIN/GERENTE).
- Filtros client-side: búsqueda por nombre/ID, chip "Stock bajo", chip "Incluir inactivos".
- Permisos por rol aplicados en UI; VISUALIZADOR sin botones de escritura.

### NO incluye (deuda documentada)

- Realtime de stock (backend no emite eventos para andamios).
- Expansión real con mutación de stock — el endpoint actual es preview; la mutación real ocurrirá desde actas de entrega (rama 12).
- Historial de ajustes de stock (existe `AuditLog` en backend pero la lectura/visualización no se expone aún).
- Mantenimientos de piezas (fuera del plan de rama 7).

## 3. Backend — cambio mínimo retrocompatible

Toca tres archivos en `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/andamios/`.

### 3.1 `andamios.schemas.ts`

Añadir `incluirInactivos` a `filtrosPiezaTipoSchema` y crear `filtrosCuerpoTipoSchema`:

```typescript
const toBool = (v: unknown) => v === 'true' || v === true;

export const filtrosPiezaTipoSchema = z.object({
  stockBajo: z.preprocess(toBool, z.boolean()).optional(),
  incluirInactivos: z.preprocess(toBool, z.boolean()).optional(),
});

export const filtrosCuerpoTipoSchema = z.object({
  incluirInactivos: z.preprocess(toBool, z.boolean()).optional(),
});

export type FiltrosCuerpoTipo = z.infer<typeof filtrosCuerpoTipoSchema>;
```

### 3.2 `andamios.service.ts`

```typescript
export async function listarPiezasTipo(filtros: FiltrosPiezaTipo) {
  const where = filtros.incluirInactivos ? {} : { activo: true };
  const piezas = await prisma.piezaTipo.findMany({ where, orderBy: { nombre: 'asc' } });
  if (filtros.stockBajo) return piezas.filter((p) => p.stockActual <= p.stockMinimo);
  return piezas;
}

export async function listarCuerposTipo(filtros: FiltrosCuerpoTipo) {
  const where = filtros.incluirInactivos ? {} : { activo: true };
  const cuerpos = await prisma.cuerpoTipo.findMany({
    where, orderBy: { nombre: 'asc' }, select: SELECT_CUERPO_CON_BOM,
  });
  return cuerpos.map((c) => ({ ...c, stockCuerposDisponibles: calcularStockCuerpos(c) }));
}
```

### 3.3 `andamios.controller.ts` y `andamios.routes.ts`

- `listarCuerpos` pasa de `service.listarCuerposTipo()` a `service.listarCuerposTipo(req.query as unknown as FiltrosCuerpoTipo)`.
- Ruta `GET /cuerpos` añade `validateQuery(filtrosCuerpoTipoSchema)` antes del controller.

Sin migración de schema. Sin nuevos endpoints. Comportamiento sin query params se mantiene idéntico al actual.

## 4. Frontend — estructura de archivos

### 4.1 Rutas (App Router)

```
app/(dashboard)/andamios/
  page.tsx                          # Server Component shell — renderiza <AndamiosTabs>
  piezas/
    nuevo/page.tsx                  # 'use client' — <PiezaForm modo="crear">
    [id]/
      page.tsx                      # 'use client' — detalle de pieza
      editar/page.tsx               # 'use client' — <PiezaForm modo="editar">
  cuerpos/
    nuevo/page.tsx                  # 'use client' — <CuerpoForm modo="crear">
    [id]/
      page.tsx                      # 'use client' — detalle de cuerpo
      editar/page.tsx               # 'use client' — <CuerpoForm modo="editar">
```

### 4.2 Componentes y hooks

```
hooks/use-andamios.ts               # todos los hooks de React Query del módulo
lib/schemas/andamios.ts             # zod schemas para RHF
lib/api-errors.ts                   # helper mapApiError() compartido (nuevo)

components/andamios/
  AndamiosTabs.tsx                  # tabs Piezas/Cuerpos, persiste tab en sessionStorage
  piezas/
    PiezasTable.tsx                 # listado + FilterBar
    PiezaForm.tsx                   # form RHF crear/editar
    PiezaStockCard.tsx              # tarjeta de inventario con barra de progreso
    PiezaTarifasCard.tsx            # tarjeta de tarifas día/semana/mes
    AjusteStockPanel.tsx            # panel inline para PATCH /stock
    CuerposQueLaUsanCard.tsx        # cross-reference: cuerpos que usan esta pieza
  cuerpos/
    CuerposTable.tsx                # listado + FilterBar
    CuerpoForm.tsx                  # form RHF con useFieldArray para componentes
    CuerpoComponentesCard.tsx       # tabla de piezas + subtotales
    ExpandirCuerpoPanel.tsx         # panel inline para POST /expandir (preview)

types/api.ts                        # añadir PiezaTipo, CuerpoTipo, CuerpoComponente, ExpandirCuerpoItem
```

`lib/nav.ts` ya tiene `{ id: 'andamios', label: 'Andamios', href: '/andamios', icon: 'layers' }` — no requiere cambios.

## 5. Modelo de datos (tipos frontend)

Añadir a `types/api.ts`:

```typescript
export interface PiezaTipo {
  id: string;
  nombre: string;
  descripcion: string | null;
  stockActual: number;       // int
  stockMinimo: number;       // int
  tarifaDia: string;         // Decimal serializado por backend
  tarifaSemana: string;
  tarifaMes: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CuerpoComponente {
  id: string;
  cantidad: number;
  piezaTipo: {
    id: string;
    nombre: string;
    stockActual: number;
    activo: boolean;
  };
}

export interface CuerpoTipo {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  componentes: CuerpoComponente[];
  stockCuerposDisponibles: number;
}

export interface ExpandirCuerpoItem {
  tipoPiezaId: string;
  nombre: string;
  cantidad: number;
  tarifaCatalogo: string;    // Decimal del periodo seleccionado
}
```

## 6. Schemas Zod (`lib/schemas/andamios.ts`)

```typescript
// Base con campos comunes. Editar omite stockActual.
const piezaBaseSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(100),
  descripcion: z.string().optional(),
  stockMinimo: z.coerce.number().int().min(0),
  tarifaDia: z.coerce.number().positive('Debe ser mayor a 0'),
  tarifaSemana: z.coerce.number().positive('Debe ser mayor a 0'),
  tarifaMes: z.coerce.number().positive('Debe ser mayor a 0'),
});

export const piezaCrearSchema = piezaBaseSchema.extend({
  stockActual: z.coerce.number().int().min(0),
});

export const piezaEditarSchema = piezaBaseSchema;

export const ajusteStockSchema = z.object({
  tipo: z.enum(['ENTRADA', 'SALIDA']),
  cantidad: z.coerce.number().int().positive(),
  motivo: z.string().min(1, 'El motivo es requerido').max(255),
});

export const cuerpoFormSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(150),
  descripcion: z.string().optional(),
  componentes: z.array(z.object({
    piezaTipoId: z.string().min(1, 'Seleccioná una pieza'),
    cantidad: z.coerce.number().int().min(1),
  })).min(1, 'Al menos un componente'),
}).refine(
  (data) => new Set(data.componentes.map(c => c.piezaTipoId)).size === data.componentes.length,
  { message: 'No puede haber piezas duplicadas en el BOM', path: ['componentes'] }
);

export const expandirSchema = z.object({
  cantidad: z.coerce.number().int().min(1),
  periodo: z.enum(['DIA', 'SEMANA', 'MES']),
});

export type PiezaCrearInput  = z.infer<typeof piezaCrearSchema>;
export type PiezaEditarInput = z.infer<typeof piezaEditarSchema>;
export type AjusteStockInput = z.infer<typeof ajusteStockSchema>;
export type CuerpoFormInput  = z.infer<typeof cuerpoFormSchema>;
export type ExpandirInput    = z.infer<typeof expandirSchema>;
```

**Decisión clave:** `stockActual` solo se envía al **crear** (stock inicial), por eso se usa un schema distinto en crear vs editar. En edición el campo se oculta del form y se muestra un hint "El stock se ajusta desde el detalle". Los cambios posteriores van por el endpoint dedicado de ajuste, que requiere motivo y queda auditado.

## 7. Hooks de React Query (`hooks/use-andamios.ts`)

### Query keys

```typescript
const KEYS = {
  piezas: (filtros?: { stockBajo?: boolean; incluirInactivos?: boolean }) =>
    ['andamios', 'piezas', filtros ?? {}] as const,
  pieza: (id: string) => ['andamios', 'piezas', id] as const,
  cuerpos: (filtros?: { incluirInactivos?: boolean }) =>
    ['andamios', 'cuerpos', filtros ?? {}] as const,
  cuerpo: (id: string) => ['andamios', 'cuerpos', id] as const,
};
```

### Queries

- `usePiezas(filtros?)` → `GET /andamios/piezas?stockBajo&incluirInactivos`
- `usePieza(id)` → `GET /andamios/piezas/:id`
- `useCuerpos(filtros?)` → `GET /andamios/cuerpos?incluirInactivos`
- `useCuerpo(id)` → `GET /andamios/cuerpos/:id`

### Mutations e invalidaciones

| Hook | Endpoint | Invalida | Toast éxito | Navegación |
|---|---|---|---|---|
| `useCrearPieza` | POST `/piezas` | `['andamios','piezas']` | "Pieza creada correctamente" | `/andamios/piezas/[id]` |
| `useActualizarPieza` | PUT `/piezas/:id` | `['andamios','piezas']` + `pieza(id)` | "Pieza actualizada" | volver al detalle |
| `useAjustarStockPieza` | PATCH `/piezas/:id/stock` | `pieza(id)` + `['andamios','piezas']` + `['andamios','cuerpos']` | "Stock ajustado correctamente" | cierra panel |
| `useCambiarEstadoPieza` | PATCH `/piezas/:id/estado` | ambos listados + `pieza(id)` | "Pieza activada / desactivada" | — |
| `useCrearCuerpo` | POST `/cuerpos` | `['andamios','cuerpos']` | "Configuración creada" | `/andamios/cuerpos/[id]` |
| `useActualizarCuerpo` | PUT `/cuerpos/:id` | `['andamios','cuerpos']` + `cuerpo(id)` | "Configuración actualizada" | volver al detalle |
| `useCambiarEstadoCuerpo` | PATCH `/cuerpos/:id/estado` | listado + `cuerpo(id)` | "Configuración activada / desactivada" | — |
| `useExpandirCuerpo` | POST `/cuerpos/:id/expandir` | — (no muta) | — (resultado inline) | — |

**Por qué `useAjustarStockPieza` invalida también el listado de cuerpos:** el `stockCuerposDisponibles` computado por backend depende del `stockActual` de cada pieza componente.

**Por qué `useExpandirCuerpo` es mutation sin invalidación:** el backend no muta nada (es vista previa), pero usa POST con body. El componente guarda el resultado en estado local y lo vuelve a disparar si cambian los inputs.

### Conversión de UI a payload (caso ajuste de stock)

La UI usa `{ tipo: 'ENTRADA'|'SALIDA', cantidad, motivo }`; el backend espera `{ delta, motivo }` con `delta` firmado. La conversión se hace dentro del `mutationFn`, no en el componente:

```typescript
mutationFn: (input: AjusteStockInput) => api.patch(`/andamios/piezas/${id}/stock`, {
  delta: input.tipo === 'ENTRADA' ? input.cantidad : -input.cantidad,
  motivo: input.motivo,
}),
```

## 8. Manejo de errores

### Helper compartido `lib/api-errors.ts`

```typescript
export function mapApiError(
  err: unknown,
  setError: UseFormSetError<any>,
  fieldMap?: Record<string, string>,  // ej. { "nombre": "nombre" }
): void {
  // Extrae err.response?.data?.error?.{code, message, details}
  // VALIDATION_ERROR con details[] → setError(path, message) por cada detalle
  // CONFLICT cuyo mensaje contiene una key de fieldMap → setError(campo, ...)
  // ESTADO_INVALIDO o cualquier otro → toast.error(message)
  // Sin respuesta del servidor → toast.error('Error de red')
}
```

### Por mutation

- **Crear / editar (forms):** `onError: (err) => mapApiError(err, setError, { 'nombre': 'nombre' })`. Errores de unicidad en `nombre` aparecen inline; el resto cae a toast.
- **Ajuste de stock:** `ESTADO_INVALIDO` (stock quedaría negativo) → `toast.error` con el mensaje del backend (incluye el valor que quedaría).
- **Crear/editar cuerpo con pieza inactiva:** backend devuelve 409 `CONFLICT` con mensaje "Tipo de pieza X está inactivo" → `toast.error`. El select del form ya filtra inactivas; este error solo aparece si la pieza se desactivó mientras el form estaba abierto.
- **Expandir cuerpo:** errores → `toast.error`. El panel limpia el resultado anterior.

### Convención general (del CLAUDE.md, no se modifica)

- Errores 401: los maneja silenciosamente el interceptor de `lib/api.ts` con refresh + retry.
- Errores de validación de formulario: inline con `setError`, **nunca** toast.
- Errores de red o backend no manejados en formulario: `toast.error`.
- Cambios de UI (abrir panel, expandir fila): sin toast.

## 9. Detalle de páginas y componentes

### 9.1 `/andamios` — Lista con tabs

**`page.tsx`** (Server Component): renderiza `<AndamiosTabs>`.

**`<AndamiosTabs>`** ('use client'):
- Lee/escribe `andamios:lastTab` en `sessionStorage` (sin query param porque las URLs públicas del módulo apuntan a entidades, no a tabs).
- Header: `<PageHeader title="Andamios" subtitle="Catálogo de piezas y configuraciones de cuerpo." actions={...} />`.
- Botón "Nueva pieza" o "Nueva configuración" cambia según tab activo; oculto para VISUALIZADOR.
- Tabs implementados con `<button>` + `aria-selected`, estilados con Tailwind (`border-b-2`, classes condicionales según activo). Sin CSS vanilla.
- Tabs muestran contador: `Piezas (N)`, `Cuerpos (N)` — los datos vienen de `usePiezas()` y `useCuerpos()` ya cacheados.

**`<PiezasTable>`:**
- Usa `usePiezas({ stockBajo, incluirInactivos })`.
- `<FilterBar>` con búsqueda cliente por nombre/ID + chips: `Stock bajo (N)`, `Incluir inactivos`.
- Columnas: ID (mono), Pieza (nombre + descripción), Stock actual (con icono `alertTriangle` si bajo, color `text-warn`), Stock mínimo, Tarifa/día, Estado (`<Badge>`).
- Fila clickeable → `router.push('/andamios/piezas/[id]')`.
- Estado vacío: `<EmptyState />`.

**`<CuerposTable>`:**
- Usa `useCuerpos({ incluirInactivos })`.
- `<FilterBar>` con búsqueda + chip `Incluir inactivos`.
- Columnas: ID, Configuración (nombre + descripción), Piezas distintas, **Disponibles** (`stockCuerposDisponibles`, color `text-warn` si =0), Estado.
- Fila clickeable → `router.push('/andamios/cuerpos/[id]')`.

### 9.2 `/andamios/piezas/[id]` — Detalle de pieza

**Header:** título = nombre. Subtítulo = ID mono + badge de estado. Back a `/andamios`.

**Actions:**
- "Editar" (oculto para VISUALIZADOR) → navega a `/editar`.
- "Ajustar stock" (visible para ADMIN/GERENTE/LOGISTICA) → expande `<AjusteStockPanel>` inline.
- "Desactivar" / "Activar" (ADMIN/GERENTE) — abre `<ConfirmRow>` inline.

**Layout principal:** `<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">`.

**Columna izquierda:**
- `<PiezaStockCard>`: número grande de stock actual (mono, `text-3xl`, color `text-warn` si bajo). Barra de progreso (`h-1.5 bg-bg-sunken rounded-full` + `<div style={{width: pct+'%'}} className="h-full bg-ok rounded-full" />`). Mensaje "Stock bajo — pedir reposición" si aplica.
  - `pct = Math.min(100, (stockActual / Math.max(1, stockMinimo * 2)) * 100)` — el doble del mínimo se considera "lleno".
- `<PiezaTarifasCard>`: `<dl>` con tarifaDia/Semana/Mes formateadas con `formatCurrency()`.

**Columna derecha:**
- Tarjeta de descripción.
- `<CuerposQueLaUsanCard>`: usa `useCuerpos({ incluirInactivos: true })` y filtra cliente los cuerpos cuyos `componentes[].piezaTipo.id === piezaId`. Muestra nombre + cantidad requerida. Click navega a `/andamios/cuerpos/[id]`. Si vacío: mensaje compacto.

**`<AjusteStockPanel>`:**
- Tarjeta con borde izquierdo de color de acento (`border-l-2 border-yellow`).
- Header: título "Ajustar stock" + botón cerrar (`<Icon name="x" />`).
- Form (RHF + `ajusteStockSchema`):
  - Segmented control `[Entrada | Salida]` (componente `<button>` agrupado con Tailwind).
  - Input numérico para cantidad.
  - Textarea para motivo (requerido).
- Vista previa derivada (cliente, sin llamada): "Stock resultante: 42" en mono. Color `text-warn` si quedaría ≤ stockMinimo, `text-danger` si quedaría negativo (RHF bloquea el submit antes, pero la preview avisa visualmente).
- `<ConfirmRow message="Confirmar ajuste de stock" ... />` al pie con Cancelar / Confirmar.
- En `onSuccess`: cierra panel, `toast.success('Stock ajustado correctamente')`.
- En `onError`: `ESTADO_INVALIDO` → `toast.error(message)`.

### 9.3 `/andamios/cuerpos/[id]` — Detalle de cuerpo

**Header:** título = nombre. Subtítulo = ID mono + badge.

**Actions:**
- "Editar" → `/editar`.
- "Expandir cuerpo" → expande `<ExpandirCuerpoPanel>` inline. Deshabilitado si `!cuerpo.activo` con `title="Configuración inactiva"`.
- "Desactivar" / "Activar" → `<ConfirmRow>` inline.

**Layout:**
- Grid 2 columnas con tarjetas: Descripción / Resumen.
  - Resumen: `<dl>` con Piezas distintas, Total unidades, **Disponibles para armar** (`stockCuerposDisponibles`), Tarifa diaria estimada.
- Tarjeta full-width: `<CuerpoComponentesCard>` — tabla con columnas Pieza ID, Pieza, Cantidad, Tarifa/día c/u, Subtotal/día. Fila total al pie en `bg-bg-sunken`.

**`<ExpandirCuerpoPanel>`:**
- Tarjeta con borde izquierdo de acento.
- Form (RHF + `expandirSchema`):
  - Input cantidad (number, min 1).
  - Segmented `[Día | Semana | Mes]` para periodo.
- Al cambiar inputs dispara `useExpandirCuerpo({ cantidad, periodo })`.
- Resultado: tabla con Pieza, Cantidad total, Tarifa unitaria, Subtotal. Fila total al pie.
- Banner informativo con `<Icon name="info" />`: "Esta vista es un cálculo. No descuenta stock."
- Botón "Cerrar" (no "Confirmar" — es simulación).

### 9.4 Formularios

Ambos siguen el patrón ya en uso (clientes/herramientas):

- `useForm({ resolver: zodResolver(schema), defaultValues })`.
- Layout en `<FormSection>` con `grid grid-cols-1 md:grid-cols-2 gap-4`.
- Errores RHF inline bajo cada campo en `text-xs text-danger`.
- Footer pegado al pie con `<div className="sticky bottom-0 ...">` con botones Cancelar / Guardar.
- En `onSubmit`: dispara mutation; en `onError` se invoca `mapApiError(err, setError, { 'nombre': 'nombre' })`.

**`<PiezaForm>`:**
- Tarjeta "Información": nombre, descripción, stockActual (solo modo "crear"), stockMinimo.
- Tarjeta "Tarifas": tarifaDia, tarifaSemana, tarifaMes — todos `inputMode="decimal"`, mono.

**`<CuerpoForm>`:**
- Tarjeta "Información": nombre, descripción.
- Tarjeta "Componentes" con `useFieldArray`:
  - Tabla con `<select>` de pieza (filtrado a `activo === true` via `usePiezas()`), input cantidad, subtotal/día calculado, botón eliminar.
  - Botón "Agregar pieza" → `append({ piezaTipoId: '', cantidad: 1 })`.
  - Fila total al pie.
  - Validación: error inline si duplicados o array vacío (del `.refine` del schema).

### 9.5 Permisos en UI

```typescript
const { user } = useAuthStore();
const puedeEscribir     = user && user.rol !== 'VISUALIZADOR';
const puedeAjustarStock = user && ['ADMIN','GERENTE','LOGISTICA'].includes(user.rol);
const puedeAdministrar  = user && ['ADMIN','GERENTE'].includes(user.rol);
```

Botones condicionados con estas flags. Las páginas `/nuevo` y `/editar` redirigen a la lista con `toast.error('No tenés permisos para esta acción')` si VISUALIZADOR accede por URL directa (efecto en `useEffect` al montar).

## 10. Convenciones aplicadas (referencia)

- **Idioma:** 100% español en UI, mensajes de error, comentarios.
- **Tailwind:** solo clases predefinidas; sin valores arbitrarios; sin CSS vanilla. Si falta token, definirlo en `@theme` o `@layer utilities`.
- **Decimal:** todos los montos del backend son strings — usar `new Decimal()` para operar y `formatCurrency()` para mostrar; nunca `parseFloat`.
- **Toasts:** según tabla de la sección 7. Validación de formulario siempre inline.
- **Server vs Client:** `page.tsx` Server por defecto; subir a 'use client' solo donde se necesite (todos los detalles y forms son client por React Query / RHF).
- **Comentarios:** solo "why" en español, en decisiones no obvias.

## 11. Edge cases cubiertos

| Caso | Comportamiento |
|---|---|
| Crear cuerpo con piezas duplicadas | `.refine()` del schema + 400 del backend → error inline. |
| Crear cuerpo con pieza inactiva | Select del form filtra inactivas. Si la pieza se desactiva mientras el form está abierto → backend 409 → toast. |
| Ajuste de stock que dejaría negativo | Backend 422 `ESTADO_INVALIDO` → toast con el valor exacto. Preview en UI ya advierte visualmente. |
| Cuerpo con piezas inactivas | `stockCuerposDisponibles = 0`. Detalle muestra warn. "Expandir cuerpo" deshabilitado (revalidado por backend 409 igual). |
| Pieza no incluida en ningún cuerpo | `<CuerposQueLaUsanCard>` muestra mensaje vacío compacto. |
| Conflictos de nombre único | Backend 409 con mensaje "Ya existe..."; `mapApiError` lo coloca inline en `setError('nombre', ...)`. |
| VISUALIZADOR accede por URL a `/nuevo` o `/editar` | Redirect a la lista + toast.error de permisos. |
| Stock inicial 0 al crear | Permitido; el detalle simplemente muestra 0 con `bajo = true`. |
| Cambiar nombre a uno existente al editar | Backend 409 → inline en campo `nombre`. |

## 12. Plan de implementación (orden sugerido)

1. **Backend:** `incluirInactivos` en piezas + cuerpos (schemas + service + controller + routes). Probar con curl.
2. **Types + schemas + helper:** `types/api.ts`, `lib/schemas/andamios.ts`, `lib/api-errors.ts`.
3. **Hooks:** `hooks/use-andamios.ts` completo (todas las queries y mutations).
4. **Lista `/andamios`:** `AndamiosTabs` + `PiezasTable` + `CuerposTable` con filtros.
5. **Detalle pieza** + `AjusteStockPanel` + `CuerposQueLaUsanCard`.
6. **Form pieza** (crear + editar como mismo componente con prop `modo`).
7. **Detalle cuerpo** + `ExpandirCuerpoPanel`.
8. **Form cuerpo** (crear + editar) con `useFieldArray`.
9. **Cambios de estado** (activar/desactivar) en ambos detalles.
10. **Pasada manual:** dark mode, viewport 768px, VISUALIZADOR, formularios con errores, ajuste stock con motivo vacío.

## 13. Checklist antes de PR

- [ ] Cambio backend con `incluirInactivos` aplicado y probado.
- [ ] Datos reales del backend (sin mock).
- [ ] Formularios con errores inline (`setError`) + toasts según convención.
- [ ] VISUALIZADOR sin botones de escritura; URLs `/nuevo` y `/editar` redirigen.
- [ ] Filtros funcionan: stock bajo, incluir inactivos, búsqueda cliente por nombre/ID.
- [ ] Dark mode no rompe layout (`data-theme="dark"` en `<html>`).
- [ ] Tablet 768px usable.
- [ ] Sin clases vanilla CSS; sin valores arbitrarios de Tailwind; comentarios "why" en español.
- [ ] Todas las mutations con `toast.success` en `onSuccess` y manejo de error correcto.
- [ ] `pnpm tsc --noEmit` sin errores.
- [ ] `pnpm lint` sin errores.

## 14. Referencias

- Plan original: `docs/plan-trabajo-frontend.md` → Rama 7.
- Backend: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/andamios/` (controller, service, schemas, routes).
- Modelos Prisma: `/Users/joaquinmorales13a06/Desktop/Reinar/server/prisma/schema.prisma` → `PiezaTipo`, `CuerpoTipo`, `CuerpoComponente`.
- Prototipo visual: `/Users/joaquinmorales13a06/Downloads/Frontend-REINAR-design/andamios.jsx`.
- Convenciones: `CLAUDE.md` del frontend.
