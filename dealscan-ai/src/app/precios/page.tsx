import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Precios",
  description: "Plan gratuito con 5 análisis al día y plan Premium con análisis ilimitados y exportación en PDF.",
};
export const dynamic = "force-dynamic";

const COMPARISON: { feature: string; free: string; premium: string }[] = [
  { feature: "Análisis diarios", free: "5", premium: "Ilimitados" },
  { feature: "Informe completo con todas las señales", free: "Sí", premium: "Sí" },
  { feature: "Precio de mercado y precio justo", free: "Sí", premium: "Sí" },
  { feature: "Detección de señales de estafa", free: "Sí", premium: "Sí" },
  { feature: "Plan de negociación", free: "Sí", premium: "Sí" },
  { feature: "Lectura de capturas de pantalla", free: "Sí", premium: "Sí" },
  { feature: "Historial de análisis", free: "Sí", premium: "Ilimitado" },
  { feature: "Favoritos con notas", free: "Sí", premium: "Sí" },
  { feature: "Comparador de anuncios", free: "2 a la vez", premium: "Sin límite" },
  { feature: "Enlaces públicos para compartir", free: "Sí", premium: "Sí" },
  { feature: "Exportación del informe en PDF", free: "—", premium: "Sí" },
  { feature: "Análisis prioritario", free: "—", premium: "Sí" },
];

export default async function PricingPage() {
  const user = await getCurrentUser();

  return (
    <>
      <SiteHeader user={user} />

      <main id="contenido" className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Precios</h1>
          <p className="mx-auto mt-3 max-w-xl text-text-muted">
            Empieza gratis, sin tarjeta. Pásate a Premium si analizas muchos anuncios o necesitas
            exportar los informes.
          </p>
        </header>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <article className="card p-6">
            <h2 className="font-semibold">Gratis</h2>
            <p className="tnum mt-2 text-3xl font-bold">0 €</p>
            <p className="mt-0.5 text-sm text-text-muted">para siempre</p>
            <Link href={user ? "/" : "/registro"} className="btn btn-ghost mt-5 w-full">
              {user ? "Analizar un anuncio" : "Crear cuenta gratis"}
            </Link>
          </article>

          <article className="card border-accent/40 p-6 ring-1 ring-accent/20">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Premium</h2>
              <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-accent">
                Recomendado
              </span>
            </div>
            <p className="tnum mt-2 text-3xl font-bold">4,99 €</p>
            <p className="mt-0.5 text-sm text-text-muted">al mes · cancela cuando quieras</p>
            <Link
              href={user ? "/panel/suscripcion" : "/registro?plan=premium"}
              className="btn btn-primary mt-5 w-full"
            >
              {user ? "Contratar Premium" : "Empezar con Premium"}
            </Link>
          </article>
        </div>

        <section className="mt-12">
          <h2 className="text-xl font-bold tracking-tight">Qué incluye cada plan</h2>
          <div className="card mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Función
                  </th>
                  <th scope="col" className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Gratis
                  </th>
                  <th scope="col" className="bg-accent-soft p-3 text-left text-xs font-semibold uppercase tracking-wider text-accent">
                    Premium
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.feature} className="border-b border-border last:border-0">
                    <th scope="row" className="p-3 text-left font-medium">
                      {row.feature}
                    </th>
                    <td className="p-3 text-text-muted">{row.free}</td>
                    <td className="bg-accent-soft/40 p-3 font-medium">{row.premium}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-text-muted">
            Pagos gestionados por Stripe. DealScan AI no almacena datos de tarjeta. Puedes cancelar
            desde el portal de facturación en cualquier momento y mantendrás Premium hasta el final
            del periodo pagado.
          </p>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
