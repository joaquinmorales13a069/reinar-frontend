# Dashboard mejoras — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar las tres mejoras al dashboard descritas en `docs/superpowers/specs/2026-05-24-dashboard-mejoras-design.md` — actividad reciente sin filtro de entidad + 24h, `RevenueWidget` como bar chart de 6 meses con MOM%, y `FleetWidget` por categoría con desglose Rentado/Mantenimiento/Disponible más una fila aparte para Andamios.

**Architecture:** Una sola task de backend para mantener la respuesta de `/dashboard/kpis` en un único estado coherente (no se rompe la API a medio camino). Frontend dividido en tasks pequeñas y autocontenidas: primero tipos (cambio puramente aditivo), luego cada widget atómicamente con su call site en `dashboard/page.tsx` para que cada commit deje el build verde.

**Tech Stack:** Backend Express + Prisma (Vitest para tests); Frontend Next.js 15 (App Router), React 19, TanStack React Query v5, Recharts, TailwindCSS v4, `decimal.js`.

**Verificación:**
- Backend: `pnpm vitest run tests/modules/dashboard` desde `/Users/joaquinmorales13a06/Desktop/Reinar/server` debe pasar.
- Frontend: `pnpm tsc --noEmit` y `pnpm lint` desde `/Users/joaquinmorales13a06/Desktop/Reinar/frontend` deben pasar. `pnpm build` al final.
- Verificación funcional en navegador como cierre.

---

## Mapa de archivos

| Acción | Ruta                                                                  | Responsabilidad                                                          |
|--------|-----------------------------------------------------------------------|--------------------------------------------------------------------------|
| Modify | `server/src/modules/dashboard/dashboard.service.ts`                   | Agregar `ingresosUltimos6Meses` y `utilizacionPorCategoria`; relajar `actividadReciente` (sin filtro de entidad, con filtro 24h). |
| Modify | `server/tests/modules/dashboard/dashboard.routes.test.ts`             | Extender el fixture `mockKpis` con los dos campos nuevos.                |
| Modify | `frontend/types/dashboard.ts`                                         | Tipos `CategoriaFlota`, `UtilizacionCategoria`, `IngresoMensual` + nuevos campos en `DashboardKpis`. |
| Modify | `frontend/components/dashboard/ActivityFeed.tsx`                      | Mapear acciones `VERBO_ENTIDAD` (snake_case en mayúsculas) a labels legibles; ampliar `ENTITY_LABEL`/`ENTITY_ICON`. |
| Modify | `frontend/components/dashboard/RevenueWidget.tsx`                     | Rehacer como bar chart 6 meses con pill MOM%.                            |
| Modify | `frontend/components/dashboard/FleetWidget.tsx`                       | Rehacer como lista de 7 filas con barra dividida Rentado/Mantenimiento/Disponible. |
| Modify | `frontend/app/(dashboard)/dashboard/page.tsx`                         | Pasar las nuevas props a los dos widgets.                                |

`frontend/hooks/use-dashboard.ts` no se modifica — el query key y el endpoint siguen siendo `/dashboard/kpis`.

---

## Task 1 — Backend: ampliar respuesta de `obtenerKpis`

Cohesivo en un único commit para que `GET /dashboard/kpis` cambie de forma atómica. Incluye actualizar el fixture del test existente.

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/dashboard/dashboard.service.ts`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/server/tests/modules/dashboard/dashboard.routes.test.ts`

- [ ] **Step 1: Reescribir `dashboard.service.ts`**

Reemplazar el contenido entero por:

