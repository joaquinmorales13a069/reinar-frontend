# Diseño: Clientes Internacionales (Fase 1 de FEX)

**Fecha:** 2026-07-22
**Estado:** aprobado por el usuario
**Alcance:** Fase 1 de 2. Esta fase crea el tipo de cliente INTERNACIONAL de punta a punta (BD + API + UI) y bloquea la emisión FC/CCF para estos clientes. La **Fase 2** (emisión de Factura de Exportación — DTE 11 vía `POST /dte/fex` de FacturaLlama, con recinto fiscal CAT-027, régimen CAT-028, incoterms, flete/seguro por operación) tendrá su propio spec.

## Contexto

Reinar necesita registrar clientes domiciliados fuera de El Salvador (o en zona franca/DPA) a los que solo se les puede emitir **Factura de Exportación (FEX, DTE tipo 11)**. El formulario de alta debe capturar exactamente los datos que FacturaLlama exige para el `recipient` de `/dte/fex` (verificado contra la doc oficial el 2026-07-22):

| Campo FacturaLlama | Obligatorio | Restricción |
|---|---|---|
| `name` | Sí | ≤250 |
| `country` | Sí | **ISO 3166-1 alpha-2** (ej. `US`, `GT`, `HN`) |
| `address` | Sí | texto libre ≤300 (NO la estructura depto/municipio de FC/CCF) |
| `contributorType` | Sí | `NATURAL` \| `JURIDICA` |
| `economicActivity` | Sí | código CAT-019 |
| `identificationDocument` | Sí | `{ type: NIT\|DUI\|PASAPORTE\|CARNET_RESIDENTE\|OTRO, number }` |
| `email` | Sí | email válido ≤100 |
| `commercialName` | No | ≤150 |
| `contributorSize` | No | `GRANDE` \| `MEDIANO` \| `OTROS` |
| `phone` | No | 8–25 caracteres |

**Decisiones del usuario:**
1. Dos fases; esta es la fase 1 (cliente internacional completo).
2. Mientras no exista FEX: se pueden operar cotizaciones y facturas de clientes internacionales, pero la emisión de DTE queda bloqueada con mensaje claro. FC/CCF nunca se ofrecen.
3. La naturaleza del cliente se captura con sub-selector Natural/Jurídica que alterna los campos de nombre (patrón visual existente Empresa/Particular).
4. Los campos requeridos por FEX son **obligatorios al crear** el cliente. El selector de país usa estrictamente ISO 3166-1 alpha-2.
5. Modelado: **Enfoque A** — tercer valor `INTERNACIONAL` en el enum `TipoCliente` + campos nuevos nullable en `Cliente`.

## Sección 1 — Modelo de datos (Prisma, repo `server`)

### Enums

```prisma
enum TipoCliente { EMPRESA PARTICULAR INTERNACIONAL }   // + INTERNACIONAL

// Nuevos (convención de naming: TipoDocumentoCliente)
enum TipoPersonaCliente { NATURAL JURIDICA }
enum TamanoContribuyente { GRANDE MEDIANO OTROS }

enum TipoDTE { FC CCF NC SUJETO_EXCLUIDO FEX }          // + FEX
enum TipoDocumentoCotizacion { CF CCF SUJETO_EXCLUIDO FEX }  // + FEX
```

`FEX` se agrega ya en fase 1 para etiquetar cotizaciones/facturas de clientes internacionales; la emisión llega en fase 2. No se reutiliza `TipoPersonaProveedor` para no acoplar clientes al naming de proveedores.

### Campos de `Cliente`

Nuevos (nullable; solo con valor cuando `tipo = INTERNACIONAL`):

- `tipoPersona TipoPersonaCliente?` → `contributorType`
- `codPais String?` → ISO 3166-1 alpha-2 → `recipient.country`
- `tamanoContribuyente TamanoContribuyente?` → `contributorSize`

Relajados: `departamento String?` y `municipio String?` (antes `String` NOT NULL). Siguen siendo obligatorios vía Zod para EMPRESA/PARTICULAR — ningún cliente nacional puede quedar sin ellos.

Reutilizados sin cambios:

