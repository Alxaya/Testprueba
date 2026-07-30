import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "DealScan AI — ¿Merece la pena ese anuncio de segunda mano?",
    template: "%s · DealScan AI",
  },
  description:
    "Pega el enlace, el texto o una captura de un anuncio de segunda mano y recibe un informe con el precio real de mercado, señales de estafa, riesgos y cuánto ofrecer al vendedor.",
  applicationName: "DealScan AI",
  keywords: [
    "segunda mano",
    "precio de mercado",
    "iPhone segunda mano",
    "detectar estafas",
    "negociar precio",
    "tasación móvil",
  ],
  authors: [{ name: "DealScan AI" }],
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "DealScan AI",
    title: "DealScan AI — ¿Merece la pena ese anuncio de segunda mano?",
    description:
      "Informe profesional en segundos: precio real de mercado, ahorro estimado, señales de estafa y cuánto ofrecer.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1d24" },
  ],
};

/**
 * Resuelve el tema antes de la primera pintada para que no haya destello de
 * color al cargar. Se ejecuta de forma síncrona en el <head>.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('dealscan-theme');
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.setAttribute('data-theme', stored);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:shadow-lg"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
