# Renovación de renta vinculada al acta de entrega original

**Fecha:** 2026-07-20
**Origen:** feedback de REINAR — al renovar la renta desde un acta de entrega, la factura de la renovación no queda vinculada al acta anterior. El sistema trata la renovación como si fuera una entrega parcial nueva y pide datos de un acta que no corresponde, porque el inventario ya está en obra. Solo debería pedir acta nueva (y su folio) cuando la renovación incluye inventario que no estaba en la cotización original.

## Contexto

El flujo de renovación existe desde el Grupo D (`2026-06-30-grupo-d-renovaciones-renta-design.md`) y hoy funciona así:

- `POST /actas/:id/renovar` → `renovarRenta` (`server/src/modules/actas/actas.service.ts:1107`) crea una `Cotizacion` BORRADOR con `actaEntregaOrigenId` apuntando al acta y clona los `CotizacionItem` rentables (`EQUIPO`, `HERRAMIENTA`, `PIEZA_ANDAMIO`) que siguen en `PENDIENTE_DEVOLUCION`.
- Deliberadamente **no crea acta**: el inventario lo sigue rastreando el acta inicial (comentario en `:1104-1106`).
- Al aprobar, `cotizaciones.service.ts:794-809` salta el gate de disponibilidad para ese inventario, que ya está comprometido.

El vínculo `Cotizacion.actaEntregaOrigen` existe en el schema desde la migración `20260630150000_renovacion_renta`, pero **ningún módulo aguas abajo lo lee**: ni facturas, ni PDF, ni DTE.

### Cadena de fallos actual

`generarFacturaDesdeCotizacion` vincula actas con `updateMany({ where: { cotizacionId, facturaId: null } })` (`facturas.service.ts:574`). La cotización de renovación no tiene actas propias, así que la factura nace con `actasEntrega = []`. De ahí:

1. **`PeriodoFacturaCard`** (`frontend/components/facturas/detalle/PeriodoFacturaCard.tsx:25-27`) pre-carga el período desde `useActasDeFactura(factura.id)` → array vacío → nunca pre-llena. El operador debe tipearlo a mano, y si no lo hace `facturas.service.ts:280` lanza `PERIODO_RENTA_REQUERIDO` y **el DTE queda bloqueado**.
2. **El PDF** (`pdf.service.ts:429-434`) no encuentra folios físicos y cae al fallback `numeroActaFisicoManual`, vacío.
3. **`ActasVinculadasCard`** muestra *"Sin actas — Aún no se han creado actas"* con botón *"Nueva acta"*. Este es literalmente el reclamo de REINAR.
4. Si el operador acepta esa invitación, `listarItemsDisponiblesDespacho` (`actas.service.ts:78`) le ofrece **todos** los ítems de la cotización de renovación, porque el chequeo de exclusividad (`:325-334`) está acotado a `actaEntrega: { cotizacionId }` de *esa* cotización. Resultado: **doble descuento de `StockBodega` y `Consumible.stockActual`/`PiezaTipo.stockActual`** sobre mercadería que nunca volvió a bodega.

### Bug latente relacionado

En la aprobación (`cotizaciones.service.ts:887, 902`) el gate de disponibilidad se salta **por tipo** (`renovPiezas.has(item.piezaTipoId)`, `renovHerr.has(item.herramientaTipoId)`), no por ítem. Si una renovación de crucetas incluye además crucetas nuevas, el ítem nuevo salta el gate y nunca se valida su stock ni se compromete.

## Alcance

- **Incluye:** vínculo factura↔acta original, captura y propagación del período de renta de la renovación, distinción de ítems renovados vs nuevos, caso mixto con dos actas, corrección del gate de disponibilidad por ítem, la cantidad de renovación descontando devoluciones parciales, y —agregado durante la ejecución— el soporte de devolución parcial de piezas de andamio en `registrarRecepcion` (ver Task 2b más abajo).
- **Excluye:** el bug de `crearActa` que no marca `HerramientaUnidad` como `RENTADA` (ver "Fuera de alcance"). Notas de crédito, FSE y retenciones no se tocan.

## Decisiones

1. **El acta de entrega es un registro vivo.** Su `periodoRentaFin` se extiende con cada renovación aprobada. Consultar el acta responde siempre "hasta cuándo está cubierto el inventario que hay en obra". Se acepta conscientemente que el acta deja de ser un documento histórico inmutable y que su PDF puede cambiar después de firmado.

