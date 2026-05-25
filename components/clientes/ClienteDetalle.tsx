'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { ContactosDeCliente } from '@/components/clientes/ContactosDeCliente';
import { ProyectosClienteCard } from '@/components/proyectos/ProyectosClienteCard';
import { useCliente } from '@/hooks/use-clientes';
import { useCotizaciones } from '@/hooks/use-cotizaciones';
import { useAuthStore } from '@/stores/auth.store';
import { CotizacionStatusBadge } from '@/components/cotizaciones/CotizacionStatusBadge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { resolverDepartamento, resolverMunicipio, resolverDistrito } from '@/lib/sv-geo';

const btnSec = 'inline-flex items-center gap-2 px-4 py-2 rounded-md border border-bd text-tx-2 bg-surface text-sm font-medium hover:bg-bg-sunken transition-colors';
const btnPri = 'inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors';

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between py-2.5 border-b border-bd-soft last:border-0 text-sm gap-4">
      <dt className="text-tx-3 shrink-0">{label}</dt>
      <dd className="text-tx text-right">{value}</dd>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-bd bg-surface p-4">
      <h3 className="text-sm font-semibold text-tx mb-3">{title}</h3>
      {children}
    </div>
  );
}

export function ClienteDetalle({ id }: { id: string }) {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.rol ?? 'VISUALIZADOR');
  const { data: cliente, isLoading, isError } = useCliente(id);
  // Cargamos las cotizaciones del cliente para poblar el "Historial". El
  // backend ya soporta el filtro clienteId; tomamos las 20 mas recientes.
  const cotizacionesQ = useCotizaciones({ clienteId: id, limit: 20 });

  if (isLoading) return <div className="flex justify-center p-12"><Spinner /></div>;
  if (isError || !cliente) return <div className="p-8 text-center text-sm text-tx-2">No se pudo cargar el cliente.</div>;

  const displayName = cliente.tipo === 'PARTICULAR'
    ? [cliente.nombre, cliente.apellido].filter(Boolean).join(' ') || '—'
    : cliente.razonSocial ?? '—';

  return (
    <div>
      <PageHeader
        title={displayName}
        subtitle={
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge
              status={cliente.tipo === 'EMPRESA' ? 'Empresa' : 'Particular'}
              kind={cliente.tipo === 'EMPRESA' ? 'info' : 'neutral'}
            />
            <Badge status={cliente.estado} />
            <span className="font-mono text-xs text-tx-3">· {cliente.id}</span>
          </div>
        }
        back
        backLabel="Regresar"
        onBack={() => router.push('/clientes')}
        actions={
          <>
            {rol !== 'VISUALIZADOR' && (
              <Link href={`/clientes/${id}/editar`} className={btnSec}>Editar</Link>
            )}
            {rol !== 'VISUALIZADOR' && rol !== 'LOGISTICA' && (
              <Link href={`/cotizaciones/nueva?clienteId=${id}`} className={btnPri}>
                Nueva cotización
              </Link>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-4">
          <Card title="Información general">
            <dl className="m-0">
              {cliente.tipo === 'EMPRESA' ? (
                <>
                  <DetailRow label="Razón social" value={cliente.razonSocial} />
                  <DetailRow label="Nombre comercial" value={cliente.nombreComercial ?? <span className="text-tx-muted">—</span>} />
                  <DetailRow label="NIT" value={<span className="font-mono">{cliente.nit ?? '—'}</span>} />
                  <DetailRow label="NCR" value={<span className="font-mono">{cliente.ncr ?? '—'}</span>} />
                  <DetailRow label="Sector" value={cliente.sector ?? <span className="text-tx-muted">—</span>} />
                  <DetailRow label="Actividad económica" value={cliente.actividadEconomica ?? <span className="text-tx-muted">—</span>} />
                </>
              ) : (
                <>
                  <DetailRow label="Nombre" value={cliente.nombre} />
                  <DetailRow label="Apellido" value={cliente.apellido ?? <span className="text-tx-muted">—</span>} />
                  <DetailRow label="DUI" value={<span className="font-mono">{cliente.dui ?? '—'}</span>} />
                  <DetailRow label="Ocupación" value={cliente.ocupacion ?? <span className="text-tx-muted">—</span>} />
                </>
              )}
            </dl>
          </Card>
          <Card title="Dirección">
            <dl className="m-0">
              <DetailRow label="Departamento" value={resolverDepartamento(cliente.departamento)} />
              <DetailRow label="Municipio" value={resolverMunicipio(cliente.municipio, cliente.departamento)} />
              <DetailRow label="Distrito" value={resolverDistrito(cliente.distrito, cliente.municipio, cliente.departamento)} />
              <DetailRow label="Complemento" value={cliente.complemento ?? <span className="text-tx-muted">—</span>} />
            </dl>
          </Card>
          <Card title="Contacto">
            <dl className="m-0">
              <DetailRow label="Teléfono" value={<span className="font-mono">{cliente.telefono ?? '—'}</span>} />
              <DetailRow label="Correo" value={cliente.email ?? '—'} />
              <DetailRow label="Notas" value={cliente.notas ?? <span className="text-tx-muted">Sin notas.</span>} />
            </dl>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-bd bg-surface p-4">
            <div className="flex gap-8">
              <div>
                <div className="text-2xs font-semibold text-tx-3 uppercase tracking-wider">Total facturado</div>
                <div className="font-mono text-2xl font-medium text-tx mt-1">
                  {cliente.facturado ? formatCurrency(cliente.facturado) : '$0.00'}
                </div>
              </div>
              <div>
                <div className="text-2xs font-semibold text-tx-3 uppercase tracking-wider">Proyectos</div>
                <div className="font-mono text-2xl font-medium text-tx mt-1">{cliente.proyectos ?? 0}</div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-bd bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
              <h3 className="text-sm font-semibold text-tx">Historial de cotizaciones</h3>
              {cotizacionesQ.data && (
                <span className="text-xs text-tx-3">
                  {cotizacionesQ.data.meta.total} {cotizacionesQ.data.meta.total === 1 ? 'cotización' : 'cotizaciones'}
                </span>
              )}
            </div>
            {cotizacionesQ.isLoading ? (
              <div className="px-4 py-6 flex justify-center"><Spinner /></div>
            ) : !cotizacionesQ.data || cotizacionesQ.data.data.length === 0 ? (
              <div className="px-4 py-4 text-sm text-tx-muted">Sin cotizaciones registradas.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-bg-sunken text-2xs uppercase tracking-wider text-tx-3">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Número</th>
                    <th className="text-left px-4 py-2 font-medium">Estado</th>
                    <th className="text-right px-4 py-2 font-medium">Total</th>
                    <th className="text-left px-4 py-2 font-medium">Creado</th>
                  </tr>
                </thead>
                <tbody>
                  {cotizacionesQ.data.data.map((c) => (
                    <tr
                      key={c.id}
                      className="border-t border-bd hover:bg-bg-sunken cursor-pointer transition-colors"
                      onClick={() => router.push(`/cotizaciones/${c.id}`)}
                    >
                      <td className="px-4 py-2 font-mono font-medium text-tx">{c.numeroCotizacion}</td>
                      <td className="px-4 py-2">
                        <CotizacionStatusBadge estado={c.estado} />
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{formatCurrency(c.total)}</td>
                      <td className="px-4 py-2 font-mono text-tx-2 text-xs">{formatDate(c.fechaCreacion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="rounded-lg border border-bd bg-surface overflow-hidden">
            <div className="flex items-center px-4 py-3 border-b border-bd">
              <h3 className="text-sm font-semibold text-tx">Facturas vinculadas</h3>
            </div>
            <div className="px-4 py-4 text-sm text-tx-muted">Sin facturas vinculadas.</div>
          </div>
        </div>
      </div>

      <ContactosDeCliente clienteId={id} />
      <div className="mt-4">
        <ProyectosClienteCard cliente={{ id: cliente.id, estado: cliente.estado }} />
      </div>
    </div>
  );
}
