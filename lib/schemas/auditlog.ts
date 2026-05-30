// Schema de validación para filtros de auditlog. El rango fecha se valida acá
// (desde <= hasta) en lugar de en el componente porque RHF + zodResolver simplifica
// el feedback inline.
import { z } from 'zod';

export const filtrosAuditLogSchema = z.object({
  entidad: z.string().optional(),
  accion: z.string().optional(),
  desde: z.string().optional(),
  hasta: z.string().optional(),
}).refine(
  // Si ambos están presentes, desde no puede ser posterior a hasta.
  (d) => !d.desde || !d.hasta || d.desde <= d.hasta,
  { message: 'El rango es inválido (desde > hasta)', path: ['hasta'] },
);

export type FiltrosAuditLogForm = z.infer<typeof filtrosAuditLogSchema>;