2. **El período nuevo se captura en el modal de renovación**, con default sugerido, no después en la factura. La factura de renovación nace con período, así que el DTE nunca se bloquea por `PERIODO_RENTA_REQUERIDO`.

3. **La extensión del acta ocurre al APROBAR la cotización de renovación**, en el mismo punto donde ya se salta el gate de disponibilidad. Es cuando el compromiso con el cliente se vuelve firme y cuando el inventario queda legítimamente en obra.

4. **Caso mixto permitido con dos actas.** Se puede agregar inventario nuevo a una cotización de renovación. La factura queda vinculada al acta original (cuyo período se extiende) y a un acta nueva que cubre solo los ítems nuevos. El wizard de acta ofrece únicamente los ítems nuevos.

5. **Los ítems renovados se marcan explícitamente** con una FK self-referencial `CotizacionItem.cotizacionItemOrigenId`, en vez de derivarse por comparación de tipos. El matching por tipo es ambiguo justo en el caso que REINAR pidió: renovar 20 crucetas y agregar 10 crucetas nuevas produce dos ítems con el mismo `piezaTipoId` que el sistema no podría distinguir. En andamios ese no es un caso raro.

6. **El vínculo factura↔acta original es derivado**, vía `Factura → Cotizacion.actaEntregaOrigen`. No se re-apunta `ActaEntrega.facturaId`, que le robaría el vínculo a la factura original de la renta inicial. No se agrega tabla join M:N: hoy `renovarRenta` parte siempre de un único acta porque el botón vive en el detalle del acta.

## Diseño

### Modelo de datos

Cuatro columnas nuevas, ninguna tabla:

```prisma
model Cotizacion {
  // Período pactado en la renovación. Lo llena el flujo de renovar (donde no hay
  // acta nueva que lo capture); en cotizaciones normales queda null y el acta
  // sigue siendo la fuente del período.
  periodoRentaInicio DateTime?
  periodoRentaFin    DateTime?
}

model CotizacionItem {
  // Renovación: el ítem de la cotización anterior que este clon renueva.
  // null = inventario nuevo, requiere despacho y acta propia.
  cotizacionItemOrigenId String?
  cotizacionItemOrigen   CotizacionItem?  @relation("renovacionItem", fields: [cotizacionItemOrigenId], references: [id])
  renovacionesItem       CotizacionItem[] @relation("renovacionItem")

  @@index([cotizacionItemOrigenId])
}

model ActaEntrega {
  // Fin del período tal como se entregó y firmó. Se congela la primera vez que
  // una renovación extiende el acta, para poder recalcular si esa renovación
  // se anula después.
  periodoRentaFinOriginal DateTime?
}
```

`periodoRentaFinOriginal` es consecuencia directa de la decisión 1: si se extiende `periodoRentaFin` in-place sin conservar el valor de entrega, al anular una renovación no hay forma de saber a cuánto volver.

### Flujo del período de renta

```
RenovarRentaModal (desde/hasta, pre-llenado)
        ↓
Cotizacion.periodoRentaInicio/Fin
        ↓  al APROBAR
ActaEntrega.periodoRentaFin = max(actual, renovación)   ← nunca se acorta
   (+ periodoRentaFinOriginal congelado la primera vez)
        ↓  al FACTURAR
Factura.periodoRentaInicio/Fin  ← copiado, ya no queda vacío
        ↓
buildComments() → DTE
```

**Default sugerido en el modal:** `inicio` = `periodoRentaFin` del acta + 1 día, o la fecha de hoy si el acta no tiene fin o si ese fin ya pasó. `fin` = `inicio + duración − 1`, donde la duración es el máximo entre los ítems seleccionados según el `periodo` de cada uno:

| `PeriodoItem` | Duración en días |
|---|---|
| `DIA`, `CUSTOM` | `cantidadDias` |
| `SEMANA` | 7 |
| `QUINCENA` | 15 |
| `MES` | 30 |

Esta tabla refleja `calcularSubtotal` (`cotizaciones.service.ts:35-45`), donde `cantidadDias` solo multiplica el precio en `DIA` y `CUSTOM`; `SEMANA`/`QUINCENA`/`MES` son bloques planos. Ambas fechas son editables.

### Backend — `server/src/modules/cotizaciones/cotizaciones.service.ts`

