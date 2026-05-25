'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '@/components/ui/Icon';
import { ConfirmRow } from '@/components/ui/ConfirmRow';
import { anularFacturaSchema, type AnularFacturaForm } from '@/lib/schemas/factura';
import { useCambiarEstadoFactura } from '@/hooks/use-facturas';
import type { Factura } from '@/types/api';

type Props = {
  factura: Factura;
  isAdminOGerente: boolean;
  ajusteOpen: boolean;
  onToggleAjuste: () => void;
};

export function HeaderAcciones({ factura, isAdminOGerente, ajusteOpen, onToggleAjuste }: Props) {
  const [confirmAnular, setConfirmAnular] = useState(false);
  const cambiar = useCambiarEstadoFactura();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AnularFacturaForm>({
    resolver: zodResolver(anularFacturaSchema),
  });

  const facturaAnulable = factura.estado !== 'ANULADA';

  async function onAnular(values: AnularFacturaForm) {
    try {
      await cambiar.mutateAsync({
        id: factura.id,
        data: { estado: 'ANULADA', motivo: values.motivo },
      });
      setConfirmAnular(false);
    } catch {
      // toast manejado por el hook
    }
  }

  const btn =
    'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors';

  return (
    <>
      {isAdminOGerente && facturaAnulable && (
        <button
          type="button"
          className={`${btn} border border-bd text-tx-2 hover:bg-bg-sunken ${ajusteOpen ? 'bg-bg-sunken' : ''}`}
          onClick={onToggleAjuste}
        >
          <Icon name="edit" size={14} /> Ajustar estado
        </button>
      )}
      {isAdminOGerente && facturaAnulable && (
        <button
          type="button"
          className={`${btn} border border-bd text-danger hover:bg-danger-soft`}
          onClick={() => setConfirmAnular(true)}
        >
          <Icon name="x" size={14} /> Anular factura
        </button>
      )}

      {confirmAnular && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-lg z-40 shadow-xl bg-bg border border-bd rounded-md p-4 space-y-3">
          <div>
            <h4 className="text-sm font-medium text-tx mb-1">
              Anular factura {factura.numeroFactura}
            </h4>
            <p className="text-xs text-tx-3">
              Si la factura tiene un DTE aprobado, también se anulará ante el Ministerio de
              Hacienda.
            </p>
          </div>
          <textarea
            rows={3}
            {...register('motivo')}
            placeholder="Motivo de la anulación (mín. 10 caracteres)"
            className="w-full px-2 py-1.5 rounded border border-bd bg-bg text-sm"
          />
          {errors.motivo && <p className="text-xs text-danger">{errors.motivo.message}</p>}
          <ConfirmRow
            message="¿Confirmar anulación? La factura quedará en estado ANULADA y no podrá editarse."
            confirmLabel={cambiar.isPending ? 'Anulando…' : 'Sí, anular'}
            onCancel={() => setConfirmAnular(false)}
            onConfirm={handleSubmit(onAnular)}
          />
        </div>
      )}
    </>
  );
}
