'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { PhoneInputField } from '@/components/ui/PhoneInputField';
import { useCrearContacto } from '@/hooks/use-contactos';
import type { Contacto } from '@/types/api';

type TipoContacto = 'PRINCIPAL' | 'SECUNDARIO' | 'SOLICITANTE' | 'FACTURACION' | 'OPERATIVO';

const TIPOS_CONTACTO: { value: TipoContacto; label: string }[] = [
  { value: 'PRINCIPAL', label: 'Principal' },
  { value: 'SECUNDARIO', label: 'Secundario' },
  { value: 'SOLICITANTE', label: 'Solicitante' },
  { value: 'FACTURACION', label: 'Facturación' },
  { value: 'OPERATIVO', label: 'Operativo' },
];

const schema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio.'),
  cargo: z.string().optional(),
  telefono: z.string().optional(),
  email: z
    .string()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: 'Correo inválido.' }),
  tipoContacto: z.enum(['PRINCIPAL', 'SECUNDARIO', 'SOLICITANTE', 'FACTURACION', 'OPERATIVO']),
});

type FormData = z.infer<typeof schema>;

// Reutilizamos exactamente las mismas clases de input que ContactoForm para
// mantener consistencia visual con el resto del modulo.
const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;

interface Props {
  clienteId: string;
  defaultTipo?: TipoContacto;
  onClose: () => void;
  onCreated: (contacto: Contacto) => void;
}

export function ContactoFormMinModal({ clienteId, defaultTipo = 'SOLICITANTE', onClose, onCreated }: Props) {
  const qc = useQueryClient();
  const crear = useCrearContacto();
  // Portal a document.body para que el <form> del modal no quede anidado dentro
  // del <form> del wizard (HTML invalido + warning de hidratacion en Next).
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre: '',
      cargo: '',
      telefono: '',
      email: '',
      tipoContacto: defaultTipo,
    },
  });

  // Cerrar con tecla Escape para una UX consistente con otros panels modales.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleError(err: unknown) {
    const e = (err as { response?: { data?: { error?: { message?: string; details?: { field: string; message: string }[] } } } })
      ?.response?.data?.error;
    const details = e?.details ?? [];
    details.forEach((d) => setError(d.field as keyof FormData, { message: d.message }));
    if (!details.length) toast.error(e?.message ?? 'No se pudo crear el contacto.');
  }

  function onSubmit(values: FormData) {
    // El endpoint standalone POST /contactos requiere clienteId en el body
    // junto al resto de campos del contacto.
    crear.mutate(
      {
        clienteId,
        nombre: values.nombre,
        cargo: values.cargo || undefined,
        telefono: values.telefono || undefined,
        email: values.email || undefined,
        tipoContacto: values.tipoContacto,
        activo: true,
      } as unknown as Omit<Contacto, 'id'>,
      {
        onSuccess: (c) => {
          toast.success('Contacto creado correctamente.');
          // Invalidamos por clienteId para que el dropdown del wizard refresque
          // de inmediato sin esperar al refetch automatico.
          qc.invalidateQueries({ queryKey: ['contactos'] });
          onCreated(c);
        },
        onError: handleError,
      },
    );
  }

  const isPending = crear.isPending;

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        // Solo cerrar al hacer click en el backdrop, no al soltar el mouse
        // dentro del panel y arrastrar hacia afuera.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-lg border border-bd bg-surface shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
          <div>
            <h3 className="text-sm font-semibold text-tx">Nuevo contacto</h3>
            <p className="text-xs text-tx-3 mt-0.5">Se vinculará al cliente seleccionado.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-tx-3 hover:text-tx hover:bg-bg-sunken transition-colors"
            aria-label="Cerrar"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-4 py-4 space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-tx-2">
              Nombre <span className="text-danger">*</span>
            </label>
            <input
              className={errors.nombre ? inputErr : inputOk}
              {...register('nombre')}
              placeholder="Ej. María José"
              autoFocus
            />
            {errors.nombre && <p className="text-xs text-danger mt-0.5">{errors.nombre.message}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-tx-2">Cargo</label>
            <input
              className={inputOk}
              {...register('cargo')}
              placeholder="Ej. Gerente de Compras"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-tx-2">Teléfono</label>
              <PhoneInputField control={control} name="telefono" placeholder="7777-0000" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-tx-2">Correo</label>
              <input
                className={errors.email ? inputErr : inputOk}
                type="email"
                {...register('email')}
                placeholder="contacto@empresa.sv"
              />
              {errors.email && <p className="text-xs text-danger mt-0.5">{errors.email.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-tx-2">Tipo de contacto</label>
            <select className={inputOk} {...register('tipoContacto')}>
              {TIPOS_CONTACTO.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-bd">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm text-tx-2 border border-bd hover:bg-bg-sunken transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Spinner /> Guardando…
                </>
              ) : (
                <>
                  <Icon name="check" size={14} /> Crear contacto
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
