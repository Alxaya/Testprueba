'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUserWithOrg } from '@/lib/session';
import { generateContent } from '@/lib/ai/generate';
import { contentTypeBySlug } from '@/lib/ai/content-types';
import { getPlan } from '@/lib/plans';
import { pluralize } from '@/lib/utils';

/** Estado de los formularios del panel. */
export type ActionState = { error?: string; success?: string };

// ---------------------------------------------------------------------------
// Generacion
// ---------------------------------------------------------------------------

/**
 * Genera una pieza de contenido y lleva a su ficha.
 *
 * La redireccion final se hace fuera del bloque de control de errores porque
 * `redirect()` funciona lanzando una excepcion que Next debe recibir intacta.
 */
export async function generateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, organization } = await requireUserWithOrg();

  const slug = String(formData.get('typeSlug') ?? '');
  const def = contentTypeBySlug(slug);
  if (!def) return { error: 'Formato de contenido no valido.' };

  // Solo se recogen los campos declarados por el formato: nada de datos sueltos.
  const input: Record<string, string> = {};
  for (const field of def.fields) {
    const value = formData.get(field.name);
    if (typeof value === 'string' && value.trim()) input[field.name] = value.trim();
  }

  const projectId = String(formData.get('projectId') ?? '') || null;

  const result = await generateContent({
    organization,
    userId: user.id,
    type: def.id,
    input,
    projectId,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath('/app');
  revalidatePath('/app/biblioteca');
  redirect(`/app/biblioteca/${result.generation.id}`);
}

// ---------------------------------------------------------------------------
// Biblioteca
// ---------------------------------------------------------------------------

/** Marca o desmarca una pieza como favorita. */
export async function toggleFavoriteAction(formData: FormData): Promise<void> {
  const { organization } = await requireUserWithOrg();
  const id = String(formData.get('id') ?? '');

  // El filtro por organizationId es la barrera de seguridad: impide tocar
  // contenido de otro cliente aunque se manipule el id.
  const generation = await prisma.generation.findFirst({
    where: { id, organizationId: organization.id },
    select: { id: true, favorite: true },
  });
  if (!generation) return;

  await prisma.generation.update({
    where: { id: generation.id },
    data: { favorite: !generation.favorite },
  });

  revalidatePath('/app/biblioteca');
  revalidatePath(`/app/biblioteca/${id}`);
}

/** Elimina una pieza de la biblioteca. */
export async function deleteGenerationAction(formData: FormData): Promise<void> {
  const { organization } = await requireUserWithOrg();
  const id = String(formData.get('id') ?? '');

  await prisma.generation.deleteMany({ where: { id, organizationId: organization.id } });

  revalidatePath('/app/biblioteca');
  redirect('/app/biblioteca');
}

// ---------------------------------------------------------------------------
// Proyectos
// ---------------------------------------------------------------------------

const projectSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.').max(60),
  description: z.string().trim().max(200).optional(),
});

export async function createProjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { organization } = await requireUserWithOrg();

  const parsed = projectSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisa los datos.' };
  }

  const limit = getPlan(organization.plan).limits.projects;
  const current = await prisma.project.count({
    where: { organizationId: organization.id, archived: false },
  });

  if (current >= limit) {
    return {
      error: `Tu plan permite ${pluralize(limit, 'proyecto activo', 'proyectos activos')}. Archiva uno o cambia de plan para crear mas.`,
    };
  }

  await prisma.project.create({
    data: {
      organizationId: organization.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
    },
  });

  revalidatePath('/app/proyectos');
  return { success: 'Proyecto creado.' };
}

/** Archiva o reactiva un proyecto. El contenido asociado se conserva. */
export async function toggleProjectArchiveAction(formData: FormData): Promise<void> {
  const { organization } = await requireUserWithOrg();
  const id = String(formData.get('id') ?? '');

  const project = await prisma.project.findFirst({
    where: { id, organizationId: organization.id },
    select: { id: true, archived: true },
  });
  if (!project) return;

  await prisma.project.update({
    where: { id: project.id },
    data: { archived: !project.archived },
  });

  revalidatePath('/app/proyectos');
}
