import type { Metadata } from 'next';
import Link from 'next/link';
import { CONTENT_TYPE_LIST } from '@/lib/ai/content-types';
import { PLANS, PLAN_ORDER, formatPrice } from '@/lib/plans';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: `${site.name} — ${site.tagline}`,
  description: site.description,
  alternates: { canonical: '/' },
};

/** Preguntas frecuentes de la portada. Se reutilizan como datos estructurados. */
const faqs = [
  {
    q: '¿En que se diferencia de usar ChatGPT directamente?',
    a: 'En que aqui no partes de cero cada vez. Redacta guarda el perfil de tu marca (sector, publico, tono, palabras clave y lo que nunca debe decirse) y lo aplica a cada pieza, con plantillas ya afinadas para cada formato: ficha de producto, articulo SEO, guion de video. Ademas te deja todo guardado, organizado por proyecto y listo para exportar.',
  },
  {
    q: '¿El contenido suena a IA?',
    a: 'Ese es precisamente el trabajo. El sistema tiene instrucciones explicitas contra los topicos habituales de la IA, las aperturas de relleno y las estructuras repetitivas, y escribe en espanol de Espana. Aun asi, recomendamos revisar siempre antes de publicar: la herramienta acelera el 90% del trabajo, no sustituye tu criterio.',
  },
  {
    q: '¿Puedo probarlo sin tarjeta?',
    a: 'Si. El plan gratuito incluye 5 generaciones al mes y no pide datos de pago. Si te encaja, puedes pasar a un plan de pago cuando quieras.',
  },
  {
    q: '¿Que pasa con mis datos y los de mis clientes?',
    a: 'Tu contenido es tuyo. No lo usamos para entrenar modelos ni lo compartimos. Puedes exportarlo o borrar tu cuenta y todo su contenido en cualquier momento desde ajustes.',
  },
  {
    q: '¿Puedo cancelar cuando quiera?',
    a: 'Si, desde el portal de facturacion y sin llamadas ni formularios. Mantienes el acceso hasta el final del periodo que ya has pagado.',
  },
];

const steps = [
  {
    n: '01',
    title: 'Define tu marca una vez',
    body: 'Sector, publico objetivo, tono de voz, propuesta de valor y lo que nunca debe aparecer en tus textos. Dos minutos que condicionan todo lo demas.',
  },
  {
    n: '02',
    title: 'Elige formato y rellena 3 campos',
    body: 'Ficha de producto, articulo SEO, guion de video, anuncio, email o FAQ. Cada formato pide solo lo imprescindible y aplica sus propias reglas.',
  },
  {
    n: '03',
    title: 'Revisa, copia y publica',
    body: 'Recibes Markdown limpio, listo para pegar en Shopify, WooCommerce o tu gestor de contenidos. Todo queda guardado en tu biblioteca.',
  },
];

