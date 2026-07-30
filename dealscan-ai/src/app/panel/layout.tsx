import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/panel", label: "Resumen" },
  { href: "/panel/historial", label: "Historial" },
  { href: "/panel/favoritos", label: "Favoritos" },
  { href: "/panel/comparar", label: "Comparador" },
  { href: "/panel/suscripcion", label: "Suscripción" },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=/panel");

  return (
    <>
      <SiteHeader user={user} />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <nav
          aria-label="Secciones del panel"
          className="no-print -mx-1 mb-7 flex gap-1 overflow-x-auto pb-1"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main id="contenido">{children}</main>
      </div>

      <SiteFooter />
    </>
  );
}
