# Rama 5 — `feat/equipos` — Spec de diseño

**Fecha:** 2026-05-21
**Branch:** `feat/equipos`
**Backend de referencia:** `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/equipos`
**Prototipo de referencia:** `Frontend-REINAR-design/equipos.jsx`, `Frontend-REINAR-design/equipos-ficha.jsx`

## Objetivo

Implementar el módulo de equipos del ERP: catálogo de equipos para renta con CRUD completo, ficha técnica editable, subida de imagen, cambio de estado, mantenimientos recientes y actualizaciones en tiempo real vía Socket.IO.

## Discrepancias resueltas (plan-trabajo vs backend real)

El documento `docs/plan-trabajo-frontend.md` está desactualizado respecto al backend actual. Las siguientes decisiones se toman siguiendo el backend (fuente de verdad):

| Plan-trabajo dice | Realidad del backend | Decisión |
|---|---|---|
| `codigoInterno` al crear | `prefijo` (3-10 chars `[A-Z0-9]+`); `codigo` se autogenera (`PREFIJO-001`) | Usar `prefijo`. Mostrar `codigo` readonly al editar. |
| Una sola `tarifaDia` | Tres tarifas: `tarifaDia`, `tarifaSemana`, `tarifaMes` (todas requeridas) | Tres campos en el form. |
| `bodegaId` en equipo | Modelo `Equipo` no tiene `bodegaId` | Se omite del form. Si en el futuro se agrega, se suma. |
| `GET /:id/disponibilidad` para calendario | No existe. El equivalente es `GET /:id/mantenimientos`. | Se omite la vista de calendario. Mantenimientos recientes en card aparte. |
| `PUT /:id/ficha` separado | La ficha técnica se actualiza con el PUT principal del equipo | La página `/equipos/[id]/ficha` hace `PUT /:id` con solo `fichaTecnica`. |

## Decisiones del usuario (brainstorming)

1. **Ficha técnica:** página dedicada `/equipos/[id]/ficha` (editor key-value + vista previa). NO duplicar el editor inline en el form de editar.
2. **Dependencias de cotizaciones (rama 10):** mostrar placeholders "Disponible próximamente" en lugar de ocultar las secciones (reservas, historial de rentas, "agregar a cotización").
3. **Toggle Tabla/Grilla:** sí, persistido en `ui.store.equiposView`.
4. **Subida de imagen:** sí, drag & drop usando `PATCH /:id/imagen` (multipart).

## Alcance

**Incluye:**
- CRUD completo (lista, crear, detalle, editar, ficha técnica dedicada).
- Filtros (categoría, estado, búsqueda, incluir inactivos para ADMIN/GERENTE), paginación, búsqueda con debounce 300ms.
- Toggle Tabla/Grilla con persistencia en `ui.store`.
- Upload de imagen con drag & drop, preview optimista, opción de eliminar.
- Cambio de estado limitado a `DISPONIBLE | USO_INTERNO | INACTIVO`.
- Soft-delete vía `DELETE /:id` con `<ConfirmRow>` inline.
- Realtime: suscripción a `equipo:disponibilidad` para invalidar React Query cache.
- Mantenimientos recientes (datos reales desde `GET /:id/mantenimientos`).

**Excluye (placeholders "Próximamente"):**
- Reservas activas (depende de cotizaciones, rama 10).
- Historial de rentas (depende de cotizaciones, rama 10).
- Botón "Agregar a cotización" (deshabilitado con tooltip).

## Arquitectura de archivos

