'use client';

import { useRouter } from 'next/navigation';
import { FseForm } from '@/components/fse/FseForm';
import { useCrearFse } from '@/hooks/use-fse';
import type { CrearFseDto } from '@/types/api';

export default function NuevoFsePage() {
  const router = useRouter();
  const crear = useCrearFse();

  async function guardar(dto: CrearFseDto) {
    try {
      const fse = await crear.mutateAsync(dto);
      router.push(`/fse/${fse.id}`);
    } catch {
      // useCrearFse ya muestra toast.error internamente
    }
  }

  return (
    <FseForm
      tituloPagina="Nuevo FSE"
      subtituloPagina="Formulario Único de Sujeto Excluido — compras a proveedores sin factura (Art. 28 LIVA)."
      submitLabel="Crear FSE"
      isGuardando={crear.isPending}
      onGuardar={guardar}
    />
  );
}
