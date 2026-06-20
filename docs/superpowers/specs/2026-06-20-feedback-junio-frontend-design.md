# Spec — Frontend feedback junio (E1–E8)

> Fecha: 2026-06-20
> Backend: ya implementado y mergeado en `feat/feedback-junio-backend`. El frontend **espeja el contrato del backend** descrito en los bloques `NOTA FRONTEND` de `/Users/joaquinmorales13a06/Desktop/Reinar/prompts-feedback-junio.md`.
> Frontend: `/Users/joaquinmorales13a06/Desktop/Reinar/frontend` (Next.js App Router).

## Objetivo

Portar al frontend los 13 puntos de feedback (agrupados en 8 epics E1–E8) cuyos cambios de backend/DB ya están listos. Todo el trabajo va en **una sola rama** con **un commit por epic**.

## Decisiones transversales

- **Rama:** `feat/feedback-junio-frontend` desde `main`.
- **Commits:** uno por epic, convención del repo (`feat(modulo): …` / `fix(modulo): …` en español), terminando con `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Orden:** E1 → E2 → E3 → E5 → E6 → E4 → E7 → E8.
  - E3 antes que E5 (repuestos externos usan el select de Proveedor).
  - E5 antes que E6 (reporte de mantenimientos sobre el nuevo modelo).
  - E4 antes que E8 (E8 agrega `?proyectoId` al reporte de inventario de E4).
- **Convenciones (CLAUDE.md):** React Hook Form + Zod; errores del backend inline con `setError` (no toast); toasts en mutations (`toast.success`/`toast.error`); montos con patrón Decimal (`Number()` al cargar, `type="number"` en inputs, `formatCurrency`/`new Decimal()` al mostrar — nunca `parseFloat`); clases Tailwind predefinidas (sin valores arbitrarios); botones de escritura ocultos a VISUALIZADOR; 100% español.
- **Verificación por epic:** `pnpm tsc --noEmit` + `pnpm lint` antes de cada commit. No hay suite de tests en el frontend.

## Decisiones de producto confirmadas

- **Proveedores en nav:** item nuevo en grupo **Inventario**, lectura para todos los roles; escritura solo ADMIN/GERENTE/LOGISTICA.
- **Tarifa en pantalla:** se **deja visible** en las vistas internas de cotización/factura (`ItemsTabla` / `ItemsFacturadosCard`). El feedback de ocultar Tarifa fue solo del PDF y ya está hecho en backend.
- **Reporte de inventario (E4):** se **enriquece la página interactiva existente** (`/reportes/inventario`) y se le agrega botón de export, en vez de moverlo al flujo de export.
- **E2 períodos de renta:** card editable en el **detalle de factura**.
- **Ingresos de inventario (E3):** se **incluye** la vista de consulta (historial de compras) para ADMIN/GERENTE/LOGISTICA.
- **Enviar inventario al proyecto (E8):** panel guiado en el **detalle del proyecto**, reusando los endpoints existentes de mover/transferir.

---

## E1 — Permisos LOGISTICA sobre inventario + acceso a reportes de inventario

Solo edición de constantes de permisos (espejo del backend ya habilitado).

- `lib/equipos.ts` → agregar `'LOGISTICA'` a `crear`, `editar`, `eliminar`, `verInactivos`.
- `lib/herramientas.ts` → agregar `'LOGISTICA'` a `crearTipo`, `editarTipo`, `desactivarTipo`, `crearConsumible`, `editarConsumible`, `desactivarConsumible` (consumibles viven en este archivo).
- `lib/bodegas.ts` → agregar `'LOGISTICA'` a `crear`, `editar`, `cambiarEstado` y a las acciones de zonas si están modeladas.
- `lib/andamios.ts` → agregar `'LOGISTICA'` a piezas y cuerpos (`crear`/`editar`/`cambiarEstado`), espejando el backend.
- `lib/permisos-nav.ts` → `reportes` += `'LOGISTICA'`.
- `app/(dashboard)/reportes/page.tsx` → verificar que LOGISTICA solo vea Inventario (y luego Mantenimientos), nunca los exportables financieros. `puedeVerExportables` permanece `ADMIN`/`GERENTE`.

**Aceptación:** un usuario LOGISTICA ve botones CRUD de inventario y el ítem Reportes con solo Inventario.

## E2 — Período de renta por línea en el PDF de factura

- Nueva card `components/facturas/detalle/PeriodosRentaCard.tsx`:
  - Lista las líneas de la cotización asociada con dos `date` inputs (inicio/fin) por línea.
  - Validación `inicio ≤ fin`; permite líneas sin rango (se omiten del envío).
  - Botón Guardar → `PATCH /facturas/:id/periodos-renta`, body `{ items: [{ cotizacionItemId, inicio, fin }] }` (fechas ISO).
  - Roles de escritura: ADMIN/GERENTE/OPERADOR. Oculta para los demás.
  - Errores: 400 (validación / ítem ajeno), 404 (factura no existe), 422 (factura ANULADA) → inline.
- Mutation en el hook de facturas; invalidar `['facturas', id]` tras guardar.
- La columna Tarifa en pantalla no cambia.

**Aceptación:** capturar inicio/fin por línea y guardarlos; el PDF (ya hecho en backend) muestra el rango.

## E3 — Proveedores + Datos de compra + Ingresos de inventario

### Catálogo de Proveedores (patrón Clientes)
- `types/api.ts` → tipo `Proveedor`.
- `lib/proveedores.ts` → permisos: escritura ADMIN/GERENTE/LOGISTICA, lectura todos.
- `hooks/use-proveedores.ts` → `useProveedores(params)` (paginado, `search`, `activo`), `useProveedor(id)`, `useCrearProveedor`, `useEditarProveedor`, `useCambiarActivoProveedor`.
- Endpoints: `GET/POST /proveedores`, `GET/PUT /proveedores/:id`, `PATCH /proveedores/:id/activo`.
- Páginas: `app/(dashboard)/proveedores/page.tsx` (lista con PageHeader/FilterBar/DataTable/Pagination), `proveedores/nuevo/page.tsx`, `proveedores/[id]/page.tsx` o `[id]/editar`.
- Componentes: `components/proveedores/ProveedoresList.tsx`, `ProveedorForm.tsx`.
- Campos: `nombre` (req), `nrc?`, `nit?`, `contacto?`, `telefono?` (PhoneInputField), `email?`, `notas?`, `activo`.

### Nav
- `lib/nav.ts` → item `Proveedores` en grupo Inventario + agregarlo al grupo Inventario del BottomNav.
- `lib/permisos-nav.ts` → `proveedores`: todos los roles (lectura).

### Sección "Datos de compra" (reutilizable)
- `components/inventario/DatosCompraFields.tsx` con `<FormSection title="Datos de compra">`. Campos **todos opcionales**: N° factura compra, Proveedor (select del catálogo), Fecha compra (date), Valor unitario compra (patrón Decimal), N° acta interna, notas.
- Se envía como objeto `datosCompra` `{ valorUnitarioCompra (number, req si se manda el objeto), numeroFacturaCompra?, proveedorId? (cuid), fechaCompra? (ISO), numeroActaInterna?, notas? }`.
- Integrar en: alta de Equipo (`POST /equipos`), alta de Unidad de herramienta (`POST /herramientas/:id/unidades`), alta de Consumible (`POST /consumibles`), restock de consumible (`PATCH /consumibles/:id/stock`, **solo `delta > 0`**).
- Discovery: localizar el form de alta de unidades de herramienta y el de restock de consumible.

### Vista de Ingresos de Inventario (consulta)
- `hooks/use-ingresos-inventario.ts` → lista (`?page,?limit,?proveedorId`) + detalle (`/:id` con items, proveedor, registradoPor).
- Páginas: `app/(dashboard)/ingresos-inventario/page.tsx` + `[id]/page.tsx`.
- Nav item en Inventario visible solo a ADMIN/GERENTE/LOGISTICA (datos de costo sensibles).

**Aceptación:** CRUD de proveedores; alta/restock con datos de compra opcionales; consulta de ingresos para roles de inventario.

## E5 — Mantenimientos: categoría, validaciones, campos clínicos, repuestos

### Alta (`mantenimientos/nuevo/page.tsx` + `components/mantenimientos/MantenimientoFormFields.tsx`)
- Selector **Categoría** (`INTERNO | EXTERNO | EN_CLIENTE`) obligatorio.
- Quitar "(opcional)" de Horómetro y Costo estimado; obligatorios en Zod.
- Horómetro obligatorio **solo si es de equipo** (`equipoId` presente) — refine condicional.
- Ya no se envían `repuestos` al crear.

### Salida (`mantenimientos/[id]/salida/page.tsx`)
- Textareas: Diagnóstico, Trabajo realizado, Observaciones (opcionales).
- Repuestos con `useFieldArray`, cada fila interno XOR externo:
  - Interno: `consumibleId` (select) + `bodegaId` (select) + `cantidad` (entero positivo). Descuenta stock; 422 si no alcanza → inline.
  - Externo: `descripcion` + `proveedorId?` (select) + `costoCompra?` + `fechaCompra?` + `cantidad`.
  - Toggle interno/externo por fila; mostrar costo total de repuestos.
- `PATCH /mantenimientos/:id/salida` con `{ diagnostico?, trabajoRealizado?, observaciones?, repuestos: [...] }`.

### Detalle / listado
- `repuestos` ahora es array de objetos `{ id, cantidad, consumibleId, bodegaId, descripcion, proveedorId, costoCompra, fechaCompra }` — actualizar render.
- Mostrar `categoria`/`diagnostico`/`trabajoRealizado`/`observaciones`.
- Listado: chip de filtro `categoria` (`GET /mantenimientos?categoria=`).

**Aceptación:** alta con categoría + horómetro/costo obligatorios; salida con campos clínicos y repuestos estructurados; filtro por categoría.

## E6 — Reporte de Mantenimientos (export)

- `hooks/use-reportes.ts` → agregar tipo `mantenimientos` a `TipoReporte`.
- `app/(dashboard)/reportes/page.tsx` → card "Mantenimientos" visible para LOGISTICA (como Inventario) + ADMIN/GERENTE.
- `app/(dashboard)/reportes/generar/page.tsx` → para `mantenimientos`: `desde`/`hasta`/`formato` requeridos + filtros opcionales `tipo`, `categoria`, `estado`, `equipoId`/`herramientaUnidadId`, `tecnico`; ajustar el control de acceso por-tipo para permitir LOGISTICA.
- `GET /reportes/mantenimientos` responde el archivo como attachment; reusar el patrón `generarReporte()` (blob + `URL.createObjectURL`).

**Aceptación:** LOGISTICA y ADMIN/GERENTE pueden generar el reporte con sus filtros y descargarlo.

## E4 — Reporte de inventario enriquecido (interactivo + export)

- `app/(dashboard)/reportes/inventario/page.tsx`:
  - Consumir el snapshot enriquecido: `estado.{equipos,herramientas}` `{ total, disponibles, rentadas, mantenimiento, usoInterno, pctRentado }`, `equiposPorCategoria[]`, `consumibles`/`piezas` `{ sku, unidadesEnStock, unidadesConClientes }`, `porCliente[]`.
  - Columnas total/disponibles/rentadas/mantenimiento/uso interno + **barra de % rentado** usando `pctRentado` del backend.
  - `<FilterBar>` con cliente / bodega / categoría (`?clienteId`, `?bodegaId`, `?categoria`). `?proyectoId` se agrega en E8.
  - Botón **Export** (PDF/Excel/CSV) → `GET /reportes/inventario?formato=…` (blob).
- `hooks/use-reporte-inventario.ts` → aceptar filtros + función de export. Mantener compatibilidad de la query existente.
- `types/api.ts` → actualizar el tipo del snapshot.
- Usable en tablet.

**Aceptación:** la vista muestra disponible vs rentado y % por ítem, filtra por cliente/bodega/categoría, y exporta.

## E7 — Devolución parcial de consumibles

- Form de recepción (`POST /facturas/:facturaId/recepciones`):
  - Por **consumible**: capturar `cantidadDevuelta` (entero positivo, ≤ pendiente = despachado − ya recibido) + checkbox `cerrar`.
  - Mostrar saldo pendiente y cuánto queda como consumido.
  - Equipos/unidades/piezas: sin cambios (recepción total; ignoran `cantidadDevuelta`/`cerrar`).
  - Sobre-devolución → 422 con mensaje → inline.
  - El acta queda `DEVUELTA_PARCIAL` mientras haya consumibles abiertos; reflejarlo.
- El pendiente por ítem se deriva de despachado − recibido (no hay endpoint dedicado).
- Discovery: localizar el form de recepción.

**Aceptación:** registrar devolución parcial acumulativa de consumibles con validación de saldo.

## E8 — Proyectos como bodegas

- **Detalle de proyecto** (`/proyectos/[id]`): panel **Bodega de proyecto**.
  - `GET /proyectos/:id/bodega` (devuelve la bodega tipo PROYECTO o `null`).
  - Si `null`: botón "Crear bodega de proyecto" → `POST /proyectos/:id/bodega` (ADMIN/GERENTE/LOGISTICA; body opcional `{ nombre?, descripcion? }`; 409 si ya existe).
  - Si existe: mostrar inventario (`GET /bodegas/:bodegaId/inventario`) y acción **Enviar inventario**: elegir ítems de la bodega principal → `PATCH /equipos/:id/bodega`, `PATCH /herramientas/unidades/:id/bodega`, `PATCH /consumibles/:id/transferir-stock`, `PATCH /andamios/piezas/:id/transferir-stock` con la bodega-proyecto como destino.
- **Bodegas list:** `Bodega` ahora trae `tipo` (`PRINCIPAL|ZONA|PROYECTO`) y `proyectoId`; distinguir PROYECTO con Badge.
- **Selector de despacho de actas:** excluir bodegas PROYECTO como origen (el backend las rechaza con 400).
- **Cierre de proyecto** (COMPLETAR/CANCELAR): manejar 409 si queda inventario en su bodega-proyecto; mostrar el error y guiar a vaciarla.
- **Reporte de inventario (E4):** agregar filtro `?proyectoId` (porBodega[].bodegaTipo puede ser `'PROYECTO'`).
- `hooks/use-proyectos.ts` → endpoints de bodega-proyecto.
- Discovery: localizar el detalle de proyecto y el selector de origen de despacho de actas.

**Aceptación:** crear/ver la bodega-proyecto, enviar inventario, distinguir bodegas PROYECTO, manejar el 409 al cerrar.

---

## Riesgos / notas de descubrimiento

Resolver al implementar cada epic (no bloquean el diseño):
- Ubicación del form de alta de **unidades de herramienta** y del **restock de consumible** (E3).
- Ubicación del **form de recepción** (E7).
- Ubicación del **detalle de proyecto** y del **selector de origen de despacho de actas** (E8).
- `lib/consumibles.ts` no existe: los permisos de consumibles viven en `lib/herramientas.ts`.

## Fuera de alcance

- Cambios de backend o migraciones (ya hechos).
- Ocultar Tarifa en las vistas en pantalla.
- Copia interna de PDF con `?interno=true` (descartada por el backend, D3).
- Endpoint dedicado de pendiente por ítem de recepción (se deriva en cliente).
