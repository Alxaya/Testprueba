import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { PRODUCT_CATALOG } from "@/lib/valuation/catalog";
import { CATEGORY_LABELS, type CategoryKey } from "@/lib/valuation/types";

export const metadata: Metadata = {
  title: "Cómo se calcula el precio",
  description:
    "El método de valoración de DealScan AI, paso a paso: PVP oficial de lanzamiento, depreciación por antigüedad, estado, accesorios y daños.",
};
export const dynamic = "force-dynamic";

export default async function HowItWorksPage() {
  const user = await getCurrentUser();
  const categories = [...new Set(PRODUCT_CATALOG.map((p) => p.category))] as CategoryKey[];

  return (
    <>
      <SiteHeader user={user} />

      <main id="contenido" className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight">Cómo se calcula el precio</h1>
        <p className="mt-3 text-text-muted">
          El valor de mercado no lo estima un modelo de lenguaje. Se calcula con un método
          determinista: los mismos datos de entrada dan siempre el mismo resultado, y cada informe
          incluye el desglose completo para que puedas rehacer la cuenta a mano.
        </p>

        <section className="mt-10 space-y-6">
          {[
            {
              step: "1",
              title: "Precio oficial de lanzamiento",
              body: "Se parte del PVP con el que el fabricante lanzó ese modelo exacto, incluida su variante de almacenamiento. Es un dato objetivo y verificable, no una estimación. El catálogo guarda además el año de salida y la procedencia del dato.",
            },
            {
              step: "2",
              title: "Depreciación por antigüedad",
              body: "Sobre ese PVP se aplica la retención de valor que corresponde a los años transcurridos, con una curva propia por categoría: un móvil pierde valor mucho más rápido que una consola. La curva se ajusta después por marca, porque el valor residual de un iPhone y de un móvil de gama media no se comportan igual.",
            },
            {
              step: "3",
              title: "Estado del producto",
              body: "El resultado se ajusta según el estado: precintado, como nuevo, buen estado, aceptable o deficiente. Si el vendedor declara un estado pero describe un defecto grave, manda el defecto: se valora lo que hay, no lo que se afirma.",
            },
            {
              step: "4",
              title: "Accesorios, batería y daños",
              body: "Cada accesorio incluido suma un porcentaje concreto (la caja original, la factura, la garantía vigente) y cada daño resta el suyo (pantalla agrietada, humedad, batería degradada). Todos los porcentajes son fijos y aparecen en el informe. El desgaste estético no se penaliza dos veces si el estado declarado ya lo incluía.",
            },
            {
              step: "5",
              title: "Veredicto y negociación",
              body: "Se compara el precio pedido con el precio justo resultante. De esa ratio salen el veredicto, la puntuación global, la probabilidad de buena compra, el ahorro estimado y el plan de negociación con la cantidad concreta que conviene ofrecer.",
            },
          ].map((item) => (
            <article key={item.step} className="card p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-sm font-bold text-accent">
                  {item.step}
                </span>
                <h2 className="font-semibold">{item.title}</h2>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-text-muted">{item.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold tracking-tight">Qué papel tiene la IA</h2>
          <div className="card mt-4 p-5">
            <p className="text-sm leading-relaxed text-text-muted">
              La IA <strong className="font-semibold text-text">lee</strong>: identifica marca,
              modelo, capacidad, color, estado, accesorios y daños visibles en las capturas del
              anuncio. Es lo que mejor sabe hacer y es donde aporta valor.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">
              La IA <strong className="font-semibold text-text">no pone precios</strong>. Nunca se le
              pide un valor de mercado, así que no puede inventarse uno. Todas las cifras salen del
              motor determinista descrito arriba. Además, lo que devuelve la IA se cruza con un
              analizador por reglas: si ambos discrepan —por ejemplo en la capacidad—, el informe lo
              señala como incoherencia en lugar de elegir uno en silencio.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">
              Si el modelo del anuncio no está en el catálogo de referencia, el informe{" "}
              <strong className="font-semibold text-text">no da ningún precio</strong>: analiza los
              riesgos y te dice qué dato falta. Preferimos admitir el hueco antes que rellenarlo con
              una cifra inventada.
            </p>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold tracking-tight">Detección de estafas</h2>
          <p className="mt-3 text-sm leading-relaxed text-text-muted">
            Cada señal es una regla explícita con un peso documentado sobre el índice de riesgo, y el
            informe muestra el fragmento exacto del anuncio que la activó. Entre otras: pago fuera de
            la plataforma, vendedor «en el extranjero», señal o reserva por adelantado, indicios de
            bloqueo por cuenta iCloud o Google, IMEI en lista negra, precios imposibles frente al
            mercado, fotos de catálogo, presión por urgencia e incoherencias internas del anuncio.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-text-muted">
            El riesgo actúa como techo de la puntuación: un anuncio con señales graves nunca obtiene
            buena nota, por muy barato que sea. Un precio de gancho es precisamente lo contrario de
            una oportunidad.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold tracking-tight">Catálogo de referencia</h2>
          <p className="mt-3 text-sm leading-relaxed text-text-muted">
            {PRODUCT_CATALOG.length} modelos con su PVP oficial de lanzamiento, repartidos en{" "}
            {categories.length} categorías. Añadir una categoría nueva consiste en declarar su curva
            de depreciación y sus modelos: el motor de valoración no cambia.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {categories.map((category) => {
              const models = PRODUCT_CATALOG.filter((p) => p.category === category);
              const years = models.map((m) => m.releaseYear);
              return (
                <li key={category} className="card p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold">{CATEGORY_LABELS[category]}</span>
                    <span className="tnum text-xs text-text-muted">{models.length} modelos</span>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    Lanzamientos de {Math.min(...years)} a {Math.max(...years)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="mt-10 text-center">
          <Link href="/" className="btn btn-primary">
            Analizar un anuncio
          </Link>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
