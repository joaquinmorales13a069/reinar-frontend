# Rama 13 — Pagos (`feat/pagos`)

**Fecha:** 2026-05-27
**Rama frontend:** `feat/pagos`
**PR dependiente en server:** sí (sin migración Prisma; solo nuevo endpoint global)

## Objetivo

Habilitar el módulo de Pagos del ERP: una vista global con filtros y una página dedicada para registrar pagos contra una factura pendiente. La gestión inline de pagos dentro del detalle de factura ya existe (`PagosCard` + `RegistrarPagoForm`) y no se toca su comportamiento — esta rama agrega la vista cross-factura.

## Contexto del backend

El módulo `pagos` del server actualmente expone los pagos como **sub-recurso de facturas**:

```
POST   /api/v1/facturas/:facturaId/pagos       (ADMIN/GERENTE/OPERADOR)
GET    /api/v1/facturas/:facturaId/pagos       (todos)
DELETE /api/v1/facturas/:facturaId/pagos/:id   (ADMIN)
```

Hechos relevantes del modelo `Pago`:

- Campos: `id, facturaId, monto (Decimal), fecha, metodoPago, referencia?, notas?, createdAt`.
- **No existe campo `tipo`**. El plan original mencionaba PAGO/ANTICIPO/DEPOSITO, pero el schema real solo usa `metodoPago` con valor `ANTICIPO` para distinguir los depósitos creados internamente por el service de cotizaciones al aprobar.
- `metodoPago` aceptado por HTTP: `EFECTIVO | TRANSFERENCIA | CHEQUE | TARJETA | OTRO`. `ANTICIPO` se omite intencionalmente en `crearPagoSchema` porque solo se crea desde el flujo de aprobación de cotización.
- Al crear/eliminar un pago, el service ejecuta `_recalcularSaldo()` dentro de la transacción: actualiza `montoPagado`, `saldoPendiente` y `estado` (`PENDIENTE | PARCIAL | PAGADA`) de la factura. Si la factura está `ANULADA`, no se aceptan pagos ni eliminaciones (422 `ESTADO_INVALIDO`).
- El backend no tiene `GET /pagos/:id` global ni búsqueda por `numeroFactura` en `GET /facturas`.

## Cambios en el backend (PR separado, mergeado primero)

**Sin migración Prisma.** Solo nuevo controller, routes y schema.

### Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| `src/modules/pagos/pagos.schemas.ts` | Agregar `listarPagosGlobalQuery` |
| `src/modules/pagos/pagos.service.ts` | Agregar `listarPagosGlobal(filtros)` |
| `src/modules/pagos/pagos.controller.ts` | Crear archivo con `listarPagosGlobal` |
| `src/modules/pagos/pagos.routes.ts` | Crear archivo con `GET /` |
| `src/app.ts` (o el index de rutas) | Montar `app.use('/api/v1/pagos', pagosRouter)` |

### Endpoint nuevo

```
GET /api/v1/pagos
  ?page=1&limit=20
  &busqueda=string       (matchea numeroFactura, cliente.razonSocial, cliente.nombre, cliente.apellido — case insensitive)
  &metodoPago=EFECTIVO|TRANSFERENCIA|CHEQUE|TARJETA|OTRO|ANTICIPO
  &clienteId=cuid
  &fechaDesde=ISO       (sobre Pago.fecha)
  &fechaHasta=ISO       (sobre Pago.fecha)

Roles: todos (mismo que listar pagos por factura).
```

**Por qué incluir `ANTICIPO` en el filtro:** se permite filtrar pero no crear desde el frontend. Permite que ADMIN/GERENTE auditen los depósitos de cotización aprobados (que no aparecerían si se omitieran).

### Schema Zod (`listarPagosGlobalQuery`)

```typescript
export const listarPagosGlobalQuery = z.object({
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(20),
  busqueda:   z.string().trim().min(1).optional(),
  metodoPago: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'TARJETA', 'OTRO', 'ANTICIPO']).optional(),
  clienteId:  z.string().cuid().optional(),
  fechaDesde: z.string().datetime().optional(),
  fechaHasta: z.string().datetime().optional(),
})
```

