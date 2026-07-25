import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authConfig } from '@/auth.config';
import { ensureOrganization } from '@/lib/organization';

/**
 * Instancia completa de Auth.js (runtime Node).
 *
 * Anade sobre `authConfig`:
 *  - el adaptador de Prisma, para persistir cuentas OAuth,
 *  - el proveedor de credenciales (email + contrasena con bcrypt),
 *  - la creacion automatica de organizacion tras el primer acceso.
 */

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...authConfig.providers,
    Credentials({
      name: 'Email y contrasena',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contrasena', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase();
        const user = await prisma.user.findUnique({ where: { email } });

        // Cuenta inexistente o creada solo con OAuth: no hay hash que comparar.
        // Devolvemos null sin distinguir el motivo para no filtrar que emails
        // estan registrados.
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      // Primer login: volcamos id y rol al token.
      if (user) {
        token.id = user.id as string;
        token.role = user.role ?? 'USER';
      }
      // Refresco explicito (p. ej. tras un cambio de rol desde admin).
      if (trigger === 'update' && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true },
        });
        if (fresh) token.role = fresh.role;
      }
      return token;
    },
  },
  events: {
    /**
     * Todo usuario necesita una organizacion para poder trabajar. Se crea aqui
     * para cubrir el alta por OAuth; el alta por formulario la crea en la misma
     * transaccion del registro.
     */
    async signIn({ user }) {
      if (user?.id) {
        await ensureOrganization(user.id, user.name ?? user.email ?? 'Mi negocio');
      }
    },
  },
});
