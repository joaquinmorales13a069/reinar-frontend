# Cotizaciones (Rama 10) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el módulo completo de cotizaciones — lista (tabla + pipeline), wizard de 4 pasos con persistencia incremental, edición de borradores, detalle con timeline y acciones por estado, integración con realtime de equipos y descarga de PDF.

**Architecture:** El wizard crea el borrador (`POST /cotizaciones`) al pasar del Paso 1 al Paso 2 y persiste cada ítem inmediatamente (`POST /cotizaciones/:id/items`). El backend maneja reservas de equipos/herramientas internamente; el frontend solo dispara y reacciona. La página `/cotizaciones/[id]/editar` reutiliza el mismo wizard pero pre-cargado vía `useCotizacion(id)`.

**Tech Stack:** Next.js 19 App Router (`'use client'` donde haya hooks/interactividad), React Query v5, React Hook Form + Zod, decimal.js, socket.io-client, sonner (toasts), Tailwind v4 únicamente (sin valores arbitrarios, sin CSS vanilla).

**Verificación (no hay tests unitarios en este proyecto):** cada tarea termina con `pnpm tsc --noEmit` (debe pasar) + `pnpm lint` (sin warnings nuevos) + un commit pequeño.

**Branch:** `feat/cotizaciones` (ya existe — verificar con `git branch --show-current` antes de empezar).

**Referencia de prototipo:** `/Users/joaquinmorales13a06/Downloads/Frontend-REINAR-design/cotizaciones.jsx`, `cotizaciones-crear.jsx`, `cotizaciones-detalle.jsx`. **NO copiar el CSS** — portar el diseño a clases Tailwind predefinidas.

**Referencia de backend (fuente de verdad):**
- `server/src/modules/cotizaciones/cotizaciones.routes.ts`
- `server/src/modules/cotizaciones/cotizaciones.schemas.ts`
- `server/src/modules/cotizaciones/cotizaciones.service.ts`

---

## Map de archivos

| Tarea | Archivo | Responsabilidad |
|---|---|---|
| 1 | `types/api.ts` (extender) | Tipos TypeScript de cotización, ítem, DTOs, enums |
| 2 | `lib/schemas/cotizacion.ts` (nuevo) | Schemas Zod por paso del wizard y por tipo de ítem |
| 3 | `hooks/use-cotizaciones.ts` (nuevo) | Queries + mutations + PDF |
| 4 | `hooks/use-cotizaciones-realtime.ts` (nuevo) | Suscripción socket a `equipos` |
| 5 | `components/cotizaciones/CotizacionStatusBadge.tsx` (nuevo) | Wrapper de `<Badge>` con label fija |
| 6 | `app/(dashboard)/cotizaciones/page.tsx` (nuevo) | Página de lista con toggle vista |
| 7 | `components/cotizaciones/CotizacionesTabla.tsx` (nuevo) | Vista tabular |
| 8 | `components/cotizaciones/CotizacionesPipeline.tsx` (nuevo) | Vista kanban por estado |
| 9 | `components/cotizaciones/wizard/CotizacionWizard.tsx` (nuevo) | Contenedor del wizard (stepper + footer + lógica de persistencia) |
| 10 | `components/cotizaciones/wizard/Step1Cliente.tsx` (nuevo) | Buscador de cliente, proyecto, contacto, fechas |
| 11 | `app/(dashboard)/cotizaciones/nueva/page.tsx` (nuevo) | Ruta de creación |
| 12 | `components/cotizaciones/wizard/Step2Items.tsx` (nuevo) | Tabla de ítems + botón "Agregar" |
| 13 | `components/cotizaciones/wizard/AgregarItemModal/index.tsx` (nuevo) | Contenedor con tabs |
| 14 | `.../AgregarItemModal/TabEquipo.tsx` (nuevo) | Picker equipo + periodo + cantidad |
| 15 | `.../AgregarItemModal/TabHerramienta.tsx` (nuevo) | Picker tipo + cantidad |
| 16 | `.../AgregarItemModal/TabServicio.tsx` (nuevo) | Picker servicio + cantidad |
| 17 | `.../AgregarItemModal/TabConsumible.tsx` (nuevo) | Picker consumible con stock |
| 18 | `.../AgregarItemModal/TabAndamio.tsx` (nuevo) | Sub-modo pieza vs cuerpo (BOM) |
| 19 | `.../AgregarItemModal/TabCustom.tsx` (nuevo) | Descripción libre + monto |
| 20 | `components/cotizaciones/wizard/Step3Terminos.tsx` (nuevo) | Fiscal, condiciones, IVA, depósito, notas |
| 21 | `components/cotizaciones/wizard/Step4Resumen.tsx` (nuevo) | Vista de revisión |
| 22 | `app/(dashboard)/cotizaciones/[id]/editar/page.tsx` (nuevo) | Wizard en modo editar |
| 23 | `app/(dashboard)/cotizaciones/[id]/page.tsx` (nuevo) | Detalle |
| 24 | `components/cotizaciones/detalle/ItemsTabla.tsx` (nuevo) | Tabla solo lectura con totales |
| 25 | `components/cotizaciones/detalle/ResumenLateral.tsx` (nuevo) | Cliente + fechas + timeline + factura asoc |
| 26 | `components/cotizaciones/detalle/AccionesEstado.tsx` (nuevo) | Botones contextuales por estado + ConfirmRow |
| 27 | (verificación final) | tsc, lint, smoke test manual |

---

## Task 1: Extender `types/api.ts` con tipos de cotizaciones

**Files:**
- Modify: `types/api.ts` (anexar al final)

- [ ] **Step 1: Añadir bloque de tipos**

Append al final del archivo:

```typescript
// ============================================================
// Cotizaciones (Rama 10)
// ============================================================

export type EstadoCotizacion = 'BORRADOR' | 'ENVIADA' | 'APROBADA' | 'RECHAZADA';

export type TipoItemCotizacion =
  | 'EQUIPO'
  | 'HERRAMIENTA'
  | 'SERVICIO'
  | 'CONSUMIBLE'
  | 'PIEZA_ANDAMIO'
  | 'CUSTOM';

export type PeriodoItem = 'DIA' | 'SEMANA' | 'QUINCENA' | 'MES' | 'CUSTOM';

export type TipoDocumentoFiscal = 'CF' | 'CCF' | 'SUJETO_EXCLUIDO';

export type CondicionesPago = 'CONTADO' | 'CREDITO' | 'OTRO';

export type CotizacionItem = {
  id: string;
  cotizacionId: string;
  tipo: TipoItemCotizacion;
  descripcion: string;
  cantidad: number;
  periodo: PeriodoItem;
  periodoCustomLabel: string | null;
  // Decimales serializados como string — usar decimal.js para operar.
  tarifaCatalogo: string;
  tarifaCustom: string | null;
  tarifaAplicada: string;
  esTarifaCustom: boolean;
  subtotal: string;
  orden: number;
  fechaServicio: string | null;
  tecnicoAsignado: string | null;
  equipoId: string | null;
  herramientaTipoId: string | null;
  servicioId: string | null;
  consumibleId: string | null;
  piezaTipoId: string | null;
};

// Forma reducida devuelta por GET /cotizaciones (lista).
export type CotizacionListItem = {
  id: string;
  numeroCotizacion: string;
  estado: EstadoCotizacion;
  total: string;
  fechaCreacion: string;
  fechaVencimiento: string;
  cliente: { id: string; nombre: string };
  creadoPor: { id: string; nombre: string; apellido: string };
  _count: { items: number };
};

// Forma completa devuelta por GET /cotizaciones/:id.
export type Cotizacion = {
  id: string;
  numeroCotizacion: string;
  clienteId: string;
  proyectoId: string | null;
  contactoSolicitanteId: string | null;
  contactoFacturacionId: string | null;
  estado: EstadoCotizacion;
  condicionesPago: CondicionesPago | null;
  tipoDocumentoFiscal: TipoDocumentoFiscal | null;
  porcentajeIva: number;
  depositoPorcentaje: string | null;
  depositoMonto: string | null;
  subtotal: string;
  montoIva: string;
  total: string;
  notas: string | null;
  notasInternas: string | null;
  fechaCreacion: string;
  fechaEnvio: string | null;
  fechaVencimiento: string;
  fechaAprobacion: string | null;
  creadoPor: { id: string; nombre: string; apellido: string; email: string };
  cliente: {
    id: string;
    tipo: 'EMPRESA' | 'PARTICULAR';
    razonSocial: string | null;
    nombre: string | null;
    apellido: string | null;
    nit: string | null;
    dui: string | null;
    email: string | null;
    telefono: string | null;
  };
  proyecto: { id: string; nombre: string } | null;
  contactoSolicitante: { id: string; nombre: string; apellido: string | null; email: string | null } | null;
  contactoFacturacion: { id: string; nombre: string; apellido: string | null; cargo: string | null } | null;
  items: CotizacionItem[];
  factura: { id: string; numeroFactura: string; estado: string } | null;
};

export type CrearCotizacionDto = {
  clienteId: string;
  proyectoId?: string;
  contactoSolicitanteId?: string;
  condicionesPago?: CondicionesPago;
  tipoDocumentoFiscal?: TipoDocumentoFiscal;
  contactoFacturacionId?: string;
  notas?: string;
  notasInternas?: string;
  porcentajeIva?: number;
  fechaVencimiento?: string;
  // Mutuamente excluyentes — validado por Zod y por el backend.
  depositoPorcentaje?: number;
  depositoMonto?: number;
};

export type ActualizarCotizacionDto = Partial<CrearCotizacionDto>;

export type FiltrosCotizaciones = {
  page?: number;
  limit?: number;
  clienteId?: string;
  proyectoId?: string;
  estado?: EstadoCotizacion;
  search?: string;
};

// Discriminated union por `tipo` — espeja exactamente el schema de Zod del backend.
export type AgregarItemDto =
  | {
      tipo: 'EQUIPO';
      equipoId: string;
      cantidad?: number;
      periodo?: PeriodoItem;
      periodoCustomLabel?: string;
      tarifaCustom?: string;
      descripcion?: string;
      fechaServicio?: string;
      tecnicoAsignado?: string;
      orden?: number;
    }
  | {
      tipo: 'HERRAMIENTA';
      herramientaTipoId: string;
      cantidad: number;
      periodo?: PeriodoItem;
      periodoCustomLabel?: string;
      tarifaCustom?: string;
      descripcion?: string;
      fechaServicio?: string;
      tecnicoAsignado?: string;
      orden?: number;
    }
  | {
      tipo: 'SERVICIO';
      servicioId: string;
      cantidad?: number;
      tarifaCustom?: string;
      descripcion?: string;
      fechaServicio?: string;
      tecnicoAsignado?: string;
      orden?: number;
    }
  | {
      tipo: 'CONSUMIBLE';
      consumibleId: string;
      cantidad: number;
      tarifaCustom?: string;
      descripcion?: string;
      orden?: number;
    }
  | {
      tipo: 'PIEZA_ANDAMIO';
      piezaTipoId: string;
      cantidad: number;
      periodo?: PeriodoItem;
      periodoCustomLabel?: string;
      tarifaCustom?: string;
      descripcion?: string;
      fechaServicio?: string;
      orden?: number;
    }
  | {
      tipo: 'CUSTOM';
      descripcion: string;
      cantidad: number;
      tarifaCustom: string; // requerido
      periodo?: PeriodoItem;
      periodoCustomLabel?: string;
      orden?: number;
    };

export type EditarItemDto = {
  cantidad?: number;
  periodo?: PeriodoItem;
  periodoCustomLabel?: string;
  tarifaCustom?: string | null;
  descripcion?: string;
  fechaServicio?: string | null;
  tecnicoAsignado?: string | null;
  orden?: number;
};
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

Expected: pasa sin errores.

- [ ] **Step 3: Commit**

```bash
git add types/api.ts
git commit -m "feat(cotizaciones): tipos del modulo cotizaciones"
```

---

## Task 2: Schemas Zod (`lib/schemas/cotizacion.ts`)

**Files:**
- Create: `lib/schemas/cotizacion.ts`

> El proyecto no tiene `lib/schemas/` aún — esta tarea lo introduce. Si más adelante otros módulos lo adoptan, este archivo sirve de patrón.

- [ ] **Step 1: Crear el archivo de schemas**

```typescript
import { z } from 'zod';

// ── Paso 1: cliente y fechas ───────────────────────────────────────────
// fechaVencimiento usa input type="date" → llega como "YYYY-MM-DD".
// El backend acepta ISO datetime; convertimos en el hook antes de enviar.
export const step1Schema = z.object({
  clienteId: z.string().min(1, 'Selecciona un cliente'),
  proyectoId: z.string().optional().nullable(),
  contactoSolicitanteId: z.string().optional().nullable(),
  fechaVencimiento: z.string().min(1, 'Selecciona fecha de vencimiento'),
});
export type Step1Form = z.infer<typeof step1Schema>;

// ── Paso 3: términos y depósito ────────────────────────────────────────
// Replica el refinamiento del backend: depositoPorcentaje y depositoMonto
// son mutuamente excluyentes. El form usa un radio para alternar y limpia
// el campo no activo antes de enviar.
export const step3Schema = z
  .object({
    tipoDocumentoFiscal: z.enum(['CF', 'CCF', 'SUJETO_EXCLUIDO'], {
      message: 'Selecciona el tipo de documento fiscal',
    }),
    condicionesPago: z.enum(['CONTADO', 'CREDITO', 'OTRO']).optional().nullable(),
    contactoFacturacionId: z.string().optional().nullable(),
    porcentajeIva: z
      .number({ message: 'IVA debe ser numérico' })
      .min(0)
      .max(100)
      .default(13),
    depositoModo: z.enum(['NINGUNO', 'PORCENTAJE', 'MONTO']).default('NINGUNO'),
    depositoPorcentaje: z.number().min(0.01).max(100).optional().nullable(),
    depositoMonto: z.number().positive().optional().nullable(),
    notas: z.string().optional().nullable(),
    notasInternas: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    // CCF y SUJETO_EXCLUIDO requieren contactoFacturacionId — el backend devuelve
    // 422 DATOS_FISCALES_INCOMPLETOS si falta, pero validamos client-side para
    // mostrar el error inline sin viajar al servidor.
    if (
      (data.tipoDocumentoFiscal === 'CCF' || data.tipoDocumentoFiscal === 'SUJETO_EXCLUIDO') &&
      !data.contactoFacturacionId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contactoFacturacionId'],
        message: 'CCF y Sujeto Excluido requieren contacto de facturación',
      });
    }
    if (data.depositoModo === 'PORCENTAJE' && !data.depositoPorcentaje) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['depositoPorcentaje'],
        message: 'Ingresa el porcentaje',
      });
    }
    if (data.depositoModo === 'MONTO' && !data.depositoMonto) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['depositoMonto'],
        message: 'Ingresa el monto',
      });
    }
  });
