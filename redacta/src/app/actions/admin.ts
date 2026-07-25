'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';
import { JOBS, isJobName } from '@/lib/jobs';
import type { ActionState } from './content';

/** Acciones del panel interno. Todas exigen rol ADMIN. */

/** Ejecuta un trabajo programado a mano, sin esperar a su cron. */
export async function runJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const job = String(formData.get('job') ?? '');

  if (!isJobName(job)) return { error: 'Trabajo desconocido.' };

  const startedAt = Date.now();

  try {
    const result = await JOBS[job].run();

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        actorMail: admin.email,
        action: `job.manual.${job}`,
        meta: { ...result, durationMs: Date.now() - startedAt } as never,
      },
    });

    revalidatePath('/admin/sistema');
    return {
      [result.ok ? 'success' : 'error']: `${JOBS[job].label}: ${result.details}`,
    } as ActionState;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'error desconocido';
    return { error: `${JOBS[job].label} fallo: ${message}` };
  }
}

/** Activa o desactiva una bandera de funcionalidad. */
export async function toggleFeatureFlagAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const key = String(formData.get('key') ?? '').trim();
  if (!key) return;

  const flag = await prisma.featureFlag.findUnique({ where: { key } });

  await prisma.featureFlag.upsert({
    where: { key },
    update: { enabled: !flag?.enabled },
    create: { key, enabled: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      actorMail: admin.email,
      action: 'flag.toggle',
      target: key,
      meta: { enabled: !flag?.enabled } as never,
    },
  });

  revalidatePath('/admin/sistema');
}
