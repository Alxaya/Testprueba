import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

/** Layout de las paginas de acceso: columna de formulario + panel de refuerzo. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col p-6 sm:p-10">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">{children}</div>
        <p className="muted text-center text-xs">
          <Link href="/" className="hover:text-brand-600">
            ← Volver a la web
          </Link>
        </p>
      </div>

      <aside
        className="hidden flex-col justify-center p-12 lg:flex"
        style={{ background: 'var(--bg-subtle)' }}
      >
        <blockquote className="max-w-md">
          <p className="text-xl font-medium leading-relaxed">
            «Tenia 180 productos sin descripcion decente. En dos tardes los tuve todos escritos y
            con el mismo tono. Eso antes eran semanas.»
          </p>
          <footer className="muted mt-5 text-sm">
            Ejemplo ilustrativo del caso de uso mas habitual
          </footer>
        </blockquote>

        <dl className="mt-12 grid max-w-md grid-cols-3 gap-6">
          {[
            { k: '7', v: 'formatos de contenido' },
            { k: '<20s', v: 'por pieza generada' },
            { k: '0 €', v: 'para empezar' },
          ].map((stat) => (
            <div key={stat.v}>
              <dt className="text-2xl font-bold text-brand-600">{stat.k}</dt>
              <dd className="muted mt-1 text-xs leading-snug">{stat.v}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  );
}
