'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { signOut } from '@/auth';
import { prisma } from '@/lib/prisma';
import { requireUserWithOrg } from '@/lib/session';
import { EVENTS, track } from '@/lib/analytics';
import type { ActionState } from './content';

/** Cierra la sesion y devuelve a la portada. */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: '/' });
}

// ---------------------------------------------------------------------------
// Perfil de marca
// ---------------------------------------------------------------------------

const brandSchema = z.object({
  brandName: z.string().trim().max(80).optional(),
  sector: z.string().trim().max(80).optional(),
  audience: z.string().trim().max(400).optional(),
  toneOfVoice: z.string().trim().max(200).optional(),
  valueProps: z.string().trim().max(600).optional(),
  keywords: z.string().trim().max(400).optional(),
  avoid: z.string().trim().max(400).optional(),
});

/**
 * Guarda el perfil de marca. Es la pantalla con mas impacto del producto: todo
 * lo que se escribe aqui se inyecta en cada prompt.
 */
export async function saveBrandProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, organization } = await requireUserWithOrg();

  const parsed = brandSchema.safeParse({
    brandName: formData.get('brandName'),
    sector: formData.get('sector'),
    audience: formData.get('audience'),
    toneOfVoice: formData.get('toneOfVoice'),
    valueProps: formData.get('valueProps'),
    keywords: formData.get('keywords'),
    avoid: formData.get('avoid'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisa los datos introducidos.' };
  }

  const data = Object.fromEntries(
    Object.entries(parsed.data).map(([key, value]) => [key, value || null]),
  );

  await prisma.brandProfile.upsert({
    where: { organizationId: organization.id },
    update: data,
    create: { organizationId: organization.id, ...data },
  });

  await track({
    name: EVENTS.BRAND_PROFILE_UPDATED,
    organizationId: organization.id,
    userId: user.id,
  });

  revalidatePath('/app/marca');
  return { success: 'Perfil de marca guardado. Se aplicara a partir de la siguiente generacion.' };
}

// ---------------------------------------------------------------------------
// Cuenta
// ---------------------------------------------------------------------------

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Escribe tu nombre.').max(80),
  organizationName: z.string().trim().min(2, 'Escribe el nombre del negocio.').max(80),
});

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, organization } = await requireUserWithOrg();

  const parsed = profileSchema.safeParse({
    name: formData.get('name'),
    organizationName: formData.get('organizationName'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisa los datos introducidos.' };
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { name: parsed.data.name } }),
    prisma.organization.update({
      where: { id: organization.id },
      data: { name: parsed.data.organizationName },
    }),
  ]);

  revalidatePath('/app/ajustes');
  return { success: 'Datos actualizados.' };
}

const passwordSchema = z
  .object({
    current: z.string().min(1, 'Escribe tu contrasena actual.'),
    next: z.string().min(8, 'La nueva contrasena debe tener al menos 8 caracteres.').max(200),
  })
  .refine((v) => v.current !== v.next, {
    message: 'La nueva contrasena debe ser distinta de la actual.',
  });

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user } = await requireUserWithOrg();

  const parsed = passwordSchema.safeParse({
    current: formData.get('current'),
    next: formData.get('next'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisa los datos introducidos.' };
  }

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (!record?.passwordHash) {
    return { error: 'Tu cuenta usa acceso con Google, no tiene contrasena que cambiar.' };
  }

  const valid = await bcrypt.compare(parsed.data.current, record.passwordHash);
  if (!valid) return { error: 'La contrasena actual no es correcta.' };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.next, 12) },
  });

  return { success: 'Contrasena actualizada.' };
}

/**
 * Baja de la cuenta. Borra la organizacion completa, y con ella (en cascada)
 * contenido, proyectos, uso y eventos. Es irreversible por diseno: es lo que
 * exige el derecho de supresion del RGPD.
 */
export async function deleteAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, organization } = await requireUserWithOrg();

  if (String(formData.get('confirm') ?? '').trim().toUpperCase() !== 'ELIMINAR') {
    return { error: 'Escribe ELIMINAR para confirmar la baja.' };
  }

  await prisma.organization.delete({ where: { id: organization.id } });
  await prisma.user.delete({ where: { id: user.id } });

  await signOut({ redirectTo: '/' });
  redirect('/');
}
