// Mapa de estado → variante de color replicado del prototipo (StatusBadge en components.jsx).
// Centralizar el mapa aquí evita repetirlo en cada módulo que muestre estados.
const STATUS_KIND: Record<string, string> = {
  APROBADA: 'ok', PAGADA: 'ok', ENTREGADA: 'ok', ACTIVO: 'ok', DISPONIBLE: 'ok', COMPLETADO: 'ok',
  PENDIENTE: 'warn', PARCIAL: 'warn', PROGRAMADA: 'warn', MANTENIMIENTO: 'warn',
  RECHAZADA: 'danger', VENCIDA: 'danger', BAJA: 'danger', INACTIVO: 'danger',
  ENVIADA: 'info', RENTADO: 'info', NUEVO: 'info', PROCESANDO: 'info',
  BORRADOR: 'neutral', ANULADA: 'neutral', CANCELADA: 'neutral',
};

type BadgeProps = {
  status: string;
  kind?: 'ok' | 'warn' | 'danger' | 'info' | 'neutral' | 'accent';
};

export function Badge({ status, kind }: BadgeProps) {
  const k = kind ?? STATUS_KIND[status] ?? 'neutral';
  return (
    <span className={`badge badge--${k}`}>
      <span className="badge__dot" />
      {status}
    </span>
  );
}
