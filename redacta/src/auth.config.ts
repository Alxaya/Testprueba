import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import { env, features } from '@/lib/env';

/**
 * Configuracion de Auth.js compatible con el runtime Edge.
 *
 * El middleware se ejecuta en Edge, donde no existen `bcrypt` ni el cliente de
 * Prisma. Por eso la configuracion se parte en dos: este fichero (ligero, sin
 * acceso a base de datos) y `src/auth.ts`, que anade el adaptador y el
 * proveedor de credenciales y solo se usa en el runtime Node.
 */
export const authConfig = {
  secret: env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30 },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: features.googleAuth
    ? [
        Google({
          clientId: env.AUTH_GOOGLE_ID!,
          clientSecret: env.AUTH_GOOGLE_SECRET!,
          allowDangerousEmailAccountLinking: true,
        }),
      ]
    : [],
  callbacks: {
    /**
     * Autorizacion de rutas. Se evalua en el middleware, antes de renderizar.
     * Devolver `false` redirige a /login conservando la URL de destino.
     */
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = Boolean(auth?.user);
      const isAdmin = auth?.user?.role === 'ADMIN';

      if (pathname.startsWith('/admin')) return isLoggedIn && isAdmin;
      if (pathname.startsWith('/app')) return isLoggedIn;
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role ?? 'USER';
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as 'USER' | 'ADMIN') ?? 'USER';
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