export type Step3Form = z.infer<typeof step3Schema>;

// ── Item CUSTOM (único form en el modal con validación propia) ─────────
export const customItemSchema = z.object({
  descripcion: z.string().min(1, 'Descripción requerida'),
  monto: z
    .number({ message: 'Monto debe ser numérico' })
    .positive('Monto debe ser mayor a 0'),
});
export type CustomItemForm = z.infer<typeof customItemSchema>;
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/schemas/cotizacion.ts
git commit -m "feat(cotizaciones): schemas zod del wizard"
```

---

## Task 3: Hook layer (`hooks/use-cotizaciones.ts`)

**Files:**
- Create: `hooks/use-cotizaciones.ts`

- [ ] **Step 1: Crear el archivo de hooks**

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  PaginatedResponse,
  Cotizacion,
  CotizacionListItem,
  CotizacionItem,
  CrearCotizacionDto,
  ActualizarCotizacionDto,
  AgregarItemDto,
  EditarItemDto,
  EstadoCotizacion,
  FiltrosCotizaciones,
} from '@/types/api';

// Helper duplicado intencionalmente — mismo patrón que use-proyectos.ts, etc.
function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

// ─── Queries ─────────────────────────────────────────────────────────

export function useCotizaciones(params: FiltrosCotizaciones = {}) {
  return useQuery({
    queryKey: ['cotizaciones', params],
    queryFn: () =>
      api
        .get<PaginatedResponse<CotizacionListItem>>('/cotizaciones', { params })
        .then((r) => r.data),
  });
}

export function useCotizacion(id: string | null | undefined) {
  return useQuery({
    queryKey: ['cotizacion', id],
    queryFn: () =>
      api.get<ApiResponse<Cotizacion>>(`/cotizaciones/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

// ─── Mutations: cotización ──────────────────────────────────────────

export function useCrearCotizacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CrearCotizacionDto) =>
      api.post<ApiResponse<Cotizacion>>('/cotizaciones', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cotizaciones'] });
      toast.success('Borrador creado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear la cotización.'));
    },
  });
}

export function useActualizarCotizacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ActualizarCotizacionDto }) =>
      api.put<ApiResponse<Cotizacion>>(`/cotizaciones/${id}`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (cot) => {
      qc.invalidateQueries({ queryKey: ['cotizacion', cot.id] });
      qc.invalidateQueries({ queryKey: ['cotizaciones'] });
      toast.success('Cambios guardados.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudieron guardar los cambios.'));
    },
  });
}

export function useCambiarEstadoCotizacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoCotizacion }) =>
      api
        .patch<ApiResponse<unknown>>(`/cotizaciones/${id}/estado`, { estado })
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (_data, { id, estado }) => {
      qc.invalidateQueries({ queryKey: ['cotizacion', id] });
      qc.invalidateQueries({ queryKey: ['cotizaciones'] });
      // Aprobar genera factura y rentea equipos/herramientas/stock — refrescar todo
      // lo que la UI podría estar mostrando en otro tab abierto.
      if (estado === 'APROBADA') {
        qc.invalidateQueries({ queryKey: ['equipos'] });
        qc.invalidateQueries({ queryKey: ['facturas'] });
        qc.invalidateQueries({ queryKey: ['consumibles'] });
        qc.invalidateQueries({ queryKey: ['piezas'] });
      }
      const msg =
        estado === 'ENVIADA'
          ? 'Cotización enviada.'
          : estado === 'APROBADA'
            ? 'Cotización aprobada. Factura generada.'
            : 'Cotización rechazada.';
      toast.success(msg);
    },
    onError: (err) => {
      // El backend devuelve 409 CONFLICTO_APROBACION (equipos ya tomados),
      // CONSUMIBLE_SIN_STOCK o ANDAMIO_SIN_STOCK con mensaje legible — propagarlo.
      toast.error(extractErrorMessage(err, 'No se pudo cambiar el estado.'));
    },
  });
}

export function useEliminarCotizacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<ApiResponse<unknown>>(`/cotizaciones/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cotizaciones'] });
      qc.invalidateQueries({ queryKey: ['equipos'] });
      toast.success('Borrador eliminado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo eliminar.'));
    },
  });
}

// ─── Mutations: items ───────────────────────────────────────────────

export function useAgregarItemCotizacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AgregarItemDto }) =>
      api
        .post<ApiResponse<CotizacionItem>>(`/cotizaciones/${id}/items`, data)
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (_item, { id, data }) => {
      qc.invalidateQueries({ queryKey: ['cotizacion', id] });
      // Si el item afecta inventario reservado, refresca los listados relevantes
      // para que otros tabs del usuario reflejen la nueva disponibilidad.
      if (data.tipo === 'EQUIPO') qc.invalidateQueries({ queryKey: ['equipos'] });
      if (data.tipo === 'HERRAMIENTA') qc.invalidateQueries({ queryKey: ['herramientas'] });
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo agregar el ítem.'));
    },
  });
}

export function useEditarItemCotizacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      cotizacionId,
      itemId,
      data,
    }: {
      cotizacionId: string;
      itemId: string;
      data: EditarItemDto;
    }) =>
      api
        .patch<ApiResponse<CotizacionItem>>(
          `/cotizaciones/${cotizacionId}/items/${itemId}`,
          data,
        )
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data.data;
        }),
    onSuccess: (_item, { cotizacionId }) => {
      qc.invalidateQueries({ queryKey: ['cotizacion', cotizacionId] });
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo editar el ítem.'));
    },
  });
}

export function useEliminarItemCotizacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cotizacionId, itemId }: { cotizacionId: string; itemId: string }) =>
      api
        .delete<ApiResponse<unknown>>(
          `/cotizaciones/${cotizacionId}/items/${itemId}`,
        )
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
        }),
    onSuccess: (_data, { cotizacionId }) => {
      qc.invalidateQueries({ queryKey: ['cotizacion', cotizacionId] });
      qc.invalidateQueries({ queryKey: ['equipos'] });
      qc.invalidateQueries({ queryKey: ['herramientas'] });
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo eliminar el ítem.'));
    },
  });
}

// ─── PDF ────────────────────────────────────────────────────────────

export async function descargarCotizacionPdf(id: string, numero: string) {
  // El loading toast se descarta cuando llega la respuesta — no aplica onError
  // porque cualquier excepción la captura el caller (que muestra toast.error).
  const toastId = toast.loading('Generando PDF…');
  try {
    const res = await api.get(`/cotizaciones/${id}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${numero}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.dismiss(toastId);
  } catch (err) {
    toast.dismiss(toastId);
    toast.error(extractErrorMessage(err, 'No se pudo descargar el PDF.'));
  }
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add hooks/use-cotizaciones.ts
git commit -m "feat(cotizaciones): hooks de react-query para cotizaciones e items"
```

---

## Task 4: Realtime de equipos durante el wizard

**Files:**
- Create: `hooks/use-cotizaciones-realtime.ts`

- [ ] **Step 1: Crear el hook**

```typescript
'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socket } from '@/lib/socket';

// Variante del realtime de equipos pensada para el wizard de cotizaciones:
// además de equipo:disponibilidad, escucha equipo:rentado (emitido cuando
// otra cotización es aprobada) y refresca tanto el cache de equipos como
// el de la cotización activa para que la fila de un item de equipo no
// quede mostrando una reserva fantasma.
export function useCotizacionesRealtime(cotizacionId?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!socket.connected) socket.connect();
    socket.emit('join', 'equipos');

    const onDisponibilidad = () => {
      qc.invalidateQueries({ queryKey: ['equipos'] });
    };
    const onRentado = () => {
      qc.invalidateQueries({ queryKey: ['equipos'] });
      if (cotizacionId) qc.invalidateQueries({ queryKey: ['cotizacion', cotizacionId] });
    };

    socket.on('equipo:disponibilidad', onDisponibilidad);
    socket.on('equipo:rentado', onRentado);
    return () => {
      socket.off('equipo:disponibilidad', onDisponibilidad);
      socket.off('equipo:rentado', onRentado);
    };
  }, [qc, cotizacionId]);
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add hooks/use-cotizaciones-realtime.ts
git commit -m "feat(cotizaciones): hook de realtime para disponibilidad de equipos"
```

---

## Task 5: Badge específico de cotización

**Files:**
- Create: `components/cotizaciones/CotizacionStatusBadge.tsx`

- [ ] **Step 1: Crear el wrapper**

```typescript
import { Badge } from '@/components/ui/Badge';
import type { EstadoCotizacion } from '@/types/api';

const LABEL: Record<EstadoCotizacion, string> = {
  BORRADOR: 'Borrador',
  ENVIADA: 'Enviada',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
};

// Wrapper finito para no repetir el mapeo enum → label en cada vista
// donde aparece el estado de una cotización.
export function CotizacionStatusBadge({ estado }: { estado: EstadoCotizacion }) {
  return <Badge status={LABEL[estado]} />;
}
```

> Nota: el `Badge` ya tiene mapeo de colores para `BORRADOR`/`ENVIADA`/`APROBADA`/`RECHAZADA` (ver `components/ui/Badge.tsx` líneas 1-7), pero `STATUS_KIND` indexa por el string visible. Como los labels en español (`Borrador`, `Enviada`, etc.) NO están en `STATUS_KIND`, el badge caería a `neutral`. Para evitar eso, pasamos `kind` explícito:

Reemplaza el body por:

```typescript
import { Badge } from '@/components/ui/Badge';
import type { EstadoCotizacion } from '@/types/api';

const META: Record<EstadoCotizacion, { label: string; kind: 'neutral' | 'info' | 'ok' | 'danger' }> = {
  BORRADOR:  { label: 'Borrador',  kind: 'neutral' },
  ENVIADA:   { label: 'Enviada',   kind: 'info' },
  APROBADA:  { label: 'Aprobada',  kind: 'ok' },
  RECHAZADA: { label: 'Rechazada', kind: 'danger' },
};

