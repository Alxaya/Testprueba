import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/session';
import { getOrganizationForUser } from '@/lib/organization';

/**
 * Exportacion de datos del cliente (derecho de portabilidad, art. 20 RGPD).
 *
 * Devuelve un JSON descargable con todo lo que el cliente ha creado. No incluye
 * hashes de contrasena ni identificadores internos de Stripe.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const organization = await getOrganizationForUser(user.id);
  if (!organization) return NextResponse.json({ error: 'Sin organizacion' }, { status: 404 });

  const [projects, generations] = await Promise.all([
    prisma.project.findMany({
      where: { organizationId: organization.id },
      select: { name: true, description: true, archived: true, createdAt: true },
    }),
    prisma.generation.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: 'asc' },
      select: {
        title: true,
        type: true,
        status: true,
        input: true,
        output: true,
        createdAt: true,
        favorite: true,
        project: { select: { name: true } },
      },
    }),
  ]);

  const payload = {
    exportadoEl: new Date().toISOString(),
    cuenta: { nombre: user.name, email: user.email },
    negocio: {
      nombre: organization.name,
      plan: organization.plan,
      creadoEl: organization.createdAt,
    },
    perfilDeMarca: organization.brandProfile
      ? {
          marca: organization.brandProfile.brandName,
          sector: organization.brandProfile.sector,
          publico: organization.brandProfile.audience,
          tono: organization.brandProfile.toneOfVoice,
          propuestaDeValor: organization.brandProfile.valueProps,
          palabrasClave: organization.brandProfile.keywords,
          evitar: organization.brandProfile.avoid,
        }
      : null,
    proyectos: projects,
    contenido: generations,
  };

  const filename = `redacta-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
