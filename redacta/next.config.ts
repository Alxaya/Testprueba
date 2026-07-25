import type { NextConfig } from 'next';

/**
 * Cabeceras de seguridad aplicadas a todas las rutas.
 * Se mantienen aqui (y no en un middleware) para que Next las sirva
 * tambien en assets estaticos y respuestas cacheadas en CDN.
 */
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // El proyecto vive en un subdirectorio de un repositorio con varios
  // proyectos. Sin esto, Next busca la raiz hacia arriba y puede trazar mal
  // los ficheros del despliegue.
  outputFileTracingRoot: import.meta.dirname,
  // Necesario para que `next build` no falle por errores de tipos en dependencias
  // externas; nuestro propio codigo se valida con `npm run typecheck`.
  typescript: { ignoreBuildErrors: false },
  experimental: {
    // El SDK de Anthropic y Prisma no deben empaquetarse en el bundle del servidor.
    serverActions: { bodySizeLimit: '2mb' },
  },
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
