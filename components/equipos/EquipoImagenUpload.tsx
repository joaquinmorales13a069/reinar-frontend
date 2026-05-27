'use client';

import { useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';

type Props = {
  imagenUrl: string | null;
  // El padre decide qué hacer con el archivo (subirlo de inmediato o
  // guardarlo para mandar tras crear el equipo). Devolvemos también un
  // preview blob URL para que el padre pueda mostrarlo si quiere.
  onFileSelected: (file: File, previewUrl: string) => void;
  onClear?: () => void;
  // Cuando subir está deshabilitado (por permisos), no mostramos el input
  // y la imagen pasa a ser solo lectura.
  readOnly?: boolean;
  // Modo compacto: la zona del prototipo en el detalle es alta (220px),
  // pero en el form usamos 120px. Esta prop alterna entre los dos.
  variant?: 'detalle' | 'form';
};

// Tipos MIME aceptados — debe coincidir con la config del middleware
// uploadImagen del backend (que solo acepta imágenes).
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function EquipoImagenUpload({
  imagenUrl,
  onFileSelected,
  onClear,
  readOnly = false,
  variant = 'detalle',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // En modo "detalle" usamos aspect-square (cuadrado al ancho de la columna)
  // para que la imagen del equipo tenga proporciones uniformes; en "form" se
  // mantiene la previsualización compacta de 128×160px.
  const heightCls = variant === 'detalle' ? 'aspect-square' : 'h-32';
  const widthCls = variant === 'form' ? 'w-40' : 'w-full';

  function handleFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Formato no soportado. Usá JPG, PNG o WEBP.');
      return;
    }
    // Límite de 5 MB. El backend usa un límite mayor pero queremos rechazar
    // archivos enormes en cliente para feedback inmediato.
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen supera los 5 MB.');
      return;
    }
    const preview = URL.createObjectURL(file);
    onFileSelected(file, preview);
  }

  const containerCls = `relative ${widthCls} ${heightCls} rounded-md overflow-hidden grid place-items-center ${
    imagenUrl ? 'border border-bd' : 'border border-dashed border-bd-strong bg-bg-sunken'
  } ${readOnly ? '' : 'cursor-pointer'}`;

  return (
    <div className="flex flex-col gap-2">
      <div
        className={containerCls}
        onClick={() => !readOnly && inputRef.current?.click()}
        onDragOver={(e) => !readOnly && e.preventDefault()}
        onDrop={(e) => {
          if (readOnly) return;
          e.preventDefault();
          handleFile(e.dataTransfer.files?.[0]);
        }}
        title={readOnly ? undefined : imagenUrl ? 'Cambiar imagen' : 'Subir imagen'}
      >
        {imagenUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagenUrl} alt="Imagen del equipo" className="w-full h-full object-cover block" />
        ) : (
          <div className="text-center text-tx-3">
            <Icon name="package" size={32} />
            <div className="text-xs mt-1.5">{readOnly ? 'Sin imagen' : 'Subir imagen'}</div>
          </div>
        )}
      </div>
      {!readOnly && (
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
      {!readOnly && imagenUrl && onClear && (
        <button
          type="button"
          className="text-xs text-danger underline self-start hover:opacity-80 transition-opacity"
          onClick={onClear}
        >
          Eliminar imagen
        </button>
      )}
    </div>
  );
}
