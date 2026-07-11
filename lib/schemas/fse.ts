import { z } from 'zod';

// Espejo del header de crearFseSchema del backend (fse.schemas.ts). Los ítems
// se manejan por fuera de RHF (useState en la página), igual que actas/nueva.
const fseHeaderObjectSchema = z.object({
  proveedorId: z.string().min(1, 'Seleccioná un proveedor'),
  condicionPago: z.enum(['CONTADO', 'CREDITO']),
  exonerarReteRenta: z.boolean(),
  motivoExoneracion: z.string().max(500, 'Máximo 500 caracteres').optional(),
  notas: z.string().max(1000, 'Máximo 1000 caracteres').optional(),
});

export const crearFseFormSchema = fseHeaderObjectSchema.superRefine((d, ctx) => {
  if (d.exonerarReteRenta && (!d.motivoExoneracion || d.motivoExoneracion.trim().length < 5)) {
    ctx.addIssue({
      code: 'custom',
      path: ['motivoExoneracion'],
      message: 'El motivo de exoneración es obligatorio (mínimo 5 caracteres)',
    });
  }
});

export type CrearFseFormValues = z.infer<typeof fseHeaderObjectSchema>;