### Shape de respuesta

```typescript
// data: PagoListItem[]
{
  id: string,
  monto: string,                          // Decimal serializado
  fecha: string,                          // ISO
  metodoPago: MetodoPago,
  referencia: string | null,
  notas: string | null,
  createdAt: string,
  factura: {
    id: string,
    numeroFactura: string,
    estado: EstadoFactura,
    cliente: {                            // 5 campos para que el frontend componga el nombre
      id: string,
      tipo: 'EMPRESA' | 'PARTICULAR',
      razonSocial: string | null,
      nombre: string | null,
      apellido: string | null,
    },
  },
}
// meta: { page, limit, total }
```

Se devuelven los 5 campos del cliente (mismo patrón que `FacturaListItem` y `CotizacionListItem`) porque `EMPRESA` usa `razonSocial` y `PARTICULAR` usa `nombre + apellido`; uno solo no alcanza.

### Service — bosquejo

```typescript
export async function listarPagosGlobal(filtros: ListarPagosGlobalQuery) {
  const { page, limit, busqueda, metodoPago, clienteId, fechaDesde, fechaHasta } = filtros

  const where: Prisma.PagoWhereInput = {
    ...(metodoPago && { metodoPago }),
    ...((fechaDesde || fechaHasta) && {
      fecha: {
        ...(fechaDesde && { gte: new Date(fechaDesde) }),
        ...(fechaHasta && { lte: new Date(fechaHasta) }),
      },
    }),
    ...((clienteId || busqueda) && {
      factura: {
        ...(clienteId && { clienteId }),
        ...(busqueda && {
          OR: [
            { numeroFactura: { contains: busqueda, mode: 'insensitive' } },
            { cliente: { razonSocial: { contains: busqueda, mode: 'insensitive' } } },
            { cliente: { nombre:      { contains: busqueda, mode: 'insensitive' } } },
            { cliente: { apellido:    { contains: busqueda, mode: 'insensitive' } } },
          ],
        }),
      },
    }),
  }

  const skip = (page - 1) * limit
  const [data, total] = await Promise.all([
    prisma.pago.findMany({
      where, skip, take: limit,
      orderBy: { fecha: 'desc' },
      select: {
        id: true, monto: true, fecha: true, metodoPago: true,
        referencia: true, notas: true, createdAt: true,
        factura: {
          select: {
            id: true, numeroFactura: true, estado: true,
            cliente: { select: { id: true, tipo: true, razonSocial: true, nombre: true, apellido: true } },
          },
        },
      },
    }),
    prisma.pago.count({ where }),
  ])

  return { data, meta: { page, limit, total } }
}
```

## Cambios en el frontend (`feat/pagos`)

### Archivos

| Archivo | Acción | Propósito |
|---|---|---|
| `app/(dashboard)/pagos/page.tsx` | Crear | Página listado global |
| `app/(dashboard)/pagos/nuevo/page.tsx` | Crear | Página registrar pago (con selector + form reutilizado) |
| `components/pagos/PagosFilters.tsx` | Crear | Búsqueda + chips método + rango fechas + selector cliente |
| `components/pagos/PagosTabla.tsx` | Crear | Tabla con paginación, eliminar inline, expansión a panel de detalle |
| `components/pagos/PagoDetallePanel.tsx` | Crear | Card inline con notas/referencia completa (datos del listado, sin request adicional) |
| `components/pagos/SelectorFacturaPendiente.tsx` | Crear | Typeahead client-side de facturas con saldo > 0 |
| `components/pagos/RegistrarPagoForm.tsx` | Crear (mover) | Mover desde `components/facturas/detalle/RegistrarPagoForm.tsx` a una ubicación neutral; agregar prop `onSuccess?` para el flujo standalone. Actualizar import en `PagosCard.tsx`. |
| `hooks/use-pagos.ts` | Extender | Agregar `useListadoPagos(filtros)` y `useFacturasPendientes()` |
| `types/api.ts` | Extender | Agregar `PagoListItem`, `FiltrosPagos`, `ListadoPagosResponse` |

