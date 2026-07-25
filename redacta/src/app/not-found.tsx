import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <Logo />
      <h1 className="mt-8 text-5xl font-extrabold">404</h1>
      <p className="muted mt-3 max-w-sm">
        Esta pagina no existe o se ha movido. Puede que el enlace este mal escrito.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-primary">
          Ir a la portada
        </Link>
        <Link href="/blog" className="btn btn-secondary">
          Ver el blog
        </Link>
      </div>
    </div>
  );
}
