# Diseño — `feat/dashboard-mejoras`

**Fecha:** 2026-05-24
**Rama:** `feat/dashboard-mejoras`
**Alcance:** Backend `dashboard.service.ts` + Frontend `types/dashboard.ts`, `ActivityFeed.tsx`, `RevenueWidget.tsx`, `FleetWidget.tsx`.

---

## Resumen

Tres mejoras al dashboard motivadas por hallazgos durante uso real:

1. **Actividad reciente:** hoy filtra solo 5 entidades específicas (`Cotizacion`, `Factura`, `Pago`, `ActaEntrega`, `Cliente`) y no aplica filtro de tiempo, contradiciendo su subtítulo "Últimas 24 horas". Acciones sobre Servicios, Andamios, Equipos, etc. nunca aparecen. Además, el frontend espera `CREATE/UPDATE/DELETE` pero el backend manda `crear_cliente`, `actualizar_cliente`, etc., dejando el texto crudo en la UI.
2. **Ingresos del mes en curso:** widget actual muestra solo el total acumulado del mes corriente. Se rehace como bar chart con los 5 meses previos completos + el mes actual a la fecha (6 barras), más un pill con el % de variación mes-a-mes.
3. **Utilización de flota:** widget actual agrupa por estado a nivel global (Disponibles/Rentados/Mantenimiento/Inactivos). Se rehace por categoría con desglose Rentado / Mantenimiento / Disponible por fila, incluyendo Andamios como fila aparte basada en `PiezaTipo.stockActual`.

---

## Hallazgos del backend

Archivo: `/Users/joaquinmorales13a06/Desktop/Reinar/server/src/modules/dashboard/dashboard.service.ts`.

- `prisma.auditLog.findMany` actualmente: `where: { entidad: { in: [...] } }, take: 10, orderBy: createdAt desc`. Sin filtro de tiempo.
- `prisma.pago.aggregate` ya existe para el mes corriente — se replica el patrón para los 5 meses previos.
- `prisma.equipo.groupBy({ by: ['estado'] })` ya existe — se cambia/agrega `groupBy({ by: ['categoria','estado'] })` para tener desglose por categoría.
- `prisma.piezaTipo.aggregate({ where: { activo: true }, _sum: { stockActual: true } })` da el total de unidades de andamios.
- Las acciones auditadas usan formato `VERBO_ENTIDAD` en MAYÚSCULAS con underscores (ej. `CREAR_CLIENTE`, `CAMBIAR_ESTADO_CLIENTE`). El widget muestra el string crudo cuando no encuentra match en su `ACCION_LABEL`.

---

## Cambios al backend

### 1. Actividad reciente — relajar filtros

`prisma.auditLog.findMany`:

```ts
const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

prisma.auditLog.findMany({
  where: { createdAt: { gte: hace24h } },   // quitamos el filtro de entidad
  orderBy: { createdAt: 'desc' },
  take: 10,
  include: { usuario: { select: { nombre: true, apellido: true } } },
}),
```

**Efectos:**
- Aparecen eventos de cualquier entidad auditada (Servicio, PiezaTipo, CuerpoTipo, Equipo, HerramientaTipo, HerramientaUnidad, Consumible, Cliente, Contacto, Bodega, Proyecto, Cotizacion, Factura, Pago, ActaEntrega, Usuario, Configuracion, etc.).
- Si en las últimas 24 horas hubo más de 10 eventos, se ven los 10 más recientes; si hubo menos, lo que haya. El subtítulo "Últimas 24 horas en el sistema" pasa a ser veraz.

### 2. Ingresos · últimos 6 meses

Nueva consulta agregada para los 5 meses previos cerrados + el mes corriente parcial.

Helper que genera los 6 rangos `{ desde, hasta, etiqueta }` ordenados ascendente:

```ts
function rangos6MesesUTC(): { desde: Date; hasta: Date; mes: string }[] {
  const nowSV = new Date(Date.now() - OFFSET_SV_MS)
  const rangos: { desde: Date; hasta: Date; mes: string }[] = []
  // 5 meses previos completos + mes actual
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
```

Y la agregación en paralelo:

```ts
const rangosMeses = rangos6MesesUTC()

const ingresosPorMes = await Promise.all(
  rangosMeses.map((r) =>
    prisma.pago.aggregate({
      where: { fecha: { gte: r.desde, lt: r.hasta } },
      _sum: { monto: true },
    }),
  ),
)

const ingresosUltimos6Meses = rangosMeses.map((r, i) => ({
  mes: r.mes,
  total: (ingresosPorMes[i]._sum.monto ?? new Decimal(0)).toFixed(2),
}))
```