- `complemento` (se mantiene NOT NULL): para INTERNACIONAL almacena la **dirección extranjera completa** (texto libre, máx. 300 = límite de `recipient.address`).
- `tipoDocumento` + `numeroDocumento`: se permiten los 5 tipos (un receptor de zona franca puede tener NIT salvadoreño). Regex de formato existentes aplican.
- `actividadEconomica` (CAT-019), `email`, `telefono`, `razonSocial`/`nombreComercial` (jurídica), `nombre`/`apellido` (natural).

### Migración

Flujo documentado del proyecto: `prisma migrate diff` offline + `migrate deploy` (la BD remota compartida cuelga `migrate dev`). Cambios aditivos (valores de enum, columnas nuevas) + relajación de NOT NULL en `departamento`/`municipio`: sin riesgo para filas existentes.

## Sección 2 — Backend API (repo `server`)

### `clientes.schemas.ts` — tercera rama de la discriminated union

```
tipo: 'INTERNACIONAL'
tipoPersona: obligatorio (NATURAL | JURIDICA)
  NATURAL  → nombre obligatorio, apellido opcional
  JURIDICA → razonSocial obligatoria, nombreComercial opcional
codPais: obligatorio, validado contra Set ISO alpha-2 (nuevo server/src/lib/paises.ts)
complemento: obligatorio, máx. 300 (dirección extranjera)
actividadEconomica: obligatoria, validada contra CAT019_CODIGOS
tipoDocumento + numeroDocumento: obligatorios (los 5 tipos, regex existentes)
email: obligatorio (formato email)
telefono: opcional; si viene, 8–25 caracteres (límite FacturaLlama)
tamanoContribuyente: opcional (GRANDE | MEDIANO | OTROS)
notas: opcional
```

No aceptados en esta rama: `departamento`/`municipio`/`distrito`, `ncr` (un no domiciliado no tiene NRC), `manejaQuedan`/`diasRecepcionQuedan` (práctica local; quedan en default `false`/`[]`).

`filtrosClientesSchema` usa `z.nativeEnum(TipoCliente)` → el filtro por INTERNACIONAL funciona sin cambios. `clientes.service.ts` persiste los campos nuevos y limpia los no aplicables al cambiar de tipo.

### Bloqueo FC/CCF (regla "solo FEX") — tres puntos

1. **Cotizaciones:** si el cliente es INTERNACIONAL, `tipoDocumentoFiscal` se auto-asigna a `FEX`; recibir `CF`/`CCF` → 422.
2. **`facturas.generarFactura`:** si el cliente (o el receptor tercero `receptorClienteId`) es INTERNACIONAL, `tipoDTE` se fuerza a `FEX`; recibir `FC`/`CCF` → 422.
3. **`facturas.emitirDTE`:** el schema sigue aceptando solo `FC | CCF`; adicionalmente, si la factura tiene `tipoDTE = FEX` o su cliente es INTERNACIONAL → 422 `FEX_NO_DISPONIBLE` ("La emisión de Factura de Exportación estará disponible próximamente"). La factura opera normal (pagos, actas, PDF interno) sin DTE.

`facturallama.service.ts` / `facturallama.types.ts` **no se tocan** en fase 1.

## Sección 3 — Frontend (repo `frontend`)

### Catálogo de países — nuevo `lib/paises.ts`

`PAISES: { value; label }[]` con los códigos ISO 3166-1 alpha-2 y nombre en español, ordenados por label; `PAISES_CODIGOS: Set<string>`; `resolverPais(code)` (patrón de `sv-geo.ts`). `SV` se incluye (caso zona franca/DPA). Espejo en `server/src/lib/paises.ts` para validación backend.

### `ClienteForm.tsx`

- Toggle de tipo: 2 → 3 pills (Empresa / Particular / **Internacional**).
- Internacional muestra sub-selector **Natural / Jurídica** (`tipoPersona`): Natural → nombre* + apellido; Jurídica → razón social* + nombre comercial.
- Campos comunes de Internacional: **País*** (select con búsqueda sobre `PAISES`), **Dirección*** (textarea → `complemento`, máx. 300), **Sector + Actividad económica*** (par de selects CAT-019 que hoy solo ve EMPRESA; aquí obligatorio), **Tipo y número de documento***, **Email***, teléfono, **Tamaño de contribuyente** (opcional), notas.
- Ocultos: departamento/municipio/distrito, NCR, sección QUEDAN.
- El `superRefine` del form replica las reglas del backend para errores inline.