```ts
import { CategoriaEquipo, Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'

const Decimal = Prisma.Decimal

// UTC-6, sin DST — consistente con reportes.scheduler.ts
const OFFSET_SV_MS = 6 * 60 * 60 * 1000

function rangoMesActualUTC(): { gte: Date; lt: Date } {
  const nowSV = new Date(Date.now() - OFFSET_SV_MS)
  const inicioSV = new Date(Date.UTC(nowSV.getUTCFullYear(), nowSV.getUTCMonth(), 1))
  const finSV = new Date(Date.UTC(nowSV.getUTCFullYear(), nowSV.getUTCMonth() + 1, 1))
  return {
    gte: new Date(inicioSV.getTime() + OFFSET_SV_MS),
    lt: new Date(finSV.getTime() + OFFSET_SV_MS),
  }
}

function rangoSemanaActualUTC(): { gte: Date; lt: Date } {
  const nowSV = new Date(Date.now() - OFFSET_SV_MS)
  const diaSemana = nowSV.getUTCDay() // 0=Dom, 1=Lun ... 6=Sab
  const diasDesdeElLunes = diaSemana === 0 ? 6 : diaSemana - 1
  const inicioSV = new Date(
    Date.UTC(nowSV.getUTCFullYear(), nowSV.getUTCMonth(), nowSV.getUTCDate() - diasDesdeElLunes),
  )
  const finSV = new Date(inicioSV.getTime() + 7 * 24 * 60 * 60 * 1000)
  return {
    gte: new Date(inicioSV.getTime() + OFFSET_SV_MS),
    lt: new Date(finSV.getTime() + OFFSET_SV_MS),
  }
}

// Genera los rangos [desde, hasta) de los últimos 6 meses calendario en TZ El Salvador,
// con el mes corriente (parcial, hasta hoy) en la última posición. La etiqueta `mes`
// usa formato YYYY-MM para que el frontend pueda mapearla a nombre corto sin parseo.
function rangos6MesesUTC(): { desde: Date; hasta: Date; mes: string }[] {
  const nowSV = new Date(Date.now() - OFFSET_SV_MS)
  const rangos: { desde: Date; hasta: Date; mes: string }[] = []
  for (let i = 5; i >= 0; i--) {
    const inicioSV = new Date(Date.UTC(nowSV.getUTCFullYear(), nowSV.getUTCMonth() - i, 1))
    const finSV = new Date(Date.UTC(nowSV.getUTCFullYear(), nowSV.getUTCMonth() - i + 1, 1))
    rangos.push({
      desde: new Date(inicioSV.getTime() + OFFSET_SV_MS),
      hasta: new Date(finSV.getTime() + OFFSET_SV_MS),
      mes: `${inicioSV.getUTCFullYear()}-${String(inicioSV.getUTCMonth() + 1).padStart(2, '0')}`,
    })
  }
  return rangos
}

const CATEGORIAS_EQUIPO: CategoriaEquipo[] = [
  'COMPRESOR_GENERADOR',
  'SANDBLASTING',
  'ANDAMIO_PLATAFORMA',
  'COMPACTADOR_RODILLO',
  'HERRAMIENTA_ESPECIALIZADA',
  'OTRO',
]

type TopCliente = { clienteId: string; nombre: string; total: string }

export async function obtenerKpis() {
  const hace12Meses = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const rangoMes = rangoMesActualUTC()
  const rangoSemana = rangoSemanaActualUTC()
  const rangosMeses = rangos6MesesUTC()

  // Dos Promise.all separados: el primero con los 15 queries existentes (tuple homogéneo);
  // el segundo con las 6 agregaciones mensuales (array homogéneo). Esto evita una variadic
  // tuple con rest spread que confunde la inferencia de TypeScript.
  const [
    rentasActivas,
    [equiposEnMantenimiento, herramientasEnMantenimiento],
    totalClientes,
    cotizacionesPendientes,
    facturasPorCobrarAgg,
    facturasVencidas,
    ingresosMesAgg,
    equiposGrupos,
    equiposPorCategoriaYEstado,
    piezasAgg,
    serviciosEstaSemana,
    topClientesPorIngresos,
    actividadReciente,
    actasPendientesEntrega,
    dtesPendientes,
  ] = await Promise.all([
    prisma.cotizacion.count({
      where: {
        estado: 'APROBADA',
        factura: { estado: { notIn: ['PAGADA', 'ANULADA'] } },
      },
    }),

    Promise.all([
      prisma.equipo.count({ where: { estado: 'MANTENIMIENTO' } }),
      prisma.herramientaUnidad.count({ where: { estado: 'MANTENIMIENTO' } }),
    ]),

    prisma.cliente.count({ where: { estado: 'ACTIVO' } }),

    prisma.cotizacion.count({ where: { estado: { in: ['BORRADOR', 'ENVIADA'] } } }),

    prisma.factura.aggregate({
      where: { estado: { in: ['PENDIENTE', 'PARCIAL'] } },
      _count: { _all: true },
      _sum: { total: true },
    }),

    prisma.factura.count({ where: { estado: 'VENCIDA' } }),

    prisma.pago.aggregate({
      where: { fecha: rangoMes },
      _sum: { monto: true },
    }),

    prisma.equipo.groupBy({
      by: ['estado'],
      _count: { _all: true },
    }),

    // Desglose por categoría+estado para utilizacionPorCategoria
    prisma.equipo.groupBy({
      by: ['categoria', 'estado'],
      _count: { _all: true },
    }),

    // Total de piezas de andamios activas — todo el stock cuenta como disponible
    // porque las piezas no tienen estado por unidad.
    prisma.piezaTipo.aggregate({
      where: { activo: true },
      _sum: { stockActual: true },
    }),

    prisma.cotizacionItem.count({
      where: {
        tipo: 'SERVICIO',
        fechaServicio: rangoSemana,
        cotizacion: { estado: 'APROBADA' },
      },
    }),

    prisma.$queryRaw<TopCliente[]>`
      SELECT
        c.id                                                    AS "clienteId",
        COALESCE(c."razonSocial", CONCAT(c.nombre, ' ', c.apellido)) AS nombre,
        ROUND(SUM(p.monto), 2)::text                           AS total
      FROM "Pago"    p
      JOIN "Factura" f ON p."facturaId" = f.id
      JOIN "Cliente" c ON f."clienteId" = c.id
      WHERE p.fecha >= ${hace12Meses}
      GROUP BY c.id, c."razonSocial", c.nombre, c.apellido
      ORDER BY SUM(p.monto) DESC
      LIMIT 5
    `,

    // Sin filtro de entidad: cualquier acción auditada en las últimas 24 horas.
    // Limita a 10 para no sobrecargar la UI; el subtítulo "Últimas 24 horas" pasa a ser veraz.
    prisma.auditLog.findMany({
      where: { createdAt: { gte: hace24h } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { usuario: { select: { nombre: true, apellido: true } } },
    }),

    prisma.actaEntrega.count({ where: { estado: { in: ['PENDIENTE', 'DESPACHADO'] } } }),

    prisma.factura.count({ where: { estadoDTE: 'PENDIENTE', estado: { not: 'ANULADA' } } }),
  ])

  // 6 sumas de pagos, una por mes — array homogéneo en paralelo.
  const ingresosPorMes = await Promise.all(
    rangosMeses.map((r) =>
      prisma.pago.aggregate({
        where: { fecha: { gte: r.desde, lt: r.hasta } },
        _sum: { monto: true },
      }),
    ),
  )

  // Utilización global por estado (campo legacy — se conserva para no romper consumidores)
  const utilMap: Partial<Record<string, number>> = {}
  for (const g of equiposGrupos) {
    utilMap[g.estado] = g._count._all
  }
  const totalOperativo =
    (utilMap['DISPONIBLE'] ?? 0) +
    (utilMap['RENTADO'] ?? 0) +
    (utilMap['MANTENIMIENTO'] ?? 0) +
    (utilMap['INACTIVO'] ?? 0)

  // Pivote categoria → estado → count para construir utilizacionPorCategoria
  const pivot: Record<string, Record<string, number>> = {}
  for (const g of equiposPorCategoriaYEstado) {
    pivot[g.categoria] ??= {}
    pivot[g.categoria][g.estado] = g._count._all
  }
  const filasEquipos = CATEGORIAS_EQUIPO.map((cat) => {
    const p = pivot[cat] ?? {}
    const disponible = p['DISPONIBLE'] ?? 0
    const rentado = p['RENTADO'] ?? 0
    const mantenimiento = p['MANTENIMIENTO'] ?? 0
    // USO_INTERNO e INACTIVO se contabilizan en `total` pero no se pintan en la barra
    // visual del FleetWidget; el frontend sólo grafica los 3 estados operativos.
    const usoInterno = p['USO_INTERNO'] ?? 0
    const inactivo = p['INACTIVO'] ?? 0
    return {
      categoria: cat as CategoriaEquipo,
      rentado,
      mantenimiento,
      disponible,
      usoInterno,
      inactivo,
      total: disponible + rentado + mantenimiento + usoInterno + inactivo,
    }
  })

  const totalAndamios = piezasAgg._sum.stockActual ?? 0
  const filaAndamios = {
    categoria: 'ANDAMIO_PIEZA' as const,
    // Las piezas de andamio no tienen estado por unidad (sólo stockActual agregado),
    // por eso rentado/mantenimiento son 0 y todo el stock cuenta como disponible.
    rentado: 0,
    mantenimiento: 0,
    disponible: totalAndamios,
    usoInterno: 0,
    inactivo: 0,
    total: totalAndamios,
  }

  const utilizacionPorCategoria = [...filasEquipos, filaAndamios]

  const ingresosUltimos6Meses = rangosMeses.map((r, i) => ({
    mes: r.mes,
    total: (ingresosPorMes[i]._sum.monto ?? new Decimal(0)).toFixed(2),
  }))

  return {
    rentasActivas,
    maquinariaEnMantenimiento: {
      equipos: equiposEnMantenimiento,
      herramientas: herramientasEnMantenimiento,
      total: equiposEnMantenimiento + herramientasEnMantenimiento,
    },
    totalClientes,
    cotizacionesPendientes,
    facturasPorCobrar: {
      count: facturasPorCobrarAgg._count._all,
      total: (facturasPorCobrarAgg._sum.total ?? new Decimal(0)).toFixed(2),
    },
    facturasVencidas,
    ingresosMes: (ingresosMesAgg._sum.monto ?? new Decimal(0)).toFixed(2),
    ingresosUltimos6Meses,
    utilizacionEquipos: {
      disponibles: utilMap['DISPONIBLE'] ?? 0,
      rentados: utilMap['RENTADO'] ?? 0,
      mantenimiento: utilMap['MANTENIMIENTO'] ?? 0,
      inactivos: utilMap['INACTIVO'] ?? 0,
      total: totalOperativo,
    },
    utilizacionPorCategoria,
    serviciosEstaSemana,
    topClientesPorIngresos,
    actividadReciente: actividadReciente.map((log) => ({
      entidad: log.entidad,
      entidadId: log.entidadId,
      accion: log.accion,
      usuario: log.usuario ? `${log.usuario.nombre} ${log.usuario.apellido}` : null,
      createdAt: log.createdAt,
    })),
    actasPendientesEntrega,
    dtesPendientes,
  }
}
```

