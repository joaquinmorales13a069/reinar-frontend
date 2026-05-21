# Spec: RAMA 4 — Clientes y Contactos

**Fecha:** 2026-05-21
**Rama:** `feat/clientes`
**Enfoque elegido:** Opción B — extraer UI compartida primero, luego construir los módulos encima

---

## Contexto

ERP interno de Reinar S.A. de C.V. Frontend Next.js 19 (App Router) que consume backend Express en `http://localhost:3000/api/v1`. El prototipo de referencia está en `/Users/joaquinmorales13a06/Downloads/Frontend-REINAR-design/clientes.jsx` y `contactos.jsx`.

---

## Paso 0: Creación de rama

Antes de tocar cualquier archivo:

```bash
git checkout -b feat/clientes
```

---

## Paso 1: Wiring de Toaster en root layout

Agregar `<Toaster richColors position="top-right" />` de `sonner` al `app/layout.tsx`. Sonner ya está instalado (`^2.0.7`). Este es el único lugar donde se monta — funciona para toda la app.

---

## Sección 1: Componentes UI compartidos

Nuevos archivos en `components/ui/`. Los cuatro existentes (`Badge`, `Card`, `Icon`, `Spinner`) no se modifican.

### `PageHeader.tsx`

Props: `title`, `subtitle?`, `back?` (boolean), `onBack?`, `actions?` (ReactNode).

Comportamiento responsivo:
- **Mobile (`< 640px`):** título ocupa ancho completo; `actions` bajan a segunda fila, cada botón `w-full`
- **Tablet (`640–1023px`):** título y acciones en misma fila si son ≤ 2 botones
- **Desktop (`≥ 1024px`):** título + acciones en línea horizontal

### `FilterBar.tsx`

Props: `search`, `onSearch`, `placeholder?`, `chips` (array de `{ label, active, onToggle }`), `onClear`.

Comportamiento responsivo:
- **Mobile:** input ancho completo; chips con `flex-wrap` en múltiples líneas
- **Tablet:** una sola fila si chips ≤ 5
- **Desktop:** una sola línea sin overflow

### `DataTable.tsx`

Props: `children` (thead + tbody), `className?`.

Envuelve la tabla en `<div className="overflow-x-auto">`. Expone clase utilitaria `hidden sm:table-cell` para columnas que las vistas declaran ocultas en mobile.

Comportamiento responsivo:
- **Mobile:** scroll horizontal; columnas con `mobileHidden` ocultas
- **Tablet/Desktop:** todas las columnas visibles

### `Pagination.tsx`

Props: `page`, `pageSize`, `total`, `onPage`.

Comportamiento responsivo:
- **Mobile:** solo "Anterior" / "Siguiente"
- **Tablet/Desktop:** números completos con elipsis

### `EmptyState.tsx`

Props: `icon` (nombre para `<Icon>`), `title`, `message`.

Centrado, padding generoso. Sin variaciones responsivas — funciona igual en todos los breakpoints.

### `ConfirmRow.tsx`

Props: `icon?`, `message` (ReactNode), `onCancel`, `onConfirm`, `confirmLabel?`, `confirmVariant?` (`'danger' | 'primary'`).

Comportamiento responsivo:
- **Mobile:** `flex-col`; icono + mensaje arriba, botones debajo, cada uno `w-full`
- **Tablet/Desktop:** `flex-row` horizontal

### `FormSection.tsx`

Props: `title`, `children`, `className?`.

Card con `<h3>` de título y slot de contenido. Sin variaciones responsivas propias — el contenido interno maneja sus breakpoints.

---

## Sección 2: Tipos TypeScript

Agregar en `types/api.ts`:

```typescript
export type Cliente = {
  id: string
  tipo: 'EMPRESA' | 'PARTICULAR'
  razonSocial?: string
  nombreComercial?: string
  nombre?: string
  apellido?: string
  nit?: string
  ncr?: string
  dui?: string
  ocupacion?: string
  sector?: string
  actividadEconomica?: string
  departamento: string
  municipio: string
  complemento?: string
  telefono?: string
  email?: string
  notas?: string
  estado: 'ACTIVO' | 'INACTIVO' | 'PROSPECTO'
  facturado?: string   // Decimal string — usar new Decimal(val)
  proyectos?: number
}

export type Contacto = {
  id: string
  clienteId: string
  nombre: string
  apellido?: string
  cargo?: string
  tipoContacto: 'PRINCIPAL' | 'SECUNDARIO' | 'SOLICITANTE' | 'FACTURACION' | 'OPERATIVO'
  telefono?: string
  email?: string
  notas?: string
  activo: boolean
}
```

