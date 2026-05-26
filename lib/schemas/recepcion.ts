import { z } from 'zod';

// Los items se validan manualmente en la página (no en Zod) — mismo motivo que
// en crearActaFormSchema: los items viven fuera del estado RHF (en useState
// local para soportar checkbox + edición inline por ítem), y mezclarlos con
// un refine en zodResolver bloqueaba el submit silenciosamente cuando el
// error caía en items.<n> en lugar de items.message. El backend revalida
// con el mismo refine, así que no perdemos seguridad.
export const crearRecepcionFormSchema = z.object({
  facturaId: z.string().min(1, 'Seleccioná una factura'),
  numeroActaFisico: z.string().optional(),
  horaRecepcion: z.string().optional(),
  observaciones: z.string().optional(),
});

export type CrearRecepcionForm = z.infer<typeof crearRecepcionFormSchema>;
