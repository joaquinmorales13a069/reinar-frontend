# Notas de Crédito y Retenciones — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portar a Next.js los módulos de Notas de Crédito y Retenciones consumiendo los endpoints reales del backend Express, respetando las reglas de negocio del servicio y las convenciones del repo (toasts, inline errors, comentarios "why").

**Architecture:** Cliente React Query sobre `/api/v1/notas-credito` y `/api/v1/retenciones`. Reuso de `<DteSection kind="nota">` y componentes UI existentes. Sin cambios al backend. Branch única `feat/notas-retenciones`.

**Tech Stack:** Next.js 19 App Router, React Hook Form + Zod, TanStack Query, sonner, decimal.js, Tailwind v4, TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-28-notas-retenciones-design.md`

**Verificación:** El repo **no tiene suite de tests** (ver CLAUDE.md). Verificación = `pnpm tsc --noEmit` + `pnpm lint` después de cada tarea, y smoke test manual en `http://localhost:3001` después de cada bloque de páginas.

**Convenciones aplicadas en TODO el código nuevo:**
- 100% español en UI, errores, toasts, comentarios.
- Comentarios "why" (no "what"), solo en decisiones no obvias.
- Toasts: `success` en `onSuccess`, `error` en `onError`, validación de formulario inline con `setError`.
- Tailwind v4 únicamente, sin valores arbitrarios, sin CSS vanilla.
- `decimal.js` para aritmética monetaria, `formatCurrency` para mostrar.
- `font-mono` para números de documento.

---

## Task 1: Tipos en `types/api.ts`

**Files:**
- Modify: `types/api.ts` (agregar al final, antes del cierre)

- [ ] **Step 1: Verificar tipos existentes que referenciamos**

Run: `grep -n "^export type \(Cliente\|EstadoDTE\|EstadoFactura\|FacturaListItem\)" types/api.ts`
Expected: las 4 líneas presentes. Si falta alguna, abortar y avisar.

- [ ] **Step 2: Agregar tipos de Notas de Crédito**

Insertar al final de `types/api.ts`:

```ts
// ─── Notas de Crédito ────────────────────────────────────────────────

export type TipoNotaCredito = 'TOTAL' | 'PARCIAL';

export type NotaCreditoListItem = {
  id: string;
  numero: string;
  tipo: TipoNotaCredito;
  motivo: string;
  total: string;
  estadoDTE: EstadoDTE;
  createdAt: string;
  factura: { id: string; numeroFactura: string };
};

export type NotaCredito = {
  id: string;
  numero: string;
  facturaId: string;
  factura: {
    id: string;
    numeroFactura: string;
    total: string;
    estado: EstadoFactura;
    tipoDTE: TipoDTE | null;
    estadoDTE: EstadoDTE;
    cliente: Cliente;
  };
  motivo: string;
  tipo: TipoNotaCredito;
  subtotal: string;
  montoIva: string;
  total: string;
  estadoDTE: EstadoDTE;
  dteId: string | null;
  dteControlNumber: string | null;
  dteRespuestaMH: unknown;
  createdAt: string;
  updatedAt: string;
};

export type FiltrosNotasCredito = {
  page?: number;
  limit?: number;
  facturaId?: string;
  estadoDTE?: EstadoDTE;
};

export type CrearNotaCreditoDto = {
  facturaId: string;
  motivo: string;
  tipo: TipoNotaCredito;
  // Requeridos solo cuando tipo === 'PARCIAL'. El backend valida la
  // combinacion; los enviamos como string para preservar precision Decimal.
  subtotal?: string;
  montoIva?: string;
  total?: string;
};

export type EmitirDTENotaCreditoDto = { tipoDTE: 'NC' };

// ─── Retenciones ─────────────────────────────────────────────────────

export type ComprobanteRetencionListItem = {
  id: string;
  numeroCR: string;
  porcentaje: string;
  monto: string;
  fecha: string;
  createdAt: string;
  factura: { id: string; numeroFactura: string };
  cliente: { id: string; nombre: string | null; razonSocial: string | null };
};

export type ComprobanteRetencion = {
  id: string;
  numeroCR: string;
  facturaId: string;
  factura: {
    id: string;
    numeroFactura: string;
    total: string;
    estado: EstadoFactura;
    fechaEmision: string;
    cliente: Cliente;
  };
  clienteId: string;
  cliente: Cliente;
  porcentaje: string;
  monto: string;
  fecha: string;
  notas: string | null;
  createdAt: string;
};

export type FiltrosRetenciones = {
  page?: number;
  limit?: number;
  facturaId?: string;
  clienteId?: string;
};

export type RegistrarRetencionDto = {
  facturaId: string;
  numeroCR: string;
  porcentaje: 1 | 13;
  // Decimal como string para no perder precision en la red.
  monto: string;
  // ISO datetime que satisface z.string().datetime() del backend.
  fecha: string;
  notas?: string;
};
```

- [ ] **Step 3: Verificar typecheck**

Run: `pnpm tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 4: Commit**

```bash
git add types/api.ts
git commit -m "feat(types): agregar tipos NotaCredito y ComprobanteRetencion

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Hook `use-notas-credito.ts`

**Files:**
- Create: `hooks/use-notas-credito.ts`

- [ ] **Step 1: Crear el archivo completo**

```ts
'use client';

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  PaginatedResponse,
  NotaCredito,
  NotaCreditoListItem,
  FiltrosNotasCredito,
  CrearNotaCreditoDto,
  EmitirDTENotaCreditoDto,
} from '@/types/api';

// Duplicado intencional con use-facturas.ts: el patron es lo suficientemente
// pequenno como para que abstraerlo cueste mas que el copy.
function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

// ─── Queries ─────────────────────────────────────────────────────────

export function useNotasCredito(params: FiltrosNotasCredito = {}) {
  return useQuery({
    queryKey: ['notas-credito', params],
    queryFn: () =>
      api
        .get<PaginatedResponse<NotaCreditoListItem>>('/notas-credito', { params })
        .then((r) => r.data),
  });
}

export function useNotaCredito(id: string | null | undefined) {
  return useQuery({
    queryKey: ['nota-credito', id],
    queryFn: () =>
      api.get<ApiResponse<NotaCredito>>(`/notas-credito/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────

export function useCrearNotaCredito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CrearNotaCreditoDto) =>
      api.post<ApiResponse<NotaCredito>>('/notas-credito', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (nc) => {
      qc.invalidateQueries({ queryKey: ['notas-credito'] });
      // Invalidamos factura porque crear NC modifica saldoPendiente y estado.
      qc.invalidateQueries({ queryKey: ['factura', nc.facturaId] });
      qc.invalidateQueries({ queryKey: ['facturas'] });
      toast.success('Nota de crédito creada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo crear la nota de crédito.'));
    },
  });
}

export function useEmitirDTENotaCredito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: EmitirDTENotaCreditoDto }) =>
      api.patch<ApiResponse<unknown>>(`/notas-credito/${id}/dte`, data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ['nota-credito', id] });
      qc.invalidateQueries({ queryKey: ['notas-credito'] });
      toast.success('DTE enviado al Ministerio de Hacienda.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo emitir el DTE.'));
    },
  });
}

export function useAnularDTENotaCredito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<ApiResponse<unknown>>(`/notas-credito/${id}/dte`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
      }),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['nota-credito', id] });
      qc.invalidateQueries({ queryKey: ['notas-credito'] });
      toast.success('DTE anulado.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo anular el DTE.'));
    },
  });
}

// El backend NO expone endpoint sincronizar para NC (solo facturas). El cron
// job sincronizarEstadosDTEs corre cada 5 min y actualiza los estados.
// "Sincronizar" en la UI = invalidar la query para refetch del estado real.
export function sincronizarNotaCredito(qc: QueryClient, id: string) {
  qc.invalidateQueries({ queryKey: ['nota-credito', id] });
  toast.success('Estado actualizado.');
}

// ─── PDFs ────────────────────────────────────────────────────────────

