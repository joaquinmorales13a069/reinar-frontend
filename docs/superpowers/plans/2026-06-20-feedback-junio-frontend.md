# Frontend Feedback Junio (E1–E8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portar al frontend los 13 puntos de feedback (epics E1–E8) cuyo backend ya está mergeado, espejando el contrato del backend.

**Architecture:** Next.js 19 App Router. El frontend consume `http://localhost:3000/api/v1` vía `lib/api.ts` (Axios). Cada epic toca constantes de permisos, hooks de React Query, páginas/componentes. Todo el trabajo va en la rama `feat/feedback-junio-frontend` con **un commit por epic**.

**Tech Stack:** React 19, React Query, React Hook Form + Zod, Tailwind v4, Zustand (auth), decimal.js, sonner (toasts).

## Global Constraints

- No hay suite de tests en el frontend. **El ciclo de verificación de cada tarea es `pnpm tsc --noEmit` + `pnpm lint`** (ambos deben pasar sin errores nuevos). Donde aplique, se indica una verificación manual adicional.
- **Un commit por epic** (instrucción explícita del usuario, sobrescribe "commit por tarea"). Los pasos intermedios NO commitean; el commit va al final de cada epic.
- Mensajes de commit: convención del repo `feat(modulo): …` / `fix(modulo): …` en español, terminando con la línea `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Convenciones CLAUDE.md: errores del backend inline con `setError` (no toast); toasts en mutations; montos con `Number()` al cargar / `type="number"` en inputs / `formatCurrency`/`new Decimal()` al mostrar (nunca `parseFloat`); solo clases Tailwind predefinidas (sin valores arbitrarios `h-[20px]`); botones de escritura ocultos a VISUALIZADOR; 100% español.
- Orden de ejecución: **E1 → E2 → E3 → E5 → E6 → E4 → E7 → E8**.
- Rama: `feat/feedback-junio-frontend` (ya creada; el spec ya está commiteado ahí).
- Patrón de permisos: cada `lib/<modulo>.ts` exporta `PERMISOS_<MODULO>` (objeto de `accion: string[]`) + un helper `puede…(accion, rol)`. La verdad operativa es el backend; el frontend solo oculta botones.

---

## Task 1 (E1): Permisos LOGISTICA sobre inventario + reportes

**Files:**
- Modify: `lib/equipos.ts:96-103`
- Modify: `lib/herramientas.ts:47-57`
- Modify: `lib/bodegas.ts:3-7`
- Modify: `lib/andamios.ts:8-17`
- Modify: `lib/permisos-nav.ts:36`
- Verify: `app/(dashboard)/reportes/page.tsx` (sin cambios esperados; solo verificación)

**Interfaces:**
- Produces: ninguna firma nueva — solo se amplían arrays de roles existentes. Los helpers `puedeEjecutar`/`puedeEjecutarBodega`/`puedeEjecutarAndamios`/`puedeVerNavItem` no cambian de firma.

- [ ] **Step 1: Ampliar permisos de equipos**

En `lib/equipos.ts`, reemplazar el objeto `PERMISOS_EQUIPOS` (L96-103) por:

```typescript
export const PERMISOS_EQUIPOS = {
  crear: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  editar: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  cambiarEstado: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  subirImagen: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  eliminar: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  verInactivos: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
};
```

- [ ] **Step 2: Ampliar permisos de herramientas y consumibles**

En `lib/herramientas.ts`, reemplazar `PERMISOS_HERRAMIENTAS` (L47-57) por:

```typescript
export const PERMISOS_HERRAMIENTAS = {
  crearTipo: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  editarTipo: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  desactivarTipo: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  crearUnidad: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  cambiarEstadoUnidad: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  crearConsumible: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  editarConsumible: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  desactivarConsumible: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  ajustarStock: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
} as const;
```

- [ ] **Step 3: Ampliar permisos de bodegas**

En `lib/bodegas.ts`, reemplazar `PERMISOS_BODEGAS` (L3-7) por (actualizar también el comentario L1-2 para reflejar que LOGISTICA ahora escribe — decisión D5 del backend):

```typescript
// Espejo de server/src/modules/bodegas/bodegas.routes.ts: ADMIN/GERENTE/LOGISTICA
// pueden crear, editar o cambiar estado de bodegas y zonas (decisión D5).
export const PERMISOS_BODEGAS = {
  crear:         ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  editar:        ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  cambiarEstado: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
} as const;
```

- [ ] **Step 4: Ampliar permisos de andamios (piezas y cuerpos)**

En `lib/andamios.ts`, reemplazar `PERMISOS_ANDAMIOS` (L8-17) por (las acciones de creación/edición/estado de piezas y cuerpos suman LOGISTICA; `ajustarStockPieza` y `expandirCuerpo` ya la incluían):

```typescript
export const PERMISOS_ANDAMIOS = {
  crearPieza:           ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  editarPieza:          ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  cambiarEstadoPieza:   ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  ajustarStockPieza:    ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  crearCuerpo:          ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  editarCuerpo:         ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  cambiarEstadoCuerpo:  ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  expandirCuerpo:       ['ADMIN', 'GERENTE', 'OPERADOR', 'LOGISTICA'] as const,
} as const;
```

- [ ] **Step 5: Agregar LOGISTICA al nav de Reportes**

En `lib/permisos-nav.ts:36`, cambiar:

```typescript
  reportes:        ['ADMIN', 'GERENTE', 'LOGISTICA'],
```

- [ ] **Step 6: Verificar el filtro de reportes para LOGISTICA**

Leer `app/(dashboard)/reportes/page.tsx`. Confirmar que `puedeVerExportables` sigue siendo solo `ADMIN`/`GERENTE` y que `puedeVerInventario` incluye `LOGISTICA`. La grilla filtra cards con la condición `t.id === 'inventario' ? puedeVerInventario : puedeVerExportables`, así que LOGISTICA solo verá Inventario (y luego Mantenimientos en E6). **No se requiere edición** salvo que la condición no cumpla esto; si no cumple, ajustarla para que LOGISTICA solo vea inventario/mantenimientos.

- [ ] **Step 7: Verificar tipos y lint**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: sin errores nuevos.

- [ ] **Step 8: Commit (cierre de E1)**

```bash
git add lib/equipos.ts lib/herramientas.ts lib/bodegas.ts lib/andamios.ts lib/permisos-nav.ts
git commit -m "$(cat <<'EOF'
feat(permisos): habilitar CRUD de inventario y reportes para LOGISTICA

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 (E2): Card de períodos de renta por línea en factura

**Files:**
- Modify: `types/api.ts` (agregar `PeriodosRentaDto` y, si falta, `periodoRentaInicio?`/`periodoRentaFin?` por item)
- Modify: `hooks/use-facturas.ts` (agregar `useActualizarPeriodosRenta(facturaId)`)
- Create: `components/facturas/detalle/PeriodosRentaCard.tsx`
- Modify: `app/(dashboard)/facturas/[id]/page.tsx` (montar el card)

**Interfaces:**
- Consumes: `useFactura(id)` → `Factura` con `factura.cotizacion.items: CotizacionItem[]` (cada item tiene `id` = `cotizacionItemId`, `descripcion`, `periodo`). `useAuthStore` para el rol.
- Produces:
  - `PeriodosRentaDto = { items: { cotizacionItemId: string; inicio: string; fin: string }[] }`
  - `useActualizarPeriodosRenta(facturaId: string)` → mutation `(data: PeriodosRentaDto) => Promise<Factura>`.
  - `<PeriodosRentaCard factura={Factura} />`.

