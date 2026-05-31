# Fixes UI: actividad reciente, tablas de factura, notificaciones

Fecha: 2026-05-31

Branches:
- Frontend: `fix/ui-cleanups-actividad-tablas-notificaciones`
- Backend: `feat/dashboard-actividad-display-name`

## Contexto

Cuatro ajustes de UI/UX detectados al revisar el sistema:

1. La sección "Actividad reciente" del dashboard muestra el `entidadId` truncado (`cmpseadw`), lo que no aporta lectura humana.
2. Las tablas de `Ítems facturados` y `Pagos registrados` en el detalle de factura se desbordan en breakpoints xs/sm/md.
3. La página de Clientes muestra botones "Importar" y "Exportar" sin función real.
4. Los dropdowns del Topbar (notificaciones en particular) salen del viewport en xs/sm.

## Diseño

### 1. Actividad reciente — nombre amigable

**Backend** (`server/src/modules/dashboard/dashboard.service.ts`)

Después del `findMany` sobre `AuditLog`, agrupar los `entidadId` por `entidad` y resolver un nombre display por entidad en una sola consulta por tabla. Resultado: `Map<string, string | null>` con key `${entidad}:${id}`.

Extender el objeto retornado en `actividadReciente.map(...)` con un nuevo campo `nombre: string | null`.

Mapeo entidad → display:

| Entidad | Display |
|---|---|
| `Cliente` | `razonSocial` (EMPRESA) o `nombre + apellido` (PARTICULAR) |
| `Cotizacion` | `numeroCotizacion` |
| `Factura` | `numeroFactura` |
| `ActaEntrega` | `numero` |
| `Pago` | `numeroFactura` de la factura asociada (join) |
| `NotaCredito` | `numero` |
| `Retencion` | `numero` |
| `Recepcion` | `numero` |
| `Equipo` | `codigoActivo` |
| `Servicio` | `nombre` |
| `HerramientaTipo` | `nombre` |
| `HerramientaUnidad` | `codigo` |
| `Consumible` | `nombre` |
| `PiezaTipo` | `nombre` |
| `CuerpoTipo` | `nombre` |
| `Bodega` | `nombre` |
| `Proyecto` | `nombre` |
| `Usuario` | `nombre + apellido` |
| `Configuracion` | `null` |

**Frontend** (`types/dashboard.ts` + `components/dashboard/ActivityFeed.tsx`)

Agregar `nombre: string | null` al tipo de `actividadReciente`. En el render, reemplazar `{item.entidadId.slice(0, 8)}` por `{item.nombre}` cuando exista; si es `null`, no renderizar el span. Estilo:

- `font-medium text-tx` para entidades cuyo display es texto descriptivo (`Cliente`, `Proyecto`, `Servicio`, `Usuario`, `Equipo`, herramientas, consumibles, piezas, bodegas).
- `font-mono text-xs text-tx-3` para entidades cuyo display es un número/código (`Cotizacion`, `Factura`, `ActaEntrega`, `Pago`, `NotaCredito`, `Retencion`, `Recepcion`).

Lookup de estilo via un `Set` o `Record` paralelo a `ENTITY_LABEL`.

### 2. Tablas de factura responsivas

`components/facturas/detalle/ItemsFacturadosCard.tsx` y `components/facturas/detalle/PagosCard.tsx`:

Envolver la `<table>` en `<div className="overflow-x-auto">`. No agregar `min-width`: las celdas ya tienen anchos explícitos (`w-28`) que suman lo suficiente para forzar scroll horizontal naturalmente cuando el viewport es chico. CLAUDE.md prohíbe valores arbitrarios tipo `min-w-[640px]`.

### 3. Quitar Importar / Exportar

`components/clientes/ClientesList.tsx`: borrar las dos líneas con `<button className={btnSec}>...Importar/Exportar`. Mantener `btnSec` solo si sigue usándose (no parece — verificar al borrar y quitar la constante si queda huérfana).

### 4. Dropdowns del Topbar responsivos

`components/layout/Topbar.tsx`: los tres dropdowns (configuración, notificaciones, usuario) usan `absolute top-full translate-y-1.5 right-0 min-w-{N}` y se salen del viewport en xs/sm porque el botón ancla no está pegado al borde derecho.

Cambio a clase responsiva: en xs/sm fijar al ancho del viewport con margen lateral, desde sm anclar al botón como antes.

```
fixed inset-x-2 top-14 mt-1.5 sm:absolute sm:top-full sm:bottom-auto sm:inset-x-auto sm:right-0 sm:translate-y-1.5
```

`min-w-{N}` se mantiene tal cual; con `inset-x-2` en xs el ancho lo gobierna `inset-x` y `min-w` no aplica visualmente (el contenedor ocupa todo el ancho disponible).

Aplicar a los 3 dropdowns para consistencia.

## Verificación

- `pnpm tsc --noEmit` sin errores.
- Smoke test manual en navegador a 375px (xs) y desktop:
  - Dashboard: actividad reciente muestra nombres amigables.
  - Factura detalle: tablas hacen scroll horizontal en xs sin romperse.
  - Clientes: header sin botones Importar/Exportar.
  - Topbar: los 3 dropdowns no se salen del viewport en xs.

## Commits y PR

Commits separados por fix; un PR por branch (uno backend, uno frontend). El PR de frontend menciona en su descripción el branch backend del que depende.
