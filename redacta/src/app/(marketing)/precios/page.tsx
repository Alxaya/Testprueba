import type { Metadata } from 'next';
import Link from 'next/link';
import { PLANS, PLAN_ORDER, formatPrice } from '@/lib/plans';
import { formatNumber } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Precios',
  description:
    'Planes de Redacta desde 0 €. Compara generaciones incluidas, proyectos, usuarios y funciones. Sin permanencia y con cancelacion en un clic.',
  alternates: { canonical: '/precios' },
};

const comparison: Array<{ label: string; value: (planId: (typeof PLAN_ORDER)[number]) => string }> = [
  {
    label: 'Generaciones al mes',
    value: (id) => formatNumber(PLANS[id].limits.generationsPerMonth),
  },
  {
    label: 'Palabras maximas por pieza',
    value: (id) => formatNumber(PLANS[id].limits.maxWordsPerGeneration),
  },
  { label: 'Proyectos', value: (id) => formatNumber(PLANS[id].limits.projects) },
  { label: 'Usuarios', value: (id) => formatNumber(PLANS[id].limits.seats) },
  { label: 'Todos los formatos', value: (id) => (id === 'FREE' ? 'Parcial' : 'Si') },
  { label: 'Exportacion Markdown / CSV', value: (id) => (id === 'FREE' ? 'No' : 'Si') },
  { label: 'Acceso a la API', value: (id) => (id === 'BUSINESS' ? 'Si' : 'No') },
  {
    label: 'Soporte',
    value: (id) =>
      id === 'FREE' ? 'Documentacion' : id === 'BUSINESS' ? 'Prioritario con SLA' : 'Email',
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <header className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-extrabold sm:text-5xl">Precios</h1>
        <p className="muted mt-4 text-lg">
          Paga por volumen de contenido, no por usuario. Cambia o cancela cuando quieras: el ajuste
          se prorratea automaticamente.
        </p>
      </header>

      {/* Tarjetas de plan */}
      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {PLAN_ORDER.map((id) => {
          const plan = PLANS[id];
          return (
            <section
              key={id}
              className={`surface flex flex-col p-6 ${plan.highlighted ? 'border-brand-500 ring-1 ring-brand-500' : ''}`}
            >
              {plan.highlighted && (
                <span className="badge mb-3 self-start border-brand-300 bg-brand-50 text-brand-700">
                  Mas elegido
                </span>
              )}
              <h2 className="text-lg font-semibold">{plan.name}</h2>
              <p className="muted mt-1 text-sm">{plan.tagline}</p>

              <p className="mt-5 text-4xl font-extrabold">
                {formatPrice(plan.priceCents)}
                {plan.priceCents > 0 && (
                  <span className="muted text-base font-normal">/mes</span>
                )}
              </p>

              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className="text-brand-600" aria-hidden>
                      ✓
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/registro"
                className={`btn mt-6 w-full ${plan.highlighted ? 'btn-primary' : 'btn-secondary'}`}
              >
                {plan.priceCents === 0 ? 'Empezar gratis' : `Elegir ${plan.name}`}
              </Link>
            </section>
          );
        })}
      </div>

      <p className="muted mt-6 text-center text-sm">
        Todos los precios son sin IVA. Se factura mensualmente en euros.
      </p>

      {/* Tabla comparativa */}
      <section className="mt-20">
        <h2 className="text-2xl font-bold">Comparativa completa</h2>
        <div className="scroll-x surface mt-6">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-subtle)' }}>
                <th className="p-4 text-left font-semibold">Caracteristica</th>
                {PLAN_ORDER.map((id) => (
                  <th key={id} className="p-4 text-left font-semibold">
                    {PLANS[id].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.label} className="border-t">
                  <th scope="row" className="p-4 text-left font-medium">
                    {row.label}
                  </th>
                  {PLAN_ORDER.map((id) => (
                    <td key={id} className="muted p-4">
                      {row.value(id)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Dudas de facturacion */}
      <section className="mt-20 grid gap-6 md:grid-cols-2">
        {[
          {
            q: '¿Que cuenta como generacion?',
            a: 'Cada vez que pulsas "Generar" y recibes contenido. Si el resultado no te convence y regeneras, cuenta como una generacion nueva. Las que fallan por un error del sistema no se descuentan.',
          },
          {
            q: '¿Que pasa si agoto mi cuota?',
            a: 'Te avisamos al llegar al 80%. Al agotarla puedes esperar a la renovacion del periodo o subir de plan y seguir al momento. No hay cargos automaticos por exceso.',
          },
          {
            q: '¿Puedo cambiar de plan a mitad de mes?',
            a: 'Si. Stripe prorratea la diferencia automaticamente: solo pagas lo que corresponde al tiempo restante del periodo.',
          },
          {
            q: '¿Y si cancelo?',
            a: 'Mantienes el acceso hasta el final del periodo pagado. Despues la cuenta pasa a plan gratuito: conservas todo tu contenido y puedes exportarlo cuando quieras.',
          },
        ].map((item) => (
          <div key={item.q} className="surface p-6">
            <h3 className="font-semibold">{item.q}</h3>
            <p className="muted mt-2 text-sm leading-relaxed">{item.a}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