**Resultado:** `Array<{ mes: 'YYYY-MM'; total: string }>` con 6 elementos.

`ingresosMes` (string del mes corriente) se conserva tal cual para no romper consumidores actuales — es el mismo número que `ingresosUltimos6Meses[5].total`.

### 3. Utilización por categoría

Reemplazar `groupBy({ by: ['estado'] })` por `groupBy({ by: ['categoria', 'estado'] })`. Agregar suma de stock de piezas para la fila "Andamios".

```ts
prisma.equipo.groupBy({
  by: ['categoria', 'estado'],
  _count: { _all: true },
}),

prisma.piezaTipo.aggregate({
  where: { activo: true },
  _sum: { stockActual: true },
}),
```

Construcción del array:

```ts
const CATEGORIAS_EQUIPO: CategoriaEquipo[] = [
  'COMPRESOR_GENERADOR',
  'SANDBLASTING',
  'ANDAMIO_PLATAFORMA',
  'COMPACTADOR_RODILLO',
  'HERRAMIENTA_ESPECIALIZADA',
  'OTRO',
]

// Pivote: { [categoria]: { [estado]: count } }
const pivot: Record<string, Record<string, number>> = {}
for (const g of equiposPorCategoriaYEstado) {
  pivot[g.categoria] ??= {}
  pivot[g.categoria][g.estado] = g._count._all
}

const filasEquipos = CATEGORIAS_EQUIPO.map((cat) => {
  const p = pivot[cat] ?? {}
  const disponible    = p['DISPONIBLE']    ?? 0
  const rentado       = p['RENTADO']       ?? 0
  const mantenimiento = p['MANTENIMIENTO'] ?? 0
  // USO_INTERNO e INACTIVO excluidos de la barra visual; se cuentan en `total`
  // junto al resto para mantener coherencia con la métrica de utilización global.
  const usoInterno    = p['USO_INTERNO']   ?? 0
  const inactivo      = p['INACTIVO']      ?? 0
  return {
    categoria: cat,
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
  // Las piezas no tienen estado por unidad — todo el stock se trata como disponible
  // a nivel inventario. Si se necesita rentado/mant más adelante deberá modelarse
  // en el schema (por ahora `stockActual` es un contador agregado).
  rentado: 0,
  mantenimiento: 0,
  disponible: totalAndamios,
  usoInterno: 0,
  inactivo: 0,
  total: totalAndamios,
}

const utilizacionPorCategoria = [...filasEquipos, filaAndamios]
```

**Forma del nuevo campo en la respuesta:**

```ts
utilizacionPorCategoria: Array<{
  categoria: 'COMPRESOR_GENERADOR' | 'SANDBLASTING' | 'ANDAMIO_PLATAFORMA' |
             'COMPACTADOR_RODILLO' | 'HERRAMIENTA_ESPECIALIZADA' | 'OTRO' |
             'ANDAMIO_PIEZA';
  rentado: number;
  mantenimiento: number;
  disponible: number;
  usoInterno: number;
  inactivo: number;
  total: number;
}>
```

El campo `utilizacionEquipos` global existente se conserva intacto (resta usado por `dtesPendientes` u otras vistas).

---

## Cambios al frontend

### `types/dashboard.ts`

Agregar dos campos a `DashboardKpis`:

```ts
export type CategoriaFlota =
  | 'COMPRESOR_GENERADOR'
  | 'SANDBLASTING'
  | 'ANDAMIO_PLATAFORMA'
  | 'COMPACTADOR_RODILLO'
  | 'HERRAMIENTA_ESPECIALIZADA'
  | 'OTRO'
  | 'ANDAMIO_PIEZA';

export type UtilizacionCategoria = {
  categoria: CategoriaFlota;
  rentado: number;
  mantenimiento: number;
  disponible: number;
  usoInterno: number;
  inactivo: number;
  total: number;
};

export type IngresoMensual = {
  mes: string;        // 'YYYY-MM'
  total: string;      // Decimal serializado
};

// dentro de DashboardKpis:
ingresosUltimos6Meses: IngresoMensual[];
utilizacionPorCategoria: UtilizacionCategoria[];
```

### `ActivityFeed.tsx` — labels legibles

Reemplazar los diccionarios `ACCION_LABEL` y `ENTITY_LABEL` por mapeos basados en el formato real del backend (`VERBO_ENTIDAD` en MAYÚSCULAS).

