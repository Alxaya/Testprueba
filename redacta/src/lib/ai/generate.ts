import { ContentType, GenerationStatus, type Generation } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { estimateCostCents, getPlan } from '@/lib/plans';
import { countWords, truncate } from '@/lib/utils';
import { EVENTS, track } from '@/lib/analytics';
import { alreadySentRecently, sendEmail, templates } from '@/lib/email';
import {
  assertWithinQuota,
  recordUsage,
  getUsage,
  type OrganizationWithBrand,
} from '@/lib/organization';
import { AiNotConfiguredError, MODEL, SYSTEM_CORE, buildBrandBlock, getAnthropic } from './client';
import { CONTENT_TYPES } from './content-types';

/**
 * Orquestador de generacion de contenido.
 *
 * Responsabilidades, en orden:
 *   1. validar la entrada contra la definicion del formato,
 *   2. comprobar la cuota del plan ANTES de gastar tokens,
 *   3. llamar al modelo,
 *   4. persistir el resultado y el consumo,
 *   5. disparar analitica y avisos.
 *
 * Devuelve un resultado discriminado en vez de lanzar: quien llama (una Server
 * Action) necesita mostrar el motivo al usuario, no una traza.
 */

export type GenerateParams = {
  organization: OrganizationWithBrand;
  userId: string;
  type: ContentType;
  input: Record<string, string>;
  projectId?: string | null;
};

export type GenerateResult =
  | { ok: true; generation: Generation }
  | { ok: false; code: 'QUOTA' | 'VALIDATION' | 'NOT_CONFIGURED' | 'PROVIDER'; error: string };

/** Margen sobre el objetivo de palabras para calcular max_tokens (1 palabra ~ 2 tokens en espanol). */
const TOKENS_PER_WORD = 2.2;

export async function generateContent(params: GenerateParams): Promise<GenerateResult> {
  const { organization, userId, type, input, projectId } = params;
  const def = CONTENT_TYPES[type];
  if (!def) return { ok: false, code: 'VALIDATION', error: 'Tipo de contenido desconocido.' };

  // 1. Validacion de campos obligatorios y longitudes.
  for (const field of def.fields) {
    const value = (input[field.name] ?? '').trim();
    if (field.required && !value) {
      return { ok: false, code: 'VALIDATION', error: `El campo "${field.label}" es obligatorio.` };
    }
    if (field.maxLength && value.length > field.maxLength) {
      return {
        ok: false,
        code: 'VALIDATION',
        error: `El campo "${field.label}" supera los ${field.maxLength} caracteres.`,
      };
    }
  }

  // 2. Cuota. Se comprueba antes de llamar al modelo para no gastar dinero
  //    en una peticion que no vamos a poder servir.
  const quota = await assertWithinQuota(organization);
  if (!quota.ok) {
    await track({
      name: EVENTS.QUOTA_REACHED,
      organizationId: organization.id,
      userId,
      props: { plan: organization.plan },
    });
    return { ok: false, code: 'QUOTA', error: quota.reason };
  }

  const plan = getPlan(organization.plan);
  const requestedWords = Number(input.words) || def.defaultWords;
  const targetWords = Math.min(requestedWords, plan.limits.maxWordsPerGeneration);
  const maxTokens = Math.min(16000, Math.max(1024, Math.round(targetWords * TOKENS_PER_WORD) + 800));

  const title = buildTitle(def.label, input);

  // 3. Llamada al modelo.
  const started = Date.now();
  const brandBlock = organization.brandProfile ? buildBrandBlock(organization.brandProfile) : null;

  const systemBlocks = [
    // El bloque estable va primero y marcado para cache: es el prefijo comun
    // a todas las peticiones de todos los clientes.
    { type: 'text' as const, text: SYSTEM_CORE, cache_control: { type: 'ephemeral' as const } },
    ...(brandBlock ? [{ type: 'text' as const, text: brandBlock }] : []),
  ];

  const userPrompt = `${def.instructions(input)}

${input.tone ? `Tono solicitado para esta pieza: ${input.tone}.` : ''}
Longitud objetivo: alrededor de ${targetWords} palabras.
Idioma: ${organization.brandProfile?.language ?? 'es'}.`;

  try {
    const anthropic = getAnthropic();

    // Se usa streaming aunque no mostremos los tokens en vivo: con max_tokens
    // alto una peticion sin stream puede agotar el timeout HTTP del SDK.
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: maxTokens,
      // Opus 5 razona por defecto. Con `medium` obtenemos calidad alta a un
      // coste contenido; subir a `high` no mejora textos comerciales.
      output_config: { effort: 'medium' },
      system: systemBlocks,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const message = await stream.finalMessage();

    // El modelo puede declinar una peticion (stop_reason "refusal"). Hay que
    // comprobarlo antes de leer el contenido: en ese caso viene vacio.
    if (message.stop_reason === 'refusal') {
      await persist({
        organization,
        userId,
        projectId,
        type,
        title,
        input,
        status: GenerationStatus.FAILED,
        errorMessage: 'La peticion ha sido rechazada por las politicas de uso del modelo.',
        durationMs: Date.now() - started,
      });
      await track({
        name: EVENTS.GENERATION_FAILED,
        organizationId: organization.id,
        userId,
        props: { type, reason: 'refusal' },
      });
      return {
        ok: false,
        code: 'PROVIDER',
        error: 'El modelo ha rechazado esta peticion. Reformula el contenido solicitado.',
      };
    }

    const output = message.content
      .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    if (!output) {
      throw new Error('El modelo devolvio una respuesta vacia.');
    }

    const inputTokens =
      message.usage.input_tokens +
      (message.usage.cache_creation_input_tokens ?? 0) +
      (message.usage.cache_read_input_tokens ?? 0);
    const outputTokens = message.usage.output_tokens;
    const costCents = estimateCostCents(inputTokens, outputTokens);
    const words = countWords(output);

    // 4. Persistencia y consumo.
    const generation = await prisma.generation.create({
      data: {
        organizationId: organization.id,
        userId,
        projectId: projectId || null,
        type,
        status: GenerationStatus.COMPLETED,
        title,
        input: input as never,
        output,
        model: MODEL,
        inputTokens,
        outputTokens,
        costCents,
        durationMs: Date.now() - started,
      },
    });

    await recordUsage(organization, { words, inputTokens, outputTokens, costCents });

    // 5. Analitica y avisos (no bloquean el resultado).
    await track({
      name: EVENTS.GENERATION_CREATED,
      organizationId: organization.id,
      userId,
      props: { type, words, costCents, model: MODEL },
    });
    void notifyIfNearQuota(organization, userId);

    return { ok: true, generation };
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return {
        ok: false,
        code: 'NOT_CONFIGURED',
        error: 'El generador no esta disponible: falta configurar la clave de Anthropic.',
      };
    }

    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[ai] fallo la generacion', error);

    await persist({
      organization,
      userId,
      projectId,
      type,
      title,
      input,
      status: GenerationStatus.FAILED,
      errorMessage: truncate(message, 400),
      durationMs: Date.now() - started,
    });

    await track({
      name: EVENTS.GENERATION_FAILED,
      organizationId: organization.id,
      userId,
      props: { type, message: truncate(message, 200) },
    });

    return {
      ok: false,
      code: 'PROVIDER',
      error: 'No hemos podido generar el contenido. Vuelve a intentarlo en unos segundos.',
    };
  }
}