### Tipos y hooks

`types/api.ts`: `Cliente.tipo` gana `'INTERNACIONAL'`; nuevos `tipoPersona?`, `codPais?`, `tamanoContribuyente?`; `departamento`/`municipio` pasan a opcionales. `use-clientes.ts` y `ClientesList`: filtro `tipo` gana la opción Internacional.

### Listado, detalle y flujo de ventas

- `ClientesList.tsx`: chip de filtro + badge para Internacional.
- `ClienteDetalle.tsx`: muestra país (via `resolverPais`), tipo de persona y documento en lugar de la dirección SV.
- `GenerarFacturaModal.tsx`: si el cliente (o receptor tercero) es INTERNACIONAL, el select FC/CCF se reemplaza por aviso fijo "Cliente internacional — requiere Factura de Exportación (FEX), disponible próximamente"; la factura se genera con `tipoDTE: 'FEX'`.
- Detalle de factura: si `tipoDTE === 'FEX'`, botón "Emitir DTE" deshabilitado con el mismo mensaje (patrón `emisionBloqueada` de SUJETO_EXCLUIDO histórico).
- Cotizaciones: para cliente internacional, `tipoDocumentoFiscal` se muestra fijo en `FEX` (solo lectura).

## Sección 4 — Errores y verificación

**Errores:** validación de formulario inline con `setError`; los 422 del backend (`FEX_NO_DISPONIBLE`, país inválido, CAT-019 inválido) inline en el form o `toast.error` en flujos de factura. Sin toasts para errores de validación (convención del proyecto).

**Verificación:**

- Server: `pnpm tsc --noEmit` + vitest (baseline: 14 fallos pre-existentes; éxito = cero nuevos) + tests nuevos: rama INTERNACIONAL del schema Zod (obligatoriedad, país inválido, natural vs jurídica) y bloqueos FC/CCF en cotizaciones/facturas.
- Frontend: `pnpm tsc --noEmit` + `pnpm lint` (baseline: 12/25 pre-existentes; cero nuevos) + checklist CLAUDE.md (VISUALIZADOR sin botones de escritura, dark mode, tablet 768px).
- Manual: crear cliente internacional Natural y Jurídica; verificar bloqueo de emisión DTE en una factura suya; verificar que EMPRESA/PARTICULAR siguen intactos.

## Fuera de alcance (Fase 2)

- Emisión FEX (`emitirFex` en `facturallama.service`, payload `/dte/fex`, polling de estado, PDF oficial).
- Campos por operación: `taxArea` (CAT-027), `taxRegimen` (CAT-028), `incoterms`, `freight`, `insurance`, `attachments` de transporte, `itemType`.
- Catálogos CAT-027/CAT-028 (consultar apéndices de FacturaLlama, no hardcodear).
- Preguntas abiertas con Flora (versión `X-API-Version`, webhook vs polling, lote de pruebas MH).
- **Nota de crédito contra una FEX** (detectado en la review whole-branch de fase 1): hoy `emitirNC`/`notas-credito.emitirDTE` no tienen guard FEX/INTERNACIONAL, pero el path es **inalcanzable en fase 1** (la NC exige la factura original en `estadoDTE = APROBADO`, estado que una FEX nunca alcanza porque su emisión está bloqueada). Cuando la fase 2 habilite la emisión FEX, este path se vuelve alcanzable y afloran dos defectos latentes a corregir junto con la emisión: (a) el guard de `tipoDTE` en `facturallama.service.ts` (`!tipoDTE || tipoDTE === 'NC'`) no rechaza `FEX`, así que una FEX se colaría y se castearía mal a `'FC'|'CCF'`; (b) `contributorType` se hardcodea `EMPRESA ? 'JURIDICA' : 'NATURAL'`, mal para un receptor INTERNACIONAL (usar `Cliente.tipoPersona`). Agregar en fase 2 un guard explícito "NC contra FEX" con su test.