```ts
// Mapa: prefijo de la acción → label legible para el verbo.
// El backend emite acciones como CREAR_CLIENTE, ACTUALIZAR_PIEZA, CAMBIAR_ESTADO_EQUIPO.
const VERBO_LABEL: Record<string, string> = {
  CREAR:             'creó',
  ACTUALIZAR:        'actualizó',
  ELIMINAR:          'eliminó',
  CAMBIAR_ESTADO:    'cambió el estado de',
  AJUSTAR_STOCK:     'ajustó el stock de',
  ACTIVAR:           'activó',
  DESACTIVAR:        'desactivó',
  EMITIR:            'emitió',
  ANULAR:            'anuló',
  DESPACHAR:         'despachó',
  ENTREGAR:          'entregó',
  REGISTRAR:         'registró',
  APROBAR:           'aprobó',
  RECHAZAR:          'rechazó',
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
```

Helper para extraer verbo de la acción:

```ts
function labelDeAccion(accion: string): string {
  // Acciones llegan como "CREAR_CLIENTE", "CAMBIAR_ESTADO_PIEZA", "AJUSTAR_STOCK_CONSUMIBLE".
  // Tomamos el prefijo más largo que coincida con VERBO_LABEL.
  // Iterar de mayor a menor longitud asegura que "CAMBIAR_ESTADO" gane sobre "CAMBIAR".
  const prefijos = Object.keys(VERBO_LABEL).sort((a, b) => b.length - a.length);
  for (const p of prefijos) {
    if (accion === p || accion.startsWith(`${p}_`)) return VERBO_LABEL[p];
  }
  return accion.toLowerCase().replace(/_/g, ' ');
}
```

### `RevenueWidget.tsx` — bar chart 6 meses

Reescribir el componente para aceptar `ingresosUltimos6Meses` y renderizar:

- Header con título `Ingresos · últimos 6 meses`, subtítulo `Total cobrado por mes en miles USD`, y pill con `+/- X.X% MOM` calculado de los dos últimos meses.
- `<BarChart>` de Recharts (orientación vertical) con 6 barras en color `--yellow`, etiqueta del mes en eje X (`DIC`, `ENE`, …), monto en formato `$XX.XK` arriba de cada barra.

```tsx
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, LabelList } from 'recharts';
import Decimal from 'decimal.js';
import type { IngresoMensual } from '@/types/dashboard';

type RevenueWidgetProps = { ingresosUltimos6Meses: IngresoMensual[] };

const MES_ABREV: Record<string, string> = {
  '01': 'ENE','02':'FEB','03':'MAR','04':'ABR','05':'MAY','06':'JUN',
  '07': 'JUL','08':'AGO','09':'SEP','10':'OCT','11':'NOV','12':'DIC',
};

function abreviar(mes: string): string {
  return MES_ABREV[mes.split('-')[1] ?? ''] ?? mes;
}

function formatMiles(n: number): string {
  // "142800" -> "$142.8K". Usamos 1 decimal siempre para alineación visual.
  return `$${(n / 1000).toFixed(1)}K`;
}

export function RevenueWidget({ ingresosUltimos6Meses }: RevenueWidgetProps) {
  const data = ingresosUltimos6Meses.map((m) => ({
    mes: abreviar(m.mes),
    valor: new Decimal(m.total).toNumber(),
    label: formatMiles(new Decimal(m.total).toNumber()),
  }));

  // MOM% calculado en cliente. Si el mes anterior fue 0 no mostramos pill (división por cero).
  const ultimo = data[data.length - 1]?.valor ?? 0;
  const anterior = data[data.length - 2]?.valor ?? 0;
  const mom = anterior > 0 ? ((ultimo - anterior) / anterior) * 100 : null;
  const momPositive = mom !== null && mom >= 0;

  return (
    <div className="rounded-lg bg-surface border border-bd p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-tx">Ingresos · últimos 6 meses</h3>
          <p className="text-xs text-tx-3 mt-0.5">Total cobrado por mes en miles USD</p>
        </div>
        {mom !== null && (
          <span
            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${
              momPositive
                ? 'border-ok/30 bg-ok/10 text-ok'
                : 'border-danger/30 bg-danger/10 text-danger'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {momPositive ? '+' : ''}{mom.toFixed(1)}% MOM
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7B8E' }} />
          <Tooltip
            cursor={{ fill: 'rgba(10,26,42,0.04)' }}
            contentStyle={{ background: '#FFFFFF', border: '1px solid rgba(10,26,42,0.10)', borderRadius: 6, fontSize: 12 }}
            formatter={(v: number) => [`$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Ingresos']}
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

