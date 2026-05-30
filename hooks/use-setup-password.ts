'use client';

import axios from 'axios';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ApiResponse } from '@/types/api';

// Estos hooks NO usan `api` (instancia con interceptor de auth) porque los
// endpoints son publicos — el access token no es necesario y agregarlo causa
// que el interceptor intente renovar si esta vencido, generando ruido.

const API = process.env.NEXT_PUBLIC_API_URL;

type ValidacionToken = { valido: boolean; razon?: 'invalido' | 'usado' | 'expirado' };

// Verifica el token sin consumirlo — para mostrar el estado al usuario antes
// de pedirle la pass nueva. Si el backend retorna red error, lo tratamos como
// 'invalido' para no exponer detalles internos al usuario anonimo.
export function useValidarTokenSetup(token: string | null) {
  return useQuery({
    queryKey: ['setup-token', token],
    enabled: !!token,
    retry: false,
    queryFn: async (): Promise<ValidacionToken> => {
      if (!token) return { valido: false, razon: 'invalido' };
      try {
        const { data } = await axios.get<ApiResponse<ValidacionToken>>(
          `${API}/usuarios/setup-password/validar/${encodeURIComponent(token)}`,
        );
        if (!data.success) return { valido: false, razon: 'invalido' };
        return data.data;
      } catch {
        return { valido: false, razon: 'invalido' };
      }
    },
  });
}

export function useEstablecerPassword() {
  return useMutation({
    mutationFn: async (payload: { token: string; password: string }) => {
      const { data } = await axios.post<ApiResponse<unknown>>(
        `${API}/usuarios/setup-password/establecer`,
        payload,
      );
      if (!data.success) throw new Error(data.error.message);
      return data;
    },
    onSuccess: () => {
      toast.success('Contraseña establecida. Iniciá sesión con tus credenciales.');
    },
    onError: (err) => {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error?.message ?? 'No se pudo establecer la contraseña.'
        : 'No se pudo establecer la contraseña.';
      toast.error(msg);
    },
  });
}
