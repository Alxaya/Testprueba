import Link from "next/link";
import { AnalyzerForm } from "@/components/analyzer-form";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { getQuotaStatus } from "@/lib/quota";
import { PRODUCT_CATALOG } from "@/lib/valuation/catalog";
import { CATEGORY_LABELS, type CategoryKey } from "@/lib/valuation/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  const quota = user ? await getQuotaStatus(user.id, user.plan) : null;

  // Cifras reales del catálogo cargado: nada de números decorativos.
  const modelCount = PRODUCT_CATALOG.length;
  const categories = [...new Set(PRODUCT_CATALOG.map((p) => p.category))] as CategoryKey[];
  const brandCount = new Set(PRODUCT_CATALOG.map((p) => p.brand)).size;

  return (
    <>
      <SiteHeader user={user} />

      <main id="contenido">
        {/* --------------------------------------------------------- hero */}
        <section className="relative overflow-hidden border-b border-border">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-40 h-80 bg-[radial-gradient(ellipse_at_center,var(--accent-soft),transparent_70%)] opacity-70"
          />
          <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-20">
            <div className="mx-auto max-w-3xl text-center">
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-muted shadow-sm">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-good" />
                {modelCount} modelos de referencia · {brandCount} marcas · {categories.length}{" "}
                categorías
              </p>

              <h1 className="mt-5 text-balance text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
                ¿Ese anuncio de segunda mano{" "}
                <span className="text-accent">merece la pena</span>?
              </h1>

              <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-text-muted sm:text-lg">
                Pega el enlace, el texto o una captura. En segundos tendrás el precio real de
                mercado, el ahorro estimado, las señales de estafa, los riesgos detectados y cuánto
                ofrecer exactamente al vendedor.
              </p>

              <ul className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-text-muted">
                {[
                  "Precio de mercado auditable",
                  "Detección de fraude",
                  "Precio para negociar",
                  "Informe en PDF",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <CheckIcon />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Analizador: la función principal, sin barreras */}
            <div className="mx-auto mt-10 max-w-3xl">
              <AnalyzerForm
                isLoggedIn={Boolean(user)}
                quotaRemaining={quota ? quota.remaining : null}
              />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------- cómo funciona */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Cifras que puedes comprobar
            </h2>
            <p className="mt-3 text-text-muted">
              El precio no lo estima un modelo de lenguaje. Sale del PVP oficial de lanzamiento del
              producto, su antigüedad, su estado y sus accesorios, con una curva de depreciación
              calibrada por categoría. Cada informe muestra el cálculo paso a paso.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "La IA lee el anuncio",
                body: "Identifica marca, modelo, capacidad, color, estado, accesorios y daños visibles en las capturas. Solo observa: no pone precios.",
              },
              {
                step: "2",
                title: "El motor calcula el precio",
                body: "PVP oficial de lanzamiento × depreciación por antigüedad × estado × accesorios y daños. Determinista y reproducible.",
              },
              {
                step: "3",
                title: "Las reglas buscan el fraude",
                body: "Pago fuera de plataforma, vendedor «en el extranjero», bloqueo por iCloud, precios imposibles e incoherencias del propio anuncio.",
              },
            ].map((item) => (
              <article key={item.step} className="card p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-sm font-bold text-accent">
                  {item.step}
                </span>
                <h3 className="mt-3.5 font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{item.body}</p>
              </article>
            ))}
          </div>

          <p className="mt-6 text-sm text-text-muted">
            <Link href="/como-funciona" className="font-semibold text-accent hover:underline">
              Ver el método de valoración completo →
            </Link>
          </p>
        </section>

        {/* ------------------------------------------------ qué se analiza */}
        <section className="border-y border-border bg-surface-2">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Qué puedes analizar</h2>
            <p className="mt-3 max-w-2xl text-text-muted">
              {modelCount} modelos con su precio oficial de lanzamiento en el catálogo de referencia.
              Añadir una categoría nueva es añadir su curva de depreciación y sus modelos: el motor
              no cambia.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => {
                const models = PRODUCT_CATALOG.filter((p) => p.category === category);
                const brands = [...new Set(models.map((m) => m.brand))];
                return (
                  <article key={category} className="card p-5">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-semibold">{CATEGORY_LABELS[category]}</h3>
                      <span className="tnum text-xs font-medium text-text-muted">
                        {models.length} modelos
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-text-muted">{brands.join(" · ")}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- funciones */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Todo lo que incluye</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: "Historial completo", body: "Cada análisis queda guardado con su informe íntegro, para volver a consultarlo cuando quieras." },
              { title: "Favoritos", body: "Marca los anuncios que te interesan y consúltalos con una nota tuya al lado." },
              { title: "Comparador", body: "Pon varios anuncios uno al lado del otro y descubre cuál compensa de verdad." },
              { title: "Informe en PDF", body: "Exporta el informe completo con el desglose del cálculo para negociar con datos en la mano." },
              { title: "Enlace para compartir", body: "Genera un enlace público del informe, y revócalo cuando quieras." },
              { title: "Tema claro y oscuro", body: "Se adapta al sistema y respeta tu elección si prefieres otra cosa." },
              { title: "Cálculo auditable", body: "Cada informe muestra de dónde sale cada euro y qué frase del anuncio activó cada aviso." },
              { title: "Sin datos inventados", body: "Si no se identifica el modelo, no se da un precio. Preferimos decirte que falta un dato." },
            ].map((item) => (
              <article key={item.title} className="card p-5">
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------------- planes */}
        <section id="precios" className="border-t border-border bg-surface-2">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Planes</h2>
              <p className="mx-auto mt-3 max-w-xl text-text-muted">
                Empieza gratis. Pásate a Premium cuando analices muchos anuncios o necesites
                exportar informes.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <PlanCard
                name="Gratis"
                price="0 €"
                period="para siempre"
                features={[
                  "5 análisis al día",
                  "Informe completo con todas las señales",
                  "Historial y favoritos",
                  "Comparador de 2 anuncios",
                  "Enlaces para compartir",
                ]}
                cta={{ href: "/registro", label: "Crear cuenta gratis", variant: "ghost" }}
              />
              <PlanCard
                name="Premium"
                price="4,99 €"
                period="al mes"
                highlighted
                features={[
                  "Análisis ilimitados",
                  "Exportación de informes en PDF",
                  "Comparador ilimitado",
                  "Historial ilimitado",
                  "Análisis prioritario",
                  "Cancela cuando quieras",
                ]}
                cta={{ href: "/registro?plan=premium", label: "Empezar con Premium", variant: "primary" }}
              />
            </div>

            <p className="mt-5 text-center text-xs text-text-muted">
              Pagos gestionados por Stripe. DealScan AI no almacena datos de tarjeta.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

function PlanCard({
  name,
  price,
  period,
  features,
  cta,
  highlighted = false,
}: {
  name: string;
  price: string;
  period: string;
  features: string[];
  cta: { href: string; label: string; variant: "primary" | "ghost" };
  highlighted?: boolean;
}) {
  return (
    <article
      className={`card flex flex-col p-6 ${highlighted ? "border-accent/40 ring-1 ring-accent/20" : ""}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{name}</h3>
        {highlighted && (
          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-accent">
            Recomendado
          </span>
        )}
      </div>

      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="tnum text-3xl font-bold">{price}</span>
        <span className="text-sm text-text-muted">{period}</span>
      </p>

      <ul className="mt-5 flex-1 space-y-2.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-text-muted">
            <span className="mt-0.5 shrink-0 text-accent">
              <CheckIcon />
            </span>
            {feature}
          </li>
        ))}
      </ul>

      <Link
        href={cta.href}
        className={`btn mt-6 w-full ${cta.variant === "primary" ? "btn-primary" : "btn-ghost"}`}
      >
        {cta.label}
      </Link>
    </article>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      aria-hidden
      className="h-3.5 w-3.5 text-accent"
    >
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
