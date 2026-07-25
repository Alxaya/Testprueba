import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { navigation, site } from '@/lib/site';

export function SiteFooter() {
  return (
    <footer className="border-t" style={{ background: 'var(--bg-subtle)' }}>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Logo />
            <p className="muted mt-3 max-w-xs text-sm leading-relaxed">
              {site.description}
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold">Producto</h2>
            <ul className="space-y-2 text-sm">
              {navigation.marketing.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="muted transition-colors hover:text-brand-600">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/registro" className="muted transition-colors hover:text-brand-600">
                  Crear cuenta
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold">Legal</h2>
            <ul className="space-y-2 text-sm">
              {navigation.legal.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="muted transition-colors hover:text-brand-600">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="muted mt-10 flex flex-col gap-2 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {site.legalName}. Todos los derechos reservados.
          </p>
          <p>Analitica propia y sin cookies de terceros.</p>
        </div>
      </div>
    </footer>
  );
}
