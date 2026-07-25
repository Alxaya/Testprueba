/**
 * Datos de ejemplo para desarrollo.
 *
 *   npm run db:seed
 *
 * Crea dos cuentas listas para entrar, contenido de muestra, articulos de blog
 * y eventos de analitica repartidos en 30 dias, para que los paneles no se vean
 * vacios nada mas arrancar.
 *
 * Es idempotente: se puede ejecutar varias veces sin duplicar cuentas.
 */

import {
  ContentType,
  GenerationStatus,
  MemberRole,
  PlanId,
  PrismaClient,
  SubscriptionStatus,
  UserRole,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'redacta1234';
const DAY = 24 * 60 * 60 * 1000;

/** Numero pseudoaleatorio estable dentro de un rango. */
function between(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function upsertAccount(args: {
  email: string;
  name: string;
  role: UserRole;
  organizationName: string;
  slug: string;
  plan: PlanId;
  status: SubscriptionStatus;
}) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: args.email },
    update: { name: args.name, role: args.role, passwordHash },
    create: { email: args.email, name: args.name, role: args.role, passwordHash },
  });

  const organization = await prisma.organization.upsert({
    where: { slug: args.slug },
    update: { plan: args.plan, subscriptionStatus: args.status },
    create: {
      name: args.organizationName,
      slug: args.slug,
      plan: args.plan,
      subscriptionStatus: args.status,
      stripeCurrentPeriodEnd: args.plan === PlanId.FREE ? null : new Date(Date.now() + 20 * DAY),
    },
  });

  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
    update: {},
    create: { userId: user.id, organizationId: organization.id, role: MemberRole.OWNER },
  });

  return { user, organization };
}