// ---------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------

/** Titulo legible para la biblioteca, derivado del primer campo con contenido. */
function buildTitle(label: string, input: Record<string, string>): string {
  const candidate =
    input.product || input.topic || input.keyword || input.page || input.subject || input.goal || '';
  return truncate(candidate ? `${label}: ${candidate}` : label, 90);
}

/** Guarda una generacion fallida para que quede trazada en el historico. */
async function persist(args: {
  organization: OrganizationWithBrand;
  userId: string;
  projectId?: string | null;
  type: ContentType;
  title: string;
  input: Record<string, string>;
  status: GenerationStatus;
  errorMessage?: string;
  durationMs: number;
}): Promise<Generation | null> {
  try {
    return await prisma.generation.create({
      data: {
        organizationId: args.organization.id,
        userId: args.userId,
        projectId: args.projectId || null,
        type: args.type,
        status: args.status,
        title: args.title,
        input: args.input as never,
        errorMessage: args.errorMessage,
        durationMs: args.durationMs,
        model: MODEL,
      },
    });
  } catch (err) {
    console.error('[ai] no se pudo registrar la generacion fallida', err);
    return null;
  }
}

/**
 * Avisa por email al llegar al 80% de la cuota. El aviso es una vez por
 * periodo: `warnedAt` en UsagePeriod evita repetirlo en cada generacion.
 */
async function notifyIfNearQuota(organization: OrganizationWithBrand, userId: string): Promise<void> {
  try {
    const usage = await getUsage(organization);
    if (usage.percent < 80) return;

    const period = await prisma.usagePeriod.findUnique({
      where: {
        organizationId_periodStart: {
          organizationId: organization.id,
          periodStart: usage.periodStart,
        },
      },
    });
    if (!period || period.warnedAt) return;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return;

    if (!(await alreadySentRecently(user.email, 'quota-warning', 24 * 7))) {
      await sendEmail({
        to: user.email,
        template: 'quota-warning',
        organizationId: organization.id,
        email: templates.quotaWarning(usage.used, usage.limit, getPlan(organization.plan).name),
      });
    }

    await prisma.usagePeriod.update({ where: { id: period.id }, data: { warnedAt: new Date() } });
  } catch (err) {
    console.error('[ai] no se pudo enviar el aviso de cuota', err);
  }
}