`RegistrarPagoForm` se mueve a `components/pagos/` porque ahora lo consumen tanto el detalle de factura como `/pagos/nuevo`; mantenerlo bajo `facturas/detalle/` ocultaría el reuso. Los archivos `PagosCard.tsx` y la página de detalle se actualizan para importarlo desde la nueva ubicación.

### Hook `useListadoPagos`

```typescript
export function useListadoPagos(filtros: FiltrosPagos) {
  return useQuery({
    queryKey: ['pagos-listado', filtros],
    queryFn: () =>
      api
        .get<PaginatedResponse<PagoListItem>>('/pagos', { params: filtros })
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          return r.data;
        }),
    placeholderData: (prev) => prev,
  });
}
```

QueryKey separado (`pagos-listado`) en vez de `pagos`. El existente `useListarPagos(facturaId)` usa `['pagos', facturaId]` para los pagos de una sola factura — son consultas independientes, sin solapamiento de invalidación. Tras un `useCrearPago` se invalidan ambos: `['pagos', facturaId]`, `['pagos-listado']`, `['factura', facturaId]`, `['facturas']`. Se actualiza el `onSuccess` de `useCrearPago` y `useEliminarPago` para invalidar también `['pagos-listado']`.

### Hook `useFacturasPendientes`

Carga puntual para alimentar el typeahead — sin filtro de servidor, paginación alta:

```typescript
export function useFacturasPendientes() {
  return useQuery({
    queryKey: ['facturas-pendientes'],
    // Cargamos hasta 100 facturas y filtramos client-side. El backend no
    // soporta filtrar por múltiples estados ni buscar por numeroFactura,
    // y el volumen esperado (decenas) hace que esto sea suficiente.
    queryFn: () =>
      api
        .get<PaginatedResponse<FacturaListItem>>('/facturas', { params: { limit: 100 } })
        .then((r) => {
          if (!r.data.success) throw new Error(r.data.error.message);
          // Solo facturas con saldo > 0 y estado cobrabe.
          return r.data.data.filter((f) =>
            ['PENDIENTE', 'PARCIAL', 'VENCIDA'].includes(f.estado) &&
            new Decimal(f.saldoPendiente).gt(0)
          );
        }),
    staleTime: 30_000,
  });
}
```

### Página `/pagos`

```tsx
'use client';

export default function PagosPage() {
  const [filtros, setFiltros] = useState<FiltrosPagos>({ page: 1, limit: 20 });
  const { user } = useAuthStore();
  const isAdmin    = user?.rol === 'ADMIN';
  const puedeCrear = user?.rol !== 'VISUALIZADOR';

  const { data, isLoading } = useListadoPagos(filtros);
  const pagos = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  // Total visible: suma de la página actual. El total cross-páginas no se
  // expone — se reserva para la rama de reportes.
  const sumaPagina = pagos.reduce((s, p) => s.add(p.monto), new Decimal(0));

  return (
    <div>
      <PageHeader
        title="Pagos"
        subtitle={`${total} pago${total === 1 ? '' : 's'} · ${formatCurrency(sumaPagina.toString())} en esta página`}
        actions={puedeCrear ? <Link href="/pagos/nuevo"><button>+ Registrar pago</button></Link> : null}
      />
      <PagosFilters value={filtros} onChange={(f) => setFiltros({ ...f, page: 1 })} />
      <PagosTabla
        pagos={pagos}
        loading={isLoading}
        page={filtros.page!}
        pageSize={filtros.limit!}
        total={total}
        onPage={(p) => setFiltros((f) => ({ ...f, page: p }))}
        canDelete={isAdmin}
      />
    </div>
  );
}
```

### Página `/pagos/nuevo`

