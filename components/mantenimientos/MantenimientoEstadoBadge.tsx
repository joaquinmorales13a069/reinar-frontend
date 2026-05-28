import { Badge } from '@/components/ui/Badge';
import type { EstadoMantenimiento } from '@/types/api';

// ACTIVO usa warn (amarillo) para destacar que el equipo no esta disponible;
// COMPLETADO usa ok (verde) para indicar cierre exitoso del ciclo.
const KIND: Record<EstadoMantenimiento, 'warn' | 'ok'> = {
  ACTIVO:     'warn',
  COMPLETADO: 'ok',
};

const LABEL: Record<EstadoMantenimiento, string> = {
  ACTIVO:     'Activo',
  COMPLETADO: 'Completado',
};

export function MantenimientoEstadoBadge({ estado }: { estado: EstadoMantenimiento }) {
  return <Badge status={LABEL[estado]} kind={KIND[estado]} />;
}
