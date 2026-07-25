import { Resend } from 'resend';
import { EmailStatus } from '@prisma/client';
import { env, features } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import type { RenderedEmail } from './templates';

/**
 * Emisor de email transaccional.
 *
 * Sin RESEND_API_KEY el envio no falla: se escribe el email en consola y se
 * registra como SKIPPED. Asi el flujo completo (registro, avisos de cuota,
 * informes) es probable en local sin dar de alta ningun servicio.
 */

const resend = features.email ? new Resend(env.RESEND_API_KEY!) : null;

export type SendOptions = {
  to: string;
  template: string;
  email: RenderedEmail;
  organizationId?: string | null;
};

export async function sendEmail({ to, template, email, organizationId }: SendOptions): Promise<boolean> {
  if (!resend) {
    console.info(`[email:dry-run] -> ${to} | ${template} | "${email.subject}"`);
    await log(to, template, email.subject, EmailStatus.SKIPPED, null, organizationId);
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject: email.subject,
      html: email.html,
    });

    if (error) {
      await log(to, template, email.subject, EmailStatus.FAILED, error.message, organizationId);
      console.error('[email] error de Resend', error);
      return false;
    }

    await log(to, template, email.subject, EmailStatus.SENT, null, organizationId);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error desconocido';
    await log(to, template, email.subject, EmailStatus.FAILED, message, organizationId);
    console.error('[email] excepcion al enviar', err);
    return false;
  }
}

async function log(
  to: string,
  template: string,
  subject: string,
  status: EmailStatus,
  error: string | null,
  organizationId?: string | null,
): Promise<void> {
  try {
    await prisma.emailLog.create({
      data: { to, template, subject, status, error, organizationId: organizationId ?? null },
    });
  } catch (err) {
    console.error('[email] no se pudo registrar el envio', err);
  }
}

/**
 * Evita reenviar el mismo tipo de email a la misma direccion dentro de una
 * ventana de tiempo. Lo usan los crons para no saturar al cliente.
 */
export async function alreadySentRecently(to: string, template: string, hours: number): Promise<boolean> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const found = await prisma.emailLog.findFirst({
    where: { to, template, status: EmailStatus.SENT, createdAt: { gte: since } },
    select: { id: true },
  });
  return Boolean(found);
}

export { templates } from './templates';
