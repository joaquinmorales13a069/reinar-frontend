import { Icon } from '@/components/ui/Icon';

export function EquipoRentasPlaceholder() {
  return (
    <div className="rounded-lg border border-bd bg-surface overflow-hidden">
      <div className="px-4 py-3 border-b border-bd">
        <h3 className="font-semibold text-tx">Historial de rentas</h3>
      </div>
      <div className="p-6 text-center text-sm text-tx-3">
        <Icon name="clock" size={20} className="mx-auto mb-2" />
        <p>Disponible próximamente con el módulo de cotizaciones.</p>
      </div>
    </div>
  );
}
