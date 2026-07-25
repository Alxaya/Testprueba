import { auth } from '@/auth';
import { SiteHeader } from '@/components/marketing/SiteHeader';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { PageviewTracker } from '@/components/analytics/PageviewTracker';

/** Layout de la web publica: cabecera, pie y registro de visitas. */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader isLoggedIn={Boolean(session?.user)} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <PageviewTracker />
    </div>
  );
}
