# Diseño — Rama 8: `feat/servicios`

**Fecha:** 2026-05-24
**Rama:** `feat/servicios`
**Módulo:** Catálogo de Servicios (mano de obra, instalación, etc.)
**Plan de referencia:** `docs/plan-trabajo-frontend.md` (Rama 8)

---

## Resumen

CRUD completo del catálogo de servicios cotizables. Sigue el patrón ya
establecido en los módulos `clientes`, `herramientas` y `andamios`. Sin
componentes nuevos en `components/ui/`: reutiliza todas las primitivas
existentes (`PageHeader`, `FilterBar`, `DataTable`, `Pagination`, `Badge`,
`ConfirmRow`, `EmptyState`, `Spinner`, `FormSection`).

---

## Hallazgos del backend (fuente de verdad)

Archivos: `server/src/modules/servicios/*.ts` y `prisma/schema.prisma`
(modelo `Servicio`).

Diferencias con el plan original que se respetan en este diseño:

- El campo de precio se llama **`tarifaBase`** (no `precioUnitario`).
- **`codigo` es autogenerado** por el backend con formato `SV-001`, `SV-002`,
  etc. El frontend nunca lo envía al crear.
- El parámetro de búsqueda en `GET /servicios` es **`search`** (no `busqueda`).
- **Roles que escriben:** solo `ADMIN` y `GERENTE`. `OPERADOR`, `LOGISTICA`
  y `VISUALIZADOR` son solo lectura.
- No hay endpoint `DELETE`. La "eliminación" es `PATCH /:id/estado
  { activo: false }` (soft delete).
- `unidad` es texto libre (`hora`, `día`, `m²`, `proyecto`…), no enum.

---

## Modelo de datos

```ts
type Servicio = {
  id: string;
  codigo: string;          // SV-001 (autogenerado)
  nombre: string;
  descripcion: string | null;
  tarifaBase: string;      // Decimal serializado como string
  unidad: string;          // texto libre
  activo: boolean;
  notas: string | null;
  createdAt: string;       // ISO
  updatedAt: string;       // ISO
};
```

Se añade el tipo `Servicio` a `types/api.ts`.

---

## Endpoints consumidos

| Método  | Ruta                          | Roles backend            | Uso en el frontend                          |
|---------|-------------------------------|--------------------------|---------------------------------------------|
| `GET`   | `/servicios?page&limit&search&activo` | ADMIN, GERENTE, OPERADOR, VISUALIZADOR | Lista paginada con búsqueda y filtro activo |
| `POST`  | `/servicios`                  | ADMIN, GERENTE           | Crear (payload sin `codigo`)                |
| `GET`   | `/servicios/:id`              | ADMIN, GERENTE, OPERADOR, VISUALIZADOR | Detalle                                     |
| `PUT`   | `/servicios/:id`              | ADMIN, GERENTE           | Editar                                      |
| `PATCH` | `/servicios/:id/estado`       | ADMIN, GERENTE           | Activar / desactivar                        |

`LOGISTICA` no aparece en el backend del módulo; en el frontend se le
trata como solo lectura para mantener coherencia con el resto del ERP.

---

## Estructura de archivos

```
app/(dashboard)/servicios/
  page.tsx                    # lista
  nuevo/page.tsx              # crear
  [id]/page.tsx               # detalle
  [id]/editar/page.tsx        # editar

components/servicios/
  ServiciosTable.tsx          # tabla con acciones por fila
  ServicioForm.tsx            # formulario compartido crear/editar

hooks/
  use-servicios.ts            # hooks de React Query

types/api.ts                  # agregar Servicio
lib/nav.ts                    # verificar ítem "Servicios"
```

---

## Páginas

### Lista (`/servicios`)

- `PageHeader` con título `Servicios` y subtítulo `${total} servicios cotizables`.
  Acción: botón "Nuevo servicio" (solo ADMIN/GERENTE).
- `FilterBar`:
  - Búsqueda con placeholder `Buscar por nombre o código…`.
  - Chips mutuamente excluyentes: `Activos` | `Inactivos`. Vacío = todos.
