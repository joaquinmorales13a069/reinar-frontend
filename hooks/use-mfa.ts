'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ApiResponse,
  ConfigurarMfaResponse,
  TotpDto,
} from '@/types/api';

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

export function useConfigurarMfa() {
  return useMutation({
    mutationFn: () =>
      api.post<ApiResponse<ConfigurarMfaResponse>>('/auth/mfa/configurar').then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
        return r.data.data;
      }),
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'No se pudo configurar 2FA.'));
    },
  });
}

export function useVerificarMfa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TotpDto) =>
      api.post<ApiResponse<unknown>>('/auth/mfa/verificar', data).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
      }),
    onSuccess: () => {
      // Invalida ['perfil'] para refrescar mfaActivo=true en la tarjeta de perfil.
      qc.invalidateQueries({ queryKey: ['perfil'] });
      toast.success('2FA activado.');
    },
    onError: (err) => {
      // 401 "Código TOTP inválido" se mapea inline en el caller (setError + shake) —
      // no toastear para evitar feedback duplicado.
      const apiErr = err as { response?: { data?: { error?: { code?: string; message?: string } } } };
      const code = apiErr?.response?.data?.error?.code;
      const msg = apiErr?.response?.data?.error?.message ?? '';
      if (code === 'UNAUTHORIZED' && msg.toLowerCase().includes('totp')) return;
      toast.error(extractErrorMessage(err, 'No se pudo verificar el código.'));
    },
  });
}

export function useDesactivarMfa() {
  const qc = useQueryClient();
  return useMutation({
    // axios.delete con body requiere config explícito: { data }.
    mutationFn: (data: TotpDto) =>
      api.delete<ApiResponse<unknown>>('/auth/mfa', { data }).then((r) => {
        if (!r.data.success) throw new Error(r.data.error.message);
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['perfil'] });
      toast.success('2FA desactivado.');
    },
    onError: (err) => {
      const apiErr = err as { response?: { data?: { error?: { code?: string; message?: string } } } };
      const code = apiErr?.response?.data?.error?.code;
      const msg = apiErr?.response?.data?.error?.message ?? '';
      if (code === 'UNAUTHORIZED' && msg.toLowerCase().includes('totp')) return;
      toast.error(extractErrorMessage(err, 'No se pudo desactivar 2FA.'));
    },
  });
}
