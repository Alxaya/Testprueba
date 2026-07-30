import Link from "next/link";
import { Logo } from "@/components/site-header";

export default function NotFound() {
  return (
    <main
      id="contenido"
      className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center"
    >
      <Logo />
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Aquí no hay nada</h1>
      <p className="mt-2 text-sm text-text-muted">
        La página que buscas no existe, o el informe que intentas abrir se ha borrado o ha dejado de
        estar compartido.
      </p>
      <Link href="/" className="btn btn-primary mt-6">
        Ir al inicio
      </Link>
    </main>
  );
}
