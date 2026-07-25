import type { Metadata } from 'next';
import { AppShell } from '@/components/app/AppShell';
import { requireAdmin } from '@/lib/session';
import { signOutAction } from '@/app/actions/account';

export const metadata: Metadata = {
  title: { default: 'Administracion', template: '%s | Admin Redacta' },
  robots: { index: false, follow: false },
};

/**
 * Panel interno. `requireAdmin` repite la comprobacion que ya hace el
 * middleware: defensa en profundidad, por si el matcher cambia.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: user.role }}
      planName="Administracion"
      variant="admin"
      signOutAction={signOutAction}
    >
      {children}
    </AppShell>
  );
}
