# Cliente: tipo de documento de identidad multi-tipo

**Fecha:** 2026-05-28
**Branches:**
- `server`: `feat/clientes-tipo-documento`
- `frontend`: `feat/clientes-tipo-documento`

## Contexto

Hoy un Cliente PARTICULAR solo puede guardarse con DUI, NIT y NCR. En el mundo real, una persona natural tributaria en El Salvador puede identificarse con cualquiera de estos documentos:

- **DUI** (salvadoreño, mayor de edad, regla MH 15-ene-2026: DUI = NIT)
- **NIT** 14 dígitos (extranjero contribuyente, persona con NIT legacy previo a 2026)
- **PASAPORTE** (extranjero no residente)
- **CARNET_RESIDENTE** (extranjero residente)
- **OTRO** (casos excepcionales)

El backend ya tipa estos cinco valores en `IdentificationDocumentPayload` (FacturaLlama), pero el modelo de `Cliente` solo refleja DUI/NIT/NCR, y `emitirFC()` hardcodea `type: 'DUI'`. El formulario PARTICULAR del frontend usa un input fijo "DUI" con un toggle frágil "Tiene NIT distinto al DUI".

Adicionalmente, la doc de FacturaLlama para FC permite enviar `nrc` cuando `identificationDocument.type === 'NIT'` — capacidad que hoy no usamos.

## Objetivo

Permitir registrar un Cliente con uno de los cinco tipos de documento y enviar el documento + NRC correctamente al emitir DTE (FC, CCF, FSE, NC), respetando las restricciones del MH El Salvador.

## Reglas MH a respetar

- **CCF**: el receptor debe identificarse con DUI o NIT; NRC obligatorio. Cualquier otro tipo de documento bloquea CCF.
- **FC**: cualquier tipo o ninguno. NRC opcional pero solo válido cuando `type === 'NIT'`.
- **FSE**: cualquier tipo (obligatorio).
- **NC**: hereda las reglas del DTE original (CCF → DUI/NIT + NRC; FC/FSE → flexible).
- **Validación de formato FacturaLlama**: `type=DUI` ⇒ number = 9 dígitos; `type=NIT` ⇒ number = 14 dígitos. No se puede declarar un 9-dígitos como NIT aunque MH diga "DUI = NIT".

## Diseño

### 1. Modelo de datos (Prisma)

#### Nuevo enum

```prisma
enum TipoDocumentoCliente {
  DUI
  NIT
  PASAPORTE
  CARNET_RESIDENTE
  OTRO
}
```

#### Cambios en `model Cliente`

- **Eliminar** las columnas `dui` y `nit`
- **Agregar** `tipoDocumento TipoDocumentoCliente?` y `numeroDocumento String?`
- **Mantener** `ncr String? @unique`
- **Reemplazar** los `@unique` individuales por uno compuesto: `@@unique([tipoDocumento, numeroDocumento])`

#### Migración de datos legacy

Para cada Cliente existente:

| Estado actual | Tras migración |
|---|---|
| `dui` poblado, `nit` NULL | `tipoDocumento=DUI`, `numeroDocumento=<dui>` |
| `dui` NULL, `nit` poblado | `tipoDocumento=NIT`, `numeroDocumento=<nit>` |
| `dui` poblado, `nit` poblado, distintos | `tipoDocumento=NIT`, `numeroDocumento=<nit>` (priorizar NIT 14d, DUI se descarta) |
| `dui` poblado, `nit` = `dui` | `tipoDocumento=DUI`, `numeroDocumento=<dui>` |
| Ambos NULL | `tipoDocumento=NULL`, `numeroDocumento=NULL` |

La migración Prisma incluye SQL custom: ALTER ADD COLUMN → UPDATE de migración → ALTER DROP COLUMN → CREATE UNIQUE INDEX.

#### Restricciones por tipo de Cliente

- `EMPRESA`: `tipoDocumento ∈ {NIT, DUI}` (default NIT)
- `PARTICULAR`: `tipoDocumento ∈ {NIT, DUI, PASAPORTE, CARNET_RESIDENTE, OTRO}` (sin default)

### 2. Validación de formato por tipo

| Tipo | Regex | Longitud (solo dígitos) |
|---|---|---|
| `DUI` | `^\d{8}-\d$` | 9 |
| `NIT` | `^\d{4}-\d{6}-\d{3}-\d$` | 14 |
| `PASAPORTE` | `^[A-Z0-9]{5,20}$` | 5–20 alfanum |
| `CARNET_RESIDENTE` | `^[A-Z0-9-]{5,20}$` | 5–20 |
| `OTRO` | `^.{2,25}$` | 2–25 chars libres |

