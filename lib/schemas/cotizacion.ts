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
// Replica el refinamiento del backend: depositoPorcentaje y depositoMonto
// son mutuamente excluyentes. El form usa un radio para alternar y limpia
// el campo no activo antes de enviar.
export const step3Schema = z
  .object({
    tipoDocumentoFiscal: z.enum(['CF', 'CCF', 'SUJETO_EXCLUIDO'], {
      message: 'Selecciona el tipo de documento fiscal',
    }),
    condicionesPago: z.enum(['CONTADO', 'CREDITO', 'OTRO']).optional().nullable(),
    contactoFacturacionId: z.string().optional().nullable(),
    porcentajeIva: z
      .number({ message: 'IVA debe ser numérico' })
      .min(0)
      .max(100)
      .default(13),
    depositoModo: z.enum(['NINGUNO', 'PORCENTAJE', 'MONTO']).default('NINGUNO'),
    depositoPorcentaje: z.number().min(0.01).max(100).optional().nullable(),
    depositoMonto: z.number().positive().optional().nullable(),
    notas: z.string().optional().nullable(),
    notasInternas: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    // contactoFacturacionId es metadata opcional para todos los tipos. El DTE
    // se emite con los datos de la empresa (cliente.razonSocial/nit/ncr), no
    // del contacto. Las validaciones fiscales reales (NCR para CCF, etc.) se
    // hacen al momento de emitir el DTE en facturas.service.ts.
    if (data.depositoModo === 'PORCENTAJE' && !data.depositoPorcentaje) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['depositoPorcentaje'],
        message: 'Ingresa el porcentaje',
      });
    }
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