- [ ] **Step 2: Extender el fixture en el test**

Editar `/Users/joaquinmorales13a06/Desktop/Reinar/server/tests/modules/dashboard/dashboard.routes.test.ts`. Reemplazar el bloque `const mockKpis = { ... }` (líneas 41-63) por:

```ts
const mockKpis = {
  rentasActivas: 5,
  maquinariaEnMantenimiento: { equipos: 2, herramientas: 1, total: 3 },
  totalClientes: 40,
  cotizacionesPendientes: 3,
  facturasPorCobrar: { count: 4, total: '8500.00' },
  facturasVencidas: 1,
  ingresosMes: '12000.00',
  ingresosUltimos6Meses: [
    { mes: '2025-12', total: '9800.00' },
    { mes: '2026-01', total: '11260.00' },
    { mes: '2026-02', total: '10540.00' },
    { mes: '2026-03', total: '12890.00' },
    { mes: '2026-04', total: '13210.00' },
    { mes: '2026-05', total: '12000.00' },
  ],
  utilizacionEquipos: { disponibles: 10, rentados: 5, mantenimiento: 2, inactivos: 0, total: 17 },
  utilizacionPorCategoria: [
    { categoria: 'COMPRESOR_GENERADOR',       rentado: 2, mantenimiento: 1, disponible: 2, usoInterno: 0, inactivo: 0, total: 5 },
    { categoria: 'SANDBLASTING',              rentado: 1, mantenimiento: 0, disponible: 3, usoInterno: 0, inactivo: 0, total: 4 },
    { categoria: 'ANDAMIO_PLATAFORMA',        rentado: 1, mantenimiento: 0, disponible: 1, usoInterno: 0, inactivo: 0, total: 2 },
    { categoria: 'COMPACTADOR_RODILLO',       rentado: 1, mantenimiento: 1, disponible: 2, usoInterno: 0, inactivo: 0, total: 4 },
    { categoria: 'HERRAMIENTA_ESPECIALIZADA', rentado: 0, mantenimiento: 0, disponible: 1, usoInterno: 0, inactivo: 0, total: 1 },
    { categoria: 'OTRO',                      rentado: 0, mantenimiento: 0, disponible: 1, usoInterno: 0, inactivo: 0, total: 1 },
    { categoria: 'ANDAMIO_PIEZA',             rentado: 0, mantenimiento: 0, disponible: 78, usoInterno: 0, inactivo: 0, total: 78 },
  ],
  serviciosEstaSemana: 2,
  topClientesPorIngresos: [{ clienteId: 'c-1', nombre: 'Constructora XYZ', total: '8000.00' }],
  actividadReciente: [
    {
      entidad: 'Cotizacion',
      entidadId: 'cot-1',
      accion: 'ACTUALIZAR_COTIZACION',
      usuario: 'Ana López',
      createdAt: new Date().toISOString(),
    },
  ],
  actasPendientesEntrega: 2,
  dtesPendientes: 1,
}
```

