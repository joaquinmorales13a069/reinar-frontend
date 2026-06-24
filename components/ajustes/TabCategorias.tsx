'use client';

import { useState } from 'react';
import { FormSection } from '@/components/ui/FormSection';
import { Spinner } from '@/components/ui/Spinner';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/auth.store';
import { TIPO_CATEGORIA_LABEL } from '@/lib/categorias';
import {
  useCategorias,
  useCrearCategoria,
  useDesactivarCategoria,
} from '@/hooks/use-categorias';
import type { TipoCategoria } from '@/types/api';

const TIPOS: TipoCategoria[] = ['EQUIPO', 'HERRAMIENTA', 'CONSUMIBLE', 'MANTENIMIENTO'];

// ADMIN y GERENTE pueden crear/desactivar categorías según el backend.
// esAdmin (lib/ajustes) solo retorna true para ADMIN; aquí se usa un chequeo local
// que incluye GERENTE para espejear exactamente el backend.
function puedeEditarCategorias(rol: string | undefined): boolean {
  return rol === 'ADMIN' || rol === 'GERENTE';
}

export function TabCategorias() {
  const rol = useAuthStore((s) => s.user?.rol);
  const puedeEditar = puedeEditarCategorias(rol);
  const [tipo, setTipo] = useState<TipoCategoria>('EQUIPO');
  const [nuevo, setNuevo] = useState('');

  const { data: categorias, isLoading } = useCategorias(tipo, true);
  const crear = useCrearCategoria();
  const desactivar = useDesactivarCategoria();

  async function onCrear() {
    const nombre = nuevo.trim();
    if (!nombre) return;
    await crear.mutateAsync({ tipo, nombre });
    setNuevo('');
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex rounded-md border border-bd overflow-hidden w-fit">
        {TIPOS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTipo(t)}
            className={`px-4 py-2 text-sm transition-colors ${
              tipo === t ? 'bg-accent text-navy font-medium' : 'text-tx-2 hover:bg-bg-sunken'
            }`}
          >
            {TIPO_CATEGORIA_LABEL[t]}
          </button>
        ))}
      </div>

      <FormSection title={`Categorías de ${TIPO_CATEGORIA_LABEL[tipo]}`}>
        {puedeEditar && (
          <div className="flex gap-2 mb-4">
            <input
              className="flex-1 px-3 py-2 text-sm rounded-md border border-bd bg-surface text-tx focus:outline-none focus:border-accent"
              placeholder="Nueva categoría…"
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onCrear();
                }
              }}
            />
            <button
              type="button"
              onClick={onCrear}
              disabled={crear.isPending || !nuevo.trim()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-accent text-navy text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              <Icon name="plus" size={14} /> Agregar
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <ul className="divide-y divide-bd">
            {categorias?.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <span className={`text-sm ${c.activo ? 'text-tx' : 'text-tx-3 line-through'}`}>
                  {c.nombre}{' '}
                  <span className="text-tx-3 font-mono text-xs ml-2">{c.prefijoCodigo}</span>
                </span>
                {puedeEditar && c.activo && (
                  <button
                    type="button"
                    onClick={() => desactivar.mutate(c.id)}
                    disabled={desactivar.isPending}
                    className="text-xs text-danger hover:underline disabled:opacity-50"
                  >
                    Desactivar
                  </button>
                )}
              </li>
            ))}
            {!isLoading && (!categorias || categorias.length === 0) && (
              <li className="py-4 text-sm text-tx-3 text-center">
                Sin categorías registradas para este tipo.
              </li>
            )}
          </ul>
        )}
      </FormSection>
    </div>
  );
}
