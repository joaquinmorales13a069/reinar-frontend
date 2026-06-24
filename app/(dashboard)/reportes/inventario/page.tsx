'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { DataTable } from '@/components/ui/DataTable';
import { BodegaSelect } from '@/components/ui/BodegaSelect';
import { useClientes } from '@/hooks/use-clientes';
import { useCategorias } from '@/hooks/use-categorias';
import {
  useReporteInventario,
  useReporteInventarioDetalle,
  exportarReporteInventario,
  type InventarioBodegaResumen,
  type FormatoExportInventario,
} from '@/hooks/use-reporte-inventario';
import type { FiltrosReporteInventario, EstadoResumen } from '@/types/api';

const cardCls = 'rounded-lg border border-bd bg-surface p-4';

const selectBase =
  'px-3 py-1.5 text-sm rounded-md border border-bd bg-surface text-tx focus:outline-none focus:border-accent transition-colors';

export default function ReporteInventarioPage() {
  // ── Filtros ──────────────────────────────────────────────────────────────────
  const [clienteId, setClienteId] = useState('');
  const [bodegaId, setBodegaId] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [proyectoId, setProyectoId] = useState('');

  // Categorías de equipos de la API — el filtro del reporte es por equipo.
  const { data: categorias } = useCategorias('EQUIPO');

  const filtros: FiltrosReporteInventario = {
    ...(clienteId ? { clienteId } : {}),
    ...(bodegaId ? { bodegaId } : {}),
    // El backend espera categoriaId como parámetro de query.
    ...(categoriaId ? { categoriaId } : {}),
    ...(proyectoId ? { proyectoId } : {}),
  };

  const hayFiltros = !!(clienteId || bodegaId || categoriaId || proyectoId);

  function limpiarFiltros() {
    setClienteId('');
    setBodegaId('');
    setCategoriaId('');
    setProyectoId('');
  }

  // ── Datos ────────────────────────────────────────────────────────────────────
  const { data, isLoading } = useReporteInventario(filtros);
  const [seleccionada, setSeleccionada] = useState<InventarioBodegaResumen | null>(null);
  const detalle = useReporteInventarioDetalle(seleccionada?.bodegaId ?? null);

  // Lista de clientes para el select de filtro (sin paginar — tomamos límite alto).
  const { data: clientesData } = useClientes({ limit: 200, estado: 'ACTIVO' });

  // ── Export dropdown ───────────────────────────────────────────────────────────
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!exportOpen) return;
    function handleOutside(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [exportOpen]);

  async function handleExport(formato: FormatoExportInventario) {
    setExportOpen(false);
    await exportarReporteInventario(filtros, formato);
  }

  // Agrupamos zonas debajo de cada principal.
  const grupos = useMemo(() => {
    if (!data) return [];
    const principales = data.porBodega.filter((b) => b.parentId === null);
    return principales.map((p) => ({
      principal: p,
      zonas: data.porBodega.filter((b) => b.parentId === p.bodegaId),
    }));
  }, [data]);

  // ── Acciones del encabezado ───────────────────────────────────────────────────
  const exportActions = (
    <div className="relative" ref={exportRef}>
      <button
        type="button"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-bd bg-surface text-sm text-tx hover:bg-bg-sunken transition-colors"
        onClick={() => setExportOpen((v) => !v)}
      >
        <Icon name="download" size={14} />
        Exportar
        <Icon name="chevronDown" size={12} className={`transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
      </button>
      {exportOpen && (
        <div className="absolute right-0 top-full mt-1 z-20 min-w-36 rounded-lg border border-bd bg-surface shadow-lg py-1">
          {(['pdf', 'excel', 'csv'] as FormatoExportInventario[]).map((fmt) => (
            <button
              key={fmt}
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-tx hover:bg-bg-sunken transition-colors"
              onClick={() => handleExport(fmt)}
            >
              <Icon name="download" size={13} />
              {fmt === 'excel' ? 'Excel (.xlsx)' : fmt.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Reporte de inventario" back backLabel="Reportes" />
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <PageHeader title="Reporte de inventario" back backLabel="Reportes" />
        <EmptyState icon="building" title="Sin datos" message="No se pudo cargar el reporte." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Reporte de inventario"
        subtitle="Snapshot del inventario distribuido por bodega."
        back
        backLabel="Reportes"
        actions={exportActions}
      />

      {/* ── Filtros ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3 mb-5 p-4 rounded-lg border border-bd bg-surface">
        {/* Cliente */}
        <div className="flex flex-col gap-1 min-w-48">
          <label className="text-xs text-tx-3 font-medium">Cliente</label>
          <select
            className={selectBase}
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
          >
            <option value="">Todos los clientes</option>
            {(clientesData?.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.tipo === 'EMPRESA' ? (c.razonSocial ?? c.nombreComercial ?? '—') : `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim()}
              </option>
            ))}
          </select>
        </div>

        {/* Bodega */}
        <div className="flex flex-col gap-1 min-w-52">
          <label className="text-xs text-tx-3 font-medium">Bodega</label>
          <BodegaSelect
            value={bodegaId}
            onChange={setBodegaId}
            placeholder="Todas las bodegas"
            includeZonas
          />
        </div>

        {/* Categoría de equipo — opciones dinámicas de la API */}
        <div className="flex flex-col gap-1 min-w-52">
          <label className="text-xs text-tx-3 font-medium">Categoría de equipo</label>
          <select
            className={selectBase}
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {(categorias ?? []).map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Proyecto — para ver solo la bodega-proyecto de un proyecto específico */}
        <div className="flex flex-col gap-1 min-w-52">
          <label className="text-xs text-tx-3 font-medium">ID de proyecto</label>
          <input
            type="text"
            className={selectBase}
            placeholder="ID del proyecto…"
            value={proyectoId}
            onChange={(e) => setProyectoId(e.target.value.trim())}
          />
        </div>

        {hayFiltros && (
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-tx-3 hover:text-danger transition-colors"
            onClick={limpiarFiltros}
          >
            <Icon name="x" size={11} />
            Limpiar
          </button>
        )}
      </div>

      {/* ── Totales generales ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Equipos" value={data.totales.equipos} />
        <Stat label="Herramientas" value={data.totales.herramientas} />
        <Stat
          label="Consumibles"
          value={`${data.totales.consumiblesSku} SKU`}
          extra={`${data.totales.consumiblesUnid} unid.`}
        />
        <Stat
          label="Piezas"
          value={`${data.totales.piezasSku} SKU`}
          extra={`${data.totales.piezasUnid} unid.`}
        />
      </div>

      {/* ── Por estado: equipos y herramientas ─────────────────────────────── */}
      {data.estado && (
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <EstadoCard titulo="Equipos" resumen={data.estado.equipos} />
          <EstadoCard titulo="Herramientas" resumen={data.estado.herramientas} />
        </div>
      )}

      {/* ── Por categoría ───────────────────────────────────────────────────── */}
      {data.equiposPorCategoria && data.equiposPorCategoria.length > 0 && (
        <div className={`${cardCls} mb-6`}>
          <h3 className="text-sm font-semibold mb-3">Por categoría de equipo</h3>
          <DataTable>
            <thead className="text-xs text-tx-3">
              <tr>
                <th className="text-left font-medium pb-2 pr-3">Categoría</th>
                <th className="text-right font-medium pb-2 px-2">Total</th>
                <th className="text-right font-medium pb-2 px-2">Disponibles</th>
                <th className="text-right font-medium pb-2 px-2">Rentados</th>
                <th className="text-right font-medium pb-2 px-2">Mant.</th>
                <th className="text-right font-medium pb-2 px-2">Uso int.</th>
                <th className="font-medium pb-2 pl-3 min-w-28">% Rentado</th>
              </tr>
            </thead>
            <tbody>
              {data.equiposPorCategoria.map((row) => (
                <tr key={row.categoria} className="border-t border-bd/40 text-sm">
                  <td className="py-2 pr-3">
                    {row.categoria}
                  </td>
                  <td className="py-2 px-2 text-right font-mono">{row.total}</td>
                  <td className="py-2 px-2 text-right font-mono text-ok">{row.disponibles}</td>
                  <td className="py-2 px-2 text-right font-mono text-accent">{row.rentadas}</td>
                  <td className="py-2 px-2 text-right font-mono text-warn">{row.mantenimiento}</td>
                  <td className="py-2 px-2 text-right font-mono">{row.usoInterno}</td>
                  <td className="py-2 pl-3">
                    <BarraPct pct={row.pctRentado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      )}

      {/* ── Por cliente ─────────────────────────────────────────────────────── */}
      {data.porCliente && data.porCliente.length > 0 && (
        <div className={`${cardCls} mb-6`}>
          <h3 className="text-sm font-semibold mb-3">Por cliente</h3>
          <DataTable>
            <thead className="text-xs text-tx-3">
              <tr>
                <th className="text-left font-medium pb-2 pr-3">Cliente</th>
                <th className="text-right font-medium pb-2 px-2">Equipos</th>
                <th className="text-right font-medium pb-2 px-2">Herramientas</th>
                <th className="text-right font-medium pb-2 px-2">Consumibles</th>
                <th className="text-right font-medium pb-2 pl-2">Piezas</th>
              </tr>
            </thead>
            <tbody>
              {data.porCliente.map((row) => (
                <tr key={row.clienteId} className="border-t border-bd/40 text-sm">
                  <td className="py-2 pr-3">{row.clienteNombre}</td>
                  <td className="py-2 px-2 text-right font-mono">{row.equipos}</td>
                  <td className="py-2 px-2 text-right font-mono">{row.herramientas}</td>
                  <td className="py-2 px-2 text-right font-mono">{row.consumiblesUnid}</td>
                  <td className="py-2 pl-2 text-right font-mono">{row.piezasUnid}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      )}

      {/* ── Por bodega (detalle existente) ─────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold mb-3">Por bodega</h3>
          <div className="flex flex-col gap-3">
            {grupos.map(({ principal, zonas }) => (
              <div key={principal.bodegaId} className={cardCls}>
                <BodegaRow
                  bodega={principal}
                  onSelect={() => setSeleccionada(principal)}
                  selected={seleccionada?.bodegaId === principal.bodegaId}
                />
                {zonas.length > 0 && (
                  <div className="mt-3 pl-3 border-l border-bd flex flex-col gap-2">
                    {zonas.map((z) => (
                      <BodegaRow
                        key={z.bodegaId}
                        bodega={z}
                        onSelect={() => setSeleccionada(z)}
                        selected={seleccionada?.bodegaId === z.bodegaId}
                        compact
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-3">
            {seleccionada ? `Detalle — ${seleccionada.bodegaNombre}` : 'Detalle'}
          </h3>
          {!seleccionada && (
            <EmptyState icon="building" title="Elegí una bodega" message="Hacé clic para ver sus items." />
          )}
          {seleccionada && detalle.isLoading && (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          )}
          {seleccionada && detalle.data && detalle.data.length === 0 && (
            <EmptyState icon="building" title="Sin items" message="Esta bodega está vacía." />
          )}
          {seleccionada && detalle.data && detalle.data.length > 0 && (
            <div className={`${cardCls} overflow-x-auto`}>
              <table className="w-full text-xs">
                <thead className="text-tx-3">
                  <tr>
                    <th className="text-left font-medium pb-2">Tipo</th>
                    <th className="text-left font-medium pb-2">Código</th>
                    <th className="text-left font-medium pb-2">Nombre</th>
                    <th className="text-left font-medium pb-2">Estado / cant.</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.data.map((it) => (
                    <tr key={`${it.tipo}-${it.id}`} className="border-t border-bd/40">
                      <td className="py-1.5 pr-2">
                        <Badge kind="neutral" status={it.tipo} />
                      </td>
                      <td className="py-1.5 pr-2 font-mono">{it.codigo}</td>
                      <td className="py-1.5 pr-2">{it.nombre}</td>
                      <td className="py-1.5 pr-2 font-mono">
                        {it.cantidad !== undefined ? `${it.cantidad} unid.` : it.estado ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Componentes auxiliares ─────────────────────────────────────────────────────

function Stat({ label, value, extra }: { label: string; value: string | number; extra?: string }) {
  return (
    <div className={cardCls}>
      <div className="text-xs text-tx-3">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
      {extra && <div className="text-xs text-tx-3 mt-0.5">{extra}</div>}
    </div>
  );
}

// Barra de porcentaje rentado. El width es dato dinámico — inline es aceptable aquí;
// el resto usa clases Tailwind predefinidas sin valores arbitrarios.
function BarraPct({ pct }: { pct: number }) {
  const pctClamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-bg-sunken overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${pctClamped}%` }}
        />
      </div>
      <span className="text-xs font-mono text-tx-2 w-8 text-right">{Math.round(pctClamped)}%</span>
    </div>
  );
}

function EstadoCard({ titulo, resumen }: { titulo: string; resumen: EstadoResumen }) {
  return (
    <div className={cardCls}>
      <h4 className="text-sm font-semibold mb-3">{titulo}</h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <MiniStat label="Total" value={resumen.total} />
        <MiniStat label="Disponibles" value={resumen.disponibles} variant="ok" />
        <MiniStat label="Rentados" value={resumen.rentadas} variant="accent" />
        <MiniStat label="Mant." value={resumen.mantenimiento} variant="warn" />
      </div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-tx-3">Uso interno:</span>
        <span className="text-xs font-mono">{resumen.usoInterno}</span>
      </div>
      <div className="mt-2">
        <div className="flex justify-between mb-1">
          <span className="text-xs text-tx-3">% Rentado</span>
          <span className="text-xs font-mono text-tx-2">{Math.round(resumen.pctRentado)}%</span>
        </div>
        <BarraPct pct={resumen.pctRentado} />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant?: 'ok' | 'accent' | 'warn';
}) {
  const colorCls =
    variant === 'ok'
      ? 'text-ok'
      : variant === 'accent'
        ? 'text-accent'
        : variant === 'warn'
          ? 'text-warn'
          : 'text-tx';
  return (
    <div>
      <div className="text-xs text-tx-3">{label}</div>
      <div className={`text-base font-semibold mt-0.5 ${colorCls}`}>{value}</div>
    </div>
  );
}

function BodegaRow({
  bodega,
  onSelect,
  selected,
  compact,
}: {
  bodega: InventarioBodegaResumen;
  onSelect: () => void;
  selected: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors ${
        selected ? 'bg-accent-soft' : 'hover:bg-bg-sunken'
      }`}
    >
      <div className="min-w-0">
        <div className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'} font-medium`}>
          {!compact && <Icon name="building" size={14} />}
          <span className="truncate">{bodega.bodegaNombre}</span>
          {compact && <Badge kind="neutral" status="Zona" />}
        </div>
        <div className="text-xs text-tx-3 mt-0.5">
          {bodega.equipos} eq · {bodega.herramientas} h · {bodega.consumiblesUnid} c ·{' '}
          {bodega.piezasUnid} p
        </div>
      </div>
      <Icon name="chevronRight" size={12} />
    </button>
  );
}
