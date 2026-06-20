'use client';

import { z } from 'zod';
import { FormSection } from '@/components/ui/FormSection';
import { useProveedores } from '@/hooks/use-proveedores';
import type { DatosCompraDto } from '@/types/api';
import type { UseFormRegister, FieldErrors } from 'react-hook-form';

// Schema reutilizable — se extiende en los schemas de crear equipo/consumible/unidad.
// El objeto datosCompra completo es opcional; si valorUnitarioCompra no viene,
// construirDatosCompra devuelve undefined y no se manda nada al backend.
export const datosCompraSchema = z
  .object({
    // valueAsNumber de RHF entrega NaN para campos vacíos: lo normalizamos a undefined
    // para que .positive().optional() no dispare un error espurio al dejar el campo en blanco.
    valorUnitarioCompra: z.preprocess(
      (v) => (v === '' || v === null || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
      z.coerce.number().positive('Debe ser mayor a 0').optional(),
    ),
    numeroFacturaCompra: z.string().max(50, 'Máximo 50 caracteres').optional(),
    proveedorId: z.string().optional(),
    fechaCompra: z.string().optional(),
    numeroActaInterna: z.string().max(50, 'Máximo 50 caracteres').optional(),
    notas: z.string().max(500, 'Máximo 500 caracteres').optional(),
  })
  .optional();

export type DatosCompraValues = {
  valorUnitarioCompra?: number;
  numeroFacturaCompra?: string;
  proveedorId?: string;
  fechaCompra?: string;
  numeroActaInterna?: string;
  notas?: string;
};

// El backend requiere valorUnitarioCompra si se manda datosCompra.
// Si el usuario no llena el valor, omitimos el objeto completo.
export function construirDatosCompra(
  values: DatosCompraValues | undefined,
): DatosCompraDto | undefined {
  if (!values?.valorUnitarioCompra) return undefined;
  return {
    valorUnitarioCompra: values.valorUnitarioCompra,
    numeroFacturaCompra: values.numeroFacturaCompra || undefined,
    proveedorId: values.proveedorId || undefined,
    // Si el backend espera ISO con hora, agregamos T00:00:00.000Z solo cuando es fecha pura (YYYY-MM-DD)
    fechaCompra: values.fechaCompra
      ? values.fechaCompra.length === 10
        ? `${values.fechaCompra}T00:00:00.000Z`
        : values.fechaCompra
      : undefined,
    numeroActaInterna: values.numeroActaInterna || undefined,
    notas: values.notas || undefined,
  };
}

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const hintCls = 'text-xs text-tx-3 mt-1';

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: FieldErrors<any>;
  // Prefijo para campos anidados (e.g. "datosCompra.")
  prefix?: string;
};

export function DatosCompraFields({ register, errors, prefix = 'datosCompra.' }: Props) {
  const { data: proveedoresData } = useProveedores({ limit: 200, activo: true });
  const proveedores = proveedoresData?.data ?? [];

  // Helper para nombre de campo con prefix
  const field = (name: string) => `${prefix}${name}`;

  // Acceso a errores anidados (e.g. errors.datosCompra?.valorUnitarioCompra)
  const nestedKey = prefix.replace(/\.$/, '');
  const nestedErrors = errors[nestedKey] as Record<string, { message?: string }> | undefined;

  return (
    <FormSection title="Datos de compra">
      <p className={hintCls}>
        Opcional — completa si esta compra genera un ingreso de inventario trazable.
        El valor unitario es obligatorio para registrar el ingreso.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
        <div>
          <label className={labelCls}>Valor unitario de compra (USD)</label>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            className={`${inputOk} font-mono`}
            {...register(field('valorUnitarioCompra'), { valueAsNumber: true })}
          />
          {nestedErrors?.valorUnitarioCompra && (
            <p className="text-xs text-danger mt-1">{nestedErrors.valorUnitarioCompra.message}</p>
          )}
          <p className={hintCls}>Si se ingresa este valor, se registra un ingreso de inventario.</p>
        </div>

        <div>
          <label className={labelCls}>N° factura de compra</label>
          <input
            className={inputOk}
            placeholder="FAC-001"
            {...register(field('numeroFacturaCompra'))}
          />
        </div>

        <div>
          <label className={labelCls}>Proveedor</label>
          <select className={inputOk} {...register(field('proveedorId'))}>
            <option value="">— Sin proveedor —</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Fecha de compra</label>
          <input
            type="date"
            className={inputOk}
            {...register(field('fechaCompra'))}
          />
        </div>

        <div>
          <label className={labelCls}>N° acta interna</label>
          <input
            className={inputOk}
            placeholder="ACTA-2026-001"
            {...register(field('numeroActaInterna'))}
          />
        </div>

        <div>
          <label className={labelCls}>Notas de compra</label>
          <textarea
            className={inputOk}
            rows={2}
            placeholder="Observaciones de la compra"
            {...register(field('notas'))}
          />
        </div>
      </div>
    </FormSection>
  );
}
