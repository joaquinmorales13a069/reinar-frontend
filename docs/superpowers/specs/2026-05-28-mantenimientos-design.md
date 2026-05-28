# Spec — Rama 15 `feat/mantenimientos`

**Fecha:** 2026-05-28
**Rama git:** `feat/mantenimientos`
**Plan de referencia:** `docs/plan-trabajo-frontend.md` (RAMA 15)
**Prototipo:** `Frontend-REINAR-design/mantenimientos.jsx`, `Frontend-REINAR-design/mantenimientos-salida.jsx`

## Objetivo

Implementar el módulo de mantenimientos en el frontend Next.js consumiendo el backend Express ya existente en `/Users/joaquinmorales13a06/Desktop/Reinar/server`. El módulo permite registrar, listar, consultar, editar, completar y eliminar mantenimientos de equipos y unidades de herramientas, gestionando sus adjuntos y respetando las transiciones de estado del inventario.

## Contexto del backend (estado actual antes de esta rama)

El módulo `mantenimientos` ya existe en el server. Endpoints:

```
GET    /api/v1/mantenimientos                          ?page&limit&equipoId&herramientaUnidadId&estado&tipo
POST   /api/v1/mantenimientos                          { equipoId? | herramientaUnidadId?, tipo, tecnico, motivo, horometro?, costoEstimado?, repuestos[], proximoMantenimiento? }
GET    /api/v1/mantenimientos/:id
PATCH  /api/v1/mantenimientos/:id/salida               { costoReal?, observacionesSalida?, repuestos? }
POST   /api/v1/mantenimientos/:id/adjuntos             multipart (campo `files`)
DELETE /api/v1/mantenimientos/:id/adjuntos/:adjuntoId
```

Reglas críticas del backend:

- Al crear, equipo no puede estar en `MANTENIMIENTO` ni `RENTADO`; unidad no puede estar en `MANTENIMIENTO`, `RENTADA` ni `RESERVADA`. En transacción, equipo/unidad pasa a `MANTENIMIENTO`.
- `PATCH /salida` solo si estado del mantenimiento es `ACTIVO`. Equipo/unidad vuelve a `DISPONIBLE`. Emite Socket.IO `equipo:disponibilidad` solo para equipos.
- El XOR `equipoId | herramientaUnidadId` se valida en Zod del backend.
- Adjuntos: el backend devuelve `archivoUrl` ya presignada por cada adjunto.

Inconsistencias detectadas en el frontend existente:

- `types/api.ts` define `EquipoMantenimientoResumen` y `UnidadMantenimientoResumen` con campos obsoletos (`descripcion`, `proveedor`, `fechaIngreso`) que no existen en el backend actual (que usa `motivo`, `tecnico`, `fechaEntrada`). Los componentes `components/equipos/EquipoMantenimientosResumen.tsx` y `components/herramientas/UnidadMantenimientosCard.tsx` muestran campos inexistentes silenciosamente.

## Decisiones tomadas en brainstorming

1. **Añadir `PUT /mantenimientos/:id`** al backend, solo si estado=ACTIVO. Permite editar campos no estructurales.
2. **Añadir `DELETE /mantenimientos/:id`** al backend, solo si estado=ACTIVO. Revierte equipo/unidad a `DISPONIBLE` y elimina adjuntos.
3. **Extender `SELECT_MANTENIMIENTO`** para incluir relación con `equipo` y `herramientaUnidad` (incluyendo `herramientaTipo.nombre`). Evita N+1 en el frontend.
4. **Filtros nativos del backend, sin búsqueda libre**. FilterBar con chips para estado y tipo, selectores opcionales de equipo/unidad.
5. **Corregir tipos y componentes** desfasados de equipos y herramientas en esta rama.
6. **Adjuntos en detalle y en formulario de salida**.
7. **Selector de entidad: toggle Equipo/Unidad + combobox con búsqueda**, con prefill por query string (`?equipoId=X` o `?herramientaUnidadId=X`).

## Cambios al backend

Repo: `/Users/joaquinmorales13a06/Desktop/Reinar/server`.

### Endpoint nuevo: `PUT /api/v1/mantenimientos/:id`

- Schema Zod `actualizarMantenimientoSchema` en `mantenimientos.schemas.ts`:
  ```ts
  z.object({
    tecnico: z.string().min(1).optional(),
    motivo: z.string().min(1).optional(),
    horometro: z.number().nonnegative().optional(),
    costoEstimado: z.number().nonnegative().optional(),
    repuestos: z.array(z.string().min(1)).optional(),
    proximoMantenimiento: z.string().datetime().nullable().optional(),
  })
  ```