- [ ] **Step 1: Tipos**

En `types/api.ts`, agregar cerca de los DTOs de factura:

```typescript
export type PeriodosRentaDto = {
  items: { cotizacionItemId: string; inicio: string; fin: string }[];
};
```

Si el tipo `CotizacionItem` (L711-736) no tiene `periodoRentaInicio`/`periodoRentaFin`, agregarlos como opcionales para poder precargar valores existentes:

```typescript
  periodoRentaInicio?: string | null;
  periodoRentaFin?: string | null;
```

- [ ] **Step 2: Hook de mutation**

En `hooks/use-facturas.ts`, agregar (mismo patrón que `useActualizarFactura`, usando el `extractErrorMessage` ya existente en el archivo):

```typescript
export function useActualizarPeriodosRenta(facturaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PeriodosRentaDto) =>
      api
        .patch<ApiResponse<Factura>>(`/facturas/${facturaId}/periodos-renta`, data)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error?.message ?? 'Error');
          return r.data.data;
        }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['factura', facturaId] });
      qc.invalidateQueries({ queryKey: ['facturas'] });
      toast.success('Períodos de renta actualizados');
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'No se pudieron guardar los períodos')),
  });
}
```

Asegurar que `PeriodosRentaDto` esté importado del barrel de `@/types/api` y que `toast` de `sonner` ya esté importado en el archivo (si no, agregarlo).

- [ ] **Step 3: Componente PeriodosRentaCard**

Crear `components/facturas/detalle/PeriodosRentaCard.tsx`. Requisitos concretos:
- `'use client'`.
- Props: `{ factura: Factura }`.
- Roles de escritura: `['ADMIN','GERENTE','OPERADOR']`. Leer rol con `useAuthStore((s) => s.user?.rol)`. Si el rol no escribe, renderizar la card en modo solo-lectura (mostrar los rangos guardados sin inputs ni botón Guardar).
- Si `factura.estado === 'ANULADA'`, mostrar la card deshabilitada con un aviso "Factura anulada — no editable".
- Estructura visual: una card siguiendo el patrón de las otras cards en `components/facturas/detalle/` (mismo contenedor/encabezado; mirar `ClienteFechasCard.tsx` como plantilla del marco visual). Título "Período de renta por línea".
- Cuerpo: iterar `factura.cotizacion.items`. Por cada item, una fila con: descripción (`item.descripcion`), dos `<input type="date">` (inicio / fin) controlados por estado local `Record<cotizacionItemId, { inicio: string; fin: string }>`, precargados de `item.periodoRentaInicio`/`Fin` (recortar a `YYYY-MM-DD`).
- Validación al guardar: por cada item con ambos campos llenos, exigir `inicio <= fin`; si alguno viola, mostrar mensaje inline en esa fila y no enviar. Las filas con ambos campos vacíos se omiten del envío; una fila con solo uno de los dos campos es inválida (mostrar inline "Completá inicio y fin").
- Botón "Guardar períodos" → construye `{ items: [...] }` solo con filas válidas y completas (convertir `YYYY-MM-DD` a ISO con `new Date(valor).toISOString()`), llama `useActualizarPeriodosRenta(factura.id).mutateAsync(dto)`.
- Errores del backend (400 ítem ajeno / 422 anulada / 404): capturar en `catch` y mostrar un mensaje a nivel de card (el hook ya toastea; además mostrar inline el `error.message` si viene en `err.response.data.error.message`).
- Clases: reutilizar las constantes de input/label/error del patrón del repo (`inputBase`/`labelCls`/`errorCls` como en `EquipoForm.tsx:54-59`); copiarlas al componente o a un helper local. Sin Tailwind arbitrario.

- [ ] **Step 4: Montar el card en el detalle de factura**

En `app/(dashboard)/facturas/[id]/page.tsx`, importar `PeriodosRentaCard` y renderizarlo dentro del layout de detalle, junto a las demás cards (p. ej. después de `ItemsFacturadosCard`). Pasar `factura={factura}`.

- [ ] **Step 5: Verificar**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: sin errores. Verificación manual sugerida: abrir una factura, capturar inicio/fin en una línea, guardar, recargar y confirmar que persisten.

- [ ] **Step 6: Commit (cierre de E2)**

```bash
git add types/api.ts hooks/use-facturas.ts components/facturas/detalle/PeriodosRentaCard.tsx "app/(dashboard)/facturas/[id]/page.tsx"
git commit -m "$(cat <<'EOF'
feat(facturas): capturar periodo de renta por linea para el PDF

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 (E3): Proveedores + Datos de compra + Ingresos de inventario

> Plantilla de referencia para el módulo CRUD: **Servicios** (`app/(dashboard)/servicios/`, `hooks/use-servicios.ts`, `components/servicios/`, `lib/servicios.ts`, `lib/schemas/servicios.ts`). Copiar su estructura y adaptar campos.

**Files:**
- Modify: `types/api.ts` (tipos `Proveedor`, `CrearProveedorDto`, `IngresoInventario`, `IngresoInventarioItem`, `DatosCompraDto`; extender DTOs de alta de equipo/unidad/consumible y `AjusteStockDto`)
- Create: `lib/proveedores.ts` (permisos)
- Create: `hooks/use-proveedores.ts`
- Create: `app/(dashboard)/proveedores/page.tsx`, `proveedores/nuevo/page.tsx`, `proveedores/[id]/page.tsx`, `proveedores/[id]/editar/page.tsx`
- Create: `components/proveedores/ProveedoresTable.tsx`, `components/proveedores/ProveedorForm.tsx`
- Create: `lib/schemas/proveedores.ts`
- Create: `components/inventario/DatosCompraFields.tsx`
- Create: `hooks/use-ingresos-inventario.ts`
- Create: `app/(dashboard)/ingresos-inventario/page.tsx`, `ingresos-inventario/[id]/page.tsx`
- Modify: `lib/nav.ts` (items Proveedores e Ingresos en grupo Inventario + BottomNav)
- Modify: `lib/permisos-nav.ts` (entradas `proveedores`, `ingresos-inventario`)
- Modify: `components/equipos/EquipoForm.tsx` (sección Datos de compra en crear)
- Modify: `components/herramientas/UnidadCreatePanel.tsx` (Datos de compra)
- Modify: `components/herramientas/ConsumibleForm.tsx` (Datos de compra en crear)
- Modify: `components/herramientas/AjusteStockPanel.tsx` (Datos de compra cuando es entrada)
- Modify: `hooks/use-herramientas.ts`, `hooks/use-consumibles.ts` (payloads con `datosCompra`)

**Interfaces:**
- Produces:
  - `Proveedor = { id; nombre; nrc?; nit?; contacto?; telefono?; email?; notas?; activo; createdAt; updatedAt }`
  - `CrearProveedorDto = { nombre: string; nrc?: string; nit?: string; contacto?: string; telefono?: string; email?: string; notas?: string }`
  - `DatosCompraDto = { valorUnitarioCompra: number; numeroFacturaCompra?: string; proveedorId?: string; fechaCompra?: string; numeroActaInterna?: string; notas?: string }`
  - `IngresoInventario`, `IngresoInventarioItem` (forma de consulta).
  - `lib/proveedores.ts`: `PERMISOS_PROVEEDORES` + `puedeEjecutarProveedor(accion, rol)`.
  - `hooks/use-proveedores.ts`: `useProveedores(params)`, `useProveedor(id)`, `useCrearProveedor()`, `useEditarProveedor()`, `useCambiarActivoProveedor()`.
  - `hooks/use-ingresos-inventario.ts`: `useIngresosInventario(params)`, `useIngresoInventario(id)`.
  - `<DatosCompraFields control={...} register={...} errors={...} />` (campos opcionales que se serializan a `datosCompra`).

### Subtarea 3A — Catálogo de Proveedores

- [ ] **Step 1: Tipos de Proveedor**

En `types/api.ts` agregar:

```typescript
export type Proveedor = {
  id: string;
  nombre: string;
  nrc?: string | null;
  nit?: string | null;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  notas?: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CrearProveedorDto = {
  nombre: string;
  nrc?: string;
  nit?: string;
  contacto?: string;
  telefono?: string;
  email?: string;
  notas?: string;
};
```

- [ ] **Step 2: Permisos**

Crear `lib/proveedores.ts`:

```typescript
// Espejo de server/src/modules/proveedores/proveedores.routes.ts:
// lectura todos los roles; escritura ADMIN/GERENTE/LOGISTICA.
export const PERMISOS_PROVEEDORES = {
  crear:         ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  editar:        ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  cambiarActivo: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
} as const;

export function puedeEjecutarProveedor(
  accion: keyof typeof PERMISOS_PROVEEDORES,
  rol: string | undefined,
): boolean {
  if (!rol) return false;
  return (PERMISOS_PROVEEDORES[accion] as readonly string[]).includes(rol);
}
```

- [ ] **Step 3: Schema Zod**

Crear `lib/schemas/proveedores.ts` (siguiendo `lib/schemas/servicios.ts`):

```typescript
import { z } from 'zod';

const proveedorBaseSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(150),
  nrc: z.string().max(50).optional(),
  nit: z.string().max(50).optional(),
  contacto: z.string().max(150).optional(),
  telefono: z.string().max(30).optional(),
  email: z.string().email('Correo inválido').max(150).optional().or(z.literal('')),
  notas: z.string().max(1000).optional(),
});

