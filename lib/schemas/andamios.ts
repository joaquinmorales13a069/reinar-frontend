import { z } from 'zod';

// Schema base de pieza. stockActual está solo en el de "crear" (stock inicial);
// el de "editar" lo omite porque el endpoint PUT no lo acepta y los cambios reales
// van por el endpoint de ajuste de stock con motivo auditado.
const piezaBaseSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres'),
  descripcion: z.string().max(500, 'Máximo 500 caracteres').optional(),
  stockMinimo: z.coerce.number().int().min(0, 'No puede ser negativo'),
  tarifaDia:    z.coerce.number().positive('Debe ser mayor a 0'),
  tarifaSemana: z.coerce.number().positive('Debe ser mayor a 0'),
  tarifaMes:    z.coerce.number().positive('Debe ser mayor a 0'),
});

export const piezaCrearSchema = piezaBaseSchema.extend({
  stockActual: z.coerce.number().int().min(0, 'No puede ser negativo'),
});

export const piezaEditarSchema = piezaBaseSchema;

export const ajusteStockSchema = z.object({
  // signo en UI; en mutationFn se traduce a delta firmado para el backend.
  signo: z.enum(['entrada', 'salida']),
  cantidad: z.coerce.number().int().positive('Debe ser un entero mayor a 0'),
  motivo: z.string().min(1, 'Indicá el motivo').max(255, 'Máximo 255 caracteres'),
});

export const cuerpoFormSchema = z
  .object({
    nombre: z.string().min(1, 'El nombre es requerido').max(150, 'Máximo 150 caracteres'),
    descripcion: z.string().max(500, 'Máximo 500 caracteres').optional(),
    componentes: z
      .array(
        z.object({
          piezaTipoId: z.string().min(1, 'Seleccioná una pieza'),
          cantidad: z.coerce.number().int().min(1, 'Mínimo 1'),
        }),
      )
      .min(1, 'Al menos un componente'),
  })
  // El backend rechaza duplicados; lo validamos también en cliente para feedback inmediato.
  .refine(
    (data) => new Set(data.componentes.map((c) => c.piezaTipoId)).size === data.componentes.length,
    { message: 'No puede haber piezas duplicadas', path: ['componentes'] },
  );

export const expandirSchema = z.object({
  cantidad: z.coerce.number().int().min(1, 'Mínimo 1'),
  periodo: z.enum(['DIA', 'SEMANA', 'MES']),
});

export type PiezaCrearInput  = z.infer<typeof piezaCrearSchema>;
export type PiezaEditarInput = z.infer<typeof piezaEditarSchema>;
export type AjusteStockInput = z.infer<typeof ajusteStockSchema>;
export type CuerpoFormInput  = z.infer<typeof cuerpoFormSchema>;
export type ExpandirInput    = z.infer<typeof expandirSchema>;
