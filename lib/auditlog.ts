// Helpers compartidos por la tabla y el drawer de auditlog. No exporta hooks
// ni componentes — solo datos y funciones puras.

// Lista de entidades conocidas que aparecen como `entidad` en los registros
// de auditoría. Se usa para poblar el <select> del filtro. Si el backend
// genera una entidad nueva no listada, el filtro como input free-text via
// query manual sigue funcionando.
export const ENTIDADES_CONOCIDAS = [
  'Usuario',
  'Cliente',
  'Contacto',
  'Cotizacion',
  'Factura',
  'Equipo',
  'HerramientaTipo',
  'HerramientaUnidad',
  'Consumible',
  'PiezaTipo',
  'CuerpoAndamio',
  'Bodega',
  'Servicio',
  'Proyecto',
  'ActaEntrega',
  'Recepcion',
  'Pago',
  'NotaCredito',
  'Retencion',
  'Mantenimiento',
  'DepositoGarantia',
  'ConfiguracionEmpresa',
  'ConfiguracionReportes',
] as const;

// Lista de acciones top que se sugieren en el datalist del filtro accion.
// El input es free-text — esta lista solo es autocompletado, no un enum.
// Cubre las acciones más usadas hoy; otras se pueden tipear a mano.
export const ACCIONES_SUGERIDAS = [
  'CREAR_USUARIO',
  'ACTUALIZAR_USUARIO',
  'CAMBIAR_ESTADO_USUARIO',
  'ACTUALIZAR_PERFIL',
  'ACTUALIZAR_CONFIGURACION',
  'ACTUALIZAR_CONFIGURACION_REPORTES',
  'CREAR_COTIZACION',
  'ACTUALIZAR_COTIZACION',
  'CAMBIAR_ESTADO_COTIZACION',
  'CANCELAR_COTIZACION_POR_ANULACION_FACTURA',
  'CREAR_EQUIPO',
  'ACTUALIZAR_EQUIPO',
  'CAMBIAR_ESTADO_EQUIPO',
  'MOVER_BODEGA_EQUIPO',
  'ACTA_CREADA',
  'ACTA_DESPACHADA',
  'ACTA_ENTREGADA',
  'RECEPCION_REGISTRADA',
  'CREAR_MANTENIMIENTO',
  'REGISTRAR_SALIDA_MANTENIMIENTO',
] as const;

// Deriva el color del badge a partir del prefijo del string. Las acciones del
// backend crecen con cada módulo — un map exhaustivo se desincroniza, este
// prefix-match es self-healing.
type AccionKind = 'ok' | 'info' | 'warn' | 'danger';

export function colorPorAccion(accion: string): AccionKind {
  const a = accion.toUpperCase();
  if (a.startsWith('CREAR') || a.startsWith('REGISTRAR_PAGO') || a.startsWith('RECIBIR')) return 'ok';
  if (a.startsWith('ELIMINAR') || a.startsWith('CANCELAR') || a.startsWith('DESACTIVAR') || a.startsWith('ANULAR')) return 'danger';
  if (a.startsWith('CAMBIAR_ESTADO') || a.startsWith('REGISTRAR') || a.startsWith('AJUSTAR') || a.startsWith('TRANSFERIR')) return 'warn';
  return 'info';
}

// Helpers de chips de período. Devuelven `desde` como ISO date string (YYYY-MM-DD)
// para pasarlo al backend, que hace z.coerce.date().
export type Periodo = 'hoy' | 'semana' | 'mes' | null;

export function calcularDesdePeriodo(periodo: Periodo): string | undefined {
  if (!periodo) return undefined;
  const ahora = new Date();
  if (periodo === 'hoy') {
    ahora.setHours(0, 0, 0, 0);
    return ahora.toISOString();
  }
  if (periodo === 'semana') {
    // Lunes 00:00 — diaSemana=0 (Dom) cuenta como retroceder 6 días.
    const diaSemana = ahora.getDay();
    const diasDesdeElLunes = diaSemana === 0 ? 6 : diaSemana - 1;
    ahora.setDate(ahora.getDate() - diasDesdeElLunes);
    ahora.setHours(0, 0, 0, 0);
    return ahora.toISOString();
  }
  // mes
  ahora.setDate(1);
  ahora.setHours(0, 0, 0, 0);
  return ahora.toISOString();
}