- `crearCotizacion` (`:165`): acepta `periodoRentaInicio` y `periodoRentaFin` opcionales.
- `agregarItem` (`:425`): acepta `cotizacionItemOrigenId` opcional.
- `crearVariante` (`:277`): hoy propaga `actaEntregaOrigenId`; debe propagar además `periodoRenta*` y el `cotizacionItemOrigenId` de cada ítem clonado. Sin esto, la variante de una renovación pierde la marca y vuelve a comportarse como entrega nueva.
- **Aprobación (`:788-940`):** los sets `renovEquipos`/`renovHerr`/`renovPiezas` y las consultas de `actaEntregaItem` de `:800-808` se eliminan, reemplazados por el chequeo directo `item.cotizacionItemOrigenId != null`. Un ítem renovado salta el gate y no se re-marca `RENTADO`; un ítem nuevo pasa por la validación completa aunque comparta tipo con uno renovado.
- En la misma transacción, si `cotizacion.actaEntregaOrigenId != null` y hay `periodoRentaFin`: congelar `ActaEntrega.periodoRentaFinOriginal` si está en `null`, y aplicar `periodoRentaFin = max(periodoRentaFin actual, cotizacion.periodoRentaFin)`. **`ActaEntrega.periodoRentaInicio` no se toca nunca**: marca cuándo empezó la renta del inventario que hay en obra, y eso no cambia al renovar.
- `actualizarItem` (`:563+`): rechazar con `422 CANTIDAD_EXCEDE_ORIGEN` si un ítem con `cotizacionItemOrigenId != null` intenta superar la `cantidadUnidades` de su ítem origen (ver "Casos límite").

### Backend — `server/src/modules/actas/actas.service.ts`

- `renovarRenta` (`:1107`): recibe `periodoRentaInicio` y `periodoRentaFin` en el body, los pasa a `crearCotizacion`, y setea `cotizacionItemOrigenId` en cada llamada a `agregarItem`. La cantidad clonada descuenta devoluciones parciales (ver "Casos límite").
- `listarItemsDisponiblesDespacho` (`:40`): excluye ítems con `cotizacionItemOrigenId != null`. Este es el fix directo del doble descuento de stock — el wizard de acta pasa a ofrecer solo inventario nuevo.
- `crearActa` (`:265`): guard defensivo `422 ITEM_YA_EN_OBRA` si algún `cotizacionItemId` recibido tiene `cotizacionItemOrigenId != null`. La UI no debería ofrecerlos, pero la API no puede confiar en la UI.
- `obtenerActa` (`:573`): expone `periodoRentaFinOriginal`, agrega `cotizacionItem: { periodo, cantidadDias }` al select de `items` (lo necesita el modal para el default), y enriquece `renovaciones` con el período de cada una.
- `renovarRentaSchema` (`actas.schemas.ts:205`): suma `periodoRentaInicio` y `periodoRentaFin` como fechas requeridas, con validación `inicio <= fin`.

### Backend — `server/src/modules/facturas/facturas.service.ts`

- `generarFacturaDesdeCotizacion` (`:461`): copia `cotizacion.periodoRentaInicio/Fin` → `factura.periodoRentaInicio/Fin`. Este cambio solo ya destraba la emisión del DTE.
- `obtenerFactura` (`:100`): incluye `cotizacion.actaEntregaOrigen` con `numeroActa`, `numeroActaFisico`, `estado` y `fechaEntrega`; y agrega `numeroActaFisico` al select de `actasEntrega` (`:115`), que hoy no lo trae.
- Advertencia QUEDAN (`:543-556`): hoy `actas.length === 0` dispara el warning. Para una renovación sin ítems nuevos, cero actas propias es el estado correcto — se exceptúa cuando `cotizacion.actaEntregaOrigenId != null`.
- Anulación de una cotización de renovación aprobada: recalcular `ActaEntrega.periodoRentaFin = max(periodoRentaFinOriginal, max(periodoRentaFin de las renovaciones que sigan APROBADAS))`. Es el único punto donde el acta se acorta.

### Backend — `server/src/modules/pdf/pdf.service.ts`

- `numerosActa` (`:429-434`): la lista de folios pasa a ser `[folio del acta origen si la cotización es renovación, ...folios de actas propias]`, deduplicada, conservando el fallback a `numeroActaFisicoManual` para cuando no hay ninguno. El PDF de una renovación pura muestra el folio físico del acta original, que es el documento que realmente respalda la mercadería en obra.

### Frontend

**`components/actas/RenovarRentaModal.tsx`** — dos campos de fecha (desde/hasta) debajo de la selección de ítems, pre-llenados con el default calculado a partir de `acta.periodoRentaFin` y del `periodo`/`cantidadDias` de los `cotizacionItem` de los ítems seleccionados. El default se recalcula cuando cambia la selección, salvo que el usuario ya haya editado las fechas a mano. El subtítulo pasa a: *"Se creará una cotización vinculada a esta acta. El inventario ya entregado no requiere acta nueva."*