### 3. Backend: emisión DTE

#### `facturallama.types.ts`

Agregar a `RecipientFC`:
```typescript
nrc?: string                  // Solo válido si identificationDocument.type === 'NIT'
economicActivity?: string     // Opcional según doc FC
```

#### Helper único en `facturallama.service.ts`

```typescript
function buildIdentificationDocument(cliente: Cliente): IdentificationDocumentPayload | undefined {
  if (!cliente.tipoDocumento || !cliente.numeroDocumento) return undefined;
  return { type: cliente.tipoDocumento, number: soloDigitos(cliente.numeroDocumento) };
}
```

#### Comportamiento por DTE

| DTE | identificationDocument | NRC en payload | Validación previa |
|---|---|---|---|
| FC | Si cliente tiene doc → incluir; si no → omitir | Si type=NIT y `ncr` poblado | Ninguna |
| CCF | Obligatorio (DUI o NIT) | Obligatorio | 422 si `tipoDocumento ∉ {DUI,NIT}` o `ncr` vacío |
| FSE | Obligatorio (cualquiera de los 5) | No aplica | 422 si cliente sin documento |
| NC (sobre CCF) | DUI o NIT | Sí | Hereda CCF |
| NC (sobre FC/FSE) | Si tiene → incluir | No | Ninguna |

### 4. Backend: schemas Zod

`server/src/modules/clientes/clientes.schemas.ts`:

```typescript
const tipoDocumentoSchema = z.enum(['DUI', 'NIT', 'PASAPORTE', 'CARNET_RESIDENTE', 'OTRO']);

const camposCompartidos = {
  // ...existentes (dirección, contacto, etc.)
  tipoDocumento: z.preprocess((v) => (v === '' ? undefined : v), tipoDocumentoSchema.optional()),
  numeroDocumento: optionalUniqueStr,
};

const empresaFields = {
  tipo: z.literal('EMPRESA'),
  razonSocial: z.string().min(1, 'La razón social es requerida'),
  ncr: optionalUniqueStr,
  nombreComercial: z.string().optional(),
  sector: z.string().optional(),
  ...camposCompartidos,
};

const particularFields = {
  tipo: z.literal('PARTICULAR'),
  nombre: z.string().min(1, 'El nombre es requerido'),
  apellido: z.string().optional(),
  ocupacion: z.string().optional(),
  ncr: optionalUniqueStr,
  ...camposCompartidos,
};
```

`superRefine`:
1. Si `tipoDocumento` definido sin `numeroDocumento` (o viceversa) → error
2. Validar formato según `tipoDocumento`
3. Si `tipo === 'EMPRESA'` y `tipoDocumento ∉ {DUI, NIT}` → error

### 5. Backend: búsqueda de clientes

En `clientes.service.ts`, reemplazar el OR sobre `dui` y `nit` por `numeroDocumento`. Normalizar el término removiendo guiones para hacer match parcial sin importar el formato.

### 6. Frontend: formulario

`components/clientes/ClienteForm.tsx`:

- **Eliminar** el toggle `nitDistintoDelDui` y toda su lógica.
- **Reemplazar** los inputs DUI/NIT por:
  - Dropdown `tipoDocumento` (5 opciones en PARTICULAR, 2 en EMPRESA)
  - Input `numeroDocumento` con `formatDocumento(tipo, value)` reactivo, `maxLength` y `placeholder` según tipo
  - Al cambiar el tipo, limpiar `numeroDocumento` (los formatos son distintos)
- `ncr` queda como campo separado con hint: "El NCR solo se incluye en CCF o en FC cuando el documento es NIT."

Layout PARTICULAR:
```
Datos personales
─────────────────────────────────────────────────────
[ Nombre * ]                  [ Apellido ]
[ Tipo de documento ▾ ]       [ Número del documento ]
[ Ocupación ]                 [ NCR (opcional) ]
```

Layout EMPRESA:
```
Datos de la empresa
─────────────────────────────────────────────────────
[ Razón social *                                      ]
[ Tipo de documento ▾ ]       [ Número del documento ]
[ NCR ]                       [ Nombre comercial ]
[ Sector ▾ ]                  [ Actividad económica ▾ ]
```

### 7. Frontend: helpers nuevos

`lib/format-documentos.ts` se extiende con:

- `TIPOS_DOCUMENTO_PARTICULAR`, `TIPOS_DOCUMENTO_EMPRESA`
- `LABEL_TIPO_DOCUMENTO`, `PLACEHOLDER_POR_TIPO`, `MAXLENGTH_POR_TIPO`
- `formatDocumento(tipo, value)`: aplica formato según tipo (DUI/NIT mantienen los formateadores existentes; PASAPORTE/CARNET fuerzan mayúsculas + alfanum; OTRO sin formato)
- `validarDocumento(tipo, value)`: regex según la tabla de Sección 2

### 8. Frontend: cambios cross-cutting

| Archivo | Cambio |
|---|---|
| `types/api.ts` | Reemplazar `dui` y `nit` en `Cliente` por `tipoDocumento?` y `numeroDocumento?` |
| `components/clientes/ClienteDetalle.tsx` | Mostrar etiqueta + número según tipo |
| `components/clientes/ClientesList.tsx` | Columna combinada; búsqueda normaliza guiones |
| Cualquier otro consumidor de `cliente.dui` o `cliente.nit` | `tsc --noEmit` los detecta al compilar |

### 9. Plantillas PDF (backend)

`server/src/modules/pdf/templates/`:
- `factura.hbs`, `cotizacion.hbs`, `nota-credito.hbs`: reemplazar bloques específicos de DUI/NIT por `{{#if cliente.tipoDocumento}}{{labelTipoDoc cliente.tipoDocumento}}: {{cliente.numeroDocumento}}{{/if}}`
- Registrar Handlebars helper `labelTipoDoc` en `pdf.service.ts`

## Plan de rollout

1. **Backend** (branch `feat/clientes-tipo-documento` en `server/`):
   - a) Migración Prisma (schema + SQL custom legacy)
   - b) Update Zod schemas + service
   - c) Update `facturallama.service` (helper + 4 emisores)
   - d) Update plantillas PDF + helper Handlebars
   - e) Tests vitest
2. **Frontend** (branch `feat/clientes-tipo-documento` en `frontend/`):
   - a) `lib/format-documentos.ts` (helpers + label maps)
   - b) `types/api.ts`
   - c) `components/clientes/ClienteForm.tsx`
   - d) `ClienteDetalle.tsx` + `ClientesList.tsx`
   - e) Auditar y actualizar cualquier consumidor de `cliente.dui` / `cliente.nit`
   - f) `pnpm tsc --noEmit && pnpm lint`
3. **Verificación e2e** con backend dev y frontend dev corriendo en paralelo
4. **PRs separados**: server primero (porque el frontend depende del schema nuevo)

## Tests

### Backend (vitest)

- `clientes.service`: crear PARTICULAR con cada uno de los 5 tipos; rechazar EMPRESA con tipo ∉ {DUI, NIT}
- `facturallama.service.buildIdentificationDocument`: cubrir los 5 mapeos
- `emitirFC`: NRC incluido cuando type=NIT, omitido en los otros 4 casos
- `emitirCCF`: 422 cuando tipoDocumento ∉ {DUI, NIT} o falta NCR
- `emitirFSE`: 422 si cliente sin documento; recipient correcto para cada tipo

### Frontend (manual, no hay suite)

- `pnpm tsc --noEmit && pnpm lint`
- Crear PARTICULAR con cada tipo de documento
- Crear EMPRESA con DUI y con NIT
- Editar cliente legacy migrado — el dropdown carga el tipo correcto
- Búsqueda por número (con y sin guiones)
- Vista detalle muestra etiqueta correcta
- Generar PDF de factura con cliente PASAPORTE

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Migración legacy descarta DUIs que el usuario podría necesitar | Plan prioriza NIT 14d (legalmente relevante). Casos edge se corrigen por SQL puntual. |
| Componentes no auditados leen `cliente.dui` / `cliente.nit` | `pnpm tsc --noEmit` los detecta al eliminar los campos de `types/api.ts` |
| Tests automáticos del backend fallan tras migración | Actualizar fixtures/factories de tests en paralelo |
| FacturaLlama rechaza FC con NIT 9d (caso del checkbox descartado) | No aplica: solo enviamos NIT cuando el cliente tiene NIT 14d real |
| Hipótesis a validar luego: FacturaLlama acepta NIT 9d post-MH 2026 | Sandbox test diferido — si pasa, se relaja la regla. Por ahora se asume validación estricta. |

## Tareas de seguimiento (fuera de este alcance)

- **Selector inteligente de tipoDocumentoFiscal en cotización**: hoy el operador elige manualmente CF/CCF/SUJETO_EXCLUIDO. Con el nuevo modelo podríamos auto-deshabilitar CCF cuando el cliente no cumple las precondiciones. Documentado para futura mejora.
- **Sandbox test**: validar comportamiento de FacturaLlama con NIT 9d.