- `DataTable`:
  - Columnas: `#` (numeración secuencial siguiendo el patrón de andamios),
    Código (mono), Nombre + descripción truncada en línea secundaria, Unidad,
    Tarifa base (alineada a la derecha, mono, con `formatCurrency`), Estado
    (`<Badge>`), acciones por fila (ver, editar — solo ADMIN/GERENTE).
  - Click en fila navega a `/servicios/[id]`.
- `Pagination` inferior según `meta.total`/`meta.limit`.
- `EmptyState` con ícono `tool` si la lista está vacía con los filtros aplicados.

### Crear (`/servicios/nuevo`)

- `PageHeader` con back y subtítulo "Registra un servicio cotizable".
- `ServicioForm` en modo crear:
  - Campos: Nombre*, Unidad*, Tarifa base*, Descripción, Notas internas.
  - **No se solicita código** (lo asigna el backend).
  - **No se muestra control de estado** al crear (siempre nace `activo: true`).
- `onSuccess`: `toast.success('Servicio creado.')` y navegar a `/servicios/[id]`.
- Acceso restringido a ADMIN/GERENTE: si entra otro rol, redirigir a `/servicios`.

### Detalle (`/servicios/[id]`)

- `PageHeader`:
  - Título: `nombre`.
  - Subtítulo: código en `font-mono` + `·` + `<Badge status={activo ? 'ACTIVO' : 'INACTIVO'}>`.
  - Back a `/servicios`.
  - Acción: "Editar" (solo ADMIN/GERENTE).
- Layout en 2 columnas (`lg+`); se apilan en móvil/tablet:
  - **Izquierda:** tarjeta "Descripción", tarjeta "Notas internas".
  - **Derecha:** tarjeta "Tarifa" con `formatCurrency(tarifaBase)` en tipografía
    grande + `/ ${unidad}` en texto secundario.
- No se incluye el widget "Historial de uso" (omitido por acuerdo).
- En 404 del backend renderiza `EmptyState` "Servicio no encontrado".

### Editar (`/servicios/[id]/editar`)

- `PageHeader` con back y subtítulo "Modifica los datos del servicio".
- `ServicioForm` en modo editar:
  - Igual al de crear, más:
    - Campo **Código** en solo lectura (input deshabilitado, `font-mono`).
    - Botón secundario "Desactivar servicio" / "Activar servicio" alineado a la
      izquierda del footer. Al pulsarlo abre `<ConfirmRow>` inline; confirmar
      dispara `PATCH /servicios/:id/estado`.
- `onSuccess` de guardar: `toast.success('Cambios guardados.')` + navegar al
  detalle.
- `onSuccess` de toggle activo: toast `Servicio desactivado.` o `Servicio
  activado.` + actualizar query del detalle.

---

## Formulario y validación (Zod)

Schema definido inline en `components/servicios/ServicioForm.tsx`
(mismo patrón que el resto de formularios del proyecto):

```ts
const servicioSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string().optional(),
  tarifaBase: z.coerce.number().positive('La tarifa debe ser positiva'),
  unidad: z.string().min(1, 'La unidad es requerida').max(50),
  notas: z.string().optional(),
});
```

Es espejo del schema del backend (`servicios.schemas.ts`). Se usa con
React Hook Form + `zodResolver`.

`tarifaBase` se envía al backend como número (no string). El backend lo
convierte a `Decimal` internamente.

---

## Manejo de errores

- **Validación inline:** cuando el backend devuelve `{ success: false, error:
  { code: 'VALIDATION_ERROR', details: [...] } }`, se hace
  `setError(detalle.path, { message: detalle.message })` por cada `path` que
  coincida con un campo del formulario. Sin toast.
- **404 en detalle/editar:** se muestra `EmptyState` "Servicio no encontrado"
  con botón "Regresar". Sin toast.
- **Otros errores del backend (500, 409, etc.):** `toast.error(message)` usando
  el `error.message` del backend si está presente, o fallback "No se pudo
  guardar. Intenta de nuevo.".