**`components/facturas/detalle/ActasVinculadasCard.tsx`** — el cambio de UX central, porque es la card que produce el reclamo. Para una factura de renovación muestra el acta origen etiquetada **«Renovada»** (con `numeroActa`, folio físico y fecha de entrega, linkeada a `/actas/:id`), y las actas propias, si las hay, etiquetadas **«Nueva entrega»**. El botón *"Nueva acta"* deja de aparecer siempre: solo se renderiza si `items-disponibles-despacho` de la cotización devuelve al menos un ítem. Cuando no hay ninguno, en su lugar va una línea explicativa: *"Esta renovación no requiere acta nueva — el inventario sigue en obra bajo el acta ACT-xxx."*

**`app/(dashboard)/facturas/[id]/page.tsx`** — badge «Renovación» junto al número de factura, linkeado al acta origen. Hoy una factura de renovación es visualmente indistinguible de una normal.

**`components/facturas/detalle/PeriodoFacturaCard.tsx`** — el período llega lleno desde la cotización, así que el seeding desde el acta (`:37-48`) queda solo para el flujo normal. Cuando la factura es renovación, nota de origen: *"Heredado de la renovación · extiende el acta ACT-xxx"*.

**`app/(dashboard)/actas/[id]/page.tsx`** — cuando `periodoRentaFinOriginal != null`, el card de período muestra ambos valores: *"Entregado hasta 15 jun. 2026 · vigente hasta 15 ago. 2026"*. La card "Renovaciones" (`:113-125`) suma el período de cada renovación a lo que ya lista.

**Wizard de cotización** (`/cotizaciones/[id]/editar?paso=1`) — los ítems con `cotizacionItemOrigenId != null` llevan un chip «Renovado» y no muestran selector de bodega. Al intentar subir la cantidad por encima del origen, el error 422 del backend se muestra inline: *"Para sumar unidades, agregá un ítem nuevo."*

**`types/api.ts`** — `periodoRentaInicio`/`periodoRentaFin` en `Cotizacion`, `cotizacionItemOrigenId` en `CotizacionItem`, `periodoRentaFinOriginal` en `Acta`, y `actaEntregaOrigen` en `Factura`.

## Casos límite

**Renovar una renovación.** `renovarRenta` siempre parte del acta y clona desde los `CotizacionItem` de la cotización original, así que `cotizacionItemOrigenId` apunta siempre a esos ítems. La cadena queda plana, no recursiva, y la enésima renovación funciona igual que la primera.

**Devolución parcial antes de renovar.** `renovarRenta` clona `cantidadUnidades` del `CotizacionItem` original sin descontar lo ya devuelto. Si el cliente devolvió 5 de 20 crucetas y después renueva, el sistema renueva 20 y **sobre-factura**. La cantidad correcta es `cantidadRecibida − Σ cantidadDevuelta` de los `ActaRecepcionItem` asociados a cada `ActaEntregaItem`. Se corrige en este trabajo porque toca dinero del cliente y el flujo de renovación es donde se manifiesta. Si la cantidad resultante es 0, el ítem no se clona.

> **Corrección durante la ejecución (Task 2b).** Este spec asumía que las devoluciones parciales de piezas ya se acumulaban en `ActaRecepcionItem.cantidadDevuelta`. Es falso: eso **solo vale para consumibles**. `registrarRecepcion` manda toda recepción de piezas a la rama `{ devuelta: null, cerrarItem: true }` (`actas.service.ts:924-926`), que cierra el ítem completo y restaura **toda** `cantidadRecibida` al stock (`:989-998`). Devolver 5 de 20 crucetas infla el inventario en 15 piezas que siguen en obra — un bug preexistente, independiente de las renovaciones. Sin arreglarlo, el descuento por devolución parcial de este spec es inalcanzable para andamios. Se amplió el alcance con la Task 2b para que las piezas admitan devolución parcial acumulativa igual que los consumibles.

**Aumentar la cantidad de un ítem renovado.** Si el operador sube `cantidadUnidades` de un ítem renovado de 20 a 30, esas 10 extras son inventario nuevo pero viven dentro de un ítem marcado como renovado, así que nunca se despacharían. Un ítem renovado no puede superar la cantidad de su ítem origen: `422 CANTIDAD_EXCEDE_ORIGEN`. Para sumar unidades hay que agregar un ítem nuevo, que sí pasa por el gate de disponibilidad y por el acta.

