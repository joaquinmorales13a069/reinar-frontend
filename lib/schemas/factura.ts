import { z } from 'zod';

// ── Ajustar estado manual (ADMIN/GERENTE) ──────────────────────────────
// PAGADA se omite intencionalmente: el backend la rechaza porque ese estado
// se asigna automaticamente al registrar pagos que cubran el total.
export const ajustarEstadoSchema = z.object({
  estado: z.enum(['PENDIENTE', 'PARCIAL', 'VENCIDA', 'ANULADA'], {
    message: 'Selecciona el nuevo estado',
  }),
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
    .regex(/^\d+(\.\d{1,2})?$/, 'Usa el formato 0.00 (máximo 2 decimales)')
    .refine((v) => Number(v) > 0, 'El monto debe ser mayor a cero'),
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (formato YYYY-MM-DD)'),
  metodoPago: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'TARJETA', 'OTRO'], {
    message: 'Selecciona el método de pago',
  }),
  referencia: z.string().max(50, 'Máximo 50 caracteres').optional(),
  notas: z.string().max(200, 'Máximo 200 caracteres').optional(),
});
export type RegistrarPagoForm = z.infer<typeof registrarPagoSchema>;
