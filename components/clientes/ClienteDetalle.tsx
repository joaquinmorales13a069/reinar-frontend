'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { ContactosDeCliente } from '@/components/clientes/ContactosDeCliente';
import { useCliente } from '@/hooks/use-clientes';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency } from '@/lib/utils';

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function ClienteDetalle({ id }: { id: string }) {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');
  const { data: cliente, isLoading, isError } = useCliente(id);

  if (isLoading) return <div className="flex justify-center p-12"><Spinner /></div>;
  if (isError || !cliente) return <div className="p-8 text-center text-sm text-tx-2">No se pudo cargar el cliente.</div>;

  const displayName = cliente.razonSocial ?? cliente.nombre ?? '—';

  return (
    <div>
      <PageHeader
        title={displayName}
        subtitle={
          <>
            <span className="badge badge--neutral">{cliente.tipo === 'EMPRESA' ? 'Empresa' : 'Particular'}</span>{' '}
            <Badge status={cliente.estado} />
            <span className="text-3 mono" style={{ marginLeft: 8 }}>· {cliente.id}</span>
          </>
        }
        back
        onBack={() => router.push('/clientes')}
        actions={
          <>
            {rol !== 'VISUALIZADOR' && (
              <Link href={`/clientes/${id}/editar`} className="btn btn--secondary">Editar</Link>
            )}
            {rol !== 'VISUALIZADOR' && rol !== 'LOGISTICA' && (
              <Link href={`/cotizaciones/nueva?clienteId=${id}`} className="btn btn--primary">
                Nueva cotización
              </Link>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-4">
          <div className="card">
            <h3 className="card__title mb-3">Información general</h3>
            <dl style={{ margin: 0 }}>
              {cliente.tipo === 'EMPRESA' ? (
                <>
                  <DetailRow label="Razón social" value={cliente.razonSocial} />
                  <DetailRow label="Nombre comercial" value={cliente.nombreComercial ?? <span className="text-muted">—</span>} />
                  <DetailRow label="NIT" value={<span className="mono">{cliente.nit ?? '—'}</span>} />
                  <DetailRow label="NCR" value={<span className="mono">{cliente.ncr ?? '—'}</span>} />
                  <DetailRow label="Sector" value={cliente.sector ?? <span className="text-muted">—</span>} />
                  <DetailRow label="Actividad económica" value={cliente.actividadEconomica ?? <span className="text-muted">—</span>} />
                </>
              ) : (
                <>
                  <DetailRow label="Nombre" value={cliente.nombre} />
                  <DetailRow label="Apellido" value={cliente.apellido ?? <span className="text-muted">—</span>} />
                  <DetailRow label="DUI" value={<span className="mono">{cliente.dui ?? '—'}</span>} />
                  <DetailRow label="Ocupación" value={cliente.ocupacion ?? <span className="text-muted">—</span>} />
                </>
              )}
            </dl>
          </div>
          <div className="card">
            <h3 className="card__title mb-3">Dirección</h3>
            <dl style={{ margin: 0 }}>
              <DetailRow label="Departamento" value={cliente.departamento} />
              <DetailRow label="Municipio" value={cliente.municipio} />
              <DetailRow label="Complemento" value={cliente.complemento ?? <span className="text-muted">—</span>} />
            </dl>
          </div>
          <div className="card">
            <h3 className="card__title mb-3">Contacto</h3>
            <dl style={{ margin: 0 }}>
              <DetailRow label="Teléfono" value={<span className="mono">{cliente.telefono ?? '—'}</span>} />
              <DetailRow label="Correo" value={cliente.email ?? '—'} />
              <DetailRow label="Notas" value={cliente.notas ?? <span className="text-muted">Sin notas.</span>} />
            </dl>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card">
            <div style={{ display: 'flex', gap: 24 }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600 }}>Total facturado</div>
                <div className="mono" style={{ fontSize: 26, fontWeight: 500, marginTop: 4 }}>
                  {cliente.facturado ? formatCurrency(cliente.facturado) : '$0.00'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600 }}>Proyectos</div>
                <div className="mono" style={{ fontSize: 26, fontWeight: 500, marginTop: 4 }}>{cliente.proyectos ?? 0}</div>
              </div>
            </div>
          </div>
          {/* Tablas de cotizaciones y facturas: se completarán en RAMA 6 y RAMA 7 */}
          <div className="card card--flush">
            <div className="card__head"><h3 className="card__title">Historial de cotizaciones</h3></div>
            <table className="table"><tbody>
              <tr><td colSpan={3} style={{ padding: '18px', color: 'var(--text-muted)', fontSize: 'var(--t-sm)' }}>Sin cotizaciones registradas.</td></tr>
            </tbody></table>
          </div>
          <div className="card card--flush">
            <div className="card__head"><h3 className="card__title">Facturas vinculadas</h3></div>
            <table className="table"><tbody>
              <tr><td colSpan={3} style={{ padding: '18px', color: 'var(--text-muted)', fontSize: 'var(--t-sm)' }}>Sin facturas vinculadas.</td></tr>
            </tbody></table>
          </div>
        </div>
      </div>

      <ContactosDeCliente clienteId={id} />
    </div>
  );
}
