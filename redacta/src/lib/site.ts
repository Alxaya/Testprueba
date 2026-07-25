/**
 * Metadatos de marca reutilizados por SEO, emails y la interfaz.
 *
 * Este modulo lo importan tambien componentes de cliente (la cabecera y la
 * navegacion del panel), asi que NO puede depender de `lib/env`: alli se
 * validan variables que en el navegador no existen. Se lee directamente la
 * variable NEXT_PUBLIC_*, que Next incrusta en el bundle en tiempo de compilado.
 */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const site = {
  name: 'Redacta',
  legalName: 'Redacta',
  tagline: 'Contenido que vende, generado con IA',
  description:
    'Redacta genera fichas de producto, articulos SEO, guiones para redes y campanas de email con el tono de tu marca. Pensado para tiendas online y pymes espanolas.',
  url: APP_URL,
  locale: 'es_ES',
  email: 'hola@redacta.example',
  twitter: '@redacta',
} as const;

export const navigation = {
  marketing: [
    { href: '/#como-funciona', label: 'Como funciona' },
    { href: '/#formatos', label: 'Formatos' },
    { href: '/precios', label: 'Precios' },
    { href: '/blog', label: 'Blog' },
  ],
  legal: [
    { href: '/legal/aviso-legal', label: 'Aviso legal' },
    { href: '/legal/privacidad', label: 'Privacidad' },
    { href: '/legal/cookies', label: 'Cookies' },
    { href: '/legal/terminos', label: 'Terminos del servicio' },
  ],
  app: [
    { href: '/app', label: 'Resumen', icon: '📊' },
    { href: '/app/generar', label: 'Generar', icon: '✨' },
    { href: '/app/biblioteca', label: 'Biblioteca', icon: '📚' },
    { href: '/app/proyectos', label: 'Proyectos', icon: '🗂️' },
    { href: '/app/marca', label: 'Marca', icon: '🎨' },
    { href: '/app/facturacion', label: 'Facturacion', icon: '💳' },
    { href: '/app/ajustes', label: 'Ajustes', icon: '⚙️' },
  ],
  admin: [
    { href: '/admin', label: 'Negocio', icon: '📈' },
    { href: '/admin/clientes', label: 'Clientes', icon: '🏢' },
    { href: '/admin/generaciones', label: 'Generaciones', icon: '🧾' },
    { href: '/admin/analitica', label: 'Analitica', icon: '🔬' },
    { href: '/admin/sistema', label: 'Sistema', icon: '🩺' },
  ],
} as const;

/** Datos estructurados de la organizacion, inyectados en el layout raiz. */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: site.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: site.description,
    url: site.url,
    inLanguage: 'es-ES',
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'EUR',
      lowPrice: '0',
      highPrice: '99',
      offerCount: '4',
    },
  };
}
