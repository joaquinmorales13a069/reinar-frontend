# Grupo A+B — Fixes de feedback de ventas + folio de talonario físico

**Fecha:** 2026-07-11
**Estado:** Diseño aprobado
**Repos afectados:** frontend (`Reinar/frontend`) y backend (`Reinar/server`)

## Contexto

Feedback del área de ventas de REINAR (julio 2026). El lote completo se descompuso en tres grupos de trabajo; este spec cubre el primero (A+B). Los otros dos tendrán su propio ciclo spec → plan → rama:

- **Grupo C (pendiente):** variantes de cotización con el mismo consecutivo.
- **Grupo D (pendiente):** reestructuración de FSE/sujeto excluido — el FSE pasa a ser documento de **compra** (REINAR como adquirente, el sujeto excluido como proveedor), con retención de renta del 10 % sobre servicios.

**Fuera de alcance de este spec:** el bloqueo de FSE para clientes empresa en la re-emisión de DTE se descartó deliberadamente — el flujo FSE actual (orientado a ventas) se va a reestructurar por completo en el Grupo D, así que no tiene sentido parcharlo.

## Alcance — 5 puntos

1. Fix: botón "Enviar DTE por correo" da error interno (backend).
2. Fix: bug del campo depósito en el wizard de cotización (frontend).
3. Mejora: precargar el periodo de renta de la factura en la sección Logística de nueva acta (frontend).
4. Mejora: desplegable de proyectos que autorellena la dirección de entrega en nueva acta (frontend).
5. Cambio: el PDF de la factura debe mostrar el folio del **talonario físico** de actas, no el consecutivo del sistema; con campo manual de respaldo en la factura (backend + frontend).

---

## 1. Fix — "Enviar DTE por correo" (backend)

### Causa raíz

El script de build del backend (`server/package.json:9`) solo copia los templates Handlebars del módulo `pdf` a `dist/`:

```
"build": "tsc && cp -r src/modules/pdf/templates dist/modules/pdf/templates"
```

Los templates de `src/modules/correos/templates/` (incluido `dte-enviado-manual.hbs`) **no llegan a `dist/`**. En producción (Docker copia solo `dist/`), `compilar()` en `correos.service.ts:89-92` hace `fs.readFileSync` de un archivo inexistente → `ENOENT` (Error genérico, no AppError) → el middleware de errores responde 500 "Error interno del servidor".

`enviarDTEManual` (`correos.service.ts:609-661`) es el único flujo de correo que **propaga** el error al usuario; los demás (cotizaciones, facturas, actas) lo tragan con try/catch — es decir, **todos los correos del sistema fallan silenciosamente en producción** y este fix los repara a todos.

### Cambios

- `server/package.json`: extender el script `build` para copiar también `src/modules/correos/templates` → `dist/modules/correos/templates` (mismo patrón que pdf).
- `server/src/modules/correos/correos.service.ts` (`compilar`): si el template no existe, lanzar `AppError` con mensaje claro ("Plantilla de correo no encontrada: <nombre>") en lugar de dejar escapar el `ENOENT` genérico.

### Verificación

- Correr `pnpm build` en el server y confirmar que `dist/modules/correos/templates/*.hbs` existen (los 8 templates).
- Probar el envío manual de DTE contra un DTE aprobado en desarrollo.

---

## 2. Fix — bug del depósito en cotización (frontend)

### Causa raíz

Secuencia: Sin depósito → Monto fijo → (teclear/borrar) → Sin depósito → "Siguiente" no hace nada.

1. `Step3Terminos.tsx:168` registra el monto con `valueAsNumber: true`; un input vacío produce `NaN`.
2. Al volver a "Sin depósito" el bloque del input se desmonta, pero `useForm` no tiene `shouldUnregister`, así que RHF **retiene el `NaN`**.
3. El schema (`lib/schemas/cotizacion.ts`) valida `depositoMonto: z.number().positive().optional().nullable()` **incondicionalmente**: `NaN` no es `null`/`undefined`, así que la validación base falla aunque el modo sea `NINGUNO`.
4. El mensaje de error solo se renderiza dentro del bloque `modo === 'MONTO'` → el usuario ve el botón bloqueado **sin ningún mensaje**.

### Cambios (frontend)

- `lib/schemas/cotizacion.ts`: `depositoMonto` pasa a `z.preprocess` que mapea `NaN`/`''`/`undefined` → `null`; la exigencia de monto > 0 vive **solo** en el `superRefine` cuando `depositoModo === 'MONTO'`.
- `components/cotizaciones/wizard/Step3Terminos.tsx`:
  - Reemplazar `valueAsNumber: true` por `setValueAs` que mapee vacío/`NaN` → `null`.
  - Al seleccionar el radio "Sin depósito", hacer `setValue('depositoMonto', null)` para limpiar el residuo.

### Verificación

Reproducir la secuencia completa (Sin depósito → Monto fijo → teclear y borrar → Sin depósito → Siguiente) y confirmar que avanza. Confirmar también que en modo "Monto fijo" con campo vacío sigue mostrando el error inline.

---

## 3. Mejora — precarga del periodo de renta en nueva acta (frontend)

La factura ya tiene `periodoRentaInicio/Fin` (nivel Factura, editables en su detalle) y el tipo `Factura` del frontend ya los expone. El formulario de nueva acta (`app/(dashboard)/actas/nueva/page.tsx`) tiene los campos en la sección Logística pero hoy arrancan siempre vacíos.

### Cambios

