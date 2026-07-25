import type { Metadata } from 'next';
import { AppShell } from '@/components/app/AppShell';
import { requireUserWithOrg } from '@/lib/session';
import { signOutAction } from '@/app/actions/account';
import { getPlan } from '@/lib/plans';

export const metadata: Metadata = {
  title: { default: 'Panel', template: '%s | Redacta' },
  robots: { index: false, follow: false },
};

/** Todo el panel de cliente exige sesion iniciada y organizacion activa. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, organization } = await requireUserWithOrg();

  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: user.role }}
      planName={`Plan ${getPlan(organization.plan).name}`}
      signOutAction={signOutAction}
    >
      {children}
    </AppShell>
  );
}
