'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';

// Panel colapsable con la guía operativa para corregir errores en datos del
// acta cuando ya está congelada (estado ENTREGADO o posterior). Por diseño,
// no hay edición directa post-entrega — el cliente firmó el papel y
// desincronizar sistema vs. firma es peligroso. Las correcciones son manuales.
export function CorreccionesAyuda() {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="rounded-lg border border-bd bg-bg-sunken p-4 mt-4">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex items-center gap-2 text-sm font-semibold text-tx hover:text-accent transition-colors"
      >
        <Icon name="info" size={16} />
        ¿Detectaste un error en los datos del acta?
        <Icon
          name="chevronDown"
          size={14}
          className={`transition-transform ${abierto ? 'rotate-180' : ''}`}
        />
      </button>

      {abierto && (
        <div className="mt-3 text-sm text-tx-2 space-y-3">
          <p>
            Una vez confirmada la entrega, los datos del acta quedan{' '}
            <b>congelados</b> en el sistema porque el cliente firmó la versión física —
            modificar acá crearía una discrepancia entre lo firmado y lo registrado.
          </p>

          <div className="border-l-2 border-accent pl-3">
            <p className="font-semibold text-tx mb-1">Errores menores</p>
            <p className="text-xs">
              Horómetro mal anotado, condición incorrecta, observación olvidada, etc.
            </p>
            <p className="text-xs mt-1">
              <b>Procedimiento:</b> agregar una nota correctiva en el campo <i>Notas</i> del
              acta con el formato: <code className="font-mono text-xs">Corrección [fecha]: el
              horómetro del equipo X era N, no M como se anotó.</code> El cambio queda en
              auditoría. Para editar las notas, contactá a un usuario ADMIN.
            </p>
          </div>

          <div className="border-l-2 border-warn pl-3">
            <p className="font-semibold text-tx mb-1">Errores graves</p>
            <p className="text-xs">
              Equipo equivocado entregado, ítem faltante, etc.
            </p>
            <p className="text-xs mt-1">
              <b>Procedimiento:</b>
            </p>
            <ol className="list-decimal list-inside text-xs space-y-1 mt-1">
              <li>Crear una <b>recepción</b> en el sistema devolviendo el ítem incorrecto.</li>
              <li>Crear una <b>acta nueva</b> con el ítem correcto siguiendo el flujo normal
                  (PENDIENTE → inspección → despacho → entrega).</li>
              <li>Si la entrega ya fue facturada y se detectó el error después del DTE,
                  consultar con el equipo de facturación para evaluar nota de crédito.</li>
            </ol>
          </div>

          <p className="text-xs text-tx-3">
            Si el caso no encaja en ninguna de estas categorías, contactá a tu supervisor antes
            de actuar. La integridad del documento firmado es prioridad.
          </p>
        </div>
      )}
    </div>
  );
}
