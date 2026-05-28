'use client';

type Props = {
  value: 1 | 13;
  onChange: (v: 1 | 13) => void;
};

export function TipoRetencionPicker({ value, onChange }: Props) {
  const card = (active: boolean) =>
    `rounded-md border p-3 cursor-pointer transition-colors ${
      active ? 'border-accent bg-accent-soft' : 'border-bd hover:bg-bg-sunken'
    }`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className={card(value === 1)} onClick={() => onChange(1)}>
        <div className="font-semibold text-sm">Retención IVA 1%</div>
        <div className="text-xs text-tx-3 mt-1">
          Aplica a servicios entre contribuyentes.
        </div>
      </div>
      <div className={card(value === 13)} onClick={() => onChange(13)}>
        <div className="font-semibold text-sm">Retención IVA 13%</div>
        <div className="text-xs text-tx-3 mt-1">
          Aplica a compras de bienes entre contribuyentes.
        </div>
      </div>
    </div>
  );
}
