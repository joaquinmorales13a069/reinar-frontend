'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { Icon } from '@/components/ui/Icon';
import { PhoneInputField } from '@/components/ui/PhoneInputField';
import {
  proveedorCrearSchema,
  proveedorEditarSchema,
  type ProveedorFormValues,
} from '@/lib/schemas/proveedores';
import { useCrearProveedor, useEditarProveedor } from '@/hooks/use-proveedores';
import type { Proveedor } from '@/types/api';
import {
  DEPARTAMENTOS_SV,
  DISTRITOS_SV,
  getMunicipiosByDept,
  getDistritosByMuniDept,
} from '@/lib/sv-geo';
import { SECTORES_CAT019, ACTIVIDADES_ECONOMICAS_SV } from '@/lib/cat019';
import {
  formatDocumento,
  TIPOS_DOCUMENTO_PARTICULAR,
  LABEL_TIPO_DOCUMENTO,
  PLACEHOLDER_POR_TIPO,
  MAXLENGTH_POR_TIPO,
  type TipoDocumentoCliente,
} from '@/lib/format-documentos';

type Props =
  | { modo: 'crear'; proveedor?: undefined }
  | { modo: 'editar'; proveedor: Proveedor };

const inputBase =
  'w-full px-3 py-2 text-sm rounded-md border bg-surface text-tx placeholder:text-tx-3 focus:outline-none focus:border-accent transition-colors';
const inputOk = `${inputBase} border-bd`;
const inputErr = `${inputBase} border-danger`;
const labelCls = 'block text-xs font-medium text-tx-2 mb-1';
const errorCls = 'text-xs text-danger mt-1';

const DEFAULTS_FISCALES = {
  tipoDocumento: '' as const,
  numeroDocumento: '',
  tipoPersona: '' as const,
  actividadEconomica: '',
  departamento: '',
  municipio: '',
  distrito: '',
  complemento: '',
  giroPredominante: '' as const,
};