export async function descargarNotaCreditoPdfBranded(id: string, numero: string) {
  const toastId = toast.loading('Generando PDF…');
  try {
    const res = await api.get(`/notas-credito/${id}/pdf`, { responseType: 'blob' });
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

export async function descargarNotaCreditoPdfOficialDTE(id: string, numero: string) {
  const toastId = toast.loading('Generando PDF oficial DTE…');
  try {
    const res = await api.get(`/notas-credito/${id}/dte/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${numero}-DTE.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.dismiss(toastId);
  } catch (err) {
    toast.dismiss(toastId);
    toast.error(extractErrorMessage(err, 'No se pudo descargar el PDF oficial.'));
  }
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-notas-credito.ts
git commit -m "feat(hooks): use-notas-credito con queries, mutations DTE y PDFs

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Hook `use-retenciones.ts`

**Files:**
- Create: `hooks/use-retenciones.ts`

- [ ] **Step 1: Crear el archivo completo**

```ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  PaginatedResponse,
  ComprobanteRetencion,
  ComprobanteRetencionListItem,
  FiltrosRetenciones,
  RegistrarRetencionDto,
} from '@/types/api';

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

// ─── Queries ─────────────────────────────────────────────────────────

export function useRetenciones(params: FiltrosRetenciones = {}) {
  return useQuery({
    queryKey: ['retenciones', params],
    queryFn: () =>
      api
        .get<PaginatedResponse<ComprobanteRetencionListItem>>('/retenciones', { params })
        .then((r) => r.data),
  });
}

export function useRetencion(id: string | null | undefined) {
  return useQuery({
    queryKey: ['retencion', id],
    queryFn: () =>
      api.get<ApiResponse<ComprobanteRetencion>>(`/retenciones/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    enabled: !!id,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────

export function useRegistrarRetencion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RegistrarRetencionDto) =>
      api.post<ApiResponse<ComprobanteRetencion>>('/retenciones', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onSuccess: (ret) => {
      qc.invalidateQueries({ queryKey: ['retenciones'] });
      // La retencion modifica saldoPendiente y posiblemente el estado de la factura.
      qc.invalidateQueries({ queryKey: ['factura', ret.facturaId] });
      qc.invalidateQueries({ queryKey: ['facturas'] });
      toast.success('Retención registrada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo registrar la retención.'));
    },
  });
}

export function useEliminarRetencion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; facturaId: string }) =>
      api.delete<ApiResponse<unknown>>(`/retenciones/${id}`).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
      }),
    onSuccess: (_d, { facturaId }) => {
      qc.invalidateQueries({ queryKey: ['retenciones'] });
      // Eliminar restaura saldoPendiente y re-evalua estado.
      qc.invalidateQueries({ queryKey: ['factura', facturaId] });
      qc.invalidateQueries({ queryKey: ['facturas'] });
      toast.success('Retención eliminada.');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo eliminar la retención.'));
    },
  });
}

// ─── PDFs ────────────────────────────────────────────────────────────

export async function descargarRetencionPdf(id: string, numeroCR: string) {
  const toastId = toast.loading('Generando PDF…');
  try {
    const res = await api.get(`/retenciones/${id}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    // numeroCR puede traer caracteres no validos para filename; saneamos.
    const safe = numeroCR.replace(/[^a-zA-Z0-9._-]/g, '_');
    a.download = `CR-${safe}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.dismiss(toastId);
  } catch (err) {
    toast.dismiss(toastId);
    toast.error(extractErrorMessage(err, 'No se pudo descargar el PDF.'));
  }
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-retenciones.ts
git commit -m "feat(hooks): use-retenciones con queries, mutations y PDF

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Componente `FacturaTypeahead`

**Files:**
- Create: `components/notas-credito/FacturaTypeahead.tsx`

Es reusable también desde retenciones. Vive en `notas-credito/` porque NC es su primer consumidor; si en el futuro hay un tercer consumidor, se promueve a `components/facturas/`.

- [ ] **Step 1: Crear el archivo**

```tsx
'use client';

import { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { formatCurrency } from '@/lib/utils';
import type { FacturaListItem } from '@/types/api';

type Props = {
  facturas: FacturaListItem[];
  // El selector debe respetar reglas distintas para NC vs retenciones.
  // Pasamos el predicado desde el consumidor para no acoplar este componente
  // a las reglas de un modulo especifico.
  filter?: (f: FacturaListItem) => boolean;
  hint?: string;
  totalSinFiltrar?: number;
  onSelect: (f: FacturaListItem) => void;
};

function nombreCliente(c: FacturaListItem['cliente']): string {
  return c.razonSocial || `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim() || '—';
}

export function FacturaTypeahead({ facturas, filter, hint, totalSinFiltrar, onSelect }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const elegibles = useMemo(
    () => (filter ? facturas.filter(filter) : facturas),
    [facturas, filter],
  );

  const resultados = useMemo(() => {
    const base = q
      ? elegibles.filter((f) => {
          const txt = q.toLowerCase();
          const nom = nombreCliente(f.cliente).toLowerCase();
          return f.numeroFactura.toLowerCase().includes(txt) || nom.includes(txt);
        })
      : elegibles;
    return base.slice(0, 8);
  }, [elegibles, q]);

  const truncado =
    typeof totalSinFiltrar === 'number' && totalSinFiltrar > facturas.length;

  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-tx-3">
        <Icon name="search" size={14} />
      </div>
      <input
        className="w-full pl-9 pr-3 py-2 rounded-md border border-bd bg-bg text-sm"
        placeholder="Buscar por número o cliente…"
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-bg border border-bd rounded-md shadow-lg max-h-72 overflow-y-auto">
          {resultados.map((f) => (
            <button
              key={f.id}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-bg-sunken border-b border-bd last:border-b-0"
              onClick={() => {
                onSelect(f);
                setOpen(false);
                setQ('');
              }}
            >
              <div className="flex justify-between items-center">
                <span className="font-mono text-sm font-medium">{f.numeroFactura}</span>
                <span className="font-mono text-xs text-tx-2">{formatCurrency(f.total)}</span>
              </div>
              <div className="text-xs text-tx-3 mt-0.5">{nombreCliente(f.cliente)}</div>
            </button>
          ))}
          {resultados.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-tx-3">Sin coincidencias.</div>
          )}
        </div>
      )}
      {(hint || truncado) && (
        <div className="text-xs text-tx-3 mt-1">
          {hint}
          {truncado && (
            <>
              {hint ? ' · ' : ''}
              Mostrando {facturas.length} de {totalSinFiltrar}. Refiná la búsqueda.
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Verificar que `formatCurrency` existe**

Run: `grep -n "export function formatCurrency" lib/utils.ts`
Expected: una coincidencia.

- [ ] **Step 4: No commitear todavía** — se commitea junto con NC al final del bloque NC.

---

## Task 5: Componentes auxiliares NC — `MontosCard` y `FacturaOrigenCard`

**Files:**
- Create: `components/notas-credito/MontosCard.tsx`
- Create: `components/notas-credito/FacturaOrigenCard.tsx`

- [ ] **Step 1: Crear `MontosCard.tsx`**

```tsx
import { formatCurrency } from '@/lib/utils';

type Props = {
  subtotal: string | number;
  montoIva: string | number;
  total: string | number;
  porcentajeIva?: number;     // default 13
  variant?: 'detalle' | 'preview';
};

export function MontosCard({ subtotal, montoIva, total, porcentajeIva = 13, variant = 'detalle' }: Props) {
  const wrapper =
    variant === 'preview'
      ? 'rounded-md bg-bg-sunken p-4'
      : 'rounded-md border border-bd p-4';

  return (
    <div className={wrapper}>
      <table className="w-full text-sm">
        <tbody>
          <tr>
            <td className="py-1 text-tx-2">Subtotal</td>
            <td className="py-1 text-right font-mono">{formatCurrency(subtotal)}</td>
          </tr>
          <tr>
            <td className="py-1 text-tx-2">IVA ({porcentajeIva}%)</td>
            <td className="py-1 text-right font-mono">{formatCurrency(montoIva)}</td>
          </tr>
          <tr className="border-t border-bd">
            <td className="pt-2 font-semibold">Total acreditado</td>
            <td className="pt-2 text-right font-mono font-semibold text-danger">
              −{formatCurrency(total)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Crear `FacturaOrigenCard.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/utils';

type Props = {
  factura: {
    id: string;
    numeroFactura: string;
    total: string | number;
    fechaEmision?: string;
    cliente?: { razonSocial: string | null; nombre: string | null; apellido: string | null } | null;
  };
};

export function FacturaOrigenCard({ factura }: Props) {
  const nombre =
    factura.cliente?.razonSocial ||
    `${factura.cliente?.nombre ?? ''} ${factura.cliente?.apellido ?? ''}`.trim() ||
    '—';

  return (
    <div className="rounded-md bg-bg-sunken p-4">
      <div className="flex justify-between items-start gap-4">
        <div>
          <Link
            href={`/facturas/${factura.id}`}
            className="font-mono font-semibold text-accent hover:underline"
          >
            {factura.numeroFactura}
          </Link>
          <div className="text-sm text-tx-2 mt-1">{nombre}</div>
          {factura.fechaEmision && (
            <div className="text-xs text-tx-3 font-mono mt-1">
              Emitida: {formatDate(factura.fechaEmision)}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-tx-3 font-semibold">
            Total factura
          </div>
          <div className="font-mono text-lg font-semibold">{formatCurrency(factura.total)}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `pnpm tsc --noEmit`
Expected: 0 errores.

---

## Task 6: Componente `NotaCreditoForm`

**Files:**
- Create: `components/notas-credito/NotaCreditoForm.tsx`

- [ ] **Step 1: Crear el archivo**

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Decimal } from 'decimal.js';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { FacturaTypeahead } from '@/components/notas-credito/FacturaTypeahead';
import { FacturaOrigenCard } from '@/components/notas-credito/FacturaOrigenCard';
import { MontosCard } from '@/components/notas-credito/MontosCard';
import { useFacturas, useFactura } from '@/hooks/use-facturas';
import { useCrearNotaCredito } from '@/hooks/use-notas-credito';
import { formatCurrency } from '@/lib/utils';
import type { FacturaListItem, TipoNotaCredito } from '@/types/api';

type Props = { facturaIdPre?: string };

export function NotaCreditoForm({ facturaIdPre }: Props) {
  const router = useRouter();
  const crear = useCrearNotaCredito();

  // Cargamos 100 facturas recientes para el typeahead client-side; el predicado
  // filtra por estado/dte (ver justificacion en el spec, seccion 6.3).
  const facturasQ = useFacturas({ limit: 100 });
  // Si llega facturaIdPre via query param, traemos esa factura aunque no este
  // en la primera pagina del listado.
  const preQ = useFactura(facturaIdPre ?? null);

  const [seleccion, setSeleccion] = useState<FacturaListItem | null>(null);
  useEffect(() => {
    if (preQ.data && !seleccion) {
      setSeleccion({
        id: preQ.data.id,
        numeroFactura: preQ.data.numeroFactura,
        estado: preQ.data.estado,
        estadoDTE: preQ.data.estadoDTE,
        total: preQ.data.total,
        saldoPendiente: preQ.data.saldoPendiente,
        fechaEmision: preQ.data.fechaEmision,
        cliente: preQ.data.cliente,
      } as FacturaListItem);
    }
  }, [preQ.data, seleccion]);

  const [tipo, setTipo] = useState<TipoNotaCredito>('PARCIAL');
  const [subtotal, setSubtotal] = useState('');
  const [montoIva, setMontoIva] = useState('');
  const [total, setTotal] = useState('');
  const [totalManual, setTotalManual] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [confirmando, setConfirmando] = useState(false);

  // Total auto-calculado mientras el usuario no lo edite manualmente.
  const totalCalc = useMemo(() => {
    const s = Number(subtotal) || 0;
    const i = Number(montoIva) || 0;
    return s + i > 0 ? (s + i).toFixed(2) : '';
  }, [subtotal, montoIva]);
  const totalEfectivo = totalManual ? total : totalCalc;

  const facturaTotal = seleccion ? new Decimal(seleccion.total) : new Decimal(0);
  const motivoLen = motivo.trim().length;
  const motivoValido = motivoLen >= 10 && motivoLen <= 500;

  const totalNum = new Decimal(totalEfectivo || 0);
  const excedeFactura = seleccion ? totalNum.greaterThan(facturaTotal) : false;

  const montosParcialOk =
    tipo === 'TOTAL' ||
    (Number(subtotal) > 0 && Number(montoIva) >= 0 && totalNum.greaterThan(0) && !excedeFactura);

  const valido = !!seleccion && motivoValido && montosParcialOk;

  function cambiarTipo(t: TipoNotaCredito) {
    setTipo(t);
    if (t === 'TOTAL') {
      setSubtotal('');
      setMontoIva('');
      setTotal('');
      setTotalManual(false);
    }
  }

  async function onSubmit() {
    if (!seleccion) return;
    setConfirmando(false);
    try {
      const nc = await crear.mutateAsync({
        facturaId: seleccion.id,
        motivo: motivo.trim(),
        tipo,
        ...(tipo === 'PARCIAL'
          ? { subtotal, montoIva, total: totalEfectivo }
          : {}),
      });
      router.push(`/notas-credito/${nc.id}`);
    } catch {
      // Toast manejado por el hook.
    }
  }

  return (
    <div>
      <PageHeader
        title="Nueva nota de crédito"
        subtitle="Acreditá total o parcialmente una factura ya emitida."
        back
        onBack={() => router.back()}
      />

      <div className="rounded-md border border-bd p-4 mb-4">
        <h3 className="text-sm font-semibold mb-3">Factura origen</h3>
        {!seleccion ? (
          <FacturaTypeahead
            facturas={facturasQ.data?.data ?? []}
            // Acreditable solo si la factura ya esta pagada (total o parcial)
            // y tiene DTE aprobado — el backend rechaza lo contrario.
            filter={(f) => (f.estado === 'PAGADA' || f.estado === 'PARCIAL') && f.estadoDTE === 'APROBADO'}
            hint="Solo facturas PAGADA/PARCIAL con DTE APROBADO."
            totalSinFiltrar={facturasQ.data?.meta.total}
            onSelect={setSeleccion}
          />
        ) : (
          <>
            <FacturaOrigenCard factura={seleccion} />
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1 text-xs text-tx-3 hover:text-tx"
              onClick={() => setSeleccion(null)}
            >
              <Icon name="x" size={12} /> Cambiar factura
            </button>
          </>
        )}
      </div>

      <div className="rounded-md border border-bd p-4 mb-4">
        <h3 className="text-sm font-semibold mb-3">Tipo y monto</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-tx-2 mb-1">
              Tipo <span className="text-danger">*</span>
            </label>
            <div className="inline-flex rounded-md border border-bd overflow-hidden">
              {(['PARCIAL', 'TOTAL'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`px-3 py-1.5 text-xs ${
                    tipo === t ? 'bg-accent text-tx-inv' : 'bg-bg text-tx-2 hover:bg-bg-sunken'
                  }`}
                  onClick={() => cambiarTipo(t)}
                >
                  {t === 'TOTAL' ? 'Total' : 'Parcial'}
                </button>
              ))}
            </div>
            <div className="text-xs text-tx-3 mt-1">
              {tipo === 'TOTAL'
                ? 'Acredita el total de la factura. Pasa a ANULADA.'
                : 'Acreditá un monto parcial.'}
            </div>
          </div>
        </div>

        {tipo === 'PARCIAL' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <div>
              <label className="block text-xs font-medium text-tx-2 mb-1">
                Subtotal <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={subtotal}
                onChange={(e) => {
                  setSubtotal(e.target.value);
                  setTotalManual(false);
                }}
                placeholder="0.00"
                className="w-full px-2 py-1.5 rounded border border-bd bg-bg font-mono text-sm"
              />
              <div className="text-xs text-tx-3 mt-1">Monto sin IVA.</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-tx-2 mb-1">
                IVA (monto) <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={montoIva}
                onChange={(e) => {
                  setMontoIva(e.target.value);
                  setTotalManual(false);
                }}
                placeholder="0.00"
                className="w-full px-2 py-1.5 rounded border border-bd bg-bg font-mono text-sm"
              />
              <div className="text-xs text-tx-3 mt-1">Típicamente subtotal × 13%.</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-tx-2 mb-1">
                Total <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={totalEfectivo}
                onChange={(e) => {
                  setTotal(e.target.value);
                  setTotalManual(true);
                }}
                placeholder="0.00"
                className="w-full px-2 py-1.5 rounded border border-bd bg-bg font-mono text-sm font-semibold"
              />
              <div className="text-xs text-tx-3 mt-1">
                {totalManual
                  ? 'Editado manualmente. Borrá el campo para recalcular.'
                  : 'Calculado: subtotal + IVA.'}
              </div>
              {excedeFactura && (
                <div className="text-xs text-danger mt-1">
                  El total excede el total de la factura ({formatCurrency(facturaTotal.toString())}).
                </div>
              )}
            </div>
          </div>
        )}

        {tipo === 'TOTAL' && seleccion && (
          <div className="mt-4">
            <label className="block text-xs font-medium text-tx-2 mb-1">
              Montos de la factura (anulación total)
            </label>
            <MontosCard
              subtotal={seleccion.total}
              montoIva={0}
              total={seleccion.total}
              variant="preview"
            />
            <div className="text-xs text-tx-3 mt-1">
              El servidor toma estos valores directamente de la factura.
            </div>
          </div>
        )}

        <div className="mt-4">
          <label className="block text-xs font-medium text-tx-2 mb-1 flex justify-between">
            <span>Motivo <span className="text-danger">*</span></span>
            <span
              className={`font-mono text-xs ${
                motivoValido ? 'text-ok' : motivoLen > 0 ? 'text-danger' : 'text-tx-3'
              }`}
            >
              {motivoLen} / 10 mín.
            </span>
          </label>
          <textarea
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Explicá la razón de la nota de crédito (mínimo 10 caracteres)."
            className="w-full px-2 py-1.5 rounded border border-bd bg-bg text-sm"
          />
          {motivoLen > 0 && !motivoValido && (
            <div className="text-xs text-danger mt-1">
              El motivo debe tener al menos 10 caracteres.
            </div>
          )}
        </div>
      </div>

      {seleccion && tipo === 'PARCIAL' && totalNum.greaterThan(0) && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2">Preview</h3>
          <MontosCard
            subtotal={subtotal || 0}
            montoIva={montoIva || 0}
            total={totalEfectivo || 0}
            variant="preview"
          />
        </div>
      )}

      {confirmando && valido && (
        <ConfirmRow
          message={
            <>
              Esto creará una nota de crédito <b>{tipo}</b> por{' '}
              <b>
                {formatCurrency(tipo === 'TOTAL' ? seleccion!.total : totalEfectivo)}
              </b>{' '}
              contra la factura{' '}
              <span className="font-mono">{seleccion!.numeroFactura}</span>. ¿Confirmar?
            </>
          }
          confirmLabel={crear.isPending ? 'Creando…' : 'Crear nota de crédito'}
          onCancel={() => setConfirmando(false)}
          onConfirm={onSubmit}
        />
      )}

      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          className="px-3 py-1.5 text-sm rounded-md border border-bd text-tx-2 hover:bg-bg-sunken"
          onClick={() => router.back()}
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!valido || crear.isPending}
          className="px-3 py-1.5 text-sm rounded-md bg-accent text-tx-inv hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => setConfirmando(true)}
        >
          <Icon name="fileText" size={14} /> Crear nota de crédito
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm tsc --noEmit`

Si surge un error porque `FacturaListItem` no expone `saldoPendiente` o `fechaEmision`, eliminar esas props del `setSeleccion` (no las usa el form). Re-run.

Expected: 0 errores.

---

## Task 7: Página listado NC

**Files:**
- Create: `app/(dashboard)/notas-credito/page.tsx`

- [ ] **Step 1: Crear el archivo**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Decimal } from 'decimal.js';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { EstadoDteBadge } from '@/components/facturas/EstadoDteBadge';
import { useNotasCredito } from '@/hooks/use-notas-credito';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { EstadoDTE, TipoNotaCredito } from '@/types/api';

export default function NotasCreditoPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const puedeEscribir = ['ADMIN', 'GERENTE', 'OPERADOR'].includes(user?.rol ?? '');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<TipoNotaCredito | null>(null);
  const [filtroDTE, setFiltroDTE] = useState<EstadoDTE | null>(null);

  const { data, isLoading } = useNotasCredito({
    page,
    limit: 20,
    estadoDTE: filtroDTE ?? undefined,
  });

  // Backend no acepta search libre ni filtro por tipo → client-side sobre la pagina.
  const filas = (data?.data ?? []).filter((n) => {
    if (filtroTipo && n.tipo !== filtroTipo) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      n.numero.toLowerCase().includes(q) ||
      n.factura.numeroFactura.toLowerCase().includes(q) ||
      (n.motivo ?? '').toLowerCase().includes(q)
    );
  });

  const totalEmitido = filas.reduce(
    (acc, n) => acc.add(new Decimal(n.total)),
    new Decimal(0),
  );
  const total = data?.meta.total ?? 0;
  const subtitle =
    `${total} ${total === 1 ? 'nota' : 'notas'} · ` +
    `total visible: ${formatCurrency(totalEmitido.toString())}`;

  return (
    <div>
      <PageHeader
        title="Notas de Crédito"
        subtitle={subtitle}
        actions={
          puedeEscribir && (
            <Link
              href="/notas-credito/nueva"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-accent text-tx-inv hover:opacity-90"
            >
              <Icon name="plus" size={14} /> Nueva nota de crédito
            </Link>
          )
        }
      />

      <FilterBar
        search={search}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        placeholder="Buscar por número, factura o motivo…"
        chips={[
          { label: 'Total',      active: filtroTipo === 'TOTAL',      onToggle: () => setFiltroTipo(filtroTipo === 'TOTAL' ? null : 'TOTAL') },
          { label: 'Parcial',    active: filtroTipo === 'PARCIAL',    onToggle: () => setFiltroTipo(filtroTipo === 'PARCIAL' ? null : 'PARCIAL') },
          { label: 'Aprobada',   active: filtroDTE === 'APROBADO',    onToggle: () => { setFiltroDTE(filtroDTE === 'APROBADO' ? null : 'APROBADO'); setPage(1); } },
          { label: 'Procesando', active: filtroDTE === 'PROCESANDO',  onToggle: () => { setFiltroDTE(filtroDTE === 'PROCESANDO' ? null : 'PROCESANDO'); setPage(1); } },
          { label: 'Rechazada',  active: filtroDTE === 'RECHAZADO',   onToggle: () => { setFiltroDTE(filtroDTE === 'RECHAZADO' ? null : 'RECHAZADO'); setPage(1); } },
        ]}
        onClear={() => { setSearch(''); setFiltroTipo(null); setFiltroDTE(null); setPage(1); }}
      />

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : filas.length === 0 ? (
        <EmptyState icon="fileText" title="Sin notas de crédito" message="No se encontraron notas con los filtros aplicados." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-bd">
            <table className="w-full text-sm">
              <thead className="bg-bg-sunken text-xs uppercase tracking-wider text-tx-3">
                <tr>
                  <th className="text-left px-3 py-2">Número</th>
                  <th className="text-left px-3 py-2">Factura</th>
                  <th className="text-left px-3 py-2">Motivo</th>
                  <th className="text-left px-3 py-2">Tipo</th>
                  <th className="text-right px-3 py-2">Total</th>
                  <th className="text-left px-3 py-2">Estado DTE</th>
                  <th className="text-left px-3 py-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((n) => (
                  <tr
                    key={n.id}
                    className="border-t border-bd hover:bg-bg-sunken cursor-pointer"
                    onClick={() => router.push(`/notas-credito/${n.id}`)}
                  >
                    <td className="px-3 py-2 font-mono font-medium">{n.numero}</td>
                    <td className="px-3 py-2 font-mono text-tx-2">
                      <Link
                        href={`/facturas/${n.factura.id}`}
                        className="hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {n.factura.numeroFactura}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-tx-2 max-w-xs truncate">{n.motivo}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                        n.tipo === 'TOTAL' ? 'bg-danger-soft text-danger' : 'bg-warn-soft text-warn'
                      }`}>
                        {n.tipo}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-danger">
                      −{formatCurrency(n.total)}
                    </td>
                    <td className="px-3 py-2">
                      <EstadoDteBadge estado={n.estadoDTE} />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-tx-2">
                      {formatDate(n.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            pageSize={20}
            total={total}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm tsc --noEmit`

Si `Pagination` no acepta esa firma, abrir `components/ui/Pagination.tsx` y ajustar los nombres de props.

Expected: 0 errores.

- [ ] **Step 3: Smoke test (manual)**

Iniciar `pnpm dev`, navegar a `http://localhost:3001/notas-credito`. Verificar que carga, aplica filtros y pagina. Detener el server.

---

## Task 8: Página `nueva` NC

**Files:**
- Create: `app/(dashboard)/notas-credito/nueva/page.tsx`

- [ ] **Step 1: Crear el archivo**

```tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { NotaCreditoForm } from '@/components/notas-credito/NotaCreditoForm';

export default function NuevaNotaCreditoPage() {
  const sp = useSearchParams();
  // Cuando se entra desde el detalle de factura, llega `?facturaId=…`
  // y la pre-seleccionamos.
  const facturaIdPre = sp.get('facturaId') ?? undefined;
  return <NotaCreditoForm facturaIdPre={facturaIdPre} />;
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Smoke test (manual)**

Navegar a `/notas-credito/nueva`. Verificar: typeahead muestra facturas elegibles. Seleccionar una, completar PARCIAL, confirmar. Debería navegar a `/notas-credito/<id>` (página aún no implementada → 404 esperado). Repetir con TOTAL.

---

## Task 9: Página detalle NC

**Files:**
- Create: `app/(dashboard)/notas-credito/[id]/page.tsx`

- [ ] **Step 1: Crear el archivo**

```tsx
'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { EstadoDteBadge } from '@/components/facturas/EstadoDteBadge';
import { DteSection } from '@/components/dte/DteSection';
import { MontosCard } from '@/components/notas-credito/MontosCard';
import { FacturaOrigenCard } from '@/components/notas-credito/FacturaOrigenCard';
import {
  useNotaCredito,
  useEmitirDTENotaCredito,
  sincronizarNotaCredito,
  descargarNotaCreditoPdfBranded,
  descargarNotaCreditoPdfOficialDTE,
} from '@/hooks/use-notas-credito';
import { useAuthStore } from '@/stores/auth.store';
import { formatDate } from '@/lib/utils';

export default function NotaCreditoDetallePage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const esAdmin = user?.rol === 'ADMIN';
  const puedeEscribir = ['ADMIN', 'GERENTE', 'OPERADOR'].includes(user?.rol ?? '');

  const { data: nc, isLoading, error } = useNotaCredito(id);
  const emitir = useEmitirDTENotaCredito();
  const [descargando, setDescargando] = useState(false);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error || !nc) {
    return <EmptyState icon="alertTriangle" title="Nota de crédito no encontrada" message="Revisá el enlace o volvé al listado." />;
  }

  // El cliente vive en factura.cliente — DteSection lo usa para validar
  // los campos que cada tipoDTE exige (NCR, documento de identidad, etc.).
  const cliente = nc.factura.cliente;

  // Mostramos solo el tipo de DTE que corresponde (siempre NC en este flujo).
  // DteSection ya sabe que kind="nota" implica NC.

  async function onEmitir() {
    try {
      await emitir.mutateAsync({ id, data: { tipoDTE: 'NC' } });
    } catch {
      // Toast manejado por el hook.
    }
  }

  async function onDescargarBranded() {
    setDescargando(true);
    await descargarNotaCreditoPdfBranded(nc.id, nc.numero);
    setDescargando(false);
  }

  async function onDescargarDTE() {
    setDescargando(true);
    await descargarNotaCreditoPdfOficialDTE(nc.id, nc.numero);
    setDescargando(false);
  }

  return (
    <div>
      <PageHeader
        title={nc.numero}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span>{cliente.razonSocial || `${cliente.nombre ?? ''} ${cliente.apellido ?? ''}`.trim()}</span>
            <span className="text-tx-3">·</span>
            <span className={`px-2 py-0.5 rounded text-xs ${
              nc.tipo === 'TOTAL' ? 'bg-danger-soft text-danger' : 'bg-warn-soft text-warn'
            }`}>{nc.tipo}</span>
            <EstadoDteBadge estado={nc.estadoDTE} />
          </span>
        }
        back
        onBack={() => router.push('/notas-credito')}
        actions={
          <button
            type="button"
            disabled={descargando}
            onClick={onDescargarBranded}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-bd text-tx-2 hover:bg-bg-sunken disabled:opacity-50"
          >
            <Icon name="download" size={14} /> Descargar PDF
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-md border border-bd p-4">
            <h3 className="text-sm font-semibold mb-2">Motivo</h3>
            <p className="text-sm text-tx-2 leading-relaxed">{nc.motivo}</p>
          </div>

          <DteSection
            doc={{
              id: nc.id,
              // DteSection usa tipoDTE; para NC mostramos como 'NC' simbolico.
              // El componente no lo renderiza como opcion porque kind="nota".
              tipoDTE: null,
              estadoDTE: nc.estadoDTE,
              dteId: nc.dteId,
              dteControlNumber: nc.dteControlNumber,
              dteRespuestaMH: nc.dteRespuestaMH,
            }}
            kind="nota"
            cliente={cliente}
            isAdmin={esAdmin}
            isOperador={puedeEscribir}
            isEmitiendo={emitir.isPending}
            isDescargandoPdf={false}
            onEmitir={onEmitir}
            onReemitir={onEmitir}
            onSincronizar={() => sincronizarNotaCredito(qc, id)}
            onAnular={esAdmin ? () => router.push(`/notas-credito/${id}/anular-dte`) : undefined}
            onDescargarPdf={nc.estadoDTE === 'APROBADO' ? onDescargarDTE : undefined}
          />

          <div className="rounded-md border border-bd p-4">
            <h3 className="text-sm font-semibold mb-3">Factura origen</h3>
            <FacturaOrigenCard
              factura={{
                id: nc.factura.id,
                numeroFactura: nc.factura.numeroFactura,
                total: nc.factura.total,
                cliente,
              }}
            />
          </div>

          <div className="rounded-md border border-bd p-4">
            <h3 className="text-sm font-semibold mb-3">Montos acreditados</h3>
            <MontosCard subtotal={nc.subtotal} montoIva={nc.montoIva} total={nc.total} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-md border border-bd p-4">
            <h3 className="text-sm font-semibold mb-3">Datos generales</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-tx-3">Tipo</dt>
                <dd>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    nc.tipo === 'TOTAL' ? 'bg-danger-soft text-danger' : 'bg-warn-soft text-warn'
                  }`}>{nc.tipo}</span>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-tx-3">Fecha</dt>
                <dd className="font-mono">{formatDate(nc.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-tx-3">N° control DTE</dt>
                <dd className="font-mono text-xs text-right">
                  {nc.dteControlNumber ?? <span className="text-tx-3">—</span>}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-tx-3">Cliente</dt>
                <dd>
                  <Link href={`/clientes/${cliente.id}`} className="hover:underline">
                    {cliente.razonSocial || `${cliente.nombre ?? ''} ${cliente.apellido ?? ''}`.trim()}
                  </Link>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm tsc --noEmit`

Si `DteSection` rechaza alguna prop (firmas pueden haber cambiado), abrir `components/dte/DteSection.tsx`, revisar `Props` y ajustar.

Si la prop `isDescandoPdf` no existe o tiene otro nombre (`isDescargandoPdf`), corregir.

Expected: 0 errores.

- [ ] **Step 3: Smoke test (manual)**

Crear una NC desde `/notas-credito/nueva` y verificar el detalle: motivo, DteSection con botón "Emitir DTE", factura origen card, montos. Probar "Sincronizar" (refetch + toast).

---

## Task 10: Página anular DTE NC

**Files:**
- Create: `app/(dashboard)/notas-credito/[id]/anular-dte/page.tsx`

- [ ] **Step 1: Crear el archivo**

```tsx
'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { EstadoDteBadge } from '@/components/facturas/EstadoDteBadge';
import {
  useNotaCredito,
  useAnularDTENotaCredito,
} from '@/hooks/use-notas-credito';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency } from '@/lib/utils';

export default function AnularDteNotaCreditoPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: nc, isLoading } = useNotaCredito(id);
  const anular = useAnularDTENotaCredito();

  const [motivo, setMotivo] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const motivoLen = motivo.trim().length;
  const motivoValido = motivoLen >= 10 && motivoLen <= 500;

  if (user?.rol !== 'ADMIN') {
    // Defensa en profundidad: el menu no muestra esta accion a no-ADMIN,
    // pero si entran por URL directa los mandamos al detalle.
    if (typeof window !== 'undefined') router.replace(`/notas-credito/${id}`);
    return null;
  }

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (!nc) return <EmptyState icon="alertTriangle" title="Nota no encontrada" message="" />;

  const cliente = nc.factura.cliente;
  const nombreCliente = cliente.razonSocial || `${cliente.nombre ?? ''} ${cliente.apellido ?? ''}`.trim();

  async function onConfirmar() {
    setConfirmando(false);
    try {
      await anular.mutateAsync(id);
      router.push(`/notas-credito/${id}`);
    } catch {
      // Toast manejado por el hook.
    }
  }

  return (
    <div>
      <PageHeader
        title={`Anular DTE — ${nc.numero}`}
        subtitle="Acción restringida a usuarios ADMIN."
        back
        onBack={() => router.push(`/notas-credito/${id}`)}
      />

      <div className="rounded-md border border-danger bg-danger-soft p-4 mb-4 flex items-start gap-3">
        <Icon name="alertTriangle" size={20} />
        <div className="text-sm">
          <b>Esta acción es irreversible.</b> Se enviará la anulación al{' '}
          <b>Ministerio de Hacienda</b>. La nota quedará en estado <b>ANULADO</b>.
        </div>
      </div>

      <div className="rounded-md border border-bd p-4 mb-4">
        <h3 className="text-sm font-semibold mb-3">Datos de la nota de crédito</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-tx-3">N° NC</dt>
            <dd className="font-mono font-semibold">{nc.numero}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-tx-3">Factura origen</dt>
            <dd className="font-mono">{nc.factura.numeroFactura}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-tx-3">Cliente</dt>
            <dd>{nombreCliente}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-tx-3">Total acreditado</dt>
            <dd className="font-mono font-semibold text-danger">
              −{formatCurrency(nc.total)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-tx-3">N° control DTE</dt>
            <dd className="font-mono text-xs">{nc.dteControlNumber ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-tx-3">Estado actual</dt>
            <dd><EstadoDteBadge estado={nc.estadoDTE} /></dd>
          </div>
        </dl>
      </div>

      <div className="rounded-md border border-bd p-4 mb-4">
        <h3 className="text-sm font-semibold mb-3">Motivo de anulación</h3>
        <label className="block text-xs font-medium text-tx-2 mb-1 flex justify-between">
          <span>Motivo según normativa tributaria <span className="text-danger">*</span></span>
          <span
            className={`font-mono text-xs ${
              motivoValido ? 'text-ok' : motivoLen > 0 ? 'text-danger' : 'text-tx-3'
            }`}
          >
            {motivoLen} / 10 mín.
          </span>
        </label>
        <textarea
          rows={5}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Describí el motivo de la anulación según normativa tributaria…"
          className="w-full px-2 py-1.5 rounded border border-bd bg-bg text-sm"
        />
        {motivoLen > 0 && !motivoValido && (
          <div className="text-xs text-danger mt-1">
            El motivo debe tener al menos 10 caracteres.
          </div>
        )}
      </div>

      {confirmando && motivoValido && (
        <ConfirmRow
          message={
            <>
              Esta acción enviará la anulación de <b>{nc.numero}</b> al{' '}
              <b>Ministerio de Hacienda</b>. ¿Confirmar?
            </>
          }
          confirmLabel={anular.isPending ? 'Anulando…' : 'Sí, anular DTE'}
          onCancel={() => setConfirmando(false)}
          onConfirm={onConfirmar}
        />
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="px-3 py-1.5 text-sm rounded-md border border-bd text-tx-2 hover:bg-bg-sunken"
          onClick={() => router.push(`/notas-credito/${id}`)}
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!motivoValido || anular.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-danger text-tx-inv hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => setConfirmando(true)}
        >
          <Icon name="trash" size={14} /> Confirmar anulación
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Smoke test (manual)**

Solo se puede probar si hay una NC con DTE APROBADO y user ADMIN. Probar acceso directo por URL como rol no-ADMIN → debe redirigir.

---

## Task 11: Verificación final NC y commit

- [ ] **Step 1: Verificar typecheck + lint completos**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: 0 errores en ambos.

- [ ] **Step 2: Smoke test integral NC**

Iniciar `pnpm dev`. Verificar end-to-end:
1. Listado `/notas-credito` carga, filtra (chips + search), pagina.
2. Crear NC PARCIAL desde botón → confirmar → detalle.
3. En detalle, `<DteSection>` ofrece "Emitir DTE". Emitir → toast success → estado PROCESANDO o APROBADO.
4. Descargar PDF branded.
5. Si APROBADO, descargar PDF oficial DTE.
6. Como ADMIN, navegar a "Anular DTE" → completar motivo → confirmar.
7. Verificar invalidación cruzada: el saldo de la factura origen refleja el ajuste en `/facturas/<id>`.

- [ ] **Step 3: Commit**

```bash
git add components/notas-credito/ app/\(dashboard\)/notas-credito/
git commit -m "feat(notas-credito): listado, crear, detalle, DTE y anulación

Módulo de notas de crédito completo: lista con filtros y paginación,
formulario con tipos TOTAL/PARCIAL, detalle con DteSection reusada,
descarga de PDF branded y oficial DTE, página dedicada de anulación
para ADMIN. Invalidaciones cruzadas con facturas para reflejar saldo.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 12: Componentes retenciones — `TipoRetencionPicker` + `RetencionForm`

**Files:**
- Create: `components/retenciones/TipoRetencionPicker.tsx`
- Create: `components/retenciones/RetencionForm.tsx`

- [ ] **Step 1: Crear `TipoRetencionPicker.tsx`**

```tsx
'use client';

type Props = {
  value: 1 | 13;
  onChange: (v: 1 | 13) => void;
};

export function TipoRetencionPicker({ value, onChange }: Props) {
  const card = (active: boolean) =>
    `rounded-md border p-3 cursor-pointer transition-colors ${
      active ? 'border-accent bg-accent-soft' : 'border-bd hover:bg-bg-sunken'
    }`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className={card(value === 1)} onClick={() => onChange(1)}>
        <div className="font-semibold text-sm">Retención IVA 1%</div>
        <div className="text-xs text-tx-3 mt-1">
          Aplica a servicios entre contribuyentes.
        </div>
      </div>
      <div className={card(value === 13)} onClick={() => onChange(13)}>
        <div className="font-semibold text-sm">Retención IVA 13%</div>
        <div className="text-xs text-tx-3 mt-1">
          Aplica a compras de bienes entre contribuyentes.
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crear `RetencionForm.tsx`**

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Decimal } from 'decimal.js';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { FacturaTypeahead } from '@/components/notas-credito/FacturaTypeahead';
import { FacturaOrigenCard } from '@/components/notas-credito/FacturaOrigenCard';
import { TipoRetencionPicker } from '@/components/retenciones/TipoRetencionPicker';
import { useFacturas, useFactura } from '@/hooks/use-facturas';
import { useRegistrarRetencion } from '@/hooks/use-retenciones';
import { formatCurrency } from '@/lib/utils';
import type { FacturaListItem } from '@/types/api';

type Props = { facturaIdPre?: string };

export function RetencionForm({ facturaIdPre }: Props) {
  const router = useRouter();
  const registrar = useRegistrarRetencion();

  const facturasQ = useFacturas({ limit: 100 });
  const preQ = useFactura(facturaIdPre ?? null);

  const [seleccion, setSeleccion] = useState<FacturaListItem | null>(null);
  useEffect(() => {
    if (preQ.data && !seleccion) {
      setSeleccion(preQ.data as unknown as FacturaListItem);
    }
  }, [preQ.data, seleccion]);

  const [numeroCR, setNumeroCR] = useState('');
  const [porcentaje, setPorcentaje] = useState<1 | 13>(1);
  const [monto, setMonto] = useState('');
  // Permite saber si el usuario edito el monto manualmente; el efecto solo
  // recalcula cuando no fue editado o cuando cambia la factura.
  const [montoManual, setMontoManual] = useState(false);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [notas, setNotas] = useState('');

  // Pre-carga monto cuando hay factura + porcentaje y el usuario no lo tocó.
  const montoCalc = useMemo(() => {
    if (!seleccion) return '';
    return new Decimal(seleccion.total).mul(porcentaje).div(100).toFixed(2);
  }, [seleccion, porcentaje]);

  useEffect(() => {
    if (!montoManual) setMonto(montoCalc);
  }, [montoCalc, montoManual]);

  // Reset edición manual al cambiar de factura.
  useEffect(() => {
    setMontoManual(false);
  }, [seleccion?.id]);

  const facturaSaldo = seleccion
    ? new Decimal((seleccion as unknown as { saldoPendiente?: string }).saldoPendiente ?? seleccion.total)
    : new Decimal(0);
  const montoNum = new Decimal(monto || 0);
  const excedeSaldo = seleccion ? montoNum.greaterThan(facturaSaldo) : false;

  const valido =
    !!seleccion &&
    numeroCR.trim().length > 0 &&
    (porcentaje === 1 || porcentaje === 13) &&
    montoNum.greaterThan(0) &&
    !excedeSaldo &&
    !!fecha;

  async function onSubmit() {
    if (!seleccion) return;
    try {
      const r = await registrar.mutateAsync({
        facturaId: seleccion.id,
        numeroCR: numeroCR.trim(),
        porcentaje,
        monto,
        // Backend espera ISO datetime; convertimos el date input local a
        // medianoche UTC para satisfacer z.string().datetime().
        fecha: new Date(`${fecha}T00:00:00.000Z`).toISOString(),
        ...(notas.trim() ? { notas: notas.trim() } : {}),
      });
      router.push(`/retenciones/${r.id}`);
    } catch {
      // Toast manejado por el hook.
    }
  }

  return (
    <div>
      <PageHeader
        title="Registrar retención"
        subtitle="Capturá un comprobante de retención emitido por el cliente."
        back
        onBack={() => router.back()}
      />

      <div className="rounded-md border border-bd p-4 mb-4">
        <h3 className="text-sm font-semibold mb-3">Factura</h3>
        {!seleccion ? (
          <FacturaTypeahead
            facturas={facturasQ.data?.data ?? []}
            // Backend rechaza retencion contra factura ANULADA.
            filter={(f) => f.estado !== 'ANULADA'}
            hint="Solo facturas activas."
            totalSinFiltrar={facturasQ.data?.meta.total}
            onSelect={setSeleccion}
          />
        ) : (
          <>
            <FacturaOrigenCard factura={seleccion} />
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1 text-xs text-tx-3 hover:text-tx"
              onClick={() => setSeleccion(null)}
            >
              <Icon name="x" size={12} /> Cambiar factura
            </button>
          </>
        )}
      </div>

      <div className="rounded-md border border-bd p-4 mb-4">
        <h3 className="text-sm font-semibold mb-3">Datos del comprobante</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-tx-2 mb-1">
              Número de comprobante CR <span className="text-danger">*</span>
            </label>
            <input
              value={numeroCR}
              onChange={(e) => setNumeroCR(e.target.value)}
              placeholder="CR-2026-04300"
              className="w-full px-2 py-1.5 rounded border border-bd bg-bg font-mono text-sm"
            />
            <div className="text-xs text-tx-3 mt-1">Lo emite el cliente.</div>
          </div>

          <div>
            <label className="block text-xs font-medium text-tx-2 mb-1">
              Fecha <span className="text-danger">*</span>
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-2 py-1.5 rounded border border-bd bg-bg font-mono text-sm"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-tx-2 mb-1">
            Tipo de retención <span className="text-danger">*</span>
          </label>
          <TipoRetencionPicker value={porcentaje} onChange={setPorcentaje} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <div>
            <label className="block text-xs font-medium text-tx-2 mb-1">
              Monto retenido <span className="text-danger">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={monto}
              onChange={(e) => {
                setMonto(e.target.value);
                setMontoManual(true);
              }}
              placeholder="0.00"
              className="w-full px-2 py-1.5 rounded border border-bd bg-bg font-mono text-sm font-semibold"
            />
            <div className="text-xs text-tx-3 mt-1">
              {seleccion
                ? `Calculado: total × ${porcentaje}% = ${formatCurrency(montoCalc)}. Editable.`
                : 'Seleccioná una factura para pre-cargar el monto.'}
            </div>
            {excedeSaldo && (
              <div className="text-xs text-danger mt-1">
                El monto retenido excede el saldo pendiente ({formatCurrency(facturaSaldo.toString())}).
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-tx-2 mb-1">Notas</label>
          <textarea
            rows={2}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Información adicional (opcional)."
            className="w-full px-2 py-1.5 rounded border border-bd bg-bg text-sm"
            maxLength={500}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="px-3 py-1.5 text-sm rounded-md border border-bd text-tx-2 hover:bg-bg-sunken"
          onClick={() => router.back()}
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!valido || registrar.isPending}
          className="px-3 py-1.5 text-sm rounded-md bg-accent text-tx-inv hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onSubmit}
        >
          <Icon name="check" size={14} /> Registrar retención
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `pnpm tsc --noEmit`
Expected: 0 errores.

---

## Task 13: Página listado retenciones

**Files:**
- Create: `app/(dashboard)/retenciones/page.tsx`

- [ ] **Step 1: Crear el archivo**

```tsx
'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Decimal } from 'decimal.js';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import {
  useRetenciones,
  useEliminarRetencion,
  descargarRetencionPdf,
} from '@/hooks/use-retenciones';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function RetencionesPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const esAdmin = user?.rol === 'ADMIN';
  const puedeEscribir = ['ADMIN', 'GERENTE', 'OPERADOR'].includes(user?.rol ?? '');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filtroPct, setFiltroPct] = useState<1 | 13 | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ id: string; numeroCR: string; facturaId: string } | null>(null);
  const [descargando, setDescargando] = useState<string | null>(null);

  const { data, isLoading } = useRetenciones({ page, limit: 20 });
  const eliminar = useEliminarRetencion();

  const filas = (data?.data ?? []).filter((r) => {
    if (filtroPct && Number(r.porcentaje) !== filtroPct) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    const nombre = (r.cliente.razonSocial || r.cliente.nombre || '').toLowerCase();
    return (
      r.numeroCR.toLowerCase().includes(q) ||
      r.factura.numeroFactura.toLowerCase().includes(q) ||
      nombre.includes(q)
    );
  });

  const totalRetenido = filas.reduce(
    (acc, r) => acc.add(new Decimal(r.monto)),
    new Decimal(0),
  );
  const total = data?.meta.total ?? 0;
  const subtitle =
    `${total} ${total === 1 ? 'comprobante' : 'comprobantes'} · ` +
    `total visible: ${formatCurrency(totalRetenido.toString())}`;

  async function onDescargar(id: string, numeroCR: string) {
    setDescargando(id);
    await descargarRetencionPdf(id, numeroCR);
    setDescargando(null);
  }

  async function onEliminar() {
    if (!confirmDel) return;
    try {
      await eliminar.mutateAsync({ id: confirmDel.id, facturaId: confirmDel.facturaId });
      setConfirmDel(null);
    } catch {
      // Toast manejado por el hook.
    }
  }

  return (
    <div>
      <PageHeader
        title="Retenciones"
        subtitle={subtitle}
        actions={
          puedeEscribir && (
            <Link
              href="/retenciones/nueva"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-accent text-tx-inv hover:opacity-90"
            >
              <Icon name="plus" size={14} /> Registrar retención
            </Link>
          )
        }
      />

      <FilterBar
        search={search}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        placeholder="Buscar por número CR, factura o cliente…"
        chips={[
          { label: '1% IVA',  active: filtroPct === 1,  onToggle: () => setFiltroPct(filtroPct === 1 ? null : 1) },
          { label: '13% IVA', active: filtroPct === 13, onToggle: () => setFiltroPct(filtroPct === 13 ? null : 13) },
        ]}
        onClear={() => { setSearch(''); setFiltroPct(null); setPage(1); }}
      />

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : filas.length === 0 ? (
        <EmptyState icon="fileText" title="Sin retenciones" message="No se encontraron retenciones con los filtros aplicados." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-bd">
            <table className="w-full text-sm">
              <thead className="bg-bg-sunken text-xs uppercase tracking-wider text-tx-3">
                <tr>
                  <th className="text-left px-3 py-2">Número CR</th>
                  <th className="text-left px-3 py-2">Factura</th>
                  <th className="text-left px-3 py-2">Cliente</th>
                  <th className="text-right px-3 py-2">%</th>
                  <th className="text-right px-3 py-2">Monto</th>
                  <th className="text-left px-3 py-2">Fecha</th>
                  <th className="text-right px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((r) => (
                  <Fragment key={r.id}>
                    <tr
                      className="border-t border-bd hover:bg-bg-sunken cursor-pointer"
                      onClick={() => router.push(`/retenciones/${r.id}`)}
                    >
                      <td className="px-3 py-2 font-mono font-medium">{r.numeroCR}</td>
                      <td className="px-3 py-2 font-mono text-tx-2">
                        <Link
                          href={`/facturas/${r.factura.id}`}
                          className="hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.factura.numeroFactura}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{r.cliente.razonSocial || r.cliente.nombre || '—'}</td>
                      <td className="px-3 py-2 text-right font-mono">{Number(r.porcentaje).toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right font-mono font-medium text-warn">
                        −{formatCurrency(r.monto)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-tx-2">{formatDate(r.fecha)}</td>
                      <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            disabled={descargando === r.id}
                            onClick={() => onDescargar(r.id, r.numeroCR)}
                            className="px-2 py-1 rounded text-xs border border-bd hover:bg-bg-sunken disabled:opacity-50"
                          >
                            <Icon name="download" size={12} /> PDF
                          </button>
                          {esAdmin && (
                            <button
                              type="button"
                              onClick={() => setConfirmDel({ id: r.id, numeroCR: r.numeroCR, facturaId: r.factura.id })}
                              className="px-2 py-1 rounded text-xs text-danger hover:bg-danger-soft"
                              title="Eliminar (ADMIN)"
                            >
                              <Icon name="trash" size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {confirmDel?.id === r.id && (
                      <tr>
                        <td colSpan={7} className="p-2 bg-danger-soft">
                          <ConfirmRow
                            message={
                              <>¿Eliminar comprobante <b className="font-mono">{r.numeroCR}</b>? Esta acción es permanente.</>
                            }
                            confirmLabel={eliminar.isPending ? 'Eliminando…' : 'Sí, eliminar'}
                            onCancel={() => setConfirmDel(null)}
                            onConfirm={onEliminar}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} pageSize={20} total={total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm tsc --noEmit`

Si aparece error "Type '{}' is missing the following properties from type 'IntrinsicAttributes...'", revisar firmas de `Pagination`, `FilterBar`, `ConfirmRow`. Ajustar nombres de props.

Si React advierte por usar `<>` como fragment con `key`, cambiar a `<React.Fragment key={r.id}>`.

Expected: 0 errores.

---

## Task 14: Página nueva retención

**Files:**
- Create: `app/(dashboard)/retenciones/nueva/page.tsx`

- [ ] **Step 1: Crear el archivo**

```tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { RetencionForm } from '@/components/retenciones/RetencionForm';

export default function NuevaRetencionPage() {
  const sp = useSearchParams();
  const facturaIdPre = sp.get('facturaId') ?? undefined;
  return <RetencionForm facturaIdPre={facturaIdPre} />;
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm tsc --noEmit`
Expected: 0 errores.

---

## Task 15: Página detalle retención

**Files:**
- Create: `app/(dashboard)/retenciones/[id]/page.tsx`

- [ ] **Step 1: Crear el archivo**

```tsx
'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { FacturaEstadoBadge } from '@/components/facturas/FacturaEstadoBadge';
import {
  useRetencion,
  useEliminarRetencion,
  descargarRetencionPdf,
} from '@/hooks/use-retenciones';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function RetencionDetallePage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const esAdmin = user?.rol === 'ADMIN';

  const { data: ret, isLoading, error } = useRetencion(id);
  const eliminar = useEliminarRetencion();
  const [descargando, setDescargando] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error || !ret) {
    return <EmptyState icon="alertTriangle" title="Retención no encontrada" message="Revisá el enlace o volvé al listado." />;
  }

  const nombre = ret.cliente.razonSocial || `${ret.cliente.nombre ?? ''} ${ret.cliente.apellido ?? ''}`.trim();

  async function onDescargar() {
    setDescargando(true);
    await descargarRetencionPdf(ret.id, ret.numeroCR);
    setDescargando(false);
  }

  async function onEliminar() {
    try {
      await eliminar.mutateAsync({ id: ret.id, facturaId: ret.facturaId });
      router.push('/retenciones');
    } catch {
      // Toast manejado por el hook.
    }
  }

  return (
    <div>
      <PageHeader
        title={ret.numeroCR}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span>{nombre}</span>
            <span className="text-tx-3">·</span>
            <span className="px-2 py-0.5 rounded text-xs bg-warn-soft text-warn">
              {Number(ret.porcentaje).toFixed(2)}%
            </span>
          </span>
        }
        back
        onBack={() => router.push('/retenciones')}
        actions={
          <>
            <button
              type="button"
              disabled={descargando}
              onClick={onDescargar}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-bd text-tx-2 hover:bg-bg-sunken disabled:opacity-50"
            >
              <Icon name="download" size={14} /> Descargar PDF
            </button>
            {esAdmin && (
              <button
                type="button"
                onClick={() => setConfirmDel(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-bd text-danger hover:bg-danger-soft"
              >
                <Icon name="trash" size={14} /> Eliminar
              </button>
            )}
          </>
        }
      />

      {confirmDel && (
        <ConfirmRow
          message={
            <>¿Eliminar comprobante <b className="font-mono">{ret.numeroCR}</b>? Esta acción es permanente.</>
          }
          confirmLabel={eliminar.isPending ? 'Eliminando…' : 'Sí, eliminar'}
          onCancel={() => setConfirmDel(false)}
          onConfirm={onEliminar}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-md border border-bd p-4">
            <h3 className="text-sm font-semibold mb-3">Comprobante</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-tx-3">Número CR</dt><dd className="font-mono">{ret.numeroCR}</dd></div>
              <div className="flex justify-between"><dt className="text-tx-3">Porcentaje</dt><dd className="font-mono">{Number(ret.porcentaje).toFixed(2)}%</dd></div>
              <div className="flex justify-between"><dt className="text-tx-3">Monto retenido</dt><dd className="font-mono font-semibold text-warn">{formatCurrency(ret.monto)}</dd></div>
              <div className="flex justify-between"><dt className="text-tx-3">Fecha</dt><dd className="font-mono">{formatDate(ret.fecha)}</dd></div>
              <div className="flex justify-between"><dt className="text-tx-3">Cliente</dt><dd>{nombre}</dd></div>
            </dl>
          </div>

          {ret.notas && (
            <div className="rounded-md border border-bd p-4">
              <h3 className="text-sm font-semibold mb-2">Notas</h3>
              <p className="text-sm text-tx-2 leading-relaxed">{ret.notas}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-md border border-bd p-4">
            <h3 className="text-sm font-semibold mb-3">Factura vinculada</h3>
            <Link
              href={`/facturas/${ret.factura.id}`}
              className="font-mono font-semibold text-accent hover:underline"
            >
              {ret.factura.numeroFactura}
            </Link>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-tx-3">Total factura</dt><dd className="font-mono">{formatCurrency(ret.factura.total)}</dd></div>
              <div className="flex justify-between"><dt className="text-tx-3">Emisión</dt><dd className="font-mono">{formatDate(ret.factura.fechaEmision)}</dd></div>
              <div className="flex justify-between"><dt className="text-tx-3">Estado</dt><dd><FacturaEstadoBadge estado={ret.factura.estado} /></dd></div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm tsc --noEmit`
Expected: 0 errores.

---

## Task 16: Verificación retenciones y commit

- [ ] **Step 1: Verificar typecheck + lint**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: 0 errores.

- [ ] **Step 2: Smoke test integral retenciones**

Iniciar `pnpm dev`:
1. `/retenciones` lista, filtros 1%/13%, paginación.
2. Crear retención 1% desde botón: typeahead → seleccionar factura → monto pre-cargado, editar manualmente → confirmar → detalle.
3. Probar duplicado: registrar otra con mismo `numeroCR` para mismo cliente → debe mostrar toast error con mensaje del backend (P2002).
4. Descargar PDF.
5. Como ADMIN, eliminar desde detalle → vuelve al listado.
6. Verificar invalidación: el saldo de la factura origen en `/facturas/<id>` refleja la retención y vuelve al original tras eliminar.

- [ ] **Step 3: Commit**

```bash
git add components/retenciones/ app/\(dashboard\)/retenciones/
git commit -m "feat(retenciones): listado, registrar, detalle y eliminar

Módulo de retenciones completo: lista con filtros 1%/13%, formulario
con monto pre-cargado (total × %) editable, detalle con factura
vinculada, eliminar inline para ADMIN. Invalidaciones cruzadas con
facturas para reflejar saldo.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 17: Entradas desde `/facturas/[id]`, verificación final y commit

**Files:**
- Modify: `app/(dashboard)/facturas/[id]/page.tsx` (agregar dos botones en el `actions` del `PageHeader`)

- [ ] **Step 1: Identificar la zona de acciones del header**

Run: `grep -n "PageHeader\|actions" app/\(dashboard\)/facturas/\[id\]/page.tsx | head -10`
Localizar el bloque `<PageHeader … actions={…} />` o equivalente. Si las acciones viven en `HeaderAcciones`, agregar los botones ahí.

- [ ] **Step 2: Agregar los botones**

Insertar (en el lugar identificado), antes o después de los botones existentes:

```tsx
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';

// dentro del componente, con factura ya disponible y `puedeEscribir` derivado del rol:
const puedeCrearNC =
  puedeEscribir &&
  factura.estadoDTE === 'APROBADO' &&
  (factura.estado === 'PAGADA' || factura.estado === 'PARCIAL');
const puedeRegistrarRetencion = puedeEscribir && factura.estado !== 'ANULADA';

const btnNeutro = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-bd text-tx-2 hover:bg-bg-sunken';

{puedeCrearNC && (
  <Link href={`/notas-credito/nueva?facturaId=${factura.id}`} className={btnNeutro}>
    <Icon name="fileText" size={14} /> Crear nota de crédito
  </Link>
)}
{puedeRegistrarRetencion && (
  <Link href={`/retenciones/nueva?facturaId=${factura.id}`} className={btnNeutro}>
    <Icon name="fileText" size={14} /> Registrar retención
  </Link>
)}
```

Si la página ya tiene `puedeEscribir` derivado, reusarlo. Si no, agregarlo arriba:

```ts
const puedeEscribir = ['ADMIN', 'GERENTE', 'OPERADOR'].includes(user?.rol ?? '');
```

- [ ] **Step 3: Verificar typecheck + lint**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: 0 errores.

- [ ] **Step 4: Smoke test integral cross-module**

`pnpm dev`. Navegar a `/facturas/<id>` con una factura PAGADA + DTE APROBADO:
1. Aparecen ambos botones nuevos.
2. "Crear nota de crédito" → `/notas-credito/nueva?facturaId=…` con factura pre-seleccionada.
3. "Registrar retención" → `/retenciones/nueva?facturaId=…` con factura pre-seleccionada.
4. Probar con factura ANULADA: botón retención oculto.
5. Probar como VISUALIZADOR: ningún botón nuevo visible.
6. Probar dark mode: botones legibles.
7. Probar en viewport 768px: layout no rompe.

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/facturas/\[id\]/page.tsx
git commit -m "feat(facturas): botones 'Crear NC' y 'Registrar retención' en detalle

Permite iniciar el flujo desde el contexto natural — la factura —
pasando facturaId como query param para pre-seleccionar.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

- [ ] **Step 6: Push y verificación final del branch**

```bash
git push -u origin feat/notas-retenciones
git log --oneline main..HEAD
```

Expected: 4 commits (spec, NC, retenciones, cross-module) + el de tipos/hooks si los hiciste separados.

---

## Checklist de cierre

- [ ] `pnpm tsc --noEmit` limpio
- [ ] `pnpm lint` limpio
- [ ] Listados, detalles y formularios cargan datos reales del backend
- [ ] VISUALIZADOR no ve botones de escritura
- [ ] PDFs branded y oficial DTE se descargan
- [ ] Paginación funciona
- [ ] Dark mode sin regresiones
- [ ] Vista tablet (768px) sin regresiones
- [ ] Toasts: success en `onSuccess`, error en `onError`, validaciones inline
- [ ] Sin CSS vanilla en `globals.css`
- [ ] Comentarios "why" en español en decisiones no obvias
- [ ] Branch `feat/notas-retenciones` empujado