---

## Sección 3: Hooks de React Query

### `hooks/use-clientes.ts`

| Hook | Query key | Endpoint |
|---|---|---|
| `useClientes(params)` | `['clientes', params]` | `GET /clientes` |
| `useCliente(id)` | `['clientes', id]` | `GET /clientes/:id` |
| `useCrearCliente()` | — | `POST /clientes` |
| `useEditarCliente()` | — | `PUT /clientes/:id` |
| `useCambiarEstadoCliente()` | — | `PATCH /clientes/:id/estado` |

Invalidaciones tras mutación:
- `useCrearCliente` → invalida `['clientes']`
- `useEditarCliente` → invalida `['clientes']` + `['clientes', id]`
- `useCambiarEstadoCliente` → invalida `['clientes']` + `['clientes', id]`

### `hooks/use-contactos.ts`

| Hook | Query key | Endpoint |
|---|---|---|
| `useContactos(params)` | `['contactos', params]` | `GET /contactos` |
| `useContacto(id)` | `['contactos', id]` | `GET /contactos/:id` |
| `useCrearContacto()` | — | `POST /contactos` |
| `useEditarContacto()` | — | `PUT /contactos/:id` |
| `useToggleActivoContacto()` | — | `PATCH /contactos/:id/activo` |

Invalidaciones:
- `useCrearContacto` → invalida `['contactos']`
- `useEditarContacto` → invalida `['contactos']` + `['contactos', id]`
- `useToggleActivoContacto` → invalida `['contactos']` + `['contactos', id]`

---

## Sección 4: Módulo Clientes

### Estructura de archivos

```
app/(dashboard)/clientes/
  page.tsx                  → Server Component, renderiza <ClientesList />
  nuevo/page.tsx            → Server Component, renderiza <ClienteForm /> (modo crear)
  [id]/page.tsx             → Server Component, renderiza <ClienteDetalle />
  [id]/editar/page.tsx      → Server Component, renderiza <ClienteForm /> (modo editar)
components/clientes/
  ClientesList.tsx          → 'use client'
  ClienteDetalle.tsx        → 'use client'
  ClienteForm.tsx           → 'use client'
  ContactosDeCliente.tsx    → 'use client'
```

### `ClientesList.tsx`

Estado local: `busqueda`, `filterTipo` (`'EMPRESA' | 'PARTICULAR' | null`), `filterEstado` (`'ACTIVO' | 'INACTIVO' | 'PROSPECTO' | null`), `page`.

Columnas de la tabla:

| Columna | Mobile | Tablet | Desktop |
|---|---|---|---|
| Checkbox | visible | visible | visible |
| Código | visible | visible | visible |
| Tipo (badge) | oculto | visible | visible |
| Cliente (nombre + doc) | visible | visible | visible |
| Departamento | oculto | visible | visible |
| Teléfono | oculto | visible | visible |
| Cot. act. | oculto | visible | visible |
| Estado | visible | visible | visible |
| Acciones | visible | visible | visible |

Fila clickeable → `router.push('/clientes/${id}')`.

### `ClienteDetalle.tsx`

Layout: `grid grid-cols-1 lg:grid-cols-2 gap-4 items-start`.

**Columna izquierda:**
- `<FormSection title="Información general">` — campos condicionales según `tipo` (EMPRESA: razón social, NIT, NCR, nombre comercial, sector, actividad; PARTICULAR: nombre, apellido, DUI, ocupación)
- `<FormSection title="Dirección">` — departamento, municipio, complemento
- `<FormSection title="Contacto">` — teléfono, email, notas

**Columna derecha:**
- Card de métricas: total facturado (`formatCurrency`) + proyectos
- Tabla flush "Historial de cotizaciones" (top 5)
- Tabla flush "Facturas vinculadas" (top 5)

Ancho completo debajo: `<ContactosDeCliente clienteId={id} />`

