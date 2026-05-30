// Schemas Zod del frontend. Replican los validators del backend auth.routes.ts
// para feedback inmediato. El backend siempre revalida; no estamos saltándonos
// validación. Si se introduce un paquete shared, este archivo se elimina.
import { z } from 'zod';

// ─── Editar perfil propio (nombre/apellido) ────────────────────────

export const actualizarPerfilSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres'),
  apellido: z.string().trim().min(1, 'El apellido es requerido').max(100, 'Máximo 100 caracteres'),
});

export type ActualizarPerfilForm = z.infer<typeof actualizarPerfilSchema>;

// ─── Cambiar contraseña ────────────────────────────────────────────

// `confirmar` vive solo en UI — el backend nunca lo ve. La refine garantiza
// que coincida con `passwordNuevo` antes de mandar al server.
export const cambiarContrasenaSchema = z.object({
  passwordActual: z.string().min(1, 'Ingresá tu contraseña actual'),
  passwordNuevo: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  confirmar: z.string().min(1, 'Confirmá la nueva contraseña'),
}).refine((d) => d.passwordNuevo === d.confirmar, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmar'],
});

export type CambiarContrasenaForm = z.infer<typeof cambiarContrasenaSchema>;

// ─── Código TOTP (6 dígitos exactos) ───────────────────────────────

export const totpSchema = z.object({
  totpCode: z.string().regex(/^\d{6}$/, 'Ingresá los 6 dígitos del código'),
});

export type TotpForm = z.infer<typeof totpSchema>;
