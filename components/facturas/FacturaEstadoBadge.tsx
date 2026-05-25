import { Badge } from '@/components/ui/Badge';
import type { EstadoFactura } from '@/types/api';

const META: Record<EstadoFactura, { label: string; kind: 'neutral' | 'info' | 'ok' | 'danger' | 'warn' }> = {
  PENDIENTE: { label: 'Pendiente', kind: 'warn' },
  PARCIAL:   { label: 'Parcial',   kind: 'info' },
  PAGADA:    { label: 'Pagada',    kind: 'ok' },
  VENCIDA:   { label: 'Vencida',   kind: 'danger' },
  ANULADA:   { label: 'Anulada',   kind: 'neutral' },
};

export function FacturaEstadoBadge({ estado }: { estado: EstadoFactura }) {
  const { label, kind } = META[estado];
  return <Badge status={label} kind={kind} />;
}