Y agregar dos aserciones a `toMatchObject` (dentro del bloque `expect(res.body.data).toMatchObject({ ... })`, justo después de la línea `ingresosMes: expect.any(String),`):

```ts
      ingresosUltimos6Meses: expect.any(Array),
      utilizacionPorCategoria: expect.any(Array),
```

- [ ] **Step 3: Ejecutar los tests del dashboard**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm vitest run tests/modules/dashboard
```

Expected: PASS, todos los casos del test (`retorna 401 sin token`, `retorna 200 con todos los campos KPI para ADMIN`, los 4 casos `it.each`, y `propaga error del servicio como 500`).

- [ ] **Step 4: Verificar que el build de TypeScript del servidor pasa**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
git add src/modules/dashboard/dashboard.service.ts tests/modules/dashboard/dashboard.routes.test.ts
git commit -m "feat(dashboard): ingresos 6 meses, utilizacion por categoria y actividad sin filtro de entidad"
```

(Sin Co-Authored-By, sin trailers.)

> **Nota importante:** el repositorio del servidor es independiente del frontend (`Reinar/server` vs `Reinar/frontend`). Cada uno se commit/PR por separado.

---

## Task 2 — Frontend: tipos del dashboard

Cambio puramente aditivo. El dashboard sigue funcionando porque ningún consumidor lee aún los nuevos campos.

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/types/dashboard.ts`

- [ ] **Step 1: Reescribir `types/dashboard.ts`**

Reemplazar el contenido entero por:

```ts
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
  rentado: number;
  mantenimiento: number;
  disponible: number;
  usoInterno: number;
  inactivo: number;
  total: number;
};

// Mes en formato YYYY-MM para parseo determinista; total es Decimal serializado.
export type IngresoMensual = {
  mes: string;
  total: string;
};

