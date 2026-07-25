import type { DefaultSession } from 'next-auth';

/** Extiende los tipos de Auth.js con nuestro rol de plataforma. */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'USER' | 'ADMIN';
    } & DefaultSession['user'];
  }

  interface User {
    role?: 'USER' | 'ADMIN';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: 'USER' | 'ADMIN';
  }
}

export {};
