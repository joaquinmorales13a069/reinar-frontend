# Feedback UI REINAR: flota, grid de factura y descargas DTE

**Fecha:** 2026-07-18
**Rama:** `feat/feedback-ui-flota-facturas`
**Origen:** Feedback directo de REINAR sobre el dashboard y el detalle de facturas.

## Resumen

Tres cambios acotados de UI, independientes entre sí:

1. Corregir las etiquetas vacías del card "Utilización de flota" del dashboard (bug de contrato backend/frontend).
2. Reorganizar el detalle de factura en un grid de dos columnas que aproveche el espacio vacío bajo "Progreso de cobro".
3. Unificar "Descargar PDF oficial" y "Descargar JSON" del card DTE en un solo botón amarillo con menú desplegable.

---

## 1. Fix de etiquetas en "Utilización de flota"

### Problema

El backend (`server/src/modules/dashboard/dashboard.service.ts`) envía `utilizacionPorCategoria[].categoria` como el **nombre real de la categoría** almacenado en BD (ej. `"Compresores"`, más la fila fija `"Piezas de andamio"`). El frontend tipa ese campo como el enum `CategoriaFlota` (`COMPRESOR_GENERADOR`, `SANDBLASTING`, …) y lo traduce con el diccionario `CATEGORIA_LABEL` en `FleetWidget.tsx`. Como los nombres reales no existen como claves del diccionario, el lookup devuelve `undefined` y todas las filas del card se renderizan sin etiqueta.

### Cambio

- `types/dashboard.ts`: cambiar `categoria: CategoriaFlota` a `categoria: string` y eliminar el tipo `CategoriaFlota` (ya no representa el contrato real).
- `components/dashboard/FleetWidget.tsx`: eliminar `CATEGORIA_LABEL` y renderizar `fila.categoria` directamente.
- Sin cambios de backend ni de API.

### Beneficio

Las categorías nuevas que REINAR cree en inventario aparecen automáticamente en el dashboard sin tocar código.

---

## 2. Grid de dos columnas en detalle de factura

### Problema

En `app/(dashboard)/facturas/[id]/page.tsx` la columna derecha del grid (`lg:grid-cols-3`) solo contiene `ProgresoCobroCard`; todo lo demás va apilado en la columna izquierda. En pantallas grandes (MacBook Pro 16") queda un bloque vacío enorme bajo "Progreso de cobro".

### Cambio

Mover tres cards de la columna izquierda a la derecha, debajo de `ProgresoCobroCard`. Es solo reordenar JSX — el grid con `items-start` y `space-y-4` por columna ya existe.

Orden resultante:

| Izquierda (`lg:col-span-2`) | Derecha (1/3) |
|---|---|
| Ajustar estado (condicional) | Progreso de cobro |
| Cliente y fechas | Período de renta |
| Observaciones | Acta(s) físicas |
| Entrega quedan (si `esQuedan`) | Actas de entrega vinculadas |
| Documento Tributario Electrónico | |
| Items facturados | |
| Pagos | |

### Responsive

En `< lg` el grid ya colapsa a una columna. Los tres cards movidos quedan al final del flujo (después de Pagos), orden aceptable porque son metadatos secundarios. No se necesita CSS nuevo ni breakpoints adicionales.

---

## 3. Botón unificado de descargas en el card DTE

### Problema

En `components/dte/DteSection.tsx`, estado `APROBADO`, hay dos botones separados: "Descargar PDF oficial" (amarillo) y "Descargar JSON" (borde). REINAR quiere un solo botón amarillo que despliegue ambas opciones.

### Cambio

- Nuevo componente local `components/dte/DteDescargasMenu.tsx` que replica el patrón probado de `components/facturas/FacturaDescargasMenu.tsx`: estado `open`, cierre al hacer click fuera (`mousedown` en `document`), `role="menu"` / `role="menuitem"`, `aria-haspopup` y `aria-expanded`.
- El trigger es un botón amarillo (`bg-accent text-navy hover:bg-accent-dim`) con icono `download`, texto **"Descargar"** y chevron.
- Opciones del menú:
  - "PDF oficial" → `onDescargarPdf`; muestra "Generando…" y se deshabilita mientras `isDescargandoPdf`.
  - "JSON" → `onDescargarJson`; muestra "Obteniendo…" y se deshabilita mientras `isDescargandoJson`.
- **Caso sin JSON:** cuando el consumidor no pasa `onDescargarJson`, no se renderiza dropdown — el botón amarillo ejecuta la descarga de PDF directamente (un menú de una sola opción no aporta).
- En `DteSection.tsx` se reemplazan los dos botones actuales por este componente. Los botones "Anular DTE y cambiar tipo" y "Anular factura/nota" no cambian.

### Alcance compartido

`DteSection` se usa en facturas, notas de crédito (`app/(dashboard)/notas-credito/[id]/page.tsx`) y FSE (`components/fse/FseDtePanel.tsx`). Los tres módulos heredan el botón unificado — consistencia deliberada, no efecto colateral.

---

## Fuera de alcance

- Desglose por equipo individual o links al inventario en el card de flota (se descartó en brainstorming).
- Cambios al `FacturaDescargasMenu` del listado de facturas (ya es un dropdown y funciona).
- Cambios de backend.

## Verificación

- `pnpm tsc --noEmit` y `pnpm lint` sin errores.
- Dashboard: las barras de "Utilización de flota" muestran el nombre de cada categoría real de la BD.
- Detalle de factura en ≥ `lg`: columna derecha con Progreso de cobro + Período de renta + Acta(s) físicas + Actas vinculadas; sin espacio muerto. En 768px todo apila en una columna sin romperse.
- Card DTE (factura con DTE APROBADO): botón amarillo "Descargar" despliega PDF oficial y JSON; ambas descargas funcionan y muestran su estado de carga. Verificar también en una nota de crédito y un FSE aprobados.
- Dark mode sin regresiones en los tres cambios.
