# Grupo C — Variantes de cotización con el mismo consecutivo

**Fecha:** 2026-07-11
**Estado:** Diseño aprobado
**Repos afectados:** frontend (`Reinar/frontend`) y backend (`Reinar/server`)

## Contexto

Feedback de ventas (julio 2026): en el proceso comercial de REINAR, un cliente puede pedir dos versiones de la misma cotización — una con envío y otra sin envío. Ambas deben llevar el **mismo consecutivo** (ej. `COT260700007`) para no gastar números de la secuencia. Hoy eso es imposible: `numeroCotizacion` es `@unique`, el número siempre sale de `generarNumero()` (incrementa `SecuenciaDocumento`), y no existe duplicar/clonar.

Puntos de partida verificados en el código:

- Todas las relaciones downstream (`Factura.cotizacionId @unique`, `ActaEntrega.cotizacionId`, `DepositoGarantia.cotizacionId @unique`, `ActaRecepcion.cotizacionId`) referencian la cotización **por `id`**, nunca por número.
- Los selectores de facturación y actas solo ofrecen cotizaciones **APROBADA** — si solo una variante puede llegar a APROBADA, los flujos downstream nunca ven duplicados.
- El "envío" no es un concepto estructural: es un ítem `SERVICIO` o `CUSTOM` presente o ausente. La variante es, por tanto, un clon completamente editable.
- La disponibilidad de equipos se calcula solo contra cotizaciones aprobadas — variantes hermanas en ENVIADA no double-cuentan equipos.

## Decisiones aprobadas

| Decisión | Elección |
|---|---|
| Identidad de las variantes | Sufijo interno visible en el sistema; **número limpio (sin sufijo ni etiqueta) en los documentos que ve el cliente** |
| Modelo de datos | El sufijo vive **dentro del string**: `numeroCotizacion = "COT260700007-B"`. Sin migración de constraint ni columnas nuevas |
| Hermanas al aprobar una variante | **Auto-descartar**: pasan a un estado terminal nuevo `DESCARTADA` |
| Desde qué estado se crea una variante | `BORRADOR` o `ENVIADA`; bloqueado si alguna hermana ya está `APROBADA`; la variante nace en `BORRADOR` |

## 1. Modelo de datos y ciclo de vida

### Sufijo dentro del número

- Variante: `numeroCotizacion = "<base>-<letra>"` con letras `B..Z` (el original queda sin sufijo; conceptualmente es la "A").
- El formato base `COTAAMMNNNNN` nunca contiene guiones → el sufijo se extrae sin ambigüedad con la regex `/-([B-Z])$/`.
- Número base: `numero.replace(/-[B-Z]$/, '')`.
- Hermanas de un número: `numeroCotizacion = base` OR `numeroCotizacion startsWith base + "-"`.
- El `@unique` existente sobre `numeroCotizacion` garantiza la unicidad de cada variante. `generarNumero()`/`SecuenciaDocumento` no se tocan.

### Nuevo estado `DESCARTADA`

- Se agrega al enum `EstadoCotizacion` en Prisma. Migración **aditiva** de enum (`ALTER TYPE "EstadoCotizacion" ADD VALUE 'DESCARTADA'`), segura y backward-compatible, aplicada con el workflow offline de la BD compartida (`migrate diff` + `migrate deploy`; nunca `migrate dev`).
- Semántica: "el cliente eligió otra variante de este número". Distinta de `RECHAZADA` (el cliente rechazó la propuesta) para no contaminar reportes.
- Es **terminal**: sin transiciones salientes, y no se llega a él manualmente — solo lo asigna el sistema al aprobar una hermana.

### Ciclo de vida

1. Crear variante: origen en `BORRADOR` o `ENVIADA`, ninguna hermana `APROBADA`. La variante nace en `BORRADOR` (editable como cualquier borrador — típicamente para agregar/quitar el ítem de envío).
2. Las variantes compiten: al aprobar una (`ENVIADA → APROBADA`), las hermanas activas (`BORRADOR`/`ENVIADA`) pasan a `DESCARTADA` dentro de la misma transacción, **antes** de la validación de disponibilidad, con registro en audit log.
3. Solo la ganadora llega a `APROBADA` → facturación, actas y depósito de garantía (todos por `id` y/o filtrados a APROBADA) operan sin ambigüedad.
4. Carrera de aprobación entre dos variantes: la segunda transacción falla limpiamente porque su estado ya es `DESCARTADA` (transición inválida existente).

## 2. Backend (`Reinar/server`)

### Endpoint nuevo: `POST /cotizaciones/:id/variantes`

- Roles: `ADMIN`, `GERENTE`, `OPERADOR` (igual que crear cotización).
- Validaciones (422 con mensaje claro):
  - La cotización origen está en `BORRADOR` o `ENVIADA`.
  - Ninguna hermana del número base está `APROBADA`.
- En transacción:
  1. Buscar hermanas existentes y calcular la **siguiente letra libre** (`B`, `C`, …). Las letras de variantes borradas se reutilizan naturalmente (la búsqueda es sobre filas existentes).
  2. Clonar cabecera: `clienteId`, `proyectoId`, `contactoSolicitanteId`, `contactoFacturacionId`, `fechaVencimiento`, `porcentajeIva`, `exentoIva`, `depositoMonto`, `depositoPorcentaje`, `condicionesPago`, `tipoDocumentoFiscal`, `notas`, `notasInternas`. Totales (`subtotal`, `montoIva`, `total`) copiados tal cual (los ítems son idénticos al momento de clonar).
  3. Clonar todos los ítems con nuevos ids (todos los campos del ítem).
  4. `estado: BORRADOR`, `fechaCreacion` nueva, `fechaEnvio`/`fechaAprobacion` nulas.
