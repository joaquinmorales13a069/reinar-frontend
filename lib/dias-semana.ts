// Catálogo de días de la semana para diasRecepcionQuedan (espeja el enum
// implícito del backend en clientes.schemas.ts).
export const DIAS_SEMANA = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'] as const;
export type DiaSemana = (typeof DIAS_SEMANA)[number];

export const LABEL_DIA: Record<DiaSemana, string> = {
  LUNES: 'lunes', MARTES: 'martes', MIERCOLES: 'miércoles', JUEVES: 'jueves',
  VIERNES: 'viernes', SABADO: 'sábado', DOMINGO: 'domingo',
};

export const LABEL_DIA_CORTO: Record<DiaSemana, string> = {
  LUNES: 'Lun', MARTES: 'Mar', MIERCOLES: 'Mié', JUEVES: 'Jue',
  VIERNES: 'Vie', SABADO: 'Sáb', DOMINGO: 'Dom',
};

// Índice = getUTCDay() (0 = domingo). Las fechas 'YYYY-MM-DD' se parsean como
// 00:00Z — mapear en UTC evita el corrimiento de día en TZ negativas (SV = UTC-6).
export const DIAS_UTC: DiaSemana[] = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
