'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { useActa, useCambiarEstadoActa } from '@/hooks/use-actas';
import { useContactos } from '@/hooks/use-contactos';
import { entregaFormSchema, type EntregaForm } from '@/lib/schemas/acta';
import type { Contacto } from '@/types/api';

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border border-bd bg-surface text-tx focus:outline-none focus:border-accent transition-colors';
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';

export default function EntregaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const { data: acta, isLoading } = useActa(id);
  const cambiar = useCambiarEstadoActa();

  const form = useForm<EntregaForm>({
    resolver: zodResolver(entregaFormSchema),
    defaultValues: {
      contactoReceptorId: '',
      receptorNombre: '',
      receptorDocumento: '',
      horaEntrega: '',
    },
  });

  const clienteId = acta?.factura.clienteId ?? null;

  // Solo buscar contactos cuando ya sabemos el clienteId del acta.
  const { data: contactosResp } = useContactos(
    clienteId ? { clienteId, limit: 100 } : undefined,
  );
  const contactos: Contacto[] = contactosResp?.data ?? [];

  // Autocompletar nombre cuando el usuario elige un contacto existente.
  const contactoId = form.watch('contactoReceptorId');
  useEffect(() => {
    if (!contactoId) return;
    const c = contactos.find((x) => x.id === contactoId);
    if (c) {
      const nombre = [c.nombre, c.apellido].filter(Boolean).join(' ');
      form.setValue('receptorNombre', nombre);
      // El contacto no tiene DUI propio; lo dejamos vacío para que el operador lo ingrese si hace falta.
      form.setValue('receptorDocumento', '');
    }
  }, [contactoId, contactos, form]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!acta) {
    return (
      <EmptyState
        icon="clipboard"
        title="Acta no encontrada"
        message="La acta no existe o fue eliminada."
      />
    );
  }

  if (acta.estado !== 'DESPACHADO') {
    return (
      <div>
        <PageHeader title={`Entrega — ${acta.numeroActa}`} back />
        <EmptyState
          icon="clipboard"
          title="No aplica"
          message={`Esta acta está en estado ${acta.estado}. Solo se puede confirmar entrega desde estado DESPACHADO.`}
        />
      </div>
    );
  }

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await cambiar.mutateAsync({
        id,
        data: {
          estado: 'ENTREGADO',
          contactoReceptorId: data.contactoReceptorId || undefined,
          receptorNombre: data.receptorNombre || undefined,
          receptorDocumento: data.receptorDocumento || undefined,
          horaEntrega: data.horaEntrega || undefined,
        },
      });
      router.push(`/actas/${id}`);
    } catch {
      // El hook ya emitió toast.error; no duplicar.
    }
  });

  return (
    <form onSubmit={onSubmit}>
      <PageHeader
        title="Confirmar entrega al receptor"
        subtitle={
          <>
            <span className="font-mono">{acta.numeroActa}</span> · <Badge status={acta.estado} />
          </>
        }
        back
      />

      {/* Aviso contextual — explica el cambio de estado que ocurrirá */}
      <div className="rounded-md border border-bd bg-ok-soft/40 border-l-4 border-l-ok p-4 mb-4 text-sm text-tx">
        Al confirmar, el acta pasará a estado <b>ENTREGADO</b>. Registrá quién recibió
        físicamente en sitio.
      </div>

      <div className="rounded-lg border border-bd bg-surface p-4 mb-4">
        <div className="grid sm:grid-cols-2 gap-3">
          {/* Selector de contacto del cliente — opcional, autocompleta nombre */}
          <div className="sm:col-span-2">
            <label className={labelCls}>Contacto del cliente</label>
            <Controller
              control={form.control}
              name="contactoReceptorId"
              render={({ field }) => (
                <select {...field} className={inputBase}>
                  <option value="">— Receptor libre —</option>
                  {contactos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {[c.nombre, c.apellido].filter(Boolean).join(' ')}
                      {c.cargo ? ` · ${c.cargo}` : ''}
                    </option>
                  ))}
                </select>
              )}
            />
          </div>

          <div>
            <label className={labelCls}>
              Nombre del receptor <span className="text-danger">*</span>
            </label>
            <input
              {...form.register('receptorNombre')}
              className={inputBase}
              placeholder="Quien firma la entrega"
            />
            {form.formState.errors.receptorNombre && (
              <div className="text-xs text-danger mt-1">
                {form.formState.errors.receptorNombre.message}
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Documento (DUI / otro)</label>
            <input
              {...form.register('receptorDocumento')}
              className={`${inputBase} font-mono`}
              placeholder="01234567-8"
            />
          </div>

          <div>
            <label className={labelCls}>Hora de entrega</label>
            <input
              type="time"
              {...form.register('horaEntrega')}
              className={`${inputBase} font-mono`}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push(`/actas/${id}`)}
          className="px-3 py-1.5 text-sm rounded-md border border-bd text-tx hover:bg-bg-sunken transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={cambiar.isPending}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60"
        >
          <Icon name="check" size={14} />
          {cambiar.isPending ? 'Confirmando…' : 'Confirmar entrega'}
        </button>
      </div>
    </form>
  );
}
