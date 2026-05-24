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
