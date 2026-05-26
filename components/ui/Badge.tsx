const STATUS_KIND: Record<string, string> = {
  APROBADA: 'ok', PAGADA: 'ok', ENTREGADA: 'ok', ENTREGADO: 'ok', DEVUELTO: 'ok', ACTIVO: 'ok', DISPONIBLE: 'ok', COMPLETADO: 'ok',
  PENDIENTE: 'warn', PARCIAL: 'warn', DEVUELTA_PARCIAL: 'warn', PROGRAMADA: 'warn', MANTENIMIENTO: 'warn',
  RECHAZADA: 'danger', VENCIDA: 'danger', BAJA: 'danger', INACTIVO: 'danger',
  ENVIADA: 'info', DESPACHADO: 'info', RENTADO: 'info', NUEVO: 'info', PROCESANDO: 'info',
  BORRADOR: 'neutral', ANULADA: 'neutral', CANCELADA: 'neutral', PROSPECTO: 'neutral',
};

const KIND_CLS: Record<string, string> = {
  ok:      'text-ok bg-ok-soft border-ok-soft',
  warn:    'text-warn bg-warn-soft border-warn-soft',
  danger:  'text-danger bg-danger-soft border-danger-soft',
  info:    'text-info bg-info-soft border-info-soft',
  neutral: 'text-tx-3 bg-bg-sunken border-bd',
  accent:  'text-accent-dim bg-accent-soft border-accent',
};

type BadgeProps = {
  status: string;
  kind?: 'ok' | 'warn' | 'danger' | 'info' | 'neutral' | 'accent';
};

export function Badge({ status, kind }: BadgeProps) {
  const k = kind ?? STATUS_KIND[status] ?? 'neutral';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-2xs font-medium ${KIND_CLS[k]}`}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-current" />
      {status}
    </span>
  );
}
