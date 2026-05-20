import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  // withCredentials es necesario para que el navegador incluya la cookie HTTP-only
  // del refresh token en peticiones cross-origin; sin esto la renovación silenciosa falla.
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  // useAuthStore.getState() lee Zustand fuera de React — válido en interceptores
  // porque solo necesitamos leer el valor una vez, sin suscribirnos a cambios.
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    // _retry evita un bucle infinito: si la propia petición de renovación devuelve 401
    // (cookie de refresh también expirada), salimos en vez de reintentar eternamente.
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true;
      try {
        // Usamos axios base (no la instancia `api`) para que este interceptor
        // no se dispare recursivamente durante la llamada de renovación.
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/renovar-token`,
          {},
          { withCredentials: true },
        );
        useAuthStore.getState().setAuth(data.data.accessToken, useAuthStore.getState().user!);
        err.config.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(err.config);
      } catch {
        // La renovación falló — la sesión es irrecuperable; limpiamos el estado
        // para que la UI redirija al login automáticamente.
        useAuthStore.getState().clearAuth();
      }
    }
    return Promise.reject(err);
  },
);

export default api;
