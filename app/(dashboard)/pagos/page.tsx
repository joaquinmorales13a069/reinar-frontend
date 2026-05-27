'use client';

import { useState } from 'react';
import Link from 'next/link';
import Decimal from 'decimal.js';
import { PageHeader } from '@/components/ui/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { PagosFilters } from '@/components/pagos/PagosFilters';
import { PagosTabla } from '@/components/pagos/PagosTabla';
import { useListadoPagos } from '@/hooks/use-pagos';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency } from '@/lib/utils';
import type { FiltrosPagos } from '@/types/api';

export default function PagosPage() {
  const [filtros, setFiltros] = useState<FiltrosPagos>({ page: 1, limit: 20 });
  const user = useAuthStore((s) => s.user);
  // ADMIN es el único que puede eliminar pagos según el backend (requireRol('ADMIN')).
  // VISUALIZADOR no ve el botón de registrar — la ruta está protegida pero
  // ocultamos la UI para evitar acciones inútiles.
  const isAdmin = user?.rol === 'ADMIN';
  // Editar referencia/notas — mismo nivel que crear, el backend lo permite a
  // operadores+ porque no afecta el saldo ni el historial contable.
  const puedeEditar = user?.rol !== 'VISUALIZADOR';
  const puedeCrear = user?.rol !== 'VISUALIZADOR';

  const { data, isLoading } = useListadoPagos(filtros);
  const pagos = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  // Total visible en el subtítulo: suma de la página actual. El total
  // cross-páginas requeriría otra query agregada que se reserva para la
  // rama de reportes (Rama 16).
  const sumaPagina = pagos.reduce((s, p) => s.add(p.monto), new Decimal(0));

  const hasFilters =
    !!filtros.busqueda ||
    !!filtros.metodoPago ||
    !!filtros.clienteId ||
    !!filtros.fechaDesde ||
    !!filtros.fechaHasta;

  return (
    <div>
      <PageHeader
        title="Pagos"
        subtitle={`${total} ${total === 1 ? 'pago' : 'pagos'} · ${formatCurrency(sumaPagina.toString())} en esta página`}
        actions={
          puedeCrear ? (
            <Link
              href="/pagos/nuevo"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim"
            >
              <Icon name="plus" size={13} /> Registrar pago
            </Link>
          ) : null
        }
      />
      <PagosFilters value={filtros} onChange={setFiltros} />
      <PagosTabla
        pagos={pagos}
        loading={isLoading}
        page={filtros.page ?? 1}
        pageSize={filtros.limit ?? 20}
        total={total}
        onPage={(p) => setFiltros((f) => ({ ...f, page: p }))}
        canEdit={puedeEditar}
        canDelete={isAdmin}
        hasFilters={hasFilters}
      />
    </div>
  );
}
