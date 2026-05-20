import Decimal from 'decimal.js';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export function formatCurrency(val: string | number): string {
  // El backend serializa todos los montos como strings Decimal para preservar precisión.
  // Convertimos por Decimal (no parseFloat) para evitar errores de redondeo de punto
  // flotante en cantidades financieras que los floats de JS no representan exactamente.
  const num = new Decimal(val).toNumber();
  return new Intl.NumberFormat('es-SV', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(num);
}

export function formatDate(date: string): string {
  // parseISO en vez de new Date() porque las fechas de la API son strings ISO-8601;
  // parseISO es determinista, mientras que new Date() depende de la implementación del entorno.
  return format(parseISO(date), 'd MMM. yyyy', { locale: es });
}

export function formatDateTime(date: string): string {
  return format(parseISO(date), "d MMM. yyyy, HH:mm", { locale: es });
}

export function getInitials(nombre: string): string {
  // Máximo dos iniciales — los componentes de avatar solo tienen espacio para dos caracteres.
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}
