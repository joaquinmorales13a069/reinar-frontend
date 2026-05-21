import type { Metadata } from 'next';
import { Space_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

// next/font auto-hospeda las fuentes en build time: sin petición a Google en runtime,
// sin problemas de CORS, y el navegador las precarga — elimina el layout shift (FOUT).
// Los nombres de variable deben coincidir con las custom properties usadas en globals.css.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  // Solo los pesos que el design system realmente usa — mantiene el payload de fuentes pequeño.
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Reinar — Sistema Interno de Operaciones',
  description: 'ERP/CRM interno de Reinar S.A. de C.V.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // lang="es" porque toda la UI está en español — necesario para lectores de pantalla
    // y para el corrector ortográfico del navegador.
    // Las variables de fuente van en <html> para que cascadeen a todos los elementos, incluyendo portales.
    <html lang="es" className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
