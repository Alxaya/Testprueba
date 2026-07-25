'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Logo } from '@/components/ui/Logo';
import { navigation } from '@/lib/site';

/**
 * Cabecera publica con menu responsive.
 * Es un componente de cliente unicamente por el desplegable movil.
 */
export function SiteHeader({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b backdrop-blur-md" style={{ background: 'color-mix(in srgb, var(--bg) 85%, transparent)' }}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />

        <nav className="hidden items-center gap-7 text-sm md:flex" aria-label="Principal">
          {navigation.marketing.map((item) => (
            <Link key={item.href} href={item.href} className="muted transition-colors hover:text-brand-600">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {isLoggedIn ? (
            <Link href="/app" className="btn btn-primary">
              Ir al panel
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost">
                Entrar
              </Link>
              <Link href="/registro" className="btn btn-primary">
                Empezar gratis
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="btn btn-secondary md:hidden"
          aria-expanded={open}
          aria-controls="menu-movil"
          aria-label={open ? 'Cerrar menu' : 'Abrir menu'}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            {open ? (
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div id="menu-movil" className="border-t px-4 py-4 md:hidden" style={{ background: 'var(--bg)' }}>
          <nav className="flex flex-col gap-1" aria-label="Principal movil">
            {navigation.marketing.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-ink-100 dark:hover:bg-ink-800"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t pt-3">
            {isLoggedIn ? (
              <Link href="/app" className="btn btn-primary w-full">
                Ir al panel
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-secondary w-full">
                  Entrar
                </Link>
                <Link href="/registro" className="btn btn-primary w-full">
                  Empezar gratis
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
