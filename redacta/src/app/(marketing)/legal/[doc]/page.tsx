import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LEGAL_DOCS, getLegalDoc } from '@/content/legal';
import { markdownToHtml } from '@/lib/markdown';
import { formatDate } from '@/lib/utils';
import { navigation } from '@/lib/site';

type Props = { params: Promise<{ doc: string }> };

/** Las cuatro paginas legales se generan estaticamente en el build. */
export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ doc: d.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { doc } = await params;
  const legal = getLegalDoc(doc);
  if (!legal) return { title: 'Documento no encontrado' };

  return {
    title: legal.title,
    description: legal.description,
    alternates: { canonical: `/legal/${legal.slug}` },
    robots: { index: true, follow: true },
  };
}

export default async function LegalPage({ params }: Props) {
  const { doc } = await params;
  const legal = getLegalDoc(doc);
  if (!legal) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <nav aria-label="Documentos legales" className="mb-10 flex flex-wrap gap-2">
        {navigation.legal.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`badge transition-colors ${
              item.href === `/legal/${legal.slug}`
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'muted hover:text-brand-600'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <h1 className="text-3xl font-extrabold sm:text-4xl">{legal.title}</h1>
      <p className="muted mt-2 text-sm">
        Ultima actualizacion: {formatDate(legal.updatedAt)}
      </p>

      <div
        className="prose-content mt-10"
        // Contenido propio en Markdown; markdownToHtml escapa la entrada.
        dangerouslySetInnerHTML={{ __html: markdownToHtml(legal.bodyMd) }}
      />
    </div>
  );
}
