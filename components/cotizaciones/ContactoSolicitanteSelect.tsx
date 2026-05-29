'use client';

import { useState } from 'react';
import { useContactos } from '@/hooks/use-contactos';
import { ContactoFormMinModal } from '@/components/contactos/ContactoFormMinModal';
import { Icon } from '@/components/ui/Icon';
import type { Contacto } from '@/types/api';

type TipoContacto = 'PRINCIPAL' | 'SECUNDARIO' | 'SOLICITANTE' | 'FACTURACION' | 'OPERATIVO';

interface Props {
  clienteId: string | null;
  value: string | null;
  onChange: (contactoId: string | null) => void;
  defaultTipo?: TipoContacto;
}

export function ContactoSolicitanteSelect({
  clienteId,
  value,
  onChange,
  defaultTipo = 'SOLICITANTE',
}: Props) {
  const [showModal, setShowModal] = useState(false);
  // useContactos devuelve PaginatedResponse<Contacto>; filtramos por clienteId
  // para mostrar solo los contactos del cliente actualmente seleccionado.
  const contactosQ = useContactos({ clienteId: clienteId || undefined });
  const contactos = contactosQ.data?.data ?? [];

  const disabled = !clienteId;

  return (
    <>
      <div className="flex items-stretch gap-2">
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled || contactosQ.isLoading}
          className="flex-1 px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx disabled:opacity-50"
        >
          <option value="">— Sin contacto vinculado —</option>
          {contactos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} {c.apellido ?? ''} {c.cargo ? `· ${c.cargo}` : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          disabled={disabled}
          className="inline-flex items-center justify-center px-3 py-2 rounded-md border border-bd bg-bg text-tx-2 hover:bg-bg-sunken hover:text-tx transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Nuevo contacto"
          aria-label="Nuevo contacto"
        >
          <Icon name="plus" size={14} />
        </button>
      </div>

      {showModal && clienteId && (
        <ContactoFormMinModal
          clienteId={clienteId}
          defaultTipo={defaultTipo}
          onClose={() => setShowModal(false)}
          onCreated={(contacto: Contacto) => {
            onChange(contacto.id);
            setShowModal(false);
          }}
        />
      )}
    </>
  );
}
