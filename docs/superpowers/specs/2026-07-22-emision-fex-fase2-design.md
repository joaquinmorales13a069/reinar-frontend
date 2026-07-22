# Diseño: Emisión de Factura de Exportación (FEX / DTE 11) — Fase 2

**Fecha:** 2026-07-22
**Estado:** aprobado por el usuario
**Fase previa:** `2026-07-22-clientes-internacionales-design.md` (Fase 1 — el cliente INTERNACIONAL y el bloqueo de FC/CCF; la emisión FEX quedó bloqueada con `FEX_NO_DISPONIBLE`).
**Alcance:** implementar la EMISIÓN de la Factura de Exportación (DTE tipo 11) vía FacturaLlama (`POST /dte/fex`), levantando el bloqueo de Fase 1, más el pendiente rastreado en la review final de Fase 1 (guard NC-contra-FEX + dos defectos latentes en `facturallama.service.ts`).

## Contexto y hallazgos de la exploración

La Fase 1 ya dejó todo el andamiaje del cliente: `Cliente` tiene `tipoPersona`, `codPais` (ISO alpha-2), `tamanoContribuyente`; `TipoDTE`/`TipoDocumentoCotizacion` tienen `FEX`; `TamanoContribuyente` existe; la factura de un cliente internacional nace con `tipoDTE = FEX` y la coherencia receptor↔FEX está validada. La emisión responde 422 `FEX_NO_DISPONIBLE`.

La infraestructura DTE existente que **se reutiliza sin cambios**:

- **El `recipient` FEX mapea 100% desde campos que el cliente ya tiene** — no se necesita ningún dato nuevo de cliente. Lo único nuevo son los datos de exportación **por operación**.
- **El job de polling** `sincronizarEstadosDTEs` (cada 5 min, `src/index.ts`) consulta `estadoDTE: 'PROCESANDO'` de forma genérica → FEX se reconcilia automáticamente. **No hay webhooks**; el modelo es 100% polling.
- **Las descargas oficiales** `descargarPDFOficial`/`descargarJSONOficial` (`GET /dte/{dteId}/download/pdf|json`) y sus wrappers/rutas en facturas son genéricos por `dteId` → sirven para FEX sin cambios.
- **El molde de emisión** `emitirFC` (`facturallama.service.ts`): `findUnique` con `cotizacion.items` + `cliente` → guards → `crypto.randomUUID()` + persistir `{dteId, tipoDTE}` **antes** del request (idempotencia) → construir recipient + payload → `facturaLlamaFetch('/dte/fc', POST)` → `persistirResultadoFactura`. `facturaLlamaFetch` no lanza en 422 (lo trata como RECHAZADO). Config en `env.FACTURALLAMA_{API_KEY,API_VERSION,BASE_URL}`.

**Decisiones del usuario:**
1. Los datos de exportación se capturan **al emitir**, en el detalle de la factura (no al generarla).
2. Recinto y régimen: **default configurable** (régimen `1000.000`; recinto en Ajustes) con override por factura.
3. **Transporte incluido** en esta fase (conductor, documento, placas, modalidad).
4. Los campos de exportación viven como **columnas en `Factura`**.
5. **`exentoIva` forzado** para clientes internacionales (IVA 0% obligatorio en FEX).
6. **Período de renta requerido** para FEX, igual que FC/CCF (la exportación de Reinar es alquiler de maquinaria).

## Catálogos MH (extraídos del Excel oficial V 1.1, verificados)

- **CAT-027 Recinto fiscal:** 48 códigos (`01`..`99`, no contiguos — San Bartolo, Acajutla, zonas francas, couriers, etc.).
- **CAT-028 Régimen:** 90 códigos (`1000.000`..`0000.000`). El de Reinar es casi siempre `1000.000` "Exportación Definitiva, Régimen Común".
- **CAT-031 INCOTERMS:** 11 vigentes → mapean a los nombres del enum FacturaLlama: `EXW, FCA, CPT, CIP, DAP, DPU, DDP, FAS, FOB, CFR, CIF`.
- **Modalidad de transporte (enum FacturaLlama, 7):** `TERRESTRE, MARITIMO, AEREO, TERRESTRE_MARITIMO, TERRESTRE_AEREO, MARITIMO_AEREO, TERRESTRE_MARITIMO_AEREO`. (No es CAT-030 directo; FacturaLlama lo abstrae.)

Extractos limpios de CAT-027/028 guardados durante el brainstorming; se transcriben a los catálogos del código en la implementación. **No se hardcodean como enums** de Prisma — se validan contra Sets, igual que `codPais`/`actividadEconomica`.

## Sección 1 — Modelo de datos (Prisma, `server`)

Columnas nuevas en `Factura` (todas nullable; solo con valor cuando se prepara la emisión FEX):

