import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { LogoutButton } from "./logout-button";
import type { SessionUser } from "@/lib/auth";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <span
        aria-hidden
        className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-contrast"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          <path d="M8.5 11.5l2 2 4-4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      DealScan<span className="text-accent">&nbsp;AI</span>
    </span>
  );
}

export function SiteHeader({ user }: { user: SessionUser | null }) {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="text-[0.9375rem]">
          <Logo />
        </Link>

        <nav className="flex items-center gap-1.5 sm:gap-2">
          {user ? (
            <>
              <Link href="/panel" className="hidden btn btn-ghost !py-2 !text-sm sm:inline-flex">
                Panel
              </Link>
              <Link href="/panel/historial" className="hidden btn btn-ghost !py-2 !text-sm md:inline-flex">
                Historial
              </Link>
              {user.plan === "FREE" && (
                <Link href="/panel/suscripcion" className="btn btn-primary !py-2 !text-sm">
                  Hazte Premium
                </Link>
              )}
              <ThemeToggle />
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/precios" className="hidden btn btn-ghost !py-2 !text-sm sm:inline-flex">
                Precios
              </Link>
              <Link href="/entrar" className="btn btn-ghost !py-2 !text-sm">
                Entrar
              </Link>
              <Link href="/registro" className="btn btn-primary !py-2 !text-sm">
                Crear cuenta
              </Link>
              <ThemeToggle />
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="no-print mt-16 border-t border-border bg-surface-2">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="max-w-sm">
            <Logo className="text-sm" />
            <p className="mt-2.5 text-xs leading-relaxed text-text-muted">
              Analiza anuncios de segunda mano y decide con datos: precio real de mercado, señales de
              estafa y cuánto ofrecer al vendedor.
            </p>
          </div>

          <nav className="flex gap-10 text-xs">
            <div>
              <p className="font-semibold text-text">Producto</p>
              <ul className="mt-2 space-y-1.5 text-text-muted">
                <li>
                  <Link href="/" className="hover:text-accent">
                    Analizar un anuncio
                  </Link>
                </li>
                <li>
                  <Link href="/precios" className="hover:text-accent">
                    Precios
                  </Link>
                </li>
                <li>
                  <Link href="/como-funciona" className="hover:text-accent">
                    Cómo se calcula
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-text">Cuenta</p>
              <ul className="mt-2 space-y-1.5 text-text-muted">
                <li>
                  <Link href="/entrar" className="hover:text-accent">
                    Iniciar sesión
                  </Link>
                </li>
                <li>
                  <Link href="/registro" className="hover:text-accent">
                    Crear cuenta
                  </Link>
                </li>
                <li>
                  <Link href="/panel" className="hover:text-accent">
                    Mi panel
                  </Link>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        <p className="mt-8 border-t border-border pt-5 text-[0.6875rem] leading-relaxed text-text-faint">
          Los informes son orientativos y se basan en la información aportada del anuncio y en
          precios oficiales de lanzamiento de los fabricantes. No sustituyen la comprobación
          presencial del producto ni constituyen asesoramiento legal o financiero. DealScan AI no
          interviene en la transacción entre comprador y vendedor.
        </p>
      </div>
    </footer>
  );
}
