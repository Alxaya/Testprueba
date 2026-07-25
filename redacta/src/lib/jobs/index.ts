import { GenerationStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getPlan } from '@/lib/plans';
import { getUsage } from '@/lib/organization';
import { alreadySentRecently, sendEmail, templates } from '@/lib/email';
import { contentTypeLabel } from '@/lib/ai/content-types';
import { generateBlogPost } from './blog-autopilot';

/**
 * Trabajos programados.
 *
 * Cada uno es una funcion pura de efectos: recibe nada, devuelve un resumen de
 * lo que ha hecho. Asi se pueden ejecutar a mano desde el panel de admin o
 * desde una peticion HTTP autenticada, y el resultado queda registrado.
 */

export type JobResult = {
  job: string;
  ok: boolean;
  processed: number;
  details: string;
};

const DAY = 24 * 60 * 60 * 1000;

/** Informe semanal de actividad para cada cliente activo. */
export async function weeklyReportJob(): Promise<JobResult> {
  const since = new Date(Date.now() - 7 * DAY);

  const organizations = await prisma.organization.findMany({
    where: { generations: { some: { createdAt: { gte: since } } } },
    include: {
      members: {
        orderBy: { createdAt: 'asc' },
        take: 1,
        include: { user: { select: { email: true } } },
      },
    },
  });

  let sent = 0;

  for (const organization of organizations) {
    const email = organization.members[0]?.user.email;
    if (!email) continue;
    if (await alreadySentRecently(email, 'weekly-report', 6 * 24)) continue;

    const [generations, byType, usage] = await Promise.all([
      prisma.generation.findMany({
        where: {
          organizationId: organization.id,
          createdAt: { gte: since },
          status: GenerationStatus.COMPLETED,
        },
        select: { output: true },
      }),
      prisma.generation.groupBy({
        by: ['type'],
        where: { organizationId: organization.id, createdAt: { gte: since } },
        _count: { _all: true },
        orderBy: { _count: { type: 'desc' } },
        take: 1,
      }),
      getUsage(organization),
    ]);

    if (generations.length === 0) continue;

    const words = generations.reduce(
      (total, item) => total + (item.output?.trim().split(/\s+/).filter(Boolean).length ?? 0),
      0,
    );

    await sendEmail({
      to: email,
      template: 'weekly-report',
      organizationId: organization.id,
      email: templates.weeklyReport({
        generations: generations.length,
        words,
        topType: byType[0] ? contentTypeLabel(byType[0].type) : 'contenido',
        remaining: usage.remaining,
      }),
    });
    sent += 1;
  }

  return {
    job: 'weekly-report',
    ok: true,
    processed: sent,
    details: `${sent} informes enviados de ${organizations.length} organizaciones activas.`,
  };
}

/**
 * Recordatorio a quien se registro pero dejo de usar el producto.
 * Es la palanca mas barata contra el abandono temprano.
 */
export async function inactivityNudgeJob(): Promise<JobResult> {
  const now = Date.now();

  const organizations = await prisma.organization.findMany({
    where: {
      createdAt: { lte: new Date(now - 3 * DAY), gte: new Date(now - 30 * DAY) },
      generations: { none: { createdAt: { gte: new Date(now - 7 * DAY) } } },
    },
    include: {
      members: {
        orderBy: { createdAt: 'asc' },
        take: 1,
        include: { user: { select: { email: true, name: true } } },
      },
    },
    take: 200,
  });

  let sent = 0;

  for (const organization of organizations) {
    const member = organization.members[0];
    if (!member?.user.email) continue;
    if (await alreadySentRecently(member.user.email, 'inactivity-nudge', 14 * 24)) continue;

    await sendEmail({
      to: member.user.email,
      template: 'inactivity-nudge',
      organizationId: organization.id,
      email: templates.inactivityNudge(member.user.name),
    });
    sent += 1;
  }

  return {
    job: 'inactivity-nudge',
    ok: true,
    processed: sent,
    details: `${sent} recordatorios enviados.`,
  };
}

/**
 * Limpieza de datos historicos.
 * Reduce coste de almacenamiento y limita la exposicion de datos antiguos.
 */
export async function cleanupJob(): Promise<JobResult> {
  const [events, webhooks, emails] = await Promise.all([
    prisma.analyticsEvent.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 180 * DAY) } },
    }),
    prisma.processedWebhook.deleteMany({
      where: { processedAt: { lt: new Date(Date.now() - 30 * DAY) } },
    }),
    prisma.emailLog.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 180 * DAY) } },
    }),
  ]);

  const total = events.count + webhooks.count + emails.count;

  return {
    job: 'cleanup',
    ok: true,
    processed: total,
    details: `${events.count} eventos, ${webhooks.count} webhooks y ${emails.count} registros de email eliminados.`,
  };
}

/** Publica un articulo del blog generado con el propio motor. */
export async function blogAutopilotJob(): Promise<JobResult> {
  return generateBlogPost();
}

/** Registro de trabajos disponibles, usado por la ruta HTTP y el panel de admin. */
export const JOBS = {
  'weekly-report': {
    label: 'Informe semanal',
    description: 'Envia a cada cliente activo un resumen de lo que ha creado esta semana.',
    run: weeklyReportJob,
  },
  'inactivity-nudge': {
    label: 'Recordatorio de inactividad',
    description: 'Escribe a quien lleva mas de 7 dias sin generar contenido.',
    run: inactivityNudgeJob,
  },
  'blog-autopilot': {
    label: 'Blog automatico',
    description: 'Genera y publica un articulo SEO del calendario editorial.',
    run: blogAutopilotJob,
  },
  cleanup: {
    label: 'Limpieza de historico',
    description: 'Elimina eventos, webhooks y registros de email antiguos.',
    run: cleanupJob,
  },
} as const;

export type JobName = keyof typeof JOBS;

export function isJobName(value: string): value is JobName {
  return value in JOBS;
}
