# Spec: Dashboard (RAMA 3)

**Fecha:** 2026-05-21
**Rama:** `feat/dashboard`
**Autor:** Joaquin Morales

---

## Objetivo

Implementar la página de inicio del ERP con KPIs del negocio, gráficas de utilización y widgets de actividad reciente, siguiendo el prototipo `Frontend-REINAR-design/home.jsx` y adaptando las visualizaciones a los datos que devuelve el endpoint actual del backend.

---

## Endpoint del backend

```
GET /api/v1/dashboard/kpis
```

Accesible para todos los roles. Devuelve un único objeto con todas las métricas; no filtra por rol en el servidor.

**Forma del response:**

```ts
{
  rentasActivas: number
  maquinariaEnMantenimiento: { equipos: number; herramientas: number; total: number }
  totalClientes: number
  cotizacionesPendientes: number
  facturasPorCobrar: { count: number; total: string }   // total es Decimal serializado
  facturasVencidas: number
  ingresosMes: string                                    // Decimal serializado
  utilizacionEquipos: { disponibles: number; rentados: number; mantenimiento: number; inactivos: number; total: number }
  serviciosEstaSemana: number
  topClientesPorIngresos: { clienteId: string; nombre: string; total: string }[]
  actividadReciente: { entidad: string; entidadId: string; accion: string; usuario: string | null; createdAt: string }[]
  actasPendientesEntrega: number
  dtesPendientes: number
}
```

---

## Archivos a crear

```
hooks/use-dashboard.ts
components/dashboard/KpiGrid.tsx
components/dashboard/KpiCard.tsx
components/dashboard/RevenueWidget.tsx
components/dashboard/FleetWidget.tsx
components/dashboard/ActivityFeed.tsx
components/dashboard/TopClientes.tsx
app/(dashboard)/dashboard/page.tsx        # reemplaza el placeholder actual
```

---

## Arquitectura

`page.tsx` es `'use client'`. Llama a `useDashboardKpis()` y maneja los tres estados: cargando (skeleton), error (banner), y datos listos (renderiza todos los widgets).

Los widgets son componentes puros: reciben props tipados, no hacen fetch propio ni leen stores directamente, excepto `KpiGrid` que lee `user.rol` del auth store para aplicar el filtrado.

---

## Componentes

### `hooks/use-dashboard.ts`

```ts
// Query key: ['dashboard', 'kpis']
// staleTime: 2 minutos — el dashboard no necesita ser ultra-fresco
// Devuelve: { data, isLoading, isError }
```

### `KpiGrid` + `KpiCard`

`KpiGrid` recibe el objeto `data` completo y `rol`. Construye internamente un array de `KpiDef` filtrado por el mapa `KPI_POR_ROL`:

```ts
const KPI_POR_ROL: Record<Rol, KpiId[]> = {
  ADMIN:        ['rentas','cotPend','ingresos','porCobrar','vencidas','mantto','actas','servicios'],
  GERENTE:      ['rentas','cotPend','ingresos','porCobrar','vencidas','mantto','actas','servicios'],
  OPERADOR:     ['rentas','cotPend','ingresos','porCobrar','vencidas','actas','servicios'],
  LOGISTICA:    ['mantto','actas'],
  VISUALIZADOR: ['rentas','cotPend','ingresos','porCobrar','vencidas','mantto','actas','servicios'],
}
```

`KpiCard` recibe `{ label, value, delta, dir, icon }`. El `delta` se colorea: `dir='up'` → verde, `dir='down'` → rojo, `dir='flat'` → gris. El ícono es de `lucide-react`.

**Definición de cada KPI** (cómo se mapea del response):

| KpiId | label | value | delta | dir |
|---|---|---|---|---|
| `rentas` | Rentas activas | `rentasActivas` | estático `—` | `flat` |
| `cotPend` | Cotizaciones pend. | `cotizacionesPendientes` | estático `—` | `flat` |
| `ingresos` | Ingresos del mes | `formatCurrency(ingresosMes)` | estático `—` | `flat` |
| `porCobrar` | Por cobrar | `formatCurrency(facturasPorCobrar.total)` + subtext `{count} facturas` | estático `—` | `flat` |
| `vencidas` | Facturas vencidas | `facturasVencidas` | estático `—` | `down` si >0, `flat` si 0 |
| `mantto` | En mantenimiento | `maquinariaEnMantenimiento.total` | estático `—` | `flat` |
| `actas` | Actas pendientes | `actasPendientesEntrega` | estático `—` | `down` si >0, `flat` si 0 |
| `servicios` | Servicios esta sem. | `serviciosEstaSemana` | estático `—` | `flat` |

