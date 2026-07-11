import Decimal from 'decimal.js';
import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { es } from 'date-fns/locale';

// Reinar opera en El Salvador. Todas las fechas comerciales (vencimiento,
// emision, etc.) deben mostrarse e interpretarse en la timezone de El Salvador
// sin importar donde este el usuario fisicamente. Sin esta normalizacion, un
// vendedor en Australia veria "31 de mayo" para una cotizacion que en SV vence
// el "1 de junio" — y al re-guardar la corromperia.
const TZ_SV = 'America/El_Salvador';

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
  // toZonedTime convierte el instante ISO al tiempo equivalente en TZ_SV, luego
  // formateamos sin convertir TZ otra vez. Asi el usuario en cualquier ubicacion
  // ve la fecha "como la veria un usuario en El Salvador".
  return format(toZonedTime(parseISO(date), TZ_SV), 'd MMM. yyyy', { locale: es });
}

export function formatDateTime(date: string): string {
  return format(toZonedTime(parseISO(date), TZ_SV), "d MMM. yyyy, HH:mm", { locale: es });
}

// ─── Helpers de fechas comerciales (YYYY-MM-DD <-> ISO en TZ El Salvador) ───
// Las fechas como "vencimiento", "fecha de servicio", etc. son fechas
// CALENDARIO en El Salvador, no instantes globales. Para mantener
// consistencia entre usuarios en distintas timezones, las convertimos
// siempre relativas a TZ_SV.

// Toma el ISO que devuelve el backend y devuelve YYYY-MM-DD tal como se
// veria en El Salvador. Sirve para pre-llenar inputs type="date".
export function isoToFechaSV(iso: string): string {
  // 'en-CA' garantiza formato YYYY-MM-DD; timeZone fuerza la interpretacion en SV.
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ_SV });
}

// Toma un YYYY-MM-DD (lo que el usuario eligio en el input date) y lo
// convierte al instante de medianoche en TZ El Salvador, en ISO UTC para
// que el backend lo persista.
export function fechaSVToIso(fecha: string): string {
  // "YYYY-MM-DDT00:00:00-06:00" = medianoche en El Salvador (sin DST).
  // El Salvador NO observa horario de verano, por eso UTC-6 es siempre fijo.
  return new Date(`${fecha}T00:00:00-06:00`).toISOString();
}

// Devuelve la fecha de hoy + N dias en TZ El Salvador, formato YYYY-MM-DD.
export function fechaSVHoyMasDias(dias: number): string {
  const target = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
  return target.toLocaleDateString('en-CA', { timeZone: TZ_SV });
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

// Resuelve el nombre del cliente para mostrar — EMPRESA usa razonSocial,
// PARTICULAR arma nombre + apellido. Devuelve '—' si ningún campo está poblado.
// Fuente única para no divergir entre selectores, tablas y tarjetas de detalle.
// Cuando el shape no trae `tipo` (algunos listados solo devuelven los 3 campos
// planos) usamos la presencia de razonSocial como proxy, ya que en la práctica
// solo los clientes EMPRESA lo tienen poblado.
export function nombreCliente(cliente: {
  tipo?: 'EMPRESA' | 'PARTICULAR' | null;
  razonSocial?: string | null;
  nombre?: string | null;
  apellido?: string | null;
}): string {
  const esEmpresa = cliente.tipo != null ? cliente.tipo === 'EMPRESA' : !!cliente.razonSocial;
  if (esEmpresa) return cliente.razonSocial ?? '—';
  return [cliente.nombre, cliente.apellido].filter(Boolean).join(' ') || '—';
}

// Número que ve el cliente: sin el sufijo interno de variante (-B..-Z) que
// distingue cotizaciones hermanas del mismo consecutivo. Espejo del helper
// homónimo del backend (server/src/lib/variantes.ts).
export function numeroComercial(numero: string): string {
  return numero.replace(/-[B-Z]$/, '');
}
