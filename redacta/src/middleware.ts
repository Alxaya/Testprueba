import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

/**
 * Proteccion de rutas en el borde.
 *
 * Usa la configuracion ligera (`auth.config.ts`) porque el middleware corre en
 * runtime Edge: no puede importar Prisma ni bcrypt. La decision de acceso vive
 * en el callback `authorized`.
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    /*
     * Todo excepto:
     *  - rutas de API (se protegen ellas mismas y necesitan runtime Node)
     *  - assets estaticos de Next
     *  - ficheros con extension (favicon, imagenes, robots.txt...)
     */
    '/((?!api|_next/static|_next/image|.*\\..*).*)',
  ],
};
