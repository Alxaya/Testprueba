'use server';

import { AuthError } from 'next-auth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { signIn } from '@/auth';
import { prisma } from '@/lib/prisma';
import { adminEmails } from '@/lib/env';
import { ensureOrganization } from '@/lib/organization';
import { sendEmail, templates } from '@/lib/email';
import { EVENTS, track } from '@/lib/analytics';

/** Estado devuelto a los formularios de acceso y registro. */
export type AuthFormState = { error?: string; ok?: boolean };

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Escribe tu nombre.').max(80),
  email: z.string().trim().toLowerCase().email('Introduce un email valido.'),
  password: z
    .string()
    .min(8, 'La contrasena debe tener al menos 8 caracteres.')
    .max(200, 'La contrasena es demasiado larga.'),
  business: z.string().trim().max(80).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Introduce un email valido.'),
  password: z.string().min(1, 'Escribe tu contrasena.'),
});

/**
 * Alta de usuario con email y contrasena.
 *
 * Crea usuario, organizacion, perfil de marca y proyecto inicial, y deja la
 * sesion iniciada. El email de bienvenida no bloquea el alta: si falla el
 * envio, el registro sigue siendo valido.
 */
export async function registerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    business: formData.get('business'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisa los datos introducidos.' };
  }

  const { name, email, password, business } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { error: 'Ya existe una cuenta con este email. Prueba a iniciar sesion.' };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: adminEmails.includes(email) ? UserRole.ADMIN : UserRole.USER,
    },
  });

  const organization = await ensureOrganization(user.id, business || name);

  await track({
    name: EVENTS.SIGNUP,
    userId: user.id,
    organizationId: organization.id,
    props: { method: 'credentials' },
  });

  void sendEmail({
    to: email,
    template: 'welcome',
    organizationId: organization.id,
    email: templates.welcome(name),
  });

  // signIn lanza una redireccion interna de Next cuando tiene exito: no debe
  // capturarse, por eso va fuera de cualquier try/catch generico.
  await signIn('credentials', { email, password, redirectTo: '/app' });

  return { ok: true };
}

/** Acceso con email y contrasena. */
export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisa los datos introducidos.' };
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: '/app',
    });
  } catch (error) {
    // AuthError significa credenciales invalidas; cualquier otro error (incluida
    // la redireccion de exito) debe propagarse tal cual.
    if (error instanceof AuthError) {
      return { error: 'Email o contrasena incorrectos.' };
    }
    throw error;
  }

  return { ok: true };
}

/** Acceso con Google. */
export async function googleSignInAction(): Promise<void> {
  await signIn('google', { redirectTo: '/app' });
}
