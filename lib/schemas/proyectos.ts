import { z } from 'zod';

// Espejo de server/src/modules/proyectos/proyectos.schemas.ts.
export const proyectoCrearSchema = z.object({
  nombre:      z.string().min(1, 'El nombre es requerido').max(150, 'Máximo 150 caracteres'),
  descripcion: z.string().max(1000, 'Máximo 1000 caracteres').optional(),
  // ubicacion es un string compuesto por UbicacionInput ("detalle, distrito, departamento").
  ubicacion:   z.string().min(1, 'La ubicación es requerida'),
});

export const proyectoEditarSchema = proyectoCrearSchema;

export type ProyectoCrearInput  = z.infer<typeof proyectoCrearSchema>;
export type ProyectoEditarInput = z.infer<typeof proyectoEditarSchema>;
