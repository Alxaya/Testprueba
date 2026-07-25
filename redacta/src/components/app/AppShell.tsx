'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Logo } from '@/components/ui/Logo';
import { navigation } from '@/lib/site';
import { cn } from '@/lib/utils';

/**
 * Estructura del panel: barra lateral fija en escritorio, cajon deslizante en
 * movil. Cliente unicamente por el estado del cajon y la ruta activa.
 */

type Props = {
  children: React.ReactNode;
  user: { name: string | null; email: string; role: 'USER' | 'ADMIN' };
  planName: string;
  variant?: 'app' | 'admin';
  signOutAction: () => Promise<void>;
};

export function AppShell({ children, user, planName, variant = 'app', signOutAction }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = variant === 'admin' ? navigation.admin : navigation.app;
  const rootHref = variant === 'admin' ? '/admin' : '/app';

  const isActive = (href: string) =>
    href === rootHref ? pathname === rootHref : pathname.startsWith(href);

  const nav = (
    <nav className="flex flex-col gap-0.5" aria-label="Navegacion del panel">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setOpen(false)}
          aria-current={isActive(item.href) ? 'page' : undefined}
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive(item.href)
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
              : 'muted hover:bg-ink-100 dark:hover:bg-ink-800',
          )}
        >
          <span aria-hidden>{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      {/* Barra lateral en escritorio */}
      <aside
        className="hidden border-r lg:flex lg:flex-col lg:justify-between lg:p-4"
        style={{ background: 'var(--bg-subtle)' }}
      >
        <div>
          <div className="px-2 py-2">
            <Logo href={rootHref} />
            {variant === 'admin' && (
              <span className="badge mt-2 border-amber-300 bg-amber-50 text-amber-700">Admin</span>
            )}
          </div>
          <div className="mt-6">{nav}</div>
        </div>

        <div className="surface p-3">
          <p className="truncate text-sm font-medium">{user.name ?? user.email}</p>
          <p className="muted truncate text-xs">{planName}</p>
          <div className="mt-2 flex flex-col gap-1">
            {user.role === 'ADMIN' && (
              <Link
                href={variant === 'admin' ? '/app' : '/admin'}
                className="btn btn-ghost justify-start px-2 py-1 text-xs"
              >
                {variant === 'admin' ? 'Ver como cliente' : 'Panel de admin'}
              </Link>
            )}
            <form action={signOutAction}>
              <button type="submit" className="btn btn-ghost w-full justify-start px-2 py-1 text-xs">
                Cerrar sesion
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        {/* Barra superior en movil */}
        <header className="flex items-center justify-between border-b px-4 py-3 lg:hidden">
          <Logo href={rootHref} />
          <button
            type="button"
            className="btn btn-secondary"
            aria-expanded={open}
            aria-controls="menu-panel"
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
        </header>

        {open && (
          <div id="menu-panel" className="border-b p-4 lg:hidden" style={{ background: 'var(--bg-subtle)' }}>
            {nav}
            <form action={signOutAction} className="mt-3 border-t pt-3">
              <button type="submit" className="btn btn-secondary w-full">
                Cerrar sesion
              </button>
            </form>
          </div>
        )}

        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
