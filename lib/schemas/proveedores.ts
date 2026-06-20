import { z } from 'zod';

// Espejo del schema del backend para Proveedor.
const proveedorBaseSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(150, 'Máximo 150 caracteres'),
  nrc: z.string().max(50, 'Máximo 50 caracteres').optional(),
  nit: z.string().max(50, 'Máximo 50 caracteres').optional(),
  contacto: z.string().max(150, 'Máximo 150 caracteres').optional(),
  telefono: z.string().max(30, 'Máximo 30 caracteres').optional(),
  email: z.string().email('Correo inválido').max(150).optional().or(z.literal('')),
  notas: z.string().max(1000, 'Máximo 1000 caracteres').optional(),
});

export const proveedorCrearSchema = proveedorBaseSchema;
export const proveedorEditarSchema = proveedorBaseSchema;
export type ProveedorFormValues = z.infer<typeof proveedorBaseSchema>;
