import { z } from 'zod';

// Espejo del schema del backend (server/src/modules/servicios/servicios.schemas.ts).
// `codigo` no aparece: lo autogenera el backend y se rechaza en PUT.
const servicioBaseSchema = z.object({
  nombre: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(150, 'Máximo 150 caracteres'),
  descripcion: z.string().max(500, 'Máximo 500 caracteres').optional(),
  tarifaBase: z.coerce.number().positive('La tarifa debe ser mayor a 0'),
  unidad: z
    .string()
    .min(1, 'La unidad es requerida')
    .max(50, 'Máximo 50 caracteres'),
  notas: z.string().max(1000, 'Máximo 1000 caracteres').optional(),
});

export const servicioCrearSchema = servicioBaseSchema;
export const servicioEditarSchema = servicioBaseSchema;

export type ServicioCrearInput = z.infer<typeof servicioCrearSchema>;
export type ServicioEditarInput = z.infer<typeof servicioEditarSchema>;
