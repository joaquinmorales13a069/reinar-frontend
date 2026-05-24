'use client';
// components/dashboard/ActivityFeed.tsx
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import type { DashboardKpis } from '@/types/dashboard';

type ActivityFeedProps = {
  actividad: DashboardKpis['actividadReciente'];
  onRefresh: () => void;
};

// El backend emite acciones como VERBO_ENTIDAD en mayúsculas
// (ej. CREAR_CLIENTE, CAMBIAR_ESTADO_PIEZA, AJUSTAR_STOCK_CONSUMIBLE).
// Mapeamos solo el verbo; la entidad se resuelve por separado vía ENTITY_LABEL.
const VERBO_LABEL: Record<string, string> = {
  CREAR:          'creó',
  ACTUALIZAR:     'actualizó',
  ELIMINAR:       'eliminó',
  CAMBIAR_ESTADO: 'cambió el estado de',
  AJUSTAR_STOCK:  'ajustó el stock de',
  ACTIVAR:        'activó',
  DESACTIVAR:     'desactivó',
  EMITIR:         'emitió',
  ANULAR:         'anuló',
  DESPACHAR:      'despachó',
  ENTREGAR:       'entregó',
  REGISTRAR:      'registró',
  APROBAR:        'aprobó',
  RECHAZAR:       'rechazó',
};

const ENTITY_LABEL: Record<string, string> = {
  Cotizacion:        'cotización',
  Factura:           'factura',
  Pago:              'pago',
  ActaEntrega:       'acta de entrega',
  Cliente:           'cliente',
  Contacto:          'contacto',
  Equipo:            'equipo',
  Servicio:          'servicio',
  PiezaTipo:         'pieza de andamio',
  CuerpoTipo:        'configuración de andamio',
  HerramientaTipo:   'herramienta',
  HerramientaUnidad: 'unidad de herramienta',
  Consumible:        'consumible',
  Bodega:            'bodega',
  Proyecto:          'proyecto',
  Usuario:           'usuario',
  Configuracion:     'configuración',
};

const ENTITY_ICON: Record<string, IconName> = {
  Cotizacion:        'fileText',
  Factura:           'receipt',
  Pago:              'dollar',
  ActaEntrega:       'clipboard',
  Cliente:           'user',
  Contacto:          'idCard',
  Equipo:            'package',
  Servicio:          'tool',
  PiezaTipo:         'layers',
  CuerpoTipo:        'layers',
  HerramientaTipo:   'hammer',
  HerramientaUnidad: 'hammer',
  Consumible:        'package',
  Bodega:            'warehouse',
  Proyecto:          'building',
  Usuario:           'user',
  Configuracion:     'gear',
};

// Prefijos ordenados por longitud descendente: "CAMBIAR_ESTADO" gana sobre "CAMBIAR".
// Si la acción no matchea ningún prefijo, devolvemos el string original con espacios
// para que al menos sea legible (fallback defensivo).
const VERBO_PREFIJOS = Object.keys(VERBO_LABEL).sort((a, b) => b.length - a.length);

function labelDeAccion(accion: string): string {
  for (const p of VERBO_PREFIJOS) {
    if (accion === p || accion.startsWith(`${p}_`)) return VERBO_LABEL[p];
  }
  return accion.toLowerCase().replace(/_/g, ' ');
}

export function ActivityFeed({ actividad, onRefresh }: ActivityFeedProps) {
  return (
    <div className="rounded-lg bg-surface border border-bd flex flex-col">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-bd">
        <div>
          <h3 className="text-sm font-medium text-tx">Actividad reciente</h3>
          <p className="text-xs text-tx-3 mt-0.5">Últimas 24 horas en el sistema</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="flex items-center gap-1.5 text-xs text-tx-2 hover:text-tx transition-colors px-2 py-1 rounded hover:bg-bg-sunken"
        >
          <Icon name="refresh" size={12} />
          Actualizar
        </button>
      </div>

      <div className="divide-y divide-bd">
        {actividad.length === 0 && (
          <p className="text-sm text-tx-3 text-center py-8">Sin actividad reciente.</p>
        )}
        {actividad.map((item) => {
          const iconName: IconName = ENTITY_ICON[item.entidad] ?? 'info';
          const verbo = labelDeAccion(item.accion);
          const entidadLabel = ENTITY_LABEL[item.entidad] ?? item.entidad.toLowerCase();
          const tiempo = formatDistanceToNow(parseISO(item.createdAt), {
            locale: es,
            addSuffix: true,
          });
          return (
            <div key={`${item.entidad}-${item.entidadId}-${item.createdAt}`} className="flex gap-3 px-5 py-3">
              <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-full bg-bg-sunken flex items-center justify-center text-tx-3">
                <Icon name={iconName} size={13} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-tx leading-snug">
                  <span className="font-medium">{item.usuario ?? 'Sistema'}</span>{' '}
                  {verbo}{' '}
                  <span className="text-tx-2">{entidadLabel}</span>{' '}
                  <span className="font-mono text-xs text-tx-3">{item.entidadId.slice(0, 8)}</span>
                </p>
                <p className="text-xs text-tx-3 mt-0.5">{tiempo}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