export const proveedorCrearSchema = proveedorBaseSchema;
export const proveedorEditarSchema = proveedorBaseSchema;
export type ProveedorFormValues = z.infer<typeof proveedorBaseSchema>;
```

- [ ] **Step 4: Hook**

Crear `hooks/use-proveedores.ts` espejando `hooks/use-servicios.ts`. Endpoints: `GET/POST /proveedores`, `GET/PUT /proveedores/:id`, `PATCH /proveedores/:id/activo`. Firmas:
- `useProveedores(params: { page?: number; limit?: number; search?: string; activo?: boolean })` → `PaginatedResponse<Proveedor>`, queryKey `['proveedores', params]`.
- `useProveedor(id: string | null)` → `Proveedor`, queryKey `['proveedor', id]`, `enabled: !!id`.
- `useCrearProveedor()` → `mutationFn(data: CrearProveedorDto)`, invalida `['proveedores']`, `toast.success('Proveedor creado')`.
- `useEditarProveedor()` → `mutationFn({ id, data }: { id: string; data: CrearProveedorDto })`, invalida `['proveedores']` y `['proveedor', id]`.
- `useCambiarActivoProveedor()` → `mutationFn({ id, activo }: { id: string; activo: boolean })` → `PATCH /proveedores/:id/activo` body `{ activo }`, invalida ambas.
Usar el mismo `extractErrorMessage` helper que use-servicios. Toasts en cada mutation.

- [ ] **Step 5: Tabla y formulario**

Crear `components/proveedores/ProveedoresTable.tsx` (copiar `ServiciosTable.tsx`): columnas #, Nombre, NRC/NIT, Contacto, Teléfono, Estado, Acciones (ver/editar). `<FilterBar>` con búsqueda + chip de Activo/Inactivo. `<Pagination>` (`pageSize: 20`). Botón "Nuevo proveedor" gated con `puedeEjecutarProveedor('crear', rol)`.

Crear `components/proveedores/ProveedorForm.tsx` (copiar `ServicioForm.tsx`): props `{ modo: 'crear' } | { modo: 'editar'; proveedor: Proveedor }`. Campos: nombre (req), nrc, nit, contacto, teléfono (usar `PhoneInputField` con `control`), email, notas. Validación con los schemas de Step 3. Errores backend inline con `setError` mapeando `error.details[]`. Al éxito navegar a `/proveedores/:id`.

- [ ] **Step 6: Páginas**

Crear las 4 páginas copiando el patrón de servicios:
- `app/(dashboard)/proveedores/page.tsx`: `PageHeader` (título "Proveedores", subtítulo con total via `useProveedores({ page:1, limit:1 })`) + `<ProveedoresTable />`.
- `proveedores/nuevo/page.tsx`: gate con `puedeEjecutarProveedor('crear', rol)` (redirige si no), `<ProveedorForm modo="crear" />`.
- `proveedores/[id]/page.tsx`: `useProveedor(id)`, cards de detalle (datos + estado), botón editar gated, `<ConfirmRow>` para activar/desactivar con `useCambiarActivoProveedor`.
- `proveedores/[id]/editar/page.tsx`: gate con `editar`, `<ProveedorForm modo="editar" proveedor={proveedor} />`.

- [ ] **Step 7: Nav**

En `lib/nav.ts`, grupo Inventario (`NAV_GROUPS[2].items`), agregar el item Proveedores (elegir un icono existente de `Icon.tsx`, p.ej. `truck` si existe, si no `building`):

```typescript
      { id: 'proveedores',   label: 'Proveedores',  href: '/proveedores',  icon: 'building' },