Acciones: Editar → `/clientes/${id}/editar` · Nueva cotización → `/cotizaciones/nueva?clienteId=${id}`

### `ClienteForm.tsx`

Schema Zod con `superRefine` que aplica reglas según `tipo`:
- EMPRESA: `razonSocial` requerido; `nit` regex `/^\d{4}-\d{6}-\d{3}-\d$/` si presente
- PARTICULAR: `nombre` requerido; `dui` regex `/^\d{8}-\d$/` si presente
- Ambos: `email` formato válido si presente; `departamento` requerido

Secciones:
1. Tipo de cliente (segmented control — cambia el schema activo)
2. Datos (campos condicionales según tipo)
3. Dirección (departamento → municipio dependiente → complemento textarea)
4. Contacto (teléfono, email, notas, estado — estado solo en modo editar)

Footer responsivo:
- Mobile: `flex-col w-full` — Desactivar arriba, Cancelar, Guardar
- Desktop: `flex-row` — Desactivar con `mr-auto`, Cancelar y Guardar a la derecha

Desactivar dispara `<ConfirmRow>` inline antes de llamar `useCambiarEstadoCliente`.

Botón submit: texto cambia a "Guardando…" + `<Spinner />` mientras `isPending`, deshabilitado.

### `ContactosDeCliente.tsx`

Mini-tabla en el detalle del cliente. `useContactos({ clienteId, limit: 50 })`.

Columnas: Nombre · Cargo · Tipo · Teléfono · Email · Ver.
Mobile: solo Nombre y Tipo.

Botón "Nuevo contacto" → `/contactos/nuevo?clienteId=${id}`.

---

## Sección 5: Módulo Contactos

### Estructura de archivos

```
app/(dashboard)/contactos/
  page.tsx                  → Server Component, renderiza <ContactosList />
  nuevo/page.tsx            → Server Component, renderiza <ContactoForm /> (pasa clienteId desde searchParams si está)
  [id]/page.tsx             → Server Component, renderiza <ContactoDetalle />
  [id]/editar/page.tsx      → Server Component, renderiza <ContactoForm /> (modo editar)
components/contactos/
  ContactosList.tsx         → 'use client'
  ContactoDetalle.tsx       → 'use client'
  ContactoForm.tsx          → 'use client'
```

### `ContactosList.tsx`

Columnas de la tabla:

| Columna | Mobile | Tablet | Desktop |
|---|---|---|---|
| Checkbox | visible | visible | visible |
| Código | oculto | visible | visible |
| Nombre (nombre + email sub) | visible | visible | visible |
| Cargo | oculto | oculto | visible |
| Cliente vinculado (link) | visible | visible | visible |
| Tipo (badge) | visible | visible | visible |
| Teléfono | oculto | visible | visible |
| Estado | visible | visible | visible |
| Acciones | visible | visible | visible |

### `ContactoDetalle.tsx`

Layout: `grid grid-cols-1 lg:grid-cols-2 gap-4 items-start`.

**Columna izquierda:**
- Card "Información de contacto": teléfono, email, notas
- Card flush "Aparece en": tres mini-tablas apiladas
  - Cotizaciones donde es solicitante (top 3)
  - Facturas donde es contacto de facturación (top 3)
  - Actas donde es receptor (top 3)

**Columna derecha:**
- Card "Cliente vinculado": avatar ícono + nombre + ID + campos de datos + botón "Ver detalle del cliente"

Desactivar → `<ConfirmRow>` inline → `useToggleActivoContacto`.

### `ContactoForm.tsx`

Schema Zod: `clienteId` requerido, `nombre` requerido, `email` formato válido si presente.

Campo "Cliente vinculado":
- Si `clientePre` prop está presente: bloque de solo lectura con badge "Bloqueado"
- Si es nuevo sin pre-selección: `<select>` cargado con `useClientes({ activo: true, limit: 200 })`
- En edición: siempre bloqueado (no se puede cambiar el cliente después de crear)

Aviso PRINCIPAL: si el cliente ya tiene un contacto PRINCIPAL y se selecciona ese tipo, mostrar aviso inline (no toast) antes de guardar.

Todos los campos a una columna en mobile; 2 columnas en tablet/desktop.

---

## Sección 6: Toasts y manejo de errores

