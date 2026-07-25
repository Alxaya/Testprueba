import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { deviceFromUserAgent, track } from '@/lib/analytics';
import { getOrganizationForUser } from '@/lib/organization';

/**
 * Recepcion de eventos de analitica desde el navegador.
 *
 * Solo se aceptan campos conocidos y con longitud acotada: el cuerpo lo envia
 * el cliente, asi que nada de aqui puede confiarse. El identificador de usuario
 * y el de organizacion se toman de la sesion del servidor, nunca del cuerpo.
 */

const schema = z.object({
  name: z.string().min(1).max(60),
  path: z.string().max(300).nullish(),
  anonymousId: z.string().max(64).nullish(),
  referrer: z.string().max(500).nullish(),
  utmSource: z.string().max(100).nullish(),
  utmMedium: z.string().max(100).nullish(),
  utmCampaign: z.string().max(100).nullish(),
});

/** Nombres de evento aceptados desde el cliente. El resto se ignora. */
const CLIENT_EVENTS = new Set(['pageview']);

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success || !CLIENT_EVENTS.has(parsed.data.name)) {
    // Se responde 204 igualmente: no interesa dar pistas ni generar ruido de
    // errores en el navegador por un evento de analitica.
    return new NextResponse(null, { status: 204 });
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const organization = userId ? await getOrganizationForUser(userId) : null;

  await track({
    ...parsed.data,
    userId,
    organizationId: organization?.id ?? null,
    country: request.headers.get('x-vercel-ip-country'),
    device: deviceFromUserAgent(request.headers.get('user-agent')),
  });

  return new NextResponse(null, { status: 204 });
}
