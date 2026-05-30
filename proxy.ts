import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // En deploy cross-site (frontend en crmsv.reinarsa.com, backend en *.easypanel.host)
  // la cookie HTTP-only del refresh token vive en el dominio del backend y NO es
  // visible para este proxy que corre en el frontend. Antes chequeabamos
  // request.cookies.has('refreshToken') como senal de sesion y eso causaba un loop:
  // login OK -> cookie seteada en backend -> redirect a /dashboard -> proxy no ve
  // cookie -> redirect a /login -> usuario nunca pasaba del login.
  //
  // La autenticacion se delega a AuthHydrator client-side: al montar el dashboard
  // intenta /auth/renovar-token con la cookie cross-site; si falla, redirige a
  // /login. Hay una micro-ventana donde un usuario anonimo ve el shell del
  // dashboard antes del redirect — aceptable para herramienta interna.
  //
  // Solo conservamos un redirect cosmetico: / -> /dashboard, sin chequear sesion.
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Excluimos los archivos estáticos de Next.js para que el proxy no se ejecute
  // en cada imagen, fuente o CSS — solo necesita interceptar rutas de navegación HTML.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
