// Schemas Zod del frontend. Replican usuarios.schemas.ts y configuracion.schemas.ts
// del backend para feedback inmediato en los forms. El backend siempre revalida;
// no estamos saltándonos validación. Si se introduce un paquete shared, este
// archivo se elimina.
import { z } from 'zod';

// ─── Usuarios ─────────────────────────────────────────────────────────

const rolEnum = z.enum(['ADMIN', 'GERENTE', 'OPERADOR', 'LOGISTICA', 'VISUALIZADOR']);

// Base común para crear y editar: nombre, apellido, email, rol siempre obligatorios.
const usuarioBase = z.object({
  nombre: z.string().trim().min(1, 'El nombre es requerido'),
  apellido: z.string().trim().min(1, 'El apellido es requerido'),
  email: z.string().email('Email inválido'),
  rol: rolEnum,
});

// Crear: si enviarSetupLink === true, contrasena/confirmar se ignoran (el backend
// genera un token y manda el link por correo). Si no, contrasena obligatoria +
// confirmar coincidente. El refine valida ambos casos.
export const usuarioCrearSchema = usuarioBase.extend({
  enviarSetupLink: z.boolean().default(false),
  contrasena: z.string().optional().or(z.literal('')),
  confirmar: z.string().optional().or(z.literal('')),
}).superRefine((d, ctx) => {
  if (d.enviarSetupLink) return;  // contrasena no requerida si se envia link
  if (!d.contrasena || d.contrasena.length < 8) {
    ctx.addIssue({ code: 'custom', path: ['contrasena'], message: 'La contraseña debe tener al menos 8 caracteres' });
  }
  if (d.contrasena !== d.confirmar) {
    ctx.addIssue({ code: 'custom', path: ['confirmar'], message: 'Las contraseñas no coinciden' });
  }
});

export type UsuarioCrearForm = z.infer<typeof usuarioCrearSchema>;

// Editar: contrasena y confirmar son opcionales. Si una se llena, ambas deben coincidir.
// El backend acepta el PUT sin contrasena (preserva el hash) o con contrasena nueva.
export const usuarioEditarSchema = usuarioBase.extend({
  contrasena: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').optional().or(z.literal('')),
  confirmar: z.string().optional().or(z.literal('')),
}).refine(
  // Si se está cambiando la contraseña, ambos campos deben coincidir.
  (d) => !d.contrasena || d.contrasena === d.confirmar,
  { message: 'Las contraseñas no coinciden', path: ['confirmar'] },
);

export type UsuarioEditarForm = z.infer<typeof usuarioEditarSchema>;

// ─── Configuracion empresa ───────────────────────────────────────────

// Regex idéntico al del backend: 2-5 caracteres alfanuméricos en mayúsculas.
const prefijoRegex = /^[A-Z0-9]{2,5}$/;

// Helper para campos opcionales que aceptan string vacío en la UI
// pero deben enviarse como undefined al backend (no como '').
const optionalTrimmedString = (max: number) =>
  z.string().trim().max(max, `Máximo ${max} caracteres`).optional().or(z.literal(''));

export const configuracionEmpresaSchema = z.object({
  nombreEmpresa: z.string().trim().min(1, 'El nombre de la empresa es requerido').max(100, 'Máximo 100 caracteres'),
  nit: optionalTrimmedString(20),
  ncr: optionalTrimmedString(20),
  direccion: optionalTrimmedString(200),
  telefono: optionalTrimmedString(30),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefonoCotizaciones: optionalTrimmedString(30),
  emailCotizaciones: z.string().email('Email inválido').optional().or(z.literal('')),
  logoUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  sitioWeb: z.string().url('URL inválida').optional().or(z.literal('')),
  prefijoCotizacion: z.string().regex(prefijoRegex, 'Prefijo: 2-5 caracteres alfanuméricos en mayúsculas').optional().or(z.literal('')),
  prefijoFactura: z.string().regex(prefijoRegex, 'Prefijo: 2-5 caracteres alfanuméricos en mayúsculas').optional().or(z.literal('')),
  prefijoActa: z.string().regex(prefijoRegex, 'Prefijo: 2-5 caracteres alfanuméricos en mayúsculas').optional().or(z.literal('')),
  emailRemitente: z.string().email('Email inválido').optional().or(z.literal('')),
  nombreRemitente: optionalTrimmedString(100),
  emailCopiaInterna: z.string().email('Email inválido').optional().or(z.literal('')),
  porcentajeIvaDefault: z.coerce.number().min(0, 'Mínimo 0').max(100, 'Máximo 100').optional(),
});

export type ConfiguracionEmpresaForm = z.infer<typeof configuracionEmpresaSchema>;

// ─── Configuracion reportes ──────────────────────────────────────────

// Email individual para validar elementos del array; reutilizado por <EmailsInput>.
export const emailItemSchema = z.string().email('Email inválido');

export const configuracionReportesSchema = z.object({
  reporteSemanalActivo: z.boolean(),
  reporteSemanalEmails: z.array(emailItemSchema).default([]),
  reporteMensualActivo: z.boolean(),
  reporteMensualDia: z.coerce.number().int().min(1, 'Mínimo 1').max(28, 'Máximo 28'),
  reporteMensualEmails: z.array(emailItemSchema).default([]),
  formatoProgramado: z.enum(['pdf', 'excel', 'ambos']),
});

export type ConfiguracionReportesForm = z.infer<typeof configuracionReportesSchema>;
