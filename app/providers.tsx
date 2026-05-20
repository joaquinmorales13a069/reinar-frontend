'use client';

import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useUiStore } from '@/stores/ui.store';

// Singleton a nivel de módulo para que la caché de queries sobreviva los re-renders.
// Crearlo dentro del componente resetearía la caché en cada render.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 30 s de staleTime evita refetchear los mismos datos en cada navegación,
      // que es el comportamiento agresivo por defecto de TanStack Query y saturaria el backend.
      staleTime: 30_000,
      retry: 1,
    },
  },
});

// Componente separado porque el root layout es un Server Component y useEffect
// es solo del cliente; necesitamos un componente dedicado solo para este efecto de DOM.
function TweaksHydrator() {
  const hydrate = useUiStore((s) => s.hydrate);
  useEffect(() => { hydrate(); }, [hydrate]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* TweaksHydrator carga una sola vez al montar para leer theme/density persistidos en localStorage */}
      <TweaksHydrator />
      {children}
      {/* ReactQueryDevtools se elimina automáticamente del bundle de producción */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
