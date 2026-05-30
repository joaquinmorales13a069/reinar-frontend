'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { useActualizarPerfil } from '@/hooks/use-perfil';
import { actualizarPerfilSchema, type ActualizarPerfilForm } from '@/lib/schemas/perfil';
import { formatDateTime, getInitials } from '@/lib/utils';
import type { Perfil, RolUsuario } from '@/types/api';

const ROL_LABEL: Record<RolUsuario, string> = {
  ADMIN: 'Admin',
  GERENTE: 'Gerente',
  OPERADOR: 'Operador',
  LOGISTICA: 'Logística',
  VISUALIZADOR: 'Visualizador',
};

const inputBase = 'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1 text-left';
const errorCls = 'text-xs text-danger mt-1';

export function PerfilTarjeta({ perfil }: { perfil: Perfil }) {
  const [editando, setEditando] = useState(false);
  const actualizar = useActualizarPerfil();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ActualizarPerfilForm>({
    resolver: zodResolver(actualizarPerfilSchema) as never,
    defaultValues: { nombre: perfil.nombre, apellido: perfil.apellido },
  });

  async function onSubmit(v: ActualizarPerfilForm) {
    await actualizar.mutateAsync({ nombre: v.nombre.trim(), apellido: v.apellido.trim() });
    setEditando(false);
  }

  function cancelar() {
    reset({ nombre: perfil.nombre, apellido: perfil.apellido });
    setEditando(false);
  }

  return (
    <div className="rounded-lg border border-bd bg-surface p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-24 h-24 rounded-full bg-accent text-navy grid place-items-center text-3xl font-bold">
          {getInitials(`${perfil.nombre} ${perfil.apellido}`)}
        </div>

        {!editando ? (
          <>
            <div>
              <h2 className="text-xl font-semibold">{perfil.nombre} {perfil.apellido}</h2>
              <div className="text-sm font-mono text-tx-2 mt-1">{perfil.email}</div>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              <Badge status={ROL_LABEL[perfil.rol]} kind="accent" />
              <Badge status={perfil.mfaActivo ? '2FA activo' : '2FA inactivo'} kind={perfil.mfaActivo ? 'ok' : 'neutral'} />
            </div>
            <div className="text-xs font-mono text-tx-3">
              Último acceso: {perfil.ultimoAcceso ? formatDateTime(perfil.ultimoAcceso) : 'Nunca'}
            </div>
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-tx-2 border border-bd hover:bg-bg-sunken transition-colors"
            >
              <Icon name="edit" size={12} /> Editar nombre
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="w-full text-left">
            <div className="mb-3">
              <label className={labelCls}>Nombre</label>
              <input className={errors.nombre ? inputErr : inputOk} {...register('nombre')} />
              {errors.nombre && <p className={errorCls}>{errors.nombre.message}</p>}
            </div>
            <div className="mb-3">
              <label className={labelCls}>Apellido</label>
              <input className={errors.apellido ? inputErr : inputOk} {...register('apellido')} />
              {errors.apellido && <p className={errorCls}>{errors.apellido.message}</p>}
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={cancelar}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-tx-2 border border-bd hover:bg-bg-sunken transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || actualizar.isPending}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon name="check" size={12} /> Guardar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
