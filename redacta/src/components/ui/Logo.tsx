import Link from 'next/link';
import { site } from '@/lib/site';

/** Marca de la aplicacion. Sin imagen: SVG inline, cero peticiones extra. */
export function Logo({ href = '/', compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-bold tracking-tight">
      <span
        aria-hidden
        className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 19.5V6a2 2 0 0 1 2-2h9l5 5v10.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
      {!compact && <span className="text-[1.0625rem]">{site.name}</span>}
    </Link>
  );
}
