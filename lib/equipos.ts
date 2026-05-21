import type { CategoriaEquipo, EstadoEquipo, FichaTecnica } from '@/types/api';

export const CATEGORIA_LABELS: Record<CategoriaEquipo, string> = {
  COMPRESOR_GENERADOR: 'Compresor / Generador',
  SANDBLASTING: 'Sandblasting',
  ANDAMIO_PLATAFORMA: 'Andamio / Plataforma',
  COMPACTADOR_RODILLO: 'Compactador / Rodillo',
  HERRAMIENTA_ESPECIALIZADA: 'Herramienta especializada',
  OTRO: 'Otro',
};

export const ESTADO_LABELS: Record<EstadoEquipo, string> = {
  DISPONIBLE: 'Disponible',
  RENTADO: 'Rentado',
  MANTENIMIENTO: 'Mantenimiento',
  USO_INTERNO: 'Uso interno',
  INACTIVO: 'Inactivo',
};

// Plantillas idénticas a las del backend (equipos.service.ts > PLANTILLAS_FICHA).
// Se duplican aquí para mostrar campos sugeridos en el editor de ficha técnica
// sin requerir una llamada extra al servidor para obtener el esqueleto.
export const PLANTILLAS_FICHA: Partial<Record<CategoriaEquipo, FichaTecnica>> = {
  COMPRESOR_GENERADOR: {
    'Potencia (HP)': '',
    'Caudal (CFM)': '',
    'Presión máxima (PSI)': '',
    'Capacidad tanque (L)': '',
    'Combustible': '',
    'Capacidad depósito combustible (L)': '',
    'Voltaje de salida (V)': '',
    'Peso (kg)': '',
  },
  SANDBLASTING: {
    'Capacidad tolva (kg)': '',
    'Presión de trabajo (PSI)': '',
    'Consumo de aire (CFM)': '',
    'Diámetro de boquilla (mm)': '',
    'Tipo de abrasivo compatible': '',
    'Peso (kg)': '',
  },
  ANDAMIO_PLATAFORMA: {
    'Altura máxima (m)': '',
    'Capacidad de carga (kg)': '',
    'Material': '',
    'Dimensiones plataforma (m × m)': '',
    'Número de niveles': '',
    'Peso total (kg)': '',
  },
  COMPACTADOR_RODILLO: {
    'Potencia (HP)': '',
    'Peso operativo (kg)': '',
    'Ancho de trabajo (cm)': '',
    'Fuerza centrífuga (kN)': '',
    'Amplitud de vibración (mm)': '',
    'Combustible': '',
    'Capacidad depósito (L)': '',
  },
  HERRAMIENTA_ESPECIALIZADA: {
    'Potencia (HP/W)': '',
    'Voltaje (V)': '',
    'Presión operativa (PSI)': '',
    'Peso (kg)': '',
  },
  // OTRO: sin plantilla — el usuario define todos los campos libremente.
};

// Prefijo por defecto sugerido al crear un equipo según su categoría.
// El backend no impone esta relación (prefijo es texto libre [A-Z0-9]+);
// sirve solo como UX para pre-rellenar el campo y que cada categoría
// quede con códigos legibles (CG-001, SB-001, etc.). El usuario puede
// editar el prefijo manualmente y, si lo hace, no se pisa al cambiar
// la categoría — ver EquipoForm.
export const PREFIJO_POR_CATEGORIA: Record<CategoriaEquipo, string> = {
  COMPRESOR_GENERADOR: 'CG',
  SANDBLASTING: 'SB',
  ANDAMIO_PLATAFORMA: 'AP',
  COMPACTADOR_RODILLO: 'CR',
  HERRAMIENTA_ESPECIALIZADA: 'HE',
  OTRO: 'EQ',
};

// El badge usa estos kinds del componente Badge para colorear el estado.
// DISPONIBLE → ok ya existe en STATUS_KIND de Badge.tsx; el resto se mapea acá
// porque no todos están en el mapa por defecto y queremos colores consistentes.
export const ESTADO_BADGE_KIND: Record<EstadoEquipo, 'ok' | 'warn' | 'danger' | 'info' | 'neutral'> = {
  DISPONIBLE: 'ok',
  RENTADO: 'info',
  MANTENIMIENTO: 'warn',
  USO_INTERNO: 'neutral',
  INACTIVO: 'danger',
};

// Roles que pueden ejecutar cada operación. La regla viene del backend
// (equipos.routes.ts) y se replica acá para ocultar botones en la UI.
export const PERMISOS_EQUIPOS = {
  crear: ['ADMIN', 'GERENTE'] as const,
  editar: ['ADMIN', 'GERENTE'] as const,
  cambiarEstado: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  subirImagen: ['ADMIN', 'GERENTE', 'LOGISTICA'] as const,
  eliminar: ['ADMIN', 'GERENTE'] as const,
  verInactivos: ['ADMIN', 'GERENTE'] as const,
};

export function puedeEjecutar(
  accion: keyof typeof PERMISOS_EQUIPOS,
  rol: string | undefined,
): boolean {
  if (!rol) return false;
  return (PERMISOS_EQUIPOS[accion] as readonly string[]).includes(rol);
}