```
types/api.ts                          ← agregar Equipo, CategoriaEquipo, EstadoEquipo, FichaTecnica, DTOs
lib/equipos.ts                        ← labels y plantillas de ficha por categoría (mirror del backend)
hooks/use-equipos.ts                  ← React Query hooks (CRUD + imagen + ficha + mantenimientos)
hooks/use-equipos-realtime.ts         ← sub. a socket.io 'equipo:disponibilidad' → invalida cache
stores/ui.store.ts                    ← agregar equiposView: 'tabla' | 'grilla' al tweaks persistido

app/(dashboard)/equipos/
  page.tsx                            ← Server Component shell + import del Client
  nuevo/page.tsx                      ← Form crear (Client)
  [id]/
    page.tsx                          ← Detalle con tabs (Client)
    editar/page.tsx                   ← Form editar (Client)
    ficha/page.tsx                    ← Editor ficha técnica con vista previa (Client)

components/equipos/
  EquiposListClient.tsx               ← FilterBar + toggle vista + tabla/grilla + paginación + realtime
  EquipoTabla.tsx                     ← tabla densa con acciones inline
  EquipoGrilla.tsx                    ← grid de cards (260px min, foto + datos clave)
  EquipoForm.tsx                      ← form reutilizable crear/editar (sin ficha)
  EquipoFichaEditor.tsx               ← editor key-value con vista previa
  EquipoImagenUpload.tsx              ← drag & drop + preview optimista + DELETE
  EquipoEstadoMenu.tsx                ← menú cambio de estado + ConfirmRow
  EquipoCategoriaBadge.tsx            ← badge con label en español
  EquipoMantenimientosResumen.tsx     ← card "Mantenimientos recientes" (real)
  EquipoRentasPlaceholder.tsx         ← card "Historial de rentas — Próximamente"
  EquipoReservaPlaceholder.tsx        ← banner "Reservas — Próximamente con cotizaciones"
```

## Tipos (`types/api.ts`)

```typescript
export type CategoriaEquipo =
  | 'COMPRESOR_GENERADOR'
  | 'SANDBLASTING'
  | 'ANDAMIO_PLATAFORMA'
  | 'COMPACTADOR_RODILLO'
  | 'HERRAMIENTA_ESPECIALIZADA'
  | 'OTRO';

export type EstadoEquipo =
  | 'DISPONIBLE'
  | 'RENTADO'        // gestionado por sistema (cotizaciones)
  | 'MANTENIMIENTO'  // gestionado por sistema (módulo mantenimientos)
  | 'USO_INTERNO'
  | 'INACTIVO';

export type EstadoEquipoEditable = 'DISPONIBLE' | 'USO_INTERNO' | 'INACTIVO';

export type FichaTecnica = Record<string, string>;

export interface Equipo {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoria: CategoriaEquipo;
  estado: EstadoEquipo;
  marca: string | null;
  modelo: string | null;
  anoFabricacion: number | null;
  imagenUrl: string | null;
  fichaTecnica: FichaTecnica | null;
  tarifaDia: string;     // Decimal string del backend
  tarifaSemana: string;
  tarifaMes: string;
  activo: boolean;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrearEquipoDto {
  prefijo: string;
  nombre: string;
  descripcion?: string;
  categoria: CategoriaEquipo;
  marca?: string;
  modelo?: string;
  anoFabricacion?: number;
  tarifaDia: number;
  tarifaSemana: number;
  tarifaMes: number;
  notas?: string;
  fichaTecnica?: FichaTecnica;
}

export type ActualizarEquipoDto = Partial<Omit<CrearEquipoDto, 'prefijo'>>;

export interface FiltrosEquipos {
  page?: number;
  limit?: number;
  search?: string;
  categoria?: CategoriaEquipo;
  estado?: EstadoEquipo;
  incluirInactivos?: boolean;
}
```

## Constantes y plantillas (`lib/equipos.ts`)