Si las clases `border-ok/30`, `bg-ok/10`, etc. no existen ya como utilidades, se definen en `@layer utilities` con un patrón consistente al resto del proyecto (no escribir CSS vanilla).

### `FleetWidget.tsx` — desglose por categoría

Reemplazar el bar chart actual por una lista de 7 filas (6 categorías del enum + Andamios). Cada fila:

- Label de la categoría a la izquierda.
- Barra dividida en 3 segmentos (Rentado en amarillo, Mantenimiento en naranja, Disponible en gris claro), proporcional a `total`.
- Contador `rentado / total` a la derecha en `font-mono`.

Para Andamios, el total es la suma de `stockActual`. Como las piezas no tienen estado por unidad, todo el segmento es "Disponible".

Footer con leyenda: ● Rentado · ● Mantenimiento · ● Disponible.

```tsx
type FleetWidgetProps = { utilizacionPorCategoria: UtilizacionCategoria[] };

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

Cada fila renderiza un `<div>` flex con tres `<div>` proporcionales:

```tsx
const pct = (n: number) => (fila.total > 0 ? (n / fila.total) * 100 : 0);
<div className="flex h-2 rounded-full overflow-hidden bg-bg-sunken">
  <div className="bg-accent"      style={{ width: `${pct(fila.rentado)}%` }} />
  <div className="bg-accent-dim"  style={{ width: `${pct(fila.mantenimiento)}%` }} />
  <div className="bg-bd"          style={{ width: `${pct(fila.disponible)}%` }} />
</div>
```

(Los nombres de color son los tokens reales del proyecto; ajustar al `@layer utilities` existente si difieren.)

Mostrar `<span className="font-mono">{fila.rentado}/{fila.total}</span>` a la derecha. Si `fila.total === 0`, mostrar `—`.

### `dashboard/page.tsx`

Actualizar las props de los dos widgets:

```tsx
<RevenueWidget ingresosUltimos6Meses={data.ingresosUltimos6Meses} />
<FleetWidget   utilizacionPorCategoria={data.utilizacionPorCategoria} />
```

El resto de la página queda igual.

---

## Manejo de errores

- Si el backend falla, el dashboard ya muestra su banner de error existente. No se cambia.
- En `RevenueWidget`, si `ingresosUltimos6Meses.length !== 6` (edge case por bugs upstream), mostrar lo que llegue ordenado; no romper.
- En `FleetWidget`, si `utilizacionPorCategoria` está vacío, mostrar `EmptyState` con mensaje "Sin equipos registrados". (Caso muy improbable pero defensivo.)

---

## Permisos

No cambian. Las visibilidades por rol (`showIngresos`, `showFlota`, …) en `dashboard/page.tsx` se conservan tal cual.

---

## Convenciones aplicadas

- Comentarios "why" en español sólo donde no es obvio (cálculo de MOM con guardia de división por cero, exclusión de USO_INTERNO de la barra visual, fila Andamios sin split por modelo de datos).
- Tailwind predefinido. Si se necesita una utilidad de color semitransparente (`ok/10`, `danger/10`), añadirla en `@layer utilities` de `globals.css`.
- Montos con `decimal.js` + `formatCurrency` para tooltips; el label de barra usa formato corto `$XX.XK`.
- 100% español en UI.

---

## Checklist antes de PR

- [ ] Backend: nuevo campo `ingresosUltimos6Meses` (array de 6) con sumas correctas por mes en TZ El Salvador.
- [ ] Backend: nuevo campo `utilizacionPorCategoria` (7 filas: 6 del enum + ANDAMIO_PIEZA).
- [ ] Backend: actividad reciente sin filtro de entidad, con filtro `createdAt ≥ now - 24h`, `take: 10`.
- [ ] Frontend: tipos actualizados; el dashboard compila sin errores TS.
- [ ] Frontend: ActivityFeed traduce verbos snake_case a labels legibles ("creó pieza de andamio …").
- [ ] Frontend: RevenueWidget renderiza bar chart con MOM% pill.
- [ ] Frontend: FleetWidget renderiza 7 filas con barras proporcionales y leyenda.
- [ ] `pnpm tsc --noEmit` y `pnpm lint` pasan en el frontend; tests del backend siguen verdes.
- [ ] Dark mode y vista tablet sin regresiones.
- [ ] Sin clases vanilla CSS en `globals.css` — todo Tailwind o `@layer utilities`.
