import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  // withCredentials es necesario para que el navegador incluya la cookie HTTP-only
  // del refresh token en peticiones cross-origin; sin esto la renovación silenciosa falla.
  withCredentials: true,
  // 30s de timeout: si una request del backend queda colgada (deadlock, hot
  // reload mal recuperado, etc.) preferimos que axios la cancele y el hook
  // muestre un toast de error en vez de dejar al usuario mirando un spinner
  // infinito sin saber que paso.
  timeout: 30_000,
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
    // Los endpoints de auth devuelven 401 por credenciales incorrectas, no por sesión expirada;
    // intentar renovar el token ahí no tiene sentido y generaría un toast de error falso.
    const isAuthEndpoint = err.config?.url?.includes('/auth/');
    // _retry evita un bucle infinito: si la propia petición de renovación devuelve 401
    // (cookie de refresh también expirada), salimos en vez de reintentar eternamente.
    if (err.response?.status === 401 && !err.config._retry && !isAuthEndpoint) {
      err.config._retry = true;
      try {
        // Usamos axios base (no la instancia `api`) para que este interceptor
        // no se dispare recursivamente durante la llamada de renovación.
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/renovar-token`,
          {},
          { withCredentials: true },
        );
        const renewedUser = data.data.user ?? useAuthStore.getState().user;
        useAuthStore.getState().setAuth(data.data.accessToken, renewedUser!);
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