```

Agregarlo también al grupo `inventario` del `BOTTOM_NAV_ITEMS` (children). En `lib/permisos-nav.ts` agregar `proveedores: ['ADMIN', 'GERENTE', 'OPERADOR', 'LOGISTICA', 'VISUALIZADOR']`.

### Subtarea 3B — Sección "Datos de compra" reutilizable

- [ ] **Step 8: Tipo DatosCompraDto y extensión de DTOs**

En `types/api.ts`:

```typescript
export type DatosCompraDto = {
  valorUnitarioCompra: number;
  numeroFacturaCompra?: string;
  proveedorId?: string;
  fechaCompra?: string;
  numeroActaInterna?: string;
  notas?: string;
};
```

Extender (campo opcional `datosCompra?: DatosCompraDto`): `CrearEquipoDto` (L151-165), `CrearUnidadDto` (L373), `CrearConsumibleDto` (L398-409), `AjusteStockDto` (L426-432).

- [ ] **Step 9: Componente DatosCompraFields**

Crear `components/inventario/DatosCompraFields.tsx`:
- `'use client'`. Props: `{ register, control, errors, prefix? }` (RHF). Todos los campos opcionales.
- `<FormSection title="Datos de compra">` con grid 2 col: N° factura compra (text), Proveedor (select del catálogo via `useProveedores({ limit: 200, activo: true })`), Fecha de compra (`type="date"`), Valor unitario de compra (`type="number" step="0.01"`, registrado con `valueAsNumber`), N° acta interna (text), Notas (textarea).
- Subschema Zod reutilizable exportado desde aquí o desde `lib/schemas/`:

```typescript
export const datosCompraSchema = z.object({
  valorUnitarioCompra: z.coerce.number().positive().optional(),
  numeroFacturaCompra: z.string().max(50).optional(),
  proveedorId: z.string().optional(),
  fechaCompra: z.string().optional(),
  numeroActaInterna: z.string().max(50).optional(),
  notas: z.string().max(500).optional(),
}).optional();
```

- Helper exportado `construirDatosCompra(values): DatosCompraDto | undefined` que devuelve `undefined` si `valorUnitarioCompra` no está definido (los datos de compra solo viajan si hay valor), o el objeto con `fechaCompra` convertida a ISO. **Regla**: el backend exige `valorUnitarioCompra` si se envía `datosCompra`; por eso si el usuario no llena el valor, se omite todo el objeto.

- [ ] **Step 10: Integrar en alta de Equipo**

En `components/equipos/EquipoForm.tsx`: extender el schema de crear para anidar `datosCompra` (opcional, usando `datosCompraSchema`), renderizar `<DatosCompraFields>` solo en modo crear (después de la sección de Tarifas), y en `onSubmit` (L153-166) agregar `datosCompra: construirDatosCompra(v.datosCompra)` al payload de `crear.mutateAsync`.

- [ ] **Step 11: Integrar en alta de Unidad de herramienta**

En `components/herramientas/UnidadCreatePanel.tsx`: agregar los campos de Datos de compra al panel (puede ser un bloque colapsable "Datos de compra (opcional)"). Extender el payload de `useCrearUnidad` (en `hooks/use-herramientas.ts`, `CrearUnidadDto`) con `datosCompra`. Construir con `construirDatosCompra`.

- [ ] **Step 12: Integrar en alta de Consumible**

En `components/herramientas/ConsumibleForm.tsx`: renderizar `<DatosCompraFields>` solo en modo crear; agregar `datosCompra` al payload de `useCrearConsumible`.

- [ ] **Step 13: Integrar en restock (entrada) de Consumible**

En `components/herramientas/AjusteStockPanel.tsx`: cuando el segmento sea **Entrada (+)** (delta>0), mostrar `<DatosCompraFields>` (opcional). En el submit (L75-77), si es entrada y hay datos de compra, incluir `datosCompra` en el body de `useAjustarStock`. **No** enviar `datosCompra` en salidas (delta≤0) — el backend devuelve 400.

### Subtarea 3C — Vista de Ingresos de Inventario

- [ ] **Step 14: Tipos de Ingreso**

En `types/api.ts`:

```typescript
export type IngresoInventarioItem = {
  id: string;
  valorUnitarioCompra: string; // Decimal string
  cantidad: number;
  equipoId?: string | null;
  herramientaUnidadId?: string | null;
  consumibleId?: string | null;
  // El backend incluye el destino resuelto (nombre/código) al consultar el detalle
  destino?: { tipo: 'EQUIPO' | 'HERRAMIENTA' | 'CONSUMIBLE'; codigo?: string; nombre?: string } | null;
};

export type IngresoInventario = {
  id: string;
  numeroFacturaCompra?: string | null;
  proveedorId?: string | null;
  proveedor?: Pick<Proveedor, 'id' | 'nombre'> | null;
  fechaCompra?: string | null;
  numeroActaInterna?: string | null;
  notas?: string | null;
  registradoPor?: { id: string; nombre: string } | null;
  createdAt: string;
  items?: IngresoInventarioItem[];
};
```

> Nota de discovery: confirmar la forma exacta de `items[].destino` y de `registradoPor` contra una respuesta real de `GET /ingresos-inventario/:id` antes de renderizar; ajustar el tipo si difiere.

- [ ] **Step 15: Hook de ingresos**

Crear `hooks/use-ingresos-inventario.ts`:
- `useIngresosInventario(params: { page?: number; limit?: number; proveedorId?: string })` → `PaginatedResponse<IngresoInventario>`, queryKey `['ingresos-inventario', params]`, `GET /ingresos-inventario`.
- `useIngresoInventario(id: string | null)` → `IngresoInventario`, `GET /ingresos-inventario/:id`, `enabled: !!id`.

- [ ] **Step 16: Páginas de ingresos**

Crear `app/(dashboard)/ingresos-inventario/page.tsx` (lista: tabla con N° factura compra, proveedor, fecha, N° items, registrado por; filtro por proveedor; paginación) y `ingresos-inventario/[id]/page.tsx` (detalle: cabecera + tabla de items con destino, cantidad, valor unitario, total con `formatCurrency`).
Ambas páginas gated: solo ADMIN/GERENTE/LOGISTICA (verificar rol con `useAuthStore`; redirigir si no). Agregar item de nav `Ingresos` en grupo Inventario + `permisos-nav.ts`: `'ingresos-inventario': ['ADMIN','GERENTE','LOGISTICA']`. Agregar al BottomNav grupo inventario.

- [ ] **Step 17: Verificar**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: sin errores. Verificación manual: crear un proveedor; crear un equipo con datos de compra; ver que aparezca un ingreso en `/ingresos-inventario`.

- [ ] **Step 18: Commit (cierre de E3)**

```bash
git add types/api.ts lib/proveedores.ts lib/schemas/proveedores.ts hooks/use-proveedores.ts hooks/use-ingresos-inventario.ts "app/(dashboard)/proveedores" "app/(dashboard)/ingresos-inventario" components/proveedores components/inventario/DatosCompraFields.tsx components/equipos/EquipoForm.tsx components/herramientas/UnidadCreatePanel.tsx components/herramientas/ConsumibleForm.tsx components/herramientas/AjusteStockPanel.tsx hooks/use-herramientas.ts hooks/use-consumibles.ts lib/nav.ts lib/permisos-nav.ts
git commit -m "$(cat <<'EOF'
feat(inventario): proveedores, datos de compra e ingresos de inventario

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 (E5): Mantenimientos — categoría, validaciones, campos clínicos, repuestos

**Files:**
- Modify: `types/api.ts` (enum `CategoriaMantenimiento`; `Mantenimiento`: `categoria`, `diagnostico?`, `trabajoRealizado?`, `observaciones?`, `repuestos: MantenimientoRepuesto[]`; tipos `MantenimientoRepuesto`, `RepuestoInput`; `CrearMantenimientoDto`, `RegistrarSalidaDto`, `FiltrosMantenimientos`)
- Modify: `app/(dashboard)/mantenimientos/nuevo/page.tsx:25-33` (schema crear)
- Modify: `components/mantenimientos/MantenimientoFormFields.tsx` (categoría, quitar opcional, repuestos fuera del alta)
- Modify: `app/(dashboard)/mantenimientos/[id]/salida/page.tsx` (campos clínicos + repuestos estructurados)
- Modify: detalle/listado de mantenimientos que renderiza `repuestos` (localizar `app/(dashboard)/mantenimientos/[id]/page.tsx` y la lista `app/(dashboard)/mantenimientos/page.tsx`)
- Modify: `hooks/use-mantenimientos.ts` (payloads)

