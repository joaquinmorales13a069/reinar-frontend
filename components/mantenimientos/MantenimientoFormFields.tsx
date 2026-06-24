'use client';

import { type Control, type UseFormRegister, type FieldErrors } from 'react-hook-form';
import { FormSection } from '@/components/ui/FormSection';
import { useCategorias } from '@/hooks/use-categorias';
import type { TipoMantenimiento } from '@/types/api';

const TIPOS: { value: TipoMantenimiento; label: string }[] = [
  { value: 'PREVENTIVO', label: 'Preventivo' },
  { value: 'CORRECTIVO', label: 'Correctivo' },
  { value: 'EMERGENCIA', label: 'Emergencia' },
];

// Forma del formulario compartida. mostrarTipo=true en `nuevo`, false en `editar`.
export type MantenimientoFormValues = {
  tipo?:                 TipoMantenimiento;
  categoriaId:           string;
  tecnico:               string;
  motivo:                string;
  horometro?:            number;
  costoEstimado?:        number;
  proximoMantenimiento?: string;
};

type Props = {
  control:     Control<MantenimientoFormValues>;
  register:    UseFormRegister<MantenimientoFormValues>;
  errors:      FieldErrors<MantenimientoFormValues>;
  mostrarTipo: boolean;
  // Cuando es un mantenimiento de equipo el horómetro es obligatorio en backend;
  // pasamos el booleano para mostrar la etiqueta sin "(opcional)".
  esEquipo?:   boolean;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function MantenimientoFormFields({ control: _control, register, errors, mostrarTipo, esEquipo }: Props) {
  // Las categorías vienen de la API para que el backend sea la fuente de verdad.
  const { data: categorias } = useCategorias('MANTENIMIENTO');

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
          <label className="text-xs text-tx-3">Categoría</label>
          <select
            {...register('categoriaId')}
            className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
          >
            <option value="">Seleccionar categoría…</option>
            {categorias?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          {errors.categoriaId && <p className="text-xs text-danger mt-1">{errors.categoriaId.message}</p>}
        </div>

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
          <label className="text-xs text-tx-3">
            Horómetro{esEquipo ? '' : ' (opcional)'}
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register('horometro', { valueAsNumber: true })}
            className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
          />
          {errors.horometro && <p className="text-xs text-danger mt-1">{errors.horometro.message}</p>}
        </div>

        <div>
          <label className="text-xs text-tx-3">Costo estimado</label>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register('costoEstimado', { valueAsNumber: true })}
            className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
          />
          {errors.costoEstimado && <p className="text-xs text-danger mt-1">{errors.costoEstimado.message}</p>}
        </div>

        <div className="lg:col-span-2">
          <label className="text-xs text-tx-3">Próximo mantenimiento (opcional)</label>
          <input
            type="datetime-local"
            {...register('proximoMantenimiento')}
            className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
          />
        </div>
      </div>
    </FormSection>
  );
}
