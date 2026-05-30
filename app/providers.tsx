'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'sonner';

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

// El store aplica el tema en su propio init (cliente solo), por lo que este componente
// ya no necesita llamar a hydrate(). Se conserva como placeholder por si en el futuro
// se requiere algún efecto de DOM al montar providers.
function ThemeHydrator() {
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeHydrator />
      {children}
      {/* theme="system" para que los toasts respeten data-theme del HTML */}
      <Toaster position="top-right" richColors theme="system" />
      {/* ReactQueryDevtools se elimina automáticamente del bundle de producción */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
