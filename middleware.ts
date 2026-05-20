import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // El access token vive solo en memoria Zustand y es invisible para el middleware.
  // Usamos la cookie HTTP-only del refresh token como señal de sesión —
  // si existe, el usuario tiene (o tuvo recientemente) una sesión válida.
  // Se verifican varios nombres posibles porque el nombre exacto del backend no está confirmado aún.
  const hasSession =
    request.cookies.has('refreshToken') ||
    request.cookies.has('refresh_token') ||
    request.cookies.has('rt');

  if (!isPublic && !hasSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    // Preservamos el destino original para que el login pueda redirigir de vuelta tras autenticarse.
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // La raíz `/` con sesión activa debe ir al dashboard, no a una página en blanco.
  if (pathname === '/' && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Evita que un usuario autenticado vea el login al presionar el botón atrás del navegador.
  if (isPublic && hasSession && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Excluimos los archivos estáticos de Next.js para que el middleware no se ejecute
  // en cada imagen, fuente o CSS — solo necesita proteger las rutas de navegación HTML.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
