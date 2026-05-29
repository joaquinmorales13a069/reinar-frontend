import { z } from 'zod';

// ── Paso 1: cliente y fechas ───────────────────────────────────────────
// fechaVencimiento usa input type="date" → llega como "YYYY-MM-DD".
// El backend acepta ISO datetime; convertimos en el hook antes de enviar.
export const step1Schema = z.object({
  clienteId: z.string().min(1, 'Selecciona un cliente'),
  proyectoId: z.string().optional().nullable(),
  contactoSolicitanteId: z.string().optional().nullable(),
  fechaVencimiento: z.string().min(1, 'Selecciona fecha de vencimiento'),
});
export type Step1Form = z.infer<typeof step1Schema>;

// ── Paso 3: términos y depósito ────────────────────────────────────────
// El tipo de documento fiscal y el contacto de facturación ya no viven en
// este paso: ahora se eligen al momento de generar la factura. Aquí solo
// quedan los datos comerciales del borrador (IVA, depósito en monto, notas).
export const step3Schema = z
  .object({
    condicionesPago: z.enum(['CONTADO', 'CREDITO', 'OTRO']).optional().nullable(),
    porcentajeIva: z
      .number({ message: 'IVA debe ser numérico' })
      .min(0)
      .max(100)
      .default(13),
    depositoModo: z.enum(['NINGUNO', 'MONTO']).default('NINGUNO'),
    depositoMonto: z.number().positive().optional().nullable(),
    notas: z.string().optional().nullable(),
    notasInternas: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.depositoModo === 'MONTO' && !data.depositoMonto) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['depositoMonto'],
        message: 'Ingresa el monto',
      });
    }
  });
export type Step3Form = z.infer<typeof step3Schema>;

// ── Item CUSTOM (único form en el modal con validación propia) ─────────
export const customItemSchema = z.object({
  descripcion: z.string().min(1, 'Descripción requerida'),
  monto: z
    .number({ message: 'Monto debe ser numérico' })
    .positive('Monto debe ser mayor a 0'),
});
export type CustomItemForm = z.infer<typeof customItemSchema>;
