# Grupo C.1 — Etiquetas de variante en correo de cotización y nombres de archivo PDF

**Fecha:** 2026-07-11
**Estado:** Diseño aprobado
**Repos afectados:** frontend (`Reinar/frontend`) y backend (`Reinar/server`)
**Depende de:** Grupo C (variantes de cotización) — ya integrado en main local.

## Contexto

Seguimiento de dos minors de la revisión final del Grupo C:
1. El cliente puede recibir dos correos con el mismo número comercial (`COT260700007`) — la cotización original y una variante — sin forma de distinguirlos.
2. Los PDFs de dos variantes se descargan con el mismo nombre de archivo y se pisan en la carpeta del usuario.

## Concepto central: "letra de opción"

Una cotización tiene letra `A` si es la original, o su sufijo (`B`, `C`…) si es variante. La etiqueta **solo se activa cuando el número tiene variantes** — cotizaciones sin variantes se comportan exactamente como hoy (correo y filename sin cambios).

- Helper backend en `server/src/lib/variantes.ts`: `letraOpcion(numero: string, tieneVariantes: boolean): string | null` → `'A'` para la original con variantes, la letra del sufijo para una variante, `null` sin variantes.
- Espejo frontend en `lib/utils.ts` (misma firma), para el filename de descarga.

## 1. Nombre de archivo del PDF

Aplica a la **descarga desde el frontend** (`descargarCotizacionPdf`) y al **adjunto del correo** (`enviarCotizacion`):

- Sin variantes: `COT260700007.pdf` (como hoy).
- Con variantes: original → `COT260700007-A.pdf`; variantes → `COT260700007-B.pdf`, `COT260700007-C.pdf`…
- Frontend: `descargarCotizacionPdf` recibe la letra de opción; el caller (detalle/AccionesEstado) la deriva de `cotizacion.variantes` (que `GET /:id` ya devuelve). Callers sin acceso a `variantes` (si los hubiera) pasan `null` y conservan el comportamiento actual.
- Backend (`enviarCotizacion`): consulta hermanas del número base (mismo patrón `OR base / startsWith base-` ya usado en el módulo) para decidir la letra.

## 2. Correo de cotización

Solo cuando el número tiene variantes:

- **Asunto:** `Cotización COT260700007 (Opción B) — Reinar S.A. de C.V.` (la original con variantes va como "Opción A").
- **Cuerpo** (`cotizacion-enviada.hbs`): línea destacada condicional — *"Esta es la Opción B de su cotización COT260700007."* — vía variable `letraOpcion` del template (`{{#if letraOpcion}}`).
- El **contenido del PDF** sigue mostrando el número limpio sin etiqueta (decisión del Grupo C — sin cambio).

## Fuera de alcance

- Etiquetas descriptivas libres ("con envío") — la letra A/B es automática.
- Cambios en el PDF mismo o en pantallas internas.

## Verificación

- Backend (vitest, TDD): tests de `letraOpcion` (original con/sin variantes, variante); test de `enviarCotizacion` verificando asunto y filename del adjunto con y sin variantes.
- Frontend: `pnpm tsc --noEmit` limpio; `pnpm lint` en baseline (12 errores / 24 warnings); prueba manual de descarga de original + variante (archivos `-A.pdf` y `-B.pdf`).
- Suite del server: los 14 fallos pre-existentes no aumentan.

## Decisiones registradas

| Decisión | Elección |
|---|---|
| Esquema de filename | Sufijo `-A`/`-B` solo cuando el número tiene variantes; sin variantes, sin cambio |
| Etiqueta de correo | Asunto + cuerpo con "Opción A/B" automática; solo con variantes |
| Contenido del PDF | Sin cambios (número limpio) |
