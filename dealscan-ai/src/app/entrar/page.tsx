import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Iniciar sesión" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/panel");

  return (
    <>
      <SiteHeader user={null} />
      <main id="contenido" className="mx-auto w-full max-w-md px-4 py-14 sm:px-6">
        <Suspense fallback={<div className="card h-96 animate-pulse" />}>
          <AuthForm mode="login" />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