```typescript
export const CATEGORIA_LABELS: Record<CategoriaEquipo, string> = {
  COMPRESOR_GENERADOR: 'Compresor / Generador',
  SANDBLASTING: 'Sandblasting',
  ANDAMIO_PLATAFORMA: 'Andamio / Plataforma',
  COMPACTADOR_RODILLO: 'Compactador / Rodillo',
  HERRAMIENTA_ESPECIALIZADA: 'Herramienta especializada',
  OTRO: 'Otro',
};

export const ESTADO_LABELS: Record<EstadoEquipo, string> = {
  DISPONIBLE: 'Disponible',
  RENTADO: 'Rentado',
  MANTENIMIENTO: 'Mantenimiento',
  USO_INTERNO: 'Uso interno',
  INACTIVO: 'Inactivo',
};

// Plantillas idénticas a las del backend (`equipos.service.ts > PLANTILLAS_FICHA`).
// Se duplican aquí para mostrar campos sugeridos en el editor de ficha técnica
// sin tener que hacer una llamada extra al servidor.
export const PLANTILLAS_FICHA: Partial<Record<CategoriaEquipo, FichaTecnica>> = {
  COMPRESOR_GENERADOR: {
    'Potencia (HP)': '',
    'Caudal (CFM)': '',
    'Presión máxima (PSI)': '',
    'Capacidad tanque (L)': '',
    'Combustible': '',
    'Capacidad depósito combustible (L)': '',
    'Voltaje de salida (V)': '',
    'Peso (kg)': '',
  },
  SANDBLASTING: {
    'Capacidad tolva (kg)': '',
    'Presión de trabajo (PSI)': '',
    'Consumo de aire (CFM)': '',
    'Diámetro de boquilla (mm)': '',
    'Tipo de abrasivo compatible': '',
    'Peso (kg)': '',
  },
  ANDAMIO_PLATAFORMA: {
    'Altura máxima (m)': '',
    'Capacidad de carga (kg)': '',
    'Material': '',
    'Dimensiones plataforma (m × m)': '',
    'Número de niveles': '',
    'Peso total (kg)': '',
  },
  COMPACTADOR_RODILLO: {
    'Potencia (HP)': '',
    'Peso operativo (kg)': '',
    'Ancho de trabajo (cm)': '',
    'Fuerza centrífuga (kN)': '',
    'Amplitud de vibración (mm)': '',
    'Combustible': '',
    'Capacidad depósito (L)': '',
  },
  HERRAMIENTA_ESPECIALIZADA: {
    'Potencia (HP/W)': '',
    'Voltaje (V)': '',
    'Presión operativa (PSI)': '',
    'Peso (kg)': '',
  },
  // OTRO no tiene plantilla — usuario define todos los campos.
};
```

## Hooks (`hooks/use-equipos.ts`)

Siguiendo el patrón de `use-clientes.ts`:

- `useEquipos(params: FiltrosEquipos)` — `GET /equipos` con paginación. `queryKey: ['equipos', params]`.
- `useEquipo(id: string)` — `GET /equipos/:id`. `queryKey: ['equipos', id]`. `enabled: !!id`.
- `useEquipoFichaTecnica(id: string)` — `GET /equipos/:id/ficha-tecnica`.
- `useEquipoMantenimientos(id: string)` — `GET /equipos/:id/mantenimientos`.
- `useCrearEquipo()` — `POST /equipos`. `onSuccess` invalida `['equipos']` y `toast.success('Equipo creado.')`.
- `useEditarEquipo()` — `PUT /equipos/:id`. Invalida `['equipos']` y `['equipos', id]`.
- `useCambiarEstadoEquipo()` — `PATCH /equipos/:id/estado`. Invalida ambos query keys.
- `useSubirImagenEquipo()` — `PATCH /equipos/:id/imagen` con `FormData`.
- `useEliminarEquipo()` — `DELETE /equipos/:id` (soft delete).

Reglas comunes:
- `onSuccess`: `toast.success(<mensaje>)`.
- `onError`: si el backend devuelve `error.details` con paths, no se toastea (se mapea a `setError` en el form). Para otros errores: `toast.error(err.response?.data?.error?.message ?? 'Ocurrió un error.')`.

## Realtime (`hooks/use-equipos-realtime.ts`)

