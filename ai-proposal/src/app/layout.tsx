import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

/**
 * `display: swap` evita que el texto quede invisible mientras carga la fuente
 * (FOIT), que penaliza directamente el LCP. La variable CSS conecta con el
 * token `--font-sans` de styles/tokens.css.
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'AI Proposal · Presupuestos profesionales con IA en 30 segundos',
    template: '%s · AI Proposal',
  },
  description:
    'Genera presupuestos profesionales completos —materiales, mano de obra, garantía, IVA y PDF listo para enviar— a partir de una sola frase.',
  applicationName: 'AI Proposal',
  authors: [{ name: 'AI Proposal' }],
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    siteName: 'AI Proposal',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0d0d10' },
    { media: '(prefers-color-scheme: light)', color: '#fdfdfd' },
  ],
  width: 'device-width',
  initialScale: 1,
  // Sin `maximumScale`: impedir el zoom es una barrera de accesibilidad real
  // para quien tiene baja visión.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <body>
        <a href="#contenido" className="skip-link">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