export function CotizacionStatusBadge({ estado }: { estado: EstadoCotizacion }) {
  const { label, kind } = META[estado];
  return <Badge status={label} kind={kind} />;
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/cotizaciones/CotizacionStatusBadge.tsx
git commit -m "feat(cotizaciones): badge de estado"
```

---

## Task 6: Página de lista con toggle de vista

**Files:**
- Create: `app/(dashboard)/cotizaciones/page.tsx`

- [ ] **Step 1: Crear la página**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { Icon } from '@/components/ui/Icon';
import { useCotizaciones } from '@/hooks/use-cotizaciones';
import { CotizacionesTabla } from '@/components/cotizaciones/CotizacionesTabla';
import { CotizacionesPipeline } from '@/components/cotizaciones/CotizacionesPipeline';
import type { EstadoCotizacion } from '@/types/api';

type Vista = 'lista' | 'pipeline';

export default function CotizacionesPage() {
  const [vista, setVista] = useState<Vista>('lista');
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState<EstadoCotizacion | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useCotizaciones({
    page,
    limit: 20,
    search: search || undefined,
    estado: estado ?? undefined,
  });

  const chips = (['BORRADOR', 'ENVIADA', 'APROBADA', 'RECHAZADA'] as const).map((e) => ({
    label: e[0] + e.slice(1).toLowerCase(),
    active: estado === e,
    onToggle: () => setEstado(estado === e ? null : e),
  }));

  const total = data?.meta.total ?? 0;
  const subtitle = `${total} ${total === 1 ? 'cotización' : 'cotizaciones'}`;

  const toggleCls = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border transition-colors ${
      active
        ? 'bg-accent text-navy border-accent font-medium'
        : 'text-tx-2 border-bd hover:bg-bg-sunken'
    }`;

  return (
    <div>
      <PageHeader
        title="Cotizaciones"
        subtitle={subtitle}
        actions={
          <>
            <div className="flex gap-1">
              <button type="button" className={toggleCls(vista === 'lista')} onClick={() => setVista('lista')}>
                <Icon name="list" size={14} /> Lista
              </button>
              <button type="button" className={toggleCls(vista === 'pipeline')} onClick={() => setVista('pipeline')}>
                <Icon name="layers" size={14} /> Pipeline
              </button>
            </div>
            <Link
              href="/cotizaciones/nueva"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors"
            >
              <Icon name="plus" size={14} /> Nueva cotización
            </Link>
          </>
        }
      />

      {vista === 'lista' ? (
        <>
          <FilterBar
            search={search}
            onSearch={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Buscar por número o cliente…"
            chips={chips}
            onClear={() => {
              setSearch('');
              setEstado(null);
              setPage(1);
            }}
          />
          <CotizacionesTabla
            data={data?.data ?? []}
            loading={isLoading}
            page={page}
            limit={20}
            total={total}
            onPage={setPage}
          />
        </>
      ) : (
        <CotizacionesPipeline />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Crear placeholders mínimos para que compile**

Create stubs (serán sustituidos en tasks 7-8):

```tsx
// components/cotizaciones/CotizacionesTabla.tsx (stub temporal)
export function CotizacionesTabla(_: {
  data: unknown[];
  loading: boolean;
  page: number;
  limit: number;
  total: number;
  onPage: (p: number) => void;
}) {
  return null;
}

// components/cotizaciones/CotizacionesPipeline.tsx (stub temporal)
export function CotizacionesPipeline() {
  return null;
}
```

- [ ] **Step 3: Verificar tipos**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/cotizaciones/page.tsx components/cotizaciones/CotizacionesTabla.tsx components/cotizaciones/CotizacionesPipeline.tsx
git commit -m "feat(cotizaciones): pagina de lista con toggle vista (stubs)"
```

---

## Task 7: Implementar `CotizacionesTabla.tsx`

**Files:**
- Modify: `components/cotizaciones/CotizacionesTabla.tsx` (reemplazar el stub)

- [ ] **Step 1: Reescribir el componente completo**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { CotizacionStatusBadge } from '@/components/cotizaciones/CotizacionStatusBadge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { descargarCotizacionPdf } from '@/hooks/use-cotizaciones';
import type { CotizacionListItem } from '@/types/api';

type Props = {
  data: CotizacionListItem[];
  loading: boolean;
  page: number;
  limit: number;
  total: number;
  onPage: (p: number) => void;
};

export function CotizacionesTabla({ data, loading, page, limit, total, onPage }: Props) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon="fileText"
        title="Sin cotizaciones"
        message="No se encontraron cotizaciones con los filtros aplicados."
      />
    );
  }

  return (
    <div className="border border-bd rounded-b-md overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-bg-sunken text-tx-3 text-xs uppercase tracking-wider">
          <tr>
            <th className="text-left font-medium px-4 py-2.5">Número</th>
            <th className="text-left font-medium px-4 py-2.5">Cliente</th>
            <th className="text-left font-medium px-4 py-2.5">Estado</th>
            <th className="text-right font-medium px-4 py-2.5">Ítems</th>
            <th className="text-right font-medium px-4 py-2.5">Total</th>
            <th className="text-left font-medium px-4 py-2.5">Creación</th>
            <th className="text-left font-medium px-4 py-2.5">Vence</th>
            <th className="w-12 px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {data.map((c) => (
            <tr
              key={c.id}
              className="border-t border-bd hover:bg-bg-sunken cursor-pointer transition-colors"
              onClick={() => router.push(`/cotizaciones/${c.id}`)}
            >
              <td className="px-4 py-2.5 font-mono font-medium text-tx">{c.numeroCotizacion}</td>
              <td className="px-4 py-2.5 text-tx">{c.cliente.nombre}</td>
              <td className="px-4 py-2.5">
                <CotizacionStatusBadge estado={c.estado} />
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">{c._count.items}</td>
              <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatCurrency(c.total)}</td>
              <td className="px-4 py-2.5 font-mono text-tx-2 text-xs">{formatDate(c.fechaCreacion)}</td>
              <td className="px-4 py-2.5 font-mono text-tx-2 text-xs">{formatDate(c.fechaVencimiento)}</td>
              <td className="px-4 py-2.5">
                <button
                  type="button"
                  className="inline-flex items-center justify-center w-8 h-8 rounded text-tx-3 hover:bg-bg hover:text-tx transition-colors"
                  title="Descargar PDF"
                  onClick={(e) => {
                    e.stopPropagation();
                    void descargarCotizacionPdf(c.id, c.numeroCotizacion);
                  }}
                >
                  <Icon name="download" size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {total > limit && (
        <div className="px-4 py-3 border-t border-bd">
          <Pagination page={page} limit={limit} total={total} onChange={onPage} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

> Si `Pagination` no expone `onChange`, abrir `components/ui/Pagination.tsx` y ajustar el nombre del prop al que esté disponible (por ejemplo `onPageChange`). NO redefinir el componente — solo alinear el nombre.

- [ ] **Step 3: Commit**

```bash
git add components/cotizaciones/CotizacionesTabla.tsx
git commit -m "feat(cotizaciones): tabla de lista con descarga de PDF inline"
```

---

## Task 8: Implementar `CotizacionesPipeline.tsx`

**Files:**
- Modify: `components/cotizaciones/CotizacionesPipeline.tsx` (reemplazar el stub)

- [ ] **Step 1: Reescribir el componente**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import Decimal from 'decimal.js';
import { Spinner } from '@/components/ui/Spinner';
import { CotizacionStatusBadge } from '@/components/cotizaciones/CotizacionStatusBadge';
import { useCotizaciones } from '@/hooks/use-cotizaciones';
import { formatCurrency } from '@/lib/utils';
import type { CotizacionListItem, EstadoCotizacion } from '@/types/api';

const COLUMNAS: { estado: EstadoCotizacion; hint: string }[] = [
  { estado: 'BORRADOR',  hint: 'En preparación' },
  { estado: 'ENVIADA',   hint: 'Pendiente respuesta' },
  { estado: 'APROBADA',  hint: 'Lista para facturar' },
  { estado: 'RECHAZADA', hint: 'No procedió' },
];

export function CotizacionesPipeline() {
  const router = useRouter();
  // El pipeline ignora paginación porque se muestra como kanban; pedimos un límite
  // grande pero acotado para evitar payloads gigantes en proyectos con histórico
  // largo. Si esto se vuelve un problema, paginar por columna en una segunda iteración.
  const { data, isLoading } = useCotizaciones({ limit: 100 });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const todas = data?.data ?? [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {COLUMNAS.map((col) => {
        const items = todas.filter((c) => c.estado === col.estado);
        const suma = items.reduce(
          (acc, c) => acc.add(new Decimal(c.total)),
          new Decimal(0),
        );
        return (
          <div key={col.estado} className="bg-bg-sunken border border-bd rounded-md flex flex-col">
            <div className="px-3 py-2.5 border-b border-bd">
              <div className="flex items-center justify-between">
                <CotizacionStatusBadge estado={col.estado} />
                <span className="text-xs text-tx-3">{items.length}</span>
              </div>
              <div className="text-xs text-tx-3 mt-1">{col.hint}</div>
              <div className="font-mono text-sm font-medium text-tx mt-1">
                {formatCurrency(suma.toFixed(2))}
              </div>
            </div>
            <div className="p-2 flex flex-col gap-2 max-h-96 overflow-y-auto">
              {items.map((c) => (
                <PipelineCard key={c.id} cot={c} onClick={() => router.push(`/cotizaciones/${c.id}`)} />
              ))}
              {items.length === 0 && (
                <div className="text-xs text-tx-3 text-center py-4">Sin cotizaciones</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PipelineCard({ cot, onClick }: { cot: CotizacionListItem; onClick: () => void }) {
  return (
    <button
      type="button"
      className="text-left bg-bg border border-bd rounded p-2.5 hover:border-accent transition-colors"
      onClick={onClick}
    >
      <div className="font-mono text-xs font-medium text-tx">{cot.numeroCotizacion}</div>
      <div className="text-sm text-tx mt-0.5 truncate">{cot.cliente.nombre}</div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="font-mono text-sm font-semibold text-tx">{formatCurrency(cot.total)}</span>
        <span className="text-2xs text-tx-3">{cot._count.items} ítems</span>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Verificar tipos y lint**

```bash
pnpm tsc --noEmit && pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add components/cotizaciones/CotizacionesPipeline.tsx
git commit -m "feat(cotizaciones): vista pipeline kanban por estado"
```

---

## Task 9: Wizard skeleton — contenedor con stepper

**Files:**
- Create: `components/cotizaciones/wizard/CotizacionWizard.tsx`

- [ ] **Step 1: Crear el contenedor del wizard**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { useCotizacion } from '@/hooks/use-cotizaciones';
import { useCotizacionesRealtime } from '@/hooks/use-cotizaciones-realtime';
import { Step1Cliente } from './Step1Cliente';
import { Step2Items } from './Step2Items';
import { Step3Terminos } from './Step3Terminos';
import { Step4Resumen } from './Step4Resumen';

type StepId = 0 | 1 | 2 | 3;

const STEPS: { id: StepId; label: string }[] = [
  { id: 0, label: 'Cliente y proyecto' },
  { id: 1, label: 'Ítems' },
  { id: 2, label: 'Términos' },
  { id: 3, label: 'Resumen' },
];

type Props = {
  // Si viene id, estamos en modo editar; si no, en modo crear.
  cotizacionId?: string;
  // Paso inicial — al editar arrancamos en 0 (cliente) por defecto, pero el
  // caller puede saltar al paso que desee.
  initialStep?: StepId;
};

export function CotizacionWizard({ cotizacionId, initialStep = 0 }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<StepId>(initialStep);
  const [activeId, setActiveId] = useState<string | undefined>(cotizacionId);

  // Suscribe al socket para que el picker de equipos del Paso 2 vea cambios
  // de disponibilidad en vivo sin polling.
  useCotizacionesRealtime(activeId);

  const cotizacionQ = useCotizacion(activeId);
  const cot = cotizacionQ.data;

  // Si llegamos en modo editar y el borrador ya no está en BORRADOR, el
  // backend rechazará cualquier mutación: bloqueamos la UI antes de intentar.
  useEffect(() => {
    if (cot && cot.estado !== 'BORRADOR') {
      router.replace(`/cotizaciones/${cot.id}`);
    }
  }, [cot, router]);

  // Al crear la cotización por primera vez (al final del paso 1), reescribimos
  // la URL para que recargar el browser no pierda el borrador.
  function handleCotizacionCreated(id: string) {
    setActiveId(id);
    router.replace(`/cotizaciones/${id}/editar`);
    setStep(1);
  }

  function goTo(next: StepId) {
    // Solo permitimos volver hacia atrás libremente; avanzar requiere el botón
    // "Siguiente" de cada paso (que valida y persiste).
    if (next < step) setStep(next);
  }

  if (cotizacionId && cotizacionQ.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={cot ? `Editar ${cot.numeroCotizacion}` : 'Nueva cotización'}
        subtitle={cot ? 'Solo se pueden editar borradores.' : 'Completá los 4 pasos para emitir una cotización.'}
        back
        backLabel="Cancelar"
        onBack={() => router.push('/cotizaciones')}
      />

      <Stepper current={step} onClick={goTo} />

      <div className="mt-6">
        {step === 0 && (
          <Step1Cliente
            cotizacion={cot ?? null}
            onCreated={handleCotizacionCreated}
            onUpdated={() => setStep(1)}
          />
        )}
        {step === 1 && cot && (
          <Step2Items
            cotizacion={cot}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && cot && (
          <Step3Terminos
            cotizacion={cot}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && cot && (
          <Step4Resumen
            cotizacion={cot}
            onBack={() => setStep(2)}
          />
        )}
      </div>
    </div>
  );
}

function Stepper({ current, onClick }: { current: StepId; onClick: (s: StepId) => void }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-4 overflow-x-auto pb-2">
      {STEPS.map((s, i) => {
        const isActive = s.id === current;
        const isDone = s.id < current;
        const dotCls = isActive
          ? 'bg-accent text-navy border-accent'
          : isDone
            ? 'bg-ok-soft text-ok border-ok-soft'
            : 'bg-bg-sunken text-tx-3 border-bd';
        return (
          <li key={s.id} className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={!isDone}
              onClick={() => onClick(s.id)}
              className={`flex items-center gap-2 text-sm ${isDone ? 'cursor-pointer' : ''}`}
            >
              <span className={`w-6 h-6 inline-flex items-center justify-center rounded-full border text-xs font-semibold ${dotCls}`}>
                {isDone ? <Icon name="check" size={12} /> : i + 1}
              </span>
              <span className={isActive ? 'text-tx font-medium' : 'text-tx-2'}>{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <span className={`w-6 sm:w-10 h-px ${isDone ? 'bg-ok' : 'bg-bd'}`} />}
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 2: Crear stubs de los 4 pasos para compilar**

Create temporary stubs for steps 1-4 (each in `components/cotizaciones/wizard/`):

```tsx
// Step1Cliente.tsx
'use client';
import type { Cotizacion } from '@/types/api';
type Props = {
  cotizacion: Cotizacion | null;
  onCreated: (id: string) => void;
  onUpdated: () => void;
};
export function Step1Cliente(_: Props) {
  return <div className="card p-4">Step 1 stub</div>;
}
```

Make the same skeleton for `Step2Items.tsx`, `Step3Terminos.tsx`, `Step4Resumen.tsx`, each accepting their own props from the wizard. Use these exact prop shapes:

```tsx
// Step2Items.tsx, Step3Terminos.tsx
type Props = { cotizacion: Cotizacion; onBack: () => void; onNext: () => void };

// Step4Resumen.tsx
type Props = { cotizacion: Cotizacion; onBack: () => void };
```

- [ ] **Step 3: Verificar tipos**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/cotizaciones/wizard/
git commit -m "feat(cotizaciones): wizard skeleton con stepper y stubs de pasos"
```

---

## Task 10: Step 1 — Cliente, contacto, proyecto, fecha

**Files:**
- Modify: `components/cotizaciones/wizard/Step1Cliente.tsx`

- [ ] **Step 1: Reescribir el Step 1**

```tsx
'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '@/components/ui/Icon';
import { FormSection } from '@/components/ui/FormSection';
import { useClientes } from '@/hooks/use-clientes';
import { useContactos } from '@/hooks/use-contactos';
import { useProyectosCliente } from '@/hooks/use-proyectos';
import { useCrearCotizacion, useActualizarCotizacion } from '@/hooks/use-cotizaciones';
import { step1Schema, type Step1Form } from '@/lib/schemas/cotizacion';
import type { Cotizacion } from '@/types/api';

type Props = {
  cotizacion: Cotizacion | null;
  onCreated: (id: string) => void;
  onUpdated: () => void;
};

export function Step1Cliente({ cotizacion, onCreated, onUpdated }: Props) {
  const crear = useCrearCotizacion();
  const actualizar = useActualizarCotizacion();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Step1Form>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      clienteId: cotizacion?.clienteId ?? '',
      proyectoId: cotizacion?.proyectoId ?? null,
      contactoSolicitanteId: cotizacion?.contactoSolicitanteId ?? null,
      // El input type="date" requiere YYYY-MM-DD. El backend devuelve ISO completo.
      fechaVencimiento: cotizacion?.fechaVencimiento?.slice(0, 10) ?? '',
    },
  });

  const clienteId = watch('clienteId');

  // Buscador local de clientes — uno solo, controlado.
  const [busq, setBusq] = useState('');
  const clientesQ = useClientes({ busqueda: busq, limit: 8 });
  const contactosQ = useContactos({ clienteId: clienteId || undefined });
  const proyectosQ = useProyectosCliente(clienteId);

  // Cliente seleccionado actual (para mostrar en card).
  const clienteSeleccionado = useMemo(
    () => clientesQ.data?.data.find((c) => c.id === clienteId) ?? null,
    [clientesQ.data, clienteId],
  );

  async function onSubmit(values: Step1Form) {
    // El backend espera ISO; convertimos YYYY-MM-DD a "YYYY-MM-DDT00:00:00Z".
    const fechaIso = new Date(values.fechaVencimiento + 'T00:00:00').toISOString();
    const payload = {
      clienteId: values.clienteId,
      proyectoId: values.proyectoId ?? undefined,
      contactoSolicitanteId: values.contactoSolicitanteId ?? undefined,
      fechaVencimiento: fechaIso,
    };

    if (cotizacion) {
      await actualizar.mutateAsync({ id: cotizacion.id, data: payload });
      onUpdated();
    } else {
      const created = await crear.mutateAsync(payload);
      onCreated(created.id);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <FormSection title="Cliente y proyecto">
        {!clienteSeleccionado && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-tx mb-1.5">
              Buscar cliente <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-3 pointer-events-none" />
              <input
                className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
                placeholder="Buscar por nombre…"
                value={busq}
                onChange={(e) => setBusq(e.target.value)}
              />
              {busq && clientesQ.data && clientesQ.data.data.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-bg border border-bd rounded-md shadow-md max-h-64 overflow-y-auto">
                  {clientesQ.data.data.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-bg-sunken border-b border-bd last:border-b-0"
                      onClick={() => {
                        setValue('clienteId', c.id, { shouldValidate: true });
                        setValue('contactoSolicitanteId', null);
                        setValue('proyectoId', null);
                        setBusq('');
                      }}
                    >
                      <div className="font-medium">{c.razonSocial ?? `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim()}</div>
                      <div className="text-xs text-tx-3 font-mono">
                        {c.tipo === 'EMPRESA' ? `NIT ${c.nit ?? '—'}` : `DUI ${c.dui ?? '—'}`}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {errors.clienteId && <p className="text-xs text-danger mt-1">{errors.clienteId.message}</p>}
          </div>
        )}

        {clienteSeleccionado && (
          <div className="mb-4 p-3 bg-bg-sunken rounded-md flex items-start justify-between gap-3">
            <div>
              <div className="font-medium text-tx">
                {clienteSeleccionado.razonSocial ?? `${clienteSeleccionado.nombre ?? ''} ${clienteSeleccionado.apellido ?? ''}`.trim()}
              </div>
              <div className="text-xs text-tx-3 font-mono mt-0.5">
                {clienteSeleccionado.tipo === 'EMPRESA'
                  ? `NIT ${clienteSeleccionado.nit ?? '—'}`
                  : `DUI ${clienteSeleccionado.dui ?? '—'}`}
              </div>
            </div>
            <button
              type="button"
              className="text-xs text-tx-2 hover:text-tx px-2 py-1 rounded hover:bg-bg transition-colors"
              onClick={() => {
                setValue('clienteId', '', { shouldValidate: true });
                setValue('contactoSolicitanteId', null);
                setValue('proyectoId', null);
              }}
            >
              <Icon name="x" size={12} /> Cambiar
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-tx mb-1.5">Contacto solicitante</label>
            <select
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx disabled:opacity-50"
              disabled={!clienteId || contactosQ.isLoading}
              {...register('contactoSolicitanteId')}
            >
              <option value="">— Sin contacto vinculado —</option>
              {contactosQ.data?.data.map((co) => (
                <option key={co.id} value={co.id}>
                  {co.nombre} {co.apellido ?? ''} {co.cargo ? `· ${co.cargo}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-tx mb-1.5">Proyecto</label>
            <select
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx disabled:opacity-50"
              disabled={!clienteId || proyectosQ.isLoading}
              {...register('proyectoId')}
            >
              <option value="">— Sin proyecto —</option>
              {proyectosQ.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-tx mb-1.5">
              Fecha de vencimiento <span className="text-danger">*</span>
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx font-mono"
              {...register('fechaVencimiento')}
            />
            {errors.fechaVencimiento && (
              <p className="text-xs text-danger mt-1">{errors.fechaVencimiento.message}</p>
            )}
          </div>
        </div>
      </FormSection>

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors disabled:opacity-50"
        >
          Siguiente <Icon name="arrowRight" size={14} />
        </button>
      </div>
    </form>
  );
}
```

> Si `useContactos` no acepta `clienteId` como parámetro, revisar `hooks/use-contactos.ts` y usar el parámetro existente equivalente (puede llamarse `cliente` o similar). NO modificar el hook.
> Si `useClientes` usa `busqueda` o `search`, alinear con el ya implementado.

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/cotizaciones/wizard/Step1Cliente.tsx
git commit -m "feat(cotizaciones): step 1 con buscador de cliente y persistencia"
```

---

## Task 11: Ruta `nueva/page.tsx`

**Files:**
- Create: `app/(dashboard)/cotizaciones/nueva/page.tsx`

- [ ] **Step 1: Crear la ruta**

```tsx
import { CotizacionWizard } from '@/components/cotizaciones/wizard/CotizacionWizard';

export default function NuevaCotizacionPage() {
  return <CotizacionWizard />;
}
```

- [ ] **Step 2: Verificar build**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Smoke test manual**

Arranca el dev server con `pnpm dev`, ir a `http://localhost:3001/cotizaciones/nueva`, seleccionar un cliente y una fecha, hacer click en Siguiente. Verificar:
- La URL cambia a `/cotizaciones/<id>/editar` (`router.replace`).
- En `/cotizaciones` aparece el borrador.

Si falla, revisar Network tab para ver la respuesta del POST.

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/cotizaciones/nueva/page.tsx
git commit -m "feat(cotizaciones): ruta de creacion"
```

---

## Task 12: Step 2 — Tabla de ítems

**Files:**
- Modify: `components/cotizaciones/wizard/Step2Items.tsx`

- [ ] **Step 1: Reescribir el Step 2**

```tsx
'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { useEditarItemCotizacion, useEliminarItemCotizacion } from '@/hooks/use-cotizaciones';
import { formatCurrency } from '@/lib/utils';
import { AgregarItemModal } from './AgregarItemModal';
import type { Cotizacion, CotizacionItem, PeriodoItem, TipoItemCotizacion } from '@/types/api';

const PERIODO_LABEL: Record<PeriodoItem, string> = {
  DIA: 'Día',
  SEMANA: 'Semana',
  QUINCENA: 'Quincena',
  MES: 'Mes',
  CUSTOM: 'Custom',
};

const TIPO_LABEL: Record<TipoItemCotizacion, string> = {
  EQUIPO: 'Equipo',
  HERRAMIENTA: 'Herramienta',
  SERVICIO: 'Servicio',
  CONSUMIBLE: 'Consumible',
  PIEZA_ANDAMIO: 'Andamio',
  CUSTOM: 'Custom',
};

type Props = { cotizacion: Cotizacion; onBack: () => void; onNext: () => void };

export function Step2Items({ cotizacion, onBack, onNext }: Props) {
  const [modal, setModal] = useState(false);
  const editar = useEditarItemCotizacion();
  const eliminar = useEliminarItemCotizacion();

  const items = cotizacion.items;

  function patch(item: CotizacionItem, data: Parameters<typeof editar.mutate>[0]['data']) {
    editar.mutate({ cotizacionId: cotizacion.id, itemId: item.id, data });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium text-tx">Ítems de la cotización</h3>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors"
          onClick={() => setModal(true)}
        >
          <Icon name="plus" size={14} /> Agregar ítem
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon="list"
          title="Sin ítems"
          message='Hacé clic en "Agregar ítem" para empezar.'
        />
      ) : (
        <div className="border border-bd rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-sunken text-tx-3 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 font-medium w-32">Tipo</th>
                <th className="text-left px-3 py-2 font-medium">Descripción</th>
                <th className="text-left px-3 py-2 font-medium w-32">Período</th>
                <th className="text-right px-3 py-2 font-medium w-24">Cant.</th>
                <th className="text-right px-3 py-2 font-medium w-32">Tarifa</th>
                <th className="text-right px-3 py-2 font-medium w-32">Subtotal</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-bd">
                  <td className="px-3 py-2">
                    <Badge status={TIPO_LABEL[it.tipo]} kind="neutral" />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full bg-transparent border-b border-transparent hover:border-bd focus:border-accent focus:outline-none text-sm"
                      defaultValue={it.descripcion}
                      onBlur={(e) => {
                        if (e.target.value !== it.descripcion) {
                          patch(it, { descripcion: e.target.value });
                        }
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="text-sm bg-transparent border-b border-transparent hover:border-bd focus:border-accent focus:outline-none"
                      defaultValue={it.periodo}
                      onChange={(e) => patch(it, { periodo: e.target.value as PeriodoItem })}
                    >
                      {(Object.keys(PERIODO_LABEL) as PeriodoItem[]).map((p) => (
                        <option key={p} value={p}>
                          {PERIODO_LABEL[p]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={1}
                      className="w-16 text-right font-mono bg-transparent border-b border-transparent hover:border-bd focus:border-accent focus:outline-none"
                      defaultValue={it.cantidad}
                      onBlur={(e) => {
                        const n = parseInt(e.target.value, 10) || 1;
                        if (n !== it.cantidad) patch(it, { cantidad: n });
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {/* Edit inline de la tarifa custom: si tipea algo se guarda como custom */}
                    <input
                      type="number"
                      step="0.01"
                      className="w-24 text-right font-mono bg-transparent border-b border-transparent hover:border-bd focus:border-accent focus:outline-none"
                      defaultValue={it.tarifaAplicada}
                      onBlur={(e) => {
                        const v = e.target.value;
                        if (v === '' || v === it.tarifaAplicada) return;
                        patch(it, { tarifaCustom: v });
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-medium">{formatCurrency(it.subtotal)}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center w-7 h-7 rounded text-tx-3 hover:text-danger hover:bg-danger-soft transition-colors"
                      onClick={() => eliminar.mutate({ cotizacionId: cotizacion.id, itemId: it.id })}
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-bg-sunken">
              <tr className="border-t border-bd">
                <td colSpan={5} className="text-right px-3 py-2 text-tx-2">Subtotal</td>
                <td className="text-right px-3 py-2 font-mono">{formatCurrency(cotizacion.subtotal)}</td>
                <td />
              </tr>
              <tr>
                <td colSpan={5} className="text-right px-3 py-2 text-tx-2">
                  IVA ({cotizacion.porcentajeIva}%)
                </td>
                <td className="text-right px-3 py-2 font-mono">{formatCurrency(cotizacion.montoIva)}</td>
                <td />
              </tr>
              <tr>
                <td colSpan={5} className="text-right px-3 py-2 font-semibold">Total</td>
                <td className="text-right px-3 py-2 font-mono font-bold text-base">{formatCurrency(cotizacion.total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="flex justify-between gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-tx-2 border border-bd hover:bg-bg-sunken transition-colors"
          onClick={onBack}
        >
          <Icon name="arrowLeft" size={14} /> Anterior
        </button>
        <button
          type="button"
          disabled={items.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors disabled:opacity-50"
          onClick={onNext}
        >
          Siguiente <Icon name="arrowRight" size={14} />
        </button>
      </div>

      {modal && (
        <AgregarItemModal
          cotizacionId={cotizacion.id}
          onClose={() => setModal(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Crear stub del modal**

```tsx
// components/cotizaciones/wizard/AgregarItemModal/index.tsx (stub)
type Props = { cotizacionId: string; onClose: () => void };
export function AgregarItemModal(_: Props) {
  return null;
}
```

- [ ] **Step 3: Verificar tipos**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/cotizaciones/wizard/Step2Items.tsx components/cotizaciones/wizard/AgregarItemModal/index.tsx
git commit -m "feat(cotizaciones): step 2 tabla editable de items"
```

---

## Task 13: Modal de agregar ítem — contenedor con tabs

**Files:**
- Modify: `components/cotizaciones/wizard/AgregarItemModal/index.tsx`
- Create: `components/cotizaciones/wizard/AgregarItemModal/TabEquipo.tsx` (stub)
- Create: `components/cotizaciones/wizard/AgregarItemModal/TabHerramienta.tsx` (stub)
- Create: `components/cotizaciones/wizard/AgregarItemModal/TabServicio.tsx` (stub)
- Create: `components/cotizaciones/wizard/AgregarItemModal/TabConsumible.tsx` (stub)
- Create: `components/cotizaciones/wizard/AgregarItemModal/TabAndamio.tsx` (stub)
- Create: `components/cotizaciones/wizard/AgregarItemModal/TabCustom.tsx` (stub)

- [ ] **Step 1: Reemplazar `index.tsx` con el contenedor**

```tsx
'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import { TabEquipo } from './TabEquipo';
import { TabHerramienta } from './TabHerramienta';
import { TabServicio } from './TabServicio';
import { TabConsumible } from './TabConsumible';
import { TabAndamio } from './TabAndamio';
import { TabCustom } from './TabCustom';

type TabId = 'EQUIPO' | 'HERRAMIENTA' | 'SERVICIO' | 'CONSUMIBLE' | 'PIEZA_ANDAMIO' | 'CUSTOM';

const TABS: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'EQUIPO',        label: 'Equipos',       icon: 'package' },
  { id: 'HERRAMIENTA',   label: 'Herramientas',  icon: 'hammer' },
  { id: 'SERVICIO',      label: 'Servicios',     icon: 'tool' },
  { id: 'CONSUMIBLE',    label: 'Consumibles',   icon: 'box' },
  { id: 'PIEZA_ANDAMIO', label: 'Andamios',      icon: 'layers' },
  { id: 'CUSTOM',        label: 'Personalizado', icon: 'edit' },
];

type Props = { cotizacionId: string; onClose: () => void };

export function AgregarItemModal({ cotizacionId, onClose }: Props) {
  const [tab, setTab] = useState<TabId>('EQUIPO');

  const childProps = { cotizacionId, onAdded: onClose };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-bg rounded-lg border border-bd shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
          <h3 className="text-base font-semibold text-tx">Agregar ítem</h3>
          <button
            type="button"
            className="inline-flex items-center justify-center w-8 h-8 rounded text-tx-3 hover:bg-bg-sunken hover:text-tx transition-colors"
            onClick={onClose}
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        <div className="flex gap-1 px-4 pt-3 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${
                tab === t.id ? 'bg-accent text-navy font-medium' : 'text-tx-2 hover:bg-bg-sunken'
              }`}
              onClick={() => setTab(t.id)}
            >
              <Icon name={t.icon} size={13} /> {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'EQUIPO' && <TabEquipo {...childProps} />}
          {tab === 'HERRAMIENTA' && <TabHerramienta {...childProps} />}
          {tab === 'SERVICIO' && <TabServicio {...childProps} />}
          {tab === 'CONSUMIBLE' && <TabConsumible {...childProps} />}
          {tab === 'PIEZA_ANDAMIO' && <TabAndamio {...childProps} />}
          {tab === 'CUSTOM' && <TabCustom {...childProps} />}
        </div>
      </div>
    </div>
  );
}

export type TabChildProps = { cotizacionId: string; onAdded: () => void };
```

- [ ] **Step 2: Crear los 6 stubs de tabs**

Cada stub:

```tsx
// TabEquipo.tsx (y los demás con el mismo skeleton, cambiando el nombre)
'use client';
import type { TabChildProps } from './index';
export function TabEquipo(_: TabChildProps) {
  return <div className="text-sm text-tx-3">Picker en construcción.</div>;
}
```

Repetir para `TabHerramienta`, `TabServicio`, `TabConsumible`, `TabAndamio`, `TabCustom`.

- [ ] **Step 3: Verificar tipos**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/cotizaciones/wizard/AgregarItemModal/
git commit -m "feat(cotizaciones): modal de agregar item con tabs (stubs)"
```

---

## Task 14: TabEquipo — picker de equipo

**Files:**
- Modify: `components/cotizaciones/wizard/AgregarItemModal/TabEquipo.tsx`

- [ ] **Step 1: Reescribir el tab**

```tsx
'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useEquipos } from '@/hooks/use-equipos';
import { useAgregarItemCotizacion } from '@/hooks/use-cotizaciones';
import { formatCurrency } from '@/lib/utils';
import type { Equipo, PeriodoItem } from '@/types/api';
import type { TabChildProps } from './index';

const PERIODOS: { value: Exclude<PeriodoItem, 'CUSTOM'>; label: string }[] = [
  { value: 'DIA',      label: 'Día' },
  { value: 'SEMANA',   label: 'Semana' },
  { value: 'QUINCENA', label: 'Quincena' },
  { value: 'MES',      label: 'Mes' },
];

export function TabEquipo({ cotizacionId, onAdded }: TabChildProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Equipo | null>(null);
  const [periodo, setPeriodo] = useState<Exclude<PeriodoItem, 'CUSTOM'>>('DIA');
  const [cantidad, setCantidad] = useState(1);

  // Solo equipos DISPONIBLES — el backend rechaza con 409 si se intenta uno rentado.
  const equiposQ = useEquipos({ search: search || undefined, estado: 'DISPONIBLE', limit: 20 });
  const agregar = useAgregarItemCotizacion();

  const isMutating = agregar.isPending;

  async function confirmar() {
    if (!selected) return;
    await agregar.mutateAsync({
      id: cotizacionId,
      data: { tipo: 'EQUIPO', equipoId: selected.id, cantidad, periodo },
    });
    onAdded();
  }

  return (
    <div className="space-y-3">
      <input
        className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
        placeholder="Buscar equipo…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {equiposQ.isLoading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : (
        <div className="border border-bd rounded-md max-h-64 overflow-y-auto">
          {(equiposQ.data?.data ?? []).map((e) => {
            const isActive = selected?.id === e.id;
            return (
              <button
                key={e.id}
                type="button"
                className={`w-full text-left px-3 py-2 border-b border-bd last:border-b-0 transition-colors ${
                  isActive ? 'bg-accent-soft' : 'hover:bg-bg-sunken'
                }`}
                onClick={() => setSelected(e)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-tx">{e.nombre}</div>
                    <div className="font-mono text-xs text-tx-3">
                      {e.codigo} · {formatCurrency(e.tarifaDia)}/día
                    </div>
                  </div>
                  <Badge status="Disponible" kind="ok" />
                </div>
              </button>
            );
          })}
          {equiposQ.data?.data.length === 0 && (
            <div className="px-3 py-4 text-sm text-tx-3 text-center">Sin equipos disponibles.</div>
          )}
        </div>
      )}

      {selected && (
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-bd">
          <div>
            <label className="block text-xs font-medium text-tx-2 mb-1">Período</label>
            <select
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as typeof periodo)}
            >
              {PERIODOS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-tx-2 mb-1">Cantidad</label>
            <input
              type="number"
              min={1}
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx font-mono"
              value={cantidad}
              onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-tx-2 mb-1">Tarifa</label>
            <div className="px-3 py-2 text-sm rounded-md border border-bd bg-bg-sunken text-tx font-mono">
              {formatCurrency(
                periodo === 'DIA' ? selected.tarifaDia :
                periodo === 'SEMANA' ? selected.tarifaSemana :
                periodo === 'MES' ? selected.tarifaMes :
                selected.tarifaSemana, // QUINCENA = 2 * semana, backend recalcula
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-3 border-t border-bd">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors disabled:opacity-50"
          disabled={!selected || isMutating}
          onClick={confirmar}
        >
          <Icon name="plus" size={14} /> Agregar
        </button>
      </div>
    </div>
  );
}
```

> Verificar que `useEquipos` acepte `{ search, estado, limit }`. Si usa nombres distintos (p.ej. `incluirInactivos`), ajustar el call site.

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/cotizaciones/wizard/AgregarItemModal/TabEquipo.tsx
git commit -m "feat(cotizaciones): tab equipo en modal de agregar item"
```

---

## Task 15: TabHerramienta

**Files:**
- Modify: `components/cotizaciones/wizard/AgregarItemModal/TabHerramienta.tsx`

- [ ] **Step 1: Reescribir el tab**

```tsx
'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useHerramientas } from '@/hooks/use-herramientas';
import { useAgregarItemCotizacion } from '@/hooks/use-cotizaciones';
import { formatCurrency } from '@/lib/utils';
import type { HerramientaTipo, PeriodoItem } from '@/types/api';
import type { TabChildProps } from './index';

const PERIODOS: { value: Exclude<PeriodoItem, 'CUSTOM'>; label: string }[] = [
  { value: 'DIA',      label: 'Día' },
  { value: 'SEMANA',   label: 'Semana' },
  { value: 'QUINCENA', label: 'Quincena' },
  { value: 'MES',      label: 'Mes' },
];

// El backend asigna las unidades automáticamente; el usuario solo elige el tipo
// y cuántas necesita. La cantidad está acotada por unidadesDisponibles del tipo.
export function TabHerramienta({ cotizacionId, onAdded }: TabChildProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<HerramientaTipo | null>(null);
  const [periodo, setPeriodo] = useState<Exclude<PeriodoItem, 'CUSTOM'>>('DIA');
  const [cantidad, setCantidad] = useState(1);

  const herrQ = useHerramientas({ search: search || undefined, activo: true });
  const agregar = useAgregarItemCotizacion();

  const max = selected?.unidadesDisponibles ?? 0;

  async function confirmar() {
    if (!selected || cantidad > max) return;
    await agregar.mutateAsync({
      id: cotizacionId,
      data: { tipo: 'HERRAMIENTA', herramientaTipoId: selected.id, cantidad, periodo },
    });
    onAdded();
  }

  return (
    <div className="space-y-3">
      <input
        className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
        placeholder="Buscar tipo de herramienta…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {herrQ.isLoading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : (
        <div className="border border-bd rounded-md max-h-64 overflow-y-auto">
          {(herrQ.data?.data ?? []).map((h) => {
            const disp = h.unidadesDisponibles ?? 0;
            const total = h.totalUnidades ?? 0;
            const isActive = selected?.id === h.id;
            const sinStock = disp === 0;
            return (
              <button
                key={h.id}
                type="button"
                disabled={sinStock}
                className={`w-full text-left px-3 py-2 border-b border-bd last:border-b-0 transition-colors ${
                  sinStock ? 'opacity-50 cursor-not-allowed' : isActive ? 'bg-accent-soft' : 'hover:bg-bg-sunken'
                }`}
                onClick={() => {
                  setSelected(h);
                  setCantidad(1);
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-tx truncate">{h.nombre}</div>
                    <div className="font-mono text-xs text-tx-3">
                      {h.codigo} · {formatCurrency(h.tarifaDia)}/día
                    </div>
                  </div>
                  <Badge status={`${disp}/${total} disp.`} kind={sinStock ? 'danger' : 'ok'} />
                </div>
              </button>
            );
          })}
          {herrQ.data?.data.length === 0 && (
            <div className="px-3 py-4 text-sm text-tx-3 text-center">Sin tipos disponibles.</div>
          )}
        </div>
      )}

      {selected && (
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-bd">
          <div>
            <label className="block text-xs font-medium text-tx-2 mb-1">Período</label>
            <select
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as typeof periodo)}
            >
              {PERIODOS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-tx-2 mb-1">Cantidad (máx {max})</label>
            <input
              type="number"
              min={1}
              max={max}
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx font-mono"
              value={cantidad}
              onChange={(e) => setCantidad(Math.max(1, Math.min(max, parseInt(e.target.value, 10) || 1)))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-tx-2 mb-1">Tarifa unitaria</label>
            <div className="px-3 py-2 text-sm rounded-md border border-bd bg-bg-sunken text-tx font-mono">
              {formatCurrency(
                periodo === 'DIA' ? selected.tarifaDia :
                periodo === 'SEMANA' ? selected.tarifaSemana :
                periodo === 'MES' ? selected.tarifaMes :
                selected.tarifaSemana,
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-3 border-t border-bd">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors disabled:opacity-50"
          disabled={!selected || agregar.isPending || cantidad > max}
          onClick={confirmar}
        >
          <Icon name="plus" size={14} /> Agregar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/cotizaciones/wizard/AgregarItemModal/TabHerramienta.tsx
git commit -m "feat(cotizaciones): tab herramienta con limite por disponibilidad"
```

---

## Task 16: TabServicio

**Files:**
- Modify: `components/cotizaciones/wizard/AgregarItemModal/TabServicio.tsx`

- [ ] **Step 1: Reescribir el tab**

```tsx
'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { useServicios } from '@/hooks/use-servicios';
import { useAgregarItemCotizacion } from '@/hooks/use-cotizaciones';
import { formatCurrency } from '@/lib/utils';
import type { Servicio } from '@/types/api';
import type { TabChildProps } from './index';

export function TabServicio({ cotizacionId, onAdded }: TabChildProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Servicio | null>(null);
  const [cantidad, setCantidad] = useState(1);

  const serviciosQ = useServicios({ search: search || undefined, activo: true });
  const agregar = useAgregarItemCotizacion();

  async function confirmar() {
    if (!selected) return;
    await agregar.mutateAsync({
      id: cotizacionId,
      data: { tipo: 'SERVICIO', servicioId: selected.id, cantidad },
    });
    onAdded();
  }

  return (
    <div className="space-y-3">
      <input
        className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
        placeholder="Buscar servicio…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {serviciosQ.isLoading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : (
        <div className="border border-bd rounded-md max-h-64 overflow-y-auto">
          {(serviciosQ.data?.data ?? []).map((s) => {
            const isActive = selected?.id === s.id;
            return (
              <button
                key={s.id}
                type="button"
                className={`w-full text-left px-3 py-2 border-b border-bd last:border-b-0 transition-colors ${
                  isActive ? 'bg-accent-soft' : 'hover:bg-bg-sunken'
                }`}
                onClick={() => setSelected(s)}
              >
                <div className="text-sm font-medium text-tx">{s.nombre}</div>
                <div className="font-mono text-xs text-tx-3">
                  {s.codigo} · {formatCurrency(s.tarifaBase)}/{s.unidad}
                </div>
              </button>
            );
          })}
          {serviciosQ.data?.data.length === 0 && (
            <div className="px-3 py-4 text-sm text-tx-3 text-center">Sin servicios.</div>
          )}
        </div>
      )}

      {selected && (
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-bd">
          <div>
            <label className="block text-xs font-medium text-tx-2 mb-1">Cantidad</label>
            <input
              type="number"
              min={1}
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx font-mono"
              value={cantidad}
              onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-tx-2 mb-1">Subtotal</label>
            <div className="px-3 py-2 text-sm rounded-md border border-bd bg-bg-sunken text-tx font-mono font-semibold">
              {formatCurrency((Number(selected.tarifaBase) * cantidad).toFixed(2))}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-3 border-t border-bd">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors disabled:opacity-50"
          disabled={!selected || agregar.isPending}
          onClick={confirmar}
        >
          <Icon name="plus" size={14} /> Agregar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/cotizaciones/wizard/AgregarItemModal/TabServicio.tsx
git commit -m "feat(cotizaciones): tab servicio"
```

---

## Task 17: TabConsumible

**Files:**
- Modify: `components/cotizaciones/wizard/AgregarItemModal/TabConsumible.tsx`

- [ ] **Step 1: Reescribir el tab**

```tsx
'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useConsumibles } from '@/hooks/use-consumibles';
import { useAgregarItemCotizacion } from '@/hooks/use-cotizaciones';
import { formatCurrency } from '@/lib/utils';
import type { Consumible } from '@/types/api';
import type { TabChildProps } from './index';

export function TabConsumible({ cotizacionId, onAdded }: TabChildProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Consumible | null>(null);
  const [cantidad, setCantidad] = useState(1);

  const consQ = useConsumibles({ search: search || undefined, activo: true });
  const agregar = useAgregarItemCotizacion();

  const sinStock = selected ? selected.stockActual === 0 : false;
  const excedeStock = selected ? cantidad > selected.stockActual : false;

  async function confirmar() {
    if (!selected || excedeStock || sinStock) return;
    await agregar.mutateAsync({
      id: cotizacionId,
      data: { tipo: 'CONSUMIBLE', consumibleId: selected.id, cantidad },
    });
    onAdded();
  }

  return (
    <div className="space-y-3">
      <input
        className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
        placeholder="Buscar consumible…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {consQ.isLoading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : (
        <div className="border border-bd rounded-md max-h-64 overflow-y-auto">
          {(consQ.data?.data ?? []).map((c) => {
            const isActive = selected?.id === c.id;
            const stockKind: 'ok' | 'warn' | 'danger' =
              c.stockActual === 0 ? 'danger' : c.stockActual <= c.stockMinimo ? 'warn' : 'ok';
            return (
              <button
                key={c.id}
                type="button"
                disabled={c.stockActual === 0}
                className={`w-full text-left px-3 py-2 border-b border-bd last:border-b-0 transition-colors ${
                  c.stockActual === 0 ? 'opacity-50 cursor-not-allowed' : isActive ? 'bg-accent-soft' : 'hover:bg-bg-sunken'
                }`}
                onClick={() => {
                  setSelected(c);
                  setCantidad(1);
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-tx">{c.nombre}</div>
                    <div className="font-mono text-xs text-tx-3">
                      {c.codigo} · {formatCurrency(c.precioUnitario)}/{c.unidad}
                    </div>
                  </div>
                  <Badge
                    status={c.stockActual === 0 ? 'Sin stock' : `${c.stockActual} ${c.unidad}`}
                    kind={stockKind}
                  />
                </div>
              </button>
            );
          })}
          {consQ.data?.data.length === 0 && (
            <div className="px-3 py-4 text-sm text-tx-3 text-center">Sin consumibles.</div>
          )}
        </div>
      )}

      {selected && (
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-bd">
          <div>
            <label className="block text-xs font-medium text-tx-2 mb-1">
              Cantidad (stock: {selected.stockActual})
            </label>
            <input
              type="number"
              min={1}
              max={selected.stockActual}
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx font-mono"
              value={cantidad}
              onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
            {excedeStock && (
              <p className="text-xs text-warn mt-1">
                Solo hay {selected.stockActual} {selected.unidad} en stock.
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-tx-2 mb-1">Subtotal</label>
            <div className="px-3 py-2 text-sm rounded-md border border-bd bg-bg-sunken text-tx font-mono font-semibold">
              {formatCurrency((Number(selected.precioUnitario) * cantidad).toFixed(2))}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-3 border-t border-bd">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors disabled:opacity-50"
          disabled={!selected || sinStock || excedeStock || agregar.isPending}
          onClick={confirmar}
        >
          <Icon name="plus" size={14} /> Agregar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/cotizaciones/wizard/AgregarItemModal/TabConsumible.tsx
git commit -m "feat(cotizaciones): tab consumible con guard de stock"
```

---

## Task 18: TabAndamio (pieza + cuerpo con expansión BOM)

**Files:**
- Modify: `components/cotizaciones/wizard/AgregarItemModal/TabAndamio.tsx`

- [ ] **Step 1: Reescribir el tab**

```tsx
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { usePiezas, useCuerpos } from '@/hooks/use-andamios';
import { useAgregarItemCotizacion } from '@/hooks/use-cotizaciones';
import { formatCurrency } from '@/lib/utils';
import type { PiezaTipo, CuerpoTipo, PeriodoItem } from '@/types/api';
import type { TabChildProps } from './index';

const PERIODOS: { value: Exclude<PeriodoItem, 'CUSTOM'>; label: string }[] = [
  { value: 'DIA',      label: 'Día' },
  { value: 'SEMANA',   label: 'Semana' },
  { value: 'QUINCENA', label: 'Quincena' },
  { value: 'MES',      label: 'Mes' },
];

type Modo = 'pieza' | 'cuerpo';

export function TabAndamio({ cotizacionId, onAdded }: TabChildProps) {
  const [modo, setModo] = useState<Modo>('pieza');
  const [periodo, setPeriodo] = useState<Exclude<PeriodoItem, 'CUSTOM'>>('DIA');
  const [cantidad, setCantidad] = useState(1);
  const [piezaSel, setPiezaSel] = useState<PiezaTipo | null>(null);
  const [cuerpoSel, setCuerpoSel] = useState<CuerpoTipo | null>(null);

  const piezasQ = usePiezas({});
  const cuerposQ = useCuerpos({});
  const agregar = useAgregarItemCotizacion();

  function tarifaPieza(p: PiezaTipo, per: Exclude<PeriodoItem, 'CUSTOM'>): string {
    if (per === 'DIA') return p.tarifaDia;
    if (per === 'SEMANA') return p.tarifaSemana;
    if (per === 'MES') return p.tarifaMes;
    return p.tarifaSemana; // QUINCENA — backend recalcula = 2 * semana
  }

  async function confirmarPieza() {
    if (!piezaSel) return;
    await agregar.mutateAsync({
      id: cotizacionId,
      data: { tipo: 'PIEZA_ANDAMIO', piezaTipoId: piezaSel.id, cantidad, periodo },
    });
    onAdded();
  }

  // Cuerpo: agregamos secuencialmente cada pieza con su cantidad expandida.
  // Si una falla a mitad, abortamos y notificamos — los items previos quedan
  // en el borrador y el usuario decide si limpiarlos.
  async function confirmarCuerpo() {
    if (!cuerpoSel) return;
    let ok = 0;
    const total = cuerpoSel.componentes.length;
    for (const comp of cuerpoSel.componentes) {
      try {
        await agregar.mutateAsync({
          id: cotizacionId,
          data: {
            tipo: 'PIEZA_ANDAMIO',
            piezaTipoId: comp.piezaTipo.id,
            cantidad: comp.cantidad * cantidad,
            periodo,
            descripcion: `[Cuerpo: ${cuerpoSel.nombre}] ${comp.piezaTipo.nombre}`,
          },
        });
        ok++;
      } catch {
        toast.error(`Se agregaron ${ok} de ${total} piezas. Revisar antes de continuar.`);
        onAdded();
        return;
      }
    }
    onAdded();
  }

  return (
    <div className="space-y-3">
      <div className="inline-flex gap-1 p-1 bg-bg-sunken rounded-md">
        {(['pieza', 'cuerpo'] as Modo[]).map((m) => (
          <button
            key={m}
            type="button"
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              modo === m ? 'bg-bg text-tx font-medium shadow-sm' : 'text-tx-2 hover:text-tx'
            }`}
            onClick={() => {
              setModo(m);
              setPiezaSel(null);
              setCuerpoSel(null);
            }}
          >
            {m === 'pieza' ? 'Por pieza' : 'Por cuerpo'}
          </button>
        ))}
      </div>

      {modo === 'pieza' && (
        <>
          {piezasQ.isLoading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : (
            <div className="border border-bd rounded-md max-h-64 overflow-y-auto">
              {(piezasQ.data ?? []).map((p) => {
                const isActive = piezaSel?.id === p.id;
                const bajo = p.stockActual <= p.stockMinimo;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`w-full text-left px-3 py-2 border-b border-bd last:border-b-0 transition-colors ${
                      isActive ? 'bg-accent-soft' : 'hover:bg-bg-sunken'
                    }`}
                    onClick={() => setPiezaSel(p)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-tx">{p.nombre}</div>
                        <div className="font-mono text-xs text-tx-3">{formatCurrency(p.tarifaDia)}/día</div>
                      </div>
                      <Badge status={`Stock ${p.stockActual}`} kind={bajo ? 'warn' : 'ok'} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {piezaSel && (
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-bd">
              <div>
                <label className="block text-xs font-medium text-tx-2 mb-1">Período</label>
                <select
                  className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx"
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value as typeof periodo)}
                >
                  {PERIODOS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-tx-2 mb-1">Cantidad</label>
                <input
                  type="number"
                  min={1}
                  className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx font-mono"
                  value={cantidad}
                  onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-tx-2 mb-1">Tarifa</label>
                <div className="px-3 py-2 text-sm rounded-md border border-bd bg-bg-sunken text-tx font-mono">
                  {formatCurrency(tarifaPieza(piezaSel, periodo))}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-bd">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors disabled:opacity-50"
              disabled={!piezaSel || agregar.isPending}
              onClick={confirmarPieza}
            >
              <Icon name="plus" size={14} /> Agregar
            </button>
          </div>
        </>
      )}

      {modo === 'cuerpo' && (
        <>
          {cuerposQ.isLoading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : (
            <div className="border border-bd rounded-md max-h-64 overflow-y-auto">
              {(cuerposQ.data ?? []).map((c) => {
                const isActive = cuerpoSel?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`w-full text-left px-3 py-2 border-b border-bd last:border-b-0 transition-colors ${
                      isActive ? 'bg-accent-soft' : 'hover:bg-bg-sunken'
                    }`}
                    onClick={() => setCuerpoSel(c)}
                  >
                    <div className="text-sm font-medium text-tx">{c.nombre}</div>
                    <div className="text-xs text-tx-3">
                      {c.componentes.length} tipos · stock: {c.stockCuerposDisponibles}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {cuerpoSel && (
            <div className="space-y-3 pt-3 border-t border-bd">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-tx-2 mb-1">Período</label>
                  <select
                    className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx"
                    value={periodo}
                    onChange={(e) => setPeriodo(e.target.value as typeof periodo)}
                  >
                    {PERIODOS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-tx-2 mb-1">Cantidad de cuerpos</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx font-mono"
                    value={cantidad}
                    onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  />
                </div>
              </div>

              <div className="border border-bd rounded-md">
                <div className="px-3 py-2 bg-bg-sunken text-xs text-tx-3 uppercase tracking-wider border-b border-bd">
                  Piezas que se agregarán ({cuerpoSel.componentes.length})
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {cuerpoSel.componentes.map((c) => (
                      <tr key={c.id} className="border-t border-bd first:border-t-0">
                        <td className="px-3 py-1.5">{c.piezaTipo.nombre}</td>
                        <td className="px-3 py-1.5 text-right font-mono">×{c.cantidad}</td>
                        <td className="px-3 py-1.5 text-right font-mono font-medium">
                          {c.cantidad * cantidad} u.
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-bd">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors disabled:opacity-50"
              disabled={!cuerpoSel || agregar.isPending}
              onClick={confirmarCuerpo}
            >
              <Icon name="plus" size={14} /> Agregar cuerpo
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

> Verificar nombres de `usePiezas` y `useCuerpos` en `hooks/use-andamios.ts`. Si tienen otra firma (por ej. `useAndamiosPiezas`), ajustar los imports.

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/cotizaciones/wizard/AgregarItemModal/TabAndamio.tsx
git commit -m "feat(cotizaciones): tab andamio con expansion BOM de cuerpos"
```

---

## Task 19: TabCustom

**Files:**
- Modify: `components/cotizaciones/wizard/AgregarItemModal/TabCustom.tsx`

- [ ] **Step 1: Reescribir el tab**

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '@/components/ui/Icon';
import { useAgregarItemCotizacion } from '@/hooks/use-cotizaciones';
import { customItemSchema, type CustomItemForm } from '@/lib/schemas/cotizacion';
import type { TabChildProps } from './index';

export function TabCustom({ cotizacionId, onAdded }: TabChildProps) {
  const agregar = useAgregarItemCotizacion();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomItemForm>({
    resolver: zodResolver(customItemSchema),
    defaultValues: { descripcion: '', monto: 0 },
  });

  async function onSubmit(values: CustomItemForm) {
    await agregar.mutateAsync({
      id: cotizacionId,
      data: {
        tipo: 'CUSTOM',
        descripcion: values.descripcion,
        cantidad: 1,
        // El backend espera string Decimal; convertimos con 2 decimales.
        tarifaCustom: values.monto.toFixed(2),
      },
    });
    onAdded();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-tx mb-1">
          Descripción <span className="text-danger">*</span>
        </label>
        <input
          className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
          placeholder="Ej. Servicio especial fuera de catálogo"
          {...register('descripcion')}
        />
        {errors.descripcion && <p className="text-xs text-danger mt-1">{errors.descripcion.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-tx mb-1">
          Monto total ($) <span className="text-danger">*</span>
        </label>
        <input
          type="number"
          step="0.01"
          className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx font-mono"
          {...register('monto', { valueAsNumber: true })}
        />
        {errors.monto && <p className="text-xs text-danger mt-1">{errors.monto.message}</p>}
      </div>

      <div className="flex justify-end pt-3 border-t border-bd">
        <button
          type="submit"
          disabled={agregar.isPending}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors disabled:opacity-50"
        >
          <Icon name="plus" size={14} /> Agregar
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/cotizaciones/wizard/AgregarItemModal/TabCustom.tsx
git commit -m "feat(cotizaciones): tab custom con monto libre"
```

---

## Task 20: Step 3 — Términos, fiscal, depósito, notas

**Files:**
- Modify: `components/cotizaciones/wizard/Step3Terminos.tsx`

- [ ] **Step 1: Reescribir el Step 3**

```tsx
'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '@/components/ui/Icon';
import { FormSection } from '@/components/ui/FormSection';
import { useContactos } from '@/hooks/use-contactos';
import { useActualizarCotizacion } from '@/hooks/use-cotizaciones';
import { step3Schema, type Step3Form } from '@/lib/schemas/cotizacion';
import type { Cotizacion, CondicionesPago, TipoDocumentoFiscal } from '@/types/api';

type Props = { cotizacion: Cotizacion; onBack: () => void; onNext: () => void };

const TIPOS_DOC: { value: TipoDocumentoFiscal; label: string }[] = [
  { value: 'CF',              label: 'Consumidor Final (CF)' },
  { value: 'CCF',             label: 'Crédito Fiscal (CCF)' },
  { value: 'SUJETO_EXCLUIDO', label: 'Sujeto Excluido' },
];

const CONDICIONES: { value: CondicionesPago; label: string }[] = [
  { value: 'CONTADO', label: 'Contado' },
  { value: 'CREDITO', label: 'Crédito' },
  { value: 'OTRO',    label: 'Otro' },
];

export function Step3Terminos({ cotizacion, onBack, onNext }: Props) {
  const actualizar = useActualizarCotizacion();
  const contactosQ = useContactos({ clienteId: cotizacion.clienteId });

  // Reconstruir depositoModo del estado persistido.
  const depositoModoInicial: Step3Form['depositoModo'] =
    cotizacion.depositoPorcentaje ? 'PORCENTAJE' :
    cotizacion.depositoMonto ? 'MONTO' : 'NINGUNO';

  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } = useForm<Step3Form>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      tipoDocumentoFiscal: cotizacion.tipoDocumentoFiscal ?? 'CF',
      condicionesPago: cotizacion.condicionesPago ?? null,
      contactoFacturacionId: cotizacion.contactoFacturacionId ?? null,
      porcentajeIva: cotizacion.porcentajeIva,
      depositoModo: depositoModoInicial,
      depositoPorcentaje: cotizacion.depositoPorcentaje ? Number(cotizacion.depositoPorcentaje) : null,
      depositoMonto: cotizacion.depositoMonto ? Number(cotizacion.depositoMonto) : null,
      notas: cotizacion.notas,
      notasInternas: cotizacion.notasInternas,
    },
  });

  const tipoDoc = watch('tipoDocumentoFiscal');
  const modo = watch('depositoModo');
  const requiereContactoFact = tipoDoc === 'CCF' || tipoDoc === 'SUJETO_EXCLUIDO';

  async function onSubmit(values: Step3Form) {
    await actualizar.mutateAsync({
      id: cotizacion.id,
      data: {
        tipoDocumentoFiscal: values.tipoDocumentoFiscal,
        condicionesPago: values.condicionesPago ?? undefined,
        contactoFacturacionId: values.contactoFacturacionId ?? undefined,
        porcentajeIva: values.porcentajeIva,
        notas: values.notas ?? undefined,
        notasInternas: values.notasInternas ?? undefined,
        // Mutuamente excluyentes: solo enviamos el que corresponde al modo.
        depositoPorcentaje: values.depositoModo === 'PORCENTAJE' ? (values.depositoPorcentaje ?? undefined) : undefined,
        depositoMonto: values.depositoModo === 'MONTO' ? (values.depositoMonto ?? undefined) : undefined,
      },
    });
    onNext();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <FormSection title="Datos fiscales">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-tx mb-1.5">
              Tipo de documento fiscal <span className="text-danger">*</span>
            </label>
            <select
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx"
              {...register('tipoDocumentoFiscal')}
            >
              {TIPOS_DOC.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {errors.tipoDocumentoFiscal && (
              <p className="text-xs text-danger mt-1">{errors.tipoDocumentoFiscal.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-tx mb-1.5">
              Contacto de facturación {requiereContactoFact && <span className="text-danger">*</span>}
            </label>
            <select
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx"
              {...register('contactoFacturacionId')}
            >
              <option value="">— Sin contacto —</option>
              {contactosQ.data?.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.apellido ?? ''} {c.cargo ? `· ${c.cargo}` : ''}
                </option>
              ))}
            </select>
            {errors.contactoFacturacionId && (
              <p className="text-xs text-danger mt-1">{errors.contactoFacturacionId.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-tx mb-1.5">Condiciones de pago</label>
            <select
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx"
              {...register('condicionesPago')}
            >
              <option value="">— No especificar —</option>
              {CONDICIONES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-tx mb-1.5">% IVA</label>
            <input
              type="number"
              step="0.01"
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx font-mono"
              {...register('porcentajeIva', { valueAsNumber: true })}
            />
            {errors.porcentajeIva && (
              <p className="text-xs text-danger mt-1">{errors.porcentajeIva.message}</p>
            )}
          </div>
        </div>
      </FormSection>

      <FormSection title="Depósito (opcional)">
        <Controller
          control={control}
          name="depositoModo"
          render={({ field }) => (
            <div className="flex gap-3 mb-3">
              {(['NINGUNO', 'PORCENTAJE', 'MONTO'] as const).map((m) => (
                <label key={m} className="inline-flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={field.value === m}
                    onChange={() => field.onChange(m)}
                    className="accent-accent"
                  />
                  {m === 'NINGUNO' ? 'Sin depósito' : m === 'PORCENTAJE' ? 'Por porcentaje' : 'Monto fijo'}
                </label>
              ))}
            </div>
          )}
        />

        {modo === 'PORCENTAJE' && (
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-tx mb-1.5">% del total</label>
            <input
              type="number"
              step="0.01"
              min={0.01}
              max={100}
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx font-mono"
              {...register('depositoPorcentaje', { valueAsNumber: true })}
            />
            {errors.depositoPorcentaje && (
              <p className="text-xs text-danger mt-1">{errors.depositoPorcentaje.message}</p>
            )}
          </div>
        )}

        {modo === 'MONTO' && (
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-tx mb-1.5">Monto fijo ($)</label>
            <input
              type="number"
              step="0.01"
              min={0.01}
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx font-mono"
              {...register('depositoMonto', { valueAsNumber: true })}
            />
            {errors.depositoMonto && (
              <p className="text-xs text-danger mt-1">{errors.depositoMonto.message}</p>
            )}
          </div>
        )}
      </FormSection>

      <FormSection title="Notas">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-tx mb-1.5">Notas para el cliente</label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
              placeholder="Aclaraciones, exclusiones, etc."
              {...register('notas')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-tx mb-1.5">
              <Icon name="shield" size={12} className="inline mr-1" />
              Notas internas <span className="text-xs text-tx-3 font-normal">(no visibles al cliente)</span>
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
              {...register('notasInternas')}
            />
          </div>
        </div>
      </FormSection>

      <div className="flex justify-between gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-tx-2 border border-bd hover:bg-bg-sunken transition-colors"
          onClick={onBack}
        >
          <Icon name="arrowLeft" size={14} /> Anterior
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors disabled:opacity-50"
        >
          Siguiente <Icon name="arrowRight" size={14} />
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/cotizaciones/wizard/Step3Terminos.tsx
git commit -m "feat(cotizaciones): step 3 terminos fiscal deposito y notas"
```

---

## Task 21: Step 4 — Resumen y guardado final

**Files:**
- Modify: `components/cotizaciones/wizard/Step4Resumen.tsx`

- [ ] **Step 1: Reescribir el Step 4**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { FormSection } from '@/components/ui/FormSection';
import { useCambiarEstadoCotizacion } from '@/hooks/use-cotizaciones';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Cotizacion } from '@/types/api';

type Props = { cotizacion: Cotizacion; onBack: () => void };

export function Step4Resumen({ cotizacion, onBack }: Props) {
  const router = useRouter();
  const cambiarEstado = useCambiarEstadoCotizacion();

  function guardarBorrador() {
    router.push(`/cotizaciones/${cotizacion.id}`);
  }

  async function enviar() {
    try {
      await cambiarEstado.mutateAsync({ id: cotizacion.id, estado: 'ENVIADA' });
      router.push(`/cotizaciones/${cotizacion.id}`);
    } catch {
      // El toast lo maneja el hook. No avanzamos para que el usuario corrija.
    }
  }

  const clienteNombre =
    cotizacion.cliente.razonSocial ??
    `${cotizacion.cliente.nombre ?? ''} ${cotizacion.cliente.apellido ?? ''}`.trim();

  return (
    <div className="space-y-6">
      <FormSection title="Cliente y proyecto">
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-tx-3">Cliente</dt><dd className="text-tx">{clienteNombre}</dd>
          <dt className="text-tx-3">Proyecto</dt><dd className="text-tx">{cotizacion.proyecto?.nombre ?? '—'}</dd>
          <dt className="text-tx-3">Vencimiento</dt>
          <dd className="text-tx font-mono">{formatDate(cotizacion.fechaVencimiento)}</dd>
          <dt className="text-tx-3">Tipo DTE</dt>
          <dd className="text-tx">{cotizacion.tipoDocumentoFiscal ?? '—'}</dd>
        </dl>
      </FormSection>

      <div className="border border-bd rounded-md overflow-x-auto">
        <div className="px-4 py-2 bg-bg-sunken border-b border-bd text-sm font-medium text-tx">
          Ítems ({cotizacion.items.length})
        </div>
        <table className="w-full text-sm">
          <thead className="bg-bg-sunken text-tx-3 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Descripción</th>
              <th className="text-right px-3 py-2 font-medium w-20">Cant.</th>
              <th className="text-right px-3 py-2 font-medium w-28">Tarifa</th>
              <th className="text-right px-3 py-2 font-medium w-28">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {cotizacion.items.map((it) => (
              <tr key={it.id} className="border-t border-bd">
                <td className="px-3 py-1.5">{it.descripcion}</td>
                <td className="px-3 py-1.5 text-right font-mono">{it.cantidad}</td>
                <td className="px-3 py-1.5 text-right font-mono">{formatCurrency(it.tarifaAplicada)}</td>
                <td className="px-3 py-1.5 text-right font-mono font-medium">{formatCurrency(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-bg-sunken">
            <tr className="border-t border-bd">
              <td colSpan={3} className="text-right px-3 py-2 text-tx-2">Subtotal</td>
              <td className="text-right px-3 py-2 font-mono">{formatCurrency(cotizacion.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="text-right px-3 py-2 text-tx-2">IVA ({cotizacion.porcentajeIva}%)</td>
              <td className="text-right px-3 py-2 font-mono">{formatCurrency(cotizacion.montoIva)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="text-right px-3 py-2 font-semibold">Total</td>
              <td className="text-right px-3 py-2 font-mono font-bold text-base">{formatCurrency(cotizacion.total)}</td>
            </tr>
            {cotizacion.depositoMonto && (
              <tr>
                <td colSpan={3} className="text-right px-3 py-2 text-tx-2">Depósito</td>
                <td className="text-right px-3 py-2 font-mono">{formatCurrency(cotizacion.depositoMonto)}</td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      <div className="flex justify-between gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-tx-2 border border-bd hover:bg-bg-sunken transition-colors"
          onClick={onBack}
        >
          <Icon name="arrowLeft" size={14} /> Anterior
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm border border-bd text-tx-2 hover:bg-bg-sunken transition-colors"
            onClick={guardarBorrador}
          >
            <Icon name="check" size={14} /> Guardar como borrador
          </button>
          <button
            type="button"
            disabled={cambiarEstado.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors disabled:opacity-50"
            onClick={enviar}
          >
            <Icon name="send" size={14} /> Marcar como enviada
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/cotizaciones/wizard/Step4Resumen.tsx
git commit -m "feat(cotizaciones): step 4 resumen con guardado y envio"
```

---

## Task 22: Ruta `/cotizaciones/[id]/editar`

**Files:**
- Create: `app/(dashboard)/cotizaciones/[id]/editar/page.tsx`

- [ ] **Step 1: Crear la ruta**

```tsx
'use client';

import { use } from 'react';
import { CotizacionWizard } from '@/components/cotizaciones/wizard/CotizacionWizard';

// Next.js 19 entrega `params` como Promise; usar `use()` para desempaquetar
// en Client Components — RSC no aplica acá porque el wizard lleva hooks.
export default function EditarCotizacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CotizacionWizard cotizacionId={id} />;
}
```

> Verificar el patrón de `params` que usan los otros `[id]` del proyecto (p.ej. `app/(dashboard)/proyectos/[id]/page.tsx`). Si los demás usan `params` síncrono, alinear a ese estilo.

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/cotizaciones/\[id\]/editar/page.tsx
git commit -m "feat(cotizaciones): ruta de edicion reusa wizard precargado"
```

---

## Task 23: Página de detalle — esqueleto

**Files:**
- Create: `app/(dashboard)/cotizaciones/[id]/page.tsx`

- [ ] **Step 1: Crear la página**

```tsx
'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { CotizacionStatusBadge } from '@/components/cotizaciones/CotizacionStatusBadge';
import { ItemsTabla } from '@/components/cotizaciones/detalle/ItemsTabla';
import { ResumenLateral } from '@/components/cotizaciones/detalle/ResumenLateral';
import { AccionesEstado } from '@/components/cotizaciones/detalle/AccionesEstado';
import { useCotizacion } from '@/hooks/use-cotizaciones';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

export default function CotizacionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: cot, isLoading } = useCotizacion(id);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }
  if (!cot) {
    return (
      <EmptyState icon="fileText" title="No encontrada" message="La cotización no existe o fue eliminada." />
    );
  }

  // Los botones de escritura se ocultan en VISUALIZADOR. El sidebar de Cliente,
  // fechas y timeline sigue visible — lectura para todos.
  const puedeEscribir = user?.rol !== 'VISUALIZADOR';

  return (
    <div>
      <PageHeader
        title={cot.numeroCotizacion}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span>{cot.cliente.razonSocial ?? cot.cliente.nombre}</span>
            <span className="text-tx-3">·</span>
            <span className="font-mono text-xs">{formatDate(cot.fechaCreacion)}</span>
            <CotizacionStatusBadge estado={cot.estado} />
          </span>
        }
        back
        onBack={() => router.push('/cotizaciones')}
        actions={puedeEscribir ? <AccionesEstado cotizacion={cot} /> : null}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          <ItemsTabla cotizacion={cot} />

          {cot.condicionesPago && (
            <div className="bg-bg border border-bd rounded-md p-4">
              <h3 className="text-sm font-medium text-tx mb-2">Condiciones de pago</h3>
              <p className="text-sm text-tx-2">{cot.condicionesPago}</p>
            </div>
          )}

          {(cot.notas || cot.notasInternas) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cot.notas && (
                <div className="bg-bg border border-bd rounded-md p-4">
                  <h3 className="text-sm font-medium text-tx mb-2">Notas para el cliente</h3>
                  <p className="text-sm text-tx-2 whitespace-pre-wrap">{cot.notas}</p>
                </div>
              )}
              {cot.notasInternas && puedeEscribir && (
                <div className="bg-bg-sunken border border-bd rounded-md p-4">
                  <h3 className="text-sm font-medium text-tx mb-2">Notas internas</h3>
                  <p className="text-sm text-tx-2 whitespace-pre-wrap">{cot.notasInternas}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <ResumenLateral cotizacion={cot} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crear stubs de los tres componentes**

```tsx
// components/cotizaciones/detalle/ItemsTabla.tsx
import type { Cotizacion } from '@/types/api';
export function ItemsTabla(_: { cotizacion: Cotizacion }) { return null; }
```

```tsx
// components/cotizaciones/detalle/ResumenLateral.tsx
import type { Cotizacion } from '@/types/api';
export function ResumenLateral(_: { cotizacion: Cotizacion }) { return null; }
```

```tsx
// components/cotizaciones/detalle/AccionesEstado.tsx
'use client';
import type { Cotizacion } from '@/types/api';
export function AccionesEstado(_: { cotizacion: Cotizacion }) { return null; }
```

- [ ] **Step 3: Verificar tipos**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/cotizaciones/\[id\]/page.tsx components/cotizaciones/detalle/
git commit -m "feat(cotizaciones): pagina de detalle con stubs"
```

---

## Task 24: `ItemsTabla` del detalle (solo lectura)

**Files:**
- Modify: `components/cotizaciones/detalle/ItemsTabla.tsx`

- [ ] **Step 1: Reescribir el componente**

```tsx
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/utils';
import type { Cotizacion, PeriodoItem, TipoItemCotizacion } from '@/types/api';

const PERIODO_LABEL: Record<PeriodoItem, string> = {
  DIA: 'Día', SEMANA: 'Semana', QUINCENA: 'Quincena', MES: 'Mes', CUSTOM: 'Custom',
};
const TIPO_LABEL: Record<TipoItemCotizacion, string> = {
  EQUIPO: 'Equipo', HERRAMIENTA: 'Herramienta', SERVICIO: 'Servicio',
  CONSUMIBLE: 'Consumible', PIEZA_ANDAMIO: 'Andamio', CUSTOM: 'Custom',
};

export function ItemsTabla({ cotizacion }: { cotizacion: Cotizacion }) {
  const { items, subtotal, montoIva, total, porcentajeIva } = cotizacion;
  return (
    <div className="border border-bd rounded-md overflow-x-auto bg-bg">
      <div className="px-4 py-2.5 border-b border-bd flex items-center justify-between">
        <h3 className="text-sm font-medium text-tx">Ítems cotizados</h3>
        <span className="text-xs text-tx-3">{items.length} líneas</span>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-bg-sunken text-tx-3 text-xs uppercase tracking-wider">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Descripción</th>
            <th className="text-left px-3 py-2 font-medium w-28">Período</th>
            <th className="text-right px-3 py-2 font-medium w-16">Cant.</th>
            <th className="text-right px-3 py-2 font-medium w-28">Tarifa</th>
            <th className="text-right px-3 py-2 font-medium w-32">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-t border-bd">
              <td className="px-3 py-2">
                <div className="font-medium text-tx">{it.descripcion}</div>
                <div className="text-2xs text-tx-3 mt-0.5">{TIPO_LABEL[it.tipo]}</div>
              </td>
              <td className="px-3 py-2">
                <Badge
                  status={
                    PERIODO_LABEL[it.periodo] +
                    (it.periodo === 'CUSTOM' && it.periodoCustomLabel ? ` · ${it.periodoCustomLabel}` : '')
                  }
                  kind="neutral"
                />
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{it.cantidad}</td>
              <td className="px-3 py-2 text-right font-mono">
                {formatCurrency(it.tarifaAplicada)}
                {it.esTarifaCustom && (
                  <div className="mt-0.5">
                    <Badge status="CUSTOM" kind="warn" />
                  </div>
                )}
              </td>
              <td className="px-3 py-2 text-right font-mono font-medium">{formatCurrency(it.subtotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-bg-sunken">
          <tr className="border-t border-bd">
            <td colSpan={4} className="text-right px-3 py-2 text-tx-2">Subtotal</td>
            <td className="text-right px-3 py-2 font-mono">{formatCurrency(subtotal)}</td>
          </tr>
          <tr>
            <td colSpan={4} className="text-right px-3 py-2 text-tx-2">IVA ({porcentajeIva}%)</td>
            <td className="text-right px-3 py-2 font-mono">{formatCurrency(montoIva)}</td>
          </tr>
          <tr>
            <td colSpan={4} className="text-right px-3 py-2 font-semibold">Total</td>
            <td className="text-right px-3 py-2 font-mono font-bold text-base">{formatCurrency(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/cotizaciones/detalle/ItemsTabla.tsx
git commit -m "feat(cotizaciones): tabla de items del detalle con totales"
```

---

## Task 25: `ResumenLateral` con cliente, fechas, timeline y factura

**Files:**
- Modify: `components/cotizaciones/detalle/ResumenLateral.tsx`

- [ ] **Step 1: Reescribir el componente**

```tsx
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils';
import type { Cotizacion, EstadoCotizacion } from '@/types/api';
import type { IconName } from '@/components/ui/Icon';

type TimelineRow = { label: string; fecha: string; icon: IconName };

function buildTimeline(cot: Cotizacion): TimelineRow[] {
  const rows: TimelineRow[] = [];
  rows.push({ label: 'Creada',  fecha: cot.fechaCreacion, icon: 'plus' });
  if (cot.fechaEnvio) rows.push({ label: 'Enviada al cliente', fecha: cot.fechaEnvio, icon: 'send' });
  if (cot.fechaAprobacion) rows.push({ label: 'Aprobada', fecha: cot.fechaAprobacion, icon: 'check' });
  // No tenemos fecha de rechazo en el modelo; mostramos la fecha del último cambio
  // implícita en fechaVencimiento sólo si el estado es RECHAZADA para no inventar dato.
  return rows;
}

export function ResumenLateral({ cotizacion }: { cotizacion: Cotizacion }) {
  const cliente = cotizacion.cliente;
  const nombreCliente = cliente.razonSocial ?? `${cliente.nombre ?? ''} ${cliente.apellido ?? ''}`.trim();
  const rows = buildTimeline(cotizacion);

  return (
    <aside className="space-y-4">
      <Card>
        <h3 className="text-sm font-medium text-tx mb-3">Cliente</h3>
        <div className="text-tx font-semibold">{nombreCliente}</div>
        <div className="text-xs text-tx-3 font-mono mt-0.5">
          {cliente.tipo === 'EMPRESA' ? `NIT ${cliente.nit ?? '—'}` : `DUI ${cliente.dui ?? '—'}`}
        </div>
        <dl className="mt-3 space-y-1.5 text-sm">
          {cotizacion.proyecto && (
            <div className="flex justify-between gap-2">
              <dt className="text-tx-3">Proyecto</dt>
              <dd className="text-tx text-right">{cotizacion.proyecto.nombre}</dd>
            </div>
          )}
          {cliente.email && (
            <div className="flex justify-between gap-2">
              <dt className="text-tx-3">Email</dt>
              <dd className="text-tx text-right font-mono text-xs truncate">{cliente.email}</dd>
            </div>
          )}
          {cliente.telefono && (
            <div className="flex justify-between gap-2">
              <dt className="text-tx-3">Teléfono</dt>
              <dd className="text-tx text-right font-mono">{cliente.telefono}</dd>
            </div>
          )}
        </dl>
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-tx mb-3">Fechas</h3>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-tx-3">Creación</dt>
            <dd className="text-tx font-mono">{formatDate(cotizacion.fechaCreacion)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-tx-3">Envío</dt>
            <dd className="text-tx font-mono">
              {cotizacion.fechaEnvio ? formatDate(cotizacion.fechaEnvio) : '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-tx-3">Vencimiento</dt>
            <dd className="text-tx font-mono">{formatDate(cotizacion.fechaVencimiento)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-tx-3">Aprobación</dt>
            <dd className="text-tx font-mono">
              {cotizacion.fechaAprobacion ? formatDate(cotizacion.fechaAprobacion) : '—'}
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-tx mb-3">Timeline</h3>
        <ol className="space-y-3">
          {rows.map((r, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-bg-sunken text-tx-2 shrink-0">
                <Icon name={r.icon} size={11} />
              </span>
              <div className="min-w-0">
                <div className="text-sm text-tx">{r.label}</div>
                <div className="text-xs text-tx-3 font-mono">{formatDate(r.fecha)}</div>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      {cotizacion.factura && (
        <Card>
          <h3 className="text-sm font-medium text-tx mb-2">Factura generada</h3>
          <Link
            href={`/facturas/${cotizacion.factura.id}`}
            className="inline-flex items-center gap-2 text-sm font-mono text-info hover:underline"
          >
            {cotizacion.factura.numeroFactura}
            <Icon name="arrowRight" size={12} />
          </Link>
          <div className="text-xs text-tx-3 mt-1">Estado: {cotizacion.factura.estado}</div>
        </Card>
      )}
    </aside>
  );
}
```

> Si `Card` no existe en `components/ui/`, usar `<div className="bg-bg border border-bd rounded-md p-4">…</div>` directamente.

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/cotizaciones/detalle/ResumenLateral.tsx
git commit -m "feat(cotizaciones): resumen lateral con timeline y link a factura"
```

---

## Task 26: `AccionesEstado` con botones contextuales y ConfirmRow

**Files:**
- Modify: `components/cotizaciones/detalle/AccionesEstado.tsx`

- [ ] **Step 1: Reescribir el componente**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import {
  descargarCotizacionPdf,
  useCambiarEstadoCotizacion,
  useEliminarCotizacion,
} from '@/hooks/use-cotizaciones';
import type { Cotizacion } from '@/types/api';

type Confirm = null | 'eliminar' | 'enviar' | 'aprobar' | 'rechazar';

export function AccionesEstado({ cotizacion }: { cotizacion: Cotizacion }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const cambiar = useCambiarEstadoCotizacion();
  const eliminar = useEliminarCotizacion();

  const btnBase =
    'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors';

  async function aplicar(estado: 'ENVIADA' | 'APROBADA' | 'RECHAZADA') {
    try {
      await cambiar.mutateAsync({ id: cotizacion.id, estado });
      setConfirm(null);
    } catch {
      // El toast lo maneja el hook. Dejamos el ConfirmRow abierto para reintentar.
    }
  }

  async function quitar() {
    await eliminar.mutateAsync(cotizacion.id);
    router.push('/cotizaciones');
  }

  // Botones contextuales según estado: el backend bloquea cualquier transición
  // no listada en TRANSICIONES_VALIDAS, así que la UI solo expone las posibles.
  let botones: React.ReactNode = null;
  if (cotizacion.estado === 'BORRADOR') {
    botones = (
      <>
        <Link href={`/cotizaciones/${cotizacion.id}/editar`} className={`${btnBase} border border-bd text-tx-2 hover:bg-bg-sunken`}>
          <Icon name="edit" size={14} /> Editar
        </Link>
        <button type="button" className={`${btnBase} border border-bd text-danger hover:bg-danger-soft`} onClick={() => setConfirm('eliminar')}>
          <Icon name="trash" size={14} /> Eliminar
        </button>
        <button type="button" className={`${btnBase} bg-accent text-navy hover:bg-accent-dim`} onClick={() => setConfirm('enviar')}>
          <Icon name="send" size={14} /> Marcar como enviada
        </button>
      </>
    );
  } else if (cotizacion.estado === 'ENVIADA') {
    botones = (
      <>
        <button type="button" className={`${btnBase} border border-bd text-danger hover:bg-danger-soft`} onClick={() => setConfirm('rechazar')}>
          <Icon name="x" size={14} /> Rechazar
        </button>
        <button type="button" className={`${btnBase} bg-accent text-navy hover:bg-accent-dim`} onClick={() => setConfirm('aprobar')}>
          <Icon name="check" size={14} /> Aprobar
        </button>
      </>
    );
  } else if (cotizacion.estado === 'APROBADA' && cotizacion.factura) {
    botones = (
      <Link href={`/facturas/${cotizacion.factura.id}`} className={`${btnBase} border border-bd text-tx-2 hover:bg-bg-sunken`}>
        <Icon name="receipt" size={14} /> Ver factura {cotizacion.factura.numeroFactura}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`${btnBase} border border-bd text-tx-2 hover:bg-bg-sunken`}
        onClick={() => void descargarCotizacionPdf(cotizacion.id, cotizacion.numeroCotizacion)}
      >
        <Icon name="download" size={14} /> PDF
      </button>
      {botones}

      {/* Confirmaciones inline — se renderizan debajo del header en el flujo del DOM */}
      {confirm && (
        <div className="mt-3 w-full">
          {confirm === 'eliminar' && (
            <ConfirmRow
              message={`Eliminar el borrador ${cotizacion.numeroCotizacion}? Las reservas de equipos se liberan.`}
              confirmLabel="Eliminar"
              onCancel={() => setConfirm(null)}
              onConfirm={quitar}
            />
          )}
          {confirm === 'enviar' && (
            <ConfirmRow
              message="Marcar como enviada al cliente? No podrás editar más ítems."
              confirmLabel="Marcar enviada"
              variant="primary"
              onCancel={() => setConfirm(null)}
              onConfirm={() => aplicar('ENVIADA')}
            />
          )}
          {confirm === 'aprobar' && (
            <ConfirmRow
              message="Aprobar la cotización? Se generará la factura y se rentean los equipos."
              confirmLabel="Aprobar"
              variant="primary"
              onCancel={() => setConfirm(null)}
              onConfirm={() => aplicar('APROBADA')}
            />
          )}
          {confirm === 'rechazar' && (
            <ConfirmRow
              message="Rechazar la cotización? Las reservas se liberan y no se podrá reabrir."
              confirmLabel="Rechazar"
              onCancel={() => setConfirm(null)}
              onConfirm={() => aplicar('RECHAZADA')}
            />
          )}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/cotizaciones/detalle/AccionesEstado.tsx
git commit -m "feat(cotizaciones): acciones contextuales del detalle con confirm row"
```

---

## Task 27: Smoke test integral + lint final

**Files:** ninguno (verificación)

- [ ] **Step 1: Verificación de tipos completa**

```bash
pnpm tsc --noEmit
```

Expected: 0 errores.

- [ ] **Step 2: Lint**

```bash
pnpm lint
```

Expected: 0 warnings nuevos. Si hay warnings preexistentes en el repo, anotarlos como no introducidos por esta rama.

- [ ] **Step 3: Smoke test manual con `pnpm dev`**

Iniciar backend y frontend. Verificar los flujos:

1. `/cotizaciones`
   - [ ] Carga la lista (puede estar vacía).
   - [ ] Toggle Lista ↔ Pipeline funciona.
   - [ ] Buscar y filtrar por estado funcionan.
2. Crear: `/cotizaciones/nueva`
   - [ ] Buscar cliente lo muestra en typeahead.
   - [ ] Tras "Siguiente" la URL cambia a `/cotizaciones/<id>/editar`.
   - [ ] Recargar el browser conserva el borrador.
3. Agregar ítems en Paso 2:
   - [ ] EQUIPO: aparece en tabla, totales se actualizan.
   - [ ] HERRAMIENTA: cantidad se acota por disponibilidad.
   - [ ] CONSUMIBLE: bloqueado si cantidad > stockActual.
   - [ ] SERVICIO: agrega correctamente.
   - [ ] ANDAMIO por pieza: ok.
   - [ ] ANDAMIO por cuerpo: expande a N filas con descripción `[Cuerpo: ...] ...`.
   - [ ] CUSTOM: descripción + monto se persisten como tipo CUSTOM.
4. Step 3: cambiar tipo doc a CCF sin elegir contacto facturación debe mostrar error inline al someter.
5. Step 4:
   - [ ] "Guardar como borrador" → redirige al detalle, estado BORRADOR.
   - [ ] "Marcar como enviada" → estado ENVIADA, botones del detalle cambian.
6. Detalle:
   - [ ] PDF descarga.
   - [ ] Botones por estado coinciden con tabla del spec §6.7.
   - [ ] Aprobar muestra toast y crea factura (revisar Network /facturas + estado APROBADA).
   - [ ] Conflicto: si un equipo fue rentado en otro tab antes de aprobar, toast.error con CONFLICTO_APROBACION.
7. Editar: `/cotizaciones/<id>/editar` carga el wizard con datos.
8. Dark mode: alternar tweaks, ninguna pantalla se rompe.
9. VISUALIZADOR: con `useAuthStore` mockeado o un usuario VISUALIZADOR, no aparecen botones de escritura ni el de "Nueva cotización".

Si algún punto falla, abrir el área correspondiente con la tarea relacionada arriba.

- [ ] **Step 4: Commit final si hubo ajustes**

```bash
git status
git add -A   # solo si hay cambios
git commit -m "chore(cotizaciones): ajustes post smoke test" || echo "Sin cambios"
```

- [ ] **Step 5: Push y crear PR (opcional, según el usuario lo pida)**

```bash
git push -u origin feat/cotizaciones
```

---

## Self-review

Pasé el plan revisando el spec sección por sección:

- **§1 Objetivo**: lista + wizard + edición + detalle + PDF + realtime → tareas 6-26 lo cubren.
- **§2 Endpoints**: cada uno tiene un hook en task 3, y un caller específico en tasks 7-26.
- **§4 Payload por tipo**: 6 tabs (tasks 14-19), discriminated union en types (task 1) y manejo de CUSTOM/expansión BOM cubiertos.
- **§5 Rutas**: page lista (task 6), nueva (task 11), [id] (task 23), [id]/editar (task 22).
- **§6.1 Hook layer**: todos los hooks listados están en task 3.
- **§6.2 Types**: task 1.
- **§6.3 Schemas Zod**: task 2.
- **§6.4 Componentes**: cada uno tiene su task numbered.
- **§6.5 Wizard flujo**: persistencia incremental en Step1 (task 10), creación auto + URL replace ✓.
- **§6.6 Lista pipeline**: tasks 6-8.
- **§6.7 Detalle por estado**: task 26 implementa la tabla del spec.
- **§6.8 Realtime**: task 4 (hook), usado en task 9.
- **§6.9 PDF**: helper en task 3, consumido en task 7 y 26.
- **§7 Convenciones**: comentarios "why" en español incluidos en hooks y componentes clave.
- **§9 Riesgos**: cuerpo de andamio con manejo de falla parcial → task 18.

Type consistency: `Cotizacion`, `CotizacionItem`, `AgregarItemDto`, `EditarItemDto`, `PeriodoItem`, `EstadoCotizacion`, `TipoDocumentoFiscal` usados de manera consistente entre tasks 1, 3, y todos los componentes.

Sin placeholders/TODOs en pasos.
