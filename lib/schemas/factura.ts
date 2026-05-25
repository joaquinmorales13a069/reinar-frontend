import { z } from 'zod';

// ── Emitir DTE ─────────────────────────────────────────────────────────
export const emitirDTESchema = z.object({
  tipoDTE: z.enum(['FC', 'CCF', 'SUJETO_EXCLUIDO']),
});
export type EmitirDTEForm = z.infer<typeof emitirDTESchema>;

// ── Ajustar estado manual (ADMIN/GERENTE) ──────────────────────────────
// PAGADA se omite intencionalmente: el backend la rechaza porque ese estado
// se asigna automaticamente al registrar pagos que cubran el total.
export const ajustarEstadoSchema = z.object({
  estado: z.enum(['PENDIENTE', 'PARCIAL', 'VENCIDA', 'ANULADA']),
  motivo: z.string().min(10, 'El motivo debe tener al menos 10 caracteres'),
});
export type AjustarEstadoForm = z.infer<typeof ajustarEstadoSchema>;

// ── Anular factura entera (compartida con anular DTE) ──────────────────
// El backend pide motivo solo cuando estado === 'ANULADA'; aqui lo
// requerimos siempre porque ambos flujos pasan por este schema.
export const anularFacturaSchema = z.object({
  motivo: z.string().min(10, 'El motivo debe tener al menos 10 caracteres'),
});
export type AnularFacturaForm = z.infer<typeof anularFacturaSchema>;

// ── Registrar pago ─────────────────────────────────────────────────────
// monto se valida como string decimal (no number) para evitar perdida de
// precision en redondeos JS — el backend tambien lo recibe como string.
export const registrarPagoSchema = z.object({
  monto: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Debe ser un decimal con hasta 2 decimales')
    .refine((v) => Number(v) > 0, 'El monto debe ser mayor a cero'),
  fecha: z.string().min(1, 'Selecciona la fecha del pago'),
  metodoPago: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'TARJETA', 'OTRO']),
  referencia: z.string().optional(),
  notas: z.string().max(200, 'Máximo 200 caracteres').optional(),
});
export type RegistrarPagoForm = z.infer<typeof registrarPagoSchema>;