**Interfaces:**
- Consumes: `useConsumibles`/`BodegaSelect` (E3 deja `useProveedores`). Selects de consumible y bodega para repuestos internos; select de proveedor para externos.
- Produces:
  - `CategoriaMantenimiento = 'INTERNO' | 'EXTERNO' | 'EN_CLIENTE'`
  - `RepuestoInput` interno `{ modo: 'interno'; consumibleId: string; bodegaId: string; cantidad: number }` XOR externo `{ modo: 'externo'; descripcion: string; proveedorId?: string; costoCompra?: number; fechaCompra?: string; cantidad: number }`
  - `MantenimientoRepuesto = { id; cantidad; consumibleId?; bodegaId?; descripcion?; proveedorId?; costoCompra?; fechaCompra? }`
  - `CrearMantenimientoDto` con `categoria` obligatorio, `costoEstimado` obligatorio, `horometro` condicional; sin `repuestos`.
  - `RegistrarSalidaDto` con `diagnostico?`, `trabajoRealizado?`, `observaciones?`, `repuestos: RepuestoApiItem[]` (interno: `{ consumibleId, bodegaId, cantidad }`; externo: `{ descripcion, proveedorId?, costoCompra?, fechaCompra?, cantidad }`).

- [ ] **Step 1: Tipos**

En `types/api.ts`, actualizar el tipo `Mantenimiento` (L197-222) y agregar:

```typescript
export type CategoriaMantenimiento = 'INTERNO' | 'EXTERNO' | 'EN_CLIENTE';

export type MantenimientoRepuesto = {
  id: string;
  cantidad: number;
  consumibleId?: string | null;
  bodegaId?: string | null;
  descripcion?: string | null;
  proveedorId?: string | null;
  costoCompra?: string | null; // Decimal string
  fechaCompra?: string | null;
};
```

En `Mantenimiento`: cambiar `repuestos: string[]` por `repuestos: MantenimientoRepuesto[]`, y agregar `categoria: CategoriaMantenimiento; diagnostico?: string | null; trabajoRealizado?: string | null; observaciones?: string | null;`.

Actualizar `CrearMantenimientoDto`: agregar `categoria: CategoriaMantenimiento`, hacer `costoEstimado: number` obligatorio, `horometro?: number` (condicional), **quitar** `repuestos`.

Actualizar `RegistrarSalidaDto`: agregar `diagnostico?`, `trabajoRealizado?`, `observaciones?`, y `repuestos: Array<{ cantidad: number; consumibleId?: string; bodegaId?: string; descripcion?: string; proveedorId?: string; costoCompra?: number; fechaCompra?: string }>`.

Actualizar `FiltrosMantenimientos`: agregar `categoria?: CategoriaMantenimiento`.

- [ ] **Step 2: Form de alta — categoría + obligatorios + sin repuestos**

En `app/(dashboard)/mantenimientos/nuevo/page.tsx` (schema L25-33):

```typescript
const schema = z.object({
  tipo: z.enum(['PREVENTIVO', 'CORRECTIVO', 'EMERGENCIA']),
  categoria: z.enum(['INTERNO', 'EXTERNO', 'EN_CLIENTE']),
  tecnico: z.string().min(1, 'El técnico es requerido'),
  motivo: z.string().min(1, 'El motivo es requerido'),
  horometro: z.number().nonnegative().optional(),
  costoEstimado: z.number().nonnegative('El costo estimado es requerido'),
  proximoMantenimiento: z.string().optional(),
}).superRefine((v, ctx) => {
  // horómetro obligatorio solo cuando el mantenimiento es de un equipo
  if (esEquipoSeleccionado && (v.horometro === undefined || Number.isNaN(v.horometro))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['horometro'], message: 'El horómetro es requerido para equipos' });
  }
});
```

`esEquipoSeleccionado` proviene del estado de selección de entidad (L60-72, `kind === 'equipo'`). Como `superRefine` no ve estado externo, pasar la condición vía un schema construido dentro del componente (factory `crearSchema(esEquipo: boolean)`), o validar el horómetro manualmente antes de `mutateAsync` y setear error con `setError('horometro', …)`. Elegir la factory: definir `const schema = useMemo(() => crearSchema(esEquipo), [esEquipo])`.

Quitar `repuestos` del schema y del payload de `useCrearMantenimiento`. Agregar `categoria` al payload.

- [ ] **Step 3: MantenimientoFormFields — categoría y labels obligatorios**

En `components/mantenimientos/MantenimientoFormFields.tsx`:
- Agregar al type `MantenimientoFormValues` el campo `categoria: CategoriaMantenimiento` y quitar `repuestos`.
- Agregar un `<select>` de Categoría (INTERNO/EXTERNO/EN_CLIENTE) con labels en español ("Interno", "Externo", "En cliente"), obligatorio.
- Quitar el texto "(opcional)" de Horómetro (L71) y Costo estimado (L82).
- Eliminar el bloque `useFieldArray` de repuestos (L32-133 parte de repuestos) de este componente compartido (los repuestos ahora viven solo en el form de salida).

- [ ] **Step 4: Form de salida — campos clínicos + repuestos estructurados**

En `app/(dashboard)/mantenimientos/[id]/salida/page.tsx`:
- Extender el schema con `diagnostico`, `trabajoRealizado`, `observaciones` (textareas opcionales) y `repuestos` como array estructurado:

```typescript
const repuestoSchema = z.discriminatedUnion('modo', [
  z.object({ modo: z.literal('interno'), consumibleId: z.string().min(1), bodegaId: z.string().min(1), cantidad: z.coerce.number().int().positive() }),
  z.object({ modo: z.literal('externo'), descripcion: z.string().min(1), proveedorId: z.string().optional(), costoCompra: z.coerce.number().nonnegative().optional(), fechaCompra: z.string().optional(), cantidad: z.coerce.number().int().positive() }),
]);
const schema = z.object({
  costoReal: z.coerce.number().nonnegative().optional(),
  diagnostico: z.string().max(2000).optional(),
  trabajoRealizado: z.string().max(2000).optional(),
  observaciones: z.string().max(2000).optional(),
  repuestos: z.array(repuestoSchema),
});
```

- UI de repuestos con `useFieldArray({ control, name: 'repuestos' })`. Cada fila tiene un toggle Interno/Externo (`modo`). Interno: `<select>` de consumible (usar `useConsumibles({ limit: 500, activo: true })`), `<BodegaSelect>`, cantidad. Externo: descripción, `<select>` de proveedor (`useProveedores({ limit: 200, activo: true })`), costo compra (`type=number step=0.01`), fecha compra (`type=date`), cantidad. Botón agregar (default `{ modo: 'interno', consumibleId: '', bodegaId: '', cantidad: 1 }`) y quitar.
- Mostrar costo total de repuestos: sumar con `decimal.js` (`new Decimal`) sobre externos con `costoCompra` (los internos no tienen costo de compra explícito en este form; mostrar solo el total de externos, etiquetado "Costo de repuestos externos"). Renderizar con `formatCurrency`.
- En submit, mapear cada repuesto a la forma del backend (quitar `modo`): interno → `{ consumibleId, bodegaId, cantidad }`; externo → `{ descripcion, proveedorId, costoCompra, fechaCompra: fechaCompra ? new Date(fechaCompra).toISOString() : undefined, cantidad }`. Enviar junto con diagnostico/trabajoRealizado/observaciones a `useRegistrarSalida(id)`.
- Manejo de error 422 (stock insuficiente): el interceptor/hook toastea; además, si `err.response.data.error.message` viene, mostrarlo inline a nivel de la sección de repuestos.

- [ ] **Step 5: Detalle y listado — render de repuestos como objetos + categoría**

En `app/(dashboard)/mantenimientos/[id]/page.tsx`: donde se renderizan `m.repuestos` (antes strings), adaptarlo a objetos — para interno mostrar el consumible (resolver nombre si el backend lo incluye, si no mostrar id/cantidad) + bodega + cantidad; para externo mostrar descripción + proveedor + costo (`formatCurrency`) + fecha. Mostrar también `categoria`, `diagnostico`, `trabajoRealizado`, `observaciones` cuando existan.