- **No** se clona `DepositoGarantia` (se crea al aprobar, como hoy). No se clonan relaciones downstream.
- Carrera de sufijo (dos usuarios simultáneos): el `@unique` dispara P2002 → reintentar con la siguiente letra. Si se agota `Z`: error claro (límite teórico de 25 variantes).
- Crear variante **de una variante** está permitido: hereda el mismo número base (de `COT…007-B` sale `COT…007-C`).

### Cambio en la aprobación (`cambiarEstado` → `APROBADA`)

Al inicio de la transacción de aprobación existente: `updateMany` de hermanas activas (`BORRADOR`/`ENVIADA`, mismo número base, id ≠ el propio) → `DESCARTADA`, con entrada de audit log por cada una. El resto del flujo (validar disponibilidad, crear `DepositoGarantia`, marcar equipos `RENTADO`, sellar `fechaAprobacion`) no cambia.

### Helper `numeroComercial(numero: string): string`

En `server/src/lib/` — quita el sufijo `-[B-Z]` final si existe. Se aplica en **todo documento o comunicación que ve el cliente**:

- PDF de cotización (número mostrado).
- PDF de factura (donde muestra el número de la cotización origen).
- PDF de acta de entrega (donde muestre el número de cotización).
- Correos a clientes (asunto y cuerpo donde aparezca `numeroCotizacion`).

Dashboard, reportes, disponibilidad y demás pantallas internas conservan el número con sufijo — esa es la distinción interna deseada.

### `GET /cotizaciones/:id`

Incluye un campo nuevo `variantes`: hermanas del número base (excluyendo la propia), cada una con `{ id, numeroCotizacion, estado, total }`. Alimenta la tarjeta "Variantes" del detalle.

## 3. Frontend (`Reinar/frontend`)

- **Hook `useCrearVariante`** en `hooks/use-cotizaciones.ts`: `POST /cotizaciones/:id/variantes`, invalida `['cotizaciones']`, `toast.success`, y devuelve la variante creada para redirigir.
- **Botón "Crear variante"** en el detalle de la cotización, junto a las acciones de estado: visible en `BORRADOR`/`ENVIADA`, oculto para `VISUALIZADOR`, deshabilitado con hint si alguna hermana está `APROBADA` (el backend revalida). Al crear: redirección al detalle de la nueva variante.
- **Tarjeta "Variantes"** en el detalle, visible solo si `variantes.length > 0`: cada fila muestra número (con sufijo, `font-mono`), badge de estado y total, y enlaza al detalle de esa variante.
- **`DESCARTADA` en la UI:**
  - `CotizacionStatusBadge`: badge `kind="neutral"` con label "Descartada".
  - Filtro de estados de la tabla: se agrega la opción.
  - Pipeline: mismo tratamiento que `CANCELADA` hoy (sin columna propia).
  - Tipo `EstadoCotizacion` en `types/api.ts` += `'DESCARTADA'`.
- **Nombre del archivo al descargar el PDF**: helper `numeroComercial` (en `lib/utils.ts`) para que el archivo sea `COT260700007.pdf` sin sufijo. Tablas, selectores y detalle no cambian: el sufijo ya viene dentro del string.

## 4. Casos borde y manejo de errores

- **Variante sin hermanas activas al aprobar**: el paso de descarte no encuentra filas; la aprobación sigue normal.
- **Borrar variante en `BORRADOR`**: permitido como cualquier borrador; su letra queda libre y se reutiliza.
- **Editar variante**: solo en `BORRADOR`, reglas existentes sin cambios.
- **Renovaciones de renta** (`actaEntregaOrigenId`): sin interacción — una renovación genera número nuevo por `generarNumero()`, como hoy.
- Errores del backend en el botón "Crear variante": `toast.error` con el mensaje del backend (ej. "Ya existe una variante aprobada de este número").

## 5. Verificación

- **Backend (vitest, TDD):**
  - Crear variante: clona cabecera + ítems completos, asigna `-B` (y `-C` desde una variante), estado BORRADOR, fechas limpias.
  - Rechaza: origen `APROBADA`/`RECHAZADA`/`CANCELADA`/`DESCARTADA`; hermana ya aprobada.
  - Aprobar descarta hermanas activas y no toca hermanas terminales.
  - `numeroComercial`: quita `-B`..`-Z` final, no toca números sin sufijo ni guiones internos inexistentes.
  - Suite completa: los 14 fallos pre-existentes no aumentan.
- **Frontend:** `pnpm tsc --noEmit` limpio; `pnpm lint` en baseline (12 errores / 24 warnings); prueba manual del flujo completo (crear variante desde ENVIADA, editar, enviar, aprobar → hermana descartada, facturar la ganadora, PDF sin sufijo).
- Checklist estándar pre-PR (dark mode, tablet, roles, toasts).

## Fuera de alcance

- Agrupación visual de variantes en la tabla (quedan adyacentes al ordenar por número).
- Etiquetas descriptivas de variante ("con envío") — se usa `notasInternas` si ventas quiere anotarlo.
- Des-descartar una variante o revertir una aprobación.
