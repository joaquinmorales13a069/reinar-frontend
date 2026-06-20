'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { Icon } from '@/components/ui/Icon';
import { useIngresosInventario } from '@/hooks/use-ingresos-inventario';
import { useProveedores } from '@/hooks/use-proveedores';
import { useAuthStore } from '@/stores/auth.store';
import { formatDate } from '@/lib/utils';

const ROLES_INGRESOS = ['ADMIN', 'GERENTE', 'LOGISTICA'];

export default function IngresosInventarioPage() {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol);
  const [page, setPage] = useState(1);
  const [proveedorId, setProveedorId] = useState('');

  // Gate: solo ADMIN/GERENTE/LOGISTICA ven datos de costo de compra
  useEffect(() => {
    if (rol && !ROLES_INGRESOS.includes(rol)) router.replace('/dashboard');
  }, [rol, router]);

  const { data, isLoading, isError } = useIngresosInventario({
    page,
    limit: 20,
    proveedorId: proveedorId || undefined,
  });

  const { data: proveedoresData } = useProveedores({ limit: 200, activo: true });
  const proveedores = proveedoresData?.data ?? [];

  if (!rol || !ROLES_INGRESOS.includes(rol)) return null;

  return (
    <div>
      <PageHeader
        title="Ingresos de inventario"
        subtitle="Registro de compras que generaron entradas de inventario."
      />

      <div className="rounded-lg border border-bd bg-surface overflow-hidden">
        <FilterBar
          search=""
          onSearch={() => {}}
          placeholder="Filtrar…"
          chips={[]}
          onClear={() => {
            setProveedorId('');
            setPage(1);
          }}
        />

        {/* Filtro de proveedor adicional sobre la FilterBar */}
        <div className="px-4 py-2 border-b border-bd flex items-center gap-2">
          <label className="text-xs font-medium text-tx-2 shrink-0">Proveedor</label>
          <select
            className="text-sm border border-bd rounded-md px-2 py-1.5 bg-surface text-tx"
            value={proveedorId}
            onChange={(e) => {
              setProveedorId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos los proveedores</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        )}

        {isError && (
          <EmptyState
            icon="alertTriangle"
            title="Error al cargar ingresos"
            message="Intenta refrescar la página."
          />
        )}

        {!isLoading && !isError && data && data.data.length === 0 && (
          <EmptyState
            icon="download"
            title="Sin ingresos de inventario"
            message="Los ingresos aparecen automáticamente cuando se registran compras con valor unitario."
          />
        )}

        {!isLoading && !isError && data && data.data.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-3xl text-sm">
                <thead className="bg-bg-sunken text-2xs uppercase tracking-wider text-tx-3">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium w-12">#</th>
                    <th className="text-left px-4 py-2 font-medium">N° Factura compra</th>
                    <th className="text-left px-4 py-2 font-medium">Proveedor</th>
                    <th className="text-left px-4 py-2 font-medium w-32">Fecha</th>
                    <th className="text-left px-4 py-2 font-medium w-20">Ítems</th>
                    <th className="text-left px-4 py-2 font-medium">Registrado por</th>
                    <th className="text-right px-4 py-2 font-medium w-20">Ver</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((ing, i) => {
                    const numero = (data.meta.page - 1) * data.meta.limit + i + 1;
                    return (
                      <tr
                        key={ing.id}
                        className="border-t border-bd hover:bg-bg-sunken transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-tx-3">{numero}</td>
                        <td className="px-4 py-3 font-mono text-xs text-tx-2">
                          {ing.numeroFacturaCompra ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-tx-2">{ing.proveedor?.nombre ?? '—'}</td>
                        <td className="px-4 py-3 text-tx-2 text-xs">
                          {ing.fechaCompra ? formatDate(ing.fechaCompra) : '—'}
                        </td>
                        <td className="px-4 py-3 text-tx-2">{ing.items?.length ?? '—'}</td>
                        <td className="px-4 py-3 text-tx-2 text-xs">
                          {ing.registradoPor
                            ? `${ing.registradoPor.nombre} ${ing.registradoPor.apellido}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/ingresos-inventario/${ing.id}`}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-tx-3 hover:bg-bg hover:text-tx transition-colors"
                            aria-label="Ver detalle"
                          >
                            <Icon name="eye" size={14} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={data.meta.page}
              pageSize={data.meta.limit}
              total={data.meta.total}
              onPage={setPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