```tsx
'use client';

export default function NuevoPagoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const facturaIdPre = searchParams.get('facturaId');
  // Soporta deep-link desde el detalle de factura para que el usuario no
  // tenga que volver a buscar lo que ya tenía en pantalla.
  const [factura, setFactura] = useState<FacturaListItem | null>(null);

  // Si llega ?facturaId=xxx, la pre-seleccionamos cuando la lista esté lista.
  const { data: pendientes = [], isLoading } = useFacturasPendientes();
  useEffect(() => {
    if (facturaIdPre && !factura) {
      const f = pendientes.find((x) => x.id === facturaIdPre);
      if (f) setFactura(f);
    }
  }, [facturaIdPre, pendientes, factura]);

  return (
    <div>
      <PageHeader title="Registrar pago" subtitle="..." back onBack={() => router.push('/pagos')} />
      <FormSection title="Factura">
        {factura
          ? <FacturaSeleccionadaCard factura={factura} onClear={() => setFactura(null)} />
          : <SelectorFacturaPendiente facturas={pendientes} loading={isLoading} onSelect={setFactura} />}
      </FormSection>
      {factura && (
        <FormSection title="Datos del pago">
          <RegistrarPagoForm
            facturaId={factura.id}
            saldoPendiente={factura.saldoPendiente}
            onSuccess={() => router.push('/pagos')}
          />
        </FormSection>
      )}
    </div>
  );
}
```

### `RegistrarPagoForm` — cambios mínimos

Hoy tiene `onClose: () => void` que se llama también al éxito. Se agrega `onSuccess?: () => void`:

```typescript
type Props = {
  facturaId: string;
  saldoPendiente: string;
  onClose?: () => void;     // cerrar form inline (usado por PagosCard)
  onSuccess?: () => void;   // navegar después del éxito (usado por /pagos/nuevo)
};
```

Si `onSuccess` está presente se llama tras éxito; si no, se llama `onClose`. El detalle de factura sigue funcionando igual.

### UX del listado (`PagosTabla`)

- **Columnas:** ID (mono, truncado 12 chars) · Factura (link a `/facturas/[id]`) · Cliente · Método (Badge) · Referencia · Fecha · Monto (tabular-nums) · acciones.
- **Click en fila:** alterna la expansión a `PagoDetallePanel` (fila acordeón). Las notas largas no caben en la columna; el panel las muestra completas. No requiere request adicional.
- **Eliminar:** botón trash (solo `ADMIN`). Click → expande `ConfirmRow` inline en la misma fila (no modal). Si la factura está `ANULADA`, el botón se deshabilita con tooltip "Factura anulada — pago inmutable" (el backend rechazaría con 422, lo prevenimos en UI).
- **Paginación:** server-side con `meta.total`. Componente `<Pagination />` existente.
- **Estados:**
  - loading → `<Spinner />`
  - sin filtros y sin datos → `<EmptyState icon="dollar" title="Sin pagos" message="Aún no se han registrado pagos." />`
  - con filtros y sin datos → `<EmptyState icon="filter" title="Sin resultados" message="No hay pagos con esos filtros." />`

### UX del registro (`SelectorFacturaPendiente`)

- Input con ícono `search` a la izquierda, placeholder `"Buscar por número o cliente…"`.
- Dropdown con máx. 6 resultados al abrir; filtro client-side por `numeroFactura` y nombre del cliente.
- Cada ítem muestra: `numeroFactura` (mono), saldo pendiente (rojo, alineado a la derecha), nombre cliente, estado badge.
- Si no hay facturas pendientes en el sistema: `EmptyState` interno con "No hay facturas con saldo pendiente."
- Click → setea factura, cierra dropdown.
- `FacturaSeleccionadaCard` muestra: numeroFactura (mono, link a `/facturas/[id]`), cliente + estado, "Saldo pendiente" en grande (rojo) + "de Total" pequeño abajo, botón `Cambiar factura` (ghost).

## Manejo de errores y feedback

Sigue la convención del proyecto (CLAUDE.md → Toasts):

