'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type UseFormRegister, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/auth.store';
import { esElPropioUsuario } from '@/lib/ajustes';
import { trySetFieldErrorFromApi } from '@/lib/api-errors';
import {
  usuarioCrearSchema,
  usuarioEditarSchema,
  type UsuarioCrearForm,
  type UsuarioEditarForm,
} from '@/lib/schemas/ajustes';
import { useCrearUsuario, useActualizarUsuario } from '@/hooks/use-usuarios';
import type { RolUsuario, Usuario } from '@/types/api';

const ROLES: { value: RolUsuario; label: string }[] = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'GERENTE', label: 'Gerente' },
  { value: 'OPERADOR', label: 'Operador' },
  { value: 'LOGISTICA', label: 'Logística' },
  { value: 'VISUALIZADOR', label: 'Visualizador' },
];

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const inputDisabled = `${inputBase} border-bd opacity-70 cursor-not-allowed`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-1';
const hintCls = 'text-xs text-tx-3 mt-1';

type Props =
  | { modo: 'crear'; usuario?: undefined }
  | { modo: 'editar'; usuario: Usuario };

export function UsuarioForm(props: Props) {
  if (props.modo === 'crear') return <FormCrear />;
  return <FormEditar usuario={props.usuario} />;
}

function FormCrear() {
  const router = useRouter();
  const crear = useCrearUsuario();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UsuarioCrearForm>({
    resolver: zodResolver(usuarioCrearSchema) as never,
    defaultValues: {
      nombre: '',
      apellido: '',
      email: '',
      contrasena: '',
      confirmar: '',
      rol: 'OPERADOR',
    },
  });

  async function onSubmit(v: UsuarioCrearForm) {
    try {
      await crear.mutateAsync({
        nombre: v.nombre.trim(),
        apellido: v.apellido.trim(),
        email: v.email.trim(),
        contrasena: v.contrasena,
        rol: v.rol,
      });
      router.push('/ajustes?tab=usuarios');
    } catch (err) {
      // Mapear 409 email-duplicado a inline; los demás errores ya están toasteados por el hook.
      trySetFieldErrorFromApi(err, setError, 'email', { codes: ['CONFLICT'], matchHint: 'email' });
    }
  }

  return (
    <Layout
      title="Nuevo usuario"
      subtitle="Al crear el usuario podrá iniciar sesión inmediatamente con la contraseña indicada."
      submitLabel="Crear usuario"
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting || crear.isPending}
    >
      <CamposBaseCrear register={register} errors={errors} />
      <FormSection title="Contraseña">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>
              Contraseña <span className="text-danger">*</span>
            </label>
            <input
              type="password"
              className={errors.contrasena ? inputErr : inputOk}
              {...register('contrasena')}
            />
            {errors.contrasena && <p className={errorCls}>{errors.contrasena.message}</p>}
            {!errors.contrasena && <p className={hintCls}>Mínimo 8 caracteres.</p>}
          </div>
          <div>
            <label className={labelCls}>
              Confirmar contraseña <span className="text-danger">*</span>
            </label>
            <input
              type="password"
              className={errors.confirmar ? inputErr : inputOk}
              {...register('confirmar')}
            />
            {errors.confirmar && <p className={errorCls}>{errors.confirmar.message}</p>}
          </div>
        </div>
      </FormSection>
    </Layout>
  );
}

