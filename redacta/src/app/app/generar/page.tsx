import type { Metadata } from 'next';
import Link from 'next/link';
import { CONTENT_TYPE_LIST } from '@/lib/ai/content-types';

export const metadata: Metadata = { title: 'Generar contenido' };

/** Selector de formato. */
export default function GenerateIndexPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">¿Que quieres crear?</h1>
        <p className="muted mt-1">
          Cada formato aplica sus propias reglas: estructura, limites de caracteres y datos
          estructurados cuando hacen falta.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {CONTENT_TYPE_LIST.map((type) => (
          <Link
            key={type.id}
            href={`/app/generar/${type.slug}`}
            className="surface p-5 transition-colors hover:border-brand-400"
          >
            <span className="text-2xl" aria-hidden>
              {type.emoji}
            </span>
            <h2 className="mt-3 font-semibold">{type.label}</h2>
            <p className="muted mt-1 text-sm leading-relaxed">{type.description}</p>
            <p className="muted mt-3 text-xs">~{type.defaultWords} palabras</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
