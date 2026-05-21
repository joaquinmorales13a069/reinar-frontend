import { Icon } from '@/components/ui/Icon';

export function EquipoReservaPlaceholder() {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg border border-bd bg-bg-sunken mb-4">
      <span className="text-tx-3 mt-0.5 shrink-0">
        <Icon name="info" size={18} />
      </span>
      <div className="text-sm text-tx-2">
        <p className="font-medium text-tx">Reservas — Próximamente</p>
        <p className="text-xs mt-0.5">
          Cuando se habilite el módulo de cotizaciones, aquí verás las reservas activas sobre este equipo.
        </p>
      </div>
    </div>
  );
}