En `app/(dashboard)/mantenimientos/page.tsx`: agregar un chip de filtro `categoria` (INTERNO/EXTERNO/EN_CLIENTE) en el `<FilterBar>`, pasando `categoria` a `useMantenimientos`.

> Nota de discovery: confirmar si el detalle del backend incluye el nombre del consumible/proveedor dentro de cada repuesto; si no, el render usa los ids o se hace lookup. Ajustar al ver la respuesta real.

- [ ] **Step 6: Verificar**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: sin errores. Verificación manual: crear mantenimiento de equipo (horómetro y costo obligatorios; categoría obligatoria); registrar salida con un repuesto interno (descuenta stock) y uno externo.

- [ ] **Step 7: Commit (cierre de E5)**

```bash
git add types/api.ts "app/(dashboard)/mantenimientos" components/mantenimientos hooks/use-mantenimientos.ts
git commit -m "$(cat <<'EOF'
feat(mantenimientos): categoria, validaciones, campos clinicos y repuestos

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 (E6): Reporte de Mantenimientos (export)

**Files:**
- Modify: `hooks/use-reportes.ts` (agregar tipo `mantenimientos` y soporte de filtros extra)
- Modify: `app/(dashboard)/reportes/page.tsx` (card Mantenimientos + visibilidad LOGISTICA)
- Modify: `app/(dashboard)/reportes/generar/page.tsx` (filtros específicos + acceso por-tipo)

**Interfaces:**
- Consumes: `generarReporte()` (patrón blob existente en `hooks/use-reportes.ts:67-101`).
- Produces: `TipoReporte` incluye `'mantenimientos'`; `GenerarReporteParams` admite filtros opcionales `tipoMant?`, `categoria?`, `estado?`, `equipoId?`, `herramientaUnidadId?`, `tecnico?`.

- [ ] **Step 1: Tipo y params del hook**

En `hooks/use-reportes.ts`: agregar `'mantenimientos'` a `TipoReporte`. Extender `GenerarReporteParams` con los filtros opcionales de mantenimientos. En `generarReporte`, incluir esos filtros en `params` del `api.get` solo cuando estén definidos (igual que se hace con `comparar`). El endpoint `GET /reportes/mantenimientos` exige `desde`, `hasta`, `formato` (ya cubiertos) y acepta los filtros opcionales.

- [ ] **Step 2: Card en la grilla de reportes**

En `app/(dashboard)/reportes/page.tsx`:
- Agregar al array `TIPOS` una card `{ id: 'mantenimientos', icon: 'wrench', nombre: 'Mantenimientos', desc: 'Conteos, costos y repuestos por tipo/categoría', formatos: ['pdf','excel','csv'], href: '/reportes/generar?tipo=mantenimientos' }`.
- En el filtro de visibilidad: mantenimientos debe verse para `puedeVerInventario` (incluye LOGISTICA), igual que `inventario`. Generalizar la condición: definir un conjunto `IDS_INVENTARIO = new Set(['inventario','mantenimientos'])` y filtrar `IDS_INVENTARIO.has(t.id) ? puedeVerInventario : puedeVerExportables`.

- [ ] **Step 3: Filtros y acceso en la página de generación**

En `app/(dashboard)/reportes/generar/page.tsx`:
- Agregar `'mantenimientos'` a `TIPOS_VALIDOS`.
- Acceso: hoy `tieneAcceso = rol === 'ADMIN' || rol === 'GERENTE'`. Cambiar a: para `tipo === 'mantenimientos'`, permitir también `LOGISTICA`; para los demás, dejar ADMIN/GERENTE. (Para `inventario` no aplica porque inventario no pasa por esta página.)
- Cuando `tipo === 'mantenimientos'`, renderizar campos de filtro adicionales (todos opcionales): tipo (PREVENTIVO/CORRECTIVO/EMERGENCIA), categoría (INTERNO/EXTERNO/EN_CLIENTE), estado (ACTIVO/COMPLETADO), técnico (text). (Equipo/herramienta-unidad pueden quedar como fase posterior si no hay selects livianos disponibles; si se incluyen, usar selects existentes.) Pasar los valores definidos a `generarReporte`.

- [ ] **Step 4: Verificar**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: sin errores. Verificación manual: como LOGISTICA, ver la card Mantenimientos, generar un PDF con un filtro de categoría.

- [ ] **Step 5: Commit (cierre de E6)**

```bash
git add hooks/use-reportes.ts "app/(dashboard)/reportes/page.tsx" "app/(dashboard)/reportes/generar/page.tsx"
git commit -m "$(cat <<'EOF'
feat(reportes): reporte de mantenimientos con filtros y export

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 (E4): Reporte de inventario enriquecido (interactivo + export)

**Files:**
- Modify: `types/api.ts` (extender `DatosInventario`/snapshot con `estado`, `equiposPorCategoria`, `consumibles`, `piezas`, `porCliente`)
- Modify: `hooks/use-reporte-inventario.ts` (aceptar filtros + función de export blob)
- Modify: `app/(dashboard)/reportes/inventario/page.tsx` (columnas disponible/rentado, barra %, FilterBar, export)

**Interfaces:**
- Consumes: snapshot enriquecido del backend (sin `?formato` → JSON; con `?formato=pdf|excel|csv` → blob). Filtros `?clienteId`, `?bodegaId`, `?categoria`.
- Produces: `useReporteInventario(filtros)` acepta `{ clienteId?, bodegaId?, categoria? }`; `exportarReporteInventario(filtros, formato)` descarga blob.

- [ ] **Step 1: Tipos del snapshot enriquecido**

En `types/api.ts`, extender el tipo del snapshot de inventario (el que devuelve `useReporteInventario`) con:

```typescript
type EstadoResumen = { total: number; disponibles: number; rentadas: number; mantenimiento: number; usoInterno: number; pctRentado: number };
// dentro de DatosInventario:
  estado: { equipos: EstadoResumen; herramientas: EstadoResumen };
  equiposPorCategoria: (EstadoResumen & { categoria: string })[];
  consumibles: { sku: number; unidadesEnStock: number; unidadesConClientes: number };
  piezas: { sku: number; unidadesEnStock: number; unidadesConClientes: number };
  porCliente: { clienteId: string; clienteNombre: string; equipos: number; herramientas: number; consumiblesUnid: number; piezasUnid: number }[];
```

Mantener los campos existentes (`porBodega`, `totales`).

- [ ] **Step 2: Hook con filtros + export**

En `hooks/use-reporte-inventario.ts`:
- `useReporteInventario(filtros: { clienteId?: string; bodegaId?: string; categoria?: string } = {})`: agregar `filtros` al queryKey (`['reporte-inventario', filtros]`) y a `params` del `api.get('/reportes/inventario', { params: filtros })`.
- Agregar función `exportarReporteInventario(filtros, formato: 'pdf'|'excel'|'csv')`: `api.get('/reportes/inventario', { responseType: 'blob', params: { ...filtros, formato } })` + descarga con `URL.createObjectURL` (mismo patrón que `use-reportes.ts:85-91`, incluido `extraerFilename`/`extraerErrorDeBlob` — reutilizar copiando los helpers o importándolos si se exportan). Toasts de loading/success/error.

- [ ] **Step 3: Página enriquecida**

