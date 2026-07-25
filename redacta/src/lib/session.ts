import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getOrganizationForUser, type OrganizationWithBrand } from './organization';

/**
 * Helpers de sesion para Server Components y Server Actions.
 *
 * El middleware ya bloquea el acceso a /app y /admin, pero estas funciones
 * repiten la comprobacion: es la unica forma de garantizar que un fallo de
 * configuracion del matcher no expone datos, y ademas dan los tipos correctos.
 */

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: 'USER' | 'ADMIN';
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
    role: session.user.role ?? 'USER',
  };
}

/** Exige sesion iniciada; si no, redirige a /login. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user;
}

/** Exige rol ADMIN; si no, devuelve un 404 logico redirigiendo al panel. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') redirect('/app');
  return user;
}

/** Usuario + su organizacion activa. Lo habitual en el panel de cliente. */
export async function requireUserWithOrg(): Promise<{
  user: SessionUser;
  organization: OrganizationWithBrand;
}> {
  const user = await requireUser();
  const organization = await getOrganizationForUser(user.id);
  // Un usuario sin organizacion solo puede darse si fallo el evento de alta;
  // enviarlo a /login fuerza a repetir el flujo, que es idempotente.
  if (!organization) redirect('/login');
  return { user, organization };
}