export type DashboardKpis = {
  rentasActivas: number;
  maquinariaEnMantenimiento: {
    equipos: number;
    herramientas: number;
    total: number;
  };
  // Reservado para widget de clientes activos — aún no tiene sección propia en el dashboard
  totalClientes: number;
  cotizacionesPendientes: number;
  facturasPorCobrar: {
    count: number;
    total: string; // Decimal serializado — usar formatCurrency(), nunca parseFloat()
  };
  facturasVencidas: number;
  ingresosMes: string; // Decimal serializado del mes corriente (legacy)
  ingresosUltimos6Meses: IngresoMensual[]; // 5 meses previos + mes actual a la fecha
  utilizacionEquipos: {
    disponibles: number;
    rentados: number;
    mantenimiento: number;
    inactivos: number;
    total: number;
  };
  utilizacionPorCategoria: UtilizacionCategoria[];
  serviciosEstaSemana: number;
  topClientesPorIngresos: {
    clienteId: string;
    nombre: string;
    total: string; // Decimal serializado
  }[];
  actividadReciente: {
    entidad: string;
    entidadId: string;
    accion: string;
    usuario: string | null;
    createdAt: string; // ISO-8601
  }[];
  actasPendientesEntrega: number;
  // Reservado para badge de DTEs pendientes en el topbar o una futura card de Admin/Gerente
  dtesPendientes: number;
};
```

- [ ] **Step 2: Verificar tipos**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
git add types/dashboard.ts
git commit -m "feat(dashboard): tipos para ingresos 6 meses y utilizacion por categoria"
```

---

## Task 3 — Frontend: ActivityFeed con labels legibles

Independiente del backend (sólo cambia el mapeo a labels). Funciona con el nuevo backend (acciones llegan en formato `VERBO_ENTIDAD` mayúsculas).

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/dashboard/ActivityFeed.tsx`

- [ ] **Step 1: Reescribir `ActivityFeed.tsx`**

Reemplazar el contenido entero por:

```tsx
'use client';
// components/dashboard/ActivityFeed.tsx
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import type { DashboardKpis } from '@/types/dashboard';

type ActivityFeedProps = {
  actividad: DashboardKpis['actividadReciente'];
  onRefresh: () => void;
};

// El backend emite acciones como VERBO_ENTIDAD en mayúsculas
// (ej. CREAR_CLIENTE, CAMBIAR_ESTADO_PIEZA, AJUSTAR_STOCK_CONSUMIBLE).
// Mapeamos solo el verbo; la entidad se resuelve por separado vía ENTITY_LABEL.
const VERBO_LABEL: Record<string, string> = {
  CREAR:          'creó',
  ACTUALIZAR:     'actualizó',
  ELIMINAR:       'eliminó',
  CAMBIAR_ESTADO: 'cambió el estado de',
  AJUSTAR_STOCK:  'ajustó el stock de',
  ACTIVAR:        'activó',
  DESACTIVAR:     'desactivó',
  EMITIR:         'emitió',
  ANULAR:         'anuló',
  DESPACHAR:      'despachó',
  ENTREGAR:       'entregó',
  REGISTRAR:      'registró',
  APROBAR:        'aprobó',
  RECHAZAR:       'rechazó',
};

const ENTITY_LABEL: Record<string, string> = {
  Cotizacion:        'cotización',
  Factura:           'factura',
  Pago:              'pago',
  ActaEntrega:       'acta de entrega',
  Cliente:           'cliente',
  Contacto:          'contacto',
  Equipo:            'equipo',
  Servicio:          'servicio',
  PiezaTipo:         'pieza de andamio',
  CuerpoTipo:        'configuración de andamio',
  HerramientaTipo:   'herramienta',
  HerramientaUnidad: 'unidad de herramienta',
  Consumible:        'consumible',
  Bodega:            'bodega',
  Proyecto:          'proyecto',
  Usuario:           'usuario',
  Configuracion:     'configuración',
};

const ENTITY_ICON: Record<string, IconName> = {
  Cotizacion:        'fileText',
  Factura:           'receipt',
  Pago:              'dollar',
  ActaEntrega:       'clipboard',
  Cliente:           'user',
  Contacto:          'idCard',
  Equipo:            'package',
  Servicio:          'tool',
  PiezaTipo:         'layers',
  CuerpoTipo:        'layers',
  HerramientaTipo:   'hammer',
  HerramientaUnidad: 'hammer',
  Consumible:        'package',
  Bodega:            'warehouse',
  Proyecto:          'building',
  Usuario:           'user',
  Configuracion:     'gear',
};

// Prefijos ordenados por longitud descendente: "CAMBIAR_ESTADO" gana sobre "CAMBIAR".
// Si la acción no matchea ningún prefijo, devolvemos el string original con espacios
// para que al menos sea legible (fallback defensivo).
const VERBO_PREFIJOS = Object.keys(VERBO_LABEL).sort((a, b) => b.length - a.length);