```prisma
recintoFiscal        String?              // CAT-027
regimenExportacion   String?              // CAT-028
incoterms            String?              // nombre enum FacturaLlama (ej. FOB)
flete                Decimal? @db.Decimal(10, 2)
seguro               Decimal? @db.Decimal(10, 2)
transporteConductor    String?
transporteDocConductor String?
transportePlaca        String?
transporteModalidad    String?            // enum de transporte FacturaLlama
```

`ConfiguracionEmpresa`: `recintoFiscalDefault String?` y `regimenExportacionDefault String?` (este último sembrado a `1000.000`).

Migración aditiva (columnas nullable). Flujo de la BD compartida: `migrate diff` offline + `migrate deploy` (nunca `migrate dev`/`reset`).

**IVA 0% para FEX:** al generar la factura de un cliente internacional, `generarFacturaDesdeCotizacion` fuerza `exentoIva = true` y `montoIva = 0` (subtotal = total), para que los totales mostrados y el DTE (tasa 0) coincidan. La emisión del DTE es independiente del flag (los ítems FEX no llevan `saleType`), pero los totales de la factura deben reflejar la exención.

## Sección 2 — Emisión backend (`server`)

**Catálogos** en `src/lib/` (patrón `sv-geo.ts`): `cat027.ts`, `cat028.ts`, `incoterms.ts`, `transporte-fex.ts` — cada uno con `type`, array `{value,label}` y `Set` de códigos para validación.

**Tipos** (`facturallama.types.ts`): 
- `RecipientFEX`: `name`, `country` (ISO alpha-2), `address` (string ≤300), `contributorType` (`NATURAL|JURIDICA`), `economicActivity`, `identificationDocument`, `email` (requeridos); `commercialName?`, `contributorSize?`, `phone?`. Nota: la `address` del FEX es un **string plano**, no la `AddressPayload {department, municipality, complement}` de FC/CCF.
- `ItemFEXPayload`: `description`, `quantity`, `unitPrice`, `unitMeasure?`, `internalCode?`, `discountAmount?` — **sin `saleType`** (la exportación va a tasa 0).
- `DriverFEX` (`name`, `documentIdentificationNumber`, `transportIdentificationNumber`, `transport`) y `AttachmentFEX` (`code: 'TRANSPORTE'`, `driver`).
- `PayloadFEX`: `id`, `itemType` (`BIENES|SERVICIOS|BIENES_Y_SERVICIOS`), `items`, `recipient`, `generatedAt?`, `paymentType?`, `taxArea?`, `taxRegimen?`, `incoterms?`, `freight?`, `insurance?`, `comments?`, `attachments?`.

**`emitirFEX(facturaId): Promise<void>`** en `facturallama.service.ts`, molde de `emitirFC`:
1. `findUnique` con `cotizacion.items` + `cliente`.
2. Guards: existe (404); `estadoDTE` PENDIENTE/RECHAZADO (reintento); `periodoRentaInicio/Fin` requeridos (422 `PERIODO_RENTA_REQUERIDO`); **datos de exportación presentes** (recinto + régimen; 422 `DATOS_EXPORTACION_REQUERIDOS`); **elegibilidad del cliente** (codPais/tipoPersona/actividadEconomica/documento/email presentes; 422 `CLIENTE_INVALIDO_FEX`).
3. Si RECHAZADO, limpia `dteId/dteControlNumber`, vuelve a PENDIENTE.
4. `crypto.randomUUID()` → persiste `{dteId, tipoDTE:'FEX'}` antes del request.
5. Construye `recipient: RecipientFEX` desde el cliente: `country = cliente.codPais`, `address = cliente.complemento`, `contributorType = cliente.tipoPersona`, `contributorSize = cliente.tamanoContribuyente`, `economicActivity`, `email`, `identificationDocument` (via `buildIdentificationDocument`), `name`/`commercialName`/`phone`.
6. `buildItemsFex(items)` — reusa el cálculo de `unitPrice`/`description` de `buildItems` pero **sin `saleType`**. Deriva `itemType` con `mapearTipoItem` (todos SERVICIOS→`SERVICIOS`, todos BIENES→`BIENES`, mixto→`BIENES_Y_SERVICIOS`).
7. `payload: PayloadFEX` con `taxArea = recintoFiscal`, `taxRegimen = regimenExportacion`, `incoterms`, `freight = flete`, `insurance = seguro`, `comments = buildComments(...)` (período de renta), `attachments` (transporte) si hay datos de transporte, `paymentType`.
8. `facturaLlamaFetch<RespuestaEmisionDTE>('/dte/fex', { method:'POST', body })` → `persistirResultadoFactura`.

**Validación previa (Zod)** antes de llamar a FacturaLlama (función pura testeable): país ISO válido, actividad en CAT-019, recinto en CAT-027, régimen en CAT-028, incoterms válido (si viene), modalidad de transporte válida (si viene), montos ≥ 0. Evita gastar llamadas en DTEs que MH rechazaría.

