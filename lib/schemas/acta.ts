// Schemas Zod del frontend. Replican actas.schemas.ts del backend para feedback
// inmediato en el form. El backend siempre revalida; no estamos saltándonos
// validación. Si se introduce un paquete shared en el futuro, este archivo se
// elimina.
import { z } from 'zod';

export const condicionSchema = z.enum(['BUENO', 'REGULAR', 'MALO']);

// Los items se validan manualmente en la página (no en Zod) porque viven
// fuera del estado de RHF (en useState local para soportar checkbox + edición
// inline). Mezclar arrays con refines en zodResolver bloqueaba el submit
// silenciosamente cuando el error caía en items.<n> en lugar de items.message.
// El backend revalida los items con el mismo refine, así que no perdemos
// seguridad por validarlos en cliente con código simple.
export const crearActaFormSchema = z.object({
  facturaId: z.string().min(1, 'Seleccioná una factura'),
  bodegaOrigenId: z.string().min(1, 'Seleccioná bodega de origen'),
  direccionEntrega: z.string().optional(),
  notas: z.string().optional(),
  observacionesSalida: z.string().optional(),
  numeroActaFisico: z.string().optional(),
  horaDespacho: z.string().optional(),
  horaEntrega: z.string().optional(),
  periodoRentaInicio: z.string().optional(),
  periodoRentaFin: z.string().optional(),
}).refine(
  (d) => !d.periodoRentaFin || !d.periodoRentaInicio || d.periodoRentaFin >= d.periodoRentaInicio,
  { message: 'La fecha fin no puede ser anterior al inicio', path: ['periodoRentaFin'] },
);

export type CrearActaForm = z.infer<typeof crearActaFormSchema>;

export const editarActaFormSchema = z.object({
  bodegaOrigenId: z.string().optional(),
  direccionEntrega: z.string().optional(),
  notas: z.string().optional(),
  observacionesSalida: z.string().optional(),
  numeroActaFisico: z.string().optional(),
  horaDespacho: z.string().optional(),
  periodoRentaInicio: z.string().optional(),
  periodoRentaFin: z.string().optional(),
}).refine(
  (d) => Object.values(d).some((v) => v !== undefined && v !== ''),
  { message: 'Debe proporcionar al menos un campo' },
);

export type EditarActaForm = z.infer<typeof editarActaFormSchema>;

export const despachoFormSchema = z.object({
  observacionesSalida: z.string().optional(),
});
export type DespachoForm = z.infer<typeof despachoFormSchema>;

export const entregaFormSchema = z.object({
  contactoReceptorId: z.string().optional(),
  receptorNombre: z.string().optional(),
  receptorDocumento: z.string().optional(),
  horaEntrega: z.string().optional(),
}).refine(
  (d) => !!d.contactoReceptorId || !!(d.receptorNombre && d.receptorNombre.trim()),
  { message: 'Indicá un contacto o un nombre del receptor', path: ['receptorNombre'] },
);
export type EntregaForm = z.infer<typeof entregaFormSchema>;
