import { z } from 'zod';

// Espejo de server/src/modules/bodegas/bodegas.schemas.ts.
// ciudad es requerido en el backend; en el frontend lo derivamos del distrito
// seleccionado dentro del UbicacionInput — el form no lo expone directamente.
export const bodegaCrearSchema = z.object({
  nombre:      z.string().min(1, 'El nombre es requerido').max(150, 'Máximo 150 caracteres'),
  descripcion: z.string().max(500, 'Máximo 500 caracteres').optional(),
  // Texto compuesto por UbicacionInput. Validamos que se haya completado.
  direccion:   z.string().min(1, 'La dirección es requerida'),
  // Derivado de distrito.label en el onSubmit del form.
  ciudad:      z.string().min(1, 'La ciudad es requerida'),
});

export const bodegaEditarSchema = bodegaCrearSchema;

export const zonaCrearSchema = z.object({
  nombre:      z.string().min(1, 'El nombre es requerido').max(150, 'Máximo 150 caracteres'),
  descripcion: z.string().max(500, 'Máximo 500 caracteres').optional(),
});

export const zonaEditarSchema = zonaCrearSchema;

export type BodegaCrearInput = z.infer<typeof bodegaCrearSchema>;
export type BodegaEditarInput = z.infer<typeof bodegaEditarSchema>;
export type ZonaCrearInput   = z.infer<typeof zonaCrearSchema>;
export type ZonaEditarInput  = z.infer<typeof zonaEditarSchema>;