### Patrón de mutation estándar

```typescript
onSuccess: () => {
  toast.success('Mensaje de éxito.')
  queryClient.invalidateQueries({ queryKey: ['entidad'] })
  router.push('/ruta-destino')
},
onError: (err) => {
  const details = err.response?.data?.error?.details ?? []
  details.forEach(({ field, message }) => setError(field, { message }))
  if (details.length === 0) {
    toast.error(err.response?.data?.error?.message ?? 'Ocurrió un error inesperado.')
  }
}
```

Si `details` mapeó al menos un campo: no se muestra toast — el error inline en el campo es suficiente.

### Tabla de mensajes

| Acción | Toast éxito |
|---|---|
| Crear cliente | `Cliente creado correctamente.` |
| Editar cliente | `Cambios guardados correctamente.` |
| Desactivar cliente | `Cliente desactivado.` |
| Crear contacto | `Contacto creado correctamente.` |
| Editar contacto | `Cambios guardados correctamente.` |
| Desactivar contacto | `Contacto desactivado.` |

---

## Checklist de breakpoints por componente

Esta checklist aplica a esta rama y a todas las siguientes. Antes de hacer PR, verificar en Chrome DevTools en 360px (mobile), 768px (tablet) y 1280px (desktop).

### `PageHeader`
- [ ] Mobile: título ancho completo; acciones en segunda fila, cada botón `w-full`
- [ ] Tablet: título y acciones en misma fila si son ≤ 2 botones
- [ ] Desktop: título + acciones en línea horizontal

### `FilterBar`
- [ ] Mobile: input ancho completo; chips con `flex-wrap`
- [ ] Tablet: una fila si ≤ 5 chips
- [ ] Desktop: una sola línea sin overflow

### `DataTable`
- [ ] Mobile: `overflow-x-auto`; columnas `mobileHidden` ocultas; columna principal con `min-width`
- [ ] Tablet: todas las columnas visibles
- [ ] Desktop: columnas con padding horizontal generoso

### `Pagination`
- [ ] Mobile: solo "Anterior" y "Siguiente"
- [ ] Tablet/Desktop: números completos con elipsis

### `ConfirmRow`
- [ ] Mobile: `flex-col`; botones `w-full`
- [ ] Tablet/Desktop: `flex-row` horizontal

### Vista de detalle (grid-2)
- [ ] Mobile: columna única
- [ ] Tablet: columna única (contenido denso)
- [ ] Desktop: `lg:grid-cols-2`

### Formularios
- [ ] Mobile: `grid-cols-1`; todos los campos ancho completo
- [ ] Tablet/Desktop: `sm:grid-cols-2`; `span-2` ocupa las 2 columnas

### Footer de formulario
- [ ] Mobile: `flex-col w-full`; Desactivar arriba, Cancelar, Guardar
- [ ] Tablet/Desktop: `flex-row`; Desactivar con `mr-auto`

### `ContactosDeCliente`
- [ ] Mobile: solo Nombre y Tipo
- [ ] Tablet/Desktop: todas las columnas

---

## Endpoints del backend

```
GET    /api/v1/clientes              ?page&limit&busqueda&tipo&estado
POST   /api/v1/clientes
GET    /api/v1/clientes/:id
PUT    /api/v1/clientes/:id
PATCH  /api/v1/clientes/:id/estado   { estado: 'ACTIVO' | 'INACTIVO' | 'PROSPECTO' }

GET    /api/v1/contactos             ?clienteId&page&limit&busqueda&tipoContacto&activo
POST   /api/v1/contactos
GET    /api/v1/contactos/:id
PUT    /api/v1/contactos/:id
PATCH  /api/v1/contactos/:id/activo  { activo: boolean }
```

---

## Orden de implementación sugerido

1. Crear rama `feat/clientes`
2. Agregar `<Toaster />` al root layout
3. Agregar tipos `Cliente` y `Contacto` a `types/api.ts`
4. Crear los 7 componentes UI compartidos en `components/ui/`
5. Crear `hooks/use-clientes.ts`
6. Crear páginas y componentes del módulo Clientes
7. Crear `hooks/use-contactos.ts`
8. Crear páginas y componentes del módulo Contactos
9. Verificar checklist de breakpoints en los tres tamaños
10. PR a `main`