- Service `actualizarMantenimiento(id, dto, usuarioId)`:
  - Lee estado; 404 si no existe; 422 `ESTADO_INVALIDO` si `estado !== 'ACTIVO'`.
  - Update con campos provistos. Audit log `ACTUALIZAR_MANTENIMIENTO`.
  - Devuelve el mantenimiento con `SELECT_MANTENIMIENTO` extendido + adjuntos con URL.
- Ruta: `router.put('/:id', authenticate, requireRol('ADMIN','GERENTE','OPERADOR','LOGISTICA'), validate(actualizarMantenimientoSchema), ctrl.actualizar)`.

### Endpoint nuevo: `DELETE /api/v1/mantenimientos/:id`

- Service `eliminarMantenimiento(id, usuarioId)`:
  - 404 si no existe; 422 `ESTADO_INVALIDO` si `estado !== 'ACTIVO'`.
  - En transacción: borra cada storageKey de adjuntos en S3 (idempotente), elimina el mantenimiento (cascade borra `MantenimientoAdjunto` en DB), revierte equipo a `DISPONIBLE` o unidad a `DISPONIBLE`, audit log `ELIMINAR_MANTENIMIENTO`.
  - Si era de equipo, emite Socket.IO `equipo:disponibilidad` con estado `DISPONIBLE`.
- Ruta: `router.delete('/:id', authenticate, requireRol('ADMIN','GERENTE','LOGISTICA'), ctrl.eliminar)`.

### `SELECT_MANTENIMIENTO` extendido

```ts
equipo: { select: { id: true, codigoInterno: true, nombre: true } },
herramientaUnidad: {
  select: {
    id: true,
    codigoInterno: true,
    herramientaTipo: { select: { id: true, nombre: true } },
  },
},
```

Afecta también las respuestas de `GET /equipos/:id/mantenimientos` y `GET /herramientas/unidades/:unidadId/mantenimientos`.

### Tests del server

En `tests/mantenimientos.test.ts` (extender si existe, crear si no):

- PUT: éxito en ACTIVO actualiza campos; 422 si COMPLETADO; 404 si no existe; 400 si payload inválido.
- DELETE: éxito en ACTIVO revierte equipo a DISPONIBLE y borra adjuntos; éxito con unidad revierte unidad; 422 si COMPLETADO; 404 si no existe.
- Validar que las respuestas de listar/obtener/crear/salida/actualizar incluyan `equipo` o `herramientaUnidad` poblados.

## Frontend — estructura

Carpetas (sin `src/`, según `CLAUDE.md`):

```
app/(dashboard)/mantenimientos/
  page.tsx                          # Lista
  nuevo/page.tsx                    # Crear
  [id]/page.tsx                     # Detalle
  [id]/editar/page.tsx              # Editar (solo ACTIVO)
  [id]/salida/page.tsx              # Registrar salida (solo ACTIVO)
components/mantenimientos/
  MantenimientoFormFields.tsx       # campos compartidos nuevo/editar
  MantenimientoEntidadSelector.tsx  # toggle + combobox con búsqueda
  MantenimientoAdjuntosCard.tsx     # listado + dropzone + eliminación
  MantenimientoEstadoBadge.tsx
hooks/use-mantenimientos.ts
types/api.ts                        # extender
```

### Hooks (`hooks/use-mantenimientos.ts`)

```
useMantenimientos(filtros)               // GET list
useMantenimiento(id)                     // GET detalle
useCrearMantenimiento()                  // POST
useActualizarMantenimiento(id)           // PUT
useEliminarMantenimiento()               // DELETE
useRegistrarSalida(id)                   // PATCH /salida
useSubirAdjuntos(id)                     // POST /adjuntos (multipart)
useEliminarAdjunto(id)                   // DELETE /adjuntos/:adjuntoId
```

Cada mutation invalida: `['mantenimientos']` (lista), `['mantenimientos', id]` (detalle), y queries del equipo/unidad afectado (`['equipos', equipoId, 'mantenimientos']`, `['herramientas','unidades', unidadId, 'mantenimientos']`, `['equipos', equipoId]`, `['herramientas','unidades', unidadId]`).

### Tipos (`types/api.ts`)