export function ProveedorForm(props: Props) {
  const router = useRouter();
  const crear = useCrearProveedor();
  const editar = useEditarProveedor();
  // Filtro auxiliar de UI (no se envía al backend) para acotar el <select> de
  // actividad económica por sector — mismo patrón que ClienteForm.
  const [sector, setSector] = useState('');

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProveedorFormValues>({
    resolver: zodResolver(props.modo === 'crear' ? proveedorCrearSchema : proveedorEditarSchema) as never,
    defaultValues:
      props.modo === 'crear'
        ? { nombre: '', nrc: '', nit: '', contacto: '', telefono: '', email: '', notas: '', ...DEFAULTS_FISCALES }
        : {
            nombre: props.proveedor.nombre,
            nrc: props.proveedor.nrc ?? '',
            nit: props.proveedor.nit ?? '',
            contacto: props.proveedor.contacto ?? '',
            telefono: props.proveedor.telefono ?? '',
            email: props.proveedor.email ?? '',
            notas: props.proveedor.notas ?? '',
            tipoDocumento: props.proveedor.tipoDocumento ?? '',
            numeroDocumento: props.proveedor.numeroDocumento ?? '',
            tipoPersona: props.proveedor.tipoPersona ?? '',
            actividadEconomica: props.proveedor.actividadEconomica ?? '',
            departamento: props.proveedor.departamento ?? '',
            municipio: props.proveedor.municipio ?? '',
            distrito: props.proveedor.distrito ?? '',
            complemento: props.proveedor.complemento ?? '',
            giroPredominante: props.proveedor.giroPredominante ?? '',
          },
  });

  const tipoDocumentoValue = watch('tipoDocumento') as string | undefined;
  const numeroDocReg = register('numeroDocumento');
  const departamento = watch('departamento');
  const municipio = watch('municipio');

  const munis = getMunicipiosByDept(departamento ?? '');
  // Sin dept+muni → muestra los 262 distritos; solo dept → filtra por dept; ambos → filtra por ambos.
  const distritos = !departamento
    ? DISTRITOS_SV
    : !municipio
      ? DISTRITOS_SV.filter((d) => d.department === departamento)
      : getDistritosByMuniDept(departamento, municipio);

  const actividadesFiltradas = sector
    ? ACTIVIDADES_ECONOMICAS_SV.filter((a) => a.sector === sector)
    : ACTIVIDADES_ECONOMICAS_SV;

  const { onChange: onDeptChange, ...deptRest } = register('departamento');
  const { onChange: onMuniChange, ...muniRest } = register('municipio');

  // Cuando el distrito se selecciona primero, guardamos el municipio pendiente aquí
  // y lo aplicamos DESPUÉS de que el nuevo departamento haya causado un re-render
  // con las opciones de municipio ya actualizadas en el DOM.
  const pendingMuniRef = useRef<string>('');

  useEffect(() => {
    if (pendingMuniRef.current) {
      setValue('municipio', pendingMuniRef.current);
      pendingMuniRef.current = '';
    }
  }, [departamento, setValue]);

  function aplicarErroresApi(err: unknown) {
    const anyErr = err as {
      response?: {
        status?: number;
        data?: { error?: { details?: { path: string; message: string }[] } };
      };
    };
    const details = anyErr?.response?.data?.error?.details;
    if (details?.length) {
      for (const d of details) {
        setError(d.path as keyof ProveedorFormValues, { type: 'server', message: d.message });
      }
      return;
    }
    // 409 = número de documento duplicado (constraint unique en el backend) — no
    // trae `details`, mapeamos el mensaje genérico al campo del documento.
    if (anyErr?.response?.status === 409) {
      setError('numeroDocumento', {
        type: 'server',
        message: 'Este número de documento ya está registrado en otro proveedor.',
      });
    }
  }

  async function onSubmit(values: ProveedorFormValues) {
    // Casteamos a string para poder comparar con '' sin que TS se queje del union type
    // (mismo patrón que ClienteForm.tsx).
    const tipoDocRaw = values.tipoDocumento as string | undefined;
    const tipoDoc = tipoDocRaw && tipoDocRaw !== '' ? (values.tipoDocumento as TipoDocumentoCliente) : undefined;
    const tipoPersonaRaw = values.tipoPersona as string | undefined;
    const tipoPersona = tipoPersonaRaw && tipoPersonaRaw !== '' ? (values.tipoPersona as 'NATURAL' | 'JURIDICA') : undefined;
    const giroRaw = values.giroPredominante as string | undefined;
    const giroPredominante = giroRaw && giroRaw !== '' ? (values.giroPredominante as 'BIENES' | 'SERVICIOS') : undefined;
    const payload = {
      nombre: values.nombre.trim(),
      nrc: values.nrc?.trim() || undefined,
      nit: values.nit?.trim() || undefined,
      contacto: values.contacto?.trim() || undefined,
      telefono: values.telefono?.trim() || undefined,
      email: values.email?.trim() || undefined,
      notas: values.notas?.trim() || undefined,
      tipoDocumento: tipoDoc,
      numeroDocumento: tipoDoc ? values.numeroDocumento?.trim() || undefined : undefined,
      tipoPersona,
      actividadEconomica: values.actividadEconomica || undefined,
      departamento: values.departamento || undefined,
      municipio: values.municipio || undefined,
      distrito: values.distrito || undefined,
      complemento: values.complemento?.trim() || undefined,
      giroPredominante,
    };
    try {
      if (props.modo === 'crear') {
        // useCrearProveedor ya navega a /proveedores/:id en onSuccess
        await crear.mutateAsync(payload);
      } else {
        await editar.mutateAsync({ id: props.proveedor.id, data: payload });
        router.push(`/proveedores/${props.proveedor.id}`);
      }
    } catch (err) {
      aplicarErroresApi(err);
    }
  }

  const isEditar = props.modo === 'editar';
  const isPending = isSubmitting || crear.isPending || editar.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 pb-24">
      <PageHeader
        title={isEditar ? `Editar — ${props.proveedor.nombre}` : 'Nuevo proveedor'}
        subtitle={isEditar ? 'Modifica los datos del proveedor.' : 'Registra un nuevo proveedor.'}
        back
        backLabel={isEditar ? props.proveedor.nombre : 'Proveedores'}
        onBack={() => router.push(isEditar ? `/proveedores/${props.proveedor.id}` : '/proveedores')}
      />

      <FormSection title="Información general">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelCls}>Nombre *</label>
            <input
              className={errors.nombre ? inputErr : inputOk}
              placeholder="Distribuidora Nacional S.A."
              {...register('nombre')}
            />
            {errors.nombre && <p className={errorCls}>{errors.nombre.message}</p>}
          </div>

          <div>
            <label className={labelCls}>NRC</label>
            <input
              className={errors.nrc ? inputErr : `${inputOk} font-mono`}
              placeholder="123456-7"
              {...register('nrc')}
            />
            {errors.nrc && <p className={errorCls}>{errors.nrc.message}</p>}
          </div>

          <div>
            <label className={labelCls}>NIT</label>
            <input
              className={errors.nit ? inputErr : `${inputOk} font-mono`}
              placeholder="0614-123456-001-2"
              {...register('nit')}
            />
            {errors.nit && <p className={errorCls}>{errors.nit.message}</p>}
          </div>

          <div>
            <label className={labelCls}>Persona de contacto</label>
            <input
              className={errors.contacto ? inputErr : inputOk}
              placeholder="Juan Pérez"
              {...register('contacto')}
            />
            {errors.contacto && <p className={errorCls}>{errors.contacto.message}</p>}
          </div>

          <div>
            <label className={labelCls}>Teléfono</label>
            <PhoneInputField
              control={control}
              name="telefono"
              placeholder="7777-8888"
            />
            {errors.telefono && <p className={errorCls}>{errors.telefono.message}</p>}
          </div>

          <div className="md:col-span-2">
            <label className={labelCls}>Correo electrónico</label>
            <input
              type="email"
              className={errors.email ? inputErr : inputOk}
              placeholder="ventas@proveedor.com"
              {...register('email')}
            />
            {errors.email && <p className={errorCls}>{errors.email.message}</p>}
          </div>
        </div>
      </FormSection>

      <FormSection title="Datos fiscales (para FSE)">
        <p className="text-xs text-tx-3 mb-3">
          Todos los campos son opcionales. Se usan para emitir Facturas de Sujeto Excluido (FSE)
          a proveedores que no son contribuyentes de IVA (sin NRC).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Tipo de documento</label>
            <select
              className={errors.tipoDocumento ? inputErr : inputOk}
              {...register('tipoDocumento')}
              onChange={(e) => {
                void register('tipoDocumento').onChange(e);
                setValue('numeroDocumento', '');
              }}
            >
              <option value="">— Seleccionar —</option>
              {TIPOS_DOCUMENTO_PARTICULAR.map((t) => (
                <option key={t} value={t}>{LABEL_TIPO_DOCUMENTO[t]}</option>
              ))}
            </select>
            {errors.tipoDocumento && <p className={errorCls}>{errors.tipoDocumento.message}</p>}
          </div>

          <div>
            <label className={labelCls}>Número del documento</label>
            <input
              className={`${errors.numeroDocumento ? inputErr : inputOk} font-mono`}
              inputMode={tipoDocumentoValue === 'DUI' || tipoDocumentoValue === 'NIT' ? 'numeric' : 'text'}
              maxLength={
                tipoDocumentoValue && tipoDocumentoValue !== ''
                  ? MAXLENGTH_POR_TIPO[tipoDocumentoValue as TipoDocumentoCliente]
                  : 25
              }
              placeholder={
                tipoDocumentoValue && tipoDocumentoValue !== ''
                  ? PLACEHOLDER_POR_TIPO[tipoDocumentoValue as TipoDocumentoCliente]
                  : 'Seleccioná un tipo primero'
              }
              disabled={!tipoDocumentoValue}
              {...numeroDocReg}
              onChange={(e) => {
                if (tipoDocumentoValue && tipoDocumentoValue !== '') {
                  e.target.value = formatDocumento(tipoDocumentoValue as TipoDocumentoCliente, e.target.value);
                }
                void numeroDocReg.onChange(e);
              }}
            />
            {errors.numeroDocumento && <p className={errorCls}>{errors.numeroDocumento.message}</p>}
          </div>

          <div>
            <label className={labelCls}>Tipo de persona</label>
            <select className={inputOk} {...register('tipoPersona')}>
              <option value="">— Seleccionar —</option>
              <option value="NATURAL">Natural</option>
              <option value="JURIDICA">Jurídica</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Giro predominante</label>
            <select className={inputOk} {...register('giroPredominante')}>
              <option value="">— Seleccionar —</option>
              <option value="BIENES">Bienes</option>
              <option value="SERVICIOS">Servicios</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Sector (para filtrar actividad)</label>
            <select
              className={inputOk}
              value={sector}
              onChange={(e) => {
                setSector(e.target.value);
                setValue('actividadEconomica', '');
              }}
            >
              <option value="">— Seleccionar —</option>
              {SECTORES_CAT019.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Actividad económica (CAT-019)</label>
            <select className={inputOk} {...register('actividadEconomica')}>
              <option value="">— Seleccionar actividad —</option>
              {sector ? (
                actividadesFiltradas.map((a) => (
                  <option key={a.codigo} value={a.codigo}>
                    {a.codigo} — {a.descripcion}
                  </option>
                ))
              ) : (
                SECTORES_CAT019.map((s) => {
                  const acts = ACTIVIDADES_ECONOMICAS_SV.filter((a) => a.sector === s);
                  if (!acts.length) return null;
                  return (
                    <optgroup key={s} label={s}>
                      {acts.map((a) => (
                        <option key={a.codigo} value={a.codigo}>
                          {a.codigo} — {a.descripcion}
                        </option>
                      ))}
                    </optgroup>
                  );
                })
              )}
            </select>
            {!sector && <p className="text-xs text-tx-3 mt-0.5">Seleccioná un sector para filtrar las actividades.</p>}
          </div>

          <div>
            <label className={labelCls}>Departamento</label>
            <select
              className={inputOk}
              {...deptRest}
              onChange={(e) => {
                onDeptChange(e);
                setValue('municipio', '');
                setValue('distrito', '');
              }}
            >
              <option value="">— Seleccionar —</option>
              {DEPARTAMENTOS_SV.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Municipio</label>
            <select
              className={inputOk}
              {...muniRest}
              onChange={(e) => {
                onMuniChange(e);
                setValue('distrito', '');
              }}
            >
              <option value="">— Seleccionar —</option>
              {munis.map((m) => <option key={`${m.department}-${m.value}`} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Distrito</label>
            {/* Clave compuesta dept|muni|value en el <option> porque el código de
                distrito no es único globalmente — el mismo valor existe en distintos municipios. */}
            <select
              className={inputOk}
              value={
                departamento && municipio && watch('distrito')
                  ? `${departamento}|${municipio}|${watch('distrito')}`
                  : ''
              }
              onChange={(e) => {
                const composite = e.target.value;
                if (!composite) { setValue('distrito', ''); return; }
                const [dept, muni, code] = composite.split('|');
                setValue('distrito', code);
                if (dept !== departamento) {
                  pendingMuniRef.current = muni;
                  setValue('departamento', dept);
                } else if (muni !== municipio) {
                  setValue('municipio', muni);
                }
              }}
            >
              <option value="">— Seleccionar —</option>
              {distritos.map((d) => (
                <option
                  key={`${d.department}-${d.municipality}-${d.value}`}
                  value={`${d.department}|${d.municipality}|${d.value}`}
                >
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className={labelCls}>Complemento (dirección detallada)</label>
            <textarea
              rows={2}
              className={`${inputOk} resize-y`}
              placeholder="Colonia, calle, número, referencia…"
              {...register('complemento')}
            />
            {errors.complemento && <p className={errorCls}>{errors.complemento.message}</p>}
          </div>
        </div>
      </FormSection>

      <FormSection title="Notas internas">
        <textarea
          rows={3}
          className={errors.notas ? inputErr : inputOk}
          placeholder="Condiciones comerciales, tiempos de entrega, observaciones (opcional)."
          {...register('notas')}
        />
        {errors.notas && <p className={errorCls}>{errors.notas.message}</p>}
      </FormSection>

      <div className="sticky bottom-0 left-0 right-0 -mx-4 px-4 py-3 bg-bg border-t border-bd flex justify-end gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bd text-tx-2 bg-surface text-sm hover:bg-bg-sunken transition-colors"
          onClick={() => router.push(isEditar ? `/proveedores/${props.proveedor.id}` : '/proveedores')}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Icon name="check" size={14} /> {isEditar ? 'Guardar cambios' : 'Crear proveedor'}
        </button>
      </div>
    </form>
  );
}
