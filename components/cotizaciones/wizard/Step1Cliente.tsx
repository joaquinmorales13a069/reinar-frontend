'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '@/components/ui/Icon';
import { FormSection } from '@/components/ui/FormSection';
import { useClientes } from '@/hooks/use-clientes';
import { useContactos } from '@/hooks/use-contactos';
import { useProyectosCliente } from '@/hooks/use-proyectos';
import { useCrearCotizacion, useActualizarCotizacion } from '@/hooks/use-cotizaciones';
import { step1Schema, type Step1Form } from '@/lib/schemas/cotizacion';
import type { Cotizacion } from '@/types/api';

// Tipo mínimo del cliente seleccionado: solo lo que la card de resumen necesita.
// Definido aquí (no derivado de `Cliente`) porque debe aceptar tanto el shape
// del listado — donde los strings opcionales son `string | undefined` — como
// el embebido en `Cotizacion.cliente`, donde son `string | null`.
type ClienteResumen = {
  id: string;
  tipo: 'EMPRESA' | 'PARTICULAR';
  razonSocial?: string | null;
  nombre?: string | null;
  apellido?: string | null;
  nit?: string | null;
  dui?: string | null;
};

type Props = {
  cotizacion: Cotizacion | null;
  onCreated: (cot: Cotizacion) => void;
  onUpdated: () => void;
};

export function Step1Cliente({ cotizacion, onCreated, onUpdated }: Props) {
  const crear = useCrearCotizacion();
  const actualizar = useActualizarCotizacion();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Step1Form>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      clienteId: cotizacion?.clienteId ?? '',
      proyectoId: cotizacion?.proyectoId ?? null,
      contactoSolicitanteId: cotizacion?.contactoSolicitanteId ?? null,
      // El input type="date" requiere YYYY-MM-DD. El backend devuelve ISO completo.
      // Al crear (sin cotizacion previa), pre-llenamos con hoy + 7 días — espeja el
      // default del backend (cotizaciones.service.ts) y le ahorra un clic al usuario,
      // que igual puede sobreescribirlo antes de avanzar.
      fechaVencimiento:
        cotizacion?.fechaVencimiento?.slice(0, 10) ??
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    },
  });

  const clienteId = watch('clienteId');

  // Buscador local de clientes — uno solo, controlado.
  const [busq, setBusq] = useState('');
  const clientesQ = useClientes({ busqueda: busq, limit: 8 });
  const contactosQ = useContactos({ clienteId: clienteId || undefined });
  const proyectosQ = useProyectosCliente(clienteId);

  // Guardamos el cliente seleccionado en estado local en vez de derivarlo de
  // `clientesQ.data.find(...)`. Razón: al hacer click se limpia `busq` lo que
  // dispara un nuevo fetch con busqueda vacía; mientras llega la respuesta el
  // find devolvía undefined y la card aparecía vacía por un parpadeo de varios
  // segundos. En modo editar pre-cargamos con el cliente embebido en la
  // cotización para no depender de los resultados del buscador en ese flujo.
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteResumen | null>(
    cotizacion
      ? {
          id: cotizacion.cliente.id,
          tipo: cotizacion.cliente.tipo,
          razonSocial: cotizacion.cliente.razonSocial,
          nombre: cotizacion.cliente.nombre,
          apellido: cotizacion.cliente.apellido,
          nit: cotizacion.cliente.nit,
          dui: cotizacion.cliente.dui,
        }
      : null,
  );

  async function onSubmit(values: Step1Form) {
    // El backend espera ISO; convertimos YYYY-MM-DD a "YYYY-MM-DDT00:00:00Z".
    const fechaIso = new Date(values.fechaVencimiento + 'T00:00:00').toISOString();
    const payload = {
      clienteId: values.clienteId,
      proyectoId: values.proyectoId ?? undefined,
      contactoSolicitanteId: values.contactoSolicitanteId ?? undefined,
      fechaVencimiento: fechaIso,
    };

    if (cotizacion) {
      await actualizar.mutateAsync({ id: cotizacion.id, data: payload });
      onUpdated();
    } else {
      const created = await crear.mutateAsync(payload);
      onCreated(created);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <FormSection title="Cliente y proyecto">
        {!clienteSeleccionado && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-tx mb-1.5">
              Buscar cliente <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-3 pointer-events-none" />
              <input
                className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
                placeholder="Buscar por nombre…"
                value={busq}
                onChange={(e) => setBusq(e.target.value)}
              />
              {busq && clientesQ.data && clientesQ.data.data.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-bg border border-bd rounded-md shadow-md max-h-64 overflow-y-auto">
                  {clientesQ.data.data.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-bg-sunken border-b border-bd last:border-b-0"
                      onClick={() => {
                        setValue('clienteId', c.id, { shouldValidate: true });
                        setValue('contactoSolicitanteId', null);
                        setValue('proyectoId', null);
                        setBusq('');
                        setClienteSeleccionado(c);
                      }}
                    >
                      <div className="font-medium">{c.razonSocial ?? `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim()}</div>
                      <div className="text-xs text-tx-3 font-mono">
                        {c.tipo === 'EMPRESA' ? `NIT ${c.nit ?? '—'}` : `DUI ${c.dui ?? '—'}`}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {errors.clienteId && <p className="text-xs text-danger mt-1">{errors.clienteId.message}</p>}
          </div>
        )}

        {clienteSeleccionado && (
          <div className="mb-4 p-3 bg-bg-sunken rounded-md flex items-start justify-between gap-3">
            <div>
              <div className="font-medium text-tx">
                {clienteSeleccionado.razonSocial ?? `${clienteSeleccionado.nombre ?? ''} ${clienteSeleccionado.apellido ?? ''}`.trim()}
              </div>
              <div className="text-xs text-tx-3 font-mono mt-0.5">
                {clienteSeleccionado.tipo === 'EMPRESA'
                  ? `NIT ${clienteSeleccionado.nit ?? '—'}`
                  : `DUI ${clienteSeleccionado.dui ?? '—'}`}
              </div>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-tx-2 hover:text-tx px-2 py-1 rounded hover:bg-bg transition-colors"
              onClick={() => {
                setValue('clienteId', '', { shouldValidate: true });
                setValue('contactoSolicitanteId', null);
                setValue('proyectoId', null);
                setClienteSeleccionado(null);
              }}
            >
              <Icon name="x" size={12} /> Cambiar
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-tx mb-1.5">Contacto solicitante</label>
            <select
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx disabled:opacity-50"
              disabled={!clienteId || contactosQ.isLoading}
              {...register('contactoSolicitanteId')}
            >
              <option value="">— Sin contacto vinculado —</option>
              {contactosQ.data?.data.map((co) => (
                <option key={co.id} value={co.id}>
                  {co.nombre} {co.apellido ?? ''} {co.cargo ? `· ${co.cargo}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-tx mb-1.5">Proyecto</label>
            <select
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx disabled:opacity-50"
              disabled={!clienteId || proyectosQ.isLoading}
              {...register('proyectoId')}
            >
              <option value="">— Sin proyecto —</option>
              {proyectosQ.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-tx mb-1.5">
              Fecha de vencimiento <span className="text-danger">*</span>
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx font-mono"
              {...register('fechaVencimiento')}
            />
            {errors.fechaVencimiento && (
              <p className="text-xs text-danger mt-1">{errors.fechaVencimiento.message}</p>
            )}
          </div>
        </div>
      </FormSection>

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-accent text-navy hover:bg-accent-dim transition-colors disabled:opacity-50"
        >
          Siguiente <Icon name="arrowRight" size={14} />
        </button>
      </div>
    </form>
  );
}
