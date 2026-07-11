import { z } from 'zod';
import { validarDocumento, MENSAJE_FORMATO_DOCUMENTO, type TipoDocumentoCliente } from '@/lib/format-documentos';

// Espejo del schema del backend para Proveedor (incluye los campos fiscales
// opcionales usados para FSE — ver proveedores.schemas.ts en el backend).
const proveedorObjectSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(150, 'Máximo 150 caracteres'),
  nrc: z.string().max(50, 'Máximo 50 caracteres').optional(),
  nit: z.string().max(50, 'Máximo 50 caracteres').optional(),
  contacto: z.string().max(150, 'Máximo 150 caracteres').optional(),
  telefono: z.string().max(30, 'Máximo 30 caracteres').optional(),
  email: z.string().email('Correo inválido').max(150).optional().or(z.literal('')),
  notas: z.string().max(1000, 'Máximo 1000 caracteres').optional(),

  // ── Datos fiscales (para FSE) — todos opcionales ──
  tipoDocumento: z.enum(['DUI', 'NIT', 'PASAPORTE', 'CARNET_RESIDENTE', 'OTRO']).optional().or(z.literal('')),
  numeroDocumento: z.string().max(25, 'Máximo 25 caracteres').optional(),
  tipoPersona: z.enum(['NATURAL', 'JURIDICA']).optional().or(z.literal('')),
  actividadEconomica: z.string().optional(),
  departamento: z.string().optional(),
  municipio: z.string().optional(),
  distrito: z.string().optional(),
  complemento: z.string().max(500, 'Máximo 500 caracteres').optional(),
  giroPredominante: z.enum(['BIENES', 'SERVICIOS']).optional().or(z.literal('')),
});

// Igual que el backend: tipoDocumento y numeroDocumento van en pareja, y el
// número debe cumplir el formato del tipo elegido.
const proveedorBaseSchema = proveedorObjectSchema.superRefine((d, ctx) => {
  // Casteamos a string para poder comparar con '' sin que TS se queje del union type
  // (mismo patrón que ClienteForm.tsx).
  const tipoDocRaw = d.tipoDocumento as string | undefined;
  const tipoDoc = tipoDocRaw && tipoDocRaw !== '' ? (tipoDocRaw as TipoDocumentoCliente) : undefined;
  const numDoc = d.numeroDocumento?.trim();
  if (tipoDoc && !numDoc) {
    ctx.addIssue({ code: 'custom', path: ['numeroDocumento'], message: 'Ingresá el número del documento.' });
    return;
  }
  if (!tipoDoc && numDoc) {
    ctx.addIssue({ code: 'custom', path: ['tipoDocumento'], message: 'Seleccioná el tipo de documento.' });
    return;
  }
  if (tipoDoc && numDoc && !validarDocumento(tipoDoc, numDoc)) {
    ctx.addIssue({ code: 'custom', path: ['numeroDocumento'], message: MENSAJE_FORMATO_DOCUMENTO[tipoDoc] });
  }
});

export const proveedorCrearSchema = proveedorBaseSchema;
export const proveedorEditarSchema = proveedorBaseSchema;
export type ProveedorFormValues = z.infer<typeof proveedorObjectSchema>;