function labelDeAccion(accion: string): string {
  for (const p of VERBO_PREFIJOS) {
    if (accion === p || accion.startsWith(`${p}_`)) return VERBO_LABEL[p];
  }
  return accion.toLowerCase().replace(/_/g, ' ');
}

export function ActivityFeed({ actividad, onRefresh }: ActivityFeedProps) {
  return (
    <div className="rounded-lg bg-surface border border-bd flex flex-col">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-bd">
        <div>
          <h3 className="text-sm font-medium text-tx">Actividad reciente</h3>
          <p className="text-xs text-tx-3 mt-0.5">Últimas 24 horas en el sistema</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="flex items-center gap-1.5 text-xs text-tx-2 hover:text-tx transition-colors px-2 py-1 rounded hover:bg-bg-sunken"
        >
          <Icon name="refresh" size={12} />
          Actualizar
        </button>
      </div>

      <div className="divide-y divide-bd">
        {actividad.length === 0 && (
          <p className="text-sm text-tx-3 text-center py-8">Sin actividad reciente.</p>
        )}
        {actividad.map((item) => {
          const iconName: IconName = ENTITY_ICON[item.entidad] ?? 'info';
          const verbo = labelDeAccion(item.accion);
          const entidadLabel = ENTITY_LABEL[item.entidad] ?? item.entidad.toLowerCase();
          const tiempo = formatDistanceToNow(parseISO(item.createdAt), {
            locale: es,
            addSuffix: true,
          });
          return (
            <div key={`${item.entidad}-${item.entidadId}-${item.createdAt}`} className="flex gap-3 px-5 py-3">
              <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-full bg-bg-sunken flex items-center justify-center text-tx-3">
                <Icon name={iconName} size={13} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-tx leading-snug">
                  <span className="font-medium">{item.usuario ?? 'Sistema'}</span>{' '}
                  {verbo}{' '}
                  <span className="text-tx-2">{entidadLabel}</span>{' '}
                  <span className="font-mono text-xs text-tx-3">{item.entidadId.slice(0, 8)}</span>
                </p>
                <p className="text-xs text-tx-3 mt-0.5">{tiempo}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos y lint**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm tsc --noEmit
pnpm lint components/dashboard/ActivityFeed.tsx
```

Expected: ambos pasan sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/ActivityFeed.tsx
git commit -m "feat(dashboard): labels legibles en ActivityFeed y soporte de entidades nuevas"
```

---

## Task 4 — Frontend: RevenueWidget como bar chart de 6 meses

Cambia la firma del componente. La actualización del call site en `dashboard/page.tsx` va en este mismo commit para que el build quede verde.

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/dashboard/RevenueWidget.tsx`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Reescribir `RevenueWidget.tsx`**

Reemplazar el contenido entero por:

```tsx
'use client';
// components/dashboard/RevenueWidget.tsx

import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, LabelList } from 'recharts';
import Decimal from 'decimal.js';
import type { IngresoMensual } from '@/types/dashboard';

type RevenueWidgetProps = {
  ingresosUltimos6Meses: IngresoMensual[];
};

const MES_ABREV: Record<string, string> = {
  '01': 'ENE', '02': 'FEB', '03': 'MAR', '04': 'ABR', '05': 'MAY', '06': 'JUN',
  '07': 'JUL', '08': 'AGO', '09': 'SEP', '10': 'OCT', '11': 'NOV', '12': 'DIC',
};

function abreviar(mes: string): string {
  // mes viene como 'YYYY-MM'; tomamos el MM para mapear a abreviatura.
  return MES_ABREV[mes.split('-')[1] ?? ''] ?? mes;
}

function formatMiles(n: number): string {
  // Formato corto "$XX.XK" para que las etiquetas quepan sobre cada barra.
  return `$${(n / 1000).toFixed(1)}K`;
}

export function RevenueWidget({ ingresosUltimos6Meses }: RevenueWidgetProps) {
  const data = ingresosUltimos6Meses.map((m) => {
    const valor = new Decimal(m.total).toNumber();
    return { mes: abreviar(m.mes), valor, label: formatMiles(valor) };
  });

  // MOM% calculado en cliente sobre los dos últimos meses del array.
  // Si el mes anterior fue 0, no mostramos pill (división por cero o porcentaje engañoso).
  const ultimo = data[data.length - 1]?.valor ?? 0;
  const anterior = data[data.length - 2]?.valor ?? 0;
  const mom = anterior > 0 ? ((ultimo - anterior) / anterior) * 100 : null;
  const momPositive = mom !== null && mom >= 0;

  return (
    <div className="rounded-lg bg-surface border border-bd p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-tx">Ingresos · últimos 6 meses</h3>
          <p className="text-xs text-tx-3 mt-0.5">Total facturado por mes en miles USD</p>
        </div>
        {mom !== null && (
          <span
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
              momPositive
                ? 'bg-ok-soft border-ok-soft text-ok'
                : 'bg-danger-soft border-danger-soft text-danger'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {momPositive ? '+' : ''}
            {mom.toFixed(1)}% MOM
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 22, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="mes"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#6B7B8E' }}
          />
          <Tooltip
            cursor={{ fill: 'rgba(10,26,42,0.04)' }}
            contentStyle={{
              background: '#FFFFFF',
              border: '1px solid rgba(10,26,42,0.10)',
              borderRadius: 6,
              fontSize: 12,
            }}
            formatter={(v: number) => [
              `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              'Ingresos',
            ]}
          />
          <Bar dataKey="valor" fill="#F2C037" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="label" position="top" style={{ fontSize: 11, fill: '#44546A' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Actualizar el call site en `dashboard/page.tsx`**

Editar `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/app/(dashboard)/dashboard/page.tsx`. Cambiar:

```tsx
              {showIngresos && <RevenueWidget ingresosMes={data.ingresosMes} />}
```

por:

```tsx
              {showIngresos && <RevenueWidget ingresosUltimos6Meses={data.ingresosUltimos6Meses} />}
```

- [ ] **Step 3: Verificar tipos, lint y build**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm tsc --noEmit
pnpm lint components/dashboard/RevenueWidget.tsx "app/(dashboard)/dashboard/page.tsx"
```

Expected: ambos pasan sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/RevenueWidget.tsx "app/(dashboard)/dashboard/page.tsx"
git commit -m "feat(dashboard): RevenueWidget como bar chart de 6 meses con MOM"
```

---

## Task 5 — Frontend: FleetWidget por categoría

Mismo patrón que Task 4: cambia firma del componente; actualiza el call site en el mismo commit.

**Files:**
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/components/dashboard/FleetWidget.tsx`
- Modify: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Reescribir `FleetWidget.tsx`**

Reemplazar el contenido entero por:

```tsx
'use client';
// components/dashboard/FleetWidget.tsx

import type { CategoriaFlota, UtilizacionCategoria } from '@/types/dashboard';

type FleetWidgetProps = {
  utilizacionPorCategoria: UtilizacionCategoria[];
};

const CATEGORIA_LABEL: Record<CategoriaFlota, string> = {
  COMPRESOR_GENERADOR:       'Compresores y generadores',
  SANDBLASTING:              'Sandblasting',
  ANDAMIO_PLATAFORMA:        'Andamios y plataformas',
  COMPACTADOR_RODILLO:       'Compactadores y rodillos',
  HERRAMIENTA_ESPECIALIZADA: 'Herramienta especializada',
  OTRO:                      'Otros equipos',
  ANDAMIO_PIEZA:             'Andamios (piezas)',
};

function pct(n: number, total: number): number {
  return total > 0 ? (n / total) * 100 : 0;
}

export function FleetWidget({ utilizacionPorCategoria }: FleetWidgetProps) {
  const totalEquipos = utilizacionPorCategoria.reduce((acc, f) => acc + f.total, 0);

  return (
    <div className="rounded-lg bg-surface border border-bd p-5 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-medium text-tx">Utilización de flota</h3>
        <p className="text-xs text-tx-3 mt-0.5">
          Por categoría · {totalEquipos} unidades en total
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {utilizacionPorCategoria.map((fila) => (
          <div key={fila.categoria} className="grid grid-cols-[1fr_auto] gap-x-3 items-center">
            <div className="min-w-0">
              <div className="text-sm text-tx truncate">{CATEGORIA_LABEL[fila.categoria]}</div>
              <div className="flex h-2 rounded-full overflow-hidden bg-bd mt-1.5">
                <div className="bg-accent" style={{ width: `${pct(fila.rentado, fila.total)}%` }} />
                <div className="bg-warn"   style={{ width: `${pct(fila.mantenimiento, fila.total)}%` }} />
                <div className="bg-bg-sunken" style={{ width: `${pct(fila.disponible, fila.total)}%` }} />
              </div>
            </div>
            <span className="font-mono text-xs text-tx-2 whitespace-nowrap">
              {fila.total > 0 ? `${fila.rentado}/${fila.total}` : '—'}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 mt-1 border-t border-bd text-xs text-tx-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-accent" />
          Rentado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-warn" />
          Mantenimiento
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-bg-sunken border border-bd" />
          Disponible
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Actualizar el call site en `dashboard/page.tsx`**

Editar `/Users/joaquinmorales13a06/Desktop/Reinar/frontend/app/(dashboard)/dashboard/page.tsx`. Cambiar:

```tsx
              {showFlota    && <FleetWidget utilizacionEquipos={data.utilizacionEquipos} />}
```

por:

```tsx
              {showFlota    && <FleetWidget utilizacionPorCategoria={data.utilizacionPorCategoria} />}
```

- [ ] **Step 3: Verificar tipos, lint y build**

```bash
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm tsc --noEmit
pnpm lint components/dashboard/FleetWidget.tsx "app/(dashboard)/dashboard/page.tsx"
pnpm build
```

Expected: tsc y lint sin errores; el build de Next.js completa sin errores (puede haber warnings pre-existentes en otros archivos, ignorar).

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/FleetWidget.tsx "app/(dashboard)/dashboard/page.tsx"
git commit -m "feat(dashboard): FleetWidget por categoria con desglose y leyenda"
```

---

## Task 6 — Verificación funcional end-to-end

**Files:** ninguno (verificación manual en navegador).

- [ ] **Step 1: Levantar backend y frontend**

En dos terminales:

```bash
# Terminal A
cd /Users/joaquinmorales13a06/Desktop/Reinar/server
pnpm dev
```

```bash
# Terminal B
cd /Users/joaquinmorales13a06/Desktop/Reinar/frontend
pnpm dev
```

- [ ] **Step 2: Probar ActivityFeed**

1. Iniciar sesión como `ADMIN`.
2. Crear un servicio nuevo desde `/servicios/nuevo`. Luego volver al dashboard.
3. Verificar que el evento aparece en la card "Actividad reciente" como `Administrador Reinar creó servicio <id8>` (o similar) — NO como `crear_servicio Servicio cmp...`.
4. Click en "Actualizar" → la lista se refresca (puede no cambiar si no hubo nuevos eventos).
5. Crear una pieza de andamio. Volver al dashboard. Verificar que aparece como `creó pieza de andamio <id8>`.

- [ ] **Step 3: Probar RevenueWidget**

1. Verificar que la card "Ingresos · últimos 6 meses" muestra 6 barras con etiquetas de mes (DIC, ENE, …, MES_ACTUAL).
2. Verificar etiqueta `$XX.XK` arriba de cada barra.
3. Si hay datos de pagos en el mes anterior y el actual, verificar el pill MOM% (verde si positivo, rojo si negativo). Si el mes anterior es $0, el pill no debe aparecer.
4. Hover sobre una barra → tooltip muestra el monto exacto formateado en USD.

- [ ] **Step 4: Probar FleetWidget**

1. Verificar que la card "Utilización de flota" muestra 7 filas (las 6 categorías del enum + "Andamios (piezas)" al final).
2. Verificar que cada fila tiene una barra dividida en tres segmentos: amarillo (Rentado), naranja (Mantenimiento), gris (Disponible), proporcional al `total`.
3. Verificar que el contador `rentado/total` aparece a la derecha en `font-mono`. Filas con `total: 0` muestran `—`.
4. Verificar la leyenda al pie: ● Rentado · ● Mantenimiento · ● Disponible.

- [ ] **Step 5: Dark mode y responsive**

1. Activar dark mode desde TweaksPanel → ambos widgets se ven consistentes (sin colores rotos).
2. Reducir el ancho del navegador a ~768px → los widgets se apilan correctamente (RevenueWidget y FleetWidget en columnas distintas en desktop, una sobre otra en tablet).

- [ ] **Step 6: Roles que no ven ciertas cards**

1. Como `OPERADOR`: verificar que `FleetWidget` no aparece (por `showFlota = rol !== 'OPERADOR'`).
2. Como `LOGISTICA`: verificar que `RevenueWidget` y `TopClientes` no aparecen.

- [ ] **Step 7: Commit (si hubo ajustes menores)**

Si las pruebas detectaron ajustes (espaciados, textos, etc.), commitéalos en un solo paso:

```bash
git add -A
git commit -m "fix(dashboard): ajustes detectados en verificacion funcional"
```

Si no hubo ajustes, saltar este paso.

---

## Checklist final antes de PR

**Backend (PR aparte en `Reinar/server`):**

- [ ] `actividadReciente` ya no filtra por entidad; aplica `createdAt ≥ now − 24h`; `take: 10`.
- [ ] `ingresosUltimos6Meses` es un array de 6 elementos con sumas correctas por mes en TZ El Salvador.
- [ ] `utilizacionPorCategoria` tiene 7 filas (6 del enum + `ANDAMIO_PIEZA`).
- [ ] `utilizacionEquipos` y `ingresosMes` conservan su forma original (no se rompen consumidores).
- [ ] `pnpm vitest run tests/modules/dashboard` pasa.
- [ ] `pnpm tsc --noEmit` pasa.

**Frontend (PR principal en `Reinar/frontend`):**

- [ ] Tipos actualizados en `types/dashboard.ts`.
- [ ] `ActivityFeed` muestra "creó/actualizó/cambió el estado de/…" con la entidad en español.
- [ ] `RevenueWidget` muestra bar chart de 6 meses con pill MOM%.
- [ ] `FleetWidget` muestra 7 filas con barra dividida y leyenda.
- [ ] `dashboard/page.tsx` pasa las nuevas props a los dos widgets.
- [ ] `pnpm tsc --noEmit`, `pnpm lint` (sobre archivos modificados) y `pnpm build` pasan.
- [ ] Dark mode y vista en tablet (768px) sin regresiones.
- [ ] Sin clases vanilla CSS en `globals.css` — todo Tailwind o `@layer utilities`.
- [ ] Comentarios "why" en español en decisiones no obvias.
