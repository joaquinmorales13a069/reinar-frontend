import { z } from 'zod';
import { condicionSchema } from './acta';

const itemRecepcionSchema = z.object({
  actaEntregaItemId: z.string().min(1),
  incluido: z.boolean(),
  condicionRetorno: condicionSchema.optional(),
  observacionesRetorno: z.string().optional(),
  horometroRetorno: z.coerce.number().nonnegative().optional(),
  combustibleRetorno: z.string().optional(),
});

export const crearRecepcionFormSchema = z.object({
  facturaId: z.string().min(1, 'Seleccioná una factura'),
  numeroActaFisico: z.string().optional(),
  horaRecepcion: z.string().optional(),
  observaciones: z.string().optional(),
  items: z.array(itemRecepcionSchema),
}).refine(
  (d) => d.items.some((i) => i.incluido),
  { message: 'Marcá al menos un ítem para devolver', path: ['items'] },
).refine(
  // Cada item incluido debe tener una condición — sin esto el server rechaza
  (d) => d.items.filter((i) => i.incluido).every((i) => !!i.condicionRetorno),
  { message: 'Indicá la condición de retorno de cada ítem marcado', path: ['items'] },
);

export type CrearRecepcionForm = z.infer<typeof crearRecepcionFormSchema>;