- Reemplazar `EquipoMantenimientoResumen` y `UnidadMantenimientoResumen` por un tipo único `Mantenimiento`:
  ```ts
  export type MantenimientoAdjunto = {
    id: string;
    nombreArchivo: string;
    mimeType: string;
    tamaño: number;
    archivoUrl: string | null;
    createdAt: string;
  };

  export type Mantenimiento = {
    id: string;
    tipo: 'PREVENTIVO' | 'CORRECTIVO' | 'EMERGENCIA';
    estado: 'ACTIVO' | 'COMPLETADO';
    tecnico: string;
    motivo: string;
    horometro: string | null;
    costoEstimado: string | null;
    costoReal: string | null;
    repuestos: string[];
    proximoMantenimiento: string | null;
    observacionesSalida: string | null;
    fechaEntrada: string;
    fechaSalida: string | null;
    equipoId: string | null;
    herramientaUnidadId: string | null;
    equipo: { id: string; codigoInterno: string; nombre: string } | null;
    herramientaUnidad: {
      id: string;
      codigoInterno: string;
      herramientaTipo: { id: string; nombre: string };
    } | null;
    adjuntos: MantenimientoAdjunto[];
    createdAt: string;
    updatedAt: string;
  };
  ```

### Páginas — comportamiento

#### `mantenimientos/page.tsx` (Client)

- `FilterBar` con chips: `estado` (ACTIVO/COMPLETADO), `tipo` (PREVENTIVO/CORRECTIVO/EMERGENCIA). Acepta `?equipoId` / `?herramientaUnidadId` en URL para prefijar filtro (sin chip visible, se muestra como pill removible "Equipo: COD-X" / "Herramienta: COD-Y").
- Tabla columnas: `tipo` (badge), `estado` (badge), entidad (`equipo.codigoInterno - equipo.nombre` o `herramientaUnidad.codigoInterno - herramientaTipo.nombre`), `tecnico`, `fechaEntrada`, `costoEstimado` (o `costoReal` si COMPLETADO).
- Click en fila → `/mantenimientos/[id]`.
- Botón "Nuevo mantenimiento" en `<PageHeader actions>` (oculto para VISUALIZADOR).
- Paginación con `<Pagination />`.
- Socket.IO: se suscribe a `equipos` y al evento `equipo:disponibilidad` para invalidar la lista.

#### `mantenimientos/nuevo/page.tsx` (Client)

- Si `?equipoId` o `?herramientaUnidadId` está presente en query, prefija y oculta el selector.
- `<MantenimientoEntidadSelector>`: toggle "Equipo" / "Unidad de herramienta" → combobox con búsqueda (usa `useEquipos({ busqueda })` / hook análogo para unidades).
- `<MantenimientoFormFields>` con: tipo (select), tecnico (input), motivo (textarea), horometro (input number opcional), costoEstimado (input money opcional), repuestos (input multi-tag), proximoMantenimiento (input datetime-local opcional).
- Schema cliente reproduce el del backend con `.refine` XOR.
- Submit → POST. `onSuccess`: `toast.success('Mantenimiento creado')` + redirect a `/mantenimientos/[id]`.
- Errores 422 `ESTADO_INVALIDO`: `setError('equipoId' | 'herramientaUnidadId', { message })`.

#### `mantenimientos/[id]/page.tsx` (Client)

- `<PageHeader>` con `back` a `/mantenimientos` y actions según estado/rol:
  - `ACTIVO` + escritura: "Editar", "Registrar salida", "Eliminar" (ConfirmRow inline).
  - `COMPLETADO`: ningún botón de mutación.
  - `VISUALIZADOR`: ningún botón de mutación.
- Cards: datos básicos (tipo, estado, técnico, motivo, horómetro, fechas, próximo mantenimiento), costos (estimado + real), repuestos (lista), entidad (con link a `/equipos/[id]` o `/herramientas/unidades/[id]`), observaciones de salida si COMPLETADO, `<MantenimientoAdjuntosCard>`.
- Eliminar:
  - Click → `<ConfirmRow>` con mensaje "Eliminar este mantenimiento revertirá el equipo/unidad a DISPONIBLE".
  - Confirmar → DELETE. `onSuccess`: `toast.success('Mantenimiento eliminado')` + redirect a `/mantenimientos`.
  - Error 422: toast con el mensaje del backend; cerrar ConfirmRow.

#### `mantenimientos/[id]/editar/page.tsx` (Client)

- Si `estado === 'COMPLETADO'`: `toast.error('No se puede editar un mantenimiento completado')` + redirect a `/mantenimientos/[id]`.
- Form prefilled con datos actuales. Mismo `<MantenimientoFormFields>` que `nuevo`, sin selector de entidad y sin `tipo` (no editable). Submit → PUT.
- Errores inline / toast según convención.

#### `mantenimientos/[id]/salida/page.tsx` (Client)

- Si `estado === 'COMPLETADO'`: `toast.error('Este mantenimiento ya fue completado')` + redirect.
- Form: `costoReal` (input money), `observacionesSalida` (textarea), `repuestos` (multi-tag prefilled con los actuales para confirmar/ajustar).
- Sección `<MantenimientoAdjuntosCard>` para subir evidencia antes de cerrar.
- Submit → PATCH `/salida`. `onSuccess`: `toast.success('Salida registrada')` + redirect a detalle.