**Período del acta nueva en el caso mixto.** El wizard `/actas/nueva` pide período de renta propio. Cuando la cotización tiene `periodoRenta*` (siempre, si es renovación), los campos se pre-llenan con ese período y quedan editables — el inventario nuevo se despacha para cubrir el mismo lapso que la renovación. La factura conserva un único período, el de la cotización, que cubre ambas actas.

**Acta totalmente devuelta.** Ya bloqueado en `actas.service.ts:1120` (solo `ENTREGADO` o `DEVUELTA_PARCIAL`). Sin cambios.

**Anular la factura de una renovación.** No revierte el acta, porque la extensión ocurre al aprobar la cotización, no al facturar. Solo anular o descartar la cotización de renovación dispara el recálculo.

## Migración de datos

Las renovaciones ya creadas en producción tienen `actaEntregaOrigenId` pero sus ítems no tienen `cotizacionItemOrigenId`. El backfill los marca por matching de tipo (`equipoId`/`herramientaTipoId`/`piezaTipoId`) contra los `ActaEntregaItem` del acta origen — el enfoque derivado que se descartó para el diseño general, pero seguro acá: esas cotizaciones no pudieron tener ítems mixtos, porque hasta ahora el sistema no permitía distinguirlos.

`Cotizacion.periodoRenta*` y `ActaEntrega.periodoRentaFinOriginal` quedan en `null` para los registros históricos, que es el valor correcto: no hubo período pactado ni extensión previa.

La BD es remota y compartida, así que `prisma migrate dev` se cuelga. El SQL se genera con `prisma migrate diff` offline y se aplica con `prisma migrate deploy`.

## Errores nuevos

| Código | Dónde | Cuándo |
|---|---|---|
| `422 ITEM_YA_EN_OBRA` | `crearActa` | Se intenta despachar un ítem con `cotizacionItemOrigenId != null` |
| `422 CANTIDAD_EXCEDE_ORIGEN` | `actualizarItem` | Un ítem renovado supera la cantidad de su ítem origen |

El `422 PERIODO_RENTA_REQUERIDO` existente (`facturas.service.ts:280`, `facturallama.service.ts:264, 350`) se mantiene como red de seguridad, aunque las renovaciones ya no deberían llegar a dispararlo.

## Fuera de alcance

`crearActa` no marca `HerramientaUnidad` como `RENTADA`, pese a que el comentario en `actas.service.ts:341-342` afirma que sí lo hace — no hay ningún `herramientaUnidad.update` en la función. Eso permite despachar dos veces la misma unidad física. Es un bug independiente del flujo de renovaciones; va en ticket aparte para no mezclar alcances.

## Verificación

- `pnpm tsc --noEmit` en `server/` y en `frontend/`.
- `pnpm vitest` y `pnpm lint` en `server/`. Existe un baseline conocido de **14 fallos de vitest y 12 de 25 archivos con lint** pre-existentes; el criterio de éxito es cero fallos *nuevos*, no cero fallos. El baseline se re-mide antes de tocar código para confirmar que sigue vigente.

Tests nuevos en `server/tests/`:

1. `renovarRenta` persiste `periodoRenta*` en la cotización y `cotizacionItemOrigenId` en cada ítem clonado.
2. `renovarRenta` descuenta devoluciones parciales al calcular la cantidad, y omite ítems cuya cantidad resultante es 0.
3. `listarItemsDisponiblesDespacho` excluye ítems renovados y devuelve solo los nuevos en una cotización mixta.
4. Aprobar una renovación extiende `ActaEntrega.periodoRentaFin` y congela `periodoRentaFinOriginal` solo la primera vez.
5. Caso mixto: un ítem nuevo del mismo `piezaTipo` que uno renovado sí pasa por el gate de disponibilidad y se compromete.
6. `crearActa` rechaza con `ITEM_YA_EN_OBRA` un ítem renovado.
7. Anular una renovación aprobada recalcula el `periodoRentaFin` del acta al máximo entre el original y las renovaciones vigentes.
8. `generarFacturaDesdeCotizacion` copia el período de la cotización a la factura.

Verificación manual del flujo completo: renovar desde un acta entregada → aprobar → facturar → confirmar que el DTE se emite sin pedir período, que el PDF muestra el folio del acta original, y que la card de actas de la factura no ofrece crear acta nueva.