- En el efecto que resuelve la factura seleccionada (modo `factura`, líneas ~172-189): `setValue('periodoRentaInicio'/'periodoRentaFin')` a partir de la factura, convirtiendo ISO → `yyyy-MM-dd` para los `<input type="date">`.
- Aplica también al cambiar de factura vía `SelectorFactura`.
- Los campos siguen siempre editables; si la factura no tiene periodo, quedan vacíos como hoy.
- En modo `cotizacion` no cambia nada (la cotización no tiene rango de periodo).

---

## 4. Mejora — desplegable de proyectos en Dirección de entrega (frontend)

### Diseño

- Nuevo select **"Proyecto (opcional)"** arriba de `DireccionCompleta` en la sección "Dirección de entrega" de `app/(dashboard)/actas/nueva/page.tsx`, con opción por defecto "— Sin proyecto —".
- Se pobla con los proyectos del **cliente** de la cotización/factura seleccionada, usando el hook existente `useProyectosCliente` (`hooks/use-proyectos.ts`). Si aún no hay origen seleccionado o el cliente no tiene proyectos, el select queda deshabilitado con un hint ("Selecciona primero la cotización/factura" o "El cliente no tiene proyectos").
- **Autorrelleno con parseo best-effort** (decisión aprobada): `Proyecto.ubicacion` es un string compuesto con formato fijo `"detalle, distrito, departamento"` (3 niveles, generado por `UbicacionInput`). Al seleccionar un proyecto:
  - Separar por comas desde la derecha: último segmento → departamento, penúltimo → distrito, el resto → calle/detalle.
  - Resolver departamento y distrito contra los catálogos MH de `lib/sv-geo` (`resolverDepartamento`, `resolverDistrito`); el **municipio se deriva** del distrito + departamento (`DISTRITOS_SV`).
  - Si algún nivel no se puede resolver, ese texto (o el string completo) cae en el campo de calle/detalle.
- Nuevo campo opcional **"Detalles adicionales"** (referencias extra) que se anexa al final del string `direccionEntrega` compuesto.
- Los selects de 4 niveles y el campo de calle **siguen siempre editables manualmente** — el proyecto solo precarga, nunca bloquea.
- Sin cambios de backend: `direccionEntrega` sigue siendo el mismo string de texto plano.

---

## 5. Cambio — folio del talonario físico en factura y PDF

### Comportamiento aprobado: automático + manual como respaldo

El PDF de la factura muestra los folios físicos de las actas vinculadas ya despachadas. El campo manual solo aplica cuando no hay ningún folio automático. Si más tarde se despacha un acta con folio real, éste reemplaza al manual en el PDF (el manual queda guardado pero deja de mostrarse).

### Cambios — backend (`Reinar/server`)

- **Prisma:** nuevo campo `Factura.numeroActaFisicoManual String?`. Migración con el flujo offline de BD remota compartida (`migrate diff` para generar el SQL + `migrate deploy`), según el workflow establecido del proyecto.
- **Schemas/servicio:** `actualizarFacturaSchema` (`facturas.schemas.ts`) y `actualizarFactura` (`facturas.service.ts`) aceptan `numeroActaFisicoManual` (string opcional/null para limpiar).
- **PDF (`pdf.service.ts`, `generarFacturaPDF`):**
  - El select de `actasEntrega` pasa de `numeroActa` a `numeroActaFisico`.
  - `numerosActa` del contexto se calcula como: folios físicos no nulos de las actas vinculadas → si no hay ninguno, `numeroActaFisicoManual` → si tampoco, no se muestra la línea "Acta(s) de entrega" (el bloque `{{#if}}` de `factura.hbs` ya lo maneja).
  - El consecutivo del sistema (`numeroActa`) **deja de aparecer** en el PDF de factura.
- **Tests:** actualizar `tests/modules/pdf/pdf.service.test.ts` a la nueva lógica (casos: con folios físicos, solo manual, ninguno).

### Cambios — frontend

- `types/api.ts`: agregar `numeroActaFisicoManual` a `Factura` y `ActualizarFacturaDto`.
- Detalle de factura (`app/(dashboard)/facturas/[id]/page.tsx` y componentes de detalle): nueva fila "Acta(s) físicas" junto al periodo de renta:
  - Si hay actas vinculadas con folio físico → mostrarlos como solo-lectura (font-mono).
  - Si no hay ninguno → campo editable para el folio manual (guardado vía el mismo flujo de edición de la factura, con `toast.success`/`toast.error`).
- Botones/campos de escritura ocultos para rol `VISUALIZADOR`.

---

## Manejo de errores y verificación general

- Errores de backend en formularios: inline con `setError` (convención del proyecto); errores de red con `toast.error`.
- Verificación por repo:
  - Frontend: `pnpm tsc --noEmit` + `pnpm lint`; prueba manual de los flujos tocados (wizard de cotización paso 3, nueva acta con factura y con cotización, detalle de factura, PDF descargado).
  - Backend: `pnpm build` (confirmar templates en `dist/`), suite de tests del server, prueba manual de envío de DTE por correo y del PDF de factura.
- Checklist estándar del proyecto antes del PR (dark mode, tablet, roles, toasts).

## Decisiones registradas

| Decisión | Elección |
|---|---|
| Agrupación del feedback | A+B juntos → C (variantes) → D (FSE) |
| Autorrelleno de dirección desde proyecto | Parseo best-effort del string `ubicacion`, sin cambios de backend |
| Folio de talonario en factura | Automático (actas despachadas) + manual solo como respaldo |
| Bloqueo FSE para empresas | **Descartado** — se resuelve con la reestructuración FSE (Grupo D) |