```typescript
export function useEquiposRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    if (!socket.connected) socket.connect();
    socket.emit('join', 'equipos');
    const handler = (payload: { equipoId: string; estado: EstadoEquipo }) => {
      qc.invalidateQueries({ queryKey: ['equipos'] });
      qc.invalidateQueries({ queryKey: ['equipos', payload.equipoId] });
    };
    socket.on('equipo:disponibilidad', handler);
    return () => { socket.off('equipo:disponibilidad', handler); };
  }, [qc]);
}
```

Se monta en `EquiposListClient` y en `app/(dashboard)/equipos/[id]/page.tsx`.

## UI/UX por página

### `/equipos` (lista)

- `PageHeader title="Equipos"` con subtitle `"<X> unidades · <Y> categorías"`. Acción "Nuevo equipo" oculta para `VISUALIZADOR`.
- `FilterBar`: búsqueda con debounce 300ms; chips de categoría (6) y estado (DISPONIBLE/RENTADO/MANTENIMIENTO/USO_INTERNO).
- Toggle Tabla/Grilla (segmented control), persistido en `ui.store.equiposView`.
- Checkbox "Incluir inactivos" visible solo para ADMIN/GERENTE (regla del backend).
- **Tabla**: Código (mono) · Nombre + descripción corta · Categoría (badge) · Marca/Modelo · $/día · Estado (badge) · acciones (ver, editar).
- **Grilla**: cards con foto (o placeholder), código mono, estado badge, nombre, marca·modelo, categoría badge, tarifa/día destacada en mono.
- `<Pagination>` debajo. `<Spinner>` al cargar; `<EmptyState>` si vacío.

### `/equipos/nuevo`

- `PageHeader back backLabel="Equipos"`.
- `EquipoForm` con secciones (`FormSection`):
  1. **Imagen** (opcional, se sube después del POST cuando ya hay `id`).
  2. **Información general** — `prefijo` (uppercase auto), `categoria`, `nombre`, `marca`, `modelo`, `anoFabricacion`, `descripcion`.
  3. **Tarifas** — 3 inputs numéricos (`step="0.01"`), todos requeridos y > 0.
  4. **Ficha técnica** — banner informativo: "Se crearán los campos sugeridos para esta categoría. Podrás editarlos después en la sección de ficha técnica."
  5. **Notas internas** — textarea opcional.
- Submit: `POST /equipos` → si hay imagen pendiente, `PATCH /:id/imagen` → redirect a `/equipos/[id]`.

### `/equipos/[id]` (detalle)

- `PageHeader title={nombre} subtitle={<código mono · categoría badge · estado badge>}` con acciones: Editar · Editar ficha técnica · Cambiar estado (menu) · "Agregar a cotización" (deshabilitado con tooltip "Próximamente").
- Banner `<EquipoReservaPlaceholder>` (visible si `estado==='DISPONIBLE'`): "Cuando se habilite el módulo de cotizaciones, aquí verás las reservas activas."
- Grid 2 columnas (1 en móvil < 768px):
  - **Izquierda — card con tabs**:
    - **Especificaciones**: imagen + datos generales (marca, modelo, año, categoría, descripción) + notas.
    - **Ficha técnica**: tabla key-value desde `useEquipoFichaTecnica`. `<EmptyState>` si vacía con botón "Editar ficha técnica".
    - **Historial**: `<EquipoRentasPlaceholder>` "Próximamente con el módulo de cotizaciones".
  - **Derecha — cards apiladas**:
    - Tarifas vigentes (3 mini-cards `Por día / Por semana / Por mes`).
    - Historial de rentas (placeholder).
    - `<EquipoMantenimientosResumen>` — datos reales desde `useEquipoMantenimientos`. Muestra últimos 3-5.

### `/equipos/[id]/editar`

