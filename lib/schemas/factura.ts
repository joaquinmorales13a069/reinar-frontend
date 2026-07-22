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

// ── Datos de exportación (FEX, fase 2) ──────────────────────────────────
// Espejo de datosExportacionSchema del backend (facturas.schemas.ts): recinto
// y régimen obligatorios contra catálogo; transporte se exige completo (los
// 4 datos del conductor) o vacío. flete/seguro llegan como '' desde el input
// numérico cuando el usuario no los completa — el preprocess los normaliza a
// undefined antes de que z.coerce.number() intente convertirlos (si no,
// Number('') da 0 en vez de "sin dato").
const montoOpcional = z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? undefined : v),
  z.coerce.number().min(0, 'No puede ser negativo').optional(),
);

export const datosExportacionSchema = z
  .object({
    recintoFiscal: z.string().min(1, 'Seleccioná el recinto fiscal'),
    regimenExportacion: z.string().min(1, 'Seleccioná el régimen'),
    incoterms: z.string().optional(),
    flete: montoOpcional,
    seguro: montoOpcional,
    transporteConductor: z.string().optional(),
    transporteDocConductor: z.string().optional(),
    transportePlaca: z.string().optional(),
    transporteModalidad: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    const algunTransporte =
      d.transporteConductor || d.transporteDocConductor || d.transportePlaca || d.transporteModalidad;
    if (algunTransporte) {
      if (!d.transporteConductor)
        ctx.addIssue({ code: 'custom', path: ['transporteConductor'], message: 'Nombre del conductor requerido' });
      if (!d.transporteDocConductor)
        ctx.addIssue({ code: 'custom', path: ['transporteDocConductor'], message: 'Documento del conductor requerido' });
      if (!d.transportePlaca)
        ctx.addIssue({ code: 'custom', path: ['transportePlaca'], message: 'Placas requeridas' });
      if (!d.transporteModalidad)
        ctx.addIssue({ code: 'custom', path: ['transporteModalidad'], message: 'Modalidad requerida' });
    }
  });
export type DatosExportacionForm = z.infer<typeof datosExportacionSchema>;