### Componentes nuevos

- `MantenimientoFormFields.tsx`: agrupa los campos compartidos con `<FormSection>` y `react-hook-form` Controller donde haga falta.
- `MantenimientoEntidadSelector.tsx`: toggle binario + combobox dependiente. El combobox usa pattern existente del proyecto (ver `cotizaciones/crear` si aplica) o un combobox custom con búsqueda por `codigoInterno`/`nombre`.
- `MantenimientoAdjuntosCard.tsx`: lista de adjuntos (nombre + tamaño + icono según mimeType) con botón "Abrir" (presigned URL), botón eliminar (ConfirmRow inline). Dropzone input `<input type="file" multiple accept="image/*,application/pdf">`. Subida con `FormData` (campo `files`). Mientras carga: spinner local.
- `MantenimientoEstadoBadge.tsx`: deriva `kind` para `<Badge>` — `ACTIVO` → `warn`, `COMPLETADO` → `ok`.

### Componentes a corregir

- `types/api.ts`: eliminar/renombrar `EquipoMantenimientoResumen` y `UnidadMantenimientoResumen`. El listado paginado de `/equipos/:id/mantenimientos` y `/herramientas/unidades/:unidadId/mantenimientos` también devuelve la forma extendida — pasar a usar el nuevo tipo `Mantenimiento`.
- `components/equipos/EquipoMantenimientosResumen.tsx`: campos a mostrar → `tipo`, `motivo`, `tecnico`, `fechaEntrada`, badge de `estado`. Enlace a `/mantenimientos/[id]`.
- `components/herramientas/UnidadMantenimientosCard.tsx`: misma corrección. Verificar que el href de "Ver todos" coincida con la query del backend (`?herramientaUnidadId=X`, no `?unidadId=X`).
- `hooks/use-equipos.ts` y `hooks/use-herramientas.ts`: si los tipos cambian, ajustar firmas.

## Reglas de UX y errores (resumen)

- **Validación de campo (Zod cliente):** inline con `setError`.
- **Errores 422 del backend (`ESTADO_INVALIDO`, etc.):** `toast.error(message)`. Si el error invalida la pantalla (mantenimiento ya COMPLETADO al intentar salida/editar/eliminar), además invalidar y redirigir a detalle.
- **Errores de red:** `toast.error('No se pudo completar la operación')`.
- **Éxito:** `toast.success` y redirect cuando aplica.
- **No toastear:** 401 (interceptor), cambios de UI, abrir/cerrar ConfirmRow.

## Roles y permisos en UI

| Acción | Roles que la ven |
|---|---|
| Listar / ver detalle | todos |
| Crear / Editar / Salida / Subir adjuntos | `ADMIN, GERENTE, OPERADOR, LOGISTICA` |
| Eliminar mantenimiento / Eliminar adjunto | `ADMIN, GERENTE, LOGISTICA` |
| `VISUALIZADOR` | solo lectura |

## Convenciones a aplicar

- **Comentarios "why" en español** únicamente en decisiones no obvias (validación XOR, invalidación de queries de equipo/unidad por cambio de estado, manejo del Decimal Schema en strings).
- **Sin valores arbitrarios de Tailwind**. Solo clases predefinidas o `@layer utilities` de `globals.css`.
- **Sin clases vanilla CSS** en `globals.css`.
- **Money**: `decimal.js` + `formatCurrency()` de `lib/utils.ts`.
- **Fechas**: `formatDate()` / `formatDateTime()`.
- **Toasts** con `sonner`.

## Checklist antes de PR (recordatorio)

- [ ] Backend: PUT y DELETE implementados con tests verdes.
- [ ] Frontend consume datos reales, sin mocks.
- [ ] Formularios validan inline y muestran errores del backend.
- [ ] Botones de mutación ocultos para VISUALIZADOR; "Eliminar" oculto para OPERADOR.
- [ ] PDFs/adjuntos abren con la URL presignada.
- [ ] Paginación funciona.
- [ ] Dark mode no rompe la UI.
- [ ] Mobile/tablet usable (768px).
- [ ] `EquipoMantenimientosResumen` y `UnidadMantenimientosCard` muestran datos reales tras corrección.
- [ ] `pnpm tsc --noEmit` y `pnpm lint` verdes.

## Fuera de alcance

- Cambios al schema de Prisma del backend (no hacen falta).
- Reportes / dashboards de mantenimientos (corresponde a la Rama 16 — reportes).
- Notificaciones de mantenimiento próximo (no requerido por el plan).
- Edición del `tipo` o del equipo/unidad asignado a un mantenimiento (decisión: no se permite cambiar la entidad asignada; se debe eliminar y crear de nuevo).