export default function LandingPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pb-24 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="badge" style={{ background: 'var(--bg-subtle)' }}>
              <span aria-hidden>🇪🇸</span> Escrito en espanol de Espana, no traducido
            </span>

            <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] sm:text-5xl md:text-6xl">
              El contenido de tu tienda,
              <br />
              <span className="text-brand-600">escrito en un minuto</span>
            </h1>

            <p className="muted mx-auto mt-6 max-w-2xl text-lg leading-relaxed">
              Fichas de producto, articulos SEO, guiones para TikTok y campanas de email con el tono
              de tu marca. Sin plantillas genericas y sin volver a escribir el mismo prompt cada dia.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/registro" className="btn btn-primary w-full px-7 py-3 text-base sm:w-auto">
                Empezar gratis
              </Link>
              <Link href="/precios" className="btn btn-secondary w-full px-7 py-3 text-base sm:w-auto">
                Ver precios
              </Link>
            </div>

            <p className="muted mt-4 text-sm">
              5 generaciones gratis al mes · Sin tarjeta · Cancela cuando quieras
            </p>
          </div>

          {/* Muestra del resultado */}
          <div className="surface mx-auto mt-14 max-w-3xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 border-b px-4 py-3" style={{ background: 'var(--bg-subtle)' }}>
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" aria-hidden />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden />
              <span className="muted ml-2 text-xs">Ficha de producto · generada en 14 s</span>
            </div>
            <div className="prose-content p-6 text-left">
              <h3>Cepillo autolimpiante para perros de pelo largo</h3>
              <p>
                Recoges pelo del sofa todos los dias y el cepillo se atasca a los tres pasadas. Este
                cepillo suelta todo el pelo acumulado con un boton: pasas, pulsas, tiras.
              </p>
              <ul>
                <li>
                  <strong>Menos pelo por casa:</strong> retira el subpelo muerto antes de que acabe en
                  la tapiceria.
                </li>
                <li>
                  <strong>Se vacia con una mano:</strong> las puas se retraen y el pelo cae solo.
                </li>
                <li>
                  <strong>Sin tirones:</strong> las puntas van redondeadas, tambien para pieles
                  sensibles.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- Como funciona */}
      <section id="como-funciona" className="border-y py-16 sm:py-24" style={{ background: 'var(--bg-subtle)' }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold sm:text-4xl">Tres pasos, sin curva de aprendizaje</h2>
            <p className="muted mt-3 text-lg">
              La configuracion se hace una vez. A partir de ahi, publicar cuesta lo que tardas en
              rellenar tres campos.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.n} className="surface p-6">
                <span className="text-sm font-bold text-brand-600">{step.n}</span>
                <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                <p className="muted mt-2 text-sm leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- Formatos */}
      <section id="formatos" className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold sm:text-4xl">Un formato para cada canal</h2>
            <p className="muted mt-3 text-lg">
              Cada uno con sus propias reglas: limites de caracteres reales, estructura correcta y
              datos estructurados cuando hacen falta.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CONTENT_TYPE_LIST.map((type) => (
              <article key={type.id} className="surface p-6 transition-colors hover:border-brand-400">
                <span className="text-2xl" aria-hidden>
                  {type.emoji}
                </span>
                <h3 className="mt-3 font-semibold">{type.label}</h3>
                <p className="muted mt-1.5 text-sm leading-relaxed">{type.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- Diferenciacion */}
      <section className="border-y py-16 sm:py-24" style={{ background: 'var(--bg-subtle)' }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-3xl font-bold sm:text-4xl">Por que no suena a IA</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="surface p-6">
              <h3 className="mb-4 flex items-center gap-2 font-semibold">
                <span aria-hidden>❌</span> Un generador cualquiera
              </h3>
              <ul className="muted space-y-2.5 text-sm">
                <li>«En el mundo actual, la higiene de tu mascota es fundamental…»</li>
                <li>Se inventa certificaciones, medidas y plazos de envio</li>
                <li>Espanol neutro con giros latinoamericanos</li>
                <li>Ignora los limites de caracteres de Google y Meta</li>
                <li>Cada texto suena distinto al anterior</li>
              </ul>
            </div>
            <div className="surface border-brand-300 p-6">
              <h3 className="mb-4 flex items-center gap-2 font-semibold">
                <span aria-hidden>✅</span> Redacta
              </h3>
              <ul className="space-y-2.5 text-sm">
                <li>Entra directo al problema real del cliente</li>
                <li>Nunca inventa datos: si falta uno, lo marca entre corchetes</li>
                <li>Espanol de Espana, con el tono que hayas definido</li>
                <li>Cuenta los caracteres y respeta cada limite</li>
                <li>Tu perfil de marca mantiene la coherencia entre piezas</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- Precios */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Precios sin sorpresas</h2>
            <p className="muted mx-auto mt-3 max-w-xl text-lg">
              Empieza gratis. Sube de plan solo cuando el volumen lo pida.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PLAN_ORDER.map((id) => {
              const plan = PLANS[id];
              return (
                <div
                  key={id}
                  className={`surface flex flex-col p-6 ${plan.highlighted ? 'border-brand-500 ring-1 ring-brand-500' : ''}`}
                >
                  {plan.highlighted && (
                    <span className="badge mb-3 self-start border-brand-300 bg-brand-50 text-brand-700">
                      Mas elegido
                    </span>
                  )}
                  <h3 className="font-semibold">{plan.name}</h3>
                  <p className="muted mt-1 text-sm">{plan.tagline}</p>
                  <p className="mt-4 text-3xl font-extrabold">
                    {formatPrice(plan.priceCents)}
                    {plan.priceCents > 0 && <span className="muted text-sm font-normal">/mes</span>}
                  </p>
                  <p className="muted mt-1 text-xs">
                    {plan.limits.generationsPerMonth} generaciones al mes
                  </p>
                  <Link
                    href="/registro"
                    className={`btn mt-5 w-full ${plan.highlighted ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {plan.priceCents === 0 ? 'Empezar gratis' : 'Elegir plan'}
                  </Link>
                </div>
              );
            })}
          </div>

          <p className="muted mt-6 text-center text-sm">
            Precios sin IVA.{' '}
            <Link href="/precios" className="text-brand-600 underline">
              Ver comparativa completa
            </Link>
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------------ FAQ */}
      <section className="border-t py-16 sm:py-24" style={{ background: 'var(--bg-subtle)' }}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-3xl font-bold sm:text-4xl">Preguntas frecuentes</h2>
          <div className="mt-8 space-y-3">
            {faqs.map((faq) => (
              <details key={faq.q} className="surface group p-5">
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-medium">
                  {faq.q}
                  <span className="muted transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="muted mt-3 text-sm leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ CTA final */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold sm:text-4xl">Tu proxima ficha de producto, ahora</h2>
          <p className="muted mx-auto mt-3 max-w-xl text-lg">
            Cinco generaciones gratis al mes, sin tarjeta. Suficiente para ver si te sirve.
          </p>
          <Link href="/registro" className="btn btn-primary mt-8 px-8 py-3 text-base">
            Crear mi cuenta gratis
          </Link>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </>
  );
}