- `EquipoForm` modo edición. Diferencias vs crear:
  - Sin `prefijo`; `codigo` mostrado readonly.
  - `categoria` deshabilitada con tooltip: "Para cambiar la categoría, edita la ficha técnica desde su pantalla dedicada."
  - Sección de imagen permite reemplazar/eliminar.
  - Selector de estado con `DISPONIBLE | USO_INTERNO | INACTIVO` + hint "RENTADO y MANTENIMIENTO los gestiona el sistema."
  - Footer: botón "Desactivar equipo" en `text-danger` que abre `<ConfirmRow>` con mensaje contextual.

### `/equipos/[id]/ficha`

- `EquipoFichaEditor` (similar al prototipo `equipos-ficha.jsx`):
  - Editor de pares clave-valor (agregar/quitar filas).
  - Validación: no se permiten filas con clave vacía pero valor lleno.
  - Botón "Aplicar plantilla de la categoría" que rellena campos sugeridos sin pisar los existentes.
  - Card "Vista previa" debajo con la tabla key-value tal como se verá en el detalle.
- Submit: `PUT /equipos/:id` con `{ fichaTecnica }`.

## Permisos por rol

| Acción | Roles permitidos |
|---|---|
| Ver lista, detalle, ficha | TODOS |
| Crear / editar | ADMIN, GERENTE |
| Cambiar estado / subir imagen | ADMIN, GERENTE, LOGISTICA |
| Eliminar (soft) | ADMIN, GERENTE |
| Ver inactivos en la lista | ADMIN, GERENTE |

Los botones de escritura se ocultan (no solo deshabilitan) para roles sin permiso. El backend valida también; el frontend solo evita confusión visual.

## Manejo de errores

- **422 `ESTADO_INVALIDO`** (desactivar equipo rentado): `toast.error('No se puede desactivar un equipo rentado.')`.
- **400 en upload de imagen** (tamaño/formato): mostrar inline en `EquipoImagenUpload`, no toast.
- **Errores de validación Zod** del backend (`error.details: [{ path, message }]`): mapear `path` → `setError(path, { type: 'server', message })` en RHF. No toast.
- **404** al cargar detalle: página de error con botón "Volver a equipos".
- **Errores genéricos de red / 5xx**: `toast.error(err.response?.data?.error?.message ?? 'Ocurrió un error.')`.

## Convenciones aplicables

- **Comentarios "why" en español** en decisiones no obvias (regla de CLAUDE.md).
- **Tailwind first**, sin valores arbitrarios. Colores y tokens en `@layer utilities` si Tailwind no genera la utilidad automáticamente.
- **Server Components por defecto**, `'use client'` solo cuando se necesite interactividad / React Query.
- **Sin modales** para acciones principales — toda acción abre página dedicada o usa `<ConfirmRow>`.
- **Montos** con `decimal.js` y `formatCurrency()` de `lib/utils.ts`. Nunca `parseFloat()`.
- **Códigos en `font-mono`** (`EQ-001`, etc.).
- **Toasts**: `success` en mutations exitosas, `error` en errores no manejados inline. Nada de toast para errores de validación de campo (van inline con `setError`).

## Checklist antes de PR

- [ ] Páginas cargan datos reales del backend (sin mocks).
- [ ] Formularios validan con Zod y muestran errores del servidor inline.
- [ ] Botones de escritura ocultos para `VISUALIZADOR`.
- [ ] Toggle Tabla/Grilla persiste tras reload.
- [ ] Imagen se sube y aparece presigned URL en el detalle.
- [ ] Cambio de estado dispara realtime y actualiza la lista en otra pestaña.
- [ ] Dark mode no rompe la UI.
- [ ] Vista usable en tablet (768px).
- [ ] `pnpm tsc --noEmit` pasa sin errores.
- [ ] `pnpm lint` pasa sin errores.
- [ ] Comentarios "why" en español en decisiones no obvias.
- [ ] Sin clases vanilla CSS en `globals.css` — todo Tailwind o `@layer utilities`.
