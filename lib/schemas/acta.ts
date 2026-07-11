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
// Crear acta no captura datos de inspección ni folio físico — esos viven
// en /actas/[id]/inspeccion y /actas/[id]/despacho respectivamente.
// Flujo cotización-first (Task 8): el acta se crea desde una factura O desde
// una cotización aprobada (sin factura todavía) — nunca ambas ni ninguna. El
// refine exige exactamente una de las dos, en vez de forzar facturaId.
export const crearActaFormSchema = z.object({
  facturaId: z.string().optional(),
  cotizacionId: z.string().optional(),
  bodegaOrigenId: z.string().min(1, 'Seleccioná bodega de origen'),
  direccionEntrega: z.string().optional(),
  // Referencias extra de entrega — se anexan a la porción de calle del string
  // direccionEntrega al enviar; no viaja como campo propio al backend.
  direccionDetalleExtra: z.string().optional(),
  notas: z.string().optional(),
  periodoRentaInicio: z.string().optional(),
  periodoRentaFin: z.string().optional(),
}).superRefine((d, ctx) => {
  // XOR: exactamente un origen. addIssue en ambos paths para que el campo
  // visible en cualquiera de los dos modos (factura o cotización) muestre el
  // error inline — el refine con un solo `path` solo lo mostraría en uno.
  const hasFactura = !!d.facturaId;
  const hasCotizacion = !!d.cotizacionId;
  if (hasFactura === hasCotizacion) {
    const message = hasFactura
      ? 'El acta debe originarse en una factura o una cotización, no ambas'
      : 'Seleccioná una factura o una cotización de origen';
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ['facturaId'] });
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ['cotizacionId'] });
  }
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
  // Folio del talonario Reinar — se asigna al momento del despacho, no antes.
  numeroActaFisico: z.string().trim().min(1, 'El folio físico es obligatorio'),
  observacionesSalida: z.string().optional(),
});
export type DespachoForm = z.infer<typeof despachoFormSchema>;

export const entregaFormSchema = z.object({
  contactoReceptorId: z.string().optional(),
  receptorNombre: z.string().optional(),
  receptorDocumento: z.string().optional(),
  receptorEmail: z.string().email('Email inválido').optional().or(z.literal('')),
  horaEntrega: z.string().optional(),
  enviarCorreo: z.boolean().optional(),
}).refine(
  (d) => !!d.contactoReceptorId || !!(d.receptorNombre && d.receptorNombre.trim()),
  { message: 'Indicá un contacto o un nombre del receptor', path: ['receptorNombre'] },
);
export type EntregaForm = z.infer<typeof entregaFormSchema>;