- **401:** lo maneja silenciosamente el interceptor de `lib/api.ts` (refresh
  automático).

---

## Permisos en la UI

| Rol                                   | Lista | Detalle | Crear | Editar | Toggle activo |
|---------------------------------------|:-----:|:-------:|:-----:|:------:|:-------------:|
| ADMIN, GERENTE                        |   ✓   |    ✓    |   ✓   |   ✓    |      ✓        |
| OPERADOR, LOGISTICA, VISUALIZADOR     |   ✓   |    ✓    |   —   |   —    |      —        |

Helper: `puedeEscribir = ['ADMIN', 'GERENTE'].includes(user.rol)` obtenido
desde `useAuth()`. Los botones de escritura se renderizan condicionalmente.
Las rutas `/servicios/nuevo` y `/servicios/[id]/editar` redirigen a
`/servicios` si el rol no es de escritura (defensa en profundidad; el backend
también lo valida).

---

## Hooks de React Query (`hooks/use-servicios.ts`)

| Hook                        | Query key                                          | Acción                                |
|-----------------------------|----------------------------------------------------|---------------------------------------|
| `useServicios(filtros)`     | `['servicios', { page, search, activo }]`          | `GET /servicios`                      |
| `useServicio(id)`           | `['servicio', id]`                                  | `GET /servicios/:id`                  |
| `useCrearServicio()`        | invalida `['servicios']`                            | `POST /servicios`                     |
| `useActualizarServicio(id)` | invalida `['servicios']` + `['servicio', id]`       | `PUT /servicios/:id`                  |
| `useToggleActivoServicio(id)` | invalida `['servicios']` + `['servicio', id]`     | `PATCH /servicios/:id/estado`         |

Cada `useMutation` define `onSuccess` (toast.success + invalidación) y
`onError` (toast.error con mensaje del backend si está disponible).

---

## Navegación

`lib/nav.ts` ya define un ítem "Servicios" dentro del grupo Inventario. Se
verifica que apunte a `/servicios` y que tenga el ícono correcto del
diccionario de `Icon`. No se crean ítems nuevos.

---

## Convenciones aplicadas

- **Comentarios "why" en español** únicamente en decisiones no obvias
  (ej.: por qué el campo `codigo` se oculta al crear, por qué la
  desactivación es soft delete vía `PATCH /estado`).
- **Tailwind predefinido** — sin valores arbitrarios `h-[20px]`, sin CSS
  vanilla en `globals.css`. Si hace falta un token, se define en `@theme` o
  en `@layer utilities`.
- **Moneda:** `formatCurrency(servicio.tarifaBase)` (decimal.js).
- **Fechas:** `formatDate(servicio.createdAt)` cuando se muestren.
- **Texto:** 100% en español.
- **Documentos/códigos:** `font-mono` para `codigo` (SV-001).
- **Toasts:** `sonner` ya montado en `providers.tsx`; mensajes cortos en
  español, una sola línea.

---

## Checklist antes de PR

- [ ] Lista, detalle, crear y editar consumen datos reales del backend.
- [ ] Formulario muestra errores de validación de la API inline (no toast).
- [ ] Botones de escritura ocultos para OPERADOR, LOGISTICA y VISUALIZADOR.
- [ ] Paginación funciona cuando hay más servicios que `limit`.
- [ ] Filtros `Activos`/`Inactivos` son mutuamente excluyentes; vacío = todos.
- [ ] Dark mode no rompe la UI.
- [ ] Usable en tablet (768px).
- [ ] Toggle activo confirma con `<ConfirmRow>` antes de aplicar el cambio.
- [ ] Todas las mutations tienen `toast.success` en `onSuccess` y `toast.error`
      en `onError`.
- [ ] Sin clases vanilla CSS en `globals.css`.
- [ ] Comentarios "why" en español en decisiones no obvias.
- [ ] `pnpm tsc --noEmit` pasa sin errores.
- [ ] `pnpm lint` pasa sin errores.