En `app/(dashboard)/reportes/inventario/page.tsx`:
- Estado de filtros: `clienteId`, `bodegaId`, `categoria` (null por defecto). `<FilterBar>` con: select/búsqueda de cliente (usar `useClientes` para opciones; o un `<select>` simple si la lista es grande, con chips para bodega/categoría). Bodega via `<BodegaSelect>` o select; categoría via chips (`CategoriaEquipo`).
- Sección "Por estado": para equipos y herramientas, mostrar total/disponibles/rentadas/mantenimiento/uso interno y una **barra de % rentado** usando `estado.equipos.pctRentado` / `estado.herramientas.pctRentado`. La barra: un contenedor con clase de fondo y un hijo con `style={{ width: `${pct}%` }}` (el width dinámico inline es aceptable por ser dato; el resto con clases Tailwind — sin colores arbitrarios).
- Tabla "Por categoría": filas de `equiposPorCategoria` con columnas total/disp/rent/mant/uso + barra %.
- Sección "Por cliente": tabla de `porCliente` (cliente, equipos, herramientas, consumibles, piezas), filtrable por `clienteId`.
- Mantener el detalle por bodega existente.
- Botón **Export** (PageHeader actions o botón con `Icon name="download"`): un pequeño menú/segmento PDF/Excel/CSV que llama `exportarReporteInventario(filtros, formato)`.
- Usable en tablet: tablas con `overflow-x-auto` (usar `<DataTable>`).

- [ ] **Step 4: Verificar**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: sin errores. Verificación manual: ver % rentado, filtrar por cliente, exportar a Excel.

- [ ] **Step 5: Commit (cierre de E4)**

```bash
git add types/api.ts hooks/use-reporte-inventario.ts "app/(dashboard)/reportes/inventario/page.tsx"
git commit -m "$(cat <<'EOF'
feat(reportes): inventario con disponible/rentado, % y export

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7 (E7): Devolución parcial de consumibles

**Files:**
- Modify: `types/api.ts` (`CrearRecepcionDto.items[]`: agregar `cantidadDevuelta?: number`, `cerrar?: boolean`; confirmar que `ActaItem` expone `cantidadConsumible` y `cantidadRecibida`)
- Modify: `app/(dashboard)/recepciones/nueva/page.tsx` (RowState + inputs por consumible + DTO)
- Modify: `components/actas-recepciones/ItemRow.tsx` (mostrar saldo pendiente)

**Interfaces:**
- Consumes: `useItemsPendientesDevolucion(facturaId)` → grupos con `items: ActaItem[]` (`cantidadConsumible`, `cantidadRecibida`). `useCrearRecepcion()` (`hooks/use-recepciones.ts:64-87`).
- Produces: el DTO de recepción por ítem ahora puede llevar `cantidadDevuelta` y `cerrar` (solo se aplican a consumibles).

- [ ] **Step 1: Tipos del DTO**

En `types/api.ts`, en `CrearRecepcionDto.items[]` (L1398-1409) agregar `cantidadDevuelta?: number;` y `cerrar?: boolean;`. Confirmar que `ActaItem` (L1158-1179) ya tiene `cantidadConsumible?` y `cantidadRecibida?` (sí según discovery).

- [ ] **Step 2: RowState y cálculo de pendiente**

En `app/(dashboard)/recepciones/nueva/page.tsx`, en `RowState` (L24-34) agregar `cantidadDevuelta: string` y `cerrar: boolean`. Para consumibles, calcular `pendiente = (item.cantidadConsumible ?? 0) - (item.cantidadRecibida ?? 0)`.

- [ ] **Step 3: Inputs por consumible en STEP 1**

En el STEP de inspección (L283-364), para ítems consumibles (`!!r.item.consumible`):
- Mostrar el saldo pendiente (`pendiente`).
- Input `cantidadDevuelta` (`type="number"`, `min=0`, `max={pendiente}`, entero). Validación inline: `cantidadDevuelta` entero ≥ 0 y ≤ `pendiente`; si excede, mensaje inline y bloquear submit.
- Checkbox `cerrar` ("Dar por consumido el resto y cerrar el ítem").
- Mostrar dinámicamente "Vuelve a inventario: X · Queda consumido: (pendiente − X)".
- Equipos/herramientas/piezas: sin cambios.

- [ ] **Step 4: DTO en submit**

En la construcción del DTO (L117-128), para consumibles agregar `cantidadDevuelta: r.cantidadDevuelta !== '' ? Number(r.cantidadDevuelta) : undefined` y `cerrar: r.cerrar || undefined`. Para no-consumibles, no enviar estos campos. El backend devuelve 422 si sobre-devolución; el hook/interceptor lo toastea — además mostrar inline si viene mensaje.

- [ ] **Step 5: Mostrar saldo en ItemRow (opcional but útil)**

En `components/actas-recepciones/ItemRow.tsx`, para consumibles, además de la cantidad, mostrar el pendiente cuando esté disponible (`cantidadConsumible - cantidadRecibida`).

- [ ] **Step 6: Verificar**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: sin errores. Verificación manual: registrar una devolución parcial de un consumible (< pendiente); ver el acta en `DEVUELTA_PARCIAL`; registrar una segunda devolución; intentar sobre-devolver y ver el 422 inline.

- [ ] **Step 7: Commit (cierre de E7)**

```bash
git add types/api.ts "app/(dashboard)/recepciones/nueva/page.tsx" components/actas-recepciones/ItemRow.tsx
git commit -m "$(cat <<'EOF'
feat(recepciones): devolucion parcial de consumibles

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8 (E8): Proyectos como bodegas

**Files:**
- Modify: `types/api.ts` (`Bodega`: `tipo: 'PRINCIPAL'|'ZONA'|'PROYECTO'`, `proyectoId?`; `porBodega[].bodegaTipo` admite `'PROYECTO'`; tipo de bodega-proyecto)
- Modify: `hooks/use-proyectos.ts` (`useBodegaProyecto(id)`, `useCrearBodegaProyecto()`; manejo de 409 en `useCambiarEstadoProyecto`)
- Create: `components/proyectos/BodegaProyectoPanel.tsx`
- Modify: `app/(dashboard)/proyectos/[id]/page.tsx` (montar el panel)
- Modify: `components/bodegas/BodegasTabla.tsx:118,182` (badge de tipo dinámico)
- Modify: `app/(dashboard)/actas/nueva/page.tsx:320-348` (excluir bodegas PROYECTO del select de origen)
- Modify: `app/(dashboard)/reportes/inventario/page.tsx` (filtro `?proyectoId`)

**Interfaces:**
- Consumes: `GET /proyectos/:id/bodega`, `POST /proyectos/:id/bodega`, `GET /bodegas/:bodegaId/inventario` (`useBodegaInventario`), endpoints existentes de mover/transferir (`useMoverBodegaUnidad`, `PATCH /equipos/:id/bodega`, `PATCH /consumibles/:id/transferir-stock`, `PATCH /andamios/piezas/:id/transferir-stock`).
- Produces:
  - `Bodega.tipo` y `Bodega.proyectoId`.
  - `useBodegaProyecto(proyectoId)` → `Bodega | null`; `useCrearBodegaProyecto()` → `mutationFn({ id, data?: { nombre?: string; descripcion?: string } })` (409 si ya existe).

- [ ] **Step 1: Tipos**