**Enganche:**
- `facturas.service.emitirDTE`: se **elimina el guard `FEX_NO_DISPONIBLE`** (líneas 275-280) y se agrega `else if (input.tipoDTE === 'FEX') await facturaLlamaService.emitirFEX(id)`. El guard de datos de exportación vive dentro de `emitirFEX`.
- `emitirDTESchema` (`facturas.schemas.ts:58`): `z.enum(['FC','CCF','FEX'])`.
- Nuevo endpoint `PATCH /facturas/:id/datos-exportacion` (controller + service + Zod schema validando contra los catálogos) para guardar recinto/régimen/incoterms/flete/seguro/transporte. Solo editable mientras `estadoDTE` es PENDIENTE/RECHAZADO.
- `pdf.service.ts:416`: agregar `FEX` al mapa de etiquetas legibles.

## Sección 3 — Frontend (`frontend`)

**Catálogos espejo** en `lib/`: `cat027.ts`, `cat028.ts`, `incoterms.ts`, `transporte-fex.ts` con etiquetas en español (paridad exacta con el backend, como `paises.ts`).

**Detalle de factura — tarjeta "Datos de exportación"** (solo `tipoDTE === 'FEX'`): React Hook Form + Zod con selects de recinto (default configurado), régimen (default `1000.000`), incoterms (11), campos de flete y seguro, y sección de transporte (conductor, documento, placas, modalidad). Guarda vía `useGuardarDatosExportacion` → `PATCH /facturas/:id/datos-exportacion`; errores del backend inline con `setError`; `toast.success` al guardar.

**Desbloqueo de emisión:** para una factura FEX, `emisionBloqueada` deja de ser `true` por FEX; la emisión se habilita cuando recinto + régimen están presentes. Si faltan, el botón Emitir queda deshabilitado y guía a completar la tarjeta primero. La emisión reusa el flujo async existente (queda `PROCESANDO`, el polling la resuelve, PDF/JSON/QR oficiales con los botones existentes). `GenerarFacturaModal` no cambia (ya muestra FEX fijo); se retira el aviso "disponible próximamente".

**Ajustes:** campo para configurar el recinto fiscal (y régimen) por defecto en la configuración de empresa.

Tipos/hooks: `DatosExportacion`, `useGuardarDatosExportacion`. `TipoDTEEmitible` gana `FEX` (queda igual a `TipoDTEGenerable`, ambos `'FC'|'CCF'|'FEX'`), y `EmitirDTEDto`/el flujo de emisión del detalle de factura lo aceptan. El cast `factura.tipoDTE as TipoDTEEmitible` del detalle (señalado como Minor en la review de Fase 1) se vuelve seguro para FEX.

## Sección 4 — Errores, fix de NC (pendiente de Fase 1) y testing

**Pendiente de Fase 1 — NC contra FEX** (`facturallama.service.ts` / `notas-credito.service.ts`):
- `emitirNC` guard (`:524`): `if (!tipoDTE || tipoDTE === 'NC')` → agregar `|| tipoDTE === 'FEX'`, con 422 `NC_FEX_NO_SOPORTADA` ("Las notas de crédito sobre facturas de exportación no están disponibles"). La NC contra FEX es futuro (Evento de Retorno 2.0).
- `contributorType` hardcodeado (`:578`): corregir a `cliente.tipoPersona ?? (cliente.tipo === 'EMPRESA' ? 'JURIDICA' : 'NATURAL')`.
- Los `?? ''` de department/municipality en la rama NC quedan inofensivos (la NC-contra-FEX se bloquea antes); se documenta.

**Manejo de errores:** validación previa Zod → 422 inline en el formulario; 422 de FacturaLlama → factura `RECHAZADO` con `dteRespuestaMH` (patrón existente; el operador ve el detalle del rechazo de MH y reintenta tras corregir).

**Testing:**
- Server (vitest, TDD): `emitirFEX` (mock de `fetch`, asertar shape del payload `/dte/fex`, mapeo del recipient desde el cliente, `itemType`, guards de datos de exportación/período/elegibilidad, persistencia `{dteId, tipoDTE:'FEX'}` antes + resultado después); tests de los 4 catálogos (Set + conteos 48/90/11/7); `PATCH /datos-exportacion`; validación previa (función pura); **guard NC-contra-FEX** y fix de `contributorType`. Baseline: 14 fallos pre-existentes, cero nuevos.
- Frontend: `pnpm tsc --noEmit` + `pnpm lint` (baseline 12/25, cero nuevos) + checklist CLAUDE.md (VISUALIZADOR sin escritura, dark mode, tablet 768px).
- Manual E2E: cliente internacional → cotización → factura FEX → completar datos de exportación → emitir → `PROCESANDO`→`APROBADO` por polling → descargar PDF/JSON oficial.

## Fuera de alcance (Fase 3, si surge)

- Evento de Retorno 2.0 (afectar una FEX sin invalidar) y NC/ND contra FEX.
- `itemsNoGrav`, `thirdPartySale`, `branchOffice`, `appendices` del payload FEX.
- Múltiples recintos/regímenes por defecto según punto de salida.
