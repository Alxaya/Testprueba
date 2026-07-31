import type { NextConfig } from 'next';

/**
 * Cabeceras de seguridad aplicadas a toda la aplicación.
 *
 * La CSP se endurece en F9 (necesita el nonce del middleware para eliminar
 * `unsafe-inline` de los estilos de Next). Lo que ya se puede cerrar, se cierra.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Un fallo de tipos nunca debe poder llegar a producción por la puerta de
  // atrás de un build "que ya compila".
  // (Next 16 ya no ejecuta ESLint durante el build: lo hace `npm run lint`,
  //  que es un paso obligatorio del CI.)
  typescript: { ignoreBuildErrors: false },

  poweredByHeader: false,

  experimental: {
    // Evita cargar el índice completo de estas librerías en cada import.
    optimizePackageImports: ['motion'],
  },

  // Sin `async`: la firma exige una promesa, pero aquí no hay nada que esperar
  // y marcarla async solo esconde esa realidad.
  headers: () => Promise.resolve([{ source: '/:path*', headers: securityHeaders }]),
};

export default nextConfig;
