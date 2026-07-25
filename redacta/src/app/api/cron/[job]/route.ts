import { NextResponse, type NextRequest } from 'next/server';
import { env, features } from '@/lib/env';
import { JOBS, isJobName } from '@/lib/jobs';
import { prisma } from '@/lib/prisma';

/**
 * Ejecucion de trabajos programados por HTTP.
 *
 * Se protege con un secreto compartido (`CRON_SECRET`), enviado como
 * `Authorization: Bearer <secreto>`. Vercel Cron lo manda automaticamente si la
 * variable esta definida en el proyecto; cualquier otro planificador
 * (GitHub Actions, cron del servidor) solo tiene que anadir la cabecera.
 *
 * Sin CRON_SECRET configurado, el endpoint solo funciona fuera de produccion:
 * asi el desarrollo local es comodo sin dejar una puerta abierta al desplegar.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Params = { params: Promise<{ job: string }> };

function authorize(request: NextRequest): boolean {
  if (!features.cron) return env.NODE_ENV !== 'production';

  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return token === env.CRON_SECRET;
}

export async function GET(request: NextRequest, { params }: Params) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { job } = await params;
  if (!isJobName(job)) {
    return NextResponse.json(
      { error: 'Trabajo desconocido', disponibles: Object.keys(JOBS) },
      { status: 404 },
    );
  }

  const startedAt = Date.now();

  try {
    const result = await JOBS[job].run();

    // Queda registrado para poder auditar que se ejecuto y con que resultado.
    await prisma.auditLog.create({
      data: {
        action: `cron.${job}`,
        actorMail: 'sistema',
        meta: { ...result, durationMs: Date.now() - startedAt } as never,
      },
    });

    return NextResponse.json({ ...result, durationMs: Date.now() - startedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'error desconocido';
    console.error(`[cron:${job}] fallo`, error);

    await prisma.auditLog
      .create({
        data: { action: `cron.${job}.error`, actorMail: 'sistema', meta: { message } as never },
      })
      .catch(() => {});

    return NextResponse.json({ job, ok: false, error: message }, { status: 500 });
  }
}

/** POST se acepta igual que GET: algunos planificadores solo envian POST. */
export const POST = GET;
