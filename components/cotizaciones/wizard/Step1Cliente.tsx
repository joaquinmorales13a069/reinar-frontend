'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { FormSection } from '@/components/ui/FormSection';
import { Spinner } from '@/components/ui/Spinner';
import { useClientes } from '@/hooks/use-clientes';
import { useProyectosCliente } from '@/hooks/use-proyectos';
import { ContactoSolicitanteSelect } from '@/components/cotizaciones/ContactoSolicitanteSelect';
import { useCrearCotizacion, useActualizarCotizacion } from '@/hooks/use-cotizaciones';
import { step1Schema, type Step1Form } from '@/lib/schemas/cotizacion';
import { fechaSVHoyMasDias, fechaSVToIso, isoToFechaSV } from '@/lib/utils';
import type { Cotizacion } from '@/types/api';

// Tipo mínimo del cliente seleccionado: solo lo que la card de resumen necesita.
// Definido aquí (no derivado de `Cliente`) porque debe aceptar tanto el shape
// del listado — donde los strings opcionales son `string | undefined` — como
// el embebido en `Cotizacion.cliente`, donde son `string | null`.
type ClienteResumen = {
  id: string;
  tipo: 'EMPRESA' | 'PARTICULAR' | 'INTERNACIONAL';
  razonSocial?: string | null;
  nombre?: string | null;
  apellido?: string | null;
  tipoDocumento?: 'DUI' | 'NIT' | 'PASAPORTE' | 'CARNET_RESIDENTE' | 'OTRO' | null;
  numeroDocumento?: string | null;
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
      // Usamos helpers que normalizan a TZ El Salvador (Reinar opera ahi); sin esto
      // un usuario en otra TZ (ej. Australia) veria una fecha distinta al editar de
      // la que vio al crear, porque slice(0,10) del ISO toma la fecha UTC, no la
      // fecha local en SV.
      // Al crear (sin cotizacion previa), pre-llenamos con hoy + 7 días.
      fechaVencimiento: cotizacion
        ? isoToFechaSV(cotizacion.fechaVencimiento)
        : fechaSVHoyMasDias(7),
    },
  });

  const clienteId = watch('clienteId');

  // Estado del picker de cliente. busq + filtroTipo se aplican al query del
  // listado dentro del dropdown. pickerAbierto controla el panel desplegable.
  const [busq, setBusq] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'TODOS' | 'EMPRESA' | 'PARTICULAR'>('TODOS');
  const [pickerAbierto, setPickerAbierto] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const clientesQ = useClientes({
    busqueda: busq || undefined,
    tipo: filtroTipo === 'TODOS' ? null : filtroTipo,
    limit: 20,
  });
  const proyectosQ = useProyectosCliente(clienteId);
  const contactoSolicitanteId = watch('contactoSolicitanteId');

  // Cierra el panel al hacer click fuera.
  useEffect(() => {
    if (!pickerAbierto) return;
    function onMouseDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerAbierto(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [pickerAbierto]);

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
          tipoDocumento: cotizacion.cliente.tipoDocumento,
          numeroDocumento: cotizacion.cliente.numeroDocumento,
        }
      : null,
  );

  async function onSubmit(values: Step1Form) {
    // El backend espera ISO; convertimos YYYY-MM-DD asumiendo que es medianoche
    // en El Salvador (UTC-6 fijo, SV no observa DST). Asi un vendedor en
    // Australia y otro en SV ven y guardan la misma fecha comercial.
    const fechaIso = fechaSVToIso(values.fechaVencimiento);
    const payload = {
      clienteId: values.clienteId,
      // El backend valida cuid() y rechaza string vacio. El <select> sin
      // seleccion devuelve "" (no null), asi que usamos || para convertir
      // cualquier falsy (incluido "") a undefined.
      proyectoId: values.proyectoId || undefined,
      contactoSolicitanteId: values.contactoSolicitanteId || undefined,
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
          <div className="mb-4 relative" ref={pickerRef}>
            <label className="block text-sm font-medium text-tx mb-1.5">
              Cliente <span className="text-danger">*</span>
            </label>

            {/* Trigger del dropdown */}
            <button
              type="button"
              onClick={() => setPickerAbierto((v) => !v)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx-3 hover:border-accent transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <Icon name="users" size={14} />
                Seleccionar cliente…
              </span>
              <Icon name={pickerAbierto ? 'chevronUp' : 'chevronDown'} size={14} />
            </button>

            {/* Panel desplegable */}
            {pickerAbierto && (
              <div className="absolute z-20 mt-1 left-0 right-0 bg-bg border border-bd rounded-md shadow-lg">
                {/* Buscador + filtros de tipo */}
                <div className="p-3 border-b border-bd space-y-3">
                  <div className="relative">
                    <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-3 pointer-events-none" />
                    <input
                      autoFocus
                      value={busq}
                      onChange={(e) => setBusq(e.target.value)}
                      placeholder="Buscar por nombre…"
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-bd bg-bg text-tx focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div className="flex gap-2">
                    {(['TODOS', 'EMPRESA', 'PARTICULAR'] as const).map((tipo) => (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => setFiltroTipo(tipo)}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                          filtroTipo === tipo
                            ? 'bg-accent text-navy border-accent font-medium'
                            : 'text-tx-2 border-bd hover:bg-bg-sunken'
                        }`}
                      >
                        {tipo === 'TODOS' ? 'Todos' : tipo === 'EMPRESA' ? 'Empresa' : 'Particular'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lista scrollable */}
                <div className="max-h-72 overflow-y-auto">
                  {clientesQ.isLoading ? (
                    <div className="flex justify-center py-6">
                      <Spinner />
                    </div>
                  ) : (clientesQ.data?.data ?? []).length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-tx-3">
                      Sin clientes que coincidan.
                    </div>
                  ) : (
                    (clientesQ.data?.data ?? []).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setValue('clienteId', c.id, { shouldValidate: true });
                          setValue('contactoSolicitanteId', null);
                          setValue('proyectoId', null);
                          setClienteSeleccionado(c);
                          setPickerAbierto(false);
                          setBusq('');
                          setFiltroTipo('TODOS');
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-bg-sunken border-b border-bd last:border-b-0 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-tx text-sm">
                              {c.razonSocial ?? `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim()}
                            </div>
                            {c.tipoDocumento && c.numeroDocumento && (
                              <div className="text-xs text-tx-3 font-mono mt-0.5">
                                {c.tipoDocumento} {c.numeroDocumento}
                              </div>
                            )}
                          </div>
                          <Badge
                            status={c.tipo === 'EMPRESA' ? 'Empresa' : 'Particular'}
                            kind={c.tipo === 'EMPRESA' ? 'info' : 'neutral'}
                          />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {errors.clienteId && <p className="text-xs text-danger mt-1">{errors.clienteId.message}</p>}
          </div>
        )}

        {clienteSeleccionado && (
          <div className="mb-4 p-3 bg-bg-sunken rounded-md flex items-start justify-between gap-3">
            <div>
              <div className="font-medium text-tx">
                {clienteSeleccionado.razonSocial ?? `${clienteSeleccionado.nombre ?? ''} ${clienteSeleccionado.apellido ?? ''}`.trim()}
              </div>
              {clienteSeleccionado.tipoDocumento && clienteSeleccionado.numeroDocumento && (
                <div className="text-xs text-tx-3 font-mono mt-0.5">
                  {clienteSeleccionado.tipoDocumento} {clienteSeleccionado.numeroDocumento}
                </div>
              )}
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
            <ContactoSolicitanteSelect
              clienteId={clienteId || null}
              value={contactoSolicitanteId ?? null}
              onChange={(id) => setValue('contactoSolicitanteId', id, { shouldValidate: true })}
            />
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