| Caso | Tratamiento |
|---|---|
| Validación inline (campo monto, fecha) | `setError(campo, { message })` con detalles del backend o Zod local — no toast |
| 422 `ESTADO_INVALIDO` (factura anulada) | `toast.error(error.message)` |
| 422 con `details[]` por campo | mapear cada detail a `setError` del campo correspondiente; si no hay path → toast |
| 401 | manejado silenciosamente por el interceptor de `lib/api.ts` |
| Red / 5xx | `toast.error("No se pudo registrar el pago.")` o `"No se pudo cargar la lista de pagos."` |
| Éxito mutation | `toast.success("Pago registrado.")` / `"Pago eliminado."` (ya en hook) |

El extractor `extractErrorMessage` ya existe en `use-pagos.ts` y se reutiliza.

## Permisos por rol

| Rol | `/pagos` GET | `/pagos/nuevo` POST | DELETE pago |
|---|---|---|---|
| ADMIN | ✓ | ✓ | ✓ |
| GERENTE | ✓ | ✓ | ✗ |
| OPERADOR / LOGISTICA | ✓ | ✓ | ✗ |
| VISUALIZADOR | ✓ | botón oculto | ✗ |

El backend es la fuente de verdad — el frontend solo oculta UI para evitar acciones inútiles y mejorar UX.

## Convención de comentarios "why" (en español)

Se agregan **solo** donde el "por qué" no es obvio. Lugares planeados:

- `useFacturasPendientes`: por qué cargamos 100 y filtramos client-side (backend no soporta múltiples estados ni búsqueda por número).
- `useListadoPagos` y el `onSuccess` de `useCrearPago`/`useEliminarPago`: por qué `['pagos-listado']` se invalida además de `['pagos', facturaId]`.
- `PagosFilters`: por qué `ANTICIPO` aparece como chip filtrable pero no como opción al crear.
- `RegistrarPagoForm`: por qué se acepta sobrepago con advertencia (el backend lo permite).
- Página `/pagos/nuevo`: por qué se soporta `?facturaId=` para deep-link.
- Página `/pagos`: por qué el subtítulo muestra solo la suma de la página visible.
- Listado: por qué el botón eliminar se deshabilita en facturas ANULADAS (el backend rechaza con 422; lo prevenimos en UI).

## Verificación al cerrar la rama

- `pnpm tsc --noEmit` pasa.
- `pnpm lint` pasa.
- Navegar a `/pagos`: listado carga con paginación, filtros funcionan (todos los combinables), totales visibles consistentes.
- Filtrar por `clienteId` y rango de fechas: los pagos mostrados corresponden.
- Click en factura en una fila → navega a `/facturas/[id]`.
- Expandir fila → muestra notas/referencia completas.
- Eliminar pago como ADMIN → confirma inline, desaparece, saldo de factura se recalcula al navegar al detalle.
- Eliminar pago como OPERADOR → botón no visible.
- `/pagos/nuevo` typeahead: buscar por número y por cliente, seleccionar, registrar, redirect a `/pagos`.
- `/pagos/nuevo?facturaId=xxx` pre-selecciona correctamente.
- Sobrepago: advertencia warn-soft visible, registra igual.
- Factura ANULADA: no aparece en typeahead; si está visible en listado, el botón eliminar está deshabilitado con tooltip.
- VISUALIZADOR: no ve el botón "Registrar pago" en `/pagos`.
- Dark mode: ambas páginas sin regresiones.
- Tablet 768px: ambas páginas usables.

## Fuera de alcance (esta rama)

- Exportación CSV/Excel del listado de pagos (reservado para Rama 16 — Reportes).
- Edición de pagos (el backend no la soporta y no es un caso de negocio).
- Total cross-páginas en el subtítulo del listado (reservado para Rama 16).
- Endpoint `GET /pagos/:id` (no se necesita; el listado ya trae todos los campos).
- Cambios en el flujo de aprobación de cotización que crea `ANTICIPO`.
