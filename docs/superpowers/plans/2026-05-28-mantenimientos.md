# Mantenimientos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el módulo de mantenimientos en el frontend Next.js (Rama 15) sobre el backend Express ya existente, añadiendo dos endpoints (`PUT` y `DELETE`), corrigiendo tipos y componentes desfasados, y cubriendo el flujo completo (lista, crear, ver, editar, registrar salida, eliminar y adjuntos).

**Architecture:** Backend Express modular (controller/service/schemas/routes) con Prisma + tests Vitest mockeando prisma/io/storage. Frontend Next.js 19 App Router (sin `src/`) con React Query, Zustand, Tailwind v4, React Hook Form + Zod, sonner para toasts, Socket.IO para realtime. El XOR Equipo/Unidad se mantiene como invariante tanto en backend como en frontend.

**Tech Stack:** Next.js 19, React 19, React Query, React Hook Form, Zod, Tailwind v4, decimal.js, sonner, Axios, Socket.IO; Express, Prisma, Vitest, Zod (server).

**Spec de referencia:** `docs/superpowers/specs/2026-05-28-mantenimientos-design.md`

**Repos:**
- Frontend: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend` (rama actual: `feat/mantenimientos`)
- Backend: `/Users/joaquinmorales13a06/Desktop/Reinar/server` (necesita rama paralela `feat/mantenimientos` — crear si no existe)

**Comandos clave:**
- Frontend: `pnpm dev` (puerto 3001), `pnpm tsc --noEmit`, `pnpm lint`
- Backend: `pnpm test`, `pnpm test -- mantenimientos`

---

## Tarea 0: Preparar rama del backend

**Files:**
- (ninguno — solo git en el repo del server)

- [ ] **Paso 1: Crear/cambiar a la rama `feat/mantenimientos` del backend**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git checkout -b feat/mantenimientos 2>/dev/null || git checkout feat/mantenimientos
git status
```

Esperado: rama `feat/mantenimientos`, working tree clean.

---

## Tarea 1: Backend — extender `SELECT_MANTENIMIENTO` con equipo y unidad

Incluir datos del equipo o unidad relacionada en todas las respuestas del módulo para evitar fetches adicionales en frontend.

**Files:**
- Modify: `src/modules/mantenimientos/mantenimientos.service.ts`
- Modify: `tests/modules/mantenimientos/mantenimientos.service.test.ts`

- [ ] **Paso 1: Añadir test que verifica que `obtenerMantenimiento` retorna `equipo`**

Abrir `tests/modules/mantenimientos/mantenimientos.service.test.ts`. Localizar la sección de tests de `obtenerMantenimiento` y añadir:

```ts
it('incluye equipo y herramientaUnidad poblados en obtenerMantenimiento', async () => {
  const m = {
    ...mockMant,
    equipoId: 'eq-1',
    herramientaUnidadId: null,
    equipo: { id: 'eq-1', codigoInterno: 'EQ-001', nombre: 'Generador' },
    herramientaUnidad: null,
    adjuntos: [],
  }
  prismaMock.mantenimiento.findUnique.mockResolvedValueOnce(m as any)

  const result = await obtenerMantenimiento('mant-1')

  expect(result.equipo).toEqual({ id: 'eq-1', codigoInterno: 'EQ-001', nombre: 'Generador' })
  expect(result.herramientaUnidad).toBeNull()
  // Validamos que el select pasado a Prisma haya pedido equipo + unidad
  const args = prismaMock.mantenimiento.findUnique.mock.calls[0][0]
  expect(args.select.equipo).toBeDefined()
  expect(args.select.herramientaUnidad).toBeDefined()
})
```

- [ ] **Paso 2: Ejecutar el test y verificar que falla**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm test -- mantenimientos.service
```

Esperado: el test añadido falla porque el `SELECT_MANTENIMIENTO` actual no incluye `equipo` ni `herramientaUnidad`.

- [ ] **Paso 3: Extender `SELECT_MANTENIMIENTO`**

Editar `src/modules/mantenimientos/mantenimientos.service.ts`. Reemplazar el bloque `SELECT_MANTENIMIENTO`:

```ts
const SELECT_MANTENIMIENTO = {
  id: true,
  tipo: true,
  estado: true,
  tecnico: true,
  motivo: true,
  horometro: true,
  costoEstimado: true,
  costoReal: true,
  repuestos: true,
  proximoMantenimiento: true,
  observacionesSalida: true,
  fechaEntrada: true,
  fechaSalida: true,
  equipoId: true,
  herramientaUnidadId: true,
  // Incluimos los datos minimos del equipo/unidad para que el frontend pueda
  // mostrar codigo y nombre sin un fetch extra por cada fila de la lista.
  equipo: {
    select: { id: true, codigoInterno: true, nombre: true },
  },
  herramientaUnidad: {
    select: {
      id: true,
      codigoInterno: true,
      herramientaTipo: { select: { id: true, nombre: true } },
    },
  },
  adjuntos: {
    select: {
      id: true,
      nombreArchivo: true,
      storageKey: true,
      mimeType: true,
      tamaño: true,
      createdAt: true,
    },
  },
  createdAt: true,
  updatedAt: true,
} as const
```

- [ ] **Paso 4: Verificar que el test pasa y ejecutar la suite del módulo**

```bash
pnpm test -- mantenimientos
```

Esperado: PASS. Ningún otro test del módulo se rompe.

- [ ] **Paso 5: Commit**

```bash
git add src/modules/mantenimientos/mantenimientos.service.ts tests/modules/mantenimientos/mantenimientos.service.test.ts
git commit -m "feat(mantenimientos): incluir equipo y unidad en SELECT del modulo

Para que el frontend pueda mostrar codigo y nombre sin fetchs extra,
SELECT_MANTENIMIENTO ahora incluye equipo y herramientaUnidad
(con herramientaTipo.nombre)."
```

---

## Tarea 2: Backend — añadir `PUT /mantenimientos/:id`

Permite editar técnico, motivo, horómetro, costoEstimado, repuestos y próximoMantenimiento solo si el mantenimiento sigue `ACTIVO`.

**Files:**
- Modify: `src/modules/mantenimientos/mantenimientos.schemas.ts`
- Modify: `src/modules/mantenimientos/mantenimientos.service.ts`
- Modify: `src/modules/mantenimientos/mantenimientos.controller.ts`
- Modify: `src/modules/mantenimientos/mantenimientos.routes.ts`
- Modify: `tests/modules/mantenimientos/mantenimientos.service.test.ts`
- Modify: `tests/modules/mantenimientos/mantenimientos.routes.test.ts`

- [ ] **Paso 1: Añadir el schema Zod `actualizarMantenimientoSchema`**

Editar `src/modules/mantenimientos/mantenimientos.schemas.ts`. Añadir antes de la línea `export const filtrosMantenimientoSchema`:

```ts
export const actualizarMantenimientoSchema = z.object({
  tecnico:              z.string().min(1, 'El técnico es requerido').optional(),
  motivo:               z.string().min(1, 'El motivo es requerido').optional(),
  horometro:            z.number().nonnegative().optional(),
  costoEstimado:        z.number().nonnegative().optional(),
  repuestos:            z.array(z.string().min(1)).optional(),
  // Aceptamos null explicitamente para permitir limpiar la fecha agendada
  // sin tener que enviar un valor placeholder.
  proximoMantenimiento: z.string().datetime().nullable().optional(),
})

