// Unión discriminada sobre `success` para que TypeScript estreche el tipo automáticamente:
// tras `if (res.success)`, `data` está garantizado; en el else, `error` está garantizado.
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown[] } };

// Tipo separado para listas paginadas porque envuelven data en un array e incluyen
// meta — mezclarlos en ApiResponse<T[]> perdería el campo meta.
export type PaginatedResponse<T> = {
  success: true;
  data: T[];
  meta: { page: number; limit: number; total: number };
};

// Forma del usuario devuelta por login y renovación de token.
// `rol` controla todos los chequeos de permisos en la UI
// (ocultar/deshabilitar controles de escritura para VISUALIZADOR, etc.).
export type User = {
  id: string;
  nombre: string;
  email: string;
  rol: 'ADMIN' | 'GERENTE' | 'OPERADOR' | 'LOGISTICA' | 'VISUALIZADOR';
};