> **Nota:** El endpoint no devuelve deltas históricos comparativos. Los campos `delta` muestran `—` hasta que el backend los exponga. El `dir` se deriva del valor actual (ej. facturas vencidas > 0 es siempre `down`).

### `RevenueWidget`

Reemplaza la gráfica de 6 barras del prototipo. Muestra:
- Número grande: `formatCurrency(ingresosMes)`
- Subtítulo: "Ingresos del mes en curso"
- Sin Recharts — solo tipografía y badge

Visible para: ADMIN, GERENTE, OPERADOR, VISUALIZADOR.

### `FleetWidget`

Recharts `BarChart` horizontal (layout `'vertical'`) con una barra por estado de equipo:
- Disponible → `var(--ok)` (verde)
- Rentado → `var(--yellow)` (acento)
- Mantenimiento → `var(--warn)` (naranja)
- Inactivo → `var(--text-3)` (gris)

Fuente de datos: `utilizacionEquipos` del response.

Visible para: ADMIN, GERENTE, LOGISTICA, VISUALIZADOR.

### `ActivityFeed`

Lista de hasta 10 ítems del `actividadReciente`. Por cada ítem:
- Ícono por entidad: `Cotizacion` → `FileText`, `Factura` → `Receipt`, `Pago` → `DollarSign`, `ActaEntrega` → `ClipboardCheck`, `Cliente` → `User`
- Texto: `"{accion} · {entidad} {entidadId}"`
- Meta: nombre de usuario + tiempo relativo (`formatDistanceToNow` de `date-fns`, locale `es`)

Visible para todos los roles.

### `TopClientes`

Tabla de 5 filas con columnas: `#`, Nombre, Facturado.
- Nombre es un link `href="/clientes/{clienteId}"` con `font-medium`
- Facturado: `formatCurrency(total)` con `font-mono`

Visible para: ADMIN, GERENTE, OPERADOR, VISUALIZADOR.

---

## Layout de la página

```
PageHeader
  title: "Buenos [días/tardes/noches], {user.nombre}"
  subtitle: fecha larga en español (ej. "Jueves, 21 de mayo de 2026")
  actions: botón "Nueva cotización" → href="/cotizaciones/nueva"
           (oculto para LOGISTICA y VISUALIZADOR)

<KpiGrid />          — fila completa

<div grid-2>
  <RevenueWidget />  — oculto si rol es LOGISTICA
  <FleetWidget />    — oculto si rol es OPERADOR
</div>               — si solo uno es visible, ocupa ancho completo

<div grid-2>
  <ActivityFeed />
  <TopClientes />    — oculto si rol es LOGISTICA
</div>
```

---

## Estados de carga y error

- **Cargando:** un skeleton de la forma general del dashboard (grid de 8 rectángulos + 2 bloques grandes)
- **Error:** banner con mensaje "No se pudo cargar el resumen. Intenta de nuevo." y botón "Reintentar" que llama a `refetch()`
- **Sin datos:** no aplica — el endpoint siempre devuelve el objeto completo aunque algunos valores sean 0

---

## Convenciones aplicadas

- Montos: `formatCurrency()` de `lib/utils.ts` (nunca `parseFloat`)
- Decimal fields (`ingresosMes`, `total` de `facturasPorCobrar`, `total` de top clientes): `new Decimal(val)` antes de formatear
- Números de documento en `font-mono` donde aplique
- Comentarios tipo "why" en español, solo donde la decisión no sea obvia
- Idioma de la UI: 100% español

---

## Fuera de alcance

- Datos históricos de ingresos por mes (6M) — cubiertos en la sección de Reportes
- Desglose de flota por categoría — ídem
- Accesos rápidos a módulos: el prototipo no los incluye en `HomePage`; se omiten