export type ActualizarMantenimientoDto = z.infer<typeof actualizarMantenimientoSchema>
```

- [ ] **Paso 2: Añadir tests del service para `actualizarMantenimiento`**

Editar `tests/modules/mantenimientos/mantenimientos.service.test.ts`. En el bloque `describe`, añadir:

```ts
describe('actualizarMantenimiento', () => {
  beforeEach(() => vi.clearAllMocks())

  it('actualiza un mantenimiento ACTIVO y registra audit log', async () => {
    prismaMock.mantenimiento.findUnique.mockResolvedValueOnce({
      id: 'mant-1', estado: 'ACTIVO',
    } as any)
    prismaMock.mantenimiento.update.mockResolvedValueOnce({
      ...mockMant,
      motivo: 'Motivo nuevo',
      adjuntos: [],
      equipo: null,
      herramientaUnidad: null,
    } as any)

    const result = await actualizarMantenimiento('mant-1', { motivo: 'Motivo nuevo' }, 'user-1')

    expect(result.motivo).toBe('Motivo nuevo')
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ accion: 'ACTUALIZAR_MANTENIMIENTO' }) }),
    )
  })

  it('lanza 404 si el mantenimiento no existe', async () => {
    prismaMock.mantenimiento.findUnique.mockResolvedValueOnce(null)
    await expect(actualizarMantenimiento('nope', { motivo: 'x' }, 'user-1'))
      .rejects.toThrow(AppError)
  })

  it('lanza 422 ESTADO_INVALIDO si esta COMPLETADO', async () => {
    prismaMock.mantenimiento.findUnique.mockResolvedValueOnce({
      id: 'mant-1', estado: 'COMPLETADO',
    } as any)
    await expect(actualizarMantenimiento('mant-1', { motivo: 'x' }, 'user-1'))
      .rejects.toThrow(/COMPLETADO|estado/i)
  })
})
```

Y añadir el import a la lista existente:

```ts
import {
  crearMantenimiento,
  registrarSalida,
  subirAdjuntos,
  eliminarAdjunto,
  listarMantenimientos,
  obtenerMantenimiento,
  actualizarMantenimiento,
} from '../../../src/modules/mantenimientos/mantenimientos.service'
```

- [ ] **Paso 3: Ejecutar tests y verificar que fallan**

```bash
pnpm test -- mantenimientos.service
```

Esperado: los tres tests nuevos fallan porque `actualizarMantenimiento` no existe.

- [ ] **Paso 4: Implementar el service `actualizarMantenimiento`**

Editar `src/modules/mantenimientos/mantenimientos.service.ts`. Añadir el import al inicio:

```ts
import { CrearMantenimientoDto, SalidaMantenimientoDto, FiltrosMantenimiento, ActualizarMantenimientoDto } from './mantenimientos.schemas'
```

Añadir la función después de `registrarSalida` (antes de `subirAdjuntos`):

```ts
export async function actualizarMantenimiento(
  id: string,
  dto: ActualizarMantenimientoDto,
  usuarioId: string,
) {
  const existe = await prisma.mantenimiento.findUnique({
    where: { id },
    select: { id: true, estado: true },
  })
  if (!existe) throw new AppError(404, 'NOT_FOUND', 'Mantenimiento no encontrado')
  // Se bloquea la edicion una vez registrada la salida porque los campos editables
  // (costoEstimado, repuestos, horometro, proximoMantenimiento) pierden sentido
  // y porque el flujo posterior pertenece al historial inmutable.
  if (existe.estado !== 'ACTIVO')
    throw new AppError(422, 'ESTADO_INVALIDO', 'Solo se puede editar un mantenimiento activo')

  const { proximoMantenimiento, ...rest } = dto

  const actualizado = await prisma.$transaction(async (tx) => {
    const m = await tx.mantenimiento.update({
      where: { id },
      data: {
        ...rest,
        // Permitimos null para borrar la fecha agendada; undefined deja el valor previo.
        ...(proximoMantenimiento !== undefined
          ? { proximoMantenimiento: proximoMantenimiento ? new Date(proximoMantenimiento) : null }
          : {}),
      },
      select: SELECT_MANTENIMIENTO,
    })

    await tx.auditLog.create({
      data: {
        usuarioId,
        entidad:       'Mantenimiento',
        entidadId:     id,
        accion:        'ACTUALIZAR_MANTENIMIENTO',
        camposDespues: dto as Prisma.InputJsonValue,
      },
    })

    return m
  })

  return resolveAdjuntosUrl(actualizado)
}
```

- [ ] **Paso 5: Añadir el controller `actualizar`**

Editar `src/modules/mantenimientos/mantenimientos.controller.ts`. Añadir antes de `export async function listar`:

```ts
export async function actualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const mantenimiento = await service.actualizarMantenimiento(
      req.params.id as string,
      req.body,
      req.user!.sub,
    )
    res.json({ success: true, data: mantenimiento })
  } catch (err) { next(err) }
}
```

- [ ] **Paso 6: Añadir la ruta**

Editar `src/modules/mantenimientos/mantenimientos.routes.ts`. Añadir el import:

```ts
import {
  crearMantenimientoSchema,
  salidaMantenimientoSchema,
  actualizarMantenimientoSchema,
  filtrosMantenimientoSchema,
} from './mantenimientos.schemas'
```

Y añadir la ruta entre `router.get('/:id', ...)` y `router.patch('/:id/salida', ...)`:

```ts
router.put('/:id', authenticate, requireRol(...operadoresLogistica), validate(actualizarMantenimientoSchema), ctrl.actualizar)
```

- [ ] **Paso 7: Añadir tests de rutas para PUT**

Editar `tests/modules/mantenimientos/mantenimientos.routes.test.ts`. Añadir dentro del describe principal:

```ts
describe('PUT /mantenimientos/:id', () => {
  it('actualiza un mantenimiento activo y devuelve 200', async () => {
    const token = await loginAs('ADMIN')
    // Asumimos un helper o setup que crea un mantenimiento ACTIVO con id existente
    const res = await request(app)
      .put(`/api/v1/mantenimientos/${mantenimientoActivoId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ motivo: 'Cambio de motivo' })
    expect(res.status).toBe(200)
    expect(res.body.data.motivo).toBe('Cambio de motivo')
  })

  it('rechaza con 422 si el mantenimiento esta COMPLETADO', async () => {
    const token = await loginAs('ADMIN')
    const res = await request(app)
      .put(`/api/v1/mantenimientos/${mantenimientoCompletadoId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ motivo: 'No deberia funcionar' })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('ESTADO_INVALIDO')
  })

  it('rechaza con 403 si el rol no tiene permiso', async () => {
    const token = await loginAs('VISUALIZADOR')
    const res = await request(app)
      .put(`/api/v1/mantenimientos/${mantenimientoActivoId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ motivo: 'X' })
    expect(res.status).toBe(403)
  })
})
```

Si el archivo de tests existente usa otro patrón (mock-based, no supertest real), adaptarlo a ese patrón sin cambiar la cobertura (estado válido / 422 estado inválido / rol denegado).

- [ ] **Paso 8: Ejecutar la suite completa del módulo**

```bash
pnpm test -- mantenimientos
```

Esperado: todos los tests PASS (service + routes).

- [ ] **Paso 9: Commit**

```bash
git add src/modules/mantenimientos tests/modules/mantenimientos
git commit -m "feat(mantenimientos): endpoint PUT para editar mantenimiento activo

Permite editar tecnico, motivo, horometro, costoEstimado, repuestos
y proximoMantenimiento mientras el mantenimiento sigue ACTIVO.
Una vez registrada la salida queda inmutable como parte del historial."
```

---

## Tarea 3: Backend — añadir `DELETE /mantenimientos/:id`

Permite eliminar un mantenimiento activo, revirtiendo el equipo/unidad a `DISPONIBLE` y borrando sus adjuntos.

**Files:**
- Modify: `src/modules/mantenimientos/mantenimientos.service.ts`
- Modify: `src/modules/mantenimientos/mantenimientos.controller.ts`
- Modify: `src/modules/mantenimientos/mantenimientos.routes.ts`
- Modify: `tests/modules/mantenimientos/mantenimientos.service.test.ts`
- Modify: `tests/modules/mantenimientos/mantenimientos.routes.test.ts`

- [ ] **Paso 1: Añadir tests del service para `eliminarMantenimiento`**

Editar `tests/modules/mantenimientos/mantenimientos.service.test.ts`. Añadir:

```ts
describe('eliminarMantenimiento', () => {
  beforeEach(() => vi.clearAllMocks())

  it('elimina un mantenimiento ACTIVO de equipo, revierte estado y borra adjuntos', async () => {
    prismaMock.mantenimiento.findUnique.mockResolvedValueOnce({
      id: 'mant-1',
      estado: 'ACTIVO',
      equipoId: 'eq-1',
      herramientaUnidadId: null,
      adjuntos: [{ id: 'adj-1', storageKey: 'mantenimientos/file.jpg' }],
    } as any)

    prismaMock.$transaction.mockImplementation(async (cb: any) => cb(prismaMock))

    await eliminarMantenimiento('mant-1', 'user-1')

    expect(storage.deleteFile).toHaveBeenCalledWith('mantenimientos/file.jpg')
    expect(prismaMock.mantenimiento.delete).toHaveBeenCalledWith({ where: { id: 'mant-1' } })
    expect(prismaMock.equipo.update).toHaveBeenCalledWith({
      where: { id: 'eq-1' }, data: { estado: 'DISPONIBLE' },
    })
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ accion: 'ELIMINAR_MANTENIMIENTO' }) }),
    )
  })

  it('lanza 404 si no existe', async () => {
    prismaMock.mantenimiento.findUnique.mockResolvedValueOnce(null)
    await expect(eliminarMantenimiento('nope', 'user-1')).rejects.toThrow(AppError)
  })

  it('lanza 422 ESTADO_INVALIDO si esta COMPLETADO', async () => {
    prismaMock.mantenimiento.findUnique.mockResolvedValueOnce({
      id: 'mant-1', estado: 'COMPLETADO', equipoId: 'eq-1', herramientaUnidadId: null, adjuntos: [],
    } as any)
    await expect(eliminarMantenimiento('mant-1', 'user-1')).rejects.toThrow(/COMPLETADO|estado/i)
  })
})
```

Añadir `eliminarMantenimiento` al import del módulo bajo prueba.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

```bash
pnpm test -- mantenimientos.service
```

Esperado: los tests nuevos fallan porque `eliminarMantenimiento` no existe.

- [ ] **Paso 3: Implementar `eliminarMantenimiento` en el service**

Editar `src/modules/mantenimientos/mantenimientos.service.ts`. Añadir después de `actualizarMantenimiento`:

```ts
export async function eliminarMantenimiento(id: string, usuarioId: string) {
  const mantenimiento = await prisma.mantenimiento.findUnique({
    where: { id },
    select: {
      id: true,
      estado: true,
      equipoId: true,
      herramientaUnidadId: true,
      adjuntos: { select: { storageKey: true } },
    },
  })
  if (!mantenimiento) throw new AppError(404, 'NOT_FOUND', 'Mantenimiento no encontrado')
  // Solo permitimos eliminar mantenimientos en curso. Los COMPLETADOS forman parte
  // del historial que reportes y auditoria pueden referenciar.
  if (mantenimiento.estado !== 'ACTIVO')
    throw new AppError(422, 'ESTADO_INVALIDO', 'Solo se puede eliminar un mantenimiento activo')

  // Borramos los archivos en S3 antes de la transaccion para no dejar el delete a medias
  // si S3 falla; deleteFile es idempotente y los huerfanos en S3 son aceptables si la TX falla.
  for (const adj of mantenimiento.adjuntos) {
    await storage.deleteFile(adj.storageKey)
  }

  await prisma.$transaction(async (tx) => {
    // El cascade del schema borra MantenimientoAdjunto al borrar el mantenimiento.
    await tx.mantenimiento.delete({ where: { id } })

    if (mantenimiento.equipoId) {
      await tx.equipo.update({ where: { id: mantenimiento.equipoId }, data: { estado: 'DISPONIBLE' } })
    } else if (mantenimiento.herramientaUnidadId) {
      await tx.herramientaUnidad.update({
        where: { id: mantenimiento.herramientaUnidadId },
        data: { estado: 'DISPONIBLE' },
      })
    }

    await tx.auditLog.create({
      data: {
        usuarioId,
        entidad:       'Mantenimiento',
        entidadId:     id,
        accion:        'ELIMINAR_MANTENIMIENTO',
        camposDespues: {
          equipoId:            mantenimiento.equipoId,
          herramientaUnidadId: mantenimiento.herramientaUnidadId,
        } as Prisma.InputJsonValue,
      },
    })
  })

  if (mantenimiento.equipoId) {
    getIO().to('equipos').emit('equipo:disponibilidad', {
      equipoId: mantenimiento.equipoId, estado: 'DISPONIBLE',
    })
  }
}
```

- [ ] **Paso 4: Añadir el controller `eliminar`**

Editar `src/modules/mantenimientos/mantenimientos.controller.ts`. Añadir antes de `export async function listar`:

```ts
export async function eliminar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.eliminarMantenimiento(req.params.id as string, req.user!.sub)
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
}
```

- [ ] **Paso 5: Añadir la ruta**

Editar `src/modules/mantenimientos/mantenimientos.routes.ts`. Añadir entre `router.patch('/:id/salida', ...)` y `router.post('/:id/adjuntos', ...)`:

```ts
router.delete('/:id', authenticate, requireRol(...inventarioLogistica), ctrl.eliminar)
```

- [ ] **Paso 6: Añadir tests de rutas**

Editar `tests/modules/mantenimientos/mantenimientos.routes.test.ts`. Añadir:

```ts
describe('DELETE /mantenimientos/:id', () => {
  it('elimina un mantenimiento ACTIVO con rol ADMIN', async () => {
    const token = await loginAs('ADMIN')
    const res = await request(app)
      .delete(`/api/v1/mantenimientos/${mantenimientoActivoId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })

  it('rechaza con 422 si esta COMPLETADO', async () => {
    const token = await loginAs('ADMIN')
    const res = await request(app)
      .delete(`/api/v1/mantenimientos/${mantenimientoCompletadoId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(422)
  })

  it('rechaza con 403 si el rol es OPERADOR', async () => {
    const token = await loginAs('OPERADOR')
    const res = await request(app)
      .delete(`/api/v1/mantenimientos/${mantenimientoActivoId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })
})
```

Adaptar al patrón existente si no usa supertest.

- [ ] **Paso 7: Ejecutar la suite completa**

```bash
pnpm test -- mantenimientos
```

Esperado: PASS.

- [ ] **Paso 8: Commit**

```bash
git add src/modules/mantenimientos tests/modules/mantenimientos
git commit -m "feat(mantenimientos): endpoint DELETE para mantenimiento activo

Elimina un mantenimiento mientras este ACTIVO, revierte equipo/unidad
a DISPONIBLE, borra adjuntos de S3 y registra audit log. Roles:
ADMIN, GERENTE, LOGISTICA. Mantenimientos COMPLETADOS son inmutables."
```

---

## Tarea 4: Frontend — actualizar tipos en `types/api.ts`

Reemplazar los tipos obsoletos `EquipoMantenimientoResumen` y `UnidadMantenimientoResumen` por un tipo único `Mantenimiento` que refleja la respuesta real del backend.

**Files:**
- Modify: `types/api.ts`

- [ ] **Paso 1: Eliminar los tipos obsoletos y añadir `Mantenimiento` + `MantenimientoAdjunto`**

Abrir `types/api.ts`.

Buscar el bloque que comienza con `// Forma del mantenimiento devuelto por GET /equipos/:id/mantenimientos.` y reemplazar tanto ese bloque (líneas ~171-182) como el de `UnidadMantenimientoResumen` (línea ~303) por:

```ts
// Adjunto del mantenimiento. archivoUrl viene presignada por el backend
// y expira; no reusarla mas alla del render actual.
export type MantenimientoAdjunto = {
  id:            string;
  nombreArchivo: string;
  mimeType:      string;
  tamaño:        number;
  archivoUrl:    string | null;
  createdAt:     string;
};

export type TipoMantenimiento   = 'PREVENTIVO' | 'CORRECTIVO' | 'EMERGENCIA';
export type EstadoMantenimiento = 'ACTIVO' | 'COMPLETADO';

export type Mantenimiento = {
  id:                   string;
  tipo:                 TipoMantenimiento;
  estado:               EstadoMantenimiento;
  tecnico:              string;
  motivo:               string;
  horometro:            string | null;        // Decimal serializado
  costoEstimado:        string | null;        // Decimal serializado
  costoReal:            string | null;        // Decimal serializado
  repuestos:            string[];
  proximoMantenimiento: string | null;        // ISO datetime
  observacionesSalida:  string | null;
  fechaEntrada:         string;               // ISO datetime
  fechaSalida:          string | null;
  equipoId:             string | null;
  herramientaUnidadId:  string | null;
  equipo: { id: string; codigoInterno: string; nombre: string } | null;
  herramientaUnidad: {
    id:              string;
    codigoInterno:   string;
    herramientaTipo: { id: string; nombre: string };
  } | null;
  adjuntos:  MantenimientoAdjunto[];
  createdAt: string;
  updatedAt: string;
};

export type FiltrosMantenimientos = {
  page?:                number;
  limit?:               number;
  equipoId?:            string;
  herramientaUnidadId?: string;
  estado?:              EstadoMantenimiento;
  tipo?:                TipoMantenimiento;
};

export type CrearMantenimientoDto = {
  equipoId?:            string;
  herramientaUnidadId?: string;
  tipo:                 TipoMantenimiento;
  tecnico:              string;
  motivo:               string;
  horometro?:           number;
  costoEstimado?:       number;
  repuestos:            string[];
  proximoMantenimiento?: string;
};

export type ActualizarMantenimientoDto = {
  tecnico?:              string;
  motivo?:               string;
  horometro?:            number;
  costoEstimado?:        number;
  repuestos?:            string[];
  proximoMantenimiento?: string | null;
};

export type RegistrarSalidaDto = {
  costoReal?:           number;
  observacionesSalida?: string;
  repuestos?:           string[];
};
```

- [ ] **Paso 2: Verificar tsc**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm tsc --noEmit
```

Esperado: errores en `hooks/use-equipos.ts`, `hooks/use-herramientas.ts`, `components/equipos/EquipoMantenimientosResumen.tsx`, `components/herramientas/UnidadMantenimientosCard.tsx` (referencian `EquipoMantenimientoResumen` / `UnidadMantenimientoResumen`). Esto se arregla en la Tarea 5.

- [ ] **Paso 3: No commitear todavía** — esperar a Tarea 5 que arregla los rotos.

---

## Tarea 5: Frontend — corregir hooks y componentes desfasados

Actualizar los hooks y componentes existentes que referencian los tipos obsoletos para usar `Mantenimiento`.

**Files:**
- Modify: `hooks/use-equipos.ts`
- Modify: `hooks/use-herramientas.ts`
- Modify: `components/equipos/EquipoMantenimientosResumen.tsx`
- Modify: `components/herramientas/UnidadMantenimientosCard.tsx`

- [ ] **Paso 1: Actualizar `hooks/use-equipos.ts`**

Reemplazar el import `EquipoMantenimientoResumen` por `Mantenimiento`:

```ts
import type {
  ApiResponse,
  PaginatedResponse,
  Equipo,
  CrearEquipoDto,
  ActualizarEquipoDto,
  FiltrosEquipos,
  EstadoEquipoEditable,
  FichaTecnica,
  Mantenimiento,
  HistorialRentaItem,
  MoverBodegaDto,
} from '@/types/api';
```

Y cambiar el tipo de retorno en `useEquipoMantenimientos`:

```ts
export function useEquipoMantenimientos(id: string) {
  return useQuery({
    queryKey: ['equipos', id, 'mantenimientos'],
    queryFn: () =>
      api
        .get<PaginatedResponse<Mantenimiento>>(`/equipos/${id}/mantenimientos`)
        .then((r) => r.data),
    enabled: !!id,
  });
}
```

- [ ] **Paso 2: Actualizar `hooks/use-herramientas.ts`**

Reemplazar el import `UnidadMantenimientoResumen` por `Mantenimiento`. Cambiar `useMantenimientosUnidad`:

```ts
export function useMantenimientosUnidad(unidadId: string) {
  return useQuery({
    queryKey: ['herramientas', 'unidades', unidadId, 'mantenimientos'],
    queryFn: () =>
      api
        .get<PaginatedResponse<Mantenimiento>>(
          `/herramientas/unidades/${unidadId}/mantenimientos`,
        )
        .then((r) => r.data),
    enabled: !!unidadId,
  });
}
```

- [ ] **Paso 3: Actualizar `components/equipos/EquipoMantenimientosResumen.tsx`**

Reemplazar contenido por:

```tsx
'use client';

import Link from 'next/link';
import { useEquipoMantenimientos } from '@/hooks/use-equipos';
import { Spinner } from '@/components/ui/Spinner';
import { MantenimientoEstadoBadge } from '@/components/mantenimientos/MantenimientoEstadoBadge';
import { formatDate } from '@/lib/utils';

export function EquipoMantenimientosResumen({ equipoId }: { equipoId: string }) {
  const { data, isLoading } = useEquipoMantenimientos(equipoId);

  return (
    <div className="rounded-lg border border-bd bg-surface overflow-hidden">
      <div className="px-4 py-3 border-b border-bd flex items-center justify-between">
        <h3 className="font-semibold text-tx">Mantenimientos recientes</h3>
        <Link
          href={`/mantenimientos?equipoId=${equipoId}`}
          className="text-xs text-accent hover:underline"
        >
          Ver todos
        </Link>
      </div>
      <div className="p-4">
        {isLoading ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : data && data.data.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {data.data.slice(0, 5).map((m, i, arr) => (
              <li
                key={m.id}
                className={`flex items-start justify-between gap-3 ${
                  i < arr.length - 1 ? 'pb-3 border-b border-bd' : ''
                }`}
              >
                <Link href={`/mantenimientos/${m.id}`} className="min-w-0 flex-1 group">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate group-hover:text-accent">
                      {m.tipo}
                    </span>
                    <MantenimientoEstadoBadge estado={m.estado} />
                  </div>
                  <div className="text-xs text-tx-3 truncate">{m.motivo}</div>
                  <div className="text-xs text-tx-3">Técnico: {m.tecnico}</div>
                </Link>
                <div className="text-xs text-tx-3 font-mono shrink-0">
                  {formatDate(m.fechaEntrada)}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-tx-3">Sin mantenimientos registrados.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Paso 4: Actualizar `components/herramientas/UnidadMantenimientosCard.tsx`**

Leer el archivo actual y replicar el mismo patrón, ajustando el href de "Ver todos" a `?herramientaUnidadId=${unidadId}` (el backend usa ese nombre de query):

```tsx
'use client';

import Link from 'next/link';
import { useMantenimientosUnidad } from '@/hooks/use-herramientas';
import { Spinner } from '@/components/ui/Spinner';
import { MantenimientoEstadoBadge } from '@/components/mantenimientos/MantenimientoEstadoBadge';
import { formatDate } from '@/lib/utils';

export function UnidadMantenimientosCard({ unidadId }: { unidadId: string }) {
  const { data, isLoading } = useMantenimientosUnidad(unidadId);

  return (
    <div className="rounded-lg border border-bd bg-surface overflow-hidden">
      <div className="px-4 py-3 border-b border-bd flex items-center justify-between">
        <h3 className="font-semibold text-tx">Mantenimientos recientes</h3>
        <Link
          href={`/mantenimientos?herramientaUnidadId=${unidadId}`}
          className="text-xs text-accent hover:underline"
        >
          Ver todos
        </Link>
      </div>
      <div className="p-4">
        {isLoading ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : data && data.data.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {data.data.slice(0, 5).map((m, i, arr) => (
              <li
                key={m.id}
                className={`flex items-start justify-between gap-3 ${
                  i < arr.length - 1 ? 'pb-3 border-b border-bd' : ''
                }`}
              >
                <Link href={`/mantenimientos/${m.id}`} className="min-w-0 flex-1 group">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate group-hover:text-accent">
                      {m.tipo}
                    </span>
                    <MantenimientoEstadoBadge estado={m.estado} />
                  </div>
                  <div className="text-xs text-tx-3 truncate">{m.motivo}</div>
                  <div className="text-xs text-tx-3">Técnico: {m.tecnico}</div>
                </Link>
                <div className="text-xs text-tx-3 font-mono shrink-0">
                  {formatDate(m.fechaEntrada)}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-tx-3">Sin mantenimientos registrados.</p>
        )}
      </div>
    </div>
  );
}
```

Nota: el componente `MantenimientoEstadoBadge` se crea en la Tarea 6. Por ahora `pnpm tsc --noEmit` reportará error en este import. Se resolverá en la Tarea 6.

- [ ] **Paso 5: Verificar parcialmente con tsc**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Esperado: solo errores sobre `@/components/mantenimientos/MantenimientoEstadoBadge` aún no creado.

- [ ] **Paso 6: No commitear todavía** — continuar con la Tarea 6 para que el árbol vuelva a tipar.

---

## Tarea 6: Frontend — componente `MantenimientoEstadoBadge`

Wrapper sobre `<Badge>` que mapea el estado a un `kind` consistente.

**Files:**
- Create: `components/mantenimientos/MantenimientoEstadoBadge.tsx`

- [ ] **Paso 1: Crear el componente**

```tsx
import { Badge } from '@/components/ui/Badge';
import type { EstadoMantenimiento } from '@/types/api';

// ACTIVO usa warn (amarillo) para destacar que el equipo no esta disponible;
// COMPLETADO usa ok (verde) para indicar cierre exitoso del ciclo.
const KIND: Record<EstadoMantenimiento, 'warn' | 'ok'> = {
  ACTIVO:     'warn',
  COMPLETADO: 'ok',
};

const LABEL: Record<EstadoMantenimiento, string> = {
  ACTIVO:     'Activo',
  COMPLETADO: 'Completado',
};

export function MantenimientoEstadoBadge({ estado }: { estado: EstadoMantenimiento }) {
  return <Badge kind={KIND[estado]}>{LABEL[estado]}</Badge>;
}
```

- [ ] **Paso 2: Verificar tsc**

```bash
pnpm tsc --noEmit
```

Esperado: PASS (sin errores).

- [ ] **Paso 3: Commit del bloque tipos + componentes corregidos + Badge**

```bash
git add types/api.ts hooks/use-equipos.ts hooks/use-herramientas.ts \
  components/equipos/EquipoMantenimientosResumen.tsx \
  components/herramientas/UnidadMantenimientosCard.tsx \
  components/mantenimientos/MantenimientoEstadoBadge.tsx
git commit -m "feat(mantenimientos): tipos Mantenimiento y badge de estado

Reemplaza tipos obsoletos EquipoMantenimientoResumen y
UnidadMantenimientoResumen por Mantenimiento unico, alineado con la
forma real del backend. Corrige los cards de equipos y herramientas
que mostraban campos inexistentes."
```

---

## Tarea 7: Frontend — hooks de React Query

**Files:**
- Create: `hooks/use-mantenimientos.ts`

- [ ] **Paso 1: Crear el archivo de hooks**

```tsx
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  PaginatedResponse,
  Mantenimiento,
  FiltrosMantenimientos,
  CrearMantenimientoDto,
  ActualizarMantenimientoDto,
  RegistrarSalidaDto,
} from '@/types/api';

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

// Invalidamos las queries del equipo o unidad afectada porque la creacion,
// edicion, salida o eliminacion cambian su estado (DISPONIBLE/MANTENIMIENTO)
// y los cards "Mantenimientos recientes" en sus detalles deben recargarse.
function invalidateEntidadRelacionada(qc: ReturnType<typeof useQueryClient>, m?: Mantenimiento | null) {
  if (!m) return;
  if (m.equipoId) {
    qc.invalidateQueries({ queryKey: ['equipos'] });
    qc.invalidateQueries({ queryKey: ['equipos', m.equipoId] });
    qc.invalidateQueries({ queryKey: ['equipos', m.equipoId, 'mantenimientos'] });
  }
  if (m.herramientaUnidadId) {
    qc.invalidateQueries({ queryKey: ['herramientas'] });
    qc.invalidateQueries({ queryKey: ['herramientas', 'unidades', m.herramientaUnidadId] });
    qc.invalidateQueries({ queryKey: ['herramientas', 'unidades', m.herramientaUnidadId, 'mantenimientos'] });
  }
}

export function useMantenimientos(params: FiltrosMantenimientos = {}) {
  return useQuery({
    queryKey: ['mantenimientos', params],
    queryFn: () =>
      api.get<PaginatedResponse<Mantenimiento>>('/mantenimientos', { params }).then((r) => r.data),
  });
}

export function useMantenimiento(id: string) {
  return useQuery({
    queryKey: ['mantenimientos', id],
    queryFn: () =>
      api.get<ApiResponse<Mantenimiento>>(`/mantenimientos/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

export function useCrearMantenimiento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CrearMantenimientoDto) =>
      api.post<ApiResponse<Mantenimiento>>('/mantenimientos', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ['mantenimientos'] });
      invalidateEntidadRelacionada(qc, m);
      toast.success('Mantenimiento creado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear el mantenimiento.'));
    },
  });
}

export function useActualizarMantenimiento(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ActualizarMantenimientoDto) =>
      api.put<ApiResponse<Mantenimiento>>(`/mantenimientos/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ['mantenimientos'] });
      qc.invalidateQueries({ queryKey: ['mantenimientos', id] });
      invalidateEntidadRelacionada(qc, m);
      toast.success('Cambios guardados.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudieron guardar los cambios.'));
    },
  });
}

export function useEliminarMantenimiento() {
  const qc = useQueryClient();
  return useMutation({
    // Pasamos el mantenimiento completo (no solo el id) para invalidar
    // las queries del equipo/unidad relacionada despues del DELETE.
    mutationFn: (m: Mantenimiento) =>
      api.delete<ApiResponse<null>>(`/mantenimientos/${m.id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return m;
      }),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ['mantenimientos'] });
      invalidateEntidadRelacionada(qc, m);
      toast.success('Mantenimiento eliminado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo eliminar el mantenimiento.'));
    },
  });
}