En `types/api.ts`:
- `Bodega` (L603-620): agregar `tipo: 'PRINCIPAL' | 'ZONA' | 'PROYECTO';` y `proyectoId?: string | null;`.
- En el tipo de `porBodega[]` del snapshot de inventario, `bodegaTipo` debe admitir `'PROYECTO'` además de `'PRINCIPAL'|'ZONA'`.

- [ ] **Step 2: Hooks de bodega-proyecto + 409**

En `hooks/use-proyectos.ts`:
- `useBodegaProyecto(proyectoId: string | null)` → `GET /proyectos/:id/bodega`, devuelve `Bodega | null`, queryKey `['proyecto-bodega', proyectoId]`, `enabled: !!proyectoId`.
- `useCrearBodegaProyecto()` → `mutationFn({ id, data }: { id: string; data?: { nombre?: string; descripcion?: string } })` → `POST /proyectos/:id/bodega`, invalida `['proyecto-bodega', id]`. En `onError`, si `err.response.status === 409`, `toast.error('El proyecto ya tiene una bodega')`; si no, mensaje genérico.
- En `useCambiarEstadoProyecto` (L97-116): en `onError`, detectar `status === 409` y mostrar un mensaje específico: "No se puede cerrar el proyecto: aún hay inventario en su bodega. Vaciála primero." (usar `err.response.data.error.message` si viene).

- [ ] **Step 3: Panel BodegaProyecto**

Crear `components/proyectos/BodegaProyectoPanel.tsx`:
- `'use client'`. Props: `{ proyecto: Proyecto }`.
- `useBodegaProyecto(proyecto.id)`.
- Si `null`: card con botón "Crear bodega de proyecto" (gated ADMIN/GERENTE/LOGISTICA) → `useCrearBodegaProyecto().mutateAsync({ id: proyecto.id })`.
- Si existe: mostrar el inventario con `useBodegaInventario(bodega.id)` (equipos, unidades, consumibles, piezas) en tablas. Encabezado con el nombre de la bodega y badge "PROYECTO".
- Acción "Enviar inventario": un control para seleccionar un ítem de la bodega principal y enviarlo a la bodega-proyecto. MVP: un sub-panel que permita elegir tipo (equipo/unidad/consumible/pieza) + ítem + (para stock) cantidad + bodega origen, y llamar el endpoint de transferencia correspondiente con la bodega-proyecto como destino:
  - Equipo: `PATCH /equipos/:id/bodega` body `{ bodegaId: bodegaProyectoId }`.
  - Unidad: `PATCH /herramientas/unidades/:id/bodega` (`useMoverBodegaUnidad`).
  - Consumible: `PATCH /consumibles/:id/transferir-stock` (`useTransferirStock`) body `{ origenBodegaId, destinoBodegaId, cantidad }` — confirmar nombres de campos del DTO `TransferirStockDto` en `types/api.ts`.
  - Pieza: `PATCH /andamios/piezas/:id/transferir-stock`.
  - Tras enviar, invalidar `['bodega-inventario', bodegaProyectoId]` y la query de inventario de la principal.
- Si la complejidad del selector multi-tipo es alta, dividir el "Enviar inventario" en su propio sub-componente `EnviarInventarioProyecto.tsx` (misma tarea, mismo commit).

> Nota de discovery: confirmar el shape exacto de `TransferirStockDto` y de los endpoints de transferencia (`origenBodegaId`/`destinoBodegaId` vs `bodegaOrigenId`/`bodegaDestinoId`) antes de implementar el envío.

- [ ] **Step 4: Montar panel en detalle de proyecto**

En `app/(dashboard)/proyectos/[id]/page.tsx`, agregar `<BodegaProyectoPanel proyecto={proyecto} />` en el layout (p.ej. nueva fila debajo del grid actual).

- [ ] **Step 5: Badge de tipo en BodegasTabla**

En `components/bodegas/BodegasTabla.tsx`: reemplazar los badges hardcodeados (L118 `PRINCIPAL`, L182 `ZONA`) por uno que use `bodega.tipo`: `PROYECTO` → `<Badge status="PROYECTO" kind="accent" />`, `ZONA` → `kind="neutral"`, `PRINCIPAL` → `kind="info"`. Como `tipo` ahora viene del backend, usarlo directamente (fallback a la lógica de `parentId` si `tipo` viniera undefined en datos viejos).

- [ ] **Step 6: Excluir bodegas PROYECTO del origen de despacho**

En `app/(dashboard)/actas/nueva/page.tsx` (L320-348): al construir las opciones del select de bodega origen, filtrar fuera las bodegas con `tipo === 'PROYECTO'` (el backend las rechaza con 400; no ofrecerlas).

- [ ] **Step 7: Filtro proyectoId en reporte de inventario**

En `app/(dashboard)/reportes/inventario/page.tsx` (ya enriquecido en E4): agregar un filtro opcional `proyectoId` al `<FilterBar>` y pasarlo a `useReporteInventario`/`exportarReporteInventario` (el hook ya acepta filtros arbitrarios; agregar `proyectoId` al tipo de filtros). Las opciones de proyecto pueden venir de un `useProyectos` liviano.

- [ ] **Step 8: Verificar**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: sin errores. Verificación manual: crear bodega-proyecto en un proyecto, enviarle un equipo, verla en bodegas con badge PROYECTO, confirmar que no aparece como origen de acta, e intentar cerrar el proyecto con inventario (ver el 409 explicado).

- [ ] **Step 9: Commit (cierre de E8)**

```bash
git add types/api.ts hooks/use-proyectos.ts components/proyectos "app/(dashboard)/proyectos/[id]/page.tsx" components/bodegas/BodegasTabla.tsx "app/(dashboard)/actas/nueva/page.tsx" "app/(dashboard)/reportes/inventario/page.tsx"
git commit -m "$(cat <<'EOF'
feat(proyectos): bodega de proyecto, envio de inventario y distintivos

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Notas de discovery a confirmar durante la ejecución

Estas no bloquean el plan; resolver al implementar el epic correspondiente leyendo la respuesta real del backend o el módulo:
- **E3:** forma exacta de `GET /ingresos-inventario/:id` (`items[].destino`, `registradoPor`); nombre del DTO de unidad para inyectar `datosCompra`.
- **E5:** si el detalle de mantenimiento incluye nombres de consumible/proveedor dentro de cada repuesto.
- **E8:** nombres de campos de `TransferirStockDto` y de los endpoints de transferencia (origen/destino).

## Self-review (cobertura del spec)

- E1 → Task 1 (permisos equipos/herramientas/bodegas/andamios/nav + verificación reportes). ✓
- E2 → Task 2 (card períodos de renta + hook + tipos). ✓
- E3 → Task 3 (proveedores CRUD + nav + datos de compra en 4 formularios + ingresos). ✓
- E5 → Task 4 (categoría, obligatorios, campos clínicos, repuestos estructurados, filtro). ✓
- E6 → Task 5 (card + filtros + export + acceso LOGISTICA). ✓
- E4 → Task 6 (snapshot enriquecido, %, FilterBar, export). ✓
- E7 → Task 7 (cantidadDevuelta + cerrar + saldo + 422). ✓
- E8 → Task 8 (bodega-proyecto, enviar inventario, badge, exclusión de origen, 409, proyectoId). ✓
- Tarifa en pantalla: se deja visible (fuera de alcance, confirmado en spec). ✓
- Decisiones de producto del spec (nav Proveedores en Inventario para todos; reporte inventario interactivo+export; E2 card en detalle; ingresos incluidos; E8 panel en proyecto): reflejadas. ✓
