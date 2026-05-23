'use client';

import { useState } from 'react';
import Decimal from 'decimal.js';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '@/components/ui/Icon';
import { expandirSchema, type ExpandirInput } from '@/lib/schemas/andamios';
import { useExpandirCuerpo } from '@/hooks/use-andamios';
import { formatCurrency } from '@/lib/utils';
import { PERIODOS_LABEL } from '@/lib/andamios';
import type { ExpandirCuerpoItem } from '@/types/api';

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx focus:outline-none focus:border-accent transition-colors';
const inputOk  = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-1';
const segCls = (active: boolean) =>
  `flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
    active ? 'bg-accent text-navy' : 'bg-surface text-tx-2 hover:bg-bg-sunken'
  }`;
const btnPri =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

type Props = { cuerpoId: string; onClose: () => void };

export function ExpandirCuerpoPanel({ cuerpoId, onClose }: Props) {
  const expandir = useExpandirCuerpo(cuerpoId);
  const [periodo, setPeriodo] = useState<'DIA' | 'SEMANA' | 'MES'>('DIA');
  const [result, setResult] = useState<ExpandirCuerpoItem[] | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExpandirInput>({
    resolver: zodResolver(expandirSchema) as never,
    defaultValues: { cantidad: 1, periodo: 'DIA' },
  });

  async function onSubmit(values: ExpandirInput) {
    try {
      const items = await expandir.mutateAsync({ cantidad: values.cantidad, periodo });
      setResult(items);
    } catch {
      setResult(null);
    }
  }

  const totalPeriodo = (result ?? []).reduce(
    (s, it) => s + new Decimal(it.tarifaCatalogo).times(it.cantidad).toNumber(),
    0,
  );

  return (
    <div className="rounded-lg border border-bd bg-surface p-4 flex flex-col gap-3 border-l-2 border-l-accent">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-tx">Expandir cuerpo</h3>
        <button
          type="button"
          className="text-tx-3 hover:text-tx"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <Icon name="x" size={14} />
        </button>
      </div>
      <p className="text-xs text-tx-3 m-0">
        Calculá cuántas piezas y cuánto cuesta materializar N unidades de este cuerpo.
        Esta vista no descuenta stock.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Cantidad *</label>
          <input
            type="number"
            min="1"
            step="1"
            className={`${errors.cantidad ? inputErr : inputOk} font-mono`}
            {...register('cantidad')}
          />
          {errors.cantidad && <p className={errorCls}>{errors.cantidad.message}</p>}
        </div>
        <div className="md:col-span-1">
          <label className={labelCls}>Periodo</label>
          <div className="flex rounded-md border border-bd overflow-hidden">
            {(['DIA', 'SEMANA', 'MES'] as const).map((p, i) => (
              <button
                key={p}
                type="button"
                className={`${segCls(periodo === p)} ${i > 0 ? 'border-l border-bd' : ''}`}
                onClick={() => setPeriodo(p)}
              >
                {PERIODOS_LABEL[p]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={expandir.isPending} className={btnPri}>
            <Icon name="refresh" size={12} /> Calcular
          </button>
        </div>
      </form>

      {result && result.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-bd">
          <table className="w-full text-sm">
            <thead className="bg-bg-sunken text-xs text-tx-2 uppercase">
              <tr>
                <th className="text-left px-3 py-2">Pieza</th>
                <th className="text-right px-3 py-2 w-32">Cantidad total</th>
                <th className="text-right px-3 py-2 w-32">Tarifa unitaria</th>
                <th className="text-right px-3 py-2 w-32">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {result.map((it) => (
                <tr key={it.tipoPiezaId} className="border-t border-bd">
                  <td className="px-3 py-2">{it.nombre}</td>
                  <td className="px-3 py-2 text-right font-mono">{it.cantidad}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatCurrency(new Decimal(it.tarifaCatalogo).toNumber())}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">
                    {formatCurrency(
                      new Decimal(it.tarifaCatalogo).times(it.cantidad).toNumber(),
                    )}
                  </td>
                </tr>
              ))}
              <tr className="bg-bg-sunken">
                <td colSpan={3} className="px-3 py-2 font-semibold">
                  Total ({PERIODOS_LABEL[periodo].toLowerCase()})
                </td>
                <td className="px-3 py-2 text-right font-mono font-bold">
                  {formatCurrency(totalPeriodo)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
