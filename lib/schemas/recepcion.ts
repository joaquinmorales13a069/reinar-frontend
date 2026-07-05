import { z } from 'zod';

// Los items se validan manualmente en la página (no en Zod) — mismo motivo que
// en crearActaFormSchema: los items viven fuera del estado RHF (en useState
// local para soportar checkbox + edición inline por ítem), y mezclarlos con
// un refine en zodResolver bloqueaba el submit silenciosamente cuando el
// error caía en items.<n> en lugar de items.message. El backend revalida
// con el mismo refine, así que no perdemos seguridad.
//
// facturaId/cotizacionId son XOR — igual que crearActaFormSchema — porque la
// devolución puede anclar en una factura (flujo clásico) o directo en la
// cotización origen (acta cotización-first sin factura todavía).
export const crearRecepcionFormSchema = z
  .object({
    facturaId: z.string().optional(),
    cotizacionId: z.string().optional(),
    numeroActaFisico: z.string().optional(),
    horaRecepcion: z.string().optional(),
    observaciones: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    const hasFactura = !!d.facturaId;
    const hasCotizacion = !!d.cotizacionId;
    if (hasFactura === hasCotizacion) {
      const message = hasFactura
        ? 'La recepción debe originarse en una factura o una cotización, no ambas'
        : 'Seleccioná una factura o una cotización de origen';
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ['facturaId'] });
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ['cotizacionId'] });
    }
  });

export type CrearRecepcionForm = z.infer<typeof crearRecepcionFormSchema>;
