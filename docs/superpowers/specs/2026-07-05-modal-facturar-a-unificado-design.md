# Spec — Unificar "Facturar a" en el modal de generar factura

**Fecha:** 2026-07-05
**Origen:** Feedback de UX del usuario: en el modal "Generar factura" aparece "Facturar a" dos veces (dos campos con label casi idéntico), confuso. Normalizar en una sola sección y mejorar los labels.
**Repos afectados:** solo `/frontend` (Next.js). Rama: `feat/modal-facturar-a-unificado`. **Sin backend, sin cambios de contrato.**

## Problema

`components/cotizaciones/GenerarFacturaModal.tsx` tiene hoy DOS bloques con labels casi iguales:
1. **"Facturar a (opcional)"** → `ContactoSolicitanteSelect` (el `contactoFacturacion`): una **persona/contacto** de atención dentro de la empresa cliente. Solo tracking — ni el DTE ni el PDF de factura lo usan.
2. **"Facturar a un tercero (opcional)"** → el **receptor fiscal** (`receptorClienteId`): otro Cliente registrado que pasa a ser el cliente del DTE y dueño de las cuentas por cobrar.

Son conceptos distintos (contacto de atención vs receptor fiscal) pero ambos dicen "Facturar a".

## Estado actual (verificado)

`GenerarFacturaModal.tsx` (líneas ~180-235): el bloque del contacto (`ContactoSolicitanteSelect` con `clienteId={cliente.id}`, label "Facturar a (opcional)", ayuda "Contacto de facturación del cliente.") va inmediatamente arriba del bloque del receptor tercero (resumen colapsable "Se factura a: <cliente>" + "Cambiar receptor" → `SelectorClienteReceptor` con re-sugerencia de `tipoDTE`). El submit ya envía `receptorClienteId` solo cuando difiere del cliente de la cotización, y `contactoFacturacionId`.

## Decisión (confirmada con el usuario)

Una sola sección **"Facturar a"** con dos partes jerarquizadas: el **receptor** (principal) y el **contacto de atención** (secundario, opcional). Se conservan ambos conceptos y datos; se elimina el label duplicado.

## Diseño

Reemplazar los dos bloques por **una sección con encabezado "Facturar a"** que contiene, en orden:

### 1. Receptor (principal)
- El mecanismo actual del tercero, sin cambios de lógica, solo movido dentro de la sección:
  - Colapsado por defecto: `Se factura a: <nombre del cliente de la cotización>` + enlace **"Cambiar receptor"**.
  - Expandido: `<SelectorClienteReceptor>` (clientes ACTIVOS, `filter` excluye el cliente de la cotización) + enlace "Volver al cliente de la cotización".
  - Al elegir un tercero distinto: aviso **"El DTE y las cuentas por cobrar se emitirán a nombre de este tercero."** y re-sugerencia de `tipoDTE` según el tipo del tercero (ya existe).
- El submit sigue enviando `receptorClienteId` solo cuando `receptorClienteId && receptorClienteId !== cliente.id`.

### 2. Atención / contacto (secundario, opcional)
- Sub-campo con label **"Atención (contacto)"** + `(opcional)`.
- `<ContactoSolicitanteSelect>` con ayuda: **"Persona de la empresa a la que se dirige el documento. No cambia a quién se factura."**
- **Coherencia:** el `clienteId` que se pasa a `ContactoSolicitanteSelect` es el del **receptor efectivo** — el cliente de la cotización por defecto, o el tercero si se eligió uno (`receptorClienteId ?? cliente.id`). Así los contactos listados son de la empresa a la que realmente se factura.
- **Reset:** al cambiar el receptor (elegir tercero o volver al de la cotización), `contactoFacturacionId` se limpia (`setContactoFacturacionId(null)`), porque un contacto del cliente anterior no aplica al nuevo receptor.

### Copy / labels
- Un único encabezado "Facturar a" (sin duplicados). El resumen "Se factura a: …" comunica el receptor; el sub-label "Atención (contacto)" comunica la persona.
- El resto del modal (Tipo de documento fiscal, Condición de pago, QUEDAN, banner de actas) **no cambia** — se evita ruido/scope creep.

## Edge cases
- Sin tercero y sin contacto: comportamiento idéntico al actual (se factura al cliente de la cotización).
- Elegir tercero, luego contacto, luego volver al cliente de la cotización: el contacto se resetea; el receptor vuelve al de la cotización.
- El backend no cambia: `receptorClienteId` y `contactoFacturacionId` se siguen enviando igual.

## Verificación
- Frontend: `pnpm tsc --noEmit` + `pnpm lint`. No hay suite de tests.
- Manual: abrir el modal → una sola sección "Facturar a"; cambiar receptor a un tercero → los contactos de "Atención" pasan a ser del tercero y cualquier contacto previo se limpia; generar la factura con y sin tercero funciona igual que hoy.

## Fuera de alcance
- Cambios de backend / contrato (el receptor y el contacto se envían igual).
- Rediseñar otros campos del modal.
- Persistir/usar el contacto de facturación en el DTE o el PDF (sigue siendo tracking).
