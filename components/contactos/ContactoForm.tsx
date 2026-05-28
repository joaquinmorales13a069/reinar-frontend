'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { Badge } from '@/components/ui/Badge';
import { PhoneInputField } from '@/components/ui/PhoneInputField';
import { useContacto, useCrearContacto, useEditarContacto } from '@/hooks/use-contactos';
import { useClientes } from '@/hooks/use-clientes';

const TIPOS_CONTACTO = [
  { value: 'PRINCIPAL',   label: 'Principal' },
  { value: 'SECUNDARIO',  label: 'Secundario' },
  { value: 'SOLICITANTE', label: 'Solicitante' },
  { value: 'FACTURACION', label: 'Facturación' },
  { value: 'OPERATIVO',   label: 'Operativo' },
] as const;

const schema = z.object({
  clienteId: z.string().min(1, 'El cliente es obligatorio.'),
  nombre: z.string().min(1, 'El nombre es obligatorio.'),
  apellido: z.string().optional(),
  cargo: z.string().optional(),
  tipoContacto: z.enum(['PRINCIPAL', 'SECUNDARIO', 'SOLICITANTE', 'FACTURACION', 'OPERATIVO']),
  telefono: z.string().optional(),
  email: z.string().optional().refine(
    (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    { message: 'Correo inválido.' }
  ),
  notas: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const DEFAULTS: FormData = {
  clienteId: '', nombre: '', apellido: '', cargo: '',
  tipoContacto: 'SECUNDARIO',
  telefono: '', email: '', notas: '',
};

const inputBase = 'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk  = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;

export function ContactoForm({ id }: { id?: string }) {
  const isNew = !id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientePre = searchParams.get('clienteId') ?? '';

  const { data: existing, isLoading: loadingExisting } = useContacto(id ?? '');
  const { data: clientesData } = useClientes({ limit: 500, estado: 'ACTIVO' });
  const crear = useCrearContacto();
  const editar = useEditarContacto();

  const { register, handleSubmit, watch, setValue, setError, reset, control, formState: { errors } } =
    useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { ...DEFAULTS, clienteId: clientePre } });

  const clienteId = watch('clienteId');
  const clienteReadonly = !isNew || !!clientePre;
  const clienteSeleccionado = clientesData?.data.find((c) => c.id === clienteId);

  // Estado del combobox de selección de cliente
  const [clienteOpen, setClienteOpen] = useState(false);
  const [clienteSearch, setClienteSearch] = useState('');
  const comboRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!clienteOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setClienteOpen(false);
        setClienteSearch('');
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [clienteOpen]);

  useEffect(() => {
    if (existing) reset({ ...DEFAULTS, ...existing });
  }, [existing, reset]);

  function clienteNombre(cl: { tipo?: string; razonSocial?: string; nombre?: string; apellido?: string }): string {
    if (cl.tipo === 'PARTICULAR') return [cl.nombre, cl.apellido].filter(Boolean).join(' ') || '—';
    return cl.razonSocial ?? cl.nombre ?? '—';
  }

  function clienteDoc(cl: { tipoDocumento?: string | null; numeroDocumento?: string | null; ncr?: string }): string {
    const parts: string[] = [];
    if (cl.tipoDocumento && cl.numeroDocumento) parts.push(`${cl.tipoDocumento}: ${cl.numeroDocumento}`);
    if (cl.ncr) parts.push(`NRC: ${cl.ncr}`);
    return parts.join(' · ');
  }

  const clientesFiltrados = (clientesData?.data ?? []).filter((cl) => {
    if (!clienteSearch) return true;
    const q = clienteSearch.toLowerCase();
    return (
      clienteNombre(cl).toLowerCase().includes(q) ||
      (cl.numeroDocumento ?? '').toLowerCase().includes(q)
    );
  });

  const isPending = crear.isPending || editar.isPending;

  function handleError(err: unknown) {
    const e = (err as any)?.response?.data?.error;
    const details: { field: string; message: string }[] = e?.details ?? [];
    details.forEach((d) => setError(d.field as keyof FormData, { message: d.message }));
    if (!details.length) toast.error(e?.message ?? 'Ocurrió un error inesperado.');
  }

  function onSubmit(data: FormData) {
    if (isNew) {
      crear.mutate({ ...data, activo: true }, {
        onSuccess: (c) => {
          toast.success('Contacto creado correctamente.');
          router.push(clientePre ? `/clientes/${clientePre}` : `/contactos/${c.id}`);
        },
        onError: handleError,
      });
    } else {
      editar.mutate({ id: id!, data }, {
        onSuccess: () => { toast.success('Cambios guardados correctamente.'); router.push(`/contactos/${id}`); },
        onError: handleError,
      });
    }
  }

  if (!isNew && loadingExisting) return <div className="flex justify-center p-12"><Spinner /></div>;

  const fullName = [watch('nombre'), watch('apellido')].filter(Boolean).join(' ') || 'Contacto';

  return (
    <div>
      <PageHeader
        title={isNew ? 'Nuevo contacto' : `Editar — ${fullName}`}
        subtitle={isNew ? 'Registrá un contacto vinculado a un cliente.' : 'Modificá los datos del contacto.'}
        back
        onBack={() => router.back()}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <FormSection title="Datos del contacto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-tx-2">Cliente vinculado <span className="text-danger">*</span></label>
              {/* Input oculto para que RHF registre el valor de clienteId */}
              <input type="hidden" {...register('clienteId')} />

              {clienteReadonly ? (
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-bd bg-bg-sunken">
                  <Icon name={clienteSeleccionado?.tipo === 'PARTICULAR' ? 'user' : 'building'} size={16} className="text-tx-3 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-tx truncate">
                      {clienteSeleccionado ? clienteNombre(clienteSeleccionado) : clienteId}
                    </div>
                    {clienteSeleccionado && clienteDoc(clienteSeleccionado) && (
                      <div className="font-mono text-xs text-tx-3 mt-0.5">{clienteDoc(clienteSeleccionado)}</div>
                    )}
                  </div>
                  <Badge status="Bloqueado" kind="neutral" />
                </div>
              ) : (
                <div className="relative" ref={comboRef}>
                  {/* Trigger del combobox */}
                  <button
                    type="button"
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-md border bg-surface text-left transition-colors focus:outline-none focus:border-accent ${errors.clienteId ? 'border-danger' : 'border-bd'}`}
                    onClick={() => { setClienteOpen((v) => !v); setClienteSearch(''); }}
                  >
                    <span className={clienteId ? 'text-tx' : 'text-tx-3'}>
                      {clienteSeleccionado ? clienteNombre(clienteSeleccionado) : '— Seleccionar cliente —'}
                    </span>
                    <Icon name="chevronDown" size={14} className={`text-tx-3 shrink-0 transition-transform ${clienteOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Panel desplegable */}
                  {clienteOpen && (
                    <div className="absolute z-30 w-full mt-1 rounded-md border border-bd bg-surface shadow-lg">
                      <div className="p-2 border-b border-bd">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Buscar por nombre, NIT, DUI…"
                          value={clienteSearch}
                          onChange={(e) => setClienteSearch(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-sm rounded border border-bd bg-bg text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors"
                        />
                      </div>
                      <div className="max-h-52 overflow-y-auto">
                        {clientesFiltrados.length === 0 ? (
                          <div className="px-3 py-4 text-sm text-tx-3 text-center">Sin resultados</div>
                        ) : (
                          clientesFiltrados.map((cl) => {
                            const doc = clienteDoc(cl);
                            return (
                              <div
                                key={cl.id}
                                className={`px-3 py-2.5 cursor-pointer hover:bg-bg-sunken transition-colors ${cl.id === clienteId ? 'bg-bg-sunken' : ''}`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setValue('clienteId', cl.id, { shouldValidate: true });
                                  setClienteOpen(false);
                                  setClienteSearch('');
                                }}
                              >
                                <div className="text-sm font-medium text-tx">{clienteNombre(cl)}</div>
                                {doc && <div className="text-xs text-tx-3 font-mono mt-0.5">{doc}</div>}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {errors.clienteId && <p className="text-xs text-danger mt-0.5">{errors.clienteId.message}</p>}
              {!isNew && <p className="text-xs text-tx-3 mt-0.5">El cliente vinculado no puede modificarse después de crear el contacto.</p>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-tx-2">Nombre <span className="text-danger">*</span></label>
              <input className={errors.nombre ? inputErr : inputOk} {...register('nombre')} placeholder="Ej. María José" />
              {errors.nombre && <p className="text-xs text-danger mt-0.5">{errors.nombre.message}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-tx-2">Apellido</label>
              <input className={inputOk} {...register('apellido')} placeholder="Ej. Hernández Pérez" />
            </div>

            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-tx-2">Cargo</label>
              <input className={inputOk} {...register('cargo')} placeholder="Ej. Gerente de Compras, Jefe de Bodega…" />
            </div>

            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-tx-2">Tipo de contacto</label>
              <select className={`${inputOk} max-w-xs`} {...register('tipoContacto')}>
                {TIPOS_CONTACTO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-tx-2">Teléfono</label>
              <PhoneInputField control={control} name="telefono" placeholder="7777-0000" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-tx-2">Correo electrónico</label>
              <input className={errors.email ? inputErr : inputOk} type="email" {...register('email')} placeholder="contacto@empresa.sv" />
              {errors.email && <p className="text-xs text-danger mt-0.5">{errors.email.message}</p>}
            </div>

            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-tx-2">Notas</label>
              <textarea className={`${inputOk} resize-y`} {...register('notas')} placeholder="Información adicional para el equipo de ventas (opcional)." rows={3} />
            </div>
          </div>
        </FormSection>

        <div className="flex flex-col sm:flex-row gap-3 pt-4 mt-2 border-t border-bd">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm text-tx-2 border border-bd hover:bg-bg-sunken transition-colors w-full sm:w-auto"
            onClick={() => router.back()}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors w-full sm:w-auto disabled:opacity-50"
            disabled={isPending}
          >
            {isPending ? <><Spinner /> Guardando…</> : <><Icon name="check" size={14} /> {isNew ? 'Crear contacto' : 'Guardar cambios'}</>}
          </button>
        </div>
      </form>
    </div>
  );
}
