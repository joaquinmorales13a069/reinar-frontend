import { redirect } from 'next/navigation';

// La ruta raíz no tiene contenido propio; el middleware ya protege /dashboard,
// pero este redirect garantiza que nunca se muestre la página por defecto de Next.js.
export default function RootPage() {
  redirect('/dashboard');
}