function FormEditar({ usuario }: { usuario: Usuario }) {
  const router = useRouter();
  const editar = useActualizarUsuario();
  const idActual = useAuthStore((s) => s.user?.id);
  const esYo = esElPropioUsuario(usuario.id, idActual);

  // Sección de contraseña colapsada por defecto al editar; el usuario debe
  // explícitamente expandirla para cambiarla (refleja el comportamiento del
  // backend de no tocar el hash si contrasena viene vacía).
  const [cambiarPwd, setCambiarPwd] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UsuarioEditarForm>({
    resolver: zodResolver(usuarioEditarSchema) as never,
    defaultValues: {
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      rol: usuario.rol,
      contrasena: '',
      confirmar: '',
    },
  });

  async function onSubmit(v: UsuarioEditarForm) {
    try {
      await editar.mutateAsync({
        id: usuario.id,
        data: {
          nombre: v.nombre.trim(),
          apellido: v.apellido.trim(),
          email: v.email.trim(),
          rol: v.rol,
          // Solo enviamos contrasena si el usuario abrió la sección y la llenó.
          contrasena: cambiarPwd && v.contrasena ? v.contrasena : undefined,
        },
      });
      router.push('/ajustes?tab=usuarios');
    } catch (err) {
      trySetFieldErrorFromApi(err, setError, 'email', { codes: ['CONFLICT'], matchHint: 'email' });
    }
  }

  return (
    <Layout
      title="Editar usuario"
      subtitle={`${usuario.nombre} ${usuario.apellido}`}
      submitLabel="Guardar cambios"
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting || editar.isPending}
    >
      <CamposBaseEditar register={register} errors={errors} disabledRol={esYo} />
      <FormSection title="Contraseña">
        {!cambiarPwd ? (
          <button
            type="button"
            onClick={() => setCambiarPwd(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-tx-2 border border-bd hover:bg-bg-sunken transition-colors"
          >
            <Icon name="edit" size={12} /> Cambiar contraseña
          </button>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nueva contraseña</label>
              <input
                type="password"
                className={errors.contrasena ? inputErr : inputOk}
                {...register('contrasena')}
              />
              {errors.contrasena && <p className={errorCls}>{errors.contrasena.message}</p>}
              {!errors.contrasena && (
                <p className={hintCls}>Mínimo 8 caracteres. Dejar vacío para no cambiar.</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Confirmar nueva</label>
              <input
                type="password"
                className={errors.confirmar ? inputErr : inputOk}
                {...register('confirmar')}
              />
              {errors.confirmar && <p className={errorCls}>{errors.confirmar.message}</p>}
            </div>
          </div>
        )}
      </FormSection>
    </Layout>
  );
}

// Campos base para crear: nombre, apellido, email, rol (todos editables).
function CamposBaseCrear({
  register,
  errors,
}: {
  register: UseFormRegister<UsuarioCrearForm>;
  errors: FieldErrors<UsuarioCrearForm>;
}) {
  return (
    <FormSection title="Datos del usuario">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>
            Nombre <span className="text-danger">*</span>
          </label>
          <input className={errors.nombre ? inputErr : inputOk} {...register('nombre')} />
          {errors.nombre && <p className={errorCls}>{errors.nombre.message}</p>}
        </div>
        <div>
          <label className={labelCls}>
            Apellido <span className="text-danger">*</span>
          </label>
          <input className={errors.apellido ? inputErr : inputOk} {...register('apellido')} />
          {errors.apellido && <p className={errorCls}>{errors.apellido.message}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>
            Email corporativo <span className="text-danger">*</span>
          </label>
          <input
            type="email"
            className={`${errors.email ? inputErr : inputOk} font-mono`}
            placeholder="nombre.apellido@reinar.com.sv"
            {...register('email')}
          />
          {errors.email && <p className={errorCls}>{errors.email.message}</p>}
        </div>
        <div>
          <label className={labelCls}>
            Rol <span className="text-danger">*</span>
          </label>
          <select className={errors.rol ? inputErr : inputOk} {...register('rol')}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          {errors.rol && <p className={errorCls}>{errors.rol.message}</p>}
        </div>
      </div>
    </FormSection>
  );
}

// Campos base para editar: rol puede ir disabled si es el propio usuario autenticado.
// El backend devuelve 403 cuando un admin intenta cambiar su propio rol;
// prevenir la llamada en UI evita clicks que fallan y comunica la restricción.
function CamposBaseEditar({
  register,
  errors,
  disabledRol,
}: {
  register: UseFormRegister<UsuarioEditarForm>;
  errors: FieldErrors<UsuarioEditarForm>;
  disabledRol: boolean;
}) {
  return (
    <FormSection title="Datos del usuario">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>
            Nombre <span className="text-danger">*</span>
          </label>
          <input className={errors.nombre ? inputErr : inputOk} {...register('nombre')} />
          {errors.nombre && <p className={errorCls}>{errors.nombre.message}</p>}
        </div>
        <div>
          <label className={labelCls}>
            Apellido <span className="text-danger">*</span>
          </label>
          <input className={errors.apellido ? inputErr : inputOk} {...register('apellido')} />
          {errors.apellido && <p className={errorCls}>{errors.apellido.message}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>
            Email corporativo <span className="text-danger">*</span>
          </label>
          <input
            type="email"
            className={`${errors.email ? inputErr : inputOk} font-mono`}
            placeholder="nombre.apellido@reinar.com.sv"
            {...register('email')}
          />
          {errors.email && <p className={errorCls}>{errors.email.message}</p>}
        </div>
        <div>
          <label className={labelCls}>
            Rol <span className="text-danger">*</span>
          </label>
          <select
            className={disabledRol ? inputDisabled : errors.rol ? inputErr : inputOk}
            disabled={disabledRol}
            {...register('rol')}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          {disabledRol && <p className={hintCls}>No puedes cambiar tu propio rol.</p>}
          {errors.rol && <p className={errorCls}>{errors.rol.message}</p>}
        </div>
      </div>
    </FormSection>
  );
}

// Layout compartido: header + children + footer sticky con cancelar/guardar.
function Layout({
  title,
  subtitle,
  submitLabel,
  onSubmit,
  isSubmitting,
  children,
}: {
  title: string;
  subtitle?: string;
  submitLabel: string;
  onSubmit: () => void;
  isSubmitting: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-4 pb-24"
    >
      <PageHeader
        title={title}
        subtitle={subtitle}
        back
        backLabel="Ajustes"
        onBack={() => router.push('/ajustes?tab=usuarios')}
      />
      <div className="max-w-3xl">{children}</div>
      <div className="sticky bottom-0 left-0 right-0 -mx-4 px-4 py-3 bg-bg border-t border-bd flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push('/ajustes?tab=usuarios')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-tx-2 border border-bd hover:bg-bg-sunken transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon name="check" size={14} /> {submitLabel}
        </button>
      </div>
    </form>
  );
}