export function useRegistrarSalida(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RegistrarSalidaDto) =>
      api.patch<ApiResponse<Mantenimiento>>(`/mantenimientos/${id}/salida`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ['mantenimientos'] });
      qc.invalidateQueries({ queryKey: ['mantenimientos', id] });
      invalidateEntidadRelacionada(qc, m);
      toast.success('Salida registrada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo registrar la salida.'));
    },
  });
}

export function useSubirAdjuntos(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) => {
      const fd = new FormData();
      // El backend espera multiples archivos bajo el mismo nombre de campo.
      files.forEach((f) => fd.append('files', f));
      return api.post<ApiResponse<Mantenimiento>>(`/mantenimientos/${id}/adjuntos`, fd).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mantenimientos', id] });
      toast.success('Adjuntos subidos.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudieron subir los adjuntos.'));
    },
  });
}

export function useEliminarAdjunto(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (adjuntoId: string) =>
      api.delete<ApiResponse<null>>(`/mantenimientos/${id}/adjuntos/${adjuntoId}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return null;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mantenimientos', id] });
      toast.success('Adjunto eliminado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo eliminar el adjunto.'));
    },
  });
}
```

- [ ] **Paso 2: Verificar tsc**

```bash
pnpm tsc --noEmit
```

Esperado: PASS.

- [ ] **Paso 3: Commit**

```bash
git add hooks/use-mantenimientos.ts
git commit -m "feat(mantenimientos): hooks de React Query

Hooks para listar, ver, crear, editar, eliminar, registrar salida,
subir y eliminar adjuntos. Invalidan queries del equipo/unidad
relacionada porque el estado del inventario cambia con cada accion."
```

---

## Tarea 8: Frontend — selector de entidad (Equipo / Unidad)

Componente con tabs binarios y combobox dependiente para elegir equipo o unidad de herramienta.

**Files:**
- Create: `components/mantenimientos/MantenimientoEntidadSelector.tsx`

- [ ] **Paso 1: Crear el componente**

```tsx
'use client';

import { useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { useEquipos } from '@/hooks/use-equipos';
import { useHerramientaTipos, useUnidadesPorTipo } from '@/hooks/use-herramientas';
import type { Equipo, HerramientaUnidad } from '@/types/api';

export type EntidadSeleccionada =
  | { kind: 'equipo'; equipoId: string; label: string }
  | { kind: 'unidad'; herramientaUnidadId: string; label: string }
  | null;

type Props = {
  value: EntidadSeleccionada;
  onChange: (v: EntidadSeleccionada) => void;
  // Cuando llega desde una URL con ?equipoId o ?herramientaUnidadId,
  // ocultamos el toggle y el combobox para evitar reasignaciones.
  locked?: boolean;
  error?: string;
};

export function MantenimientoEntidadSelector({ value, onChange, locked, error }: Props) {
  const [kind, setKind] = useState<'equipo' | 'unidad'>(
    value?.kind === 'unidad' ? 'unidad' : 'equipo',
  );
  const [search, setSearch] = useState('');

  if (locked && value) {
    return (
      <div className="rounded-md border border-bd bg-surface px-3 py-2 text-sm">
        <div className="text-xs text-tx-3">
          {value.kind === 'equipo' ? 'Equipo' : 'Unidad de herramienta'}
        </div>
        <div className="font-medium">{value.label}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="inline-flex rounded-md border border-bd overflow-hidden self-start">
        <button
          type="button"
          onClick={() => { setKind('equipo'); onChange(null); }}
          className={`px-3 py-1.5 text-sm ${kind === 'equipo' ? 'bg-accent text-bg' : 'bg-surface text-tx'}`}
        >
          Equipo
        </button>
        <button
          type="button"
          onClick={() => { setKind('unidad'); onChange(null); }}
          className={`px-3 py-1.5 text-sm ${kind === 'unidad' ? 'bg-accent text-bg' : 'bg-surface text-tx'}`}
        >
          Unidad de herramienta
        </button>
      </div>

      {kind === 'equipo' ? (
        <EquipoPicker search={search} setSearch={setSearch} value={value} onChange={onChange} />
      ) : (
        <UnidadPicker search={search} setSearch={setSearch} value={value} onChange={onChange} />
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function EquipoPicker({
  search, setSearch, value, onChange,
}: {
  search: string; setSearch: (s: string) => void;
  value: EntidadSeleccionada; onChange: (v: EntidadSeleccionada) => void;
}) {
  // Solo equipos DISPONIBLES o USO_INTERNO; los demas estados los rechaza el backend.
  const { data, isLoading } = useEquipos({
    busqueda: search || undefined,
    estado:   'DISPONIBLE',
    limit:    20,
  });

  return (
    <>
      <input
        type="search"
        placeholder="Buscar equipo por código o nombre…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
      />
      <div className="border border-bd rounded-md max-h-56 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : (
          (data?.data ?? []).map((eq: Equipo) => {
            const isActive = value?.kind === 'equipo' && value.equipoId === eq.id;
            return (
              <button
                key={eq.id}
                type="button"
                onClick={() => onChange({
                  kind: 'equipo',
                  equipoId: eq.id,
                  label: `${eq.codigoInterno} — ${eq.nombre}`,
                })}
                className={`w-full text-left px-3 py-2 text-sm border-b border-bd last:border-0 ${
                  isActive ? 'bg-accent/15 text-accent' : 'hover:bg-bg-2'
                }`}
              >
                <span className="font-mono">{eq.codigoInterno}</span> — {eq.nombre}
              </button>
            );
          })
        )}
      </div>
    </>
  );
}

function UnidadPicker({
  search, setSearch, value, onChange,
}: {
  search: string; setSearch: (s: string) => void;
  value: EntidadSeleccionada; onChange: (v: EntidadSeleccionada) => void;
}) {
  const [tipoId, setTipoId] = useState<string | null>(null);
  const tiposQ    = useHerramientaTipos({ busqueda: search || undefined });
  // El backend no tiene endpoint "todas las unidades": se navega tipo -> unidad.
  const unidadesQ = useUnidadesPorTipo(tipoId ?? '', { estado: 'DISPONIBLE' });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div>
        <input
          type="search"
          placeholder="Buscar tipo de herramienta…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
        />
        <div className="mt-2 border border-bd rounded-md max-h-56 overflow-y-auto">
          {tiposQ.isLoading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : (
            (tiposQ.data?.data ?? []).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTipoId(t.id)}
                className={`w-full text-left px-3 py-2 text-sm border-b border-bd last:border-0 ${
                  tipoId === t.id ? 'bg-accent/15 text-accent' : 'hover:bg-bg-2'
                }`}
              >
                {t.nombre}
              </button>
            ))
          )}
        </div>
      </div>
      <div>
        <div className="text-xs text-tx-3 px-1 pb-1">
          {tipoId ? 'Unidades disponibles' : 'Selecciona un tipo primero'}
        </div>
        <div className="border border-bd rounded-md max-h-56 overflow-y-auto">
          {!tipoId ? (
            <div className="text-sm text-tx-3 px-3 py-6 text-center">—</div>
          ) : unidadesQ.isLoading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : (unidadesQ.data ?? []).length === 0 ? (
            <div className="text-sm text-tx-3 px-3 py-6 text-center">Sin unidades disponibles</div>
          ) : (
            (unidadesQ.data ?? []).map((u: HerramientaUnidad) => {
              const isActive = value?.kind === 'unidad' && value.herramientaUnidadId === u.id;
              const tipoNombre = tiposQ.data?.data.find((t) => t.id === tipoId)?.nombre ?? '';
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onChange({
                    kind: 'unidad',
                    herramientaUnidadId: u.id,
                    label: `${u.codigoInterno} — ${tipoNombre}`,
                  })}
                  className={`w-full text-left px-3 py-2 text-sm border-b border-bd last:border-0 ${
                    isActive ? 'bg-accent/15 text-accent' : 'hover:bg-bg-2'
                  }`}
                >
                  <span className="font-mono">{u.codigoInterno}</span> — {tipoNombre}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Paso 2: Verificar tsc**

```bash
pnpm tsc --noEmit
```

Si hay errores sobre `useEquipos({ busqueda })`, revisar `hooks/use-equipos.ts` y `types/api.ts` para confirmar el nombre del filtro (puede ser `search` o `busqueda`). Ajustar para que coincida con `FiltrosEquipos`.

- [ ] **Paso 3: Commit**

```bash
git add components/mantenimientos/MantenimientoEntidadSelector.tsx
git commit -m "feat(mantenimientos): selector equipo/unidad con combobox"
```

---

## Tarea 9: Frontend — `MantenimientoFormFields`

Campos compartidos entre `nuevo` y `editar`.

**Files:**
- Create: `components/mantenimientos/MantenimientoFormFields.tsx`

- [ ] **Paso 1: Crear el componente**

```tsx
'use client';

import { useFieldArray, type Control, type UseFormRegister, type FieldErrors } from 'react-hook-form';
import { Icon } from '@/components/ui/Icon';
import { FormSection } from '@/components/ui/FormSection';
import type { TipoMantenimiento } from '@/types/api';

const TIPOS: { value: TipoMantenimiento; label: string }[] = [
  { value: 'PREVENTIVO', label: 'Preventivo' },
  { value: 'CORRECTIVO', label: 'Correctivo' },
  { value: 'EMERGENCIA', label: 'Emergencia' },
];

// Forma del formulario compartida. mostrarTipo=true en `nuevo`, false en `editar`.
export type MantenimientoFormValues = {
  tipo?:                 TipoMantenimiento;
  tecnico:               string;
  motivo:                string;
  horometro?:            number;
  costoEstimado?:        number;
  repuestos:             { value: string }[];
  proximoMantenimiento?: string;
};

type Props = {
  control:     Control<MantenimientoFormValues>;
  register:    UseFormRegister<MantenimientoFormValues>;
  errors:      FieldErrors<MantenimientoFormValues>;
  mostrarTipo: boolean;
};

export function MantenimientoFormFields({ control, register, errors, mostrarTipo }: Props) {
  const { fields, append, remove } = useFieldArray({ control, name: 'repuestos' });

  return (
    <FormSection title="Datos del mantenimiento">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {mostrarTipo && (
          <div>
            <label className="text-xs text-tx-3">Tipo</label>
            <select
              {...register('tipo')}
              className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
            >
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {errors.tipo && <p className="text-xs text-danger mt-1">{errors.tipo.message}</p>}
          </div>
        )}

        <div>
          <label className="text-xs text-tx-3">Técnico</label>
          <input
            {...register('tecnico')}
            className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
          />
          {errors.tecnico && <p className="text-xs text-danger mt-1">{errors.tecnico.message}</p>}
        </div>

        <div className="lg:col-span-2">
          <label className="text-xs text-tx-3">Motivo</label>
          <textarea
            rows={3}
            {...register('motivo')}
            className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
          />
          {errors.motivo && <p className="text-xs text-danger mt-1">{errors.motivo.message}</p>}
        </div>

        <div>
          <label className="text-xs text-tx-3">Horómetro (opcional)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register('horometro', { valueAsNumber: true })}
            className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="text-xs text-tx-3">Costo estimado (opcional)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register('costoEstimado', { valueAsNumber: true })}
            className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
          />
        </div>

        <div className="lg:col-span-2">
          <label className="text-xs text-tx-3">Próximo mantenimiento (opcional)</label>
          <input
            type="datetime-local"
            {...register('proximoMantenimiento')}
            className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
          />
        </div>

        <div className="lg:col-span-2">
          <label className="text-xs text-tx-3">Repuestos</label>
          <div className="mt-1 flex flex-col gap-2">
            {fields.map((f, idx) => (
              <div key={f.id} className="flex gap-2">
                <input
                  {...register(`repuestos.${idx}.value` as const)}
                  className="flex-1 px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
                  placeholder="Ej. Filtro de aceite"
                />
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="px-2 py-2 text-sm rounded-md border border-bd hover:bg-bg-2"
                  aria-label="Eliminar repuesto"
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => append({ value: '' })}
              className="self-start px-3 py-1.5 text-sm rounded-md border border-bd hover:bg-bg-2"
            >
              Añadir repuesto
            </button>
          </div>
        </div>
      </div>
    </FormSection>
  );
}
```

- [ ] **Paso 2: Verificar tsc**

```bash
pnpm tsc --noEmit
```

Esperado: PASS.

- [ ] **Paso 3: Commit**

```bash
git add components/mantenimientos/MantenimientoFormFields.tsx
git commit -m "feat(mantenimientos): campos compartidos del formulario"
```

---

## Tarea 10: Frontend — `MantenimientoAdjuntosCard`

**Files:**
- Create: `components/mantenimientos/MantenimientoAdjuntosCard.tsx`

- [ ] **Paso 1: Crear el componente**

```tsx
'use client';

import { useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { useSubirAdjuntos, useEliminarAdjunto } from '@/hooks/use-mantenimientos';
import type { MantenimientoAdjunto } from '@/types/api';

const ACCEPT = 'image/*,application/pdf';
const KB = 1024;

function formatBytes(n: number): string {
  // Cifras humanas para el usuario; no necesitamos precision binaria estricta.
  if (n < KB) return `${n} B`;
  if (n < KB * KB) return `${(n / KB).toFixed(1)} KB`;
  return `${(n / (KB * KB)).toFixed(1)} MB`;
}

export function MantenimientoAdjuntosCard({
  mantenimientoId,
  adjuntos,
  readOnly,
}: {
  mantenimientoId: string;
  adjuntos:        MantenimientoAdjunto[];
  readOnly?:       boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const subir   = useSubirAdjuntos(mantenimientoId);
  const borrar  = useEliminarAdjunto(mantenimientoId);

  function abrir(adj: MantenimientoAdjunto) {
    if (adj.archivoUrl) window.open(adj.archivoUrl, '_blank', 'noopener');
  }

  return (
    <div className="rounded-lg border border-bd bg-surface overflow-hidden">
      <div className="px-4 py-3 border-b border-bd flex items-center justify-between">
        <h3 className="font-semibold text-tx">Adjuntos</h3>
        {!readOnly && (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length === 0) return;
                subir.mutate(files);
                // Reseteamos el value para permitir resubir el mismo archivo si hace falta.
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={subir.isPending}
              className="text-sm px-3 py-1.5 rounded-md border border-bd hover:bg-bg-2 disabled:opacity-50"
            >
              {subir.isPending ? 'Subiendo…' : 'Subir archivos'}
            </button>
          </>
        )}
      </div>

      <div className="p-4">
        {adjuntos.length === 0 ? (
          <p className="text-sm text-tx-3">Sin adjuntos.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {adjuntos.map((adj) => (
              <li key={adj.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-bd">
                  <button
                    type="button"
                    onClick={() => abrir(adj)}
                    disabled={!adj.archivoUrl}
                    className="flex items-center gap-2 min-w-0 text-left hover:text-accent disabled:opacity-50"
                  >
                    <Icon name="copy" size={16} />
                    <span className="truncate text-sm">{adj.nombreArchivo}</span>
                    <span className="text-xs text-tx-3 shrink-0">{formatBytes(adj.tamaño)}</span>
                  </button>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => setConfirmId(adj.id)}
                      className="text-sm px-2 py-1 rounded-md hover:bg-bg-2"
                      aria-label="Eliminar adjunto"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  )}
                </div>
                {confirmId === adj.id && (
                  <ConfirmRow
                    message="¿Eliminar este adjunto?"
                    onCancel={() => setConfirmId(null)}
                    onConfirm={async () => {
                      await borrar.mutateAsync(adj.id);
                      setConfirmId(null);
                    }}
                    confirmLabel="Eliminar"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        {(subir.isPending || borrar.isPending) && (
          <div className="flex justify-center pt-3"><Spinner /></div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Paso 2: Verificar tsc**

```bash
pnpm tsc --noEmit
```

Esperado: PASS. Si `<ConfirmRow>` espera props distintos, ajustar la llamada al contrato real.

- [ ] **Paso 3: Commit**

```bash
git add components/mantenimientos/MantenimientoAdjuntosCard.tsx
git commit -m "feat(mantenimientos): card de adjuntos con subida y eliminacion"
```

---

## Tarea 11: Frontend — página de lista `/mantenimientos`

**Files:**
- Create: `app/(dashboard)/mantenimientos/page.tsx`

- [ ] **Paso 1: Crear la página**

```tsx
'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { Pagination } from '@/components/ui/Pagination';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { MantenimientoEstadoBadge } from '@/components/mantenimientos/MantenimientoEstadoBadge';
import { useMantenimientos } from '@/hooks/use-mantenimientos';
import { useAuth } from '@/stores/auth.store';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { EstadoMantenimiento, TipoMantenimiento } from '@/types/api';

const TIPOS:   TipoMantenimiento[]   = ['PREVENTIVO', 'CORRECTIVO', 'EMERGENCIA'];
const ESTADOS: EstadoMantenimiento[] = ['ACTIVO', 'COMPLETADO'];

export default function MantenimientosPage() {
  const router = useRouter();
  const sp     = useSearchParams();
  const { user } = useAuth();

  // Filtros desde URL para que recargar la pagina o llegar desde un link
  // preserve el contexto (equipo/unidad concretos).
  const equipoIdParam            = sp.get('equipoId') ?? undefined;
  const herramientaUnidadIdParam = sp.get('herramientaUnidadId') ?? undefined;

  const [page, setPage]     = useState(1);
  const [estado, setEstado] = useState<EstadoMantenimiento | undefined>();
  const [tipo, setTipo]     = useState<TipoMantenimiento | undefined>();

  useEffect(() => { setPage(1); }, [estado, tipo, equipoIdParam, herramientaUnidadIdParam]);

  const { data, isLoading } = useMantenimientos({
    page,
    limit: 20,
    estado,
    tipo,
    equipoId:            equipoIdParam,
    herramientaUnidadId: herramientaUnidadIdParam,
  });

  const canCreate = user && user.rol !== 'VISUALIZADOR';

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Mantenimientos"
        subtitle="Equipos y herramientas en taller"
        actions={canCreate ? (
          <Link
            href="/mantenimientos/nuevo"
            className="px-3 py-2 text-sm rounded-md bg-accent text-bg hover:opacity-90"
          >
            Nuevo mantenimiento
          </Link>
        ) : null}
      />

      <FilterBar
        chips={[
          ...ESTADOS.map((e) => ({
            label:  e,
            active: estado === e,
            onClick: () => setEstado(estado === e ? undefined : e),
          })),
          ...TIPOS.map((t) => ({
            label:  t,
            active: tipo === t,
            onClick: () => setTipo(tipo === t ? undefined : t),
          })),
        ]}
        onClear={() => { setEstado(undefined); setTipo(undefined); }}
      />

      {(equipoIdParam || herramientaUnidadIdParam) && (
        <div className="flex items-center gap-2 text-sm">
          <Badge kind="info">
            Filtro: {equipoIdParam ? `Equipo ${equipoIdParam}` : `Unidad ${herramientaUnidadIdParam}`}
          </Badge>
          <button
            type="button"
            onClick={() => router.push('/mantenimientos')}
            className="text-xs text-tx-3 hover:text-tx"
          >
            Quitar
          </button>
        </div>
      )}

      <div className="rounded-lg border border-bd bg-surface overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : !data || data.data.length === 0 ? (
          <EmptyState title="Sin mantenimientos" description="No hay registros que coincidan con los filtros." />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-tx-3 border-b border-bd">
              <tr>
                <th className="text-left font-medium px-4 py-2">Tipo</th>
                <th className="text-left font-medium px-4 py-2">Estado</th>
                <th className="text-left font-medium px-4 py-2">Entidad</th>
                <th className="text-left font-medium px-4 py-2">Técnico</th>
                <th className="text-left font-medium px-4 py-2">Entrada</th>
                <th className="text-right font-medium px-4 py-2">Costo</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((m) => {
                const entidadLabel = m.equipo
                  ? `${m.equipo.codigoInterno} — ${m.equipo.nombre}`
                  : m.herramientaUnidad
                  ? `${m.herramientaUnidad.codigoInterno} — ${m.herramientaUnidad.herramientaTipo.nombre}`
                  : '—';
                const costo = m.costoReal ?? m.costoEstimado;
                return (
                  <tr
                    key={m.id}
                    onClick={() => router.push(`/mantenimientos/${m.id}`)}
                    className="border-b border-bd last:border-0 cursor-pointer hover:bg-bg-2"
                  >
                    <td className="px-4 py-2">{m.tipo}</td>
                    <td className="px-4 py-2"><MantenimientoEstadoBadge estado={m.estado} /></td>
                    <td className="px-4 py-2 font-mono text-xs">{entidadLabel}</td>
                    <td className="px-4 py-2">{m.tecnico}</td>
                    <td className="px-4 py-2 font-mono text-xs">{formatDate(m.fechaEntrada)}</td>
                    <td className="px-4 py-2 text-right">
                      {costo ? formatCurrency(costo) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {data && data.meta.total > data.meta.limit && (
        <Pagination
          page={page}
          totalPages={Math.ceil(data.meta.total / data.meta.limit)}
          onChange={setPage}
        />
      )}
    </div>
  );
}
```

- [ ] **Paso 2: Verificar tsc**

```bash
pnpm tsc --noEmit
```

Si `<FilterBar>` o `<Pagination>` esperan props con nombres distintos, ajustar a la API real leyendo `components/ui/FilterBar.tsx` y `components/ui/Pagination.tsx`.

- [ ] **Paso 3: Arrancar el dev server y validar visualmente**

```bash
pnpm dev
```

Abrir `http://localhost:3001/mantenimientos`. Verificar:
- Carga el listado real.
- Los chips de filtro funcionan.
- Click en una fila va al detalle (404 esperado por ahora — la página se crea en Tarea 13).
- Visualizador no ve "Nuevo mantenimiento".

- [ ] **Paso 4: Commit**

```bash
git add app/\(dashboard\)/mantenimientos/page.tsx
git commit -m "feat(mantenimientos): pagina de lista con filtros"
```

---

## Tarea 12: Frontend — página `nuevo`

**Files:**
- Create: `app/(dashboard)/mantenimientos/nuevo/page.tsx`

- [ ] **Paso 1: Crear la página**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  MantenimientoFormFields,
  type MantenimientoFormValues,
} from '@/components/mantenimientos/MantenimientoFormFields';
import {
  MantenimientoEntidadSelector,
  type EntidadSeleccionada,
} from '@/components/mantenimientos/MantenimientoEntidadSelector';
import { useCrearMantenimiento } from '@/hooks/use-mantenimientos';

const schema = z.object({
  tipo:                 z.enum(['PREVENTIVO', 'CORRECTIVO', 'EMERGENCIA']),
  tecnico:              z.string().min(1, 'El técnico es requerido'),
  motivo:               z.string().min(1, 'El motivo es requerido'),
  horometro:            z.number().nonnegative().optional(),
  costoEstimado:        z.number().nonnegative().optional(),
  repuestos:            z.array(z.object({ value: z.string().min(1) })),
  proximoMantenimiento: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NuevoMantenimientoPage() {
  const router = useRouter();
  const sp     = useSearchParams();
  const equipoIdParam       = sp.get('equipoId');
  const herramientaIdParam  = sp.get('herramientaUnidadId');
  const lockedDesdeQuery    = Boolean(equipoIdParam || herramientaIdParam);

  const [entidad, setEntidad] = useState<EntidadSeleccionada>(null);
  const [entidadError, setEntidadError] = useState<string | undefined>();
  const crear = useCrearMantenimiento();

  // Si llegamos con prefill por URL, fijamos entidad sin permitir cambio.
  // El label "Equipo desde URL" se reemplaza si el usuario sale y vuelve;
  // aceptable porque es un atajo, no el flujo canonico.
  useEffect(() => {
    if (equipoIdParam) {
      setEntidad({ kind: 'equipo', equipoId: equipoIdParam, label: `Equipo (${equipoIdParam})` });
    } else if (herramientaIdParam) {
      setEntidad({
        kind: 'unidad',
        herramientaUnidadId: herramientaIdParam,
        label: `Unidad (${herramientaIdParam})`,
      });
    }
  }, [equipoIdParam, herramientaIdParam]);

  const { control, register, handleSubmit, formState: { errors }, setError } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo:      'PREVENTIVO',
      tecnico:   '',
      motivo:    '',
      repuestos: [],
    },
  });

  async function onSubmit(values: FormValues) {
    if (!entidad) {
      setEntidadError('Selecciona un equipo o unidad');
      return;
    }
    setEntidadError(undefined);
    try {
      const m = await crear.mutateAsync({
        tipo:    values.tipo,
        tecnico: values.tecnico,
        motivo:  values.motivo,
        horometro:            values.horometro,
        costoEstimado:        values.costoEstimado,
        repuestos:            values.repuestos.map((r) => r.value),
        proximoMantenimiento: values.proximoMantenimiento || undefined,
        equipoId:             entidad.kind === 'equipo' ? entidad.equipoId : undefined,
        herramientaUnidadId:  entidad.kind === 'unidad' ? entidad.herramientaUnidadId : undefined,
      });
      router.push(`/mantenimientos/${m.id}`);
    } catch (err) {
      const anyErr = err as { response?: { data?: { error?: { code?: string; message?: string } } } };
      const code = anyErr?.response?.data?.error?.code;
      const msg  = anyErr?.response?.data?.error?.message;
      if (code === 'ESTADO_INVALIDO' && msg) {
        // Errores de estado del equipo/unidad inline en el selector.
        setEntidadError(msg);
      } else if (code === 'VALIDATION_ERROR' && msg) {
        setError('motivo', { message: msg });
      }
    }
  }

  const submitting = crear.isPending;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Nuevo mantenimiento" back backLabel="Regresar" onBack={() => router.back()} />
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <div className="rounded-lg border border-bd bg-surface p-4">
          <h2 className="text-sm font-semibold mb-3">Equipo o unidad</h2>
          <MantenimientoEntidadSelector
            value={entidad}
            onChange={setEntidad}
            locked={lockedDesdeQuery}
            error={entidadError}
          />
        </div>

        <MantenimientoFormFields
          control={control as unknown as never}
          register={register as unknown as never}
          errors={errors as unknown as never}
          mostrarTipo
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm rounded-md border border-bd hover:bg-bg-2"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-md bg-accent text-bg hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Creando…' : 'Crear mantenimiento'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Paso 2: Verificar tsc**

```bash
pnpm tsc --noEmit
```

Esperado: PASS.

- [ ] **Paso 3: Validar visualmente en `pnpm dev`**

Abrir `/mantenimientos/nuevo`. Verificar:
- Toggle Equipo/Unidad y combobox funcionan.
- Llegar con `/mantenimientos/nuevo?equipoId=...` desde el detalle de un equipo bloquea el selector.
- Submit crea, navega al detalle (404 esperado hasta Tarea 13).

- [ ] **Paso 4: Commit**

```bash
git add app/\(dashboard\)/mantenimientos/nuevo/page.tsx
git commit -m "feat(mantenimientos): pagina crear mantenimiento"
```

---

## Tarea 13: Frontend — página detalle `[id]`

**Files:**
- Create: `app/(dashboard)/mantenimientos/[id]/page.tsx`

- [ ] **Paso 1: Crear la página**

```tsx
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { MantenimientoEstadoBadge } from '@/components/mantenimientos/MantenimientoEstadoBadge';
import { MantenimientoAdjuntosCard } from '@/components/mantenimientos/MantenimientoAdjuntosCard';
import { useMantenimiento, useEliminarMantenimiento } from '@/hooks/use-mantenimientos';
import { useAuth } from '@/stores/auth.store';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils';

export default function DetalleMantenimientoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const id = params.id;

  const { data: m, isLoading } = useMantenimiento(id);
  const eliminar = useEliminarMantenimiento();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading || !m) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  const rol            = user?.rol;
  const puedeEscribir  = rol && rol !== 'VISUALIZADOR';
  const puedeEliminar  = rol === 'ADMIN' || rol === 'GERENTE' || rol === 'LOGISTICA';
  const esActivo       = m.estado === 'ACTIVO';

  const entidadHref = m.equipoId
    ? `/equipos/${m.equipoId}`
    : m.herramientaUnidadId
    ? `/herramientas/unidades/${m.herramientaUnidadId}`
    : null;
  const entidadLabel = m.equipo
    ? `${m.equipo.codigoInterno} — ${m.equipo.nombre}`
    : m.herramientaUnidad
    ? `${m.herramientaUnidad.codigoInterno} — ${m.herramientaUnidad.herramientaTipo.nombre}`
    : '—';

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Mantenimiento ${m.tipo.toLowerCase()}`}
        subtitle={<MantenimientoEstadoBadge estado={m.estado} />}
        back backLabel="Regresar" onBack={() => router.push('/mantenimientos')}
        actions={esActivo && puedeEscribir ? (
          <div className="flex gap-2">
            <Link
              href={`/mantenimientos/${m.id}/editar`}
              className="px-3 py-2 text-sm rounded-md border border-bd hover:bg-bg-2"
            >
              Editar
            </Link>
            <Link
              href={`/mantenimientos/${m.id}/salida`}
              className="px-3 py-2 text-sm rounded-md bg-accent text-bg hover:opacity-90"
            >
              Registrar salida
            </Link>
            {puedeEliminar && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="px-3 py-2 text-sm rounded-md border border-danger text-danger hover:bg-danger/10"
              >
                Eliminar
              </button>
            )}
          </div>
        ) : null}
      />

      {confirmDelete && (
        <ConfirmRow
          message="Eliminar este mantenimiento revertirá el equipo o unidad a DISPONIBLE."
          confirmLabel="Eliminar"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await eliminar.mutateAsync(m);
            router.push('/mantenimientos');
          }}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-bd bg-surface p-4 flex flex-col gap-3">
          <h3 className="font-semibold">Datos</h3>
          <Dato label="Técnico" value={m.tecnico} />
          <Dato label="Motivo"  value={m.motivo} />
          <Dato label="Horómetro" value={m.horometro ?? '—'} />
          <Dato label="Fecha de entrada" value={formatDateTime(m.fechaEntrada)} />
          <Dato label="Próximo mantenimiento" value={m.proximoMantenimiento ? formatDate(m.proximoMantenimiento) : '—'} />
          {m.fechaSalida && <Dato label="Fecha de salida" value={formatDateTime(m.fechaSalida)} />}
        </div>

        <div className="rounded-lg border border-bd bg-surface p-4 flex flex-col gap-3">
          <h3 className="font-semibold">Costos</h3>
          <Dato label="Estimado" value={m.costoEstimado ? formatCurrency(m.costoEstimado) : '—'} />
          <Dato label="Real"     value={m.costoReal     ? formatCurrency(m.costoReal)     : '—'} />
          <h3 className="font-semibold mt-3">Entidad</h3>
          {entidadHref ? (
            <Link href={entidadHref} className="text-sm text-accent hover:underline">{entidadLabel}</Link>
          ) : (
            <span className="text-sm">{entidadLabel}</span>
          )}
        </div>

        <div className="rounded-lg border border-bd bg-surface p-4 lg:col-span-2">
          <h3 className="font-semibold mb-2">Repuestos</h3>
          {m.repuestos.length === 0 ? (
            <p className="text-sm text-tx-3">Sin repuestos registrados.</p>
          ) : (
            <ul className="list-disc pl-5 text-sm flex flex-col gap-1">
              {m.repuestos.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}
        </div>

        {m.observacionesSalida && (
          <div className="rounded-lg border border-bd bg-surface p-4 lg:col-span-2">
            <h3 className="font-semibold mb-2">Observaciones de salida</h3>
            <p className="text-sm whitespace-pre-wrap">{m.observacionesSalida}</p>
          </div>
        )}

        <div className="lg:col-span-2">
          <MantenimientoAdjuntosCard
            mantenimientoId={m.id}
            adjuntos={m.adjuntos}
            readOnly={!puedeEscribir || !esActivo}
          />
        </div>
      </div>
    </div>
  );
}

function Dato({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm border-b border-bd pb-2 last:border-0 last:pb-0">
      <span className="text-tx-3">{label}</span>
      <span className="text-tx font-medium text-right">{value}</span>
    </div>
  );
}
```

- [ ] **Paso 2: Verificar tsc**

```bash
pnpm tsc --noEmit
```

Esperado: PASS.

- [ ] **Paso 3: Validar visualmente**

Abrir `/mantenimientos/<id>` con un id real (crear primero desde `/mantenimientos/nuevo`). Verificar:
- Carga los datos.
- Botones según rol/estado.
- Eliminar abre ConfirmRow; confirmar borra y redirige a lista.
- Adjuntos: subir, abrir, eliminar.

- [ ] **Paso 4: Commit**

```bash
git add app/\(dashboard\)/mantenimientos/\[id\]/page.tsx
git commit -m "feat(mantenimientos): pagina detalle con eliminar y adjuntos"
```

---

## Tarea 14: Frontend — página `editar`

**Files:**
- Create: `app/(dashboard)/mantenimientos/[id]/editar/page.tsx`

- [ ] **Paso 1: Crear la página**

```tsx
'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import {
  MantenimientoFormFields,
  type MantenimientoFormValues,
} from '@/components/mantenimientos/MantenimientoFormFields';
import { useMantenimiento, useActualizarMantenimiento } from '@/hooks/use-mantenimientos';

const schema = z.object({
  tecnico:              z.string().min(1, 'El técnico es requerido'),
  motivo:               z.string().min(1, 'El motivo es requerido'),
  horometro:            z.number().nonnegative().optional(),
  costoEstimado:        z.number().nonnegative().optional(),
  repuestos:            z.array(z.object({ value: z.string().min(1) })),
  proximoMantenimiento: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function EditarMantenimientoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const { data: m, isLoading } = useMantenimiento(id);
  const actualizar = useActualizarMantenimiento(id);

  const { control, register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tecnico:   '',
      motivo:    '',
      repuestos: [],
    },
  });

  // Bloqueo de edicion sobre mantenimientos completados: el backend tambien lo
  // rechazaria, pero mostrarlo aqui evita un viaje innecesario al server.
  useEffect(() => {
    if (m && m.estado === 'COMPLETADO') {
      toast.error('No se puede editar un mantenimiento completado');
      router.replace(`/mantenimientos/${id}`);
    }
  }, [m, id, router]);

  useEffect(() => {
    if (!m) return;
    reset({
      tecnico:       m.tecnico,
      motivo:        m.motivo,
      horometro:     m.horometro     ? Number(m.horometro)     : undefined,
      costoEstimado: m.costoEstimado ? Number(m.costoEstimado) : undefined,
      repuestos:     m.repuestos.map((value) => ({ value })),
      proximoMantenimiento: m.proximoMantenimiento
        // datetime-local espera "YYYY-MM-DDTHH:mm" sin segundos ni TZ.
        ? m.proximoMantenimiento.slice(0, 16)
        : '',
    });
  }, [m, reset]);

  if (isLoading || !m) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  async function onSubmit(values: FormValues) {
    await actualizar.mutateAsync({
      tecnico:       values.tecnico,
      motivo:        values.motivo,
      horometro:     values.horometro,
      costoEstimado: values.costoEstimado,
      repuestos:     values.repuestos.map((r) => r.value),
      // null explicito para limpiar la fecha; undefined la deja como estaba.
      proximoMantenimiento: values.proximoMantenimiento ? values.proximoMantenimiento : null,
    });
    router.push(`/mantenimientos/${id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Editar mantenimiento"
        back backLabel="Regresar"
        onBack={() => router.push(`/mantenimientos/${id}`)}
      />
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <MantenimientoFormFields
          control={control as unknown as never}
          register={register as unknown as never}
          errors={errors as unknown as never}
          mostrarTipo={false}
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => router.push(`/mantenimientos/${id}`)}
            className="px-4 py-2 text-sm rounded-md border border-bd hover:bg-bg-2"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={actualizar.isPending}
            className="px-4 py-2 text-sm rounded-md bg-accent text-bg hover:opacity-90 disabled:opacity-50"
          >
            {actualizar.isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Paso 2: Verificar tsc**

```bash
pnpm tsc --noEmit
```

Esperado: PASS.

- [ ] **Paso 3: Validar visualmente**

Editar un mantenimiento ACTIVO. Verificar:
- Campos prefilled.
- Guardar muestra toast y redirige al detalle.
- Si está COMPLETADO, redirige al detalle con toast.

- [ ] **Paso 4: Commit**

```bash
git add app/\(dashboard\)/mantenimientos/\[id\]/editar/page.tsx
git commit -m "feat(mantenimientos): pagina editar mantenimiento activo"
```

---

## Tarea 15: Frontend — página `salida`

**Files:**
- Create: `app/(dashboard)/mantenimientos/[id]/salida/page.tsx`

- [ ] **Paso 1: Crear la página**

```tsx
'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { FormSection } from '@/components/ui/FormSection';
import { MantenimientoAdjuntosCard } from '@/components/mantenimientos/MantenimientoAdjuntosCard';
import { useMantenimiento, useRegistrarSalida } from '@/hooks/use-mantenimientos';

const schema = z.object({
  costoReal:           z.number().nonnegative().optional(),
  observacionesSalida: z.string().optional(),
  repuestos:           z.array(z.object({ value: z.string().min(1) })),
});

type FormValues = z.infer<typeof schema>;

export default function SalidaMantenimientoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const { data: m, isLoading } = useMantenimiento(id);
  const salida = useRegistrarSalida(id);

  const { control, register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { repuestos: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'repuestos' });

  useEffect(() => {
    if (m && m.estado === 'COMPLETADO') {
      toast.error('Este mantenimiento ya fue completado');
      router.replace(`/mantenimientos/${id}`);
    }
  }, [m, id, router]);

  useEffect(() => {
    if (!m) return;
    reset({
      costoReal: m.costoReal ? Number(m.costoReal) : undefined,
      repuestos: m.repuestos.map((value) => ({ value })),
    });
  }, [m, reset]);

  if (isLoading || !m) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  async function onSubmit(values: FormValues) {
    await salida.mutateAsync({
      costoReal:           values.costoReal,
      observacionesSalida: values.observacionesSalida || undefined,
      repuestos:           values.repuestos.map((r) => r.value),
    });
    router.push(`/mantenimientos/${id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Registrar salida"
        subtitle="Cierra el mantenimiento y libera el equipo o unidad"
        back backLabel="Regresar"
        onBack={() => router.push(`/mantenimientos/${id}`)}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <FormSection title="Cierre">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-tx-3">Costo real (opcional)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register('costoReal', { valueAsNumber: true })}
                className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="text-xs text-tx-3">Observaciones (opcional)</label>
              <textarea
                rows={3}
                {...register('observacionesSalida')}
                className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="text-xs text-tx-3">Repuestos finales</label>
              <div className="mt-1 flex flex-col gap-2">
                {fields.map((f, idx) => (
                  <div key={f.id} className="flex gap-2">
                    <input
                      {...register(`repuestos.${idx}.value` as const)}
                      className="flex-1 px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="px-2 py-2 text-sm rounded-md border border-bd hover:bg-bg-2"
                      aria-label="Eliminar repuesto"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => append({ value: '' })}
                  className="self-start px-3 py-1.5 text-sm rounded-md border border-bd hover:bg-bg-2"
                >
                  Añadir repuesto
                </button>
              </div>
              {errors.repuestos && <p className="text-xs text-danger mt-1">Repuestos inválidos</p>}
            </div>
          </div>
        </FormSection>

        <MantenimientoAdjuntosCard
          mantenimientoId={m.id}
          adjuntos={m.adjuntos}
          readOnly={false}
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => router.push(`/mantenimientos/${id}`)}
            className="px-4 py-2 text-sm rounded-md border border-bd hover:bg-bg-2"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salida.isPending}
            className="px-4 py-2 text-sm rounded-md bg-accent text-bg hover:opacity-90 disabled:opacity-50"
          >
            {salida.isPending ? 'Registrando…' : 'Registrar salida'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Paso 2: Verificar tsc**

```bash
pnpm tsc --noEmit
```

Esperado: PASS.

- [ ] **Paso 3: Validar visualmente**

Verificar:
- Subida de adjuntos antes de registrar salida funciona.
- Registrar salida marca el mantenimiento como COMPLETADO, el equipo/unidad como DISPONIBLE, y redirige al detalle.
- Si ya está COMPLETADO, redirige con toast.

- [ ] **Paso 4: Commit**

```bash
git add app/\(dashboard\)/mantenimientos/\[id\]/salida/page.tsx
git commit -m "feat(mantenimientos): pagina registrar salida"
```

---

## Tarea 16: QA final, lint y commit de cierre

**Files:**
- (lectura: todos los modificados)

- [ ] **Paso 1: Ejecutar tsc**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm tsc --noEmit
```

Esperado: PASS.

- [ ] **Paso 2: Ejecutar lint**

```bash
pnpm lint
```

Si reporta errores, corregirlos sin introducir nuevos `// eslint-disable`.

- [ ] **Paso 3: Ejecutar la suite del backend**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm test
```

Esperado: PASS. Si algún test que tocaba `SELECT_MANTENIMIENTO` falla (e.g., snapshot), actualizarlo conscientemente.

- [ ] **Paso 4: Recorrido manual con `pnpm dev`**

En `frontend`:

```bash
pnpm dev
```

Validar los puntos del checklist del spec:
- Lista carga con datos reales y filtros funcionan.
- Crear mantenimiento desde `/mantenimientos/nuevo` (equipo y unidad).
- Crear desde detalle de equipo (`/equipos/[id]?...`) usando "Nuevo mantenimiento" si hay link, o desde URL prefilled.
- Detalle muestra equipo/unidad relacionada con link al detalle correspondiente.
- Editar mantenimiento activo: campos prefilled, guarda y redirige.
- Registrar salida: equipo/unidad vuelve a DISPONIBLE.
- Eliminar mantenimiento activo: equipo/unidad vuelve a DISPONIBLE; redirige a lista.
- Subir/eliminar/abrir adjuntos funciona.
- Tarjeta "Mantenimientos recientes" en detalle de equipo y unidad muestra datos correctos y enlaza al detalle del mantenimiento.
- VISUALIZADOR no ve botones de mutación.
- OPERADOR ve "Editar" y "Registrar salida" pero NO "Eliminar".
- Dark mode no rompe la UI.
- Tablet 768px usable.

- [ ] **Paso 5: Commit de cierre si hubo ajustes**

Solo si hubo cambios en QA:

```bash
git add -A
git commit -m "fix(mantenimientos): ajustes finales tras QA"
```

- [ ] **Paso 6: Resumen del estado de las ramas**

```bash
git -C /Users/joaquinmorales13a06/Desktop/Reinar/frontend log --oneline -10
git -C /Users/joaquinmorales13a06/Desktop/Reinar/server   log --oneline -10
```

Confirmar que ambas ramas `feat/mantenimientos` tienen el trabajo coherente listo para PR.

---

## Self-review

**Cobertura del spec:**

- ✅ Backend PUT/DELETE + SELECT extendido → Tareas 1–3.
- ✅ Tipos `Mantenimiento` y `MantenimientoAdjunto` → Tarea 4.
- ✅ Hooks de React Query → Tarea 7.
- ✅ Selector de entidad + form fields + adjuntos → Tareas 8, 9, 10.
- ✅ Páginas lista/nuevo/detalle/editar/salida → Tareas 11–15.
- ✅ Corrección de componentes obsoletos → Tarea 5.
- ✅ MantenimientoEstadoBadge → Tarea 6.
- ✅ Reglas de roles (DELETE oculto para OPERADOR; nada de mutación para VISUALIZADOR) → Tarea 13.
- ✅ Validación inline vs toast → Tareas 12, 14.
- ✅ Filtros nativos sin búsqueda libre → Tarea 11.
- ✅ Prefill por URL (`?equipoId` / `?herramientaUnidadId`) → Tareas 11, 12.
- ✅ QA manual y lint → Tarea 16.

**Placeholders:** ninguno; todos los pasos incluyen código completo.

**Consistencia de tipos:** `Mantenimiento` definido en Tarea 4 se usa en hooks (Tarea 7), componentes (Tareas 5, 6, 8, 9, 10) y páginas (Tareas 11–15). `EntidadSeleccionada` definido en Tarea 8 se usa en Tarea 12.
