import { Badge } from '@/components/ui/Badge';
import type { EstadoDTE } from '@/types/api';

const META: Record<EstadoDTE, { label: string; kind: 'neutral' | 'info' | 'ok' | 'danger' | 'warn' }> = {
  PENDIENTE:  { label: 'Sin emitir', kind: 'warn' },
  PROCESANDO: { label: 'Procesando', kind: 'info' },
  APROBADO:   { label: 'Aprobado',   kind: 'ok' },
  RECHAZADO:  { label: 'Rechazado',  kind: 'danger' },
  ANULADO:    { label: 'Anulado',    kind: 'neutral' },
};

export function EstadoDteBadge({ estado }: { estado: EstadoDTE }) {
  const { label, kind } = META[estado];
  return <Badge status={label} kind={kind} />;
}