async function main() {
  console.log('→ Sembrando datos de ejemplo…\n');

  // --- Cuentas -----------------------------------------------------------
  const demo = await upsertAccount({
    email: 'demo@redacta.test',
    name: 'Ana Demo',
    role: UserRole.USER,
    organizationName: 'Pelusa Mascotas',
    slug: 'pelusa-mascotas',
    plan: PlanId.PRO,
    status: SubscriptionStatus.ACTIVE,
  });

  const admin = await upsertAccount({
    email: 'admin@redacta.test',
    name: 'Admin Redacta',
    role: UserRole.ADMIN,
    organizationName: 'Redacta Interno',
    slug: 'redacta-interno',
    plan: PlanId.BUSINESS,
    status: SubscriptionStatus.ACTIVE,
  });

  // --- Perfil de marca ---------------------------------------------------
  await prisma.brandProfile.upsert({
    where: { organizationId: demo.organization.id },
    update: {},
    create: {
      organizationId: demo.organization.id,
      brandName: 'Pelusa',
      sector: 'Accesorios y cuidado para mascotas',
      audience:
        'Duenos de perros de pelo largo, 30-55 anos, compran online y les preocupa tener pelo por toda la casa.',
      toneOfVoice: 'Cercano y practico, con algo de humor. De tu, nunca de usted.',
      valueProps: 'Envio en 24 h peninsula, devolucion gratuita 30 dias, atencion por WhatsApp.',
      keywords: 'cepillo perro pelo largo, quitar pelo del sofa, cepillo autolimpiante',
      avoid: 'No prometer resultados veterinarios ni mencionar precios concretos.',
    },
  });

  await prisma.brandProfile.upsert({
    where: { organizationId: admin.organization.id },
    update: {},
    create: { organizationId: admin.organization.id, brandName: 'Redacta' },
  });

  // --- Proyectos ---------------------------------------------------------
  const existingProjects = await prisma.project.count({
    where: { organizationId: demo.organization.id },
  });

  if (existingProjects === 0) {
    await prisma.project.createMany({
      data: [
        {
          organizationId: demo.organization.id,
          name: 'Catalogo principal',
          description: 'Fichas de producto de la tienda',
        },
        {
          organizationId: demo.organization.id,
          name: 'Campana de Navidad',
          description: 'Contenido estacional de diciembre',
        },
      ],
    });
  }

  const project = await prisma.project.findFirst({
    where: { organizationId: demo.organization.id },
    orderBy: { createdAt: 'asc' },
  });

  // --- Contenido de ejemplo ---------------------------------------------
  const existingGenerations = await prisma.generation.count({
    where: { organizationId: demo.organization.id },
  });

  if (existingGenerations === 0) {
    const samples: Array<{ type: ContentType; title: string; output: string; input: object }> = [
      {
        type: ContentType.PRODUCT_DESCRIPTION,
        title: 'Ficha de producto: Cepillo autolimpiante Pelusa',
        input: { product: 'Cepillo autolimpiante Pelusa', details: 'Puas retractiles, mango antideslizante' },
        output: `# Cepillo autolimpiante para perros de pelo largo

Recoges pelo del sofa todos los dias y el cepillo se atasca a las tres pasadas. Este suelta todo el pelo acumulado pulsando un boton.

## Por que te va a cambiar la rutina

- **Menos pelo por casa:** retira el subpelo muerto antes de que acabe en la tapiceria.
- **Se vacia con una mano:** las puas se retraen y el pelo cae solo.
- **Sin tirones:** puntas redondeadas, tambien para pieles sensibles.
- **Cabe en cualquier cajon:** mango compacto y sin piezas sueltas.

## Especificaciones

- Material del mango: [indicar material]
- Medidas: [indicar medidas]
- Apto para: perros y gatos de pelo medio y largo

Pruebalo esta semana y nota la diferencia en el sofa.`,
      },
      {
        type: ContentType.SOCIAL_SCRIPT,
        title: 'Guion de redes: Demostracion del cepillo',
        input: { topic: 'Demostracion del cepillo autolimpiante', platform: 'tiktok', duration: '30' },
        output: `# Guion TikTok · 30 segundos

## Ganchos (elige uno)

1. "Llevo 4 anos quitando pelo del sofa mal."
2. "Esto sale de UN cepillado. De un perro. De tamano medio."
3. "Si tienes perro de pelo largo, para el video aqui."

## Plano a plano

**0-3s** — Primer plano del sofa lleno de pelo. Voz: el gancho.
**3-8s** — Cepillado en el lomo del perro, plano medio. Voz: "Miralo lleno en tres pasadas."
**8-15s** — Primer plano del boton. Se retraen las puas y cae el pelo de golpe.
**15-24s** — Sofa despues. Comparativa lado a lado con el plano inicial.
**24-30s** — Producto en mano. Voz: llamada a la accion.

## Texto en pantalla

- 0s: "Pelo por todas partes"
- 8s: "Un boton"
- 24s: "Enlace en la bio"

## Descripcion

Cepillado de domingo con resultado inmediato. #perros #mascotas #petbrush #pelodeperro #trucosdecasa`,
      },
      {
        type: ContentType.SEO_METADATA,
        title: 'Metadatos SEO: Categoria cepillos',
        input: { page: 'Categoria: cepillos para perros', keyword: 'cepillo perro pelo largo' },
        output: `## Title tag

1. Cepillo para perro de pelo largo | Pelusa (44)
2. Cepillos autolimpiantes para perros de pelo largo (49)
3. Cepillo perro pelo largo: autolimpiante y sin tirones (55)

## Meta description

1. Cepillos autolimpiantes para perros de pelo largo. Se vacian con un boton, no tiran del pelo y llegan en 24 h. Devolucion gratis 30 dias. (147)

## Slug de URL

- cepillos-perro-pelo-largo
- cepillo-autolimpiante-perro`,
      },
    ];

    for (const [index, sample] of samples.entries()) {
      const outputTokens = between(600, 1400);
      await prisma.generation.create({
        data: {
          organizationId: demo.organization.id,
          userId: demo.user.id,
          projectId: project?.id,
          type: sample.type,
          status: GenerationStatus.COMPLETED,
          title: sample.title,
          input: sample.input as never,
          output: sample.output,
          model: 'claude-opus-5',
          inputTokens: between(700, 1200),
          outputTokens,
          costCents: between(2, 6),
          durationMs: between(9000, 22000),
          favorite: index === 0,
          createdAt: new Date(Date.now() - index * 2 * DAY),
        },
      });
    }
  }

  // --- Consumo del periodo ----------------------------------------------
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  await prisma.usagePeriod.upsert({
    where: {
      organizationId_periodStart: { organizationId: demo.organization.id, periodStart },
    },
    update: {},
    create: {
      organizationId: demo.organization.id,
      periodStart,
      periodEnd,
      generations: 3,
      words: 1180,
      inputTokens: 2900,
      outputTokens: 3200,
      costCents: 12,
    },
  });

  // --- Blog --------------------------------------------------------------
  const posts = [
    {
      slug: 'como-escribir-fichas-de-producto-que-vendan',
      title: 'Como escribir fichas de producto que vendan',
      excerpt:
        'La estructura que convierte: problema, beneficios, especificaciones y llamada a la accion. Con ejemplos de antes y despues.',
      tags: ['ecommerce', 'copywriting'],
      emoji: '🛍️',
      body: `La mayoria de fichas de producto de las tiendas espanolas son la descripcion del proveedor copiada tal cual. Google las ve duplicadas y el cliente no encuentra el motivo para comprarte a ti.

## La estructura que funciona

1. **El problema, en la primera frase.** No hables del producto todavia. Habla de lo que le pasa a quien lo va a comprar.
2. **Beneficios, no caracteristicas.** "Puas retractiles" no vende. "Se vacia con una mano" si.
3. **Especificaciones aparte.** En lista, escaneable, sin adjetivos.
4. **Prueba.** Una resena real, una garantia, un dato de devoluciones.
5. **Llamada a la accion.** Una sola, clara.

## Antes y despues

| Antes | Despues |
| --- | --- |
| "Cepillo de alta calidad con diseno ergonomico" | "Se vacia pulsando un boton: sin arrancar el pelo con los dedos" |
| "Fabricado con materiales premium" | "Puntas redondeadas: no tira aunque tenga nudos" |

## Tres cosas que puedes hacer hoy

- Reescribe la primera frase de tus 10 productos mas vendidos.
- Convierte cada caracteristica en un beneficio concreto.
- Anade una tabla de especificaciones a las fichas que no la tengan.`,
    },
    {
      slug: 'errores-seo-tienda-online',
      title: '9 errores de SEO que cometen casi todas las tiendas online',
      excerpt:
        'Titles duplicados, categorias sin texto, fichas copiadas del proveedor y paginacion mal resuelta. Como detectarlos y corregirlos.',
      tags: ['seo', 'ecommerce'],
      emoji: '🔍',
      body: `Ninguno de estos errores es exotico. Estan en la mayoria de tiendas que revisamos, y casi todos se arreglan en una tarde.

## 1. Titles duplicados en variantes

Si vendes el mismo producto en cinco colores y las cinco paginas tienen el mismo title, estas compitiendo contra ti mismo. Diferencia el atributo en el title o consolida en una sola ficha con selector.

## 2. Categorias sin una sola linea de texto

Una categoria con 40 productos y cero texto no le dice nada a Google. Con dos parrafos arriba y un bloque de preguntas frecuentes abajo suele bastar.

## 3. Descripciones copiadas del proveedor

Si tu ficha es identica a la de otras 30 tiendas, no hay motivo para posicionarte a ti.

## 4. Meta descriptions vacias

Google se inventa una. A veces acierta; casi siempre pierdes el control del mensaje.

## Que revisar primero

- Exporta tus URLs y busca titles repetidos.
- Ordena las categorias por trafico y escribe texto en las cinco primeras.
- Reescribe las fichas de tus 20 productos mas vendidos.`,
    },
  ];

  for (const post of posts) {
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: {},
      create: {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        contentMd: post.body,
        tags: post.tags,
        coverEmoji: post.emoji,
        seoTitle: post.title.slice(0, 60),
        seoDescription: post.excerpt.slice(0, 155),
        readingMinutes: 4,
        published: true,
        publishedAt: new Date(Date.now() - between(1, 20) * DAY),
      },
    });
  }

  // --- Eventos de analitica ---------------------------------------------
  const existingEvents = await prisma.analyticsEvent.count();

  if (existingEvents < 50) {
    const sources = ['google', 'instagram', 'tiktok', null];
    const events: Array<{
      name: string;
      createdAt: Date;
      utmSource: string | null;
      path: string;
      anonymousId?: string;
      organizationId?: string;
    }> = [];

    for (let day = 29; day >= 0; day -= 1) {
      const createdBase = Date.now() - day * DAY;

      for (let i = 0; i < between(8, 30); i += 1) {
        events.push({
          name: 'pageview',
          createdAt: new Date(createdBase + between(0, 20) * 60 * 60 * 1000),
          utmSource: sources[between(0, sources.length - 1)],
          path: ['/', '/precios', '/blog'][between(0, 2)],
          // El embudo cuenta visitantes unicos: cada visita simulada necesita
          // su propio identificador anonimo.
          anonymousId: `seed-${day}-${i}`,
        });
      }
      for (let i = 0; i < between(0, 3); i += 1) {
        events.push({
          name: 'signup',
          createdAt: new Date(createdBase + between(0, 20) * 60 * 60 * 1000),
          utmSource: null,
          path: '/registro',
        });
      }
      for (let i = 0; i < between(0, 8); i += 1) {
        events.push({
          name: 'generation_created',
          createdAt: new Date(createdBase + between(0, 20) * 60 * 60 * 1000),
          utmSource: null,
          path: '/app/generar',
          organizationId: demo.organization.id,
        });
      }
    }

    await prisma.analyticsEvent.createMany({ data: events });
    console.log(`  · ${events.length} eventos de analitica creados`);
  }

  console.log(`
✓ Datos de ejemplo listos.

  Cliente:  demo@redacta.test  / ${DEMO_PASSWORD}
  Admin:    admin@redacta.test / ${DEMO_PASSWORD}

  Arranca con: npm run dev
`);
}

main()
  .catch((error) => {
    console.error('✗ Error sembrando datos:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
