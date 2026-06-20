'use client';

import { useState } from 'react';
import Decimal from 'decimal.js';
import { Icon } from '@/components/ui/Icon';
import { BodegaSelect } from '@/components/ui/BodegaSelect';
import { construirDatosCompra } from '@/components/inventario/DatosCompraFields';
import { useProveedores } from '@/hooks/use-proveedores';
import { useCrearUnidad } from '@/hooks/use-herramientas';

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border border-bd bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const btnSec =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-xs font-medium hover:bg-bg-sunken transition-colors';
const btnPri =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

export function UnidadCreatePanel({ tipoId }: { tipoId: string }) {
  const [open, setOpen] = useState(false);
  const [bodegaId, setBodegaId] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Campos opcionales de compra para trazabilidad de ingreso
  const [valorUnitarioCompra, setValorUnitarioCompra] = useState('');
  const [numeroFacturaCompra, setNumeroFacturaCompra] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [fechaCompra, setFechaCompra] = useState('');
  const crear = useCrearUnidad();
  const { data: proveedoresData } = useProveedores({ limit: 200, activo: true });
  const proveedores = proveedoresData?.data ?? [];

  function resetForm() {
    setNotas('');
    setBodegaId('');
    setError(null);
    setValorUnitarioCompra('');
    setNumeroFacturaCompra('');
    setProveedorId('');
    setFechaCompra('');
  }

  async function handleConfirmar() {
    if (!bodegaId) {
      setError('La bodega es obligatoria.');
      return;
    }
    const valor = valorUnitarioCompra ? new Decimal(valorUnitarioCompra).toNumber() : NaN;
    const datosCompra = construirDatosCompra(
      valorUnitarioCompra && !Number.isNaN(valor) && valor > 0
        ? {
            valorUnitarioCompra: valor,
            numeroFacturaCompra: numeroFacturaCompra.trim() || undefined,
            proveedorId: proveedorId || undefined,
            fechaCompra: fechaCompra || undefined,
          }
        : undefined,
    );
    try {
      await crear.mutateAsync({ tipoId, data: { bodegaId, notas: notas.trim() || undefined, datosCompra } });
      resetForm();
      setOpen(false);
    } catch {
      // toast lo dispara el hook
    }
  }

  if (!open) {
    return (
      <button type="button" className={btnSec} onClick={() => setOpen(true)}>
        <Icon name="plus" size={12} /> Agregar unidad
      </button>
    );
  }

  return (
    <div className="rounded-md border border-bd bg-bg-sunken p-3 flex flex-col gap-2">
      <label className="text-xs font-medium text-tx-2">Bodega *</label>
      <BodegaSelect
        value={bodegaId}
        onChange={(id) => { setBodegaId(id); if (id) setError(null); }}
        error={!!error}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      <label className="text-xs font-medium text-tx-2 mt-1">
        Notas (opcional)
      </label>
      <textarea
        className={inputBase}
        rows={2}
        placeholder="Notas internas sobre la unidad — opcional"
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
      />
      <p className="text-xs text-tx-3">
        El código interno se genera automáticamente al crear la unidad.
      </p>
      <label className="text-xs font-medium text-tx-2 mt-2">Valor unitario de compra (USD, opcional)</label>
      <input
        type="number"
        step="0.01"
        inputMode="decimal"
        placeholder="0.00"
        className={`${inputBase} font-mono`}
        value={valorUnitarioCompra}
        onChange={(e) => setValorUnitarioCompra(e.target.value)}
      />
      {valorUnitarioCompra && (
        <>
          <label className="text-xs font-medium text-tx-2 mt-1">N° factura de compra (opcional)</label>
          <input
            className={inputBase}
            placeholder="FAC-001"
            value={numeroFacturaCompra}
            onChange={(e) => setNumeroFacturaCompra(e.target.value)}
          />
          <label className="text-xs font-medium text-tx-2 mt-1">Proveedor (opcional)</label>
          <select
            className={inputBase}
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
          >
            <option value="">— Sin proveedor —</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          <label className="text-xs font-medium text-tx-2 mt-1">Fecha de compra (opcional)</label>
          <input
            type="date"
            className={inputBase}
            value={fechaCompra}
            onChange={(e) => setFechaCompra(e.target.value)}
          />
        </>
      )}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          className={btnSec}
          onClick={() => {
            setOpen(false);
            resetForm();
          }}
        >
          Cancelar
        </button>
        <button
          type="button"
          className={btnPri}
          disabled={crear.isPending}
          onClick={handleConfirmar}
        >
          <Icon name="check" size={12} /> Crear unidad
        </button>
      </div>
    </div>
  );
}
