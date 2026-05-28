'use client';

import { useFieldArray, type Control, type UseFormRegister, type FieldErrors } from 'react-hook-form';
import { Icon } from '@/components/ui/Icon';
import { FormSection } from '@/components/ui/FormSection';
import type { TipoMantenimiento } from '@/types/api';

const TIPOS: { value: TipoMantenimiento; label: string }[] = [
  { value: 'PREVENTIVO', label: 'Preventivo' },
  { value: 'CORRECTIVO', label: 'Correctivo' },
  { value: 'EMERGENCIA', label: 'Emergencia' },
];

// Forma del formulario compartida. mostrarTipo=true en `nuevo`, false en `editar`.
export type MantenimientoFormValues = {
  tipo?:                 TipoMantenimiento;
  tecnico:               string;
  motivo:                string;
  horometro?:            number;
  costoEstimado?:        number;
  repuestos:             { value: string }[];
  proximoMantenimiento?: string;
};

type Props = {
  control:     Control<MantenimientoFormValues>;
  register:    UseFormRegister<MantenimientoFormValues>;
  errors:      FieldErrors<MantenimientoFormValues>;
  mostrarTipo: boolean;
};

export function MantenimientoFormFields({ control, register, errors, mostrarTipo }: Props) {
  const { fields, append, remove } = useFieldArray({ control, name: 'repuestos' });

  return (
    <FormSection title="Datos del mantenimiento">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {mostrarTipo && (
          <div>
            <label className="text-xs text-tx-3">Tipo</label>
            <select
              {...register('tipo')}
              className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
            >
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {errors.tipo && <p className="text-xs text-danger mt-1">{errors.tipo.message}</p>}
          </div>
        )}

        <div>
          <label className="text-xs text-tx-3">Técnico</label>
          <input
            {...register('tecnico')}
            className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
          />
          {errors.tecnico && <p className="text-xs text-danger mt-1">{errors.tecnico.message}</p>}
        </div>

        <div className="lg:col-span-2">
          <label className="text-xs text-tx-3">Motivo</label>
          <textarea
            rows={3}
            {...register('motivo')}
            className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
          />
          {errors.motivo && <p className="text-xs text-danger mt-1">{errors.motivo.message}</p>}
        </div>

        <div>
          <label className="text-xs text-tx-3">Horómetro (opcional)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register('horometro', { valueAsNumber: true })}
            className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="text-xs text-tx-3">Costo estimado (opcional)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register('costoEstimado', { valueAsNumber: true })}
            className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
          />
        </div>

        <div className="lg:col-span-2">
          <label className="text-xs text-tx-3">Próximo mantenimiento (opcional)</label>
          <input
            type="datetime-local"
            {...register('proximoMantenimiento')}
            className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
          />
        </div>

        <div className="lg:col-span-2">
          <label className="text-xs text-tx-3">Repuestos</label>
          <div className="mt-1 flex flex-col gap-2">
            {fields.map((f, idx) => (
              <div key={f.id} className="flex gap-2">
                <input
                  {...register(`repuestos.${idx}.value` as const)}
                  className="flex-1 px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
                  placeholder="Ej. Filtro de aceite"
                />
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="px-2 py-2 text-sm rounded-md border border-bd hover:bg-bg-2"
                  aria-label="Eliminar repuesto"
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => append({ value: '' })}
              className="self-start px-3 py-1.5 text-sm rounded-md border border-bd hover:bg-bg-2"
            >
              Añadir repuesto
            </button>
          </div>
        </div>
      </div>
    </FormSection>
  );
}
